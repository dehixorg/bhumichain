'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, CheckCircle, Clock, AlertTriangle, Shield,
  Lock, ChevronRight, MapPin, FileText, XCircle,
} from 'lucide-react';
import clsx from 'clsx';
import AadhaarInput from '@/components/auth/AadhaarInput';
import OTPInput from '@/components/auth/OTPInput';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  getUser, apiFetch, requestOTP, submitESign,
} from '@/lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Parcel {
  dlpiId:            string;
  khataNo:           string;
  khasraNo:          string;
  tehsil:            string;
  district:          string;
  state:             string;
  landType:          string;
  landTypeDesc:      string;
  areaHectares:      number;
  encumbranceStatus: string;
  claimStatus:       string;
  disputeNote?:      string;
  isTribal?:         boolean;
  isCoparcenary?:    boolean;
  location:          { latitude: number; longitude: number };
  valuation:         { circleRateINR: number };
  mutationHistory?:  { type: string; date: string; officerName: string; mutationNo: string }[];
  coparcenary?:      { heirs: { name: string; relation: string; share: string }[]; coparcenaryType: string };
  tribalProtection?: { scheduleType: string; fraPatteNumber: string; gramSabhaVillage: string };
  updatedAt?:        string;
}

// ── Status timeline ───────────────────────────────────────────────────────────

const TIMELINE_STEPS = [
  { key: 'SEEDED_UNVERIFIED', label: 'Record Seeded' },
  { key: 'CLAIM_SUBMITTED',   label: 'Claim Submitted' },
  { key: 'UNDER_REVIEW',      label: 'Under Review' },
  { key: 'CI_APPROVED',       label: 'CI Approved' },
  { key: 'VERIFIED',          label: 'Verified' },
];

const STATUS_ORDER = ['SEEDED_UNVERIFIED', 'CLAIM_SUBMITTED', 'UNDER_REVIEW', 'CI_APPROVED', 'VERIFIED'];

function Timeline({ status }: { status: string }) {
  const currentIdx = STATUS_ORDER.indexOf(status);
  if (status === 'DISPUTED' || status === 'REJECTED') return null;

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Verification Progress</h3>
      <div className="relative">
        {/* Track */}
        <div className="absolute left-3.5 top-0 bottom-0 w-0.5 bg-gray-800" />
        <div className="space-y-5">
          {TIMELINE_STEPS.map((step, i) => {
            const done   = i <= currentIdx;
            const active = i === currentIdx;
            return (
              <div key={step.key} className="flex items-center gap-4 relative">
                <div className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 border-2',
                  done
                    ? active
                      ? 'bg-brand-600 border-brand-500 text-white'
                      : 'bg-brand-900 border-brand-700 text-brand-400'
                    : 'bg-gray-900 border-gray-700 text-gray-600',
                )}>
                  {done && !active
                    ? <CheckCircle className="w-4 h-4" />
                    : active
                    ? <Clock className="w-4 h-4" />
                    : <div className="w-2 h-2 rounded-full bg-current" />
                  }
                </div>
                <span className={clsx(
                  'text-sm',
                  done ? active ? 'text-brand-400 font-semibold' : 'text-gray-300' : 'text-gray-600',
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── eSign Claim Form ──────────────────────────────────────────────────────────

function ESignClaimForm({
  dlpiId,
  onSuccess,
}: {
  dlpiId: string;
  onSuccess: () => void;
}) {
  const [step, setStep]         = useState<'aadhaar' | 'otp' | 'done'>('aadhaar');
  const [aadhaar, setAadhaar]   = useState('');
  const [otp, setOtp]           = useState('');
  const [maskedPhone, setMasked] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const isDev = process.env.NEXT_PUBLIC_FABRIC_MODE === 'mock';

  async function handleSendOTP() {
    if (aadhaar.replace(/\D/g, '').length !== 12) {
      setError('Enter your 12-digit Aadhaar number'); return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await requestOTP(aadhaar);
      setMasked(res.maskedPhone);
      setStep('otp');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleClaimWithESign() {
    if (otp.replace(/\D/g, '').length !== 6) {
      setError('Enter the 6-digit OTP'); return;
    }
    setError('');
    setLoading(true);
    try {
      const { eSignTxHash } = await submitESign(
        aadhaar,
        otp,
        `Claim ownership of land parcel ${dlpiId} on BhumiChain`,
      );
      const res  = await apiFetch(`/api/dlpi/${dlpiId}/claim`, {
        method: 'POST',
        body:   JSON.stringify({ eSignTxHash }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Claim failed');
      setStep('done');
      setTimeout(onSuccess, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Claim failed');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="card flex flex-col items-center gap-3 py-6">
        <CheckCircle className="w-10 h-10 text-green-400" />
        <p className="text-green-300 font-semibold">Claim submitted successfully!</p>
        <p className="text-gray-400 text-sm text-center">Your eSign is recorded on BhumiChain. A patwari will verify your claim.</p>
      </div>
    );
  }

  return (
    <div className="card space-y-5">
      <div>
        <h3 className="font-semibold text-gray-200">Claim Ownership</h3>
        <p className="text-sm text-gray-400 mt-1">
          Your Aadhaar OTP serves as a legal eSign under the IT Act 2000. It is never stored — only a cryptographic hash is recorded on-chain.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900 bg-opacity-30 border border-red-700 text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {step === 'aadhaar' ? (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Aadhaar Number <span className="text-gray-500">(for eSign only)</span>
            </label>
            <AadhaarInput value={aadhaar} onChange={setAadhaar} disabled={loading} />
          </div>
          <button
            onClick={handleSendOTP}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Lock className="w-4 h-4" /> Send OTP for eSign</>
            }
          </button>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              OTP sent to <span className="text-brand-400">{maskedPhone}</span>
            </label>
            <OTPInput value={otp} onChange={setOtp} disabled={loading} error={!!error} />
            {isDev && (
              <p className="text-xs text-saffron-400">Demo mode: OTP is always <strong>123456</strong></p>
            )}
          </div>
          <button
            onClick={handleClaimWithESign}
            disabled={loading || otp.length < 6}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><CheckCircle className="w-4 h-4" /> Sign &amp; Claim Parcel</>
            }
          </button>
          <button onClick={() => { setStep('aadhaar'); setOtp(''); setError(''); }} className="w-full text-sm text-gray-400 hover:text-gray-200">
            ← Change Aadhaar
          </button>
        </>
      )}

      <div className="flex items-start gap-2 text-xs text-gray-500 pt-1 border-t border-gray-800">
        <Lock className="w-3 h-3 mt-0.5 shrink-0" />
        DPDPA 2023 compliant: raw Aadhaar number is not transmitted or stored. Only SHA-256(Aadhaar + salt) is recorded on-chain as eSignTxHash.
      </div>
    </div>
  );
}

// ── Submit-for-review button ──────────────────────────────────────────────────

function SubmitReviewButton({ dlpiId, onSuccess }: { dlpiId: string; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handle() {
    setLoading(true);
    setError('');
    try {
      const res  = await apiFetch(`/api/dlpi/${dlpiId}/submit-for-review`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed');
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <h3 className="font-semibold text-gray-200">Next Step: Field Verification</h3>
        <p className="text-sm text-gray-400 mt-1">
          Submit your claim for patwari field verification. The patwari will visit the site and verify your possession.
        </p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        onClick={handle}
        disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {loading
          ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <><ChevronRight className="w-4 h-4" /> Submit for Field Review</>
        }
      </button>
    </div>
  );
}

// ── Dispute Form ──────────────────────────────────────────────────────────────

function DisputeForm({ dlpiId, onSuccess }: { dlpiId: string; onSuccess: () => void }) {
  const [open, setOpen]       = useState(false);
  const [reason, setReason]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  async function handleDispute() {
    if (!reason.trim()) { setError('Please describe your dispute'); return; }
    setLoading(true);
    setError('');
    try {
      const res  = await apiFetch(`/api/dlpi/${dlpiId}/dispute`, {
        method: 'POST',
        body:   JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Dispute failed');
      setDone(true);
      setTimeout(onSuccess, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Dispute submission failed');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2.5 rounded-xl border border-red-800 text-red-400 hover:bg-red-900 hover:bg-opacity-20 text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        <AlertTriangle className="w-4 h-4" />
        Raise a Dispute on this Parcel
      </button>
    );
  }

  if (done) {
    return (
      <div className="card flex items-center gap-3 text-green-300">
        <CheckCircle className="w-5 h-5 shrink-0" />
        Dispute submitted. A 30-day public notice period begins now.
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div>
        <h3 className="font-semibold text-red-400">Raise Dispute</h3>
        <p className="text-xs text-gray-500 mt-1">
          A 30-day public notice will be issued. The parcel will be locked until resolution.
        </p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Describe your dispute: boundary issue, ownership conflict, fraud, etc."
        rows={4}
        maxLength={1000}
        className="input w-full resize-none text-sm"
      />
      <p className="text-right text-xs text-gray-600">{reason.length}/1000</p>
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="btn-ghost flex-1">Cancel</button>
        <button
          onClick={handleDispute}
          disabled={loading || !reason.trim()}
          className="btn-danger flex-1 flex items-center justify-center gap-2"
        >
          {loading
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : 'Submit Dispute'
          }
        </button>
      </div>
    </div>
  );
}

// ── Parcel detail section ─────────────────────────────────────────────────────

function ParcelDetail({ parcel }: { parcel: Parcel }) {
  function formatArea(ha: number) {
    return ha < 0.1 ? `${(ha * 10000).toFixed(0)} sq.m` : `${ha.toFixed(3)} ha`;
  }
  function formatValue(n: number) {
    return n >= 1_00_00_000 ? `₹${(n / 1_00_00_000).toFixed(2)} Cr` : `₹${(n / 1_00_000).toFixed(1)} L`;
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-brand-400 text-sm font-semibold">{parcel.dlpiId}</div>
          <div className="text-gray-200 font-semibold mt-1">Khasra {parcel.khasraNo}</div>
          <div className="flex items-center gap-1 text-gray-500 text-xs mt-0.5">
            <MapPin className="w-3 h-3" />
            {parcel.tehsil}, {parcel.district}, {parcel.state}
          </div>
        </div>
        <Link
          href={`/map?dlpi=${parcel.dlpiId}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors"
        >
          <MapPin className="w-3 h-3" />
          View on Map
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {[
          { label: 'Land Type',    value: parcel.landType },
          { label: 'Area',         value: formatArea(parcel.areaHectares) },
          { label: 'Circle Rate',  value: formatValue(parcel.valuation.circleRateINR) },
          { label: 'Encumbrance',  value: parcel.encumbranceStatus.replace('_', ' '),
            color: parcel.encumbranceStatus === 'CLEAR' ? 'text-green-400' : 'text-red-400' },
          { label: 'Lat/Lon',      value: `${parcel.location.latitude.toFixed(4)}, ${parcel.location.longitude.toFixed(4)}` },
          { label: 'Khata No.',    value: parcel.khataNo },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-800 rounded-lg px-3 py-2">
            <div className="text-gray-500">{label}</div>
            <div className={clsx('font-medium mt-0.5', color ?? 'text-gray-200')}>{value}</div>
          </div>
        ))}
      </div>

      {parcel.isTribal && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-900 bg-opacity-20 border border-amber-800 text-xs">
          <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-amber-400 font-semibold">Schedule V Protected — TribalGuard Active</span>
            {parcel.tribalProtection && (
              <p className="text-amber-600 mt-0.5">
                FRA Patte: {parcel.tribalProtection.fraPatteNumber} · Gram Sabha: {parcel.tribalProtection.gramSabhaVillage}
              </p>
            )}
          </div>
        </div>
      )}

      {parcel.mutationHistory && parcel.mutationHistory.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Mutation History</div>
          <div className="space-y-2">
            {parcel.mutationHistory.map((m, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-600 mt-1.5 shrink-0" />
                <div>
                  <span className="text-gray-300">{m.type}</span>
                  <span className="text-gray-500 mx-1.5">·</span>
                  <span className="text-gray-500">{m.date}</span>
                  <span className="text-gray-500 mx-1.5">·</span>
                  <span className="text-gray-600">{m.officerName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClaimPage() {
  const router   = useRouter();
  const params   = useParams<{ dlpiId: string }>();
  const dlpiId   = params?.dlpiId ?? '';

  const [parcel, setParcel]   = useState<Parcel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!dlpiId) return;
    const user = getUser();
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'citizen') { router.replace('/dashboard'); return; }
    loadParcel();
  }, [dlpiId]);

  async function loadParcel() {
    setLoading(true);
    setError('');
    try {
      const res  = await apiFetch(`/api/dlpi/${dlpiId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error === 'DLPI_NOT_FOUND' ? 'Parcel not found' : data.message || 'Failed to load parcel');
      setParcel(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load parcel');
    } finally {
      setLoading(false);
    }
  }

  function refresh() { loadParcel(); }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

          {/* Back */}
          <Link
            href="/my-parcels"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            My Parcels
          </Link>

          {/* Loading */}
          {loading && (
            <div className="card animate-pulse space-y-4">
              <div className="h-5 w-48 bg-gray-700 rounded" />
              <div className="h-4 w-32 bg-gray-700 rounded" />
              <div className="grid grid-cols-3 gap-2">
                {[0,1,2,3,4,5].map(i => <div key={i} className="h-12 bg-gray-800 rounded-lg" />)}
              </div>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="card flex flex-col items-center gap-3 py-10 text-center">
              <XCircle className="w-10 h-10 text-red-400" />
              <p className="text-red-300 font-semibold">{error}</p>
              <button onClick={loadParcel} className="btn-ghost text-sm">Try again</button>
            </div>
          )}

          {!loading && !error && parcel && (
            <>
              {/* Page title */}
              <div>
                <h1 className="text-xl font-bold text-gray-100">
                  {parcel.claimStatus === 'SEEDED_UNVERIFIED' ? 'Claim Your Land' :
                   parcel.claimStatus === 'VERIFIED'          ? 'Verified Parcel' :
                   parcel.claimStatus === 'DISPUTED'          ? 'Disputed Parcel' :
                   'Parcel Details'}
                </h1>
                <p className="text-gray-400 text-sm mt-1 font-mono">{parcel.dlpiId}</p>
              </div>

              {/* Parcel info */}
              <ParcelDetail parcel={parcel} />

              {/* Status timeline */}
              <Timeline status={parcel.claimStatus} />

              {/* Disputed notice */}
              {parcel.claimStatus === 'DISPUTED' && (
                <div className="card border-red-800 bg-red-900 bg-opacity-10 space-y-2">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-semibold">Dispute Active</span>
                  </div>
                  <p className="text-sm text-gray-400">{parcel.disputeNote || 'A dispute has been raised on this parcel. Contact your Patwari (Vijay Singh, DAD-P1) for resolution.'}</p>
                  <p className="text-xs text-gray-600">Parcel locked until dispute is resolved. 30-day notice period applies.</p>
                </div>
              )}

              {/* VERIFIED state */}
              {parcel.claimStatus === 'VERIFIED' && (
                <div className="card border-green-800 bg-green-900 bg-opacity-10 space-y-3">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">Ownership Verified on BhumiChain</span>
                  </div>
                  <p className="text-sm text-gray-400">Your ownership is recorded as a tamper-proof entry on Hyperledger Fabric.</p>
                  <div className="flex gap-2 pt-1">
                    <Link href={`/ec/${parcel.dlpiId}`} className="btn-primary flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4" />
                      Get Encumbrance Certificate
                    </Link>
                    <Link href={`/transfer?dlpi=${parcel.dlpiId}`} className="btn-ghost text-sm">
                      Initiate Transfer
                    </Link>
                  </div>
                </div>
              )}

              {/* Claim form — SEEDED_UNVERIFIED only */}
              {parcel.claimStatus === 'SEEDED_UNVERIFIED' && (
                <ESignClaimForm dlpiId={parcel.dlpiId} onSuccess={refresh} />
              )}

              {/* Submit for review — CLAIM_SUBMITTED */}
              {parcel.claimStatus === 'CLAIM_SUBMITTED' && (
                <SubmitReviewButton dlpiId={parcel.dlpiId} onSuccess={refresh} />
              )}

              {/* Under review / CI approved — informational */}
              {(parcel.claimStatus === 'UNDER_REVIEW' || parcel.claimStatus === 'CI_APPROVED') && (
                <div className="card space-y-2">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Clock className="w-5 h-5" />
                    <span className="font-semibold">
                      {parcel.claimStatus === 'CI_APPROVED' ? 'Awaiting Tehsildar Final Approval' : 'Field Verification in Progress'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">
                    {parcel.claimStatus === 'CI_APPROVED'
                      ? 'Circle Inspector has approved. Tehsildar will issue final VERIFIED status with eSign.'
                      : 'Patwari Vijay Singh (DAD-P1) will conduct a field visit to verify possession. You will be notified via SMS.'}
                  </p>
                </div>
              )}

              {/* Dispute form — available on VERIFIED and SEEDED_UNVERIFIED, not when already disputed */}
              {!['DISPUTED', 'REJECTED'].includes(parcel.claimStatus) && (
                <DisputeForm dlpiId={parcel.dlpiId} onSuccess={refresh} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
