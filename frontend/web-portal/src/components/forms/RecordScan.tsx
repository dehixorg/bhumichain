'use client';

import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Upload, FileText, CheckCircle, AlertTriangle, Clock,
  Cpu, Database, Shield, Zap, Edit3, ChevronRight, X
} from 'lucide-react';
import clsx from 'clsx';
import type { LandType } from '@/types';

const SCAN_URL = process.env.NEXT_PUBLIC_RECORD_SCAN_URL || 'http://localhost:8010';
const API_URL  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessingStep {
  step: string;
  label: string;
  detail?: string;
  confidence?: number;
  status: 'pending' | 'running' | 'done' | 'partial' | 'error';
  durationMs?: number;
}

interface SatbaraOwner {
  name: string;
  fatherHusbandName?: string;
  share?: string;
  ownershipType: string;
}

interface Extraction {
  districtName: string;
  tehsilName: string;
  villageName: string;
  surveyNumber: string;
  subdivisionNumber?: string;
  totalAreaHectares: number;
  landType: LandType;
  irrigationSource?: string;
  owners: SatbaraOwner[];
  hasCoparcenary: boolean;
  currentCultivator?: string;
  cropDetails?: string;
  surveyDate?: string;
  ocrConfidence: number;
  nerConfidence: number;
  overallConfidence: number;
  flaggedFields: string[];
  requiresManualReview: boolean;
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
}

type Stage = 'idle' | 'uploading' | 'processing' | 'review' | 'approving' | 'done';

// ─── Demo quick-launch presets ────────────────────────────────────────────────

const DEMO_PRESETS = [
  {
    id: 'demo_clear',
    label: 'Sinnar 142/2A — Clean scan',
    sub: 'Ramesh Patil · Bagayat · 2.4 Ha',
    color: 'brand',
    icon: CheckCircle,
  },
  {
    id: 'demo_degraded',
    label: 'Sinnar 98 — Ink smudged',
    sub: 'Damaged record · requires review',
    color: 'amber',
    icon: AlertTriangle,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onDlpiCreated?: (dlpiId: string) => void;
}

export default function RecordScan({ onDlpiCreated }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [steps, setSteps] = useState<ProcessingStep[]>([]);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [edited, setEdited] = useState<Partial<Extraction>>({});
  const [dlpiId, setDlpiId] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Upload + scan ─────────────────────────────────────────────────────────

  const runScan = useCallback(async (file: File, demoVariant?: string) => {
    setStage('uploading');
    setSteps([]);
    setResult(null);

    try {
      const form = new FormData();
      if (file) form.append('file', file);
      if (demoVariant) form.append('demoVariant', demoVariant);

      setStage('processing');

      // Animate steps locally while waiting for server
      const STEP_LABELS = [
        { step: 'UPLOAD',        label: 'Document uploaded' },
        { step: 'AZURE_OCR',     label: 'Azure Document Intelligence OCR' },
        { step: 'LAYOUT_LM_NER', label: 'LayoutLM NER — field extraction' },
        { step: 'VALIDATION',    label: 'Cross-validation vs Mahabhulekh' },
        { step: 'IPFS',          label: 'Pinning to IPFS' },
      ];

      setSteps(STEP_LABELS.map((s) => ({ ...s, status: 'pending' })));

      // Animate steps one by one before the response arrives
      let stepIdx = 0;
      const ticker = setInterval(() => {
        if (stepIdx >= STEP_LABELS.length) { clearInterval(ticker); return; }
        setSteps((prev) =>
          prev.map((s, i) => {
            if (i < stepIdx) return { ...s, status: 'done' };
            if (i === stepIdx) return { ...s, status: 'running' };
            return s;
          }),
        );
        stepIdx++;
      }, 900);

      const res = await axios.post<ScanResult>(`${SCAN_URL}/scan/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30_000,
      });
      clearInterval(ticker);

      const data = res.data;
      // Merge server step details into our animated steps
      setSteps(data.processingSteps.length ? data.processingSteps : STEP_LABELS.map((s) => ({ ...s, status: 'done' as const })));
      setResult(data);
      setDlpiId(data.suggestedDlpiId);
      setEdited({});
      setStage('review');
    } catch (err) {
      toast.error('RecordScan service unavailable. Is it running on port 8010?');
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

  const onDemoPreset = async (variant: string) => {
    // Create a dummy file so the FormData is valid
    const blob = new Blob(['demo'], { type: 'image/jpeg' });
    const file = new File([blob], `${variant}.jpg`, { type: 'image/jpeg' });
    await runScan(file, variant);
  };

  // ── Officer approval ──────────────────────────────────────────────────────

  const approve = async () => {
    if (!result) return;
    setStage('approving');

    // Get a demo token first
    let token = '';
    try {
      const tkRes = await axios.get(`${API_URL}/api/auth/demo-token?role=revenue_officer&name=Prakash+Kulkarni`);
      token = tkRes.data.token;
    } catch { /* token optional in mock */ }

    try {
      await axios.post(`${SCAN_URL}/scan/approve`, {
        scanId: result.scanId,
        dlpiId,
        officerAadhaarHash: 'sha256:' + 'a'.repeat(64),
        officerName: 'Prakash Nana Kulkarni',
        correctedFields: Object.keys(edited).length ? edited : undefined,
        token,
      });

      setStage('done');
      toast.success(`DLPI ${dlpiId} recorded on BhumiChain!`);
      onDlpiCreated?.(dlpiId);
    } catch {
      toast.error('Approval failed. Check gateway connection.');
      setStage('review');
    }
  };

  const ext = result ? { ...result.extraction, ...edited } : null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-100">RecordScan AI</h1>
        <p className="text-gray-400 text-sm mt-1">
          Upload a Satbara Utara (7/12) extract → Azure OCR + LayoutLM NER → DLPI on blockchain
        </p>
      </div>

      {/* ── IDLE: upload zone ───────────────────────────────────────────── */}
      {stage === 'idle' && (
        <>
          {/* Demo presets */}
          <div className="grid grid-cols-2 gap-3">
            {DEMO_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => onDemoPreset(p.id)}
                className={clsx(
                  'flex items-start gap-3 p-4 rounded-xl border text-left transition-colors',
                  p.color === 'brand'
                    ? 'border-brand-700 bg-brand-950 hover:bg-brand-900'
                    : 'border-amber-700 bg-amber-950 hover:bg-amber-900',
                )}
              >
                <p.icon className={clsx('w-5 h-5 mt-0.5 shrink-0', p.color === 'brand' ? 'text-brand-400' : 'text-amber-400')} />
                <div>
                  <div className="text-sm font-semibold text-gray-100">{p.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{p.sub}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-gray-600 text-xs">
            <div className="flex-1 h-px bg-gray-800" />
            or upload your own
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={clsx(
              'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
              dragOver ? 'border-brand-500 bg-brand-950' : 'border-gray-700 hover:border-gray-600',
            )}
          >
            <Upload className="w-8 h-8 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-300 font-medium text-sm">Drop Satbara scan here</p>
            <p className="text-gray-600 text-xs mt-1">JPEG, PNG, TIFF, PDF · Max 20 MB</p>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={onFileChange} />
          </div>
        </>
      )}

      {/* ── PROCESSING: animated pipeline ──────────────────────────────── */}
      {(stage === 'uploading' || stage === 'processing') && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-4 h-4 text-brand-400 animate-pulse" />
            <span className="font-semibold text-gray-200 text-sm">AI Pipeline Running...</span>
          </div>
          {steps.map((s, i) => (
            <PipelineStep key={i} step={s} />
          ))}
        </div>
      )}

      {/* ── REVIEW: officer corrections ─────────────────────────────────── */}
      {stage === 'review' && result && ext && (
        <div className="space-y-4 animate-fade-in">
          {/* Confidence banner */}
          <ConfidenceBanner extraction={ext} />

          {/* Extracted fields */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-brand-400" />
              <span className="font-semibold text-gray-200 text-sm">Extracted Satbara Fields</span>
              <span className="ml-auto text-xs text-gray-500">{result.fileName} · {result.fileSizeKB} KB</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="District" value={ext.districtName} flagged={ext.flaggedFields.includes('districtName')} />
              <Field label="Tehsil" value={ext.tehsilName} flagged={ext.flaggedFields.includes('tehsilName')} />
              <EditableField
                label="Village"
                value={edited.villageName ?? ext.villageName}
                flagged={ext.flaggedFields.some(f => f.includes('village'))}
                onChange={(v) => setEdited((p) => ({ ...p, villageName: v }))}
              />
              <Field label="Survey No." value={`${ext.surveyNumber}${ext.subdivisionNumber ? '/' + ext.subdivisionNumber : ''}`} />
              <EditableField
                label="Area (Hectares)"
                value={String(edited.totalAreaHectares ?? ext.totalAreaHectares)}
                flagged={ext.flaggedFields.some(f => f.includes('Area') || f.includes('area'))}
                onChange={(v) => setEdited((p) => ({ ...p, totalAreaHectares: parseFloat(v) || ext.totalAreaHectares }))}
              />
              <Field label="Land Type" value={ext.landType} />
              <Field label="Irrigation" value={ext.irrigationSource || '—'} />
              <Field label="Cultivation" value={ext.currentCultivator || '—'} />
              <Field label="Crops" value={ext.cropDetails || '—'} />
              <Field label="Survey Date" value={ext.surveyDate || '—'} />
            </div>

            {/* Owners */}
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Owners</div>
              {ext.owners.map((o, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                  <div>
                    <span className={clsx('text-sm text-gray-200', ext.flaggedFields.some(f => f.includes('owner')) && 'text-amber-300')}>
                      {o.name}
                    </span>
                    {o.fatherHusbandName && (
                      <span className="text-gray-500 text-xs ml-2">s/o {o.fatherHusbandName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {o.share && <span className="font-mono text-brand-400 text-xs">{o.share}</span>}
                    <span className="text-gray-600 text-xs">{o.ownershipType}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* IPFS CID */}
            <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-2 text-xs text-gray-500">
              <Database className="w-3 h-3" />
              <span>IPFS CID:</span>
              <span className="font-mono text-gray-400 truncate">{result.ipfsCID}</span>
            </div>
          </div>

          {/* DLPI ID confirmation */}
          <div className="card">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              DLPI ID (confirm or edit)
            </label>
            <input
              value={dlpiId}
              onChange={(e) => setDlpiId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-brand-300 font-mono text-sm focus:outline-none focus:border-brand-500"
            />
            <p className="text-gray-600 text-xs mt-1">
              Auto-generated from survey + tehsil. Circle officer may override.
            </p>
          </div>

          {/* Flagged fields warning */}
          {ext.requiresManualReview && ext.flaggedFields.length > 0 && (
            <div className="flex items-start gap-3 bg-amber-950 border border-amber-700 rounded-xl p-4">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-amber-300 font-semibold text-sm mb-1">Manual review required</div>
                <div className="text-amber-400 text-xs space-y-0.5">
                  {ext.flaggedFields.map((f, i) => (
                    <div key={i}>• {f}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button onClick={() => setStage('idle')} className="btn-ghost flex items-center gap-2">
              <X className="w-4 h-4" /> Discard
            </button>
            <button
              onClick={approve}
              className="btn-primary flex items-center gap-2 ml-auto"
            >
              <Shield className="w-4 h-4" />
              Approve &amp; Record on Blockchain
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── APPROVING ───────────────────────────────────────────────────── */}
      {stage === 'approving' && (
        <div className="card text-center py-12">
          <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <div className="text-gray-200 font-semibold">Submitting to Hyperledger Fabric...</div>
          <div className="text-gray-500 text-sm mt-1">Endorsing transaction · Writing to ledger</div>
        </div>
      )}

      {/* ── DONE ────────────────────────────────────────────────────────── */}
      {stage === 'done' && (
        <div className="card text-center py-10 animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-brand-900 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-brand-400" />
          </div>
          <div className="text-brand-300 font-bold text-lg mb-1">DLPI Recorded!</div>
          <div className="font-mono text-gray-300 text-sm mb-1">{dlpiId}</div>
          <div className="text-gray-500 text-xs mb-6">
            Land parcel is now permanently on BhumiChain · Tamper-proof · Publicly verifiable
          </div>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setStage('idle')} className="btn-ghost text-sm">
              Scan another
            </button>
            <button
              onClick={() => onDlpiCreated?.(dlpiId)}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Zap className="w-4 h-4" /> View on Map
            </button>
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
        'bg-gray-800': step.status === 'pending',
        'bg-brand-900 animate-pulse-fast': step.status === 'running',
        'bg-brand-800': step.status === 'done',
        'bg-amber-800': step.status === 'partial',
        'bg-red-800': step.status === 'error',
      })}>
        {step.status === 'done' || step.status === 'partial'
          ? <CheckCircle className={clsx('w-3.5 h-3.5', step.status === 'partial' ? 'text-amber-300' : 'text-brand-300')} />
          : <Icon className="w-3.5 h-3.5 text-gray-400" />
        }
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={clsx('text-sm font-medium', {
            'text-gray-500': step.status === 'pending',
            'text-brand-300': step.status === 'running',
            'text-gray-200': step.status === 'done',
            'text-amber-300': step.status === 'partial',
          })}>
            {step.label}
          </span>
          {step.status === 'running' && (
            <span className="text-xs text-brand-500 animate-pulse">processing...</span>
          )}
          {step.confidence !== undefined && step.status !== 'pending' && (
            <span className={clsx('ml-auto text-xs font-mono', step.confidence >= 0.8 ? 'text-brand-400' : 'text-amber-400')}>
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

function ConfidenceBanner({ extraction }: { extraction: Extraction }) {
  const conf = extraction.overallConfidence;
  const high = conf >= 0.85;
  const med  = conf >= 0.65;

  return (
    <div className={clsx('flex items-center gap-4 rounded-xl px-4 py-3', {
      'bg-brand-950 border border-brand-800': high,
      'bg-amber-950 border border-amber-700': !high && med,
      'bg-red-950 border border-red-700': !med,
    })}>
      <div className="text-center">
        <div className={clsx('text-2xl font-bold', high ? 'text-brand-300' : med ? 'text-amber-300' : 'text-red-300')}>
          {Math.round(conf * 100)}%
        </div>
        <div className="text-xs text-gray-500">Confidence</div>
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-gray-200 mb-0.5">
          {high ? 'High confidence — ready for approval'
           : med ? 'Medium confidence — review flagged fields'
           : 'Low confidence — manual verification required'}
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>OCR: {Math.round(extraction.ocrConfidence * 100)}%</span>
          <span>NER: {Math.round(extraction.nerConfidence * 100)}%</span>
          {extraction.flaggedFields.length > 0 && (
            <span className="text-amber-400">{extraction.flaggedFields.length} field(s) flagged</span>
          )}
        </div>
      </div>
      {extraction.requiresManualReview && (
        <Edit3 className="w-4 h-4 text-amber-400 shrink-0" />
      )}
    </div>
  );
}

function Field({ label, value, flagged }: { label: string; value: string; flagged?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={clsx('text-sm font-medium', flagged ? 'text-amber-300' : 'text-gray-200')}>
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
        <button onClick={() => setEditing((e) => !e)} className="ml-auto">
          <Edit3 className="w-3 h-3 text-gray-600 hover:text-gray-400" />
        </button>
      </div>
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          className="w-full bg-gray-800 border border-brand-600 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none"
        />
      ) : (
        <div className={clsx('text-sm font-medium', flagged ? 'text-amber-300' : 'text-gray-200')}>
          {value}
        </div>
      )}
    </div>
  );
}
