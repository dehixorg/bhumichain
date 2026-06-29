'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import { generateEC, getDemoToken } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ScrollText, CheckCircle, ChevronRight, Shield,
  Info, Clock, QrCode, Download, AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

// ─── Demo constants ───────────────────────────────────────────────────────────

const DEMO_DLPI = 'DLPI-UP-DAD-00100';

const EC_PIPELINE_STEPS = [
  { label: 'BhumiChain ledger scan',            detail: 'Reading all on-chain transactions for parcel',       ms: 2100 },
  { label: 'CERSAI mortgage registry query',    detail: 'Central Registry of Securitisation — loan check',   ms: 4200 },
  { label: 'eCourts injunction database',       detail: 'Scanning UP & National court orders',               ms: 5800 },
  { label: 'IT Department attachment registry', detail: 'Income Tax demand / PMLA attachment check',         ms: 3700 },
  { label: 'Stamp & Registration records',      detail: 'UP IGRS — historical deed verification',            ms: 2600 },
];

const DEMO_EC_RESULT = {
  ecId:              'EC-DLPI-UP-DAD-00100-e5f6a7b8',
  dlpiId:            'DLPI-UP-DAD-00100',
  ownerName:         'Deepak Narayan Singh',
  khasraNo:          '402/1',
  areaHectares:      1.25,
  landType:          'Bhumidhari',
  reportPeriodFrom:  '2010-01-01',
  reportPeriodTo:    '2026-06-30',
  encumbrances:      [] as { type: string; detail: string; since: string }[],
  summary:           'CLEAR — No active encumbrances, mortgages, injunctions, income-tax attachments, or PMLA freezes on this parcel for the period 2010–2026.',
  qrVerificationHash:'ec-qr-sha256:f7e8d9c0b1a2f3e4d5c6b7a8',
  validUntil:        '2026-07-31T23:59:59Z',
  generatedAt:       new Date().toISOString(),
  generationTimeMs:  18_400,
  issuedBy:          'Sub-Registrar Office, Dadri (UP IGRS)',
};

type Stage = 'idle' | 'generating' | 'done' | 'error';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ECPage() {
  const [stage, setStage]         = useState<Stage>('idle');
  const [steps, setSteps]         = useState(EC_PIPELINE_STEPS.map((s) => ({ ...s, done: false })));
  const [ecResult, setEcResult]   = useState<typeof DEMO_EC_RESULT | null>(null);
  const [elapsedMs, setElapsed]   = useState(0);

  useEffect(() => {
    getDemoToken('citizen', 'Demo Citizen').catch(() => {});
  }, []);

  const handleGenerate = async () => {
    setStage('generating');
    setSteps(EC_PIPELINE_STEPS.map((s) => ({ ...s, done: false })));
    setElapsed(0);

    const start = Date.now();
    // Animate pipeline steps proportionally to their ms
    for (let i = 0; i < EC_PIPELINE_STEPS.length; i++) {
      await delay(EC_PIPELINE_STEPS[i].ms / 5); // 5× faster for demo
      setSteps((prev) => prev.map((s, idx) => idx <= i ? { ...s, done: true } : s));
    }

    // Try real API, fall back to mock
    try {
      const res = await generateEC(DEMO_DLPI);
      setEcResult({ ...DEMO_EC_RESULT, ...res, generatedAt: new Date().toISOString() });
    } catch {
      setEcResult({ ...DEMO_EC_RESULT, generatedAt: new Date().toISOString() });
    }

    setElapsed(Date.now() - start);
    setStage('done');
    toast.success('Encumbrance Certificate generated — CLEAR status confirmed');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar demoMode />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Topbar */}
        <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-3 shrink-0">
          <ScrollText className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-semibold text-gray-200">Encumbrance Certificate</span>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
            <Shield className="w-3.5 h-3.5" />
            Multi-source cross-verification · IGRS UP
          </div>
        </div>

        <div className="flex-1 flex gap-6 p-6">

          {/* ── Left: main ─────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Request card */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <ScrollText className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-semibold text-gray-200">EC Request</span>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 space-y-2 mb-4">
                <InfoRow label="DLPI"         value={DEMO_DLPI} mono />
                <InfoRow label="Parcel Owner" value="Deepak Narayan Singh" />
                <InfoRow label="Khasra No."   value="402/1" mono />
                <InfoRow label="Report Period" value="01 Jan 2010 → 30 Jun 2026" />
                <InfoRow label="Purpose"      value="Succession / Title Verification" />
              </div>
              {stage === 'idle' && (
                <button onClick={handleGenerate} className="btn-primary flex items-center gap-2">
                  <ScrollText className="w-4 h-4" />
                  Generate EC
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Pipeline */}
            {(stage === 'generating' || stage === 'done') && (
              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className={clsx('w-4 h-4 text-brand-400', stage === 'generating' && 'animate-pulse')} />
                  <span className="text-sm font-semibold text-gray-200">Multi-source Verification</span>
                  {stage === 'done' && (
                    <span className="ml-auto text-xs text-gray-500 font-mono">
                      {elapsedMs}ms (sim. of {(DEMO_EC_RESULT.generationTimeMs / 1000).toFixed(1)}s real)
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {steps.map((step, i) => (
                    <div key={i} className={clsx(
                      'flex items-start gap-3 transition-colors',
                      step.done ? 'text-gray-300' : 'text-gray-600',
                    )}>
                      {step.done
                        ? <CheckCircle className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
                        : <div className="w-4 h-4 border border-gray-600 rounded-full mt-0.5 shrink-0 animate-pulse" />
                      }
                      <div>
                        <div className="text-sm">{step.label}</div>
                        <div className="text-xs text-gray-600 mt-0.5">{step.detail}</div>
                      </div>
                      {step.done && (
                        <span className="ml-auto text-xs text-gray-600 font-mono shrink-0 mt-0.5">
                          {(step.ms / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* EC Certificate */}
            {stage === 'done' && ecResult && (
              <ECCertificate ec={ecResult} />
            )}
          </div>

          {/* ── Right: info ─────────────────────────────────────────────── */}
          <div className="w-72 shrink-0 space-y-4">

            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-semibold text-gray-200">What is an EC?</span>
              </div>
              <div className="text-xs text-gray-500 space-y-2">
                <p>
                  An <span className="text-gray-300 font-medium">Encumbrance Certificate</span> confirms
                  that a property is free from financial and legal liabilities.
                </p>
                <p>
                  Required for: property purchase, home loans, succession mutation, and legal heir certification.
                </p>
                <p>
                  BhumiChain's EC queries <span className="text-brand-400 font-medium">5 registries simultaneously</span> — traditional IGRS takes 15–30 days;
                  BhumiChain delivers in &lt; 18 seconds.
                </p>
              </div>
            </div>

            <div className="card">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Data Sources
              </div>
              <div className="space-y-2.5 text-xs">
                {[
                  ['BhumiChain Ledger',     'On-chain transaction history'],
                  ['CERSAI',               'Central mortgage registry'],
                  ['eCourts Portal',       'Court orders & injunctions'],
                  ['IT Department (CBDT)', 'Tax attachment registry'],
                  ['IGRS UP',              'Stamp & Registration deeds'],
                ].map(([name, desc]) => (
                  <div key={name}>
                    <div className="text-gray-300 font-medium">{name}</div>
                    <div className="text-gray-600">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Speed Comparison
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Traditional IGRS</span>
                  <span className="text-red-400 font-semibold">15–30 days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">BhumiChain EC</span>
                  <span className="text-brand-400 font-semibold">&lt; 18 seconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cost (citizen)</span>
                  <span className="text-brand-400 font-semibold">₹ 0 (gasless)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EC Certificate component ────────────────────────────────────────────────

function ECCertificate({ ec }: { ec: typeof DEMO_EC_RESULT }) {
  const isClear = ec.encumbrances.length === 0;

  return (
    <div className="border-2 border-brand-700 rounded-2xl overflow-hidden">
      {/* Certificate header */}
      <div className="bg-gradient-to-r from-brand-900 to-brand-950 border-b border-brand-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-brand-200 font-bold text-base">ENCUMBRANCE CERTIFICATE</div>
            <div className="text-brand-500 text-xs mt-0.5">भार प्रमाण पत्र — BhumiChain Digital EC</div>
          </div>
          <div className="flex items-center gap-2">
            {isClear
              ? <div className="flex items-center gap-1.5 bg-brand-800 text-brand-200 px-3 py-1.5 rounded-full text-sm font-bold">
                  <CheckCircle className="w-4 h-4" />
                  CLEAR
                </div>
              : <div className="flex items-center gap-1.5 bg-red-900 text-red-200 px-3 py-1.5 rounded-full text-sm font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  ENCUMBERED
                </div>
            }
          </div>
        </div>
      </div>

      {/* Certificate body */}
      <div className="p-6 bg-gray-900 space-y-4">

        <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
          <InfoRow label="EC Number"     value={ec.ecId} mono />
          <InfoRow label="DLPI"          value={ec.dlpiId} mono />
          <InfoRow label="Owner"         value={ec.ownerName} />
          <InfoRow label="Khasra No."    value={ec.khasraNo || '402/1'} mono />
          <InfoRow label="Land Type"     value={ec.landType || 'Bhumidhari'} />
          <InfoRow label="Area"          value={`${ec.areaHectares || 1.25} hectares`} />
          <InfoRow
            label="Report Period"
            value={`${format(new Date(ec.reportPeriodFrom), 'dd MMM yyyy')} — ${format(new Date(ec.reportPeriodTo), 'dd MMM yyyy')}`}
          />
          <InfoRow
            label="Valid Until"
            value={format(new Date(ec.validUntil), 'dd MMM yyyy')}
          />
          <InfoRow label="Issued By"     value={ec.issuedBy || 'Sub-Registrar Office, Dadri'} />
          <InfoRow
            label="Generated"
            value={format(new Date(ec.generatedAt), 'dd MMM yyyy, HH:mm:ss')}
          />
        </div>

        {/* Summary */}
        <div className={clsx(
          'border rounded-xl px-4 py-3 text-sm',
          isClear
            ? 'bg-brand-950 border-brand-800 text-brand-300'
            : 'bg-red-950 border-red-800 text-red-300',
        )}>
          {ec.summary}
        </div>

        {/* Encumbrances table (if any) */}
        {ec.encumbrances.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Active Encumbrances</div>
            {ec.encumbrances.map((enc, i) => (
              <div key={i} className="bg-red-950 border border-red-800 rounded-lg px-3 py-2.5 mb-2 text-sm">
                <div className="text-red-300 font-semibold">{enc.type}</div>
                <div className="text-red-500 text-xs mt-0.5">{enc.detail}</div>
                <div className="text-gray-600 text-xs mt-0.5">Since {enc.since}</div>
              </div>
            ))}
          </div>
        )}

        {/* QR & Download row */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-800">
          <div className="flex items-center gap-2 text-xs">
            <QrCode className="w-4 h-4 text-gray-400" />
            <span className="text-gray-500">Verify: </span>
            <span className="text-gray-400 font-mono text-xs">{ec.qrVerificationHash.slice(0, 32)}…</span>
          </div>
          <button className="btn-ghost flex items-center gap-1.5 text-xs py-1.5 px-3">
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-500 text-sm shrink-0">{label}</span>
      <span className={clsx('text-gray-200 text-right text-sm break-all', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
