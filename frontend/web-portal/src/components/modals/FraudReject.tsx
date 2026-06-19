'use client';

import React from 'react';
import { AlertTriangle, Lock, X, Clock, Shield, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

interface OriginalTransfer {
  transferId: string;
  initiatedAt: string;
  buyerName: string;
  sroName: string;
}

interface Props {
  dlpiId: string;
  attemptedBuyerName: string;
  fraudScore: number;
  rejectionCode: 'NATIONAL_LOCK_ACTIVE' | 'FRAUD_AUTO_REJECT' | 'DUAL_SALE';
  originalTransfer: OriginalTransfer;
  responseTimeMs?: number;
  onClose?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FraudReject({
  dlpiId, attemptedBuyerName, fraudScore, rejectionCode,
  originalTransfer, responseTimeMs = 31, onClose,
}: Props) {
  const isLock   = rejectionCode === 'NATIONAL_LOCK_ACTIVE' || rejectionCode === 'DUAL_SALE';
  const isFraud  = rejectionCode === 'FRAUD_AUTO_REJECT';

  const scoreColor =
    fraudScore >= 0.90 ? 'text-red-300 bg-red-950 border-red-700' :
    fraudScore >= 0.75 ? 'text-amber-300 bg-amber-950 border-amber-700' :
                         'text-brand-300 bg-brand-950 border-brand-700';

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-gray-900 border-2 border-red-700 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-red-950 border-b border-red-800 px-5 py-4 flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-full bg-red-900 border border-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-300" />
          </div>
          <div className="flex-1">
            <div className="text-red-200 font-bold">TRANSFER REJECTED — AUTO</div>
            <div className="text-red-400 text-xs mt-0.5">
              {isLock  && 'Dual-sale prevention: national parcel lock active'}
              {isFraud && 'FraudSense AI auto-rejection threshold exceeded'}
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-red-500 hover:text-red-300 ml-auto">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">

          {/* Fraud score badge + response time */}
          <div className="flex items-center gap-3">
            <div className={clsx('px-3 py-1.5 rounded-full text-sm font-bold border', scoreColor)}>
              Fraud Score: {fraudScore.toFixed(2)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              Rejected in {responseTimeMs}ms
            </div>
            <div className="ml-auto text-xs font-mono font-bold text-red-400 bg-red-950 border border-red-800 px-2 py-1 rounded">
              AUTO-REJECTED
            </div>
          </div>

          {/* Rejection reason */}
          {isLock && (
            <div className="flex items-start gap-3 bg-amber-950 border border-amber-800 rounded-xl px-4 py-3">
              <Lock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-amber-300 font-semibold text-sm">National Parcel Lock Active</div>
                <div className="text-amber-500 text-xs mt-1 leading-relaxed">
                  Parcel <span className="font-mono">{dlpiId}</span> is currently under a 24-hour
                  national transfer lock acquired by another SRO. Any duplicate transfer attempt
                  is rejected across all State Registration Offices simultaneously.
                  This prevents coordinated dual-sale fraud.
                </div>
              </div>
            </div>
          )}

          {isFraud && (
            <div className="flex items-start gap-3 bg-red-950 border border-red-800 rounded-xl px-4 py-3">
              <Shield className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-red-300 font-semibold text-sm">FraudSense Auto-Rejection</div>
                <div className="text-red-500 text-xs mt-1 leading-relaxed">
                  Fraud score {fraudScore.toFixed(2)} exceeds the 0.90 auto-reject threshold.
                  Transaction halted before any on-chain write. Seller and buyer flagged for manual review.
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Transaction Timeline
            </div>
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-700" />
              <div className="space-y-4 pl-8">
                {/* Original lock */}
                <TimelineItem
                  time={new Date(originalTransfer.initiatedAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                  label="Original transfer initiated"
                  sublabel={`SRO: ${originalTransfer.sroName} · Buyer: ${originalTransfer.buyerName}`}
                  color="amber"
                />
                <TimelineItem
                  time={new Date(new Date(originalTransfer.initiatedAt).getTime() + 120).toLocaleTimeString('en-IN', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                  label="National parcel lock acquired"
                  sublabel={`Lock ID: ${originalTransfer.transferId}`}
                  color="amber"
                />
                {/* Attempted duplicate */}
                <TimelineItem
                  time="NOW"
                  label="Duplicate transfer attempt — BLOCKED"
                  sublabel={`Attempted buyer: ${attemptedBuyerName} · Fraud score: ${fraudScore.toFixed(2)}`}
                  color="red"
                  current
                />
              </div>
            </div>
          </div>

          {/* Legal note */}
          <div className="bg-blue-950 border border-blue-800 rounded-lg px-3 py-2.5 text-xs text-blue-300 flex gap-2">
            <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              This attempt has been logged to the BhumiChain audit trail and flagged to the
              Registrar of Assurances, Maharashtra. Persistent attempts may trigger FIR under
              IPC Section 420 (cheating) and Section 465 (forgery).
            </span>
          </div>

          <div className="flex gap-3">
            <button className="btn-ghost flex-1 text-sm py-2 flex items-center justify-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              View Audit Log
            </button>
            {onClose && (
              <button onClick={onClose} className="btn-danger flex-1 text-sm py-2">
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TimelineItem({
  time, label, sublabel, color, current,
}: {
  time: string;
  label: string;
  sublabel: string;
  color: 'amber' | 'red' | 'brand';
  current?: boolean;
}) {
  const dot = color === 'red' ? 'bg-red-500' : color === 'amber' ? 'bg-amber-500' : 'bg-brand-500';
  const txt = color === 'red' ? 'text-red-300' : color === 'amber' ? 'text-amber-300' : 'text-brand-300';

  return (
    <div className="relative">
      <div className={clsx('absolute -left-5 top-1 w-2.5 h-2.5 rounded-full', dot, current && 'animate-pulse')} />
      <div className={clsx('text-xs font-semibold', txt)}>{label}</div>
      <div className="text-xs text-gray-500 mt-0.5">{sublabel}</div>
      <div className="text-xs text-gray-600 mt-0.5 font-mono">{time}</div>
    </div>
  );
}
