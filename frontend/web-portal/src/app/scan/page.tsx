'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import RecordScan from '@/components/forms/RecordScan';
import { useRouter } from 'next/navigation';
import { FileText, Info } from 'lucide-react';

export default function ScanPage() {
  const router = useRouter();
  const [lastDlpi, setLastDlpi] = useState<string | null>(null);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar demoMode />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top bar */}
        <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-3 shrink-0">
          <FileText className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-semibold text-gray-200">RecordScan AI</span>
          <span className="text-xs text-gray-500">— Demo Scene 2</span>
          <div className="ml-auto flex items-center gap-2 text-xs text-gray-600">
            <span className="px-2 py-0.5 bg-gray-800 rounded font-mono">Azure Doc Intelligence</span>
            <span className="px-2 py-0.5 bg-gray-800 rounded font-mono">LayoutLM NER</span>
            <span className="px-2 py-0.5 bg-gray-800 rounded font-mono">DynamoDB</span>
            <span className="px-2 py-0.5 bg-gray-800 rounded font-mono">IPFS</span>
          </div>
        </div>

        <div className="flex-1 flex gap-6 p-6">
          {/* Main form */}
          <div className="flex-1 min-w-0">
            <RecordScan
              onDlpiCreated={(dlpiId) => {
                setLastDlpi(dlpiId);
              }}
            />

            {lastDlpi && (
              <div className="mt-4 flex items-center gap-3 bg-brand-950 border border-brand-800 rounded-xl px-4 py-3">
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                <span className="text-brand-300 text-sm font-semibold">{lastDlpi} is live on BhumiChain</span>
                <button
                  onClick={() => router.push('/map')}
                  className="ml-auto btn-primary text-xs py-1.5"
                >
                  View on Map
                </button>
              </div>
            )}
          </div>

          {/* Side info panel */}
          <div className="w-72 shrink-0 space-y-4">
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-semibold text-gray-200">How it works</span>
              </div>
              <ol className="space-y-3 text-xs text-gray-400">
                {[
                  ['Upload', 'Drop UP Khatauni (खतौनी) image or PDF — any year'],
                  ['OCR', 'Azure Document Intelligence reads Devanagari + tabular Khatauni format'],
                  ['NER', 'LayoutLM extracts khata no., khasra, area, bhumi prakar, khatedar'],
                  ['Validate', 'Cross-checks vs Bhulekh UP portal (bhulekh.up.gov.in)'],
                  ['DynamoDB', 'Scan job persisted to AWS DynamoDB (testArpit, ap-south-1)'],
                  ['Approve', 'Patwari reviews → DLPI created on Hyperledger Fabric ledger'],
                ].map(([title, desc], i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-5 h-5 rounded-full bg-gray-800 text-gray-300 text-xs flex items-center justify-center shrink-0 font-mono">
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-gray-300 font-medium">{title}</div>
                      <div className="text-gray-500">{desc}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="card">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Why this matters
              </div>
              <div className="space-y-2 text-xs text-gray-500">
                <p>
                  UP has <span className="text-gray-300 font-medium">2.3 crore+</span> Khataunis,
                  many written in 1970s–90s handwritten registers. Digitisation is ongoing but slow.
                </p>
                <p>
                  RecordScan bridges the <span className="text-gray-300 font-medium">paper → blockchain</span> gap
                  without manual data entry — eliminating transcription-based mutation fraud by Lekhpals.
                </p>
                <p className="text-brand-400">
                  SVAMITVA scheme: 3.29 lakh villages targeted. GBN pilot covers 500 Khataunis in Dadri tehsil.
                </p>
              </div>
            </div>

            <div className="card">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Service status
              </div>
              <div className="space-y-1.5 text-xs">
                {[
                  ['RecordScan AI', 'localhost:8010', true],
                  ['API Gateway',   'localhost:4000', true],
                  ['DynamoDB',      'ap-south-1',     true],
                  ['IPFS node',     'localhost:5001',  false],
                ].map(([name, url, up]) => (
                  <div key={String(name)} className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${up ? 'bg-brand-400' : 'bg-gray-600'}`} />
                    <span className="text-gray-400">{name}</span>
                    <span className="ml-auto font-mono text-gray-600">{url}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
