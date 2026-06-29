'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle, Clock, AlertTriangle, Send,
  XCircle, Zap, ArrowLeftRight, Shield, FileText,
  MessageSquare, RotateCcw, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import Sidebar from '@/components/dashboard/Sidebar';
import { getUser, apiFetch, submitESign, isOfficer, type JWTUser } from '@/lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TelegramAlert {
  channel:   string;
  recipient: string;
  message:   string;
  sentAt:    string;
  delivered: boolean;
}

interface TimelineStep {
  step:  string;
  label: string;
  actor: string;
  at:    string | null;
  done:  boolean;
}

interface Mutation {
  mutationId:              string;
  dlpiId:                  string;
  mutationType:            string;
  officerName:             string;
  officerRank:             string;
  currentOwnerName:        string;
  newOwnerName:            string;
  reason:                  string;
  supportingCID:           string;
  status:                  string;
  alertSentAt:             string;
  alertElapsedSeconds:     number;
  slaMet:                  boolean;
  requiresPublicNotice:    boolean;
  publicNoticePeriodDays:  number;
  objectionDeadline:       string | null;
  ownerConsentAt:          string | null;
  ownerObjectionAt:        string | null;
  objectionReason:         string | null;
  executedAt:              string | null;
  executedTxHash:          string | null;
  initiatedAt:             string;
  telegramAlerts:          TelegramAlert[];
  timeline:                TimelineStep[];
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  ALERT_SENT:      { label: 'Alert Sent — Awaiting Response', color: 'text-saffron-400', bg: 'bg-orange-900/30 border-orange-700', icon: Send },
  CONSENT_GIVEN:   { label: 'Consent Given',                  color: 'text-blue-400',    bg: 'bg-blue-900/30 border-blue-700',     icon: CheckCircle },
  OBJECTION_FILED: { label: 'Objection Filed',                color: 'text-red-400',     bg: 'bg-red-900/30 border-red-700',       icon: XCircle },
  EXECUTED:        { label: 'Mutation Executed',              color: 'text-green-400',   bg: 'bg-green-900/30 border-green-700',   icon: CheckCircle },
  REJECTED:        { label: 'Rejected',                       color: 'text-gray-400',    bg: 'bg-gray-800 border-gray-700',        icon: XCircle },
};

// ── Telegram notification log ─────────────────────────────────────────────────

interface NotifEntry {
  id:        string;
  timestamp: string;
  event:     string;
  recipient: string;
  message:   string;
  delivered: boolean;
  mode:      string;
}

function TelegramPanel({ mutationAlerts, botUrl }: { mutationAlerts: TelegramAlert[]; botUrl: string }) {
  const [botNotifs, setBotNotifs] = useState<NotifEntry[]>([]);
  const [botErr, setBotErr]       = useState('');

  useEffect(() => {
    fetch(`${botUrl}/notifications?limit=20`)
      .then(r => r.json())
      .then(data => setBotNotifs(Array.isArray(data) ? data : []))
      .catch(() => setBotErr('Bot service offline'));
  }, [botUrl]);

  const alerts = botNotifs.length > 0
    ? botNotifs
    : mutationAlerts.map((a, i) => ({
        id: `demo-${i}`, timestamp: a.sentAt, event: 'MutationAlert',
        recipient: a.recipient, message: a.message, delivered: a.delivered, mode: 'MOCK',
      }));

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-brand-400" />
        <span className="text-sm font-semibold text-gray-200">Telegram Notifications</span>
        <span className={clsx(
          'ml-auto px-2 py-0.5 rounded-full text-xs font-semibold',
          botErr ? 'bg-gray-800 text-gray-500' : 'bg-green-900/40 border border-green-700 text-green-400',
        )}>
          {botErr ? 'Bot offline' : 'MOCK mode'}
        </span>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {alerts.map((n, i) => (
          <div key={n.id || i} className="p-3 rounded-xl bg-gray-800 border border-gray-700 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-brand-400 font-semibold">{n.event}</span>
              <span className="text-gray-600">{new Date(n.timestamp).toLocaleTimeString('en-IN')}</span>
            </div>
            <div className="text-gray-400 font-medium">→ {n.recipient}</div>
            <div className="text-gray-500 bg-gray-900 rounded-lg p-2 whitespace-pre-wrap font-mono leading-relaxed">
              {n.message}
            </div>
            <div className="flex items-center gap-1.5 text-green-400">
              <CheckCircle className="w-3 h-3" />
              <span>Delivered · {n.mode}</span>
            </div>
          </div>
        ))}
      </div>

      {botErr && (
        <p className="text-xs text-gray-600">
          Start the Telegram bot: <span className="font-mono text-gray-400">cd backend/services/telegram-bot && node bot.js</span>
        </p>
      )}
    </div>
  );
}

// ── eSign Modal ───────────────────────────────────────────────────────────────

function ESignModal({
  action,
  dlpiId,
  onSuccess,
  onCancel,
}: {
  action:    'consent' | 'execute';
  dlpiId:    string;
  onSuccess: (hash: string) => void;
  onCancel:  () => void;
}) {
  const [aadhaar, setAadhaar] = useState('');
  const [otp, setOtp]         = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');

  const actionLabel = action === 'consent' ? 'Consent to Mutation' : 'Execute Mutation';
  const actionDesc  = action === 'consent'
    ? `Owner eSign consent for mutation on ${dlpiId}`
    : `Officer final execution of mutation on ${dlpiId}`;

  async function sendOtp() {
    setErr(''); setBusy(true);
    try {
      const res = await apiFetch('/api/auth/request-otp', { method: 'POST', body: JSON.stringify({ aadhaarNumber: aadhaar }) });
      if (!res.ok) throw new Error((await res.json()).message || 'OTP failed');
      setOtpSent(true);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'OTP failed'); }
    finally { setBusy(false); }
  }

  async function sign() {
    setErr(''); setBusy(true);
    try {
      const { eSignTxHash } = await submitESign(aadhaar, otp, actionDesc);
      onSuccess(eSignTxHash);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'eSign failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-5 h-5 text-brand-400" />
          <h3 className="text-gray-100 font-semibold">{actionLabel}</h3>
        </div>
        <p className="text-sm text-gray-400 mb-5">
          SHA-256(aadhaarHash:otp:action:timestamp) recorded on Hyperledger Fabric as consent proof.
        </p>
        {!otpSent ? (
          <>
            <label className="block text-xs text-gray-400 mb-1">Aadhaar Number</label>
            <input
              type="tel" inputMode="numeric" maxLength={12}
              value={aadhaar} onChange={e => setAadhaar(e.target.value.replace(/\D/g, ''))}
              placeholder="9999 0001 0010"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm focus:outline-none focus:border-brand-500 font-mono tracking-widest"
            />
            {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-gray-800 text-gray-300">Cancel</button>
              <button onClick={sendOtp} disabled={busy || aadhaar.length !== 12}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">
                {busy ? 'Sending…' : 'Send OTP'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-green-400 mb-3">Demo OTP: 123456</p>
            <label className="block text-xs text-gray-400 mb-1">OTP</label>
            <input
              type="tel" inputMode="numeric" maxLength={6}
              value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="• • • • • •"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-brand-500 font-mono tracking-widest text-center"
            />
            {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setOtpSent(false); setOtp(''); }} className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-gray-800 text-gray-300">Back</button>
              <button onClick={sign} disabled={busy || otp.length !== 6}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">
                {busy ? 'Signing…' : actionLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Objection Modal ───────────────────────────────────────────────────────────

function ObjectionModal({ onConfirm, onCancel, busy }: { onConfirm: (reason: string) => void; onCancel: () => void; busy: boolean }) {
  const [reason, setReason] = useState('');
  const [evidenceCID, setEvidenceCID] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400" />
          <h3 className="text-gray-100 font-semibold">File Objection</h3>
        </div>
        <p className="text-sm text-gray-400">
          Your objection will be recorded on Hyperledger Fabric and the Tehsil office will be notified within 60 seconds via Telegram.
        </p>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Objection Reason *</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={3}
            placeholder="e.g. This mutation is fraudulent. I am the sole legal heir and have not given consent. Original will registered at Sub-Registrar GBN-2025-00112."
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm resize-none focus:outline-none focus:border-brand-500"
          />
          <div className="text-xs text-gray-600 text-right mt-0.5">{reason.length}/500</div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Supporting Document CID (optional)</label>
          <input value={evidenceCID} onChange={e => setEvidenceCID(e.target.value)}
            placeholder="QmYourIPFSDocumentHash"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 text-sm focus:outline-none focus:border-brand-500 font-mono"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={busy} className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-gray-800 text-gray-300 hover:bg-gray-700">Cancel</button>
          <button onClick={() => onConfirm(reason)} disabled={busy || reason.trim().length < 10}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-700 hover:bg-red-600 text-white disabled:opacity-50">
            {busy ? 'Filing…' : 'File Objection'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const BOT_URL = 'http://localhost:8020';

export default function MutationDetailPage() {
  const params      = useParams<{ mutationId: string }>();
  const router      = useRouter();
  const mutationId  = params?.mutationId ?? '';

  const [user, setUser]         = useState<JWTUser | null>(null);
  const [mutation, setMutation] = useState<Mutation | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);
  const [actionErr, setActionErr] = useState('');
  const [showESign, setShowESign] = useState<'consent' | 'execute' | null>(null);
  const [showObjection, setShowObjection] = useState(false);
  const [actionDone, setActionDone] = useState('');

  useEffect(() => {
    if (!mutationId) return;
    const u = getUser();
    if (!u) { router.replace('/login'); return; }
    setUser(u);
    loadMutation();
  }, [mutationId]);

  async function loadMutation() {
    setLoading(true); setError('');
    try {
      const res  = await apiFetch(`/api/mutation/${mutationId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Not found');
      setMutation(data);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }

  async function postAction(endpoint: string, body: object) {
    setBusy(true); setActionErr('');
    try {
      const res  = await apiFetch(`/api/mutation/${mutationId}${endpoint}`, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Action failed');
      return data;
    } catch (e: unknown) { setActionErr(e instanceof Error ? e.message : 'Request failed'); return null; }
    finally { setBusy(false); }
  }

  async function handleConsent(eSignTxHash: string) {
    setShowESign(null);
    const data = await postAction('/consent', {
      ownerAadhaarHash: `sha256:${user?.aadhaarHash?.replace('sha256:', '') ?? 'demo'}`,
      eSignTxHash,
    });
    if (data) { setActionDone('CONSENT_GIVEN'); if (mutation) setMutation({ ...mutation, status: 'CONSENT_GIVEN', ownerConsentAt: new Date().toISOString() }); }
  }

  async function handleObjection(reason: string) {
    setShowObjection(false);
    const data = await postAction('/objection', {
      ownerAadhaarHash: `sha256:${user?.aadhaarHash?.replace('sha256:', '') ?? 'demo'}`,
      objectionReason: reason,
      evidenceCID: 'QmObjectionDoc2026',
    });
    if (data) { setActionDone('OBJECTION_FILED'); if (mutation) setMutation({ ...mutation, status: 'OBJECTION_FILED', ownerObjectionAt: new Date().toISOString() }); }
  }

  async function handleExecute(eSignTxHash: string) {
    setShowESign(null);
    const data = await postAction('/execute', { finalDocCID: 'QmFinalMutationDoc2026', eSignTxHash });
    if (data) { setActionDone('EXECUTED'); if (mutation) setMutation({ ...mutation, status: 'EXECUTED', executedAt: new Date().toISOString(), executedTxHash: data.txHash }); }
  }

  const daysLeft = mutation?.objectionDeadline
    ? Math.max(0, Math.ceil((new Date(mutation.objectionDeadline).getTime() - Date.now()) / 86400000))
    : null;

  const isCitizen  = user?.role === 'citizen';
  const canConsent = isCitizen && mutation?.status === 'ALERT_SENT';
  const canObject  = isCitizen && mutation?.status === 'ALERT_SENT';
  const canExecute = !isCitizen && mutation?.status === 'CONSENT_GIVEN';
  const isFinished = ['EXECUTED', 'REJECTED', 'OBJECTION_FILED'].includes(mutation?.status ?? '') || !!actionDone;

  if (loading) return (
    <div className="flex h-screen bg-gray-950"><Sidebar />
      <main className="flex-1 flex items-center justify-center"><div className="text-gray-500 animate-pulse">Loading mutation…</div></main>
    </div>
  );

  if (error || !mutation) return (
    <div className="flex h-screen bg-gray-950"><Sidebar />
      <main className="flex-1 flex items-center justify-center text-center">
        <div>
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-300">{error || 'Mutation not found'}</p>
          <Link href="/mutation" className="text-brand-400 text-sm mt-3 inline-block">← All Mutations</Link>
        </div>
      </main>
    </div>
  );

  const status = STATUS_CONFIG[mutation.status] ?? STATUS_CONFIG['ALERT_SENT'];
  const StatusIcon = status.icon;

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar />

      {showESign && (
        <ESignModal
          action={showESign}
          dlpiId={mutation.dlpiId}
          onSuccess={showESign === 'consent' ? handleConsent : handleExecute}
          onCancel={() => setShowESign(null)}
        />
      )}
      {showObjection && (
        <ObjectionModal
          onConfirm={handleObjection}
          onCancel={() => setShowObjection(false)}
          busy={busy}
        />
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

          {/* Breadcrumb */}
          <div className="flex items-center gap-3 text-sm">
            <Link href="/mutation" className="flex items-center gap-1.5 text-gray-400 hover:text-gray-200">
              <ArrowLeft className="w-4 h-4" />Mutations
            </Link>
            <span className="text-gray-700">/</span>
            <span className="font-mono text-brand-400 text-sm">{mutationId}</span>
          </div>

          {/* Action done banner */}
          {actionDone && (
            <div className={clsx(
              'flex items-center gap-3 p-4 rounded-xl border text-sm font-semibold',
              actionDone === 'EXECUTED'        ? 'bg-green-900/30 border-green-700 text-green-300' :
              actionDone === 'CONSENT_GIVEN'   ? 'bg-blue-900/30 border-blue-700 text-blue-300' :
              actionDone === 'OBJECTION_FILED' ? 'bg-red-900/30 border-red-700 text-red-300' : '',
            )}>
              <CheckCircle className="w-5 h-5 shrink-0" />
              Status updated to <strong>{actionDone.replace('_', ' ')}</strong>. Recorded on Hyperledger Fabric.
            </div>
          )}

          <div className="grid grid-cols-3 gap-6">

            {/* Left column (2/3) */}
            <div className="col-span-2 space-y-5">

              {/* Mutation summary card */}
              <div className="card space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-brand-400 text-xs font-semibold">{mutation.mutationId}</div>
                    <div className="text-xl font-bold text-gray-100 mt-1">{mutation.mutationType}</div>
                    <div className="text-gray-400 text-sm mt-0.5">on <span className="font-mono text-brand-400">{mutation.dlpiId}</span></div>
                  </div>
                  <span className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold',
                    status.bg, status.color,
                  )}>
                    <StatusIcon className="w-4 h-4" />
                    {status.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    ['Current Owner', mutation.currentOwnerName],
                    ['New Owner',     mutation.newOwnerName],
                    ['Initiated by',  `${mutation.officerName} (${mutation.officerRank})`],
                    ['Initiated at',  new Date(mutation.initiatedAt).toLocaleString('en-IN')],
                    ['SLA (60s)',     mutation.slaMet ? `✓ Met (${mutation.alertElapsedSeconds}s)` : `✗ Missed (${mutation.alertElapsedSeconds}s)`],
                    ['Public Notice', mutation.requiresPublicNotice ? `${mutation.publicNoticePeriodDays}-day notice` : 'Not required'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-800 rounded-xl px-3 py-2.5">
                      <div className="text-gray-500 mb-0.5">{label}</div>
                      <div className="text-gray-200 font-medium">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="text-xs text-gray-500 mb-1">Reason / Basis</div>
                  <p className="text-sm text-gray-300">{mutation.reason}</p>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-800 border border-gray-700 text-xs text-gray-400">
                  <FileText className="w-3.5 h-3.5 text-brand-400" />
                  Supporting doc CID: <span className="font-mono text-gray-300">{mutation.supportingCID}</span>
                </div>
              </div>

              {/* Timeline */}
              <div className="card space-y-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mutation Timeline</div>
                <div className="space-y-3">
                  {mutation.timeline.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={clsx(
                        'w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5',
                        step.done ? 'bg-brand-600 border-brand-600' : 'bg-gray-900 border-gray-700',
                      )}>
                        {step.done
                          ? <CheckCircle className="w-3.5 h-3.5 text-white" />
                          : <div className="w-2 h-2 rounded-full bg-gray-700" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={clsx('text-sm font-semibold', step.done ? 'text-gray-200' : 'text-gray-600')}>
                          {step.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {step.actor} {step.at ? `· ${new Date(step.at).toLocaleString('en-IN')}` : '· Pending'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Telegram alerts */}
              <TelegramPanel mutationAlerts={mutation.telegramAlerts} botUrl={BOT_URL} />
            </div>

            {/* Right column (1/3) */}
            <div className="space-y-4">

              {/* Objection window */}
              {daysLeft !== null && mutation.status === 'ALERT_SENT' && (
                <div className={clsx(
                  'card text-center space-y-2 border',
                  daysLeft <= 5 ? 'border-red-700 bg-red-900/10' : 'border-orange-700 bg-orange-900/10',
                )}>
                  <Clock className={clsx('w-8 h-8 mx-auto', daysLeft <= 5 ? 'text-red-400' : 'text-saffron-400')} />
                  <div className={clsx('text-3xl font-bold', daysLeft <= 5 ? 'text-red-400' : 'text-saffron-400')}>{daysLeft}d</div>
                  <div className="text-xs text-gray-400">objection window remaining</div>
                  <div className="text-xs text-gray-600">Deadline: {mutation.objectionDeadline ? new Date(mutation.objectionDeadline).toLocaleDateString('en-IN') : '—'}</div>
                </div>
              )}

              {/* Action buttons */}
              {!isFinished && (
                <div className="card space-y-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Action</div>

                  {actionErr && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/30 border border-red-700 text-red-300 text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {actionErr}
                    </div>
                  )}

                  {canConsent && (
                    <button
                      onClick={() => setShowESign('consent')}
                      disabled={busy}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Give eSign Consent
                    </button>
                  )}

                  {canObject && (
                    <button
                      onClick={() => setShowObjection(true)}
                      disabled={busy}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-900/30 hover:bg-red-900/50 border border-red-700 text-red-400 font-semibold text-sm transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      File Objection
                    </button>
                  )}

                  {canExecute && (
                    <button
                      onClick={() => setShowESign('execute')}
                      disabled={busy}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-700 hover:bg-green-600 text-white font-semibold text-sm transition-colors disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4" />
                      Execute Mutation
                    </button>
                  )}

                  {!canConsent && !canObject && !canExecute && (
                    <p className="text-xs text-gray-500 text-center">No action required from you at this stage.</p>
                  )}

                  <p className="text-xs text-gray-600 text-center">All actions are permanent and recorded on Hyperledger Fabric.</p>
                </div>
              )}

              {/* Finalized state */}
              {isFinished && (
                <div className={clsx(
                  'card text-center space-y-2',
                  (mutation.status === 'EXECUTED' || actionDone === 'EXECUTED') ? 'border-green-700 bg-green-900/10' :
                  (mutation.status === 'OBJECTION_FILED' || actionDone === 'OBJECTION_FILED') ? 'border-red-700 bg-red-900/10' :
                  'border-blue-700 bg-blue-900/10',
                )}>
                  <CheckCircle className="w-8 h-8 mx-auto text-green-400" />
                  <div className="font-semibold text-gray-200">{(actionDone || mutation.status).replace('_', ' ')}</div>
                  {mutation.executedTxHash && (
                    <div className="text-xs font-mono text-gray-500 break-all">{mutation.executedTxHash}</div>
                  )}
                </div>
              )}

              {/* Quick links */}
              <Link
                href={`/claim/${mutation.dlpiId}`}
                className="flex items-center justify-between p-3 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-600 transition-colors text-sm text-gray-400 hover:text-gray-200"
              >
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-brand-400" />
                  View Parcel {mutation.dlpiId}
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
