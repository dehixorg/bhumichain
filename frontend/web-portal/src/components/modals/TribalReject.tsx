'use client';

import React from 'react';
import { Shield, AlertTriangle, X, Clock, ExternalLink, Lock } from 'lucide-react';
import clsx from 'clsx';
import type { TribalCheckResult } from '@/types';

interface Props extends TribalCheckResult {
  parcelOwner?: string;
  attemptedBuyerName?: string;
  onClose?: () => void;
  inline?: boolean;  // render without fixed overlay (embedded in page)
}

const REJECTION_LABEL: Record<string, string> = {
  SCHEDULE_V_NON_TRIBAL:   'Fifth Schedule Area — Non-tribal Buyer',
  SCHEDULE_VI_NON_TRIBAL:  'Sixth Schedule Area — Non-tribal Buyer',
  FRA_PATTA_INALIENABLE:   'FRA Patta — Absolutely Inalienable',
  PVTG_ABSOLUTE_BLOCK:     'PVTG — Highest Protection Level',
  CROSS_COMMUNITY:         'Cross-community Tribal Transfer',
};

const AUTO_NOTIFIED = [
  { name: 'NALSA Regional Office, Nashik',        role: 'National Legal Services Authority' },
  { name: 'ST Commissioner, Maharashtra',         role: 'State Tribal Welfare Commissioner' },
  { name: 'District Collector, Nashik',           role: 'District Administration' },
];

export default function TribalReject({
  dlpiId, attemptId, scheduleType, community, decision,
  rejectionCode, rejectionReason, legalCitations = [],
  responseTimeMs, parcelOwner, attemptedBuyerName, onClose, inline,
}: Props) {
  const label = rejectionCode ? (REJECTION_LABEL[rejectionCode] ?? rejectionCode) : 'Hard Rejection';
  const isFRA = rejectionCode === 'FRA_PATTA_INALIENABLE';

  const inner = (
    <div className={clsx(
      'bg-gray-900 rounded-2xl overflow-hidden',
      inline ? 'border-2 border-red-800' : 'w-full max-w-2xl mx-4 border-2 border-red-700 shadow-2xl',
    )}>

      {/* Header */}
      <div className="bg-red-950 border-b border-red-800 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-900 border border-red-600 flex items-center justify-center shrink-0 mt-0.5">
            <Shield className="w-5 h-5 text-red-300" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-red-200 font-bold text-base">HARD REJECT — VOID AB INITIO</span>
              <span className="text-xs font-mono bg-red-900 border border-red-700 text-red-300 px-2 py-0.5 rounded">
                TribalGuard
              </span>
            </div>
            <div className="text-red-400 text-xs mt-1">{label}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span className="font-mono text-red-400 font-bold">{responseTimeMs}ms</span>
            </div>
            {onClose && !inline && (
              <button onClick={onClose} className="text-red-500 hover:text-red-300">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* Parcel + decision */}
        <div className="bg-gray-800 rounded-xl p-3 text-xs space-y-2">
          <InfoRow label="Parcel (DLPI)"   value={dlpiId} mono />
          {parcelOwner && <InfoRow label="Current owner"    value={parcelOwner} />}
          {attemptedBuyerName && <InfoRow label="Attempted buyer" value={attemptedBuyerName} />}
          <InfoRow label="Schedule type"   value={scheduleType ? `Schedule ${scheduleType}` : 'Tribal Protected'} />
          {community && <InfoRow label="Community"    value={community} />}
          <InfoRow label="Decision"        value="HARD_REJECTED" />
          <InfoRow label="Attempt ID"      value={attemptId || '—'} mono />
        </div>

        {/* Rejection reason */}
        <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div className="text-xs text-red-300 leading-relaxed">{rejectionReason}</div>
          </div>
        </div>

        {/* FRA special note */}
        {isFRA && (
          <div className="flex items-start gap-2 bg-amber-950 border border-amber-800 rounded-xl px-3 py-2.5 text-xs text-amber-300">
            <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Forest Rights Act 2006, Section 4(5) — FRA patta rights are <strong>absolutely inalienable</strong>.
              Transfer to any party, including other tribals, is permanently prohibited.
            </span>
          </div>
        )}

        {/* Legal citations */}
        {legalCitations.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Legal Citations
            </div>
            <div className="space-y-2">
              {legalCitations.map((cite, i) => (
                <div key={i} className="flex items-start gap-2 bg-blue-950 border border-blue-900 rounded-lg px-3 py-2">
                  <span className="text-blue-500 font-mono text-xs shrink-0 mt-0.5">[{i + 1}]</span>
                  <span className="text-xs text-blue-300 leading-relaxed">{cite}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Auto-notified */}
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Auto-Notified (BhumiChain Fabric Event)
          </div>
          <div className="space-y-1.5">
            {AUTO_NOTIFIED.map((n, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                <span className="text-gray-300">{n.name}</span>
                <span className="text-gray-600">— {n.role}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cannot override notice */}
        <div className="flex items-start gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-xs text-gray-400">
          <Shield className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
          <span>
            This rejection <strong className="text-gray-300">cannot be overridden</strong> by any revenue officer, SRO, or digital signature.
            It is enforced at the Hyperledger Fabric chaincode level with no admin bypass.
          </span>
        </div>

        {!inline && (
          <div className="flex gap-3 pt-1">
            <button className="btn-ghost flex-1 text-sm py-2 flex items-center justify-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              View Audit Trail
            </button>
            {onClose && (
              <button onClick={onClose} className="btn-danger flex-1 text-sm py-2">Dismiss</button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (inline) return inner;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto py-6">
      {inner}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={clsx('text-gray-200 text-right break-all', mono && 'font-mono')}>{value}</span>
    </div>
  );
}
