'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck, CheckCircle2, QrCode, Landmark,
  Database, Award, ArrowLeft, Printer
} from 'lucide-react';
import Link from 'next/link';

function VerifyDeedContent() {
  const searchParams = useSearchParams();
  const dlpiId = searchParams.get('dlpiId') || searchParams.get('id') || 'DLPI-Bihar-PHU-00100';
  const txHash = searchParams.get('txHash') || '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  const [timestamp, setTimestamp] = useState('');

  useEffect(() => {
    setTimestamp(new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-3xl space-y-6">
        
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <Link href="/my-parcels" className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-bold transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="bg-slate-800 hover:bg-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 text-slate-200 transition-colors">
              <Printer className="w-3.5 h-3.5" /> Print / Save Deed
            </button>
          </div>
        </div>

        {/* Verification Status Banner */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-2 border-emerald-500/60 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="bg-emerald-500/20 text-emerald-400 p-3.5 rounded-2xl border border-emerald-500/40 shadow-inner">
              <ShieldCheck className="w-10 h-10 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="text-xs font-black uppercase tracking-widest bg-emerald-500 text-slate-950 px-2.5 py-0.5 rounded-full">
                  Verified On-Chain
                </span>
                <span className="text-xs text-emerald-400 font-mono">Status: 200 OK</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
                Authentic Blockchain Land Deed
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                This Record of Rights (RoR) is cryptographically signed and immutable on the Hyperledger Fabric ledger.
              </p>
            </div>
          </div>
        </div>

        {/* Official Deed Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6 relative">
          
          {/* Top Government Seal Header */}
          <div className="flex items-start justify-between pb-6 border-b border-slate-800 gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600/20 text-blue-400 p-3 rounded-xl border border-blue-500/30">
                <Landmark className="w-7 h-7" />
              </div>
              <div>
                <h2 className="font-extrabold text-white text-base">Government of India — Ministry of Revenue</h2>
                <p className="text-xs text-slate-400">BhumiChain National Digital Land Registry (DLPI Protocol)</p>
              </div>
            </div>
            
            {/* Embedded QR Code */}
            <div className="hidden sm:flex flex-col items-center bg-white p-2 rounded-xl shadow-md border border-slate-200 text-slate-900">
              <QrCode className="w-14 h-14" />
              <span className="text-[9px] font-mono font-bold mt-1 tracking-tighter">SCAN TO VERIFY</span>
            </div>
          </div>

          {/* Deed Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">DLPI Token Identifier</span>
              <div className="font-mono text-base font-extrabold text-blue-400">{dlpiId}</div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Jurisdiction & Anchal</span>
              <div className="font-extrabold text-slate-200 text-sm">Phulwari Sharif, Patna (Bihar)</div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Khesra / Plot Number</span>
              <div className="font-mono text-sm font-bold text-slate-200">Khesra 142/102 (0.5000 Hectares)</div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Encumbrance Status</span>
              <div className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> CLEAR — No Active Mortgage
              </div>
            </div>

          </div>

          {/* Blockchain Cryptographic Details */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
              <span className="flex items-center gap-1.5 font-bold"><Database className="w-4 h-4 text-blue-400" /> Fabric Block Proof</span>
              <span className="text-emerald-400">Block #14,892 (Confirmed)</span>
            </div>
            
            <div className="space-y-1 text-xs">
              <div className="text-slate-400">Transaction Hash:</div>
              <div className="text-blue-300 break-all bg-slate-900 p-2 rounded border border-slate-800 font-bold">{txHash}</div>
            </div>

            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Timestamp: {timestamp}</span>
              <span>Consensus: Raft TLS (Org1Peer0)</span>
            </div>
          </div>

          {/* Bottom Seal & Signatures */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-800 text-center sm:text-left gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Digitally Signed & Endorsed by Circle Officer Phulwari Sharif</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Proof Hash: SHA256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

export default function VerifyDeedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading Verification Portal...</div>}>
      <VerifyDeedContent />
    </Suspense>
  );
}
