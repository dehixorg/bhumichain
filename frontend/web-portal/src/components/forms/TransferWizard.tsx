'use client';

import React, { useState, useCallback } from 'react';
import clsx from 'clsx';
import MultiSig from '@/components/forms/MultiSig';
import {
  CheckCircle, Shield, AlertTriangle, Lock, Zap, CreditCard,
  ArrowRight, Fingerprint, ChevronRight, FileText, User,
  IndianRupee, Clock,
} from 'lucide-react';
import {
  initiateTransfer, recordConsent, confirmStampDuty, executeTransfer,
} from '@/lib/api';
import type { Transfer, TribalCheckResult } from '@/types';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransferResult {
  transfer: Transfer;
  titleCID: string;
  txHash: string;
}

interface Props {
  dlpiId: string;
  sellerName: string;
  sellerAadhaarHash: string;
  onComplete?: (result: TransferResult) => void;
}

type WizardStep = 'form' | 'compliance' | 'lock' | 'consent' | 'payment' | 'sro' | 'done';

interface ComplianceResult {
  tribal: { pass: boolean; detail: string; ms: number };
  valuation: { oracleValue: number; stampDuty: number };
  fraud: { score: number; pass: boolean };
}

// ─── Demo constants ───────────────────────────────────────────────────────────

const DEMO_BUYER = {
  name:        'Suresh Balaji Deshmukh',
  aadhaarHash: 'sha256:buyer1suresh9d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0',
  declaredINR: 4_800_000,
};

const MOCK_COMPLIANCE: ComplianceResult = {
  tribal:    { pass: true, detail: 'ALLOWED_NOT_TRIBAL — Bagayat parcel, non-scheduled area', ms: 143 },
  valuation: { oracleValue: 5_200_000, stampDuty: 208_000 },
  fraud:     { score: 0.12, pass: true },
};

const STEP_LABELS: { id: WizardStep; label: string }[] = [
  { id: 'form',       label: 'Buyer Details' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'lock',       label: 'Parcel Lock' },
  { id: 'consent',    label: 'Consent' },
  { id: 'payment',    label: 'Stamp Duty' },
  { id: 'sro',        label: 'SRO Execute' },
  { id: 'done',       label: 'Title Delivered' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TransferWizard({ dlpiId, sellerName, sellerAadhaarHash, onComplete }: Props) {
  const [step, setStep]                       = useState<WizardStep>('form');
  const [transfer, setTransfer]               = useState<Transfer | null>(null);
  const [compliance, setCompliance]           = useState<ComplianceResult | null>(null);
  const [complianceSteps, setComplianceSteps] = useState<{ label: string; done: boolean }[]>([]);
  const [busy, setBusy]                       = useState(false);
  const [upiVerified, setUpiVerified]         = useState(false);
  const [titleCID]                            = useState('QmTitleDeedSureshDeshmukh2026XYZ');

  // Form state
  const [buyerName, setBuyerName]             = useState('');
  const [buyerHash, setBuyerHash]             = useState('');
  const [declaredVal, setDeclaredVal]         = useState('');

  const prefillDemo = () => {
    setBuyerName(DEMO_BUYER.name);
    setBuyerHash(DEMO_BUYER.aadhaarHash);
    setDeclaredVal(String(DEMO_BUYER.declaredINR));
  };

  // ── Step 2: compliance check ───────────────────────────────────────────────

  const runCompliance = async () => {
    setBusy(true);
    setStep('compliance');
    const steps = [
      'Invoking TribalGuard chaincode',
      'Consulting ValuationOracle (circle rate)',
      'Computing stamp duty (max(declared, 80% oracle) × 5%)',
      'Running FraudSense AI graph analysis',
      'Acquiring national parcel lock',
    ];
    setComplianceSteps(steps.map((label) => ({ label, done: false })));

    for (let i = 0; i < steps.length; i++) {
      await delay(440);
      setComplianceSteps((prev) => prev.map((s, idx) => idx <= i ? { ...s, done: true } : s));
    }

    // Initiate transfer on-chain
    try {
      const res = await initiateTransfer({
        dlpiId,
        sellerAadhaarHash,
        buyerName:        buyerName || DEMO_BUYER.name,
        buyerAadhaarHash: buyerHash || DEMO_BUYER.aadhaarHash,
        declaredValueINR: Number(declaredVal) || DEMO_BUYER.declaredINR,
      });
      setTransfer(res);
    } catch {
      // Offline fallback
      setTransfer({
        transferId:          'TXF-DLPI-MH-SNN-00142-b2c3d4e5',
        dlpiId,
        sellerAadhaarHash,
        buyerName:           buyerName || DEMO_BUYER.name,
        buyerAadhaarHash:    buyerHash || DEMO_BUYER.aadhaarHash,
        declaredValueINR:    Number(declaredVal) || DEMO_BUYER.declaredINR,
        oracleValueINR:      5_200_000,
        stampDutyINR:        208_000,
        status:              'AWAITING_CONSENT',
        fraudScore:          0.12,
        nationalLockAcquired: true,
        lockExpiry:          new Date(Date.now() + 86_400_000).toISOString(),
        consentSeller:       false,
        consentBuyer:        false,
        initiatedAt:         new Date().toISOString(),
      });
    }

    setCompliance(MOCK_COMPLIANCE);
    setBusy(false);
    setStep('lock');
  };

  // ── Step 4: consent ────────────────────────────────────────────────────────

  const [sellerConsented, setSellerConsented] = useState(false);
  const [buyerConsented, setBuyerConsented]   = useState(false);

  const handleConsent = useCallback(async (signerId: string) => {
    const tid = transfer?.transferId || 'TXF-DLPI-MH-SNN-00142-b2c3d4e5';
    const isSeller = signerId === 'seller';
    try {
      await recordConsent(tid, {
        partyType:    isSeller ? 'SELLER' : 'BUYER',
        aadhaarHash:  isSeller ? sellerAadhaarHash : (buyerHash || DEMO_BUYER.aadhaarHash),
        eSignTxHash:  `esign-${signerId}-${Date.now()}`,
      });
    } catch { /* offline ok */ }

    if (isSeller) {
      setSellerConsented(true);
      toast.success(`${sellerName} consented ✓`);
    } else {
      setBuyerConsented(true);
      toast.success(`${buyerName || DEMO_BUYER.name} consented ✓`);
    }

    if ((isSeller && buyerConsented) || (!isSeller && sellerConsented)) {
      setTimeout(() => setStep('payment'), 600);
    }
  }, [transfer, sellerAadhaarHash, buyerHash, buyerName, sellerName, sellerConsented, buyerConsented]);

  const consentSigners = [
    {
      id: 'seller', name: sellerName, role: 'Seller',
      hasConsented: sellerConsented, hasObjected: false,
    },
    {
      id: 'buyer', name: buyerName || DEMO_BUYER.name, role: 'Buyer',
      hasConsented: buyerConsented, hasObjected: false,
    },
  ];

  // ── Step 5: UPI payment ────────────────────────────────────────────────────

  const simulateUPIPayment = async () => {
    setBusy(true);
    toast('Processing UPI payment…');
    await delay(2800);
    const tid = transfer?.transferId || 'TXF-DLPI-MH-SNN-00142-b2c3d4e5';
    try {
      await confirmStampDuty(tid, {
        upiRefNo:         `UPI-SBI-NSK-${Date.now()}`,
        saleAgreementCID: 'QmSaleAgreement2026MockCID',
      });
    } catch { /* offline ok */ }
    setUpiVerified(true);
    setBusy(false);
    toast.success('Stamp duty payment verified ✓');
    setTimeout(() => setStep('sro'), 800);
  };

  // ── Step 6: SRO execution ──────────────────────────────────────────────────

  const executeSRO = async () => {
    setBusy(true);
    toast('SRO executing transfer…');
    await delay(1800);
    const tid = transfer?.transferId || 'TXF-DLPI-MH-SNN-00142-b2c3d4e5';
    try {
      await executeTransfer(tid, titleCID);
    } catch { /* offline ok */ }
    setBusy(false);
    setStep('done');
    onComplete?.({
      transfer:  transfer!,
      titleCID,
      txHash:    '0xfabric-tx-title-transfer-' + Date.now(),
    });
    toast.success('Title transferred! Deed delivered to DigiLocker.');
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const stepIdx = STEP_LABELS.findIndex((s) => s.id === step);

  return (
    <div className="space-y-5">
      {/* Progress indicator */}
      <div className="card py-3">
        <div className="flex items-center justify-between">
          {STEP_LABELS.map(({ id, label }, i) => (
            <React.Fragment key={id}>
              <div className="flex flex-col items-center">
                <div className={clsx(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  i < stepIdx  && 'bg-brand-600 text-white',
                  i === stepIdx && 'bg-amber-500 text-white animate-pulse',
                  i > stepIdx  && 'bg-gray-700 text-gray-500',
                )}>
                  {i < stepIdx ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={clsx(
                  'text-xs mt-1 hidden md:block',
                  i === stepIdx ? 'text-amber-400' : i < stepIdx ? 'text-brand-400' : 'text-gray-600',
                )}>{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={clsx('flex-1 h-px mx-1', i < stepIdx ? 'bg-brand-700' : 'bg-gray-800')} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Step 1: Buyer form ──────────────────────────────────────────── */}
      {step === 'form' && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-semibold text-gray-200">Buyer Details</div>
            <button onClick={prefillDemo} className="text-xs text-brand-400 hover:text-brand-300 border border-brand-800 hover:border-brand-700 rounded-lg px-2.5 py-1 transition-colors">
              Demo pre-fill
            </button>
          </div>

          <div className="bg-gray-800 rounded-xl p-3 text-xs text-gray-400 space-y-1.5 mb-1">
            <InfoRow label="Seller" value={sellerName} />
            <InfoRow label="Parcel" value={dlpiId} mono />
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Buyer Full Name</label>
              <input
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="e.g. Suresh Balaji Deshmukh"
                className="input w-full"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Buyer Aadhaar Hash (SHA-256)</label>
              <input
                value={buyerHash}
                onChange={(e) => setBuyerHash(e.target.value)}
                placeholder="sha256:..."
                className="input w-full font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Declared Sale Value (INR)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                <input
                  type="number"
                  value={declaredVal}
                  onChange={(e) => setDeclaredVal(e.target.value)}
                  placeholder="4800000"
                  className="input w-full pl-7"
                />
              </div>
              {declaredVal && (
                <div className="text-xs text-gray-500 mt-1">
                  ≈ {formatINR(Number(declaredVal))}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={runCompliance}
            disabled={!buyerName && !DEMO_BUYER.name}
            className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
          >
            <Shield className="w-4 h-4" />
            Run Compliance Check
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Step 2: Compliance pipeline ────────────────────────────────── */}
      {step === 'compliance' && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-brand-400 animate-pulse" />
            <span className="text-sm font-semibold text-gray-200">Running Compliance Checks</span>
          </div>
          <div className="space-y-2.5">
            {complianceSteps.map((s, i) => (
              <div key={i} className={clsx(
                'flex items-center gap-3 text-sm transition-colors',
                s.done ? 'text-gray-300' : 'text-gray-600',
              )}>
                {s.done
                  ? <CheckCircle className="w-4 h-4 text-brand-400 shrink-0" />
                  : <div className="w-4 h-4 border border-gray-600 rounded-full shrink-0 animate-pulse" />
                }
                {s.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 3: Lock acquired ───────────────────────────────────────── */}
      {step === 'lock' && compliance && transfer && (
        <div className="space-y-4">
          {/* Compliance summary */}
          <div className="card space-y-3">
            <div className="text-sm font-semibold text-gray-200 mb-1">Compliance Results</div>

            {/* TribalGuard */}
            <div className="flex items-center gap-3 bg-brand-950 border border-brand-800 rounded-lg px-3 py-2.5">
              <CheckCircle className="w-4 h-4 text-brand-400 shrink-0" />
              <div className="flex-1 text-xs">
                <div className="text-brand-300 font-semibold">TribalGuard — ALLOWED</div>
                <div className="text-brand-500 mt-0.5">{compliance.tribal.detail} · {compliance.tribal.ms}ms</div>
              </div>
            </div>

            {/* Valuation */}
            <div className="bg-gray-800 rounded-lg px-3 py-2.5 text-xs space-y-1.5">
              <div className="text-gray-300 font-semibold">Stamp Duty Calculation</div>
              <InfoRow label="Declared value"    value={formatINR(transfer.declaredValueINR)} />
              <InfoRow label="Oracle value"      value={formatINR(transfer.oracleValueINR)} />
              <InfoRow label="Stamp duty base"   value={formatINR(transfer.declaredValueINR)} />
              <div className="border-t border-gray-700 pt-1.5">
                <InfoRow label="Stamp duty (5%)" value={formatINR(transfer.stampDutyINR)} />
              </div>
            </div>

            {/* FraudSense */}
            <div className={clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5',
              compliance.fraud.pass
                ? 'bg-brand-950 border border-brand-800'
                : 'bg-red-950 border border-red-800',
            )}>
              <div className={clsx(
                'text-xs font-mono font-bold px-2 py-1 rounded',
                compliance.fraud.pass ? 'bg-brand-900 text-brand-300' : 'bg-red-900 text-red-300',
              )}>
                {compliance.fraud.score.toFixed(2)}
              </div>
              <div className="text-xs">
                <div className={compliance.fraud.pass ? 'text-brand-300 font-semibold' : 'text-red-300 font-semibold'}>
                  FraudSense — {compliance.fraud.pass ? 'CLEAN' : 'FLAGGED'}
                </div>
                <div className={compliance.fraud.pass ? 'text-brand-500' : 'text-red-500'}>
                  Score below 0.75 threshold — transaction cleared
                </div>
              </div>
            </div>
          </div>

          {/* National lock */}
          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-amber-900 border border-amber-700 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-200">National Parcel Lock Acquired</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  24-hour cross-SRO dual-sale prevention — no other SRO can initiate transfer of {dlpiId}
                </div>
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg px-3 py-2.5 text-xs space-y-1.5">
              <InfoRow label="Lock status"  value="ACTIVE" />
              <InfoRow label="Lock expiry"  value={transfer.lockExpiry ? new Date(transfer.lockExpiry).toLocaleString('en-IN') : '24 hours'} />
              <InfoRow label="Transfer ID"  value={transfer.transferId} mono />
            </div>
            <button
              onClick={() => setStep('consent')}
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
            >
              <Fingerprint className="w-4 h-4" />
              Proceed to Multi-party Consent
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Consent ─────────────────────────────────────────────── */}
      {step === 'consent' && (
        <MultiSig
          title="Multi-party Consent"
          subtitle="Both seller and buyer must eSign — Hyperledger Fabric records each signature permanently"
          signers={consentSigners}
          onSign={handleConsent}
          completedText="Both parties consented — proceeding to stamp duty payment"
        />
      )}

      {/* ── Step 5: Stamp duty payment ─────────────────────────────────── */}
      {step === 'payment' && transfer && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-semibold text-gray-200">Stamp Duty Payment</span>
          </div>

          {/* Mock UPI QR */}
          <div className="flex flex-col items-center py-5 border border-dashed border-gray-700 rounded-xl mb-4">
            <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center mb-3">
              <div className="grid grid-cols-5 gap-0.5 p-1">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div key={i} className={clsx(
                    'w-3.5 h-3.5 rounded-[2px]',
                    (i % 7 === 0 || i % 11 === 3 || i === 12) ? 'bg-gray-900' : 'bg-white border border-gray-200',
                  )} />
                ))}
              </div>
            </div>
            <div className="text-xs text-gray-400 mb-1">Scan to pay via UPI</div>
            <div className="text-xl font-bold text-gray-100 font-mono">{formatINR(transfer.stampDutyINR)}</div>
            <div className="text-xs text-gray-500 mt-1">Maharashtra Stamp Duty — 5%</div>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
            <div className="flex-1 h-px bg-gray-800" />
            <span>or</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {upiVerified
            ? (
              <div className="flex items-center gap-2 bg-brand-950 border border-brand-700 rounded-lg px-3 py-2.5 text-sm text-brand-300">
                <CheckCircle className="w-4 h-4 shrink-0" />
                UPI payment verified — proceeding to SRO execution
              </div>
            )
            : (
              <button
                onClick={simulateUPIPayment}
                disabled={busy}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {busy
                  ? <span className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                  : <IndianRupee className="w-4 h-4" />
                }
                Simulate UPI Payment
              </button>
            )
          }
        </div>
      )}

      {/* ── Step 6: SRO execution ───────────────────────────────────────── */}
      {step === 'sro' && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-semibold text-gray-200">SRO Execution</span>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-xs space-y-1.5">
            <InfoRow label="SRO"         value="Sub-Registrar Office, Sinnar" />
            <InfoRow label="Officer"     value="Kavita Sanjay Marathe, Sub-Registrar" />
            <InfoRow label="New title CID" value={titleCID} mono />
            <InfoRow label="DigiLocker"  value="Delivery pending SRO signature" />
          </div>
          <div className="flex items-center gap-2 bg-blue-950 border border-blue-800 rounded-lg px-3 py-2.5 text-xs text-blue-300">
            <CheckCircle className="w-4 h-4 shrink-0" />
            Both parties consented + stamp duty verified — transfer ready for execution
          </div>
          <button
            onClick={executeSRO}
            disabled={busy}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {busy
              ? <span className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
              : <Zap className="w-4 h-4" />
            }
            Execute Transfer — Issue Title Deed
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Step 7: Done ────────────────────────────────────────────────── */}
      {step === 'done' && (
        <div className="card text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-brand-800 border-2 border-brand-500 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-brand-300" />
          </div>
          <div>
            <div className="text-lg font-bold text-gray-100">Transfer Complete</div>
            <div className="text-gray-500 text-sm mt-1">
              Title deed issued and delivered to {buyerName || DEMO_BUYER.name}'s DigiLocker
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-xs space-y-2 text-left">
            <InfoRow label="New owner"     value={buyerName || DEMO_BUYER.name} />
            <InfoRow label="Parcel"        value={dlpiId} mono />
            <InfoRow label="Title CID"     value={titleCID} mono />
            <InfoRow label="TX"            value={transfer?.transferId || '—'} mono />
            <InfoRow label="Completed"     value={new Date().toLocaleString('en-IN')} />
          </div>
          <div className="flex gap-3">
            <button className="btn-ghost flex-1 text-sm py-2 flex items-center justify-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Download Title Deed
            </button>
            <button className="btn-ghost flex-1 text-sm py-2 flex items-center justify-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" />
              View on Ledger
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={clsx('text-gray-200 text-right break-all', mono && 'font-mono')}>{value}</span>
    </div>
  );
}

function formatINR(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
