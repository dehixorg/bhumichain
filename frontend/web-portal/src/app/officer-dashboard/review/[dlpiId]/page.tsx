'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle, Clock, AlertTriangle, Shield, FileText,
  MapPin, XCircle, Zap, ChevronRight, RotateCcw, Eye,
} from 'lucide-react';
import clsx from 'clsx';
import Sidebar from '@/components/dashboard/Sidebar';
import { getUser, apiFetch, submitESign, type JWTUser } from '@/lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Parcel {
  dlpiId:            string;
  khataNo:           string;
  khasraNo:          string;
  tehsil:            string;
  district:          string;
  landType:          string;
  landTypeDesc:      string;
  areaHectares:      number;
  encumbranceStatus: string;
  claimStatus:       string;
  ownerName:         string;
  ownerAadhaarHash:  string;
  location:          { latitude: number; longitude: number };
  valuation:         { circleRateINR: number };
  isTribal?:         boolean;
  isCoparcenary?:    boolean;
  disputeNote?:      string;
  updatedAt:         string;
}

interface QueueItem {
  dlpiId:      string;
  ownerName:   string;
  gram:        string;
  tehsil:      string;
  claimStatus: string;
  submittedAt: string;
  claimedAt:   string;
  eSignTxHash: string;
  patwariName: string;
  scanId:      string | null;
  isTribal:    boolean;
  officerNotes: string;
  verificationChecklist: {
    physicalInspection: boolean;
    documentVerified:   boolean;
    boundaryConfirmed:  boolean;
    encumbranceClear:   boolean;
  };
}

// ── Timeline ──────────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'SEEDED_UNVERIFIED', label: 'Seeded',          sub: 'Record in BhumiChain' },
  { key: 'CLAIM_SUBMITTED',   label: 'Claim Submitted', sub: 'eSign by citizen' },
  { key: 'UNDER_REVIEW',      label: 'Under Review',    sub: 'Patwari field visit' },
  { key: 'CI_APPROVED',       label: 'CI Approved',     sub: 'Circle Inspector sign-off' },
  { key: 'VERIFIED',          label: 'Verified',        sub: 'Tehsildar final approval' },
];

const ORDER = ['SEEDED_UNVERIFIED', 'CLAIM_SUBMITTED', 'UNDER_REVIEW', 'CI_APPROVED', 'VERIFIED'];

function Timeline({ status }: { status: string }) {
  const currentIdx = ORDER.indexOf(status);
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const done    = i < currentIdx;
        const active  = i === currentIdx;
        const isLast  = i === STEPS.length - 1;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center min-w-0">
              <div className={clsx(
                'w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors',
                done   ? 'bg-brand-600 border-brand-600'  : '',
                active ? 'bg-brand-900 border-brand-400 ring-2 ring-brand-400/30' : '',
                !done && !active ? 'bg-gray-900 border-gray-700' : '',
              )}>
                {done
                  ? <CheckCircle className="w-4 h-4 text-white" />
                  : active
                    ? <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                    : <div className="w-2 h-2 rounded-full bg-gray-700" />
                }
              </div>
              <div className={clsx(
                'mt-1.5 text-xs font-semibold text-center whitespace-nowrap',
                done ? 'text-brand-400' : active ? 'text-gray-200' : 'text-gray-600',
              )}>
                {step.label}
              </div>
              <div className="text-xs text-gray-600 text-center whitespace-nowrap hidden sm:block">{step.sub}</div>
            </div>
            {!isLast && (
              <div className={clsx(
                'flex-1 h-0.5 mx-1 mb-5',
                done ? 'bg-brand-600' : 'bg-gray-800',
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Checklist ─────────────────────────────────────────────────────────────────

const CHECKLIST_LABELS: Record<string, string> = {
  physicalInspection: 'Physical site inspection done',
  documentVerified:   'Original documents verified',
  boundaryConfirmed:  'Field boundary confirmed',
  encumbranceClear:   'Encumbrance check clear',
};

function ChecklistPanel({
  checklist,
  onChange,
  readOnly,
}: {
  checklist: Record<string, boolean>;
  onChange: (key: string, value: boolean) => void;
  readOnly: boolean;
}) {
  return (
    <div className="space-y-2">
      {Object.entries(CHECKLIST_LABELS).map(([key, label]) => (
        <label
          key={key}
          className={clsx(
            'flex items-center gap-3 p-3 rounded-xl border transition-colors',
            checklist[key]
              ? 'bg-green-900/20 border-green-700 text-green-300'
              : 'bg-gray-900 border-gray-800 text-gray-400',
            !readOnly && 'cursor-pointer hover:border-gray-600',
          )}
        >
          <input
            type="checkbox"
            checked={checklist[key] ?? false}
            disabled={readOnly}
            onChange={e => onChange(key, e.target.checked)}
            className="accent-brand-500"
          />
          <span className="text-sm font-medium">{label}</span>
          {checklist[key] && <CheckCircle className="w-4 h-4 ml-auto" />}
        </label>
      ))}
    </div>
  );
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

function RejectModal({
  onConfirm,
  onCancel,
  busy,
}: {
  onConfirm: (reason: string) => void;
  onCancel:  () => void;
  busy:      boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <XCircle className="w-5 h-5 text-red-400" />
          <h3 className="text-gray-100 font-semibold">Reject Claim</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          State the reason for rejection. The citizen will be notified and may reapply.
        </p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Document mismatch — Aadhaar name differs from Khatauni record. Claimant should visit tehsil office with original papers."
          rows={4}
          maxLength={500}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm resize-none focus:outline-none focus:border-brand-500"
        />
        <div className="text-xs text-gray-600 text-right mt-1">{reason.length}/500</div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={busy || reason.trim().length < 10}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-700 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
          >
            {busy ? 'Rejecting…' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── eSign Modal (Tehsildar) ───────────────────────────────────────────────────

function ESignModal({
  dlpiId,
  onSuccess,
  onCancel,
}: {
  dlpiId:    string;
  onSuccess: (hash: string) => void;
  onCancel:  () => void;
}) {
  const [aadhaar, setAadhaar]     = useState('');
  const [otp, setOtp]             = useState('');
  const [otpSent, setOtpSent]     = useState(false);
  const [busy, setBusy]           = useState(false);
  const [err, setErr]             = useState('');

  async function sendOtp() {
    setErr('');
    setBusy(true);
    try {
      const res = await apiFetch('/api/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ aadhaarNumber: aadhaar }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'OTP failed');
      setOtpSent(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'OTP request failed');
    } finally {
      setBusy(false);
    }
  }

  async function sign() {
    setErr('');
    setBusy(true);
    try {
      const { eSignTxHash } = await submitESign(
        aadhaar,
        otp,
        `Tehsildar final approval — DLPI ${dlpiId}`,
      );
      onSuccess(eSignTxHash);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'eSign failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-5 h-5 text-brand-400" />
          <h3 className="text-gray-100 font-semibold">Tehsildar eSign — Final Approval</h3>
        </div>
        <p className="text-sm text-gray-400 mb-5">
          eSign will record SHA-256(aadhaarHash:otp:action:timestamp) on-chain as irrevocable consent proof. DPDPA 2023 compliant — raw Aadhaar not stored.
        </p>

        {!otpSent ? (
          <>
            <label className="block text-xs text-gray-400 mb-1">Your Aadhaar (12-digit)</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={12}
              value={aadhaar}
              onChange={e => setAadhaar(e.target.value.replace(/\D/g, ''))}
              placeholder="9999 0001 0011"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm focus:outline-none focus:border-brand-500 font-mono tracking-widest"
            />
            {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-gray-800 text-gray-300 hover:bg-gray-700">Cancel</button>
              <button
                onClick={sendOtp}
                disabled={busy || aadhaar.length !== 12}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Send OTP'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-green-400 mb-3">OTP sent to registered mobile. Demo: use 123456</p>
            <label className="block text-xs text-gray-400 mb-1">Enter OTP</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="• • • • • •"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm focus:outline-none focus:border-brand-500 font-mono tracking-widest text-center"
            />
            {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setOtpSent(false); setOtp(''); }} className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-gray-800 text-gray-300 hover:bg-gray-700">Back</button>
              <button
                onClick={sign}
                disabled={busy || otp.length !== 6}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
              >
                {busy ? 'Signing…' : 'eSign & Verify'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Action Panel ──────────────────────────────────────────────────────────────

function ActionPanel({
  dlpiId,
  claimStatus,
  userRole,
  checklist,
  onActionDone,
}: {
  dlpiId:       string;
  claimStatus:  string;
  userRole:     string;
  checklist:    Record<string, boolean>;
  onActionDone: (newStatus: string) => void;
}) {
  const [showReject, setShowReject] = useState(false);
  const [showESign, setShowESign]   = useState(false);
  const [busy, setBusy]             = useState(false);
  const [err, setErr]               = useState('');

  const allChecked = Object.values(checklist).every(Boolean);

  async function postAction(endpoint: string, body?: object) {
    setBusy(true);
    setErr('');
    try {
      const res = await apiFetch(`/api/dlpi/${dlpiId}${endpoint}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Action failed');
      return data;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Request failed');
      return null;
    } finally {
      setBusy(false);
    }
  }

  // Patwari → send to CI
  async function handleSubmitForReview() {
    const data = await postAction('/submit-for-review');
    if (data) onActionDone('UNDER_REVIEW');
  }

  // CI → approve
  async function handleCIApprove() {
    const data = await postAction('/ci-review', { approved: true });
    if (data) onActionDone('CI_APPROVED');
  }

  // Tehsildar → final approve (needs eSign)
  async function handleTehsildarApprove(eSignTxHash: string) {
    setShowESign(false);
    const data = await postAction('/tehsildar-approve', { eSignTxHash });
    if (data) onActionDone('VERIFIED');
  }

  // Reject
  async function handleReject(reason: string) {
    const data = await postAction('/reject', { reason });
    if (data) { setShowReject(false); onActionDone('REJECTED'); }
  }

  // Determine what this officer can do
  const canAct = {
    patwari:          claimStatus === 'CLAIM_SUBMITTED',
    circle_inspector: claimStatus === 'UNDER_REVIEW',
    tehsildar:        claimStatus === 'CI_APPROVED',
    kotwal:           ['CLAIM_SUBMITTED', 'UNDER_REVIEW', 'CI_APPROVED'].includes(claimStatus),
  }[userRole] ?? false;

  if (!canAct) {
    return (
      <div className="card">
        <div className="flex items-center gap-3 text-gray-500 text-sm">
          <Eye className="w-4 h-4" />
          <span>This item is not in your action queue. Viewing in read-only mode.</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {showReject && (
        <RejectModal
          onConfirm={handleReject}
          onCancel={() => setShowReject(false)}
          busy={busy}
        />
      )}
      {showESign && (
        <ESignModal
          dlpiId={dlpiId}
          onSuccess={handleTehsildarApprove}
          onCancel={() => setShowESign(false)}
        />
      )}

      <div className="card space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
          <Zap className="w-4 h-4 text-brand-400" />
          Officer Action
        </div>

        {err && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/30 border border-red-700 text-red-300 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {err}
          </div>
        )}

        {/* Checklist warning */}
        {!allChecked && (userRole === 'patwari' || userRole === 'circle_inspector') && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-900/20 border border-yellow-800 text-yellow-400 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            Complete the verification checklist before approving to maintain audit trail.
          </div>
        )}

        {/* Patwari */}
        {userRole === 'patwari' && claimStatus === 'CLAIM_SUBMITTED' && (
          <button
            onClick={handleSubmitForReview}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-colors disabled:opacity-50"
          >
            {busy ? <RotateCcw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            {busy ? 'Submitting…' : 'Send to Circle Inspector'}
          </button>
        )}

        {/* CI */}
        {userRole === 'circle_inspector' && claimStatus === 'UNDER_REVIEW' && (
          <button
            onClick={handleCIApprove}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-colors disabled:opacity-50"
          >
            {busy ? <RotateCcw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {busy ? 'Approving…' : 'CI Approve — Send to Tehsildar'}
          </button>
        )}

        {/* Tehsildar */}
        {userRole === 'tehsildar' && claimStatus === 'CI_APPROVED' && (
          <button
            onClick={() => setShowESign(true)}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-700 hover:bg-green-600 text-white font-semibold transition-colors disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            Final Approve with eSign → VERIFIED
          </button>
        )}

        {/* Reject (all roles) */}
        <button
          onClick={() => setShowReject(true)}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-800 hover:bg-red-900/30 border border-gray-700 hover:border-red-700 text-gray-400 hover:text-red-400 text-sm font-medium transition-colors disabled:opacity-50"
        >
          <XCircle className="w-4 h-4" />
          Reject Claim
        </button>

        <p className="text-xs text-gray-600 text-center">
          All actions are recorded on Hyperledger Fabric. Immutable audit trail.
        </p>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const params = useParams<{ dlpiId: string }>();
  const router = useRouter();
  const dlpiId = params?.dlpiId ?? '';

  const [user, setUser]       = useState<JWTUser | null>(null);
  const [parcel, setParcel]   = useState<Parcel | null>(null);
  const [queueItem, setQueueItem] = useState<QueueItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    physicalInspection: false,
    documentVerified:   false,
    boundaryConfirmed:  false,
    encumbranceClear:   false,
  });
  const [notes, setNotes]     = useState('');
  const [actionDone, setActionDone] = useState('');

  useEffect(() => {
    if (!dlpiId) return;
    const u = getUser();
    if (!u) { router.replace('/login'); return; }
    if (u.role === 'citizen') { router.replace('/my-parcels'); return; }
    setUser(u);
    loadData();
  }, [dlpiId]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [parcelRes, queueRes] = await Promise.all([
        apiFetch(`/api/dlpi/${dlpiId}`),
        apiFetch('/api/dlpi/pending-review'),
      ]);
      const parcelData = await parcelRes.json();
      const queueData  = await queueRes.json();

      if (!parcelRes.ok) throw new Error(parcelData.message || parcelData.error || 'Parcel not found');
      setParcel(parcelData);

      const qi = (Array.isArray(queueData) ? queueData : []).find((q: QueueItem) => q.dlpiId === dlpiId);
      if (qi) {
        setQueueItem(qi);
        setChecklist(qi.verificationChecklist ?? checklist);
        setNotes(qi.officerNotes ?? '');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  function handleChecklistChange(key: string, value: boolean) {
    setChecklist(prev => ({ ...prev, [key]: value }));
  }

  function handleActionDone(newStatus: string) {
    setActionDone(newStatus);
    if (parcel) setParcel({ ...parcel, claimStatus: newStatus });
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-950 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-gray-500 animate-pulse">Loading parcel…</div>
        </main>
      </div>
    );
  }

  if (error || !parcel) {
    return (
      <div className="flex h-screen bg-gray-950 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-300">{error || 'Parcel not found'}</p>
            <Link href="/officer-dashboard" className="text-brand-400 text-sm mt-3 inline-block">← Back to Queue</Link>
          </div>
        </main>
      </div>
    );
  }

  const isVerified  = parcel.claimStatus === 'VERIFIED';
  const isRejected  = parcel.claimStatus === 'REJECTED';
  const isFinalized = isVerified || isRejected || actionDone !== '';

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex items-center gap-4">
            <Link
              href="/officer-dashboard"
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Officer Queue
            </Link>
            <span className="text-gray-700">/</span>
            <span className="font-mono text-brand-400 text-sm font-semibold">{dlpiId}</span>
          </div>

          {/* Action done banner */}
          {actionDone && (
            <div className={clsx(
              'flex items-center gap-3 p-4 rounded-xl border text-sm font-semibold',
              actionDone === 'VERIFIED'
                ? 'bg-green-900/30 border-green-700 text-green-300'
                : actionDone === 'REJECTED'
                  ? 'bg-red-900/30 border-red-700 text-red-300'
                  : 'bg-blue-900/30 border-blue-700 text-blue-300',
            )}>
              <CheckCircle className="w-5 h-5 shrink-0" />
              <div>
                Status updated to <strong>{actionDone.replace('_', ' ')}</strong>.
                Transaction recorded on Hyperledger Fabric.
                <Link href="/officer-dashboard" className="ml-3 underline text-xs opacity-80">Back to Queue →</Link>
              </div>
            </div>
          )}

          {/* Two-column layout */}
          <div className="grid grid-cols-3 gap-6">

            {/* Left: parcel details (2/3) */}
            <div className="col-span-2 space-y-5">

              {/* Parcel card */}
              <div className="card space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-brand-400 text-xs font-semibold tracking-wide">{parcel.dlpiId}</div>
                    <div className="text-xl font-bold text-gray-100 mt-1">{parcel.ownerName || queueItem?.ownerName}</div>
                    <div className="flex items-center gap-1 text-gray-500 text-sm mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {queueItem?.gram ?? '—'}, {parcel.tehsil}, {parcel.district}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {parcel.isTribal && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-900/40 border border-amber-700 text-amber-400 text-xs font-semibold">
                        <Shield className="w-3 h-3" />Schedule V
                      </span>
                    )}
                    {parcel.isCoparcenary && (
                      <span className="px-2 py-1 rounded-full bg-purple-900/40 border border-purple-700 text-purple-400 text-xs font-semibold">
                        Coparcenary
                      </span>
                    )}
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    ['Khasra No.',   parcel.khasraNo],
                    ['Khata No.',    parcel.khataNo],
                    ['Land Type',    parcel.landType],
                    ['Area',         `${parcel.areaHectares} ha`],
                    ['Encumbrance',  parcel.encumbranceStatus],
                    ['eSign TX',     queueItem?.eSignTxHash ? queueItem.eSignTxHash.slice(0, 18) + '…' : '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-800 rounded-xl px-3 py-2.5">
                      <div className="text-gray-500 mb-0.5">{label}</div>
                      <div className={clsx(
                        'font-medium font-mono text-xs',
                        value === 'CLEAR' ? 'text-green-400' : value === 'MORTGAGED' ? 'text-yellow-400' : 'text-gray-200',
                      )}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {queueItem?.scanId && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-800 border border-gray-700 text-xs text-gray-400">
                    <FileText className="w-3.5 h-3.5 text-brand-400" />
                    Scan record: <span className="font-mono text-gray-300">{queueItem.scanId}</span>
                    <span className="ml-auto text-brand-400">RecordScan AI</span>
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="card">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Verification Pipeline</div>
                <Timeline status={actionDone || parcel.claimStatus} />
              </div>

              {/* Verification Checklist */}
              <div className="card space-y-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Verification Checklist</div>
                <ChecklistPanel
                  checklist={checklist}
                  onChange={handleChecklistChange}
                  readOnly={isFinalized}
                />
              </div>

              {/* Officer Notes */}
              <div className="card space-y-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Field Notes</div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  disabled={isFinalized}
                  placeholder="Add notes about physical inspection, boundary observations, document discrepancies…"
                  rows={3}
                  maxLength={500}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm resize-none focus:outline-none focus:border-brand-500 disabled:opacity-50"
                />
                {queueItem?.officerNotes && notes === queueItem.officerNotes && (
                  <p className="text-xs text-gray-600">Notes from previous review by {queueItem.patwariName}.</p>
                )}
              </div>
            </div>

            {/* Right: action panel (1/3) */}
            <div className="space-y-4">
              {/* Officer context */}
              {user && (
                <div className="card !py-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Reviewing As</div>
                  <div className="text-gray-200 font-semibold">{user.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {(({ tehsildar: 'Tehsildar', circle_inspector: 'Kanungo / CI', patwari: 'Patwari' } as Record<string, string>)[user.role] ?? user.role)}
                    {' · '}Dadri
                  </div>
                  <div className="mt-3 text-xs text-gray-600">
                    Submitted: {queueItem ? new Date(queueItem.submittedAt).toLocaleDateString('en-IN') : '—'}
                  </div>
                  {queueItem?.claimedAt && (
                    <div className="text-xs text-gray-600">
                      Claimed: {new Date(queueItem.claimedAt).toLocaleDateString('en-IN')}
                    </div>
                  )}
                </div>
              )}

              {/* Action panel */}
              {!isFinalized ? (
                <ActionPanel
                  dlpiId={dlpiId}
                  claimStatus={parcel.claimStatus}
                  userRole={user?.role ?? 'patwari'}
                  checklist={checklist}
                  onActionDone={handleActionDone}
                />
              ) : (
                <div className={clsx(
                  'card text-center space-y-2',
                  isVerified ? 'border-green-700 bg-green-900/10' : 'border-red-700 bg-red-900/10',
                )}>
                  {isVerified
                    ? <CheckCircle className="w-8 h-8 text-green-400 mx-auto" />
                    : <XCircle className="w-8 h-8 text-red-400 mx-auto" />
                  }
                  <div className={clsx('font-semibold', isVerified ? 'text-green-300' : 'text-red-300')}>
                    {isVerified ? 'VERIFIED on BhumiChain' : 'Claim Rejected'}
                  </div>
                  <p className="text-xs text-gray-500">
                    {isVerified ? 'Title recorded as DLPI on Hyperledger Fabric. Immutable.' : 'Citizen notified. Can reapply after 30 days.'}
                  </p>
                </div>
              )}

              {/* Map link */}
              <Link
                href={`/map?dlpi=${dlpiId}`}
                className="flex items-center justify-between p-3 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-600 transition-colors text-sm text-gray-400 hover:text-gray-200"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-400" />
                  View on GIS Map
                </div>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
