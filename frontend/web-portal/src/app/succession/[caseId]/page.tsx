'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import { getSuccessionCase, recordHeirConsent } from '@/lib/api';
import type { SuccessionCase, SuccessionHeir } from '@/types';
import toast from 'react-hot-toast';
import {
  Users, Shield, CheckCircle, AlertTriangle, FileText,
  ChevronLeft, Info, Clock, Zap, X,
} from 'lucide-react';
import clsx from 'clsx';
import { format, differenceInDays } from 'date-fns';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuccessionDetailPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params?.caseId ?? '';
  const router = useRouter();

  const [caseData, setCaseData] = useState<SuccessionCase | null>(null);
  const [heirs, setHeirs]       = useState<SuccessionHeir[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showObjection, setShowObjection] = useState<string | null>(null);
  const [objectionReason, setObjectionReason] = useState('');

  useEffect(() => {
    if (!caseId) return;
    (async () => {
      try {
        const sc = await getSuccessionCase(caseId);
        setCaseData(sc);
        setHeirs(sc.heirs.map((h) => ({ ...h })));
      } catch {
        toast.error('Could not load succession case');
      } finally {
        setLoading(false);
      }
    })();
  }, [caseId]);

  const handleConsent = useCallback(async (heirId: string) => {
    if (!caseData) return;
    const heir = heirs.find((h) => h.heirId === heirId);
    if (!heir || heir.hasConsented || heir.hasObjected) return;

    try {
      await recordHeirConsent(caseData.caseId, {
        heirAadhaarHash: heir.aadhaarHash,
        eSignTxHash: `esign-${heirId}-${Date.now()}`,
      });
    } catch { /* offline ok */ }

    setHeirs((prev) => {
      const updated = prev.map((h) =>
        h.heirId === heirId ? { ...h, hasConsented: true, consentedAt: new Date().toISOString() } : h,
      );
      const allDone = updated.every((h) => h.hasConsented || h.hasObjected);
      const allConsented = updated.every((h) => h.hasConsented);
      if (allConsented) {
        toast.success('All heirs consented — auto-mutation executing!');
      } else if (allDone) {
        toast('Case resolved — some heirs filed objections. Referred to revenue court.', { duration: 5000 });
      } else {
        toast.success(`${heir.name} consented ✓`);
      }
      return updated;
    });
  }, [heirs, caseData]);

  const handleObjection = useCallback(async (heirId: string) => {
    if (!caseData || objectionReason.trim().length < 10) {
      toast.error('Provide at least 10 characters for objection reason');
      return;
    }
    const heir = heirs.find((h) => h.heirId === heirId);
    if (!heir) return;

    setHeirs((prev) =>
      prev.map((h) => h.heirId === heirId ? { ...h, hasObjected: true } : h),
    );
    setShowObjection(null);
    setObjectionReason('');
    toast('⚖️ Objection filed — case referred to Civil Court', { duration: 5000 });
  }, [heirs, caseData, objectionReason]);

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-950">
        <Sidebar demoMode />
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm animate-pulse">
          Loading succession case…
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex h-screen bg-gray-950">
        <Sidebar demoMode />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <div className="text-gray-300 font-semibold">Case not found</div>
            <button onClick={() => router.push('/succession')} className="mt-4 btn-ghost text-sm">
              ← Back to Succession List
            </button>
          </div>
        </div>
      </div>
    );
  }

  const consentDeadline = new Date(caseData.consentDeadline);
  const daysLeft = differenceInDays(consentDeadline, new Date());
  const deadlineUrgent = daysLeft <= 5;

  const allConsented = heirs.every((h) => h.hasConsented);
  const anyObjected  = heirs.some((h) => h.hasObjected);
  const allResolved  = heirs.every((h) => h.hasConsented || h.hasObjected);

  const consentCount  = heirs.filter((h) => h.hasConsented).length;
  const objectionCount = heirs.filter((h) => h.hasObjected).length;
  const pendingCount  = heirs.filter((h) => !h.hasConsented && !h.hasObjected).length;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar demoMode />

      {/* Objection modal */}
      {showObjection && (
        <ObjectionModal
          heirName={heirs.find((h) => h.heirId === showObjection)?.name || ''}
          reason={objectionReason}
          onReasonChange={setObjectionReason}
          onSubmit={() => handleObjection(showObjection)}
          onClose={() => { setShowObjection(null); setObjectionReason(''); }}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Topbar */}
        <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-3 shrink-0">
          <button
            onClick={() => router.push('/succession')}
            className="text-gray-400 hover:text-gray-200 flex items-center gap-1 text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Succession
          </button>
          <span className="text-gray-700">/</span>
          <Users className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-semibold text-gray-200 font-mono">{caseId}</span>
          <StatusPill status={allConsented ? 'AUTO_MUTATED' : anyObjected ? 'OBJECTION_FILED' : caseData.status} />
        </div>

        <div className="flex-1 flex gap-6 p-6">

          {/* ── Left: main content ──────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Case summary */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-semibold text-gray-200">Case Summary</span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
                <InfoRow label="Deceased"    value={caseData.deceasedName} />
                <InfoRow label="Date of Death" value={format(new Date(caseData.dateOfDeath), 'dd MMM yyyy')} />
                <InfoRow label="DLPI"         value={caseData.dlpiId} mono />
                <InfoRow label="CRS No."      value={caseData.crsRegistrationNo} mono />
                <InfoRow label="Applicable Law" value={caseData.applicableLaw} />
                <InfoRow label="Coparcenary"  value="Mitakshara" />
                <InfoRow label="AI Confidence" value={`${Math.round(caseData.aiConfidenceScore * 100)}%`} />
                <InfoRow label="Initiated"    value={format(new Date(caseData.initiatedAt), 'dd MMM yyyy, HH:mm')} />
              </div>
            </div>

            {/* Consent deadline warning */}
            <div className={clsx(
              'flex items-center gap-3 border rounded-xl px-4 py-3',
              deadlineUrgent
                ? 'bg-red-950 border-red-700'
                : 'bg-amber-950 border-amber-800',
            )}>
              <Clock className={clsx('w-4 h-4 shrink-0', deadlineUrgent ? 'text-red-400' : 'text-amber-400')} />
              <div>
                <div className={clsx('font-semibold text-sm', deadlineUrgent ? 'text-red-300' : 'text-amber-300')}>
                  Consent deadline: {format(consentDeadline, 'dd MMM yyyy')}
                  {daysLeft >= 0 ? ` (${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining)` : ' (OVERDUE)'}
                </div>
                <div className={clsx('text-xs mt-0.5', deadlineUrgent ? 'text-red-500' : 'text-amber-500')}>
                  All heirs must eSign before this date or case is referred to revenue court.
                </div>
              </div>
            </div>

            {/* HSA 2005 notice */}
            <div className="flex items-start gap-3 bg-purple-950 border border-purple-800 rounded-xl px-4 py-3">
              <Shield className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-purple-300 font-semibold text-sm">
                  HSA 2005 S.6(3) — Daughters are coparceners by birth
                </div>
                <div className="text-purple-500 text-xs mt-0.5">
                  Neeta Singh's share is equal to her brothers' — enforced at chaincode level. No officer override possible.
                </div>
              </div>
            </div>

            {/* Heir consent cards */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-gray-200">Heir Consent Status</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {consentCount} consented · {objectionCount} objected · {pendingCount} pending
                </span>
              </div>
              <div className="space-y-3">
                {heirs.map((heir) => (
                  <HeirCard
                    key={heir.heirId}
                    heir={heir}
                    onConsent={() => handleConsent(heir.heirId)}
                    onObject={() => setShowObjection(heir.heirId)}
                  />
                ))}
              </div>
            </div>

            {/* Resolution banner */}
            {allConsented && (
              <div className="flex items-center gap-4 bg-brand-950 border border-brand-700 rounded-xl px-5 py-4">
                <div className="w-10 h-10 rounded-full bg-brand-800 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-brand-300" />
                </div>
                <div>
                  <div className="text-brand-300 font-bold text-sm">Auto-Mutation Executing</div>
                  <div className="text-brand-500 text-xs mt-0.5">
                    All 3 heirs consented · Fabric transaction submitted · New title written to BhumiChain ledger ·
                    Ankur, Nitin &amp; Neeta each hold 1/3 Bhumidhari share
                  </div>
                </div>
                <CheckCircle className="w-6 h-6 text-brand-400 ml-auto shrink-0" />
              </div>
            )}

            {!allConsented && anyObjected && allResolved && (
              <div className="flex items-center gap-4 bg-red-950 border border-red-700 rounded-xl px-5 py-4">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <div className="text-red-300 font-bold text-sm">Objection Filed — Referred to Civil Court</div>
                  <div className="text-red-500 text-xs mt-0.5">
                    Case is now pending civil court adjudication. BhumiChain preserves all evidence immutably on-chain.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: info panel ───────────────────────────────────────── */}
          <div className="w-72 shrink-0 space-y-4">

            {/* Progress */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-semibold text-gray-200">Succession Pipeline</span>
              </div>
              <ol className="space-y-3 text-xs">
                {[
                  { label: 'CRS Death Certificate', done: true,    sub: caseData.crsRegistrationNo },
                  { label: 'CoparcenaryMapper AI',  done: true,    sub: `${Math.round(caseData.aiConfidenceScore * 100)}% confidence` },
                  { label: 'Heir Notifications',    done: true,    sub: 'SMS + WhatsApp dispatched' },
                  { label: 'Multi-sig Consent',     done: allConsented, sub: `${consentCount}/${heirs.length} consented` },
                  { label: 'Auto-Mutation',         done: allConsented, sub: allConsented ? 'Title updated on ledger' : 'Awaiting all consents' },
                ].map(({ label, done, sub }, i) => (
                  <li key={i} className="flex gap-2.5">
                    <div className={clsx(
                      'w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-mono',
                      done ? 'bg-brand-800 text-brand-300' : 'bg-gray-800 text-gray-500',
                    )}>
                      {done ? <CheckCircle className="w-3 h-3" /> : i + 1}
                    </div>
                    <div>
                      <div className={clsx('font-medium', done ? 'text-gray-200' : 'text-gray-500')}>{label}</div>
                      <div className="text-gray-600 mt-0.5">{sub}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Legal context */}
            <div className="card">
              <div className="flex items-center gap-1.5 mb-2">
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Legal Framework
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-2">
                <p>
                  <span className="text-purple-400 font-medium">Mitakshara coparcenary</span> — property devolves
                  by survivorship among coparceners (sons/daughters by birth).
                </p>
                <p>
                  After 2005 amendment, daughters are coparceners <span className="text-purple-400 font-medium">from birth</span>,
                  regardless of marriage. Equal 1/3 share for each heir here.
                </p>
                <p className="text-gray-600">
                  Ref: HSA 1956 S.6 as amended by The Hindu Succession (Amendment) Act, 2005.
                </p>
              </div>
            </div>

            {/* Share distribution */}
            <div className="card">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Share Distribution
              </div>
              <div className="space-y-2">
                {heirs.map((heir) => (
                  <div key={heir.heirId} className="flex items-center gap-2 text-xs">
                    <div
                      className="h-1.5 rounded-full bg-brand-600 shrink-0"
                      style={{ width: `${Math.round(heir.shareDecimal * 100)}%` }}
                    />
                    <span className="text-gray-300 shrink-0">{heir.share}</span>
                    <span className="text-gray-500 truncate">{heir.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function HeirCard({
  heir,
  onConsent,
  onObject,
}: {
  heir: SuccessionHeir;
  onConsent: () => void;
  onObject: () => void;
}) {
  return (
    <div className={clsx(
      'rounded-xl border p-4',
      heir.hasConsented  ? 'bg-brand-950 border-brand-800' :
      heir.hasObjected   ? 'bg-red-950 border-red-800' :
                           'bg-gray-800 border-gray-700',
    )}>
      <div className="flex items-start gap-3">
        <div className={clsx(
          'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
          heir.hasConsented ? 'bg-brand-800 text-brand-300' :
          heir.hasObjected  ? 'bg-red-900 text-red-300' :
                              'bg-gray-700 text-gray-300',
        )}>
          {heir.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-100">{heir.name}</span>
            <span className="text-xs text-gray-500">{heir.relation}</span>
            {heir.gender === 'Female' && (
              <span className="text-xs bg-purple-900 text-purple-300 px-1.5 py-0.5 rounded">
                HSA 2005
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span>Share: <span className="text-gray-300 font-mono">{heir.share}</span></span>
            <span>DOB: {format(new Date(heir.dob), 'dd MMM yyyy')}</span>
          </div>
          {heir.legalNote && (
            <div className="mt-1.5 text-xs text-purple-400 leading-relaxed">{heir.legalNote}</div>
          )}
          {heir.hasConsented && heir.consentedAt && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-brand-400">
              <CheckCircle className="w-3 h-3" />
              Consented at {format(new Date(heir.consentedAt), 'dd MMM yyyy, HH:mm')}
            </div>
          )}
          {heir.hasObjected && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
              <AlertTriangle className="w-3 h-3" />
              Objection filed — case in civil court
            </div>
          )}
        </div>
        {!heir.hasConsented && !heir.hasObjected && (
          <div className="flex flex-col gap-2 shrink-0">
            <button onClick={onConsent} className="btn-primary text-xs px-3 py-1.5">
              eSign Consent
            </button>
            <button
              onClick={onObject}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-700 text-red-400 hover:bg-red-950 transition-colors"
            >
              File Objection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ObjectionModal({
  heirName,
  reason,
  onReasonChange,
  onSubmit,
  onClose,
}: {
  heirName: string;
  reason: string;
  onReasonChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-gray-900 border border-red-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-red-950 border-b border-red-800 px-5 py-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <div>
            <div className="text-red-200 font-bold text-sm">File Objection</div>
            <div className="text-red-500 text-xs mt-0.5">{heirName}</div>
          </div>
          <button onClick={onClose} className="ml-auto text-red-500 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-xs text-gray-400 bg-gray-800 rounded-lg px-3 py-2">
            Filing an objection will halt the auto-mutation and refer this case to the Civil Court
            for adjudication. This action is recorded immutably on BhumiChain.
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Reason for Objection</label>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={4}
              placeholder="Describe the grounds for your objection (min. 10 characters)…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-500 resize-none"
            />
            <div className="text-xs text-gray-600 mt-1">{reason.length} / 10 minimum</div>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 text-sm py-2">Cancel</button>
            <button
              onClick={onSubmit}
              disabled={reason.trim().length < 10}
              className="flex-1 text-sm py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-colors"
            >
              Submit Objection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    HEIRS_IDENTIFIED:  { label: 'Heirs Identified', cls: 'bg-amber-900 text-amber-300' },
    AWAITING_CONSENTS: { label: 'Awaiting Consents', cls: 'bg-amber-900 text-amber-300' },
    AUTO_MUTATED:      { label: 'Auto-Mutated ✓', cls: 'bg-brand-900 text-brand-300' },
    OBJECTION_FILED:   { label: 'Objection Filed', cls: 'bg-red-900 text-red-300' },
    COURT_REFERRED:    { label: 'Court Referred', cls: 'bg-red-900 text-red-300' },
  };
  const { label, cls } = (map as Record<string, { label: string; cls: string }>)[status] ?? { label: status, cls: 'bg-gray-800 text-gray-400' };
  return (
    <span className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full', cls)}>
      {label}
    </span>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-500 shrink-0 text-sm">{label}</span>
      <span className={clsx('text-gray-200 text-right break-all text-sm', mono && 'font-mono text-xs')}>
        {value}
      </span>
    </div>
  );
}
