'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/dashboard/Sidebar';
import MultiSig from '@/components/forms/MultiSig';
import MutationAlert from '@/components/modals/MutationAlert';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  getDemoToken, initiateSuccession, recordHeirConsent,
  getSuccessionCase, verifyCRS,
} from '@/lib/api';
import type { SuccessionCase, SuccessionHeir } from '@/types';
import toast from 'react-hot-toast';
import {
  Users, Shield, CheckCircle, Zap, FileText,
  ChevronRight, Info, Clock, Cpu, AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

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

const DEMO_FAMILY_ID = 'FAM-MH-SNN-001';
const DEMO_DLPI      = 'DLPI-MH-SNN-00142';

const DEMO_DECEASED = {
  name:        'Ramesh Dattatray Patil',
  aadhaarHash: 'sha256:a3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a',
  dod:         '2026-05-20',
  dob:         '1958-03-15',
};

const DEMO_CRS = {
  deathCertCID:      'QmDeathCertRamesh2026',
  crsRegistrationNo: 'CRS-NSK-2026-00541',
};

const MOCK_ALERT = {
  mutationId:          'MUT-DLPI-MH-SNN-00142-d4e5f6a7',
  dlpiId:              DEMO_DLPI,
  mutationType:        'Inheritance',
  officerName:         'Prakash Nana Kulkarni, Circle Officer',
  alertSentAt:         new Date(Date.now() - 64_000).toISOString(),
  slaMet:              true,
  alertElapsedSeconds: 64,
};

// Offline fallback heirs — used when API is unreachable
const OFFLINE_HEIRS: SuccessionHeir[] = [
  {
    heirId: 'HEIR-001', name: 'Arun Ramesh Patil', aadhaarHash: 'sha256:heir1',
    relation: 'Son', gender: 'M', dob: '1988-03-15',
    isAlive: true, isAdult: true, isNri: false,
    share: '1/3', shareDecimal: 0.3333, legalNote: undefined,
    hasConsented: false, hasObjected: false,
  },
  {
    heirId: 'HEIR-002', name: 'Vijay Ramesh Patil', aadhaarHash: 'sha256:heir2',
    relation: 'Son', gender: 'M', dob: '1991-07-22',
    isAlive: true, isAdult: true, isNri: false,
    share: '1/3', shareDecimal: 0.3333, legalNote: undefined,
    hasConsented: false, hasObjected: false,
  },
  {
    heirId: 'HEIR-003', name: 'Sunita Ramesh Patil', aadhaarHash: 'sha256:heir3',
    relation: 'Daughter', gender: 'F', dob: '1994-11-08',
    isAlive: true, isAdult: true, isNri: false,
    share: '1/3', shareDecimal: 0.3334,
    legalNote: 'Equal coparcenary right per Hindu Succession (Amendment) Act 2005 Section 6(3)',
    hasConsented: false, hasObjected: false,
  },
];

const AI_STEPS = [
  'Fetching family registry from Nashik district',
  'Identifying Class I heirs under HSA 1956',
  'Applying HSA 2005 S.6(3) — daughters equal coparceners',
  'Computing 1/3 shares across 3 heirs (Fraction arithmetic)',
  'Validating share sum = 1.0',
  'Checking for NRI / minor / overseas heir edge cases',
  'Pinning computation log to IPFS',
];

type Stage =
  | 'idle'
  | 'crs_verified'
  | 'ai_computing'
  | 'heirs_identified'
  | 'awaiting_consents'
  | 'all_consented';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuccessionPage() {
  const [stage, setStage]         = useState<Stage>('idle');
  const [caseData, setCaseData]   = useState<SuccessionCase | null>(null);
  const [heirs, setHeirs]         = useState<SuccessionHeir[]>([]);
  const [showAlert, setShowAlert] = useState(false);
  const [aiSteps, setAiSteps]     = useState(AI_STEPS.map((label) => ({ label, done: false })));

  const { triggerMock, on: onWs } = useWebSocket(DEMO_DLPI);

  // Acquire demo token on mount
  useEffect(() => {
    getDemoToken('oracle', 'CRS Oracle').catch(() => {});
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

  const handleVerifyCRS = async () => {
    try {
      await verifyCRS(DEMO_CRS.crsRegistrationNo);
    } catch { /* mock ok */ }
    setStage('crs_verified');
    toast.success('CRS death certificate verified — CRS-NSK-2026-00541');
  };

  // ── Step 2: Run CoparcenaryMapper AI ─────────────────────────────────────

  const handleRunAI = async () => {
    setStage('ai_computing');
    setAiSteps(AI_STEPS.map((label) => ({ label, done: false })));

    // Animate pipeline steps
    for (let i = 0; i < AI_STEPS.length; i++) {
      await delay(320);
      setAiSteps((prev) => prev.map((s, idx) => idx <= i ? { ...s, done: true } : s));
    }

    // Initiate on-chain + load case
    try {
      const res = await initiateSuccession({
        dlpiId:              DEMO_DLPI,
        familyId:            DEMO_FAMILY_ID,
        deceasedName:        DEMO_DECEASED.name,
        deceasedAadhaarHash: DEMO_DECEASED.aadhaarHash,
        dateOfDeath:         DEMO_DECEASED.dod,
        deathCertCID:        DEMO_CRS.deathCertCID,
        crsRegistrationNo:   DEMO_CRS.crsRegistrationNo,
      });
      const sc = await getSuccessionCase(res.caseId || 'SUC-DLPI-MH-SNN-00142-a1b2c3d4');
      setCaseData(sc);
      setHeirs(sc.heirs.map((h) => ({ ...h, hasConsented: false, hasObjected: false })));
    } catch {
      // Full offline fallback
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

    try {
      await recordHeirConsent(
        caseData?.caseId || 'SUC-DLPI-MH-SNN-00142-a1b2c3d4',
        {
          heirAadhaarHash: heir.aadhaarHash,
          eSignTxHash:     `esign-${heirId}-${Date.now()}`,
        },
      );
    } catch { /* offline ok */ }

    setHeirs((prev) => {
      const updated = prev.map((h) =>
        h.heirId === heirId
          ? { ...h, hasConsented: true, consentedAt: new Date().toISOString() }
          : h,
      );
      if (updated.every((h) => h.hasConsented)) {
        setStage('all_consented');
        toast.success('All 3 heirs consented — auto-mutation executing!');
        triggerMock('scene3_auto_mutation');
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
    stage === 'all_consented';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
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
        <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-3 shrink-0">
          <Users className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-semibold text-gray-200">Succession & Coparcenary</span>
          <span className="text-xs text-gray-500">— Demo Scene 3</span>
          <div className="ml-auto">
            <StageBar stage={stage} />
          </div>
        </div>

        <div className="flex-1 flex gap-6 p-6">

          {/* ── Left column: main flow ──────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* IDLE: Trigger */}
            {stage === 'idle' && (
              <div className="card">
                <div className="text-sm font-semibold text-gray-200 mb-4">
                  Scene 3 — CRS Death Certificate Trigger
                </div>
                <div className="bg-gray-800 rounded-xl p-4 mb-5 space-y-2">
                  <InfoRow label="Deceased" value={DEMO_DECEASED.name} />
                  <InfoRow label="Date of Death" value={format(new Date(DEMO_DECEASED.dod), 'dd MMM yyyy')} />
                  <InfoRow label="Parcel (DLPI)" value={DEMO_DLPI} mono />
                  <InfoRow label="CRS No." value={DEMO_CRS.crsRegistrationNo} mono />
                </div>
                <button onClick={handleVerifyCRS} className="btn-primary flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Verify CRS Death Certificate
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* CRS VERIFIED: run AI */}
            {stage === 'crs_verified' && (
              <div className="space-y-4">
                <Banner
                  icon={<CheckCircle className="w-5 h-5 text-brand-400" />}
                  title="CRS death certificate verified"
                  subtitle="CRS-NSK-2026-00541 · Civil Registration System, Sinnar"
                  color="brand"
                />
                <div className="card">
                  <div className="text-sm font-semibold text-gray-200 mb-1">
                    Run CoparcenaryMapper AI
                  </div>
                  <div className="text-gray-500 text-xs mb-4">
                    Rule engine + HSA 2005 enforcement → compute heir shares automatically from family registry
                  </div>
                  <button onClick={handleRunAI} className="btn-primary flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    Compute Succession Shares
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* AI COMPUTING */}
            {stage === 'ai_computing' && (
              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <Cpu className="w-4 h-4 text-brand-400 animate-pulse" />
                  <span className="text-sm font-semibold text-gray-200">CoparcenaryMapper AI</span>
                  <span className="text-xs text-gray-500 ml-1">port 8011</span>
                </div>
                <div className="space-y-2.5">
                  {aiSteps.map((s, i) => (
                    <div
                      key={i}
                      className={clsx(
                        'flex items-center gap-3 text-sm transition-colors',
                        s.done ? 'text-gray-300' : 'text-gray-600',
                      )}
                    >
                      {s.done
                        ? <CheckCircle className="w-4 h-4 text-brand-400 shrink-0" />
                        : <div className="w-4 h-4 border border-gray-600 rounded-full shrink-0 animate-pulse" />
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
                      Sunita Ramesh Patil's share equals her brothers' — enforced at chaincode level.
                      No revenue officer can override this.
                    </div>
                  </div>
                </div>

                {/* Family tree */}
                <div className="card">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-4 h-4 text-brand-400" />
                    <span className="text-sm font-semibold text-gray-200">Family Tree</span>
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
                  subtitle="All adult heirs must eSign to trigger automatic succession mutation"
                  signers={signers}
                  onSign={handleConsent}
                  onObject={handleObject}
                  completedText="All heirs consented — succession mutation executing automatically"
                />

                {/* All-consented banner */}
                {stage === 'all_consented' && (
                  <div className="flex items-center gap-4 bg-brand-950 border border-brand-700 rounded-xl px-5 py-4">
                    <div className="w-10 h-10 rounded-full bg-brand-800 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5 text-brand-300" />
                    </div>
                    <div>
                      <div className="text-brand-300 font-bold text-sm">Auto-Mutation Executing</div>
                      <div className="text-brand-500 text-xs mt-0.5">
                        Fabric transaction submitted · New title being written to ledger ·
                        Arun, Vijay &amp; Sunita each hold 1/3
                      </div>
                    </div>
                    <CheckCircle className="w-6 h-6 text-brand-400 ml-auto shrink-0" />
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
                <Info className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-semibold text-gray-200">Scene 3 flow</span>
              </div>
              <ol className="space-y-2.5 text-xs text-gray-400">
                {[
                  ['CRS oracle',      'Death cert triggers succession'],
                  ['CoparcenaryMapper', 'AI computes shares per HSA 2005'],
                  ['Mutation alert',  'Officer alerted in 64s (SLA: 60s)'],
                  ['Heir notifications', 'SMS + WhatsApp to all 3 heirs'],
                  ['Multi-sig consent', 'Each heir eSigns their share'],
                  ['Auto-mutation',   'All consent → Fabric executes automatically'],
                ].map(([title, desc], i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-4 h-4 rounded-full bg-gray-800 text-gray-500 flex items-center justify-center shrink-0 font-mono text-xs">
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-gray-300">{title}</div>
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
  'idle', 'crs_verified', 'ai_computing',
  'heirs_identified', 'awaiting_consents', 'all_consented',
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
    brand: 'bg-brand-950 border-brand-700 text-brand-300 text-brand-500',
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
      <span className={clsx('text-gray-200 text-right break-all', small ? 'text-xs' : 'text-sm', mono && 'font-mono')}>
        {value}
      </span>
    </div>
  );
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
