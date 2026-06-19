'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import TribalReject from '@/components/modals/TribalReject';
import { useWebSocket } from '@/hooks/useWebSocket';
import { checkTribal, getDemoToken } from '@/lib/api';
import type { TribalCheckResult } from '@/types';
import toast from 'react-hot-toast';
import {
  Shield, CheckCircle, AlertTriangle, Users, Clock,
  ChevronRight, Info, Lock, MapPin, Leaf,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Demo constants ───────────────────────────────────────────────────────────

const TRIBAL_DLPI = 'DLPI-MH-IGT-T0023';

const TRIBAL_PARCEL = {
  dlpiId:       TRIBAL_DLPI,
  ownerName:    'Mangal Ramji Bhil',
  surveyNo:     'T-23',
  tehsil:       'Igatpuri',
  village:      'Ghoti Budrukh',
  district:     'Nashik',
  landType:     'Tribal FRA Patta',
  area:         '1.8 ha',
  community:    'Bhil',
  scheduleType: 'V',
  protectionLevel: 'CONDITIONAL',
};

const GRAM_SABHA_MEMBERS = [
  { id: 'GS-001', name: 'Bapurao Vithal Bhil',   role: 'Gram Sabha President',  signed: false },
  { id: 'GS-002', name: 'Savita Govind Bhil',    role: 'Member',                signed: false },
  { id: 'GS-003', name: 'Ramkrishna Tukaram Bhil', role: 'Member',              signed: false },
  { id: 'GS-004', name: 'Jayabai Kisan Bhil',    role: 'Member',                signed: false },
  { id: 'GS-005', name: 'Tulsiram Nana Bhil',    role: 'Member',                signed: false },
];

const MOCK_REJECTION: TribalCheckResult = {
  dlpiId: TRIBAL_DLPI,
  attemptId: 'TGA-DLPI-MH-IGT-T0023-c3d4e5f6',
  isTribalParcel: true,
  scheduleType: 'V',
  community: 'Bhil',
  decision: 'HARD_REJECTED',
  rejectionCode: 'SCHEDULE_V_NON_TRIBAL',
  rejectionReason:
    'HARD REJECT — Parcel DLPI-MH-IGT-T0023 is located in a Fifth Schedule (Scheduled Area) in ' +
    'Igatpuri tehsil, Nashik district, Maharashtra. Buyer is not a registered Scheduled Tribe member. ' +
    'Transfer of tribal land to non-tribal persons in Scheduled Areas is VOID AB INITIO per Supreme ' +
    'Court ruling in Samatha v. State of AP (1997) 8 SCC 191. No revenue officer, SRO, or digital ' +
    'signature can authorise this transaction.',
  legalCitations: [
    "Constitution of India, Fifth Schedule, Para 5(2) — Transfer of immovable property by or among members of a Scheduled Tribe in a Scheduled Area requires Governor's sanction",
    'Samatha v. State of Andhra Pradesh (1997) 8 SCC 191 — Supreme Court held that transfer of tribal land to non-tribals in Fifth Schedule areas is unconstitutional and void ab initio',
    'Maharashtra Land Revenue Code, Section 36A — Tribal land in Scheduled Areas cannot be transferred to non-tribal without written permission of Collector',
    'Forest Rights Act 2006, Section 4(5) — No eviction or displacement of forest dwelling Scheduled Tribes without recognition of forest rights',
  ],
  responseTimeMs: 147,
};

const MOCK_ALLOWED: TribalCheckResult = {
  dlpiId: TRIBAL_DLPI,
  attemptId: 'TGA-DLPI-MH-IGT-T0023-d4e5f6g7',
  isTribalParcel: true,
  scheduleType: 'V',
  community: 'Bhil',
  decision: 'ALLOWED_PENDING_APPROVALS',
  responseTimeMs: 156,
  requiredApprovals: [
    'Gram Sabha multi-sig (quorum = 5 members)',
    'GPS-tagged video consent recording (IPFS pin)',
    'District Collector written approval',
  ],
};

type BuyerMode = 'non_tribal' | 'same_community';
type CheckState = 'idle' | 'checking' | 'rejected' | 'allowed_pending';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TribalPage() {
  const [buyerMode, setBuyerMode]     = useState<BuyerMode>('non_tribal');
  const [checkState, setCheckState]   = useState<CheckState>('idle');
  const [result, setResult]           = useState<TribalCheckResult | null>(null);
  const [showModal, setShowModal]     = useState(false);
  const [gramSabha, setGramSabha]     = useState(GRAM_SABHA_MEMBERS);
  const [checkMs, setCheckMs]         = useState<number | null>(null);

  const { triggerMock, on: onWs } = useWebSocket(TRIBAL_DLPI);

  useEffect(() => {
    getDemoToken('nalsa', 'NALSA Officer').catch(() => {});
  }, []);

  useEffect(() => {
    return onWs('*', (msg) => {
      if (msg.event === 'TribalTransferHardRejected') {
        toast.error('TribalGuard event fired → NALSA + ST Commissioner notified', { duration: 4000 });
      }
    });
  }, [onWs]);

  const runCheck = async () => {
    setCheckState('checking');
    setResult(null);
    const start = Date.now();

    const payload = {
      dlpiId:          TRIBAL_DLPI,
      buyerName:       buyerMode === 'non_tribal' ? 'Suresh Balaji Deshmukh' : 'Ramesh Tukaram Bhil',
      buyerAadhaarHash: buyerMode === 'non_tribal'
        ? 'sha256:buyer1suresh9d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0'
        : 'sha256:tribalbhil2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7',
      isTribalBuyer:   buyerMode === 'same_community',
    };

    try {
      const res = await checkTribal(payload);
      const elapsed = Date.now() - start;
      setCheckMs(res.responseTimeMs || elapsed);
      setResult(res);
      if (res.decision === 'HARD_REJECTED') {
        setCheckState('rejected');
        triggerMock('scene6_tribal_rejected');
        setTimeout(() => setShowModal(true), 400);
      } else {
        setCheckState('allowed_pending');
      }
    } catch {
      const elapsed = Date.now() - start;
      const mock = buyerMode === 'non_tribal' ? MOCK_REJECTION : MOCK_ALLOWED;
      setCheckMs(mock.responseTimeMs);
      setResult(mock);
      if (buyerMode === 'non_tribal') {
        setCheckState('rejected');
        triggerMock('scene6_tribal_rejected');
        setTimeout(() => setShowModal(true), 400);
      } else {
        setCheckState('allowed_pending');
      }
    }
  };

  const handleGramSabhaSign = (memberId: string) => {
    setGramSabha((prev) => {
      const updated = prev.map((m) => m.id === memberId ? { ...m, signed: true } : m);
      const signedCount = updated.filter((m) => m.signed).length;
      if (signedCount === 5) {
        toast.success('Gram Sabha quorum reached (5/5) — transfer approved conditionally');
      } else {
        const m = updated.find((m) => m.id === memberId);
        if (m) toast.success(`${m.name} signed ✓`);
      }
      return updated;
    });
  };

  const reset = () => {
    setCheckState('idle');
    setResult(null);
    setShowModal(false);
    setCheckMs(null);
    setGramSabha(GRAM_SABHA_MEMBERS);
  };

  const gramSabhaQuorum = gramSabha.filter((m) => m.signed).length;
  const quorumMet = gramSabhaQuorum >= 5;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar demoMode />

      {showModal && result?.decision === 'HARD_REJECTED' && result && (
        <TribalReject
          {...result}
          parcelOwner={TRIBAL_PARCEL.ownerName}
          attemptedBuyerName={buyerMode === 'non_tribal' ? 'Suresh Balaji Deshmukh' : undefined}
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Topbar */}
        <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-3 shrink-0">
          <Shield className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-gray-200">TribalGuard</span>
          <span className="text-xs text-gray-500">— Demo Scene 6</span>
          {checkMs !== null && (
            <div className={clsx(
              'ml-4 flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-full',
              checkMs <= 200
                ? 'bg-brand-950 border border-brand-700 text-brand-300'
                : 'bg-amber-950 border border-amber-700 text-amber-300',
            )}>
              <Clock className="w-3 h-3" />
              {checkMs}ms {checkMs <= 200 ? '≤ 200ms ✓' : '> SLA'}
            </div>
          )}
        </div>

        <div className="flex-1 flex gap-6 p-6">

          {/* ── Left: parcel + form ─────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Tribal parcel card */}
            <div className="card border-amber-900">
              <div className="flex items-center gap-2 mb-3">
                <Leaf className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-gray-200">Tribal Parcel</span>
                <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold bg-amber-950 border border-amber-700 text-amber-300">
                  Schedule V · Bhil
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <InfoRow label="DLPI"     value={TRIBAL_PARCEL.dlpiId} mono />
                <InfoRow label="Owner"    value={TRIBAL_PARCEL.ownerName} />
                <InfoRow label="Survey"   value={TRIBAL_PARCEL.surveyNo} mono />
                <InfoRow label="Village"  value={`${TRIBAL_PARCEL.village}, ${TRIBAL_PARCEL.tehsil}`} />
                <InfoRow label="Area"     value={TRIBAL_PARCEL.area} />
                <InfoRow label="Land type" value={TRIBAL_PARCEL.landType} />
                <InfoRow label="Community" value={TRIBAL_PARCEL.community} />
                <InfoRow label="Protection" value={TRIBAL_PARCEL.protectionLevel} />
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-950 border border-amber-800 rounded-lg px-3 py-2">
                <MapPin className="w-3 h-3 shrink-0" />
                Igatpuri tehsil — designated Fifth Schedule (Scheduled Area) under Article 244(1) of the Constitution
              </div>
            </div>

            {/* Transfer attempt form */}
            <div className="card">
              <div className="text-sm font-semibold text-gray-200 mb-3">Attempt Transfer</div>

              {/* Buyer type toggle */}
              <div className="flex rounded-xl overflow-hidden border border-gray-700 text-xs mb-4">
                <button
                  onClick={() => { setBuyerMode('non_tribal'); reset(); }}
                  className={clsx(
                    'flex-1 px-3 py-2.5 font-semibold transition-colors',
                    buyerMode === 'non_tribal'
                      ? 'bg-red-700 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200',
                  )}
                >
                  Non-tribal buyer → HARD REJECT (Scene 6A)
                </button>
                <button
                  onClick={() => { setBuyerMode('same_community'); reset(); }}
                  className={clsx(
                    'flex-1 px-3 py-2.5 font-semibold transition-colors',
                    buyerMode === 'same_community'
                      ? 'bg-amber-700 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200',
                  )}
                >
                  Same community (Bhil) → Gram Sabha required (Scene 6B)
                </button>
              </div>

              {/* Buyer info */}
              <div className="bg-gray-800 rounded-xl p-3 text-xs space-y-1.5 mb-4">
                <InfoRow
                  label="Buyer"
                  value={buyerMode === 'non_tribal' ? 'Suresh Balaji Deshmukh (non-tribal)' : 'Ramesh Tukaram Bhil (Bhil community)'}
                />
                <InfoRow
                  label="Tribal cert"
                  value={buyerMode === 'non_tribal' ? 'NONE' : 'CERT-MH-BHIL-NSK-4892'}
                />
                <InfoRow label="Declared value" value="₹ 12,00,000" />
              </div>

              {checkState === 'idle' && (
                <button onClick={runCheck} className="btn-primary w-full flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4" />
                  Run TribalGuard Check
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              {checkState === 'checking' && (
                <div className="flex items-center gap-3 text-sm text-gray-400 py-2">
                  <span className="w-4 h-4 border border-brand-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  Invoking TribalGuard chaincode…
                </div>
              )}

              {checkState === 'rejected' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-red-950 border border-red-700 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                    <div>
                      <div className="text-red-300 font-bold text-sm">HARD REJECTED — VOID AB INITIO</div>
                      <div className="text-red-500 text-xs mt-0.5">
                        Samatha v. State of AP (1997) 8 SCC 191 · {checkMs}ms
                      </div>
                    </div>
                    <button
                      onClick={() => setShowModal(true)}
                      className="ml-auto text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-700 rounded-lg px-2.5 py-1"
                    >
                      Full Details
                    </button>
                  </div>
                  <button onClick={reset} className="btn-ghost w-full text-sm py-2">
                    Reset Demo
                  </button>
                </div>
              )}

              {checkState === 'allowed_pending' && (
                <div className="flex items-center gap-3 bg-amber-950 border border-amber-700 rounded-xl px-4 py-3">
                  <CheckCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-amber-300 font-bold text-sm">ALLOWED — Pending Gram Sabha Approval</div>
                    <div className="text-amber-500 text-xs mt-0.5">
                      Same community transfer · Quorum: 5 Gram Sabha members required · {checkMs}ms
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Gram Sabha multi-sig panel (only for allowed_pending) */}
            {checkState === 'allowed_pending' && (
              <div className="card">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-semibold text-gray-200">Gram Sabha Multi-sig</span>
                  <span className="ml-auto text-xs text-gray-500">Quorum: {gramSabhaQuorum}/5</span>
                </div>
                <div className="text-gray-500 text-xs mb-4">
                  Transfer within same Bhil community requires Gram Sabha quorum of 5 signatures + GPS-tagged video
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-gray-800 rounded-full mb-4">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all duration-500',
                      quorumMet ? 'bg-brand-500' : 'bg-amber-500',
                    )}
                    style={{ width: `${(gramSabhaQuorum / 5) * 100}%` }}
                  />
                </div>

                <div className="space-y-2">
                  {gramSabha.map((member) => (
                    <div key={member.id} className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors',
                      member.signed
                        ? 'bg-brand-950 border-brand-800'
                        : 'bg-gray-800 border-gray-700',
                    )}>
                      <div className={clsx(
                        'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                        member.signed ? 'bg-brand-700' : 'bg-gray-700',
                      )}>
                        {member.signed
                          ? <CheckCircle className="w-3.5 h-3.5 text-brand-300" />
                          : <Users className="w-3.5 h-3.5 text-gray-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-200">{member.name}</div>
                        <div className="text-xs text-gray-500">{member.role}</div>
                      </div>
                      {!member.signed && (
                        <button
                          onClick={() => handleGramSabhaSign(member.id)}
                          className="text-xs btn-primary py-1 px-2.5 flex items-center gap-1"
                        >
                          Sign
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {quorumMet && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 bg-brand-950 border border-brand-700 rounded-lg px-3 py-2.5 text-sm text-brand-300">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      Gram Sabha quorum met (5/5) — video consent + Collector approval required next
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-ghost flex-1 text-xs py-2">Upload GPS Video</button>
                      <button className="btn-primary flex-1 text-xs py-2">Request Collector Approval</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Inline rejection details (after modal dismissed) */}
            {checkState === 'rejected' && result && !showModal && (
              <TribalReject
                {...result}
                parcelOwner={TRIBAL_PARCEL.ownerName}
                attemptedBuyerName="Suresh Balaji Deshmukh"
                inline
              />
            )}
          </div>

          {/* ── Right: info panel ────────────────────────────────────────── */}
          <div className="w-72 shrink-0 space-y-4">

            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-semibold text-gray-200">TribalGuard Decision Tree</span>
              </div>
              <div className="space-y-2.5 text-xs">
                {[
                  { label: 'FRA Patta',                 result: 'HARD REJECT — inalienable',     color: 'red' },
                  { label: 'PVTG parcel',               result: 'HARD REJECT — NALSA + Governor', color: 'red' },
                  { label: 'Schedule V + non-tribal',   result: 'HARD REJECT — Samatha 1997',     color: 'red' },
                  { label: 'Schedule VI + non-tribal',  result: 'HARD REJECT — District Council', color: 'red' },
                  { label: 'Tribal + different community', result: 'HARD REJECT — cross-community', color: 'red' },
                  { label: 'Tribal + same community',   result: 'ALLOWED — Gram Sabha quorum=5',  color: 'amber' },
                  { label: 'Non-tribal parcel',         result: 'ALLOWED — standard transfer',    color: 'brand' },
                ].map(({ label, result: res, color }, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={clsx(
                      'text-xs font-mono shrink-0 mt-0.5',
                      color === 'red'   && 'text-red-400',
                      color === 'amber' && 'text-amber-400',
                      color === 'brand' && 'text-brand-400',
                    )}>→</span>
                    <div>
                      <div className="text-gray-300">{label}</div>
                      <div className={clsx(
                        'text-xs',
                        color === 'red'   && 'text-red-500',
                        color === 'amber' && 'text-amber-500',
                        color === 'brand' && 'text-brand-500',
                      )}>{res}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Technical</div>
              <div className="space-y-2 text-xs">
                <InfoRow label="Chaincode"   value="tribal-guard" mono />
                <InfoRow label="Channel"     value="tribal-channel-mh" mono />
                <InfoRow label="SLA target"  value="< 200ms" />
                <InfoRow label="Current"     value={checkMs ? `${checkMs}ms` : '—'} />
                <InfoRow label="Event fired" value="TribalTransferHardRejected" mono />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-1.5 mb-2">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Why this matters
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-2">
                <p>
                  India has <span className="text-amber-400 font-medium">9.38 crore tribal citizens</span> (7.5% of population).
                  Illegal land alienation remains the #1 driver of displacement.
                </p>
                <p>
                  BhumiChain's TribalGuard is the only system that enforces tribal protection
                  <span className="text-amber-400 font-medium"> at the blockchain level</span> — making
                  illegal transfers technically impossible, not just legally prohibited.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={clsx('text-gray-200 text-right break-all', mono && 'font-mono')}>{value}</span>
    </div>
  );
}
