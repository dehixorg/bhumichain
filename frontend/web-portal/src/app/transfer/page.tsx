'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import TransferWizard from '@/components/forms/TransferWizard';
import FraudReject from '@/components/modals/FraudReject';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { Transfer } from '@/types';
import toast from 'react-hot-toast';
import {
  ArrowLeftRight, AlertTriangle, Lock, CheckCircle, Info,
  ChevronRight, Zap,
} from 'lucide-react';
import clsx from 'clsx';
import { demoLogin } from '@/lib/auth';

// ─── Demo constants ───────────────────────────────────────────────────────────

const DEMO_DLPI         = 'DLPI-UP-DAD-00100';
const DEMO_SELLER_NAME  = 'Ankur Singh (Legal Heir, 1/3 share)';
const DEMO_SELLER_HASH  = 'sha256:heir1ankur3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8';

const ORIGINAL_TRANSFER = {
  transferId: 'TXF-DLPI-UP-DAD-00100-b2c3d4e5',
  initiatedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
  buyerName: 'Rakesh Agarwal',
  sroName: 'Sub-Registrar Office, Dadri',
};

type Scene = 4 | 5;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransferPage() {
  const [scene, setScene]           = useState<Scene>(4);
  const [transferDone, setTransferDone] = useState(false);
  const [completedTransfer, setCompletedTransfer] = useState<Transfer | null>(null);
  const [showFraud, setShowFraud]   = useState(false);
  const [fraudAttempted, setFraudAttempted] = useState(false);

  const { on: onWs, triggerMock } = useWebSocket(DEMO_DLPI);

  useEffect(() => {
    demoLogin('tehsildar').catch(() => {});
  }, []);

  // WS event listeners
  useEffect(() => {
    return onWs('*', (msg) => {
      if (msg.event === 'TransferCompleted') {
        toast.success('Title transferred! Deed in DigiLocker.');
      }
      if (msg.event === 'TransferRejected') {
        toast.error('Transfer rejected — national lock active');
        setShowFraud(true);
      }
    });
  }, [onWs]);

  const handleTransferComplete = ({ transfer }: { transfer: Transfer; titleCID: string; txHash: string }) => {
    setCompletedTransfer(transfer);
    setTransferDone(true);
    triggerMock('scene4_transfer_initiated');
  };

  const handleFraudAttempt = () => {
    setFraudAttempted(true);
    triggerMock('scene5_dual_sale_rejected');
    setTimeout(() => setShowFraud(true), 800);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar demoMode />

      {showFraud && (
        <FraudReject
          dlpiId={DEMO_DLPI}
          attemptedBuyerName="Deepak Verma"
          fraudScore={0.94}
          rejectionCode="NATIONAL_LOCK_ACTIVE"
          originalTransfer={ORIGINAL_TRANSFER}
          responseTimeMs={28}
          onClose={() => setShowFraud(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Top bar */}
        <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-3 shrink-0">
          <ArrowLeftRight className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-semibold text-gray-200">Property Transfer</span>

          {/* Scene toggle */}
          <div className="ml-4 flex rounded-lg overflow-hidden border border-gray-700 text-xs">
            <button
              onClick={() => setScene(4)}
              className={clsx(
                'px-3 py-1.5 font-semibold transition-colors',
                scene === 4 ? 'bg-brand-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200',
              )}
            >
              Scene 4 — Sale
            </button>
            <button
              onClick={() => setScene(5)}
              className={clsx(
                'px-3 py-1.5 font-semibold transition-colors',
                scene === 5 ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200',
              )}
            >
              Scene 5 — Fraud Demo
            </button>
          </div>
        </div>

        <div className="flex-1 flex gap-6 p-6">

          {/* ── Main: Scene 4 ───────────────────────────────────────────── */}
          {scene === 4 && (
            <>
              <div className="flex-1 min-w-0">
                <TransferWizard
                  dlpiId={DEMO_DLPI}
                  sellerName={DEMO_SELLER_NAME}
                  sellerAadhaarHash={DEMO_SELLER_HASH}
                  onComplete={handleTransferComplete}
                />
              </div>
              <SceneInfo scene={4} completedTransfer={completedTransfer} />
            </>
          )}

          {/* ── Main: Scene 5 ───────────────────────────────────────────── */}
          {scene === 5 && (
            <>
              <div className="flex-1 min-w-0 space-y-5">
                {/* Status of original (Scene 4) transfer */}
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-semibold text-gray-200">
                      Original Transfer — National Lock Active
                    </span>
                  </div>
                  <div className="bg-amber-950 border border-amber-800 rounded-xl p-3 text-xs space-y-2 mb-3">
                    <InfoRow label="Parcel"       value={DEMO_DLPI} mono />
                    <InfoRow label="Buyer"        value={ORIGINAL_TRANSFER.buyerName} />
                    <InfoRow label="SRO"          value={ORIGINAL_TRANSFER.sroName} />
                    <InfoRow label="Lock acquired" value={new Date(ORIGINAL_TRANSFER.initiatedAt).toLocaleString('en-IN')} />
                    <InfoRow label="Expires"      value={new Date(new Date(ORIGINAL_TRANSFER.initiatedAt).getTime() + 86_400_000).toLocaleString('en-IN')} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-amber-400">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    24-hour cross-SRO lock · No other SRO can initiate transfer of this parcel
                  </div>
                </div>

                {/* Second terminal: attempted duplicate */}
                <div className="card border-red-900">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-semibold text-gray-200">
                      Second Terminal — Fraud Attempt
                    </span>
                    <span className="ml-auto text-xs text-gray-500">Dadri SRO Terminal 2</span>
                  </div>
                  <div className="text-gray-500 text-xs mb-4">
                    A second operator at a different terminal tries to sell the same parcel to a different buyer.
                  </div>

                  <div className="bg-gray-800 rounded-xl p-3 text-xs space-y-2 mb-4">
                    <InfoRow label="Parcel"         value={DEMO_DLPI} mono />
                    <InfoRow label="Attempted buyer" value="Deepak Verma" />
                    <InfoRow label="Declared value"  value="₹ 55,00,000" />
                    <InfoRow label="FraudSense score" value="0.94 — EXCEEDS 0.90 threshold" />
                  </div>

                  {fraudAttempted
                    ? (
                      <div className="flex items-center gap-2 bg-red-950 border border-red-700 rounded-lg px-3 py-2.5 text-sm text-red-300">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Rejected — national parcel lock active · Fraud score 0.94 logged to audit trail
                      </div>
                    )
                    : (
                      <button
                        onClick={handleFraudAttempt}
                        className="btn-danger w-full flex items-center justify-center gap-2"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        Attempt Duplicate Sale (Demo)
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )
                  }
                </div>
              </div>
              <SceneInfo scene={5} completedTransfer={null} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Right info panel ─────────────────────────────────────────────────────────

function SceneInfo({ scene, completedTransfer }: { scene: Scene; completedTransfer: Transfer | null }) {
  return (
    <div className="w-72 shrink-0 space-y-4">

      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-semibold text-gray-200">
            {scene === 4 ? 'Scene 4 flow' : 'Scene 5 flow'}
          </span>
        </div>
        {scene === 4 && (
          <ol className="space-y-2.5 text-xs text-gray-400">
            {[
              ['Buyer details',        'Name + Aadhaar + declared value'],
              ['TribalGuard check',    'Auto-runs → ALLOWED'],
              ['ValuationOracle',      'Circle rate → stamp duty = 5%'],
              ['FraudSense AI',        'Score 0.12 — CLEAN'],
              ['National parcel lock', '24-hr cross-SRO dual-sale block'],
              ['Multi-sig consent',    'Seller + buyer eSign on Fabric'],
              ['Stamp duty UPI',       '₹2.08L payment verified'],
              ['SRO execution',        'Title CID written to ledger'],
              ['DigiLocker delivery',  'Deed → buyer\'s DigiLocker'],
            ].map(([title, desc], i) => (
              <li key={i} className="flex gap-2">
                <span className="w-4 h-4 rounded-full bg-gray-800 text-gray-500 flex items-center justify-center shrink-0 font-mono text-xs">{i + 1}</span>
                <div>
                  <div className="text-gray-300">{title}</div>
                  <div className="text-gray-600">{desc}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
        {scene === 5 && (
          <ol className="space-y-2.5 text-xs text-gray-400">
            {[
              ['Scene 4 completes',    'Parcel lock acquired at Dadri SRO 1'],
              ['Second terminal',      'Operator at Dadri SRO 2 tries same parcel'],
              ['Lock check',           'Fabric checks national lock — ACTIVE'],
              ['FraudSense',           '0.94 → auto-reject threshold exceeded'],
              ['Instant rejection',    '<28ms — no on-chain write occurs'],
              ['Audit trail',          'Attempt permanently logged on BhumiChain'],
              ['Regulator alert',      'IG Registration, UP notified'],
            ].map(([title, desc], i) => (
              <li key={i} className="flex gap-2">
                <span className="w-4 h-4 rounded-full bg-gray-800 text-gray-500 flex items-center justify-center shrink-0 font-mono text-xs">{i + 1}</span>
                <div>
                  <div className="text-gray-300">{title}</div>
                  <div className="text-gray-600">{desc}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Technical spec */}
      <div className="card">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Technical
        </div>
        <div className="space-y-2 text-xs">
          <InfoRow label="Chaincode"    value="property-transfer" mono />
          <InfoRow label="Channel"      value="state-channel-up" mono />
          <InfoRow label="Consensus"    value="Raft (3 orderers)" />
          <InfoRow label="Lock scope"   value="National (all SROs)" />
          {scene === 5 && <InfoRow label="Reject latency" value="< 31ms" />}
        </div>
      </div>

      {/* Scene 4 completion status */}
      {scene === 4 && completedTransfer && (
        <div className="card border-brand-800">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-semibold text-brand-300">Transfer Complete</span>
          </div>
          <div className="text-xs space-y-1.5">
            <InfoRow label="TX ID" value={completedTransfer.transferId.slice(0, 28) + '…'} mono />
            <InfoRow label="New owner" value={completedTransfer.buyerName} />
          </div>
        </div>
      )}

      {/* Anti-fraud stats */}
      <div className="card">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            BhumiChain Protection
          </div>
        </div>
        <div className="text-xs text-gray-500 space-y-1.5">
          <p>India loses est. <span className="text-red-400 font-medium">₹40,000 Cr/year</span> to land fraud, primarily through dual-sale schemes.</p>
          <p>The national parcel lock eliminates <span className="text-brand-400 font-medium">100%</span> of dual-sale attempts by design — not by detection.</p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={clsx('text-gray-200 text-right break-all', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}
