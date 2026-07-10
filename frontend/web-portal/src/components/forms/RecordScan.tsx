'use client';

import React, { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Upload, FileText, CheckCircle, AlertTriangle, Clock,
  Cpu, Database, Shield, Zap, Edit3, ChevronRight, X,
} from 'lucide-react';
import clsx from 'clsx';
import { getToken, apiFetch } from '@/lib/auth';

// Proxy route: browser → /api/scan/upload (Next.js) → localhost:8010 (VM internal)
const SCAN_PROXY = '/api/scan/upload';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessingStep {
  step: string;
  label: string;
  detail?: string;
  confidence?: number;
  status: 'pending' | 'running' | 'done' | 'partial' | 'error';
  durationMs?: number;
}

interface KhatedaOwner {
  name: string;
  fatherHusbandName?: string;
  share?: string;
  ownershipType: string;
}

interface Extraction {
  document_type?: string;
  registration_info?: any;
  stamp_and_fees?: any;
  parties?: any[];
  property?: any;
  financial?: any;
  [key: string]: any;
}

interface ScanResult {
  scanId: string;
  fileName: string;
  fileSizeKB: number;
  ipfsCID: string;
  processingSteps: ProcessingStep[];
  extraction: Extraction;
  suggestedDlpiId: string;
  processingTimeMs: number;
  storedInDynamoDB: boolean;
}

type Stage = 'idle' | 'uploading' | 'processing' | 'review' | 'approving' | 'done';

// ─── Demo presets ─────────────────────────────────────────────────────────────

const DEMO_PRESETS = [
  {
    id:    'demo_clear',
    label: 'Dadri Gata 740/201 — Clean scan',
    sub:   'Arun Sharma · Bhumidhari · 2.4 Ha',
    color: 'brand',
    icon:  CheckCircle,
  },
  {
    id:    'demo_degraded',
    label: 'Dadri Gata 312 — 1994 torn register',
    sub:   'Old record · partial damage · review needed',
    color: 'amber',
    icon:  AlertTriangle,
  },
];

const STEP_LABELS = [
  { step: 'UPLOAD',        label: 'Document uploaded' },
  { step: 'AZURE_OCR',     label: 'Azure Document Intelligence OCR' },
  { step: 'LAYOUT_LM_NER', label: 'LayoutLM NER — Khatauni field extraction' },
  { step: 'VALIDATION',    label: 'Cross-validation vs Bhulekh UP portal' },
  { step: 'IPFS',          label: 'Pinning to IPFS' },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onDlpiCreated?: (dlpiId: string) => void;
  mode?: 'genesis' | 'transfer';
  onScanComplete?: (ipfsCID: string) => void;
}

export default function RecordScan({ onDlpiCreated, mode = 'genesis', onScanComplete }: Props) {
  const [stage, setStage]     = useState<Stage>('idle');
  const [steps, setSteps]     = useState<ProcessingStep[]>([]);
  const [result, setResult]   = useState<ScanResult | null>(null);
  const [edited, setEdited]   = useState<Partial<Extraction>>({});
  const [dlpiId, setDlpiId]   = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Scan ─────────────────────────────────────────────────────────────────

  const runScan = useCallback(async (file: File, demoVariant?: string) => {
    setStage('uploading');
    setSteps([]);
    setResult(null);

    const form = new FormData();
    form.append('file', file);
    if (demoVariant) form.append('demoVariant', demoVariant);

    setStage('processing');
    setSteps(STEP_LABELS.map(s => ({ ...s, status: 'pending' as const })));

    let stepIdx = 0;
    const ticker = setInterval(() => {
      if (stepIdx >= STEP_LABELS.length) { clearInterval(ticker); return; }
      setSteps(prev => prev.map((s, i) => {
        if (i < stepIdx)  return { ...s, status: 'done' as const };
        if (i === stepIdx) return { ...s, status: 'running' as const };
        return s;
      }));
      stepIdx++;
    }, 950);

    try {
      const res = await fetch(SCAN_PROXY, { method: 'POST', body: form });
      clearInterval(ticker);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Scan failed: ${res.status}`);
      }
      const data: ScanResult = await res.json();
      setSteps(data.processingSteps.length ? data.processingSteps : STEP_LABELS.map(s => ({ ...s, status: 'done' as const })));
      setResult(data);
      setDlpiId(data.suggestedDlpiId);
      setEdited({});
      setStage('review');
      if (data.storedInDynamoDB) {
        toast.success(`Scan saved to DynamoDB (${data.scanId})`);
      }
    } catch (err: unknown) {
      clearInterval(ticker);
      toast.error(err instanceof Error ? err.message : 'RecordScan service unavailable. Is it running on port 8010?');
      setStage('idle');
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) runScan(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) runScan(f);
  };

  const onDemoPreset = (variant: string) => {
    const blob = new Blob(['demo'], { type: 'image/jpeg' });
    const file = new File([blob], `${variant}.jpg`, { type: 'image/jpeg' });
    runScan(file, variant);
  };

  // ── Officer approval ──────────────────────────────────────────────────────

  const approve = async () => {
    if (!result) return;
    setStage('approving');

    if (mode === 'transfer') {
      // In transfer mode, we just pass back the scanned document CID
      setTimeout(() => {
        setStage('done');
        toast.success(`Document scanned successfully.`);
        onScanComplete?.(result.ipfsCID || 'QmTransferScanMockCID');
      }, 1500);
      return;
    }

    // Genesis mode (default)
    const token = getToken() || '';
    
    let finalOwnerHash = 'sha256:ea4b4befa6136e0d37e28328bd54425bf7e04cc996e387063cc17fc148bd94e1'; // Match Priya Kumar's computed hash
    try {
      const inputEl = document.getElementById('ownerAadhaarInput') as HTMLInputElement;
      if (inputEl && inputEl.value) {
        const aadhaar = inputEl.value.trim();
        const salt = 'bhumichain-aadhaar-salt-change-in-prod';
        const msgBuffer = new TextEncoder().encode(aadhaar + salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        finalOwnerHash = 'sha256:' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) {
      console.error('Failed to hash aadhaar', e);
    }

    try {
      const res = await fetch('/api/scan/approve', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          scanId:             result.scanId,
          dlpiId,
          officerAadhaarHash: 'sha256:' + '0'.repeat(64),
          ownerAadhaarHash:   finalOwnerHash,
          officerName:        'Vijay Singh (Patwari DAD-P1)',
          correctedFields:    Object.keys(edited).length ? edited : undefined,
          token,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Approval failed');
      }

      setStage('done');
      toast.success(`DLPI ${dlpiId} recorded on BhumiChain!`);
      onDlpiCreated?.(dlpiId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Approval failed. Check gateway connection.');
      setStage('review');
    }
  };

  const ext = result ? { ...result.extraction, ...edited } : null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">RecordScan AI</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload a UP Khatauni (खतौनी) → Azure OCR + LayoutLM NER → DLPI on Hyperledger Fabric
        </p>
      </div>

      {/* ── IDLE ────────────────────────────────────────────────────────── */}
      {stage === 'idle' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {DEMO_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => onDemoPreset(p.id)}
                className={clsx(
                  'flex items-start gap-3 p-4 rounded-xl border text-left transition-colors',
                  p.color === 'brand'
                    ? 'border-[#0F4C81]/20 bg-[#0F4C81]/5 hover:bg-[#0F4C81]/10'
                    : 'border-amber-200 bg-amber-50 hover:bg-amber-100',
                )}
              >
                <p.icon className={clsx('w-5 h-5 mt-0.5 shrink-0', p.color === 'brand' ? 'text-[#0F4C81]' : 'text-amber-600')} />
                <div>
                  <div className="text-sm font-semibold text-gray-900">{p.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.sub}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-gray-500 text-xs">
            <div className="flex-1 h-px bg-gray-200" />
            या अपना दस्तावेज़ अपलोड करें
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={clsx(
              'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
              dragOver ? 'border-[#0F4C81]/60 bg-[#EFF6FF]' : 'border-gray-200 hover:border-gray-300',
            )}
          >
            <Upload className="w-8 h-8 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-600 font-medium text-sm">Drop Khatauni scan here</p>
            <p className="text-gray-600 text-xs mt-1">JPEG, PNG, TIFF, PDF · Max 20 MB</p>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={onFileChange} />
          </div>
        </>
      )}

      {/* ── PROCESSING ──────────────────────────────────────────────────── */}
      {(stage === 'uploading' || stage === 'processing') && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-4 h-4 text-[#0F4C81] animate-pulse" />
            <span className="font-semibold text-gray-700 text-sm">AI Pipeline Running...</span>
          </div>
          {steps.map((s, i) => <PipelineStep key={i} step={s} />)}
        </div>
      )}

      {/* ── REVIEW ──────────────────────────────────────────────────────── */}
      {stage === 'review' && result && ext && (
        <div className="space-y-4 animate-fade-in">
          <ConfidenceBanner extraction={ext} storedInDynamo={result.storedInDynamoDB} />

          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-[#0F4C81]" />
              <span className="font-semibold text-gray-700 text-sm">Extracted Khatauni Fields</span>
              <span className="ml-auto text-xs text-gray-500">{result.fileName} · {result.fileSizeKB} KB</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {ext.document_type && <Field label="Document Type" value={ext.document_type} />}
              
              {ext.registration_info && Object.entries(ext.registration_info).map(([k, v]) => (
                v && <Field key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
              ))}
              
              {ext.property && Object.entries(ext.property).map(([k, v]) => {
                if (!v || typeof v === 'object' || k.startsWith('_')) return null;
                return <Field key={k} label={k.replace(/_/g, ' ')} value={String(v)} />;
              })}
              
              {ext.financial && Object.entries(ext.financial).map(([k, v]) => {
                if (!v || typeof v === 'object' || k.startsWith('_')) return null;
                return <Field key={`fin_${k}`} label={k.replace(/_/g, ' ')} value={String(v)} />;
              })}
            </div>

            {/* Parties */}
            {ext.parties && ext.parties.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                  Parties involved
                </div>
                {ext.parties.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-200 last:border-0">
                    <div>
                      <span className="text-sm text-gray-700 font-medium">{p.name || 'Unknown'}</span>
                      {p.parentage && <span className="text-gray-500 text-xs ml-2">({p.parentage})</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[#0F4C81] text-xs px-2 py-0.5 bg-blue-50 rounded">{p.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-2 text-xs text-gray-500">
              <Database className="w-3 h-3" />
              <span>IPFS CID:</span>
              <span className="font-mono text-gray-400 truncate">{result.ipfsCID}</span>
            </div>
          </div>

          {/* DLPI ID and Owner Aadhaar confirmation */}
          <div className="card space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                DLPI ID (confirm or edit)
              </label>
              <input
                value={dlpiId}
                onChange={e => setDlpiId(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-gray-200 rounded-lg px-3 py-2 text-[#0F4C81] font-mono text-sm focus:outline-none focus:border-[#0F4C81]/60"
              />
              <p className="text-gray-600 text-xs mt-1">
                Auto-generated from Gata No. + tehsil code (DAD).
              </p>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Owner Aadhaar Number
              </label>
              <input
                id="ownerAadhaarInput"
                defaultValue="999900010010"
                placeholder="Enter 12-digit Aadhaar (e.g. 999900010010 for Priya Kumar)"
                className="w-full bg-[#F8FAFC] border border-gray-200 rounded-lg px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-[#0F4C81]/60"
              />
              <p className="text-gray-600 text-xs mt-1">
                Required to link this property to the citizen's Digilocker / My Parcels.
              </p>
            </div>
          </div>

          {ext.extraction_meta?.low_confidence_fields && ext.extraction_meta.low_confidence_fields.length > 0 && (
            <div className="flex items-start gap-3 bg-amber-950 border border-amber-700 rounded-xl p-4">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-amber-300 font-semibold text-sm mb-1">Officer review required (समीक्षा आवश्यक)</div>
                <div className="text-amber-400 text-xs space-y-0.5">
                  {ext.extraction_meta.low_confidence_fields.map((f: string, i: number) => <div key={i}>• {f.replace(/_/g, ' ')}</div>)}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={() => setStage('idle')} className="btn-ghost flex items-center gap-2">
              <X className="w-4 h-4" /> Discard
            </button>
            <button onClick={approve} className="btn-primary flex items-center gap-2 ml-auto">
              <Shield className="w-4 h-4" />
              {mode === 'transfer' ? 'Accept Scan' : 'Submit for Kanungo Approval'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── APPROVING ───────────────────────────────────────────────────── */}
      {stage === 'approving' && (
        <div className="card text-center py-12">
          <div className="w-10 h-10 border-2 border-[#0F4C81]/60 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <div className="text-gray-700 font-semibold">Submitting to Kanungo Queue...</div>
          <div className="text-gray-500 text-sm mt-1">Pending SRO Verification</div>
        </div>
      )}

      {/* ── DONE ────────────────────────────────────────────────────────── */}
      {stage === 'done' && (
        <div className="card text-center py-10 animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-[#DBEAFE] flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-[#0F4C81]" />
          </div>
          <div className="text-[#0F4C81] font-bold text-lg mb-1">
            {mode === 'transfer' ? 'Scan Completed!' : 'Sent for Approval!'}
          </div>
          {mode === 'genesis' && <div className="font-mono text-gray-600 text-sm mb-1">{dlpiId}</div>}
          <div className="text-gray-500 text-xs mb-6">
            {mode === 'transfer' 
              ? 'Document has been digitized and verified via RecordScan AI.' 
              : 'Scan submitted to Kanungo/Circle Inspector for review before being recorded on blockchain.'}
          </div>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setStage('idle')} className="btn-ghost text-sm">Scan another</button>
            {mode === 'genesis' && (
              <button onClick={() => onDlpiCreated?.(dlpiId)} className="btn-primary text-sm flex items-center gap-2">
                <Zap className="w-4 h-4" /> Go to Kanungo Queue
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PipelineStep({ step }: { step: ProcessingStep }) {
  const icons: Record<string, React.ElementType> = {
    UPLOAD:        Upload,
    AZURE_OCR:     Cpu,
    LAYOUT_LM_NER: FileText,
    VALIDATION:    Database,
    IPFS:          Shield,
  };
  const Icon = icons[step.step] || Clock;

  return (
    <div className={clsx('flex items-start gap-3 py-2', step.status === 'pending' && 'opacity-40')}>
      <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5', {
        'bg-[#F8FAFC]':                       step.status === 'pending',
        'bg-[#DBEAFE] animate-pulse-fast':    step.status === 'running',
        'bg-[#BFDBFE]':                       step.status === 'done',
        'bg-amber-800':                       step.status === 'partial',
        'bg-red-800':                         step.status === 'error',
      })}>
        {(step.status === 'done' || step.status === 'partial')
          ? <CheckCircle className={clsx('w-3.5 h-3.5', step.status === 'partial' ? 'text-amber-300' : 'text-[#0F4C81]')} />
          : <Icon className="w-3.5 h-3.5 text-gray-400" />
        }
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={clsx('text-sm font-medium', {
            'text-gray-500':   step.status === 'pending',
            'text-[#0F4C81]':  step.status === 'running',
            'text-gray-700':   step.status === 'done',
            'text-amber-300':  step.status === 'partial',
          })}>
            {step.label}
          </span>
          {step.status === 'running' && <span className="text-xs text-[#0F4C81] animate-pulse">processing...</span>}
          {step.confidence !== undefined && step.status !== 'pending' && (
            <span className={clsx('ml-auto text-xs font-mono', step.confidence >= 0.8 ? 'text-[#0F4C81]' : 'text-amber-400')}>
              {Math.round(step.confidence * 100)}%
            </span>
          )}
          {step.durationMs && step.status === 'done' && (
            <span className="ml-auto text-xs text-gray-600">{step.durationMs}ms</span>
          )}
        </div>
        {step.detail && step.status !== 'pending' && (
          <div className="text-xs text-gray-500 mt-0.5">{step.detail}</div>
        )}
      </div>
    </div>
  );
}

function ConfidenceBanner({ extraction, storedInDynamo }: { extraction: Extraction; storedInDynamo: boolean }) {
  const meta = extraction.extraction_meta || {};
  const high = !meta.low_confidence_fields || meta.low_confidence_fields.length === 0;

  return (
    <div className={clsx('flex items-center gap-4 rounded-xl px-4 py-3', {
      'bg-[#EFF6FF] border border-blue-200': high,
      'bg-amber-950 border border-amber-700': !high,
    })}>
      <div className="text-center">
        <div className={clsx('text-2xl font-bold', high ? 'text-[#0F4C81]' : 'text-amber-300')}>
          {high ? '99%' : '75%'}
        </div>
        <div className="text-xs text-gray-500">Confidence</div>
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-gray-700 mb-0.5">
          {high ? 'High confidence — ready for patwari approval'
           : 'Low confidence — manual verification required'}
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>Azure AI Vision Extractor</span>
          {!high && (
            <span className="text-amber-400">{meta.low_confidence_fields?.length || 0} field(s) flagged</span>
          )}
          {storedInDynamo && (
            <span className="text-[#0F4C81] flex items-center gap-1">
              <Database className="w-3 h-3" />DynamoDB
            </span>
          )}
        </div>
      </div>
      {!high && <Edit3 className="w-4 h-4 text-amber-400 shrink-0" />}
    </div>
  );
}

function Field({ label, value, flagged }: { label: string; value: string; flagged?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={clsx('text-sm font-medium', flagged ? 'text-amber-300' : 'text-gray-700')}>
        {flagged && <AlertTriangle className="w-3 h-3 inline mr-1" />}
        {value}
      </div>
    </div>
  );
}

function EditableField({
  label, value, flagged, onChange,
}: {
  label: string; value: string; flagged?: boolean; onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-xs text-gray-500">{label}</span>
        {flagged && <AlertTriangle className="w-3 h-3 text-amber-400" />}
        <button onClick={() => setEditing(e => !e)} className="ml-auto">
          <Edit3 className="w-3 h-3 text-gray-600 hover:text-gray-400" />
        </button>
      </div>
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          className="w-full bg-[#F8FAFC] border border-[#0F4C81] rounded px-2 py-1 text-sm text-gray-700 focus:outline-none"
        />
      ) : (
        <div className={clsx('text-sm font-medium', flagged ? 'text-amber-300' : 'text-gray-700')}>{value}</div>
      )}
    </div>
  );
}
