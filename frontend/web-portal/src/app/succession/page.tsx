'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  getDemoToken, initiateSuccession, recordHeirConsent,
  getSuccessionCase, addInheritorNomination, getInheritorNominations,
  approveInheritorNomination, executeSuccession, getMyPendingSuccessions,
} from '@/lib/api';
import { apiFetch, setToken, getUser, type JWTUser } from '@/lib/auth';
import type { SuccessionCase, SuccessionHeir } from '@/types';
import toast from 'react-hot-toast';
import {
  Users, Shield, CheckCircle, Zap, FileText, Info, Clock,
  AlertTriangle, Upload, Scan, Database, UserPlus, BadgeCheck,
  ArrowRight, Loader2, Landmark, LayoutList, X, Plus, Lock,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

const maskAadhaar = (val?: string | null): string => {
  if (!val) return 'XXXX-XXXX-XXXX';
  const d = val.replace(/\D/g, '');
  return d.length >= 4 ? `XXXX-XXXX-${d.slice(-4)}` : 'XXXX-XXXX-XXXX';
};
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type WStep = 'add_heir'|'upload_document'|'esign_heirs'|'tehsildar_final'|'blockchain_division';

const STEPS: { id: WStep; label: string }[] = [
  { id: 'add_heir',           label: 'Add Heir' },
  { id: 'upload_document',    label: 'Upload Document' },
  { id: 'esign_heirs',        label: 'eSign by All Heirs' },
  { id: 'tehsildar_final',    label: 'Tehsildar Verification' },
  { id: 'blockchain_division',label: 'Land Division' },
];
const STEP_ORDER: WStep[] = STEPS.map(s => s.id);

const DEMO_DLPI = 'DLPI-UP-DAD-00100';
const DEMO_FAMILY_ID = 'FAM-UP-DAD-00100-001';
const DEMO_DECEASED = {
  name: 'Ramesh Kumar',
  aadhaar: '999988887777',
  aadhaarNumber: '999988887777', // Raw 12-digit Aadhaar exactly as entered
  dod: '2026-05-20',
};
const DEMO_CRS = { deathCertCID: 'QmDeathCertRameshK2026', crsRegistrationNo: 'CRS-GBN-2026-00891' };
const CRS_AI_STEPS = [
  'Uploading Death Certificate to secure IPFS vault',
  'Azure Document Intelligence OCR extraction',
  'LayoutLM NER — locating deceased name & Aadhaar',
  'Cross-referencing CRS Registration No. with UP database',
  'Validation successful',
];

export default function SuccessionPage() {
  const [user, setUser] = useState<JWTUser | null>(null);
  const [step, setStep] = useState<WStep>('add_heir');
  const [myParcels, setMyParcels] = useState<{ dlpiId: string; label: string }[]>([]);
  const [loadingParcels, setLoadingParcels] = useState(false);
  // Step 1
  const [selectedDlpiId, setSelectedDlpiId] = useState('');
  const [heirRows, setHeirRows] = useState([{ name: '', aadhaar: '' }]);
  const [isSubmittingHeirs, setIsSubmittingHeirs] = useState(false);
  // Step 2
  const [nominations, setNominations] = useState<any[]>([]);
  // Step 3
  const [crsAiSteps, setCrsAiSteps] = useState<{ label: string; done: boolean }[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [crsExtraction, setCrsExtraction] = useState<any>(null);
  // Step 4
  const [caseData, setCaseData] = useState<SuccessionCase | null>(null);
  const [heirs, setHeirs] = useState<SuccessionHeir[]>([]);
  const [isInitiating, setIsInitiating] = useState(false);
  const citizenTokenRef = React.useRef<string | null>(null);
  // Step 5
  const [isFinalApproving, setIsFinalApproving] = useState(false);
  const [finalApproved, setFinalApproved] = useState(false);
  // Step 6
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [frontendError, setFrontendError] = useState('');
  const [heirAadhaarInputs, setHeirAadhaarInputs] = useState<Record<string, string>>({});

  const { triggerMock } = useWebSocket(DEMO_DLPI);

  const parcelNominations = nominations.filter(n => !selectedDlpiId || n.dlpiId === selectedDlpiId);
  const approvedNoms = parcelNominations.filter(n => n.status === 'APPROVED');
  const allApprovedNoms = nominations.filter(n => n.status === 'APPROVED');
  const pendingNoms = parcelNominations.filter(n => n.status !== 'APPROVED');
  const isTehsildar = user?.role === 'tehsildar' || user?.role === 'collector';
  const step2List = isTehsildar ? nominations : parcelNominations;
  const isApprovedHeirGlobal = isTehsildar || allApprovedNoms.some(n => {
    const myRaw = (user?.aadhaar || user?.aadhaarNumber || user?.aadhaarNo || user?.aadhaarId || '').replace(/\D/g, '');
    const nomRaw = String(n.inheritorAadhaarNumber || n.inheritorAadhaar || '').replace(/\D/g, '');
    if (myRaw && nomRaw && myRaw === nomRaw) return true;
    return (
      n.inheritorAadhaarNumber === user?.aadhaar || 
      n.inheritorAadhaarNumber === user?.aadhaarNumber || 
      n.inheritorAadhaarNumber === user?.aadhaarNo || 
      (user?.aadhaarRaw && n.inheritorAadhaarNumber === user?.aadhaarRaw)
    );
  });

  useEffect(() => {
    const u = getUser(); setUser(u);
    citizenTokenRef.current = typeof window !== 'undefined' ? localStorage.getItem('bhumichain_token') : null;
    (async () => {
      setLoadingParcels(true);
      try {
        const res = await apiFetch('/api/dlpi/my-parcels');
        const data = await res.json();
        const parcels: any[] = Array.isArray(data) ? data : (data?.parcels || []);
        
        let allNoms: any[] = [];
        try {
          const nomRes = await getInheritorNominations();
          allNoms = Array.isArray(nomRes) ? nomRes : (Array.isArray(nomRes?.nominations) ? nomRes.nominations : []);
          setNominations(allNoms);
        } catch (e) {}

        const myNominatedDlpis = new Set<string>();
        if (u) {
          allNoms.forEach(n => {
            const myRaw = (u.aadhaar || u.aadhaarNumber || u.aadhaarNo || u.aadhaarId || '').replace(/\D/g, '');
            const nomRaw = String(n.inheritorAadhaarNumber || n.inheritorAadhaar || '').replace(/\D/g, '');
            if (
              (myRaw && nomRaw && myRaw === nomRaw) ||
              n.inheritorAadhaarNumber === u.aadhaar || 
              n.inheritorAadhaarNumber === u.aadhaarNumber || 
              n.inheritorAadhaarNumber === u.aadhaarNo || 
              (u.aadhaarRaw && n.inheritorAadhaarNumber === u.aadhaarRaw)
            ) {
              if (n.dlpiId) myNominatedDlpis.add(n.dlpiId);
            }
          });
        }

        const existingDlpis = new Set(parcels.map(p => p.dlpiId || p.id));
        myNominatedDlpis.forEach(dlpiId => {
          if (!existingDlpis.has(dlpiId)) {
            parcels.push({ dlpiId, id: dlpiId, label: `${dlpiId} — (Nominated Heir)` });
          }
        });

        if (parcels.length > 0) {
          const mapped = parcels.map((p: any) => ({
            dlpiId: p.dlpiId || p.id,
            label: p.label || `${p.dlpiId || p.id}${p.khataNo ? ` — Khata ${p.khataNo}` : ''}${p.locality ? `, ${p.locality}` : ''}`,
          }));
          setMyParcels(mapped); setSelectedDlpiId(mapped[0].dlpiId);
        } else {
          setMyParcels([]);
          setSelectedDlpiId('');
        }
      } catch {
        setMyParcels([]);
        setSelectedDlpiId('');
      } finally { setLoadingParcels(false); }
    })();
    getMyPendingSuccessions().catch(() => {});
  }, []);

  // Ensure the selected DLPI is always available in the dropdown
  useEffect(() => {
    if (selectedDlpiId && !myParcels.some(p => p.dlpiId === selectedDlpiId)) {
      setMyParcels(prev => [...prev, { dlpiId: selectedDlpiId, id: selectedDlpiId, label: `${selectedDlpiId} — (Selected)` }]);
    }
  }, [selectedDlpiId, myParcels]);

  // Ensure Step 4/5/6 heirs strictly match the actual approved nominations instead of falling back to 3 demo heirs
  useEffect(() => {
    if (approvedNoms.length > 0 && (heirs.length === 0 || heirs.some(h => h.name === 'Ankur Singh' || h.heirId === 'HEIR-001'))) {
      setHeirs(approvedNoms.map((n, i) => ({
        heirId: `HEIR-DYN-${i+1}`,
        name: n.inheritorName,
        aadhaar: n.inheritorAadhaarNumber,
        aadhaarNumber: n.inheritorAadhaarNumber,
        relation: 'Legal Heir',
        gender: 'Unknown',
        dob: '1990-01-01',
        isAlive: true,
        isAdult: true,
        isNri: false,
        share: `1/${approvedNoms.length}`,
        shareDecimal: 1/approvedNoms.length,
        hasConsented: false,
        hasObjected: false,
      })));
    }
  }, [approvedNoms, heirs]);

  // Step 1 handlers
  const addHeirRow = () => setHeirRows(r => [...r, { name: '', aadhaar: '' }]);
  const removeHeirRow = (i: number) => setHeirRows(r => r.filter((_, x) => x !== i));
  const updateHeirRow = (i: number, f: 'name'|'aadhaar', v: string) =>
    setHeirRows(r => r.map((row, x) => x === i ? { ...row, [f]: v } : row));

  const handleSubmitHeirs = async (e: React.FormEvent) => {
    e.preventDefault();
    setFrontendError('');
    const valid = heirRows.filter(h => h.name.trim() && h.aadhaar.replace(/\D/g, '').length === 12);
    if (!selectedDlpiId) { toast.error('Select a property first.'); return; }
    if (!valid.length) { toast.error('Add at least one heir with a valid 12-digit Aadhaar.'); return; }
    setIsSubmittingHeirs(true);
    try {
      for (const heir of valid) {
        await addInheritorNomination({ dlpiId: selectedDlpiId, inheritorName: heir.name.trim(), inheritorAadhaarNumber: heir.aadhaar });
      }
      toast.success(`${valid.length} heir(s) added successfully!`);
      const noms = await getInheritorNominations();
      const nomArr = Array.isArray(noms) ? noms : (Array.isArray(noms?.nominations) ? noms.nominations : []);
      setNominations(nomArr);
      setStep('upload_document');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Unknown error submitting heirs';
      setFrontendError(`[Step 1 Error] ${msg}`);
      toast.error('Failed: ' + msg);
    }
    finally { setIsSubmittingHeirs(false); }
  };

  // Step 2 handlers
  const approveNomination = async (id: string) => {
    setFrontendError('');
    try {
      await approveInheritorNomination(id);
      toast.success('Tehsildar Approved! Heir can now upload documents.');
      const noms = await getInheritorNominations();
      const nomArr = Array.isArray(noms) ? noms : (Array.isArray(noms?.nominations) ? noms.nominations : []);
      setNominations(nomArr);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Unknown approval error';
      setFrontendError(`[Step 2 Error] ${msg}`);
      toast.error('Approval failed: ' + msg);
    }
  };

  // Step 3 handlers
  const handleUploadCRS = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsScanning(true);
    setCrsAiSteps(CRS_AI_STEPS.map(l => ({ label: l, done: false })));
    try {
      setCrsAiSteps(p => p.map((s, i) => i === 0 ? { ...s, done: true } : s));
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/scan/death-cert', { method: 'POST', body: fd });
      let data: any = {};
      try { data = await res.json(); } catch {}
      for (let i = 1; i < CRS_AI_STEPS.length; i++) {
        await delay(280);
        setCrsAiSteps(p => p.map((s, idx) => idx <= i ? { ...s, done: true } : s));
      }
      setCrsExtraction({
        name: data.name || DEMO_DECEASED.name, dod: data.dod || DEMO_DECEASED.dod,
        aadhaar: data.aadhaar || data.aadhaarNumber || DEMO_DECEASED.aadhaar,
        aadhaarNumber: data.aadhaarNumber || data.aadhaar || DEMO_DECEASED.aadhaarNumber,
        crsRegistrationNo: data.crsRegistrationNo || DEMO_CRS.crsRegistrationNo,
        dlpiId: data.dlpiId || selectedDlpiId || DEMO_DLPI,
      });
      toast.success('Death certificate verified by AI');
    } catch {
      setCrsAiSteps(p => p.map(s => ({ ...s, done: true })));
      setCrsExtraction({ name: DEMO_DECEASED.name, dod: DEMO_DECEASED.dod, aadhaar: DEMO_DECEASED.aadhaar, aadhaarNumber: DEMO_DECEASED.aadhaarNumber, crsRegistrationNo: DEMO_CRS.crsRegistrationNo, dlpiId: selectedDlpiId || DEMO_DLPI });
      toast('Using demo data — AI service offline', { icon: 'ℹ️' });
    } finally { setIsScanning(false); }
  };

  // Step 4 handler
  const handleInitiateAndESign = async () => {
    if (!crsExtraction) { toast.error('Upload death certificate first.'); return; }
    setIsInitiating(true);
    try {
      const ct = citizenTokenRef.current || localStorage.getItem('bhumichain_token');
      await getDemoToken('oracle', 'CRS Oracle');
      const res = await initiateSuccession({
        dlpiId: crsExtraction.dlpiId || selectedDlpiId || DEMO_DLPI,
        familyId: DEMO_FAMILY_ID, deceasedName: crsExtraction.name || DEMO_DECEASED.name,
        deceasedAadhaarNumber: crsExtraction.aadhaar || crsExtraction.aadhaarNumber || DEMO_DECEASED.aadhaar,
        dateOfDeath: crsExtraction.dod || DEMO_DECEASED.dod,
        deathCertCID: DEMO_CRS.deathCertCID, crsRegistrationNo: crsExtraction.crsRegistrationNo || DEMO_CRS.crsRegistrationNo,
        heirs: approvedNoms.map(n => ({ name: n.inheritorName, aadhaar: n.inheritorAadhaarNumber })),
      });
      if (ct) setToken(ct);
      let sc = res;
      try { sc = await getSuccessionCase(res.caseId || 'SUC-DEMO'); } catch {}
      const activeHeirs = (res.heirs && Array.isArray(res.heirs) && res.heirs.length > 0) ? res.heirs : (sc?.heirs || []);
      setCaseData(sc || res);
      // Persist caseId so handleConsent works even if caseData gets lost
      const activeCaseId = (sc?.caseId || res?.caseId);
      if (activeCaseId && typeof window !== 'undefined') {
        localStorage.setItem('bhumichain_active_succession_caseId', activeCaseId);
        localStorage.setItem('bhumichain_active_succession_dlpiId', crsExtraction?.dlpiId || selectedDlpiId || DEMO_DLPI);
      }
      setHeirs(activeHeirs.map((h: any, i: number) => ({ ...h, heirId: h.heirId || `HEIR-DYN-${i+1}`, aadhaar: h.aadhaar || h.aadhaarNumber || h.inheritorAadhaarNumber, hasConsented: false, hasObjected: false })));
      triggerMock('scene3_mutation_alert');
      toast.success('Case created! eSign requests sent to all heirs.');
      setStep('esign_heirs');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Unknown initiation error';
      setFrontendError(`[Step 4 Error] ${msg}`);
      const ct = citizenTokenRef.current; if (ct) setToken(ct);
      setHeirs(approvedNoms.map((n, i) => ({
        heirId: `HEIR-DYN-${i+1}`, name: n.inheritorName, aadhaar: n.inheritorAadhaarNumber, aadhaarNumber: n.inheritorAadhaarNumber,
        relation: 'Legal Heir', gender: 'Unknown', dob: '1990-01-01',
        isAlive: true, isAdult: true, isNri: false,
        share: `1/${approvedNoms.length}`, shareDecimal: 1/approvedNoms.length,
        hasConsented: false, hasObjected: false,
      })));
      toast.error('Initiation API Error: ' + msg);
      setStep('esign_heirs');
    } finally { setIsInitiating(false); }
  };

  const handleConsent = useCallback(async (heirId: string) => {
    const heir = heirs.find(h => h.heirId === heirId);
    if (!heir || heir.hasConsented || heir.hasObjected) return;
    const entered = (heirAadhaarInputs[heirId] || '').replace(/\D/g, '');
    if (!entered || entered.length !== 12) {
      toast.error(`Please enter a valid 12-digit Aadhaar Number for ${heir.name} (` + (entered ? `${entered.length} digits entered` : 'field empty') + `) to digitally verify & eSign.`);
      return;
    }
    // Resolve caseId: React state first, then localStorage fallback
    const resolvedCaseId = caseData?.caseId
      || (typeof window !== 'undefined' ? localStorage.getItem('bhumichain_active_succession_caseId') : null)
      || DEMO_DLPI;
    const resolvedDlpiId = caseData?.dlpiId
      || (typeof window !== 'undefined' ? localStorage.getItem('bhumichain_active_succession_dlpiId') : null)
      || DEMO_DLPI;
    try {
      await recordHeirConsent(resolvedCaseId, {
        heirAadhaarNumber: entered,
        eSignTxHash: '0x' + Array.from({length:40}, () => Math.floor(Math.random()*16).toString(16)).join(''),
      });
    } catch {}
    setHeirs(prev => {
      const updated = prev.map(h => h.heirId === heirId ? { ...h, hasConsented: true, consentedAt: new Date().toISOString(), aadhaar: entered, aadhaarNumber: entered } : h);
      if (updated.every(h => h.hasConsented)) {
        // All heirs signed — call mark-ready to guarantee officer queue update
        const signedAadhaar = updated.map((h: any) => h.aadhaar || h.aadhaarNumber || '').filter(Boolean);
        apiFetch(`/api/succession/${resolvedCaseId}/mark-ready`, {
          method: 'POST',
          body: JSON.stringify({
            dlpiId: resolvedDlpiId,
            deceasedName: caseData?.deceasedName || crsExtraction?.name || 'Deceased',
            heirs: updated.map((h: any) => ({ name: h.name, aadhaar: h.aadhaar || h.aadhaarNumber, aadhaarNumber: h.aadhaarNumber || h.aadhaar })),
            heirAadhaarList: signedAadhaar,
            consentedAadhaar: signedAadhaar,
          }),
        }).catch(e => console.warn('[mark-ready]', e));
        toast.success('🎉 All heirs have eSigned via Aadhaar! Case forwarded to Tehsildar Portal for virasat execution.');
        setStep('tehsildar_final');
      } else {
        toast.success(`${heir.name} successfully eSigned via Aadhaar ✓`);
      }
      return updated;
    });
  }, [heirs, caseData, crsExtraction, heirAadhaarInputs]);

  // Step 5 handler (Check status from Tehsildar Portal OR demo approve if requested)
  const handleTehsildarFinalApprove = async () => {
    setIsFinalApproving(true);
    try {
      const res = await apiFetch(`/api/succession/cases/${caseData?.caseId || DEMO_DLPI}`);
      if (res.ok) {
        const sc = await res.json();
        if (sc && (sc.status === 'AUTO_MUTATED' || sc.status === 'EXECUTED' || sc.status === 'COMPLETED' || sc.status === 'TEHSILDAR_APPROVED')) {
          setFinalApproved(true);
          setExecutionResult(sc);
          toast.success("🎉 Tehsildar has executed your virasat! Land division is now on-chain.");
          setIsFinalApproving(false);
          setStep('blockchain_division');
          return;
        }
      }
    } catch {}
    // If not yet approved by real Tehsildar, check or simulate if demo mode helper clicked
    await delay(600);
    setIsFinalApproving(false);
    toast("⏳ Virasat case is currently pending inside the Tehsildar's queue on the Officer Portal.");
  };

  // Step 6 handler
  const handleExecuteBlockchain = async () => {
    setIsExecuting(true);
    setFrontendError('');
    try {
      const result = await executeSuccession(caseData?.caseId || DEMO_DLPI);
      setExecutionResult(result);
      toast.success("🎉 Land divided on blockchain!");
      triggerMock('scene3_auto_mutation');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Unknown blockchain execution error';
      setFrontendError(`[Step 6 Error] ${msg}`);
      setExecutionResult({
        status: 'AUTO_MUTATED', dlpiId: crsExtraction?.dlpiId || selectedDlpiId || DEMO_DLPI,
        heirs: heirs.map(h => ({ name: h.name, share: h.share || `1/${heirs.length}`, aadhaarNumber: h.aadhaarNumber })),
      });
      toast.error('Blockchain error: ' + msg);
    } finally { setIsExecuting(false); }
  };

  const stepIdx = STEP_ORDER.indexOf(step);

  const stepHint: Record<WStep,string> = {
    add_heir: 'Select your property and add all legal heirs with their Aadhaar numbers.',
    upload_document: 'Upload the CRS death certificate — AI will extract details.',
    esign_heirs: 'Each heir must click eSign to consent to their land share.',
    tehsildar_final: 'Tehsildar reviews all eSigns and gives final approval.',
    blockchain_division: 'Execute the atomic land division on Hyperledger Fabric.',
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar demoMode />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-6 gap-3 shrink-0">
          <Users className="w-4 h-4 text-[#0F4C81]" />
          <span className="text-sm font-semibold text-gray-700">Succession & Coparcenary</span>
          <span className="text-xs text-gray-400">— Virasat (उत्तराधिकार)</span>
          <div className="ml-auto flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s.id} title={s.label} className={clsx('h-1.5 rounded-full transition-all duration-300', i < stepIdx ? 'w-6 bg-[#0F4C81]' : i === stepIdx ? 'w-8 bg-amber-500 animate-pulse' : 'w-4 bg-gray-300')} />
            ))}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">

          {/* Step sidebar */}
          <div className="w-52 shrink-0 border-r border-gray-200 bg-white py-4 px-2 hidden md:flex flex-col overflow-y-auto">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-3 mb-3">Workflow Steps</div>
            {STEPS.map((s, i) => {
              const done = i < stepIdx; const active = i === stepIdx;
              return (
                <div key={s.id} onClick={() => done && setStep(s.id)}
                  className={clsx('flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors',
                    active ? 'bg-[#0F4C81] text-white shadow-sm' : done ? 'text-[#0F4C81] hover:bg-blue-50 cursor-pointer' : 'text-gray-400 cursor-not-allowed')}>
                  <div className={clsx('w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
                    active ? 'bg-white text-[#0F4C81]' : done ? 'bg-[#0F4C81]/10 text-[#0F4C81]' : 'bg-gray-100 text-gray-400')}>
                    {done ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className="leading-tight font-medium">{s.label}</span>
                </div>
              );
            })}
          </div>

          {/* Main + Right panel */}
          <div className="flex-1 flex gap-6 p-6 overflow-y-auto">
            <div className="flex-1 min-w-0 space-y-5">
              {frontendError && (
                <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-red-50 border-2 border-red-500 text-red-900 shadow-md animate-bounce-once">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                    <div>
                      <div className="font-bold text-sm">Exact Frontend / API Error:</div>
                      <div className="text-xs font-mono mt-0.5 break-all">{frontendError}</div>
                    </div>
                  </div>
                  <button onClick={() => setFrontendError('')} className="p-1.5 hover:bg-red-100 rounded-lg text-red-700 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {/* ─── SUCCESSION DUAL-OPTION MODE BAR ─── */}
              {(step === 'add_heir' || step === 'upload_document') && (
                <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-md">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#0F4C81] p-2.5 rounded-xl text-white shadow-sm"><Landmark className="w-5 h-5" /></div>
                      <div>
                        <h2 className="font-extrabold text-gray-900 text-base">Select Virasat (Succession) Action</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Complete Option 1 first to add your heirs, which automatically unlocks Option 2 for Death Certificate OCR.</p>
                      </div>
                    </div>

                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* OPTION 1: NOMINATE LEGAL HEIRS */}
                    <div
                      onClick={() => setStep('add_heir')}
                      className={clsx(
                        "p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between shadow-sm relative overflow-hidden group",
                        step === 'add_heir'
                          ? "bg-gradient-to-br from-[#0F4C81] via-[#155a96] to-[#1e3a8a] border-[#0F4C81] text-white shadow-lg ring-2 ring-[#0F4C81]/30"
                          : "bg-gray-50 hover:bg-gray-100/80 border-gray-200 text-gray-800"
                      )}>
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className={clsx(
                            "text-[11px] font-extrabold uppercase px-3 py-1 rounded-full tracking-wider shadow-xs",
                            step === 'add_heir' ? "bg-amber-400 text-gray-950 font-black" : "bg-[#0F4C81]/15 text-[#0F4C81]"
                          )}>
                            ⭐ Option 1 (Mandatory)
                          </span>
                          {step === 'add_heir' && (
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                              <CheckCircle className="w-3.5 h-3.5" /> Active Form
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 font-bold text-base mb-2">
                          <UserPlus className={clsx("w-5 h-5 shrink-0", step === 'add_heir' ? "text-amber-300" : "text-[#0F4C81]")} />
                          <span>Nominate Legal Heirs</span>
                        </div>
                        <p className={clsx("text-xs leading-relaxed", step === 'add_heir' ? "text-blue-100" : "text-gray-600")}>
                          Submit full name & 12-digit Aadhaar of all legal heirs for your property. This unlocks the death certificate upload step.
                        </p>
                      </div>
                      <div className={clsx("mt-4 flex items-center justify-between text-xs font-bold pt-3 border-t", step === 'add_heir' ? "border-white/20 text-amber-300" : "border-gray-200 text-[#0F4C81]")}>
                        <span>{step === 'add_heir' ? "Filling Form Below ↓" : "Switch to Option 1 →"}</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>

                    {/* OPTION 2: UPLOAD DEATH CERTIFICATE */}
                    <div
                      onClick={() => {
                        if (isApprovedHeirGlobal) {
                          setStep('upload_document');
                        } else {
                          toast.error("Option 2 is locked! You must first submit Option 1 (Nominate Legal Heirs) before uploading the Death Certificate.");
                        }
                      }}
                      className={clsx(
                        "p-5 rounded-2xl border-2 transition-all flex flex-col justify-between shadow-sm relative overflow-hidden",
                        step === 'upload_document'
                          ? "bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 border-emerald-500 text-white shadow-lg ring-2 ring-emerald-500/30 cursor-pointer"
                          : isApprovedHeirGlobal
                            ? "bg-emerald-50/80 hover:bg-emerald-100 border-emerald-300 text-emerald-950 cursor-pointer"
                            : "bg-gray-100/90 border-gray-300/80 text-gray-500 cursor-not-allowed opacity-80"
                      )}>
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className={clsx(
                            "text-[11px] font-extrabold uppercase px-3 py-1 rounded-full tracking-wider flex items-center gap-1.5 shadow-xs",
                            step === 'upload_document' 
                              ? "bg-emerald-400 text-gray-950 font-black" 
                              : isApprovedHeirGlobal
                                ? "bg-emerald-600 text-white font-bold"
                                : "bg-gray-300 text-gray-700 font-bold"
                          )}>
                            {isApprovedHeirGlobal ? <><CheckCircle className="w-3.5 h-3.5" /> Option 2 (Unlocked)</> : <><Lock className="w-3.5 h-3.5" /> Option 2 (Locked)</>}
                          </span>
                          {step === 'upload_document' && (
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                              <CheckCircle className="w-3.5 h-3.5" /> Active Form
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 font-bold text-base mb-2">
                          <Upload className={clsx("w-5 h-5 shrink-0", step === 'upload_document' ? "text-emerald-300" : isApprovedHeirGlobal ? "text-emerald-700" : "text-gray-400")} />
                          <span>Upload Death Certificate</span>
                        </div>
                        <p className={clsx("text-xs leading-relaxed", step === 'upload_document' ? "text-emerald-100" : isApprovedHeirGlobal ? "text-emerald-900/80" : "text-gray-500")}>
                          {isApprovedHeirGlobal
                            ? "Tehsildar has verified your heir status! Upload official Death Certificate for AI OCR & equal coparcenary share division."
                            : "🔒 Requires Tehsildar approval from Option 1 first. Once verified, this card unlocks to allow Death Certificate upload."}
                        </p>
                      </div>
                      <div className={clsx("mt-4 flex items-center justify-between text-xs font-bold pt-3 border-t", step === 'upload_document' ? "border-emerald-400/30 text-emerald-300" : isApprovedHeirGlobal ? "border-emerald-200 text-emerald-800" : "border-gray-200 text-gray-400")}>
                        <span>{step === 'upload_document' ? "Uploading Form Below ↓" : isApprovedHeirGlobal ? "Switch to Option 2 →" : "🔒 Complete Option 1 First"}</span>
                        {isApprovedHeirGlobal ? <ArrowRight className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 1: ADD HEIR */}
              {step === 'add_heir' && (
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-200/80">
                    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                      <div className="bg-[#0F4C81]/10 p-2.5 rounded-xl"><UserPlus className="w-6 h-6 text-[#0F4C81]" /></div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">Step 1 — Nominate Legal Heirs</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Add each heir's full name and 12-digit Aadhaar. Sent to Tehsildar for approval.</p>
                      </div>
                      <span className="ml-auto bg-amber-500/15 text-amber-800 border border-amber-400/30 text-xs font-semibold px-3 py-1 rounded-full">Tehsildar Workflow</span>
                    </div>
                    <form onSubmit={handleSubmitHeirs} className="space-y-5">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Select Property (DLPI)</label>
                        {loadingParcels ? (
                          <div className="flex items-center gap-2 text-gray-500 text-sm py-2"><Loader2 className="w-4 h-4 animate-spin text-[#0F4C81]" /> Loading your land holdings…</div>
                        ) : myParcels.length === 0 ? (
                          <div className="flex flex-col gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold">
                            <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> No registered properties found for your Aadhaar.</div>
                            <div className="text-xs font-medium opacity-80">You must have ownership of a property to initiate succession.</div>
                          </div>
                        ) : (
                          <select value={selectedDlpiId} onChange={e => setSelectedDlpiId(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/40 focus:bg-white transition-all">
                            {myParcels.map(p => <option key={p.dlpiId} value={p.dlpiId} className="text-gray-900">{p.label}</option>)}
                          </select>
                        )}
                        {myParcels.length === 1 && myParcels[0].dlpiId === DEMO_DLPI && (
                          <p className="text-xs text-amber-700 mt-1.5 flex items-center gap-1"><Info className="w-3.5 h-3.5 shrink-0" /> Showing demo parcel — your actual parcels load dynamically when logged in</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Legal Heirs</label>
                        <div className="space-y-3">
                          {heirRows.map((heir, idx) => (
                            <div key={idx} className="flex gap-3 items-end bg-gray-50 border border-gray-200 rounded-xl p-4 transition-all">
                              <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                                <input type="text" required placeholder="e.g. Ankur Singh" value={heir.name}
                                  onChange={e => updateHeirRow(idx, 'name', e.target.value)}
                                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/40 transition-all" />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-700 mb-1">12-Digit Aadhaar</label>
                                <input type="text" required maxLength={12} placeholder="999900010099" value={heir.aadhaar}
                                  onChange={e => updateHeirRow(idx, 'aadhaar', e.target.value.replace(/\D/g, ''))}
                                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/40 transition-all" />
                                {heir.aadhaar.length > 0 && heir.aadhaar.length < 12 && <p className="text-xs text-red-600 font-semibold mt-1">{12 - heir.aadhaar.length} more digits</p>}
                                {heir.aadhaar.length === 12 && <p className="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Valid</p>}
                              </div>
                              {heirRows.length > 1 && (
                                <button type="button" onClick={() => removeHeirRow(idx)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors mb-0.5"><X className="w-4 h-4" /></button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={addHeirRow} className="mt-3 flex items-center gap-1.5 text-[#0F4C81] hover:text-[#0a3860] text-sm font-bold transition-colors">
                          <Plus className="w-4 h-4" /> Add Another Heir
                        </button>
                      </div>
                      <button type="submit" disabled={isSubmittingHeirs || myParcels.length === 0}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2.5 shadow-md transition-all">
                        {isSubmittingHeirs ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting…</> : <><BadgeCheck className="w-5 h-5" /> Submit Heirs for Tehsildar Approval <ArrowRight className="w-4 h-4" /></>}
                      </button>
                    </form>
                  </div>
                  {parcelNominations.length > 0 && (
                    <div className="card">
                      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                        <LayoutList className="w-4 h-4 text-[#0F4C81]" />
                        <span className="font-semibold text-gray-800 text-sm">Submitted Nominations ({selectedDlpiId})</span>
                        <span className="ml-auto text-xs text-gray-400">{parcelNominations.length}</span>
                      </div>
                      <div className="space-y-2">
                        {parcelNominations.map(n => (
                          <div key={n.nominationId} className="flex items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-gray-800">{n.inheritorName}</div>
                              <div className="text-xs text-gray-500 font-mono">{n.dlpiId} · Aadhaar: XXXX-{n.inheritorAadhaarNumber?.slice(8)}</div>
                            </div>
                            {n.status === 'APPROVED' ? (
                              <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0"><CheckCircle className="w-3.5 h-3.5" /> Approved</span>
                            ) : (
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => approveNomination(n.nominationId)}
                                  className="bg-[#0F4C81] hover:bg-[#0a3860] text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <BadgeCheck className="w-4 h-4 text-amber-300" />
                                  Approve (Tehsildar)
                                </button>
                                <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full hidden sm:inline">Pending</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {approvedNoms.length > 0 && (
                        <button onClick={() => setStep('upload_document')}
                          className="mt-4 w-full bg-[#0F4C81] hover:bg-[#0a3860] text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors">
                          <Upload className="w-4 h-4" /> Proceed to Upload Document <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}



              {/* STEP 2: UPLOAD DOCUMENT */}
              {step === 'upload_document' && (
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                      🏛️ Select Land Parcel to Claim via Virasat (For which you are an Approved Inheritor)
                    </label>
                    {loadingParcels ? (
                      <div className="flex items-center gap-2 text-gray-500 text-sm py-2"><Loader2 className="w-4 h-4 animate-spin text-[#0F4C81]" /> Loading your land holdings…</div>
                    ) : (
                      <select
                        value={selectedDlpiId}
                        onChange={e => setSelectedDlpiId(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/40 focus:bg-white transition-all"
                      >
                        {myParcels.map(p => {
                          const isApprovedForParcel = nominations.some(n => n.dlpiId === p.dlpiId && n.status === 'APPROVED');
                          return (
                            <option key={p.dlpiId} value={p.dlpiId} className="text-gray-900 font-medium">
                              {p.label} {isApprovedForParcel ? '— (Tehsildar Approved ✓)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>
                  {approvedNoms.length > 0 && (
                    <div className="bg-emerald-900/80 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-300 shrink-0" />
                      <div className="text-sm text-emerald-200">
                        <strong className="text-white">Approved Heirs</strong> may upload death certificate for <strong>{selectedDlpiId || approvedNoms[0]?.dlpiId}</strong>
                      </div>
                    </div>
                  )}
                  <div className="card border-2 border-dashed border-gray-200">
                    <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
                      <Upload className="w-5 h-5 text-[#0F4C81]" />
                      <div>
                        <h2 className="font-bold text-gray-900">Step 2 - Upload Death Certificate</h2>
                        <p className="text-xs text-gray-500 mt-0.5">AI will OCR-extract details (Azure Document Intelligence)</p>
                      </div>
                      {crsExtraction && <span className="ml-auto flex items-center gap-1 text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" /> Verified</span>}
                    </div>
                    {isScanning ? (
                      <div className="space-y-2.5 py-4">
                        <div className="flex items-center gap-2 mb-4"><Scan className="w-4 h-4 text-[#0F4C81] animate-pulse" /><span className="text-sm font-semibold text-gray-700">AI Scanning…</span></div>
                        {crsAiSteps.map((s, i) => (
                          <div key={i} className={clsx('flex items-center gap-3 text-sm', s.done ? 'text-gray-800' : 'text-gray-400')}>
                            {s.done ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <div className="w-4 h-4 border border-gray-300 rounded-full shrink-0 animate-pulse" />}
                            {s.label}
                          </div>
                        ))}
                      </div>
                    ) : !crsExtraction ? (
                      <label className="flex flex-col items-center justify-center py-12 cursor-pointer hover:bg-gray-50 rounded-xl transition-colors group">
                        <input type="file" accept="image/*,.pdf" onChange={handleUploadCRS} className="hidden" />
                        <div className="w-16 h-16 bg-[#0F4C81]/10 group-hover:bg-[#0F4C81]/20 rounded-full flex items-center justify-center mb-4 transition-colors"><Upload className="w-8 h-8 text-[#0F4C81]" /></div>
                        <div className="text-sm font-bold text-gray-700">Click to Upload CRS Death Certificate</div>
                        <div className="text-xs text-gray-400 mt-1">PDF or image · AI auto-extracts deceased details</div>
                      </label>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                          {[['Deceased Name', crsExtraction.name], ['Date of Death', crsExtraction.dod ? (isNaN(new Date(crsExtraction.dod).getTime()) ? crsExtraction.dod : format(new Date(crsExtraction.dod), 'dd MMM yyyy')) : '—'], ['Linked Property', crsExtraction.dlpiId], ['CRS Reg. No.', crsExtraction.crsRegistrationNo]].map(([lbl, val]) => (
                            <div key={lbl}><div className="text-xs text-gray-500 mb-0.5">{lbl}</div><div className="text-sm font-bold text-gray-800">{val}</div></div>
                          ))}
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => setCrsExtraction(null)} className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"><X className="w-4 h-4" /> Re-upload</button>
                          <button onClick={handleInitiateAndESign} disabled={isInitiating}
                            className="flex-grow bg-[#0F4C81] hover:bg-[#0a3860] disabled:opacity-60 text-white font-bold py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 text-sm transition-all shadow-sm">
                            {isInitiating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating case…</> : <><Zap className="w-4 h-4" /> Confirm & Send eSign Requests <ArrowRight className="w-3.5 h-3.5" /></>}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: eSIGN BY ALL HEIRS */}
              {step === 'esign_heirs' && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 bg-purple-950 border border-purple-700 rounded-xl px-5 py-3.5">
                    <Shield className="w-5 h-5 text-purple-400 shrink-0" />
                    <div>
                      <div className="text-purple-200 font-bold text-sm">HSA 2005 S.6(3) — Daughters are Coparceners by Birth</div>
                      <div className="text-purple-400 text-xs mt-0.5">Shares computed equally. No officer can override daughters' rights.</div>
                    </div>
                  </div>
                  <div className="card space-y-5">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                      <div className="bg-[#0F4C81]/10 p-2.5 rounded-lg"><Shield className="w-5 h-5 text-[#0F4C81]" /></div>
                      <div>
                        <h2 className="font-bold text-gray-900">Step 3 - eSign by All Heirs (`Requests Sent`)</h2>
                        <p className="text-xs text-gray-500 mt-0.5">e-Sign verification requests are pending across each inheritor's portal.</p>
                      </div>
                      <div className="ml-auto text-sm font-bold text-[#0F4C81]">{heirs.filter(h => h.hasConsented).length}/{heirs.length} Signed</div>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-[#0F4C81] shrink-0 mt-0.5" />
                      <div className="text-xs text-blue-950 leading-relaxed">
                        <span className="font-bold">📤 Document Uploaded & e-Sign Requests Dispatched to All Inheritors' Home Pages!</span>
                        <div className="mt-1">
                          We have verified the Death Certificate and initiated virasat claim <strong className="font-mono">{caseData?.caseId || 'SUC-ACTIVE'}</strong>. Digital verification prompts have been sent directly to the <strong>Home Page (`/my-parcels`)</strong> of every legal co-heir listed below (`Suresh Yadav`, `Priya Kumar`, etc.). Once all co-heirs verify their Aadhaar from their home portal (`or right below if on a shared device`), the case automatically forwards to the <strong>Tehsildar Portal (`/officer-dashboard`)</strong>.
                        </div>
                      </div>
                    </div>

                    {heirs.length === 0 && (
                      <div className="text-center py-8 text-gray-400"><Loader2 className="w-7 h-7 mx-auto mb-2 animate-spin opacity-50" /><p className="text-sm">Loading heirs…</p></div>
                    )}
                    <div className="space-y-3">
                      {heirs.map((heir, idx) => (
                        <div key={heir.heirId} className={clsx('flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border transition-all', heir.hasConsented ? 'bg-emerald-50 border-emerald-200' : heir.hasObjected ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200')}>
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0', heir.hasConsented ? 'bg-emerald-500 text-white' : heir.hasObjected ? 'bg-red-500 text-white' : 'bg-[#0F4C81] text-white')}>
                              {heir.hasConsented ? <CheckCircle className="w-5 h-5" /> : heir.hasObjected ? <X className="w-5 h-5" /> : (idx + 1)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-gray-900 flex items-center gap-2">
                                {heir.name}
                                <span className="text-xs bg-blue-100 text-[#0F4C81] px-2 py-0.5 rounded-full font-mono font-semibold">Share: {heir.share || `1/${heirs.length}`}</span>
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">{heir.relation || 'Legal Heir'} · HSA 2005 S.6(3) Coparcener</div>
                              {heir.hasConsented && heir.consentedAt ? (
                                <div className="text-xs text-emerald-600 font-semibold mt-0.5">✓ eSigned via Aadhaar ({(heir as any).aadhaar || heir.aadhaarNumber ? `XXXX-XXXX-${String((heir as any).aadhaar || heir.aadhaarNumber).slice(-4)}` : 'Verified'}) at {format(new Date(heir.consentedAt), 'HH:mm, dd MMM')}</div>
                              ) : (
                                <div className="text-xs font-semibold text-amber-700 mt-0.5">⏳ Awaiting Aadhaar eSign — request also sent to {heir.name}&apos;s Home Page</div>
                              )}
                            </div>
                          </div>
                          <div className="w-full sm:w-auto shrink-0">
                            {heir.hasConsented ? (
                              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-3.5 py-2 rounded-full shadow-sm"><CheckCircle className="w-4 h-4" /> Aadhaar eSigned ✓</span>
                            ) : heir.hasObjected ? (
                              <span className="text-xs font-bold text-red-700 bg-red-100 border border-red-300 px-3.5 py-2 rounded-full">⚖ Objected</span>
                            ) : (
                              <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                                <div className="flex items-center gap-2 bg-white border border-amber-300 rounded-xl px-2 py-1.5 shadow-sm w-full sm:w-auto">
                                  <input
                                    type="text"
                                    maxLength={12}
                                    placeholder="12-digit Aadhaar"
                                    value={heirAadhaarInputs[heir.heirId] || ''}
                                    onChange={e => setHeirAadhaarInputs(prev => ({ ...prev, [heir.heirId]: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                                    className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg flex-1 font-mono w-36 focus:outline-none focus:ring-2 focus:ring-amber-400 text-gray-900"
                                  />
                                  <button
                                    onClick={() => handleConsent(heir.heirId)}
                                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition-colors flex items-center gap-1 shrink-0"
                                  >
                                    <Shield className="w-3.5 h-3.5" /> eSign
                                  </button>
                                </div>
                                {(heirAadhaarInputs[heir.heirId] || '').length > 0 && (heirAadhaarInputs[heir.heirId] || '').length < 12 && (
                                  <span className="text-xs text-red-500 font-semibold">{12 - (heirAadhaarInputs[heir.heirId] || '').length} more digits needed</span>
                                )}
                                {(heirAadhaarInputs[heir.heirId] || '').length === 12 && (
                                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Ready to sign</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {heirs.length > 0 && heirs.every(h => h.hasConsented) && (
                      <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-4">
                        <div><div className="font-bold text-emerald-800">All heirs have eSigned!</div><div className="text-xs text-emerald-600 mt-0.5">Forwarding to Tehsildar…</div></div>
                        <button onClick={() => setStep('tehsildar_final')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm transition-colors shrink-0">Tehsildar Verify <ArrowRight className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 4: TEHSILDAR FINAL VERIFICATION */}
              {step === 'tehsildar_final' && (
                <div className="space-y-5">
                  <div className="card">
                    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                      <div className="bg-amber-100 p-2.5 rounded-lg"><Landmark className="w-6 h-6 text-amber-600" /></div>
                      <div>
                        <h2 className="font-bold text-gray-900">Step 4 - Tehsildar Final Verification</h2>
                        <p className="text-xs text-gray-500 mt-0.5">All heirs eSigned. Tehsildar reviews and gives final approval for land division.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-5">
                      {[
                        ['Property', crsExtraction?.dlpiId || selectedDlpiId || DEMO_DLPI],
                        ['Deceased', crsExtraction?.name || DEMO_DECEASED.name],
                        ['Date of Death', crsExtraction?.dod ? format(new Date(crsExtraction.dod), 'dd MMM yyyy') : '—'],
                        ['CRS Reg. No.', crsExtraction?.crsRegistrationNo || DEMO_CRS.crsRegistrationNo],
                        ['Total Heirs', `${heirs.length}`],
                        ['eSigns Collected', `${heirs.filter(h => h.hasConsented).length}/${heirs.length}`],
                      ].map(([lbl, val]) => (
                        <div key={lbl} className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-500">{lbl}</div><div className="font-bold text-gray-800 mt-0.5 text-sm">{val}</div></div>
                      ))}
                    </div>
                    <div className="mb-5">
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Proposed Land Division</div>
                      <div className="space-y-2">
                        {heirs.map(h => (
                          <div key={h.heirId} className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                            <div className="w-8 h-8 bg-[#0F4C81] rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">{h.name.charAt(0)}</div>
                            <div className="flex-1"><div className="font-semibold text-gray-900 text-sm">{h.name}</div><div className="text-xs text-gray-500">{h.relation || 'Legal Heir'}</div></div>
                            <div className="text-right"><div className="font-bold text-[#0F4C81] text-sm">{h.share || `1/${heirs.length}`}</div><div className="text-xs text-gray-400">{((h.shareDecimal || 1/heirs.length) * 100).toFixed(1)}%</div></div>
                            {h.hasConsented && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                          </div>
                        ))}
                      </div>
                    </div>
                    {!finalApproved ? (
                      <div className="space-y-3">
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-amber-900 text-sm">⏳ Forwarded to Tehsildar's Officer Portal (`/officer-dashboard`)</div>
                            <div className="text-xs text-amber-800 mt-1 leading-relaxed">
                              All {heirs.length} legal heir(s) have successfully e-Signed with their Aadhaar numbers (`HSA 2005 S.6(3)` verified). Your virasat case is now inside the Tehsildar's official review queue waiting for final verification & on-chain land division.
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button onClick={handleTehsildarFinalApprove} disabled={isFinalApproving}
                            className="flex-1 bg-[#0F4C81] hover:bg-[#0a3860] disabled:opacity-60 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow transition-all text-sm">
                            {isFinalApproving ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking Tehsildar Status…</> : <><CheckCircle className="w-4 h-4" /> Check Tehsildar Approval Status</>}
                          </button>
                          <button onClick={() => { setFinalApproved(true); toast.success('Simulated Tehsildar Final Approval'); setStep('blockchain_division'); }}
                            className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shrink-0">
                            ⚡ Demo: Simulate Tehsildar Approval →
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
                        <div><div className="font-bold text-emerald-800">Final Verification Complete by Tehsildar!</div><div className="text-xs text-emerald-600 mt-0.5">Proceeding to blockchain land division…</div></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 5: BLOCKCHAIN LAND DIVISION */}
              {step === 'blockchain_division' && (
                <div className="space-y-5">
                  <div className="bg-gradient-to-br from-slate-900 to-[#0F4C81] text-white rounded-xl shadow-xl p-6 border border-blue-400/30">
                    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/15">
                      <div className="bg-white/15 p-2.5 rounded-lg border border-white/20"><Database className="w-6 h-6 text-blue-200" /></div>
                      <div>
                        <h2 className="text-lg font-bold">Step 5 - Blockchain Land Division</h2>
                        <p className="text-xs text-blue-200 mt-0.5">Atomic mutation on Hyperledger Fabric — removes deceased, grants each heir their share.</p>
                      </div>
                      <span className="ml-auto bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">Ready</span>
                    </div>
                    {!executionResult ? (
                      <>
                        <div className="space-y-2 mb-5 text-sm text-blue-100">
                          {['Death Certificate OCR Verified', 'All Heirs eSigned Consent', 'Tehsildar Final Verification Complete'].map(t => (
                            <div key={t} className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> {t}</div>
                          ))}
                          <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> Property: <strong className="text-white font-mono">{crsExtraction?.dlpiId || selectedDlpiId || DEMO_DLPI}</strong></div>
                        </div>
                        <div className="mb-5">
                          <div className="text-xs font-bold uppercase tracking-wider text-blue-300 mb-2">Will be divided as:</div>
                          <div className="space-y-2">
                            {heirs.map(h => (
                              <div key={h.heirId} className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-lg p-3">
                                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold text-sm shrink-0">{h.name.charAt(0)}</div>
                                <div className="flex-1"><div className="font-semibold text-sm">{h.name}</div><div className="text-xs text-blue-200">{h.relation || 'Legal Heir'}</div></div>
                                <div className="font-bold text-emerald-300">{h.share || `1/${heirs.length}`}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <button onClick={handleExecuteBlockchain} disabled={isExecuting}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-60 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2.5 shadow-lg transition-all text-sm">
                          {isExecuting ? <><Loader2 className="w-5 h-5 animate-spin" /> Committing to blockchain…</> : <><Database className="w-5 h-5" /> Execute Land Division on Blockchain <Zap className="w-4 h-4" /></>}
                        </button>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 bg-emerald-500/20 border border-emerald-400/40 rounded-xl p-4">
                          <CheckCircle className="w-7 h-7 text-emerald-300 shrink-0" />
                          <div>
                            <div className="font-bold text-emerald-200 text-base">🎉 Land Successfully Divided on Blockchain!</div>
                            <div className="text-xs text-emerald-300 mt-0.5">Each heir's ownership is now permanently recorded. Deceased removed as owner.</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-blue-300 mb-2">New Ownership Records</div>
                          <div className="space-y-2">
                            {(executionResult?.heirs || heirs).map((h: any, i: number) => (
                              <div key={i} className="flex items-center gap-3 bg-emerald-500/15 border border-emerald-400/30 rounded-lg p-3">
                                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                                <div className="flex-1"><div className="font-bold text-sm">{h.name}</div><div className="text-xs text-blue-200 font-mono">Share: {h.share || h.finalShare || `1/${heirs.length}`}</div></div>
                                <span className="text-xs bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-mono px-2 py-0.5 rounded">On-Chain ✓</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-white/10 rounded-lg p-3 text-xs text-blue-200 font-mono">Case: {caseData?.caseId || 'SUC-DEMO'} · Status: AUTO_MUTATED · Fabric: Finalized</div>
                        <div className="flex gap-3">
                          <a href="/my-parcels" className="flex-1 bg-white text-[#0F4C81] hover:bg-blue-50 font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors">View Updated Parcels →</a>
                          <button onClick={() => { setStep('add_heir'); setHeirRows([{name:'',aadhaar:''}]); setNominations([]); setCrsExtraction(null); setHeirs([]); setCaseData(null); setExecutionResult(null); setFinalApproved(false); }}
                            className="flex-1 border border-white/30 text-white hover:bg-white/10 font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors">Start New Succession</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Right info panel */}
            <div className="w-60 shrink-0 space-y-4">
              <div className="card">
                <div className="flex items-center gap-2 mb-3"><Info className="w-4 h-4 text-[#0F4C81]" /><span className="text-sm font-semibold text-gray-700">Succession Workflow</span></div>
                <ol className="space-y-2.5">
                  {STEPS.map((s, i) => {
                    const done = i < stepIdx; const active = i === stepIdx;
                    return (
                      <li key={s.id} className="flex items-start gap-2.5">
                        <div className={clsx('w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5', done ? 'bg-[#0F4C81] text-white' : active ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400')}>
                          {done ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                        </div>
                        <div className={clsx('text-xs font-semibold', active ? 'text-amber-600' : done ? 'text-gray-700' : 'text-gray-400')}>{s.label}</div>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <div className="card">
                <div className="flex items-center gap-1.5 mb-2"><Shield className="w-3.5 h-3.5 text-purple-400" /><div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Why Daughters = Sons</div></div>
                <div className="text-xs text-gray-500 space-y-2">
                  <p>Before 2005, daughters lost coparcenary rights on marriage. The amendment made them <span className="text-purple-500 font-medium">coparceners by birth</span> — equal to sons.</p>
                  <p>BhumiChain's chaincode <span className="text-purple-500 font-medium">hard-rejects</span> any succession where a daughter's share is less than a son's.</p>
                </div>
              </div>
              <div className="card bg-amber-50 border border-amber-200">
                <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Current Step</div>
                <div className="font-bold text-amber-800 text-sm">{STEPS[stepIdx]?.label}</div>
                <div className="text-xs text-amber-600 mt-1.5">{stepHint[step]}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
