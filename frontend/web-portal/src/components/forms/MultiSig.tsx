'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { CheckCircle, Clock, AlertTriangle, Shield, Fingerprint, ChevronRight } from 'lucide-react';

interface Signer {
  id: string;
  name: string;
  role: string;
  share?: string;
  hasConsented: boolean;
  hasObjected: boolean;
  consentedAt?: string;
  legalNote?: string;
  isCritical?: boolean;
}

interface Props {
  title: string;
  subtitle?: string;
  signers: Signer[];
  onSign: (signerId: string) => Promise<void>;
  onObject?: (signerId: string, reason: string) => Promise<void>;
  requiredCount?: number;          // how many needed (default: all)
  completedText?: string;
  className?: string;
}

export default function MultiSig({
  title, subtitle, signers, onSign, onObject,
  requiredCount, completedText = 'All signatures collected',
  className,
}: Props) {
  const [signing, setSigning] = useState<string | null>(null);
  const [objecting, setObjecting] = useState<string | null>(null);
  const [objectionText, setObjectionText] = useState('');

  const required = requiredCount ?? signers.length;
  const consentedCount = signers.filter((s) => s.hasConsented).length;
  const allDone = consentedCount >= required;
  const anyObjected = signers.some((s) => s.hasObjected);
  const progressPct = Math.round((consentedCount / required) * 100);

  const handleSign = async (signer: Signer) => {
    if (signer.hasConsented || signer.hasObjected || signing) return;
    setSigning(signer.id);
    try {
      await onSign(signer.id);
    } finally {
      setSigning(null);
    }
  };

  const handleObject = async (signer: Signer) => {
    if (!objectionText.trim() || !onObject) return;
    setSigning(signer.id);
    try {
      await onObject(signer.id, objectionText.trim());
      setObjecting(null);
      setObjectionText('');
    } finally {
      setSigning(null);
    }
  };

  return (
    <div className={clsx('card', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-gray-200 text-sm">{title}</div>
          {subtitle && <div className="text-gray-500 text-xs mt-0.5">{subtitle}</div>}
        </div>
        <div className="text-right shrink-0 ml-3">
          <div className="text-sm font-bold text-gray-200">{consentedCount}/{required}</div>
          <div className="text-xs text-gray-500">signed</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-800 rounded-full mb-4">
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-700',
            allDone ? 'bg-brand-500' : anyObjected ? 'bg-red-500' : 'bg-amber-500',
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Signer rows */}
      <div className="space-y-2">
        {signers.map((signer) => (
          <div key={signer.id}>
            <div className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors',
              signer.hasConsented  && 'bg-brand-950 border-brand-800',
              signer.hasObjected   && 'bg-red-950 border-red-800',
              !signer.hasConsented && !signer.hasObjected && 'bg-gray-800 border-gray-700',
            )}>
              {/* Status icon */}
              <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center shrink-0', {
                'bg-brand-800': signer.hasConsented,
                'bg-red-800':   signer.hasObjected,
                'bg-gray-700':  !signer.hasConsented && !signer.hasObjected,
              })}>
                {signer.hasConsented  && <CheckCircle className="w-4 h-4 text-brand-300" />}
                {signer.hasObjected   && <AlertTriangle className="w-4 h-4 text-red-300" />}
                {!signer.hasConsented && !signer.hasObjected && <Clock className="w-4 h-4 text-gray-400" />}
              </div>

              {/* Name + role */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-200 font-medium truncate">{signer.name}</span>
                  {signer.legalNote && (
                    <span title={signer.legalNote} className="shrink-0">
                      <Shield className="w-3 h-3 text-purple-400" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500">{signer.role}</span>
                  {signer.share && (
                    <span className="font-mono text-xs text-brand-400">{signer.share}</span>
                  )}
                  {signer.consentedAt && (
                    <span className="text-xs text-gray-600">
                      · {new Date(signer.consentedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              {!signer.hasConsented && !signer.hasObjected && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {onObject && (
                    <button
                      onClick={() => setObjecting(objecting === signer.id ? null : signer.id)}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-800 hover:border-red-600 transition-colors"
                    >
                      Object
                    </button>
                  )}
                  <button
                    onClick={() => handleSign(signer)}
                    disabled={signing === signer.id}
                    className="flex items-center gap-1 btn-primary text-xs py-1 px-2.5"
                  >
                    {signing === signer.id ? (
                      <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Fingerprint className="w-3 h-3" />
                    )}
                    eSign
                  </button>
                </div>
              )}
            </div>

            {/* Objection input */}
            {objecting === signer.id && onObject && (
              <div className="mt-1.5 ml-10 flex gap-2 animate-fade-in">
                <input
                  autoFocus
                  value={objectionText}
                  onChange={(e) => setObjectionText(e.target.value)}
                  placeholder="State reason for objection..."
                  className="flex-1 bg-gray-800 border border-red-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-red-500"
                />
                <button
                  onClick={() => handleObject(signer)}
                  disabled={!objectionText.trim() || signing === signer.id}
                  className="btn-danger text-xs py-1.5 px-3"
                >
                  File Objection
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Completion banner */}
      {allDone && (
        <div className="mt-4 flex items-center gap-2 bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-brand-400 shrink-0" />
          <span className="text-brand-300 text-sm font-semibold">{completedText}</span>
          <ChevronRight className="w-4 h-4 text-brand-500 ml-auto" />
        </div>
      )}

      {/* Dispute banner */}
      {anyObjected && (
        <div className="mt-4 flex items-center gap-2 bg-red-950 border border-red-700 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-red-300 text-sm font-semibold">
            Dispute filed — case referred to court. NyayaAI brief generating.
          </span>
        </div>
      )}
    </div>
  );
}
