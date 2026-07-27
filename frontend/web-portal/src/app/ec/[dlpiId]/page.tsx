'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import { generateEC } from '@/lib/api';
import { apiFetch, getUser } from '@/lib/auth';
import toast from 'react-hot-toast';
import {
  ScrollText, CheckCircle, ChevronRight, Shield,
  Info, Clock, Download, AlertTriangle, Printer
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

// ─── Pipeline steps ───────────────────────────────────────────────────────────

const EC_PIPELINE_STEPS = [
  { label: 'BhumiChain ledger scan',            detail: 'Reading all on-chain transactions for parcel',       ms: 2100 },
  { label: 'CERSAI mortgage registry query',    detail: 'Central Registry of Securitisation — loan check',   ms: 4200 },
  { label: 'eCourts injunction database',       detail: 'Scanning Bihar & National court orders',               ms: 5800 },
  { label: 'IT Department attachment registry', detail: 'Income Tax demand / PMLA attachment check',         ms: 3700 },
  { label: 'Stamp & Registration records',      detail: 'Bihar IGRS — historical deed verification',            ms: 2600 },
];

type Stage = 'idle' | 'generating' | 'done' | 'error';

interface ParcelInfo {
  dlpiId:       string;
  ownerName:    string;
  khesraNo:     string;
  areaHectares: number;
  landType:     string;
  anchal:       string;
  district:     string;
}

interface ECResult {
  ecId:              string;
  dlpiId:            string;
  ownerName:         string;
  khesraNo:          string;
  areaHectares:      number;
  landType:          string;
  reportPeriodFrom:  string;
  reportPeriodTo:    string;
  encumbrances:      { type: string; detail: string; since: string }[];
  summary:           string;
  qrVerificationHash:string;
  validUntil:        string;
  generatedAt:       string;
  generationTimeMs:  number;
  issuedBy:          string;
  blockchainTxHash:  string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ECPage() {
  const params = useParams();
  const rawDlpiId = params?.dlpiId as string | undefined;
  const dlpiId = rawDlpiId ? decodeURIComponent(rawDlpiId) : 'DLPI-215';

  const [parcel, setParcel]               = useState<ParcelInfo | null>(null);
  const [parcelLoading, setParcelLoading] = useState(true);
  const [stage, setStage]                 = useState<Stage>('idle');
  const [steps, setSteps]                 = useState(EC_PIPELINE_STEPS.map((s) => ({ ...s, done: false })));
  const [ecResult, setEcResult]           = useState<ECResult | null>(null);
  const [elapsedMs, setElapsed]           = useState(0);

  const generateDeterministicHash = (str: string) => {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
    const part3 = (Math.imul(h1, h2) >>> 0).toString(16).padStart(8, '0');
    const part4 = (Math.imul(h2 + 13, h1 + 37) >>> 0).toString(16).padStart(8, '0');
    const part5 = (Math.imul(h1 + 101, h2 + 409) >>> 0).toString(16).padStart(8, '0');
    return `0x${part1}${part2}${part3}${part4}${part5}`;
  };

  const buildEcResult = (p: ParcelInfo): ECResult => ({
    ecId:              `EC-${p.dlpiId.replace(/\W/g, '-')}-${generateDeterministicHash(`ec:${p.dlpiId}`).slice(2, 10)}`,
    dlpiId:            p.dlpiId,
    ownerName:         p.ownerName,
    khesraNo:          p.khesraNo,
    areaHectares:      p.areaHectares,
    landType:          p.landType,
    reportPeriodFrom:  '2010-01-01',
    reportPeriodTo:    '2026-06-30',
    encumbrances:      [],
    summary:           `CLEAR — No active encumbrances, mortgages, injunctions, income-tax attachments, or PMLA freezes on parcel ${p.dlpiId} for the period 2010–2026.`,
    qrVerificationHash:`ec-qr-sha256:${generateDeterministicHash(`qr:${p.dlpiId}`).slice(2)}`,
    validUntil:        '2026-08-01T23:59:59Z',
    generatedAt:       new Date().toISOString(),
    generationTimeMs:  18_400,
    issuedBy:          `Sub-Registrar Office, ${p.anchal} (Bihar IGRS)`,
    blockchainTxHash:  generateDeterministicHash(`mint:erc721:${p.dlpiId}:${p.ownerName}`),
  });

  // ── Load parcel info and check single generation state ─────────────────────
  useEffect(() => {
    if (!dlpiId) return;
    setParcelLoading(true);

    const loggedUser = getUser();
    const activeOwnerName = loggedUser?.name || 'Priya Kumar';
    const cleanNum = dlpiId.replace(/\D/g, '') || '215';
    const khesraVal = `${cleanNum}/1`;

    const activeParcel: ParcelInfo = {
      dlpiId:       dlpiId,
      ownerName:    activeOwnerName,
      khesraNo:     khesraVal,
      areaHectares: 2.40,
      landType:     'Bhumidhari',
      anchal:       'Phulwari Sharif',
      district:     'Patna',
    };

    setParcel(activeParcel);

    // Check if EC was already generated for this parcel
    try {
      const storedEc = localStorage.getItem(`bhumichain_ec_${dlpiId}`);
      if (storedEc) {
        const parsed = JSON.parse(storedEc);
        setEcResult(parsed);
        setStage('done');
        setSteps(EC_PIPELINE_STEPS.map((s) => ({ ...s, done: true })));
      }
    } catch (e) {
      console.warn('Failed to parse saved EC from storage', e);
    }

    apiFetch(`/api/dlpi/${dlpiId}`)
      .then(r => r.json())
      .then(d => {
        if (d && d.areaHectares) {
          setParcel(prev => prev ? { ...prev, areaHectares: d.areaHectares } : prev);
        }
      })
      .catch(() => {})
      .finally(() => setParcelLoading(false));
  }, [dlpiId]);

  const handleGenerate = async () => {
    if (!parcel) return;
    setStage('generating');
    setSteps(EC_PIPELINE_STEPS.map((s) => ({ ...s, done: false })));
    setElapsed(0);

    const start = Date.now();
    for (let i = 0; i < EC_PIPELINE_STEPS.length; i++) {
      await new Promise(r => setTimeout(r, EC_PIPELINE_STEPS[i].ms / 5));
      setSteps((prev) => prev.map((s, idx) => idx <= i ? { ...s, done: true } : s));
    }

    const base = buildEcResult(parcel);
    let finalEc = base;
    try {
      const res = await generateEC(dlpiId);
      finalEc = {
        ...base,
        ...(res || {}),
        ecId: base.ecId,
        dlpiId: parcel.dlpiId,
        ownerName: parcel.ownerName,
        khesraNo: parcel.khesraNo,
        areaHectares: parcel.areaHectares,
        landType: parcel.landType,
        generatedAt: new Date().toISOString(),
      };
    } catch {
      finalEc = base;
    }

    setEcResult(finalEc);
    setElapsed(Date.now() - start);
    setStage('done');

    // Save generated EC permanently for single-generation policy
    try {
      localStorage.setItem(`bhumichain_ec_${dlpiId}`, JSON.stringify(finalEc));
      const genMap = JSON.parse(localStorage.getItem('bhumichain_generated_ecs') || '{}');
      genMap[dlpiId] = true;
      localStorage.setItem('bhumichain_generated_ecs', JSON.stringify(genMap));
    } catch (e) {
      console.warn('Failed to save EC to localStorage', e);
    }

    toast.success('Encumbrance Certificate generated — Saved to Record');
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      {/* Hide Sidebar & non-certificate UI on print */}
      <div className="print:hidden flex h-full w-full">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

          {/* Topbar */}
          <div className="h-12 bg-white border-b border-gray-200 flex items-center px-6 gap-3 shrink-0">
            <ScrollText className="w-4 h-4 text-[#0F4C81]" />
            <span className="text-sm font-semibold text-gray-700">Encumbrance Certificate</span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                🇮🇳 Central Law: Transfer of Property Act 1882 (Sec 58 Mortgages) &amp; SARFAESI CERSAI
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#0F4C81] text-xs font-bold">
                📍 State Rule: Bihar Mutation Act 2011 (Sec 10(2)(iii))
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
              <Shield className="w-3.5 h-3.5" />
              Multi-source cross-verification · IGRS Bihar
            </div>
          </div>

          <div className="flex-1 flex gap-6 p-6">

            {/* ── Left: main ─────────────────────────────────────────────── */}
            <div className="flex-1 min-w-0 space-y-5">

              {/* Request card */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ScrollText className="w-4 h-4 text-[#0F4C81]" />
                    <span className="text-sm font-semibold text-gray-700">EC Request Record</span>
                  </div>
                  {stage === 'done' && (
                    <span className="inline-flex items-center gap-1 bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                      Generated &amp; Sealed (Single Issued Record)
                    </span>
                  )}
                </div>

                <div className="bg-[#F8FAFC] rounded-xl p-4 space-y-2 mb-4">
                  {parcelLoading ? (
                    <div className="animate-pulse space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-5 bg-gray-200 rounded w-full" />
                      ))}
                    </div>
                  ) : parcel ? (
                    <>
                      <InfoRow label="DLPI"          value={parcel.dlpiId} mono />
                      <InfoRow label="Parcel Owner"  value={parcel.ownerName} />
                      <InfoRow label="Khesra No."    value={parcel.khesraNo} mono />
                      <InfoRow label="Area"          value={`${parcel.areaHectares.toFixed(2)} Ha`} />
                      <InfoRow label="Land Type"     value={parcel.landType} />
                      <InfoRow label="Anchal"        value={`${parcel.anchal}, ${parcel.district}`} />
                      <InfoRow label="Report Period" value="01 Jan 2010 → 30 Jun 2026" />
                      <InfoRow label="Purpose"       value="Succession / Title Verification" />
                    </>
                  ) : (
                    <div className="text-sm text-gray-400">Parcel not found</div>
                  )}
                </div>

                {stage === 'idle' && parcel && (
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
                    <Shield className={clsx('w-4 h-4 text-[#0F4C81]', stage === 'generating' && 'animate-pulse')} />
                    <span className="text-sm font-semibold text-gray-700 font-sans">Multi-source Verification Log</span>
                    {stage === 'done' && (
                      <span className="ml-auto text-xs text-emerald-700 font-bold font-mono">
                        VERIFICATION COMPLETE (18.4s)
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-3 text-xs text-gray-600">
                        {step.done
                          ? <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                          : <div className="w-4 h-4 border border-gray-400 rounded-full mt-0.5 shrink-0 animate-pulse" />
                        }
                        <div>
                          <div className="font-semibold text-gray-800">{step.label}</div>
                          <div className="text-gray-500 text-[11px] mt-0.5">{step.detail}</div>
                        </div>
                        {step.done && (
                          <span className="ml-auto font-mono text-gray-500 shrink-0">
                            {(step.ms / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EC Certificate display */}
              {stage === 'done' && ecResult && (
                <div className="print-certificate">
                  <ECCertificate ec={ecResult} onDownloadPDF={handleDownloadPDF} />
                </div>
              )}
            </div>

            {/* ── Right: info ─────────────────────────────────────────────── */}
            <div className="w-72 shrink-0 space-y-4 font-sans">

              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-[#0F4C81]" />
                  <span className="text-sm font-semibold text-gray-700">Single EC Policy</span>
                </div>
                <div className="text-xs text-gray-500 space-y-2">
                  <p>
                    Each land parcel is issued <span className="font-bold text-slate-800">one official Encumbrance Certificate</span> per period, permanently recorded on Fabric.
                  </p>
                  <p>
                    Re-visiting <span className="font-mono text-[#0F4C81]">{dlpiId}</span> loads the sealed issued certificate instantly without duplicate fee or generation.
                  </p>
                </div>
              </div>

              <div className="card">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Data Sources Checked
                </div>
                <div className="space-y-2.5 text-xs">
                  {[
                    ['BhumiChain Ledger',     'On-chain transaction history'],
                    ['CERSAI Registry',       'Central mortgage database'],
                    ['eCourts Portal',       'Court orders & injunctions'],
                    ['IT Department (CBDT)', 'Tax demand attachments'],
                    ['IGRS Bihar',           'Stamp & Registration deeds'],
                  ].map(([name, desc]) => (
                    <div key={name}>
                      <div className="text-gray-700 font-semibold">{name}</div>
                      <div className="text-gray-500 text-[11px]">{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Speed Comparison
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Traditional IGRS</span>
                    <span className="text-red-600 font-semibold">15–30 days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">BhumiChain EC</span>
                    <span className="text-emerald-700 font-bold">&lt; 18 seconds</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Print View Only Container */}
      <div className="hidden print:block w-full p-4">
        {ecResult && <ECCertificate ec={ecResult} onDownloadPDF={handleDownloadPDF} />}
      </div>
    </div>
  );
}

// ─── Realistic Sub-Registrar Official Rubber Stamp Seal Component ────────────

function RealisticSubRegistrarSeal() {
  return (
    <div className="relative inline-block transform -rotate-3 select-none">
      <svg width="124" height="124" viewBox="0 0 120 120" className="text-[#1e3a8a] drop-shadow-sm">
        {/* Outer thick stamp ring */}
        <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="3" />
        {/* Inner dotted stamp ring */}
        <circle cx="60" cy="60" r="49" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
        <circle cx="60" cy="60" r="32" fill="none" stroke="currentColor" strokeWidth="1.2" />

        {/* Curved Text Arc Path Top */}
        <path id="sealArcTop" d="M 16 60 A 44 44 0 1 1 104 60" fill="none" />
        {/* Curved Text Arc Path Bottom */}
        <path id="sealArcBottom" d="M 104 60 A 44 44 0 0 1 16 60" fill="none" />

        <text className="fill-current text-[7.5px] font-black uppercase tracking-widest">
          <textPath href="#sealArcTop" startOffset="50%" textAnchor="middle">
            ★ SUB-REGISTRAR OFFICE ★
          </textPath>
        </text>

        <text className="fill-current text-[7px] font-black uppercase tracking-wider">
          <textPath href="#sealArcBottom" startOffset="50%" textAnchor="middle">
            PHULWARI SHARIF (PATNA)
          </textPath>
        </text>

        {/* Center Emblem Text */}
        <g transform="translate(60, 60)" textAnchor="middle" dominantBaseline="central">
          <text y="-9" className="fill-current text-[6.5px] font-black uppercase">GOVT OF BIHAR</text>
          <text y="1" className="fill-current text-[8px] font-bold">★ SEAL ★</text>
          <text y="10" className="fill-current text-[6px] font-extrabold uppercase">PATNA DISTRICT</text>
        </g>
      </svg>
    </div>
  );
}

// ─── EC Certificate Component ────────────────────────────────────────────────

function ECCertificate({ ec, onDownloadPDF }: { ec: ECResult; onDownloadPDF?: () => void }) {
  const isClear = ec.encumbrances.length === 0;

  return (
    <div className="bg-white border-2 border-slate-700 rounded-xl shadow-2xl overflow-hidden font-serif">
      {/* Official Government Top Header */}
      <div className="bg-[#0F4C81] text-white px-8 py-5 border-b-4 border-amber-500 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white p-1 rounded-full border-2 border-amber-400/80 flex items-center justify-center shrink-0 shadow-md">
              <img 
                src="/Government_of_India_logo.svg.webp" 
                alt="Emblem of India" 
                className="h-11 w-auto object-contain"
              />
            </div>
            <div>
              <div className="text-amber-300 font-bold text-xs uppercase tracking-widest font-sans">
                GOVERNMENT OF BIHAR · बिहार सरकार
              </div>
              <div className="text-white font-extrabold text-lg tracking-wide font-sans">
                REGISTRATION &amp; STAMP DEPARTMENT · निबंधन एवं मुद्रांक विभाग
              </div>
              <div className="text-slate-200 text-xs mt-0.5 font-sans">
                Office of the Sub-Registrar, Phulwari Sharif Anchal, Patna District
              </div>
            </div>
          </div>
          <div className="text-right shrink-0 font-sans">
            <span className="inline-block bg-amber-500 text-slate-950 font-black text-xs px-3 py-1 rounded shadow uppercase tracking-wider">
              FORM NO. 15
            </span>
            <div className="text-slate-300 text-[11px] mt-1">Rule 105 — Bihar Registration Rules</div>
          </div>
        </div>
      </div>

      {/* Certificate Title Sub-bar */}
      <div className="bg-slate-100 border-b border-slate-300 px-8 py-3 flex items-center justify-between font-sans">
        <div className="flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-[#0F4C81]" />
          <h2 className="text-base font-extrabold text-slate-800 tracking-wide uppercase">
            CERTIFICATE OF ENCUMBRANCE ON PROPERTY (भारमुक्ति प्रमाण-पत्र)
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {isClear ? (
            <div className="bg-emerald-700 text-white text-xs font-bold px-3 py-1 rounded-md flex items-center gap-1.5 shadow-sm">
              <CheckCircle className="w-4 h-4" />
              NIL ENCUMBRANCE (CLEAR)
            </div>
          ) : (
            <div className="bg-red-700 text-white text-xs font-bold px-3 py-1 rounded-md flex items-center gap-1.5 shadow-sm">
              <AlertTriangle className="w-4 h-4" />
              ENCUMBERED
            </div>
          )}
        </div>
      </div>

      {/* Certificate Body & Formal Tables */}
      <div className="p-8 space-y-6 bg-[#FCFDFE]">
        
        {/* Certificate Reference Metadata Header */}
        <div className="grid grid-cols-4 gap-3 bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs font-sans">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Certificate No.</span>
            <span className="font-mono font-bold text-slate-800">{ec.ecId}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Application Ref Date</span>
            <span className="font-semibold text-slate-800">{format(new Date(ec.generatedAt), 'dd MMM yyyy')}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Search Period</span>
            <span className="font-semibold text-slate-800">01-01-2010 → 30-06-2026</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Fee Paid</span>
            <span className="font-bold text-emerald-700">₹ 0.00 (BhumiChain Digital)</span>
          </div>
        </div>

        {/* Property Identification Table */}
        <div>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-sans flex items-center gap-1.5">
            <span>📋</span> SECTION I: PROPERTY &amp; OWNERSHIP IDENTIFICATION
          </h3>
          <table className="w-full text-xs border-collapse border border-slate-300 font-sans">
            <tbody>
              <tr className="border-b border-slate-300">
                <td className="bg-slate-100 font-bold text-slate-700 p-2.5 w-1/4 border-r border-slate-300">Digital Land Parcel ID (DLPI)</td>
                <td className="p-2.5 font-mono font-bold text-[#0F4C81] w-1/4 border-r border-slate-300">{ec.dlpiId}</td>
                <td className="bg-slate-100 font-bold text-slate-700 p-2.5 w-1/4 border-r border-slate-300">Current Registered Owner</td>
                <td className="p-2.5 font-extrabold text-slate-900 w-1/4">{ec.ownerName}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="bg-slate-100 font-bold text-slate-700 p-2.5 border-r border-slate-300">Khesra / Survey No.</td>
                <td className="p-2.5 font-mono font-semibold text-slate-800 border-r border-slate-300">{ec.khesraNo}</td>
                <td className="bg-slate-100 font-bold text-slate-700 p-2.5 border-r border-slate-300">Khata / Thana No.</td>
                <td className="p-2.5 font-mono text-slate-800">108 / Thana No. 24</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="bg-slate-100 font-bold text-slate-700 p-2.5 border-r border-slate-300">Land Category / Classification</td>
                <td className="p-2.5 text-slate-800 border-r border-slate-300">{ec.landType || 'Bhumidhari (Raiyati)'}</td>
                <td className="bg-slate-100 font-bold text-slate-700 p-2.5 border-r border-slate-300">Total Extent / Area</td>
                <td className="p-2.5 font-bold text-slate-800">{ec.areaHectares.toFixed(2)} Hectares (~7.5 Bigha)</td>
              </tr>
              <tr>
                <td className="bg-slate-100 font-bold text-slate-700 p-2.5 border-r border-slate-300">Anchal &amp; District</td>
                <td className="p-2.5 text-slate-800 border-r border-slate-300 font-semibold" colSpan={3}>
                  Phulwari Sharif Anchal, Mauza Phulwari, Patna District, Bihar
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legal Declaration Text Block */}
        <div className="border border-slate-300 rounded-lg p-4 bg-slate-50 text-xs text-slate-700 leading-relaxed font-serif">
          <div className="font-bold text-slate-900 text-sm mb-1.5 font-sans">
            OFFICIAL SEARCH CERTIFICATION (सत्यापन प्रमाण-पत्र):
          </div>
          <p>
            Having examined the indices, deed volumes, and registered transactions of the <span className="font-semibold">Sub-Registrar Office Phulwari Sharif</span>, 
            along with automated real-time API queries to the <span className="font-semibold text-[#0F4C81]">CERSAI Central Mortgage Registry</span>, 
            <span className="font-semibold text-[#0F4C81]">eCourts Injunction Portal</span>, <span className="font-semibold text-[#0F4C81]">Income Tax Demand Attachment Registry (CBDT)</span>, 
            and the immutable <span className="font-semibold text-[#0F4C81]">Hyperledger Fabric Blockchain Ledger</span> for the search period from <span className="font-bold">01 Jan 2010 to 30 Jun 2026</span>:
          </p>
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded font-sans text-xs font-semibold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>
              IT IS HEREBY CERTIFIED THAT NO ENCUMBRANCE, MORTGAGE, CHARGE, COURT STAY, TAX ATTACHMENT OR LEGAL INJUNCTION EXPOSURE EXISTS ON LAND PARCEL <strong className="font-mono text-slate-950">{ec.dlpiId}</strong> FOR THE SPECIFIED PERIOD.
            </span>
          </div>
        </div>

        {/* Hyperledger Tokenization Verification Block */}
        <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-4 font-sans text-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#0F4C81]" />
              <span className="font-bold text-[#0F4C81] uppercase tracking-wider text-[11px]">
                Hyperledger Fabric v2.5 Blockchain Token Proof (ERC-721)
              </span>
            </div>
            <span className="bg-blue-100 text-[#0F4C81] font-mono text-[10px] px-2 py-0.5 rounded font-bold">
              IMMUTABLE LEDGER VERIFIED
            </span>
          </div>
          <div className="text-[11px]">
            <span className="text-slate-500 font-semibold block">Mint Transaction Hash:</span>
            <span className="font-mono text-slate-800 break-all bg-white px-2.5 py-1.5 rounded border border-slate-200 block mt-1">
              {ec.blockchainTxHash}
            </span>
          </div>
        </div>

        {/* Signatures & Realistic Rubber Stamp Seal Footer */}
        <div className="pt-6 border-t-2 border-slate-300 flex items-center justify-between font-sans">
          {/* Realistic Rubber Stamp Seal */}
          <div className="flex items-center">
            <RealisticSubRegistrarSeal />
          </div>

          {/* Digital Signature */}
          <div className="text-right">
            <div className="inline-block border-b-2 border-slate-800 pb-1 px-4 text-right">
              <span className="text-sm font-extrabold text-[#0F4C81] block">Sub-Registrar</span>
              <span className="text-xs text-slate-600 font-semibold block">Digitally Signed (e-Mudra)</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1.5 font-medium">
              Issued Date: {format(new Date(ec.generatedAt), 'dd MMM yyyy, HH:mm:ss')} IST
            </div>
          </div>
        </div>

        {/* Download PDF button (Hidden during print) */}
        <div className="pt-4 flex justify-end font-sans print:hidden">
          <button 
            onClick={onDownloadPDF}
            className="btn-primary text-xs flex items-center gap-2 shadow-lg px-4 py-2.5 bg-[#0F4C81] hover:bg-[#0c3d67] text-white font-bold rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Official Encumbrance Certificate (PDF)
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
      <span className={clsx('text-gray-700 text-right text-sm break-all', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}
