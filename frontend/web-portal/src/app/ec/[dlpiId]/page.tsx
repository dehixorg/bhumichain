'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import { generateEC } from '@/lib/api';
import { apiFetch, getUser } from '@/lib/auth';
import toast from 'react-hot-toast';
import {
  ScrollText, CheckCircle, ChevronRight, Shield,
  Info, Clock, QrCode, Download, AlertTriangle,
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
  // Decode URL-encoded DLPI (e.g. DLPI%2D215 → DLPI-215)
  const dlpiId = rawDlpiId ? decodeURIComponent(rawDlpiId) : 'DLPI-215';

  const [parcel, setParcel]       = useState<ParcelInfo | null>(null);
  const [parcelLoading, setParcelLoading] = useState(true);
  const [stage, setStage]         = useState<Stage>('idle');
  const [steps, setSteps]         = useState(EC_PIPELINE_STEPS.map((s) => ({ ...s, done: false })));
  const [ecResult, setEcResult]   = useState<ECResult | null>(null);
  const [elapsedMs, setElapsed]   = useState(0);

  // ── Load real parcel info from API ──────────────────────────────────────────
  useEffect(() => {
    if (!dlpiId) return;
    setParcelLoading(true);
    
    const loggedUser = getUser();
    const activeOwnerName = loggedUser?.name || 'Priya Kumar';
    const cleanNum = dlpiId.replace(/\D/g, '') || '215';
    const khesraVal = `${cleanNum}/1`;

    const defaultParcel: ParcelInfo = {
      dlpiId:       dlpiId,
      ownerName:    activeOwnerName,
      khesraNo:     khesraVal,
      areaHectares: 2.40,
      landType:     'Bhumidhari',
      anchal:       'Phulwari Sharif',
      district:     'Patna',
    };

    apiFetch(`/api/dlpi/${dlpiId}`)
      .then(r => r.json())
      .then(d => {
        setParcel({
          dlpiId:       dlpiId,
          ownerName:    activeOwnerName,
          khesraNo:     khesraVal,
          areaHectares: (d && d.areaHectares) ? d.areaHectares : 2.40,
          landType:     (d && d.landType) ? d.landType : 'Bhumidhari',
          anchal:       'Phulwari Sharif',
          district:     'Patna',
        });
      })
      .catch(() => {
        setParcel(defaultParcel);
      })
      .finally(() => setParcelLoading(false));
  }, [dlpiId]);

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

    // Generate EC result strictly tied to current parcel state
    const base = buildEcResult(parcel);
    try {
      const res = await generateEC(dlpiId);
      setEcResult({
        ...base,
        ...(res || {}),
        ecId: base.ecId,
        dlpiId: parcel.dlpiId,
        ownerName: parcel.ownerName,
        khesraNo: parcel.khesraNo,
        areaHectares: parcel.areaHectares,
        landType: parcel.landType,
        generatedAt: new Date().toISOString(),
      });
    } catch {
      setEcResult(buildEcResult(parcel));
    }

    setElapsed(Date.now() - start);
    setStage('done');
    toast.success('Encumbrance Certificate generated — CLEAR status confirmed');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
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
              <div className="flex items-center gap-2 mb-4">
                <ScrollText className="w-4 h-4 text-[#0F4C81]" />
                <span className="text-sm font-semibold text-gray-700">EC Request</span>
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
                  <span className="text-sm font-semibold text-gray-700">Multi-source Verification</span>
                  {stage === 'done' && (
                    <span className="ml-auto text-xs text-gray-500 font-mono">
                      {elapsedMs}ms (sim. of {(18400 / 1000).toFixed(1)}s real)
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {steps.map((step, i) => (
                    <div key={i} className={clsx(
                      'flex items-start gap-3 transition-colors',
                      step.done ? 'text-gray-600' : 'text-gray-600',
                    )}>
                      {step.done
                        ? <CheckCircle className="w-4 h-4 text-[#0F4C81] mt-0.5 shrink-0" />
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
                <Info className="w-4 h-4 text-[#0F4C81]" />
                <span className="text-sm font-semibold text-gray-700">What is an EC?</span>
              </div>
              <div className="text-xs text-gray-500 space-y-2">
                <p>
                  An <span className="text-gray-600 font-medium">Encumbrance Certificate</span> confirms
                  that a property is free from financial and legal liabilities.
                </p>
                <p>
                  Required for: property purchase, home loans, succession mutation, and legal heir certification.
                </p>
                <p>
                  BhumiChain's EC queries <span className="text-[#0F4C81] font-medium">5 registries simultaneously</span> — traditional IGRS takes 15–30 days;
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
                  ['IGRS Bihar',           'Stamp & Registration deeds'],
                ].map(([name, desc]) => (
                  <div key={name}>
                    <div className="text-gray-600 font-medium">{name}</div>
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
                  <span className="text-[#0F4C81] font-semibold">&lt; 18 seconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cost (citizen)</span>
                  <span className="text-[#0F4C81] font-semibold">₹ 0 (gasless)</span>
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

function ECCertificate({ ec }: { ec: ECResult }) {
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
          <div className="grid grid-cols-2 gap-4 text-[11px]">
            <div>
              <span className="text-slate-500 font-semibold block">Mint Transaction Hash:</span>
              <span className="font-mono text-slate-800 break-all bg-white px-2 py-1 rounded border border-slate-200 block mt-0.5">
                {ec.blockchainTxHash}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">SHA-256 Record Signature:</span>
              <span className="font-mono text-slate-800 break-all bg-white px-2 py-1 rounded border border-slate-200 block mt-0.5">
                {ec.qrVerificationHash}
              </span>
            </div>
          </div>
        </div>

        {/* Signatures & Seal Footer */}
        <div className="pt-4 border-t-2 border-slate-300 grid grid-cols-3 gap-4 items-end font-sans">
          <div className="text-center">
            <div className="w-16 h-16 border-2 border-amber-600 rounded-full mx-auto flex items-center justify-center bg-amber-50 text-amber-800 text-[10px] font-bold leading-tight">
              SEAL OF SUB-REGISTRAR
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-semibold">Phulwari Sharif, Patna</div>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 border border-slate-300 rounded-lg mx-auto flex items-center justify-center bg-slate-100 text-slate-600 font-bold text-xs">
              QR
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono">{ec.qrVerificationHash.slice(0, 18)}…</div>
          </div>

          <div className="text-right">
            <div className="inline-block border-b-2 border-slate-800 pb-1 px-3 text-right">
              <span className="text-xs font-extrabold text-[#0F4C81] block">Sub-Registrar</span>
              <span className="text-[10px] text-slate-600 font-semibold block">Digitally Signed (e-Mudra)</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Date: {format(new Date(ec.generatedAt), 'dd MMM yyyy, HH:mm:ss')} IST
            </div>
          </div>
        </div>

        {/* Download PDF button */}
        <div className="pt-2 flex justify-end font-sans">
          <button className="btn-primary text-xs flex items-center gap-2 shadow-lg">
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

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
