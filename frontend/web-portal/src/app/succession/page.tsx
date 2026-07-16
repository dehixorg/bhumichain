'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/dashboard/Sidebar';
import MultiSig from '@/components/forms/MultiSig';
import MutationAlert from '@/components/modals/MutationAlert';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  getDemoToken, initiateSuccession, recordHeirConsent,
  getSuccessionCase, verifyCRS, getMyPendingSuccessions,
  addInheritorNomination, getInheritorNominations, approveInheritorNomination, executeSuccession
} from '@/lib/api';
import { setToken, getUser, type JWTUser } from '@/lib/auth';
import type { SuccessionCase, SuccessionHeir } from '@/types';
import toast from 'react-hot-toast';
import {
  Users, Shield, CheckCircle, Zap, FileText,
  ChevronRight, Info, Clock, Cpu, AlertTriangle,
  Upload, Scan, Database
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

// Display helper — never show raw hash or raw digits without last 4 digits
const maskAadhaar = (val?: string | null): string => {
  if (!val) return 'XXXX-XXXX-XXXX';
  const digits = val.replace(/\D/g, '');
  if (digits.length >= 4) return `XXXX-XXXX-${digits.slice(-4)}`;
  return 'XXXX-XXXX-XXXX';
};


const FamilyTree = dynamic(
  () => import('@/components/dashboard/FamilyTree'),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 flex items-center justify-center text-gray-500 text-sm animate-pulse">
        Loading family tree…
      </div>
    ),
  },
);

// ─── Demo constants ───────────────────────────────────────────────────────────

const DEMO_FAMILY_ID = 'FAM-UP-DAD-00100-001';
const DEMO_DLPI      = 'DLPI-UP-DAD-00100';

const DEMO_DECEASED = {
  name:        'Ramesh Kumar',
  aadhaarHash: 'sha256:owner1ramesh3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9',
  dod:         '2026-05-20',
  dob:         '1958-03-15',
};

const DEMO_CRS = {
  deathCertCID:      'QmDeathCertRameshK2026',
  crsRegistrationNo: 'CRS-GBN-2026-00891',
};

const MOCK_ALERT = {
  mutationId:          'MUT-DLPI-UP-DAD-00100-d4e5f6a7',
  dlpiId:              DEMO_DLPI,
  mutationType:        'Inheritance',
  officerName:         'Amit Saxena, Tehsildar',
  alertSentAt:         new Date(Date.now() - 64_000).toISOString(),
  slaMet:              true,
  alertElapsedSeconds: 64,
};

// Offline fallback heirs — used when API is unreachable
const OFFLINE_HEIRS: SuccessionHeir[] = [
  {
    heirId: 'HEIR-001', name: 'Suresh Yadav', aadhaarHash: 'sha256:1a8df9e...',
    relation: 'Son', gender: 'Male', dob: '1988-03-15',
    isAlive: true, isAdult: true, isNri: false,
    share: '1/3', shareDecimal: 0.3333, legalNote: undefined,
    hasConsented: false, hasObjected: false,
  },
  {
    heirId: 'HEIR-002', name: 'Sunita Kumar', aadhaarHash: 'sha256:9c8d...',
    relation: 'Daughter', gender: 'Female', dob: '1991-07-22',
    isAlive: true, isAdult: true, isNri: false,
    share: '1/3', shareDecimal: 0.3333,
    legalNote: 'Equal coparcenary rights per Hindu Succession (Amendment) Act 2005 Section 6(3). Daughters have same rights as sons by birth.',
    hasConsented: false, hasObjected: false,
  },
  {
    heirId: 'HEIR-003', name: 'Priya Kumar', aadhaarHash: 'sha256:7f42...',
    relation: 'Daughter', gender: 'Female', dob: '1994-11-08',
    isAlive: true, isAdult: true, isNri: false,
    share: '1/3', shareDecimal: 0.3334,
    legalNote: 'Equal coparcenary rights per Hindu Succession (Amendment) Act 2005 Section 6(3). Daughters have same rights as sons by birth.',
    hasConsented: false, hasObjected: false,
  },
];

const AI_STEPS = [
  'Fetching family registry from Dadri tehsil, Gautam Buddha Nagar',
  'Identifying Class I heirs under HSA 1956',
  'Applying HSA 2005 S.6(3) — daughters equal coparceners',
  'Computing 1/3 shares across 3 heirs (Fraction arithmetic)',
  'Validating share sum = 1.0',
  'Checking for NRI / minor / overseas heir edge cases',
  'Pinning computation log to IPFS',
];

type Stage =
  | 'idle'
  | 'scanning_crs'
  | 'crs_verified'
  | 'ai_computing'
  | 'heirs_identified'
  | 'awaiting_consents'
  | 'all_consented'
  | 'pending_tehsildar_approval';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuccessionPage() {
  const [user, setUser]           = useState<JWTUser | null>(null);
  const [stage, setStage]         = useState<Stage>('idle');
  const [caseData, setCaseData]   = useState<SuccessionCase | null>(null);
  const [heirs, setHeirs]         = useState<SuccessionHeir[]>([]);
  const [showAlert, setShowAlert] = useState(false);
  const [aiSteps, setAiSteps]     = useState(AI_STEPS.map((label) => ({ label, done: false })));
  const [crsAiSteps, setCrsAiSteps] = useState<{label: string, done: boolean}[]>([]);
  const [crsExtraction, setCrsExtraction] = useState<any>(null);
  const [dynamicHeirs, setDynamicHeirs] = useState([{ name: '', aadhaar: '' }]);
  const [myPendingCases, setMyPendingCases] = useState<SuccessionCase[]>([]);
  const [nominations, setNominations] = useState<any[]>([]);
  const [nomDlpiId, setNomDlpiId] = useState('DLPI-UP-DAD-00100');
  const [nomInheritorName, setNomInheritorName] = useState('');
  const [nomInheritorAadhaar, setNomInheritorAadhaar] = useState('');
  const [isNomSubmitting, setIsNomSubmitting] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const addHeir = () => setDynamicHeirs([...dynamicHeirs, { name: '', aadhaar: '' }]);
  const removeHeir = (idx: number) => setDynamicHeirs(dynamicHeirs.filter((_, i) => i !== idx));
  const updateHeir = (idx: number, field: string, val: string) => {
    const newHeirs = [...dynamicHeirs];
    newHeirs[idx][field as 'name' | 'aadhaar'] = val;
    setDynamicHeirs(newHeirs);
  };

  const handleAddNomination = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = nomInheritorAadhaar.replace(/\D/g, '');
    if (!nomInheritorName.trim()) {
      toast.error('Please enter the Inheritor Name.');
      return;
    }
    if (digits.length !== 12) {
      toast.error('Inheritor Aadhaar Number must be exactly 12 digits.');
      return;
    }
    setIsNomSubmitting(true);
    try {
      const res = await addInheritorNomination({
        dlpiId: nomDlpiId,
        inheritorName: nomInheritorName.trim(),
        inheritorAadhaarNumber: digits,
      });
      toast.success(`Inheritor Nominee submitted for Tehsildar Approval (${res.nomination?.nominationId || 'NOM-SUCCESS'})!`);
      const allNoms = await getInheritorNominations();
      setNominations(allNoms || []);
      setNomInheritorName('');
      setNomInheritorAadhaar('');
    } catch (err: any) {
      toast.error('Failed to add nomination: ' + (err?.response?.data?.message || err?.message || 'Unknown error'));
    } finally {
      setIsNomSubmitting(false);
    }
  };

  const handleApproveNomination = async (nomId: string) => {
    try {
      await approveInheritorNomination(nomId);
      toast.success('Tehsildar Approved! Registered Inheritor role is now active on the network.');
      const allNoms = await getInheritorNominations();
      setNominations(allNoms || []);
    } catch (err: any) {
      toast.error('Approval failed: ' + (err?.response?.data?.message || err?.message || 'Unknown error'));
    }
  };

  const handleExecuteTehsildar = async (caseId: string) => {
    setIsExecuting(true);
    try {
      const res = await executeSuccession(caseId);
      toast.success('🎉 Property successfully Auto-Transferred to the Registered Inheritor!');
      if (res.mutatedParcel) {
        toast('Look in /my-parcels (My Land Holdings) — the title is now directly under the Inheritor!', { duration: 6000 });
      }
      setStage('all_consented');
    } catch (err: any) {
      toast.error('Execution Failed: ' + (err?.response?.data?.message || err?.message || 'Unknown error'));
    } finally {
      setIsExecuting(false);
    }
  };

  const { triggerMock, on: onWs } = useWebSocket(DEMO_DLPI);
  const citizenTokenRef = React.useRef<string | null>(null);

  useEffect(() => {
    setUser(getUser());
    citizenTokenRef.current = typeof window !== 'undefined' ? localStorage.getItem('bhumichain_token') : null;
    getMyPendingSuccessions().then(setMyPendingCases).catch(() => {});
    getInheritorNominations().then(setNominations).catch(() => {});
  }, []);

  // Live WebSocket events
  useEffect(() => {
    return onWs('*', (msg) => {
      if (msg.event === 'HeirNotificationRequired') {
        toast('📨 Heir notifications dispatched via SMS + WhatsApp', { duration: 4000 });
      }
      if (msg.event === 'AllHeirsConsentedAutoMutation') {
        setStage('all_consented');
        toast.success('All heirs consented — auto-mutation executing!');
      }
    });
  }, [onWs]);

  // ── Step 1: Verify CRS death certificate ─────────────────────────────────

  const CRS_AI_STEPS_LABELS = [
    'Uploading Death Certificate to secure IPFS vault',
    'Azure Document Intelligence OCR extraction',
    'LayoutLM NER — locating deceased name & Aadhaar',
    'Cross-referencing CRS Registration No. with UP database',
    'Validation successful'
  ];

  const handleUploadCRS = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const approvedNom = nominations.find(n => n.status === 'APPROVED');
    const myAadhaarDigits = ((user as any)?.aadhaarNumber || user?.aadhaarHash || (user as any)?.aadhaar || '').replace(/\D/g, '');
    if (approvedNom && myAadhaarDigits && myAadhaarDigits !== approvedNom.inheritorAadhaarNumber) {
      toast.error(`🚫 Access Blocked: Only the Tehsildar-approved Registered Inheritor (${approvedNom.inheritorName} — Aadhaar ending in ${approvedNom.inheritorAadhaarNumber.slice(8)}) is authorized to upload the death certificate and claim property ${approvedNom.dlpiId}.`);
      return;
    }

    setStage('scanning_crs');
    setCrsAiSteps(CRS_AI_STEPS_LABELS.map(label => ({ label, done: false })));
    setCrsExtraction(null);

    try {
      // Fast forward first step
      setCrsAiSteps(prev => prev.map((s, idx) => idx === 0 ? { ...s, done: true } : s));
      
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/scan/death-cert', {
        method: 'POST',
        body: formData,
      });
      
      let data: any = {};
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(`Server returned HTML (did you forget to run 'npm run build'?) Status: ${res.status}`);
      }
      
      // Animate remaining steps
      for (let i = 1; i < CRS_AI_STEPS_LABELS.length; i++) {
        await delay(300);
        setCrsAiSteps(prev => prev.map((s, idx) => idx <= i ? { ...s, done: true } : s));
      }
      
      if (!res.ok) throw new Error(data.detail || 'Extraction failed');
      
      setCrsExtraction({
        name: data.name || DEMO_DECEASED.name,
        dod: data.dod || DEMO_DECEASED.dod,
        aadhaarHash: data.aadhaarHash || 'XXXX-XXXX-1234',
        crsRegistrationNo: data.crsRegistrationNo || DEMO_CRS.crsRegistrationNo,
        dlpiId: data.dlpiId || DEMO_DLPI
      });
      toast.success(`CRS verified — ${data.crsRegistrationNo || 'Extracted successfully'}`);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to extract data: ' + err.message);
      // Fallback
      setCrsAiSteps(prev => prev.map(s => ({ ...s, done: true })));
      setCrsExtraction({
        name: DEMO_DECEASED.name,
        dod: DEMO_DECEASED.dod,
        aadhaarHash: 'XXXX-XXXX-1234',
        crsRegistrationNo: DEMO_CRS.crsRegistrationNo,
        dlpiId: DEMO_DLPI
      });
    }

    setStage('crs_verified');
  };

  // ── Step 2: Run CoparcenaryMapper AI ─────────────────────────────────────

  const handleRunAI = async () => {
    const approvedNom = nominations.find(n => n.status === 'APPROVED');
    const myAadhaarDigits = ((user as any)?.aadhaarNumber || user?.aadhaarHash || (user as any)?.aadhaar || '').replace(/\D/g, '');
    if (approvedNom && myAadhaarDigits && myAadhaarDigits !== approvedNom.inheritorAadhaarNumber) {
      toast.error(`🚫 Access Blocked: Only the Tehsildar-approved Registered Inheritor (${approvedNom.inheritorName} — Aadhaar ending in ${approvedNom.inheritorAadhaarNumber.slice(8)}) is authorized to initiate succession for property ${approvedNom.dlpiId}.`);
      return;
    }

    setStage('ai_computing');
    setAiSteps(AI_STEPS.map((label) => ({ label, done: false })));

    // Animate pipeline steps
    for (let i = 0; i < AI_STEPS.length; i++) {
      await delay(320);
      setAiSteps((prev) => prev.map((s, idx) => idx <= i ? { ...s, done: true } : s));
    }

    // Initiate on-chain + load case
    try {
      // Temporarily use oracle token ONLY for this call, then restore citizen session
      const citizenToken = citizenTokenRef.current || localStorage.getItem('bhumichain_token');
      await getDemoToken('oracle', 'CRS Oracle'); // sets oracle token in localStorage
      const res = await initiateSuccession({
        dlpiId:              crsExtraction?.dlpiId || DEMO_DLPI,
        familyId:            DEMO_FAMILY_ID,
        deceasedName:        crsExtraction?.name || DEMO_DECEASED.name,
        deceasedAadhaarHash: crsExtraction?.aadhaarHash || DEMO_DECEASED.aadhaarHash,
        dateOfDeath:         crsExtraction?.dod || DEMO_DECEASED.dod,
        deathCertCID:        DEMO_CRS.deathCertCID,
        crsRegistrationNo:   crsExtraction?.crsRegistrationNo || DEMO_CRS.crsRegistrationNo,
        heirs: [
          { name: user?.name || 'Initiator', aadhaar: user?.aadhaarHash || '' },
          ...dynamicHeirs
        ],
      });
      // IMMEDIATELY restore the citizen's original token
      if (citizenToken) setToken(citizenToken);
      const sc = await getSuccessionCase(res.caseId || 'SUC-DLPI-UP-DAD-00100-a1b2c3d4');
      setCaseData(sc);
      setHeirs(sc.heirs.map((h) => ({ ...h, hasConsented: false, hasObjected: false })));
    } catch (e: any) {
      console.error("[Succession] initiateSuccession failed:", e);
      const errMsg = e.response?.data?.message || e.response?.data?.error || e.message || "Unknown error";
      toast.error(`Initiation Failed: ${errMsg}`);
      
      // Full offline fallback — also restore token
      const citizenToken = citizenTokenRef.current;
      if (citizenToken) setToken(citizenToken);
      setHeirs(OFFLINE_HEIRS);
    }

    setStage('heirs_identified');

    // Fire mutation alert after a brief pause (simulates officer being notified)
    setTimeout(() => {
      triggerMock('scene3_mutation_alert');
      setShowAlert(true);
    }, 900);
  };

  // ── Heir consent ──────────────────────────────────────────────────────────

  const handleConsent = useCallback(async (heirId: string) => {
    const heir = heirs.find((h) => h.heirId === heirId);
    if (!heir || heir.hasConsented || heir.hasObjected) return;
    
    const isMatchingAadhaar = user?.aadhaarHash === heir.aadhaarHash;
    const isMatchingName = user?.name?.toLowerCase().includes((heir.name || '').toLowerCase()) || (heir.name || '').toLowerCase().includes(user?.name?.toLowerCase() || '');
    
    if (!isMatchingAadhaar && !isMatchingName) {
      toast.error(`Please log in as ${heir.name} to provide eSign consent.`);
      return;
    }

    try {
      await recordHeirConsent(
        caseData?.caseId || DEMO_DLPI,
        {
          heirAadhaarHash: heir.aadhaarHash,
          eSignTxHash: '0x' + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join(''),
        }
      );
    } catch { /* offline ok */ }

    setHeirs((prev) => {
      const updated = prev.map((h) =>
        h.heirId === heirId
          ? { ...h, hasConsented: true, consentedAt: new Date().toISOString() }
          : h,
      );
      if (updated.every((h) => h.hasConsented)) {
        setStage('pending_tehsildar_approval');
        toast.success('All 3 heirs consented — forwarded to Tehsildar!');
        triggerMock('scene3_auto_mutation'); // Keep same mock trigger so we don't break mock dependencies
      } else {
        toast.success(`${heir.name} consented ✓`);
      }
      return updated;
    });
  }, [heirs, caseData, triggerMock]);

  const handleObject = useCallback(async (heirId: string, reason: string) => {
    setHeirs((prev) =>
      prev.map((h) => h.heirId === heirId ? { ...h, hasObjected: true } : h),
    );
    toast('⚖️ Objection filed — case referred to Civil Court', { duration: 5000 });
  }, []);

  // ─── Derived state ────────────────────────────────────────────────────────

  const signers = heirs.map((h) => ({
    id:          h.heirId,
    name:        h.name,
    role:        h.relation,
    share:       h.share,
    hasConsented: h.hasConsented,
    hasObjected:  h.hasObjected,
    consentedAt:  h.consentedAt,
    legalNote:    h.legalNote,
  }));

  const patriarch = {
    name:    DEMO_DECEASED.name,
    dob:     DEMO_DECEASED.dob,
    dod:     DEMO_DECEASED.dod,
    isAlive: false,
  };

  const hearsVisible =
    stage === 'heirs_identified' ||
    stage === 'awaiting_consents' ||
    stage === 'all_consented' ||
    stage === 'pending_tehsildar_approval';

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar demoMode />

      {/* Mutation alert modal */}
      {showAlert && (
        <MutationAlert
          {...MOCK_ALERT}
          onClose={() => { setShowAlert(false); setStage('awaiting_consents'); }}
          onConsent={() => { setShowAlert(false); setStage('awaiting_consents'); }}
          onObject={() => {
            setShowAlert(false);
            toast('Filing objection with Circle Officer…');
          }}
        />
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Topbar */}
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-6 gap-3 shrink-0">
          <Users className="w-4 h-4 text-[#0F4C81]" />
          <span className="text-sm font-semibold text-gray-700">Succession & Coparcenary</span>
          <span className="text-xs text-gray-500">— Demo Scene 3</span>
          <div className="ml-auto">
            <StageBar stage={stage} />
          </div>
        </div>

        <div className="flex-1 flex gap-6 p-6">

          {/* ── Left column: main flow ──────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Registered Inheritor Active Role Banner */}
            {(() => {
              const myRoleNom = nominations.find(n => n.status === 'APPROVED' && (n.inheritorAadhaarNumber === ((user as any)?.aadhaarNumber || user?.aadhaarHash || (user as any)?.aadhaar)?.replace(/\D/g, '')));
              if (!myRoleNom) return null;
              return (
                <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-xl p-5 shadow-lg border border-emerald-400/30 flex items-start gap-4">
                  <div className="bg-white/20 p-3 rounded-lg shrink-0">
                    <CheckCircle className="w-6 h-6 text-emerald-200" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-800 text-emerald-200 text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wider">Verified Role Active</span>
                      <h3 className="font-bold text-lg">Registered Inheritor for {myRoleNom.dlpiId}</h3>
                    </div>
                    <p className="text-emerald-100 text-sm mt-1">
                      You ({myRoleNom.inheritorName} — Aadhaar: XXXX-XXXX-{myRoleNom.inheritorAadhaarNumber.slice(8)}) are explicitly Tehsildar-Approved to claim and auto-transfer this property. Upload the Death Certificate below to initiate Virasat transfer.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Nominate / Pre-Register Inheritor Setup Panel */}
            <div className="bg-gradient-to-br from-[#0F4C81] to-[#1e3a8a] text-white rounded-xl shadow-xl p-6 border border-blue-400/30">
              <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 p-2.5 rounded-lg border border-white/20">
                    <Shield className="w-6 h-6 text-blue-200" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Nominate / Pre-Register Legal Heir (Virasat Setup)</h3>
                    <p className="text-xs text-blue-200">Submit an inheritor with exact 12-digit Aadhaar for Tehsildar approval</p>
                  </div>
                </div>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold px-3 py-1 rounded-full">
                  Tehsildar Workflow
                </span>
              </div>

              <form onSubmit={handleAddNomination} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-blue-200 mb-1">Target Property (DLPI)</label>
                  <select
                    value={nomDlpiId}
                    onChange={(e) => setNomDlpiId(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/40"
                  >
                    <option value="DLPI-UP-DAD-00100" className="text-gray-900">DLPI-UP-DAD-00100 (Dadri Plot 100)</option>
                    <option value="DLPI-UP-DAD-00001" className="text-gray-900">DLPI-UP-DAD-00001 (Priya Kumar)</option>
                    <option value="DLPI-UP-DAD-00003" className="text-gray-900">DLPI-UP-DAD-00003 (Rakesh Agarwal)</option>
                    <option value="DLPI-UP-DAD-00005" className="text-gray-900">DLPI-UP-DAD-00005 (Meena Devi)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-blue-200 mb-1">Inheritor Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ankur Singh"
                    value={nomInheritorName}
                    onChange={(e) => setNomInheritorName(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-blue-300/60 focus:outline-none focus:ring-2 focus:ring-white/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-blue-200 mb-1">Inheritor 12-Digit Aadhaar</label>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    placeholder="e.g. 999900010099"
                    value={nomInheritorAadhaar}
                    onChange={(e) => setNomInheritorAadhaar(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-blue-300/60 focus:outline-none focus:ring-2 focus:ring-white/40"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isNomSubmitting}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg shadow transition flex items-center justify-center gap-2 text-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {isNomSubmitting ? 'Submitting...' : 'Add Inheritor'}
                  </button>
                </div>
              </form>

              {/* Active & Pending Nominations List */}
              {nominations.length > 0 && (
                <div className="mt-5 border-t border-white/15 pt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-200 mb-3">Registered / Pending Nominations on Network</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {nominations.map((nom) => (
                      <div key={nom.nominationId} className="bg-white/10 border border-white/20 rounded-lg p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate">{nom.inheritorName}</span>
                            <span className="text-xs text-blue-200 font-mono shrink-0">({nom.dlpiId})</span>
                          </div>
                          <div className="text-xs text-blue-200/80 font-mono mt-0.5">
                            Aadhaar ending: XXXX-{nom.inheritorAadhaarNumber?.slice(8)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {nom.status === 'APPROVED' ? (
                            <span className="bg-emerald-500/30 border border-emerald-400 text-emerald-300 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Approved
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApproveNomination(nom.nominationId)}
                              className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition flex items-center gap-1.5"
                            >
                              🧑‍⚖️ Tehsildar Approve
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {myPendingCases.length > 0 && (
              <div className="card border-[#0F4C81] border-2 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <AlertTriangle className="w-32 h-32" />
                </div>
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4 relative">
                  <div className="bg-[#0F4C81] p-2 rounded-lg shrink-0">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Pending Successions</h3>
                    <p className="text-sm text-gray-500">You have been listed as a legal heir</p>
                  </div>
                </div>
                <div className="space-y-4 relative">
                  {myPendingCases.map((c) => (
                    <div key={c.caseId} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-800">{c.deceasedName}</span>
                        <span className="text-xs text-gray-500 font-mono">{c.dlpiId}</span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-gray-600">Please provide your eSign consent</span>
                        <button
                          onClick={() => {
                            setCaseData(c);
                            setHeirs(c.heirs.map(h => ({ ...h, hasConsented: h.hasConsented || false, hasObjected: false })));
                            setStage('heirs_identified');
                          }}
                          className="btn-primary py-1 px-4 text-sm"
                        >
                          Review & eSign
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* IDLE: Trigger */}
            {stage === 'idle' && (
              <div className="space-y-5">
                
                {/* Section 1: Legal Heirs */}
                <div className="card">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                    <Users className="w-5 h-5 text-[#0F4C81]" />
                    <span className="text-base font-semibold text-gray-800">Legal Heirs</span>
                    <span className="ml-auto text-xs text-gray-400">Enter each heir's name & Aadhaar number</span>
                  </div>
                  <div className="space-y-3">
                    {dynamicHeirs.map((heir, idx) => (
                      <div key={idx} className="flex gap-4 items-end bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Full Name</label>
                          <input
                            type="text"
                            value={heir.name}
                            onChange={(e) => updateHeir(idx, 'name', e.target.value)}
                            className="input-field w-full text-sm"
                            placeholder="e.g. Suresh Yadav"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Aadhaar Number</label>
                          <input
                            type="text"
                            value={heir.aadhaar}
                            onChange={(e) => updateHeir(idx, 'aadhaar', e.target.value)}
                            className="input-field w-full text-sm font-mono"
                            placeholder="12-digit Aadhaar"
                            maxLength={12}
                          />
                        </div>
                        {dynamicHeirs.length > 1 && (
                          <button
                            onClick={() => removeHeir(idx)}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors text-xs font-semibold border border-red-100"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={addHeir}
                      className="text-[#0F4C81] text-sm font-semibold hover:underline flex items-center gap-1 mt-1"
                    >
                      + Add Another Heir
                    </button>
                  </div>
                </div>

                {/* Section 2: Upload Certificate + Submit */}
                <div className="card border-2 border-dashed border-gray-200 relative">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                    <Upload className="w-5 h-5 text-[#0F4C81]" />
                    <span className="text-base font-semibold text-gray-800">Death Certificate</span>
                    {crsExtraction && (
                      <span className="ml-auto flex items-center gap-1 text-xs text-green-700 font-bold bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" /> Uploaded
                      </span>
                    )}
                  </div>

                  {!crsExtraction ? (
                    <label className="flex flex-col items-center justify-center py-8 cursor-pointer hover:bg-gray-50 rounded-xl transition-colors group">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleUploadCRS}
                        className="hidden"
                      />
                      <div className="w-14 h-14 bg-[#0F4C81]/10 group-hover:bg-[#0F4C81]/20 rounded-full flex items-center justify-center mb-3 transition-colors">
                        <Upload className="w-7 h-7 text-[#0F4C81]" />
                      </div>
                      <div className="text-sm font-semibold text-gray-700">Click to Upload CRS Death Certificate</div>
                      <div className="text-xs text-gray-400 mt-1">PDF or image · AI will auto-extract details</div>
                    </label>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm bg-green-50 border border-green-100 rounded-xl p-4">
                        <div>
                          <span className="text-xs text-gray-500 block mb-1">Deceased</span>
                          <input type="text" value={crsExtraction.name} onChange={e => setCrsExtraction({...crsExtraction, name: e.target.value})} className="input-field w-full text-sm font-bold bg-white" />
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 block mb-1">Date of Death</span>
                          <input type="date" value={crsExtraction.dod} onChange={e => setCrsExtraction({...crsExtraction, dod: e.target.value})} className="input-field w-full text-sm font-bold bg-white" />
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 block mb-1">Parcel ID</span>
                          <input type="text" value={crsExtraction.dlpiId} onChange={e => setCrsExtraction({...crsExtraction, dlpiId: e.target.value})} className="input-field w-full text-sm font-bold text-[#0F4C81] font-mono bg-white" />
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 block mb-1">CRS Reg. No.</span>
                          <input type="text" value={crsExtraction.crsRegistrationNo} onChange={e => setCrsExtraction({...crsExtraction, crsRegistrationNo: e.target.value})} className="input-field w-full text-sm font-bold font-mono bg-white" />
                        </div>
                      </div>

                      {/* THE SUBMIT BUTTON */}
                      <button
                        onClick={handleRunAI}
                        disabled={!dynamicHeirs.some(h => h.aadhaar.length >= 12)}
                        className="w-full bg-[#0F4C81] hover:bg-[#0a3860] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-3 shadow-md hover:shadow-lg transition-all text-sm"
                      >
                        <Zap className="w-5 h-5" />
                        Submit & Send eSign Requests to All Heirs
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <p className="text-xs text-center text-gray-400">Each heir will receive an eSign request in their portal</p>
                    </div>
                  )}
                </div>
              </div>
            )}


            {/* SCANNING CRS */}
            {stage === 'scanning_crs' && (
              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <Scan className="w-4 h-4 text-[#0F4C81] animate-pulse" />
                  <span className="text-sm font-semibold text-gray-700">AI Document Scanner</span>
                  <span className="text-xs text-gray-500 ml-1">Analyzing...</span>
                </div>
                <div className="space-y-2.5">
                  {crsAiSteps.map((s, i) => (
                    <div
                      key={i}
                      className={clsx(
                        'flex items-center gap-3 text-sm transition-colors',
                        s.done ? 'text-gray-800' : 'text-gray-400',
                      )}
                    >
                      {s.done
                        ? <CheckCircle className="w-4 h-4 text-[#138808] shrink-0" />
                        : <div className="w-4 h-4 border border-gray-300 rounded-full shrink-0 animate-pulse" />
                      }
                      {s.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CRS VERIFIED: run AI */}
            {stage === 'crs_verified' && (
              <div className="space-y-4">
                <div className="card">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                    <CheckCircle className="w-5 h-5 text-[#138808]" />
                    <span className="text-sm font-semibold text-gray-800">AI Extraction Complete</span>
                    <span className="ml-auto text-xs text-[#0F4C81] font-mono bg-[#0F4C81]/10 px-2 py-0.5 rounded">
                      Confidence: 99.2%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm mb-5">
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Deceased Name</div>
                      <div className="font-semibold text-gray-800">{crsExtraction?.name}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Date of Death</div>
                      <div className="font-semibold text-gray-800">
                        {crsExtraction?.dod && !isNaN(new Date(crsExtraction.dod).getTime()) 
                          ? format(new Date(crsExtraction.dod), 'dd MMM yyyy') 
                          : format(Date.now(), 'dd MMM yyyy')}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Aadhaar (Masked)</div>
                      <div className="font-semibold text-gray-800 font-mono">{maskAadhaar(crsExtraction?.aadhaarHash)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Linked Land Parcel</div>
                      <div className="font-semibold text-[#0F4C81] font-mono">{crsExtraction?.dlpiId}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs text-gray-500 mb-0.5">CRS Registration No.</div>
                      <div className="font-semibold text-gray-800 font-mono">{crsExtraction?.crsRegistrationNo}</div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-100">
                    <div className="text-sm font-semibold text-gray-700 mb-1">
                      Identify Legal Heirs
                    </div>
                    <div className="text-gray-500 text-xs mb-4">
                      Run CoparcenaryMapper AI rule engine + HSA 2005 enforcement to compute heir shares
                    </div>
                    <button onClick={handleRunAI} className="btn-primary flex items-center gap-2 w-full justify-center">
                      <Cpu className="w-4 h-4" />
                      Run Coparcenary AI
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AI COMPUTING */}
            {stage === 'ai_computing' && (
              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <Cpu className="w-4 h-4 text-[#0F4C81] animate-pulse" />
                  <span className="text-sm font-semibold text-gray-700">CoparcenaryMapper AI</span>
                  <span className="text-xs text-gray-500 ml-1">port 8011</span>
                </div>
                <div className="space-y-2.5">
                  {aiSteps.map((s, i) => (
                    <div
                      key={i}
                      className={clsx(
                        'flex items-center gap-3 text-sm transition-colors',
                        s.done ? 'text-gray-600' : 'text-gray-600',
                      )}
                    >
                      {s.done
                        ? <CheckCircle className="w-4 h-4 text-[#0F4C81] shrink-0" />
                        : <div className="w-4 h-4 border border-gray-300 rounded-full shrink-0 animate-pulse" />
                      }
                      {s.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HEIRS IDENTIFIED / CONSENTS / DONE */}
            {hearsVisible && (
              <>
                {/* HSA 2005 enforcement notice */}
                <div className="flex items-start gap-3 bg-purple-950 border border-purple-800 rounded-xl px-4 py-3">
                  <Shield className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-purple-300 font-semibold text-sm">
                      HSA 2005 S.6(3) — Daughters are coparceners by birth
                    </div>
                    <div className="text-purple-500 text-xs mt-0.5">
                      Neeta Singh's share equals her brothers' — enforced at chaincode level.
                      No revenue officer can override this.
                    </div>
                  </div>
                </div>

                {/* Family tree */}
                <div className="card">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-4 h-4 text-[#0F4C81]" />
                    <span className="text-sm font-semibold text-gray-700">Family Tree</span>
                    <span className="ml-auto text-xs text-gray-500">
                      {caseData?.applicableLaw ?? 'Hindu Succession Act 1956/2005'}
                    </span>
                  </div>
                  <FamilyTree
                    patriarch={patriarch}
                    members={heirs.map((h) => ({
                      memberId:     h.heirId,
                      name:         h.name,
                      relation:     h.relation,
                      gender:       h.gender,
                      dob:          h.dob,
                      isAlive:      h.isAlive,
                      isAdult:      h.isAdult,
                      share:        h.share,
                      shareDecimal: h.shareDecimal,
                      legalNote:    h.legalNote,
                      hasConsented: h.hasConsented,
                      hasObjected:  h.hasObjected,
                    }))}
                    applicableLaw={caseData?.applicableLaw ?? 'Hindu Succession Act 1956/2005'}
                    successionStatus={caseData?.status}
                    caseId={caseData?.caseId}
                    onConsentClick={(m) => {
                      const heir = heirs.find((h) => h.heirId === m.memberId);
                      if (heir && !heir.hasConsented && !heir.hasObjected) {
                        handleConsent(m.memberId);
                      }
                    }}
                  />
                </div>

                {/* Multi-sig consent panel */}
                <MultiSig
                  title="Heir Consent Collection"
                  subtitle="All adult heirs must eSign to forward succession for Tehsildar approval"
                  signers={signers}
                  onSign={handleConsent}
                  onObject={handleObject}
                  completedText="All heirs consented — case forwarded to Tehsildar"
                />

                {/* Tehsildar-approval banner & Execute Action */}
                {(stage === 'pending_tehsildar_approval' || stage === 'all_consented' || (caseData && caseData.status?.includes('TEHSILDAR'))) && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 bg-[#FFFbeb] border border-amber-300 rounded-xl px-5 py-4 shadow-sm">
                      <div className="w-10 h-10 rounded-full bg-[#fde68a] flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <div className="text-amber-800 font-bold text-sm">Pending Tehsildar Final Commitment</div>
                        <div className="text-amber-700 text-xs mt-0.5">
                          CRS Verified · All Heirs Consented · Ready for on-chain mutation & ownership update
                        </div>
                      </div>
                      <CheckCircle className="w-6 h-6 text-amber-600 ml-auto shrink-0" />
                    </div>

                    <div className="bg-gradient-to-r from-slate-900 to-[#0F4C81] text-white rounded-xl p-6 shadow-xl border border-blue-400/30 flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-white/15 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-emerald-500/20 p-2.5 rounded-lg border border-emerald-400/30">
                            <Shield className="w-6 h-6 text-emerald-300" />
                          </div>
                          <div>
                            <h3 className="font-bold text-base">Revenue Officer Final Execution (Tehsildar Commit)</h3>
                            <p className="text-xs text-blue-200">Performs atomic mutation: removes deceased & sets Registered Inheritor as 100% owner</p>
                          </div>
                        </div>
                        <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                          Ready to Commit
                        </span>
                      </div>

                      <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-1">
                        <div className="text-xs text-blue-100 space-y-1">
                          <div>• <span className="font-semibold text-white">Target Property:</span> {caseData?.dlpiId || nomDlpiId || 'DLPI-UP-DAD-00100'}</div>
                          <div>• <span className="font-semibold text-white">Verification Status:</span> Death Certificate OCR Verified + Exact Aadhaar Checked</div>
                        </div>

                        <button
                          type="button"
                          disabled={isExecuting}
                          onClick={() => handleExecuteTehsildar(caseData?.caseId || DEMO_DLPI)}
                          className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition flex items-center gap-2.5 text-sm shrink-0"
                        >
                          <CheckCircle className="w-5 h-5" />
                          {isExecuting ? 'Committing Mutation to Blockchain...' : 'Execute Succession & Auto-Transfer'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Right column: info panel ─────────────────────────────────── */}
          <div className="w-72 shrink-0 space-y-4">

            {/* Scene flow */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-[#0F4C81]" />
                <span className="text-sm font-semibold text-gray-700">Scene 3 flow</span>
              </div>
              <ol className="space-y-2.5 text-xs text-gray-400">
                {[
                  ['CRS oracle',      'Death cert triggers succession'],
                  ['CoparcenaryMapper', 'AI computes shares per HSA 2005'],
                  ['Mutation alert',  'Officer alerted in 64s (SLA: 60s)'],
                  ['Heir notifications', 'SMS + WhatsApp to all 3 heirs'],
                  ['Multi-sig consent', 'Each heir eSigns their share'],
                  ['Auto-mutation',   'Disabled — Tehsildar approval required'],
                ].map(([title, desc], i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#F8FAFC] text-gray-500 flex items-center justify-center shrink-0 font-mono text-xs">
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-gray-600">{title}</div>
                      <div className="text-gray-600">{desc}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Case details */}
            {caseData && (
              <div className="card">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Case Details
                </div>
                <div className="space-y-2">
                  <InfoRow label="Case ID"  value={caseData.caseId.slice(0, 26) + '…'} mono small />
                  <InfoRow label="CRS No."  value={caseData.crsRegistrationNo} mono small />
                  <InfoRow label="Law"      value={caseData.applicableLaw} small />
                  <InfoRow label="AI score" value={`${Math.round(caseData.aiConfidenceScore * 100)}%`} small />
                  <InfoRow
                    label="Consent deadline"
                    value={format(new Date(caseData.consentDeadline), 'dd MMM yyyy')}
                    small
                  />
                </div>
              </div>
            )}

            {/* Legal explanation */}
            <div className="card">
              <div className="flex items-center gap-1.5 mb-2">
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Why daughters = sons
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-2">
                <p>
                  Before 2005, daughters lost coparcenary rights on marriage.
                  The amendment made them{' '}
                  <span className="text-purple-400 font-medium">coparceners by birth</span>
                  {' '}— equal to sons in Mitakshara property.
                </p>
                <p>
                  BhumiChain's Uttaradhikar chaincode{' '}
                  <span className="text-purple-400 font-medium">hard-rejects</span>
                  {' '}any succession where a daughter's share is less than a son's — no officer override.
                </p>
              </div>
            </div>

            {/* Timer hint (only while awaiting) */}
            {stage === 'awaiting_consents' && (
              <div className="flex items-center gap-2 bg-amber-950 border border-amber-800 rounded-xl px-3 py-2.5 text-xs text-amber-300">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                Click each heir's <strong>eSign</strong> button or click a node in the tree to record consent.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const STAGE_ORDER: Stage[] = [
  'idle', 'scanning_crs', 'crs_verified', 'ai_computing',
  'heirs_identified', 'awaiting_consents', 'all_consented', 'pending_tehsildar_approval',
];

function StageBar({ stage }: { stage: Stage }) {
  const idx = STAGE_ORDER.indexOf(stage);
  return (
    <div className="flex items-center gap-1">
      {STAGE_ORDER.map((s, i) => (
        <div
          key={s}
          className={clsx('h-1.5 rounded-full transition-all', {
            'w-6 bg-brand-500':               i < idx,
            'w-6 bg-amber-500 animate-pulse': i === idx,
            'w-4 bg-gray-700':                i > idx,
          })}
        />
      ))}
    </div>
  );
}

function Banner({
  icon, title, subtitle, color,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  color: 'brand' | 'amber' | 'red';
}) {
  const colors = {
    brand: 'bg-[#EFF6FF] border-blue-300 text-[#0F4C81] text-[#0F4C81]',
    amber: 'bg-amber-950 border-amber-700 text-amber-300 text-amber-500',
    red:   'bg-red-950 border-red-700 text-red-300 text-red-500',
  }[color].split(' ');

  return (
    <div className={clsx('flex items-center gap-3 border rounded-xl px-4 py-3', colors[0], colors[1])}>
      {icon}
      <div>
        <div className={clsx('font-semibold text-sm', colors[2])}>{title}</div>
        {subtitle && <div className={clsx('text-xs mt-0.5', colors[3])}>{subtitle}</div>}
      </div>
    </div>
  );
}

function InfoRow({
  label, value, mono, small,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className={clsx('text-gray-500 shrink-0', small ? 'text-xs' : 'text-sm')}>{label}</span>
      <span className={clsx('text-gray-700 text-right break-all', small ? 'text-xs' : 'text-sm', mono && 'font-mono')}>
        {value}
      </span>
    </div>
  );
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
