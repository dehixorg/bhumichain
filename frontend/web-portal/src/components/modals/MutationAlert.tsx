'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, X, Bell, Clock } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  mutationId: string;
  dlpiId: string;
  mutationType: string;
  officerName: string;
  alertSentAt: string;
  slaMet: boolean;
  alertElapsedSeconds: number;
  onClose: () => void;
  onConsent?: () => void;
  onObject?: () => void;
}

export default function MutationAlert({
  mutationId, dlpiId, mutationType, officerName,
  alertSentAt, slaMet, alertElapsedSeconds,
  onClose, onConsent, onObject,
}: Props) {
  const [elapsed, setElapsed] = useState(0);

  // Live counter showing seconds since alert was received
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md mx-4 bg-gray-900 border border-amber-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header — amber alert bar */}
        <div className="bg-amber-900 border-b border-amber-700 px-5 py-3 flex items-center gap-3">
          <div className="relative">
            <Bell className="w-5 h-5 text-amber-300" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full pulse-ring" />
          </div>
          <div className="flex-1">
            <div className="text-amber-200 font-bold text-sm">Land Mutation Alert</div>
            <div className="text-amber-400 text-xs">Your property is being modified</div>
          </div>
          <button onClick={onClose} className="text-amber-500 hover:text-amber-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* SLA badge */}
          <div className="flex items-center gap-3">
            <div className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold',
              slaMet
                ? 'bg-brand-900 border border-brand-700 text-brand-300'
                : 'bg-red-900 border border-red-700 text-red-300',
            )}>
              {slaMet
                ? <><CheckCircle className="w-3.5 h-3.5" /> Alert delivered in {alertElapsedSeconds}s — SLA met</>
                : <><AlertTriangle className="w-3.5 h-3.5" /> Alert delayed — SLA breach</>
              }
            </div>
          </div>

          {/* Details */}
          <div className="bg-gray-800 rounded-xl p-4 space-y-3">
            <DetailRow label="Parcel ID" value={dlpiId} mono />
            <DetailRow label="Mutation Type" value={mutationType} />
            <DetailRow label="Initiated By" value={officerName} />
            <DetailRow label="Alert Sent At" value={new Date(alertSentAt).toLocaleString('en-IN')} />
            <DetailRow label="Mutation ID" value={mutationId} mono />
          </div>

          {/* Live timer */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="w-3.5 h-3.5" />
            <span>Time since alert received:</span>
            <span className="font-mono text-amber-400 font-bold">{fmt(elapsed)}</span>
          </div>

          {/* Legal note */}
          <div className="bg-blue-950 border border-blue-800 rounded-lg px-3 py-2 text-xs text-blue-300">
            You have <strong>30 days</strong> to raise an objection before this mutation
            is executed. All objections are recorded permanently on BhumiChain.
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {onObject && (
              <button
                onClick={onObject}
                className="flex-1 btn-danger text-sm py-2"
              >
                <AlertTriangle className="w-4 h-4 inline mr-1.5" />
                Raise Objection
              </button>
            )}
            {onConsent && (
              <button
                onClick={onConsent}
                className="flex-1 btn-primary text-sm py-2"
              >
                <CheckCircle className="w-4 h-4 inline mr-1.5" />
                Consent
              </button>
            )}
            <button onClick={onClose} className="btn-ghost text-sm py-2 px-4">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-gray-500 text-xs shrink-0">{label}</span>
      <span className={clsx('text-xs text-gray-200 text-right', mono && 'font-mono')}>{value}</span>
    </div>
  );
}
