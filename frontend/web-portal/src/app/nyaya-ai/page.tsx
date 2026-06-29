'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import { getDemoToken, predictDispute } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  MessageSquare, CheckCircle, ChevronRight, Cpu, Scale,
  BookOpen, Info, Shield, AlertTriangle, TrendingUp,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_INPUT = {
  dlpiId:       'DLPI-UP-DAD-00100',
  disputeType:  'Succession',
  facts:        'Succession dispute following death of Deepak Narayan Singh (CRS-GBN-2026-00541). Three heirs — two sons and one daughter — claim equal 1/3 Bhumidhari shares under Mitakshara coparcenary. Lekhpal has delayed mutation for 45 days beyond statutory limit without cause.',
};

const AI_PIPELINE = [
  { label: 'Querying 18 crore eCourts cases',         ms: 340 },
  { label: 'BERT: extracting legal features',          ms: 280 },
  { label: 'XGBoost: matching similar case patterns',  ms: 220 },
  { label: 'HSA 2005 rule engine validation',          ms: 160 },
  { label: 'Precedent ranking by BM25 relevance',      ms: 190 },
  { label: 'Generating legal brief',                   ms: 260 },
];

const DEMO_PREDICTION = {
  winProbability:    0.73,
  settleProbability: 0.19,
  loseProbability:   0.08,
  confidence:        0.91,
  recommendedAction: 'PROCEED_WITH_SUCCESSION',
  modelVersion:      'NyayaAI v2.1 (XGBoost + BERT)',
  casesAnalysed:     18_42_71_839,
  inferenceTimeMs:   1450,
  precedents: [
    {
      caseNo:    'Vineeta Sharma v. Rakesh Sharma (2020) 9 SCC 1',
      court:     'Supreme Court of India (3-judge bench)',
      ruling:    'Daughter is a coparcener by birth under HSA 2005 S.6(3). Equal share as sons — regardless of whether father was alive on 09 Sep 2005.',
      relevance: 0.97,
      year:      2020,
    },
    {
      caseNo:    'Civil Appeal 4825/2021, Allahabad HC',
      court:     'Allahabad High Court, Lucknow Bench',
      ruling:    'Mutation cannot be withheld once succession is proved through death certificate and heir affidavit. 30-day statutory limit is mandatory.',
      relevance: 0.84,
      year:      2021,
    },
    {
      caseNo:    'UP Revenue Case 2023-GBN-0471',
      court:     'Board of Revenue, Uttar Pradesh',
      ruling:    'Lekhpal bound to execute Virasat mutation within 30 days of verified CRS death certificate. Unexplained delay is misconduct under UP Revenue Code 2006.',
      relevance: 0.79,
      year:      2023,
    },
  ],
};

type Stage = 'idle' | 'computing' | 'done';
type PredictionResult = typeof DEMO_PREDICTION;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NyayaAIPage() {
  const [stage, setStage]           = useState<Stage>('idle');
  const [aiSteps, setAiSteps]       = useState(AI_PIPELINE.map((s) => ({ ...s, done: false })));
  const [elapsedMs, setElapsed]     = useState(0);
  const [prediction, setPrediction] = useState<PredictionResult>(DEMO_PREDICTION);
  const [isRealAI, setIsRealAI]     = useState(false);

  useEffect(() => {
    getDemoToken('citizen', 'Demo Citizen').catch(() => {});
  }, []);

  const handlePredict = async () => {
    setStage('computing');
    setAiSteps(AI_PIPELINE.map((s) => ({ ...s, done: false })));
    setElapsed(0);

    const start = Date.now();

    // Animate first 5 steps while real API runs concurrently
    const animateSteps = async () => {
      for (let i = 0; i < AI_PIPELINE.length; i++) {
        await delay(AI_PIPELINE[i].ms);
        setAiSteps((prev) => prev.map((s, idx) => idx <= i ? { ...s, done: true } : s));
      }
    };

    // Call real Azure AI + animate in parallel
    const [result] = await Promise.all([
      predictDispute(DEMO_INPUT).catch(() => null),
      animateSteps(),
    ]);

    setElapsed(Date.now() - start);

    if (result) {
      setPrediction({
        winProbability:    result.winProbability,
        settleProbability: result.settleProbability,
        loseProbability:   result.loseProbability,
        confidence:        result.confidence,
        recommendedAction: result.recommendedAction,
        modelVersion:      result.modelVersion || DEMO_PREDICTION.modelVersion,
        casesAnalysed:     DEMO_PREDICTION.casesAnalysed,
        inferenceTimeMs:   Date.now() - start,
        precedents:        result.precedents?.length ? result.precedents : DEMO_PREDICTION.precedents,
      });
      setIsRealAI(true);
      toast.success(`NyayaAI prediction — ${Math.round(result.confidence * 100)}% confidence`);
    } else {
      setPrediction(DEMO_PREDICTION);
      setIsRealAI(false);
      toast.success('NyayaAI prediction complete — 91% confidence (mock)');
    }

    setStage('done');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar demoMode />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Topbar */}
        <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-3 shrink-0">
          <Scale className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-semibold text-gray-200">NyayaAI — Legal Prediction</span>
          <span className="text-xs text-gray-500">— Demo Scene 5</span>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-brand-400">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            XGBoost + BERT · 18 crore eCourts cases
          </div>
        </div>

        <div className="flex-1 flex gap-6 p-6">

          {/* ── Left: main flow ──────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Dispute input card */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-semibold text-gray-200">Dispute Brief</span>
                <span className="ml-auto text-xs bg-amber-900 text-amber-300 px-2 py-0.5 rounded-full">
                  Pre-filled — Scene 5 Demo
                </span>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">DLPI (Parcel)</label>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-200">
                      {DEMO_INPUT.dlpiId}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Dispute Type</label>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200">
                      {DEMO_INPUT.disputeType}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Facts of Dispute</label>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-300 leading-relaxed min-h-[80px]">
                    {DEMO_INPUT.facts}
                  </div>
                </div>
              </div>
              {stage === 'idle' && (
                <button onClick={handlePredict} className="mt-4 btn-primary flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  Run NyayaAI Prediction
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* AI Pipeline */}
            {(stage === 'computing' || stage === 'done') && (
              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <Cpu className={clsx('w-4 h-4 text-brand-400', stage === 'computing' && 'animate-pulse')} />
                  <span className="text-sm font-semibold text-gray-200">NyayaAI Pipeline</span>
                  {stage === 'done' && (
                    <span className="ml-auto text-xs text-gray-500 font-mono">
                      {elapsedMs}ms · {(DEMO_PREDICTION.casesAnalysed / 1e7).toFixed(2)}Cr cases scanned
                    </span>
                  )}
                </div>
                <div className="space-y-2.5">
                  {aiSteps.map((step, i) => (
                    <div key={i} className={clsx(
                      'flex items-center gap-3 text-sm transition-colors',
                      step.done ? 'text-gray-300' : 'text-gray-600',
                    )}>
                      {step.done
                        ? <CheckCircle className="w-4 h-4 text-brand-400 shrink-0" />
                        : <div className="w-4 h-4 border border-gray-600 rounded-full shrink-0 animate-pulse" />
                      }
                      {step.label}
                      {step.done && <span className="ml-auto text-xs text-gray-600 font-mono">{step.ms}ms</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prediction result */}
            {stage === 'done' && (
              <>
                {/* Outcome gauge */}
                <div className="card">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-brand-400" />
                    <span className="text-sm font-semibold text-gray-200">Predicted Outcome</span>
                    {isRealAI && (
                      <span className="text-xs bg-brand-900 text-brand-300 px-2 py-0.5 rounded-full font-semibold">
                        ✦ Real AI
                      </span>
                    )}
                    <span className="ml-auto text-xs text-gray-500">
                      Confidence: <span className="text-brand-400 font-semibold">{Math.round(prediction.confidence * 100)}%</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <OutcomeCard label="Win"    pct={prediction.winProbability}    color="brand" primary />
                    <OutcomeCard label="Settle" pct={prediction.settleProbability} color="amber" />
                    <OutcomeCard label="Lose"   pct={prediction.loseProbability}   color="red" />
                  </div>

                  {/* Stacked bar */}
                  <div className="flex h-2.5 rounded-full overflow-hidden">
                    <div className="bg-brand-500" style={{ width: `${prediction.winProbability * 100}%` }} />
                    <div className="bg-amber-500" style={{ width: `${prediction.settleProbability * 100}%` }} />
                    <div className="bg-red-500"   style={{ width: `${prediction.loseProbability * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>Win {Math.round(prediction.winProbability * 100)}%</span>
                    <span>Settle {Math.round(prediction.settleProbability * 100)}%</span>
                    <span>Lose {Math.round(prediction.loseProbability * 100)}%</span>
                  </div>

                  <div className="mt-4 flex items-center gap-3 bg-brand-950 border border-brand-800 rounded-xl px-4 py-3">
                    <CheckCircle className="w-5 h-5 text-brand-400 shrink-0" />
                    <div>
                      <div className="text-brand-300 font-semibold text-sm">Recommended Action</div>
                      <div className="text-brand-500 text-xs mt-0.5">
                        {prediction.recommendedAction}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Precedents */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-brand-400" />
                    <span className="text-sm font-semibold text-gray-200">Top Precedents</span>
                    <span className="text-xs text-gray-500 ml-auto">ranked by BM25 relevance</span>
                  </div>
                  <div className="space-y-3">
                    {prediction.precedents.map((p, i) => (
                      <PrecedentCard key={i} precedent={p} rank={i + 1} />
                    ))}
                  </div>
                </div>

                {/* Re-run button */}
                <button
                  onClick={() => setStage('idle')}
                  className="btn-ghost text-sm flex items-center gap-2"
                >
                  ← Run another query
                </button>
              </>
            )}
          </div>

          {/* ── Right: info panel ───────────────────────────────────────── */}
          <div className="w-72 shrink-0 space-y-4">

            {/* Scene flow */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-semibold text-gray-200">Scene 5 flow</span>
              </div>
              <ol className="space-y-2.5 text-xs text-gray-400">
                {[
                  ['Dispute brief',     'Citizen inputs facts + DLPI'],
                  ['eCourts query',     '18 crore cases scanned in < 0.4s'],
                  ['BERT embedding',    'Legal text → 768-dim feature vector'],
                  ['XGBoost predict',   'Outcome probability from 50K trees'],
                  ['Precedent rank',    'BM25 + cosine similarity on case law'],
                  ['Legal brief',       'Actionable recommendation + citations'],
                ].map(([title, desc], i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-4 h-4 rounded-full bg-gray-800 text-gray-500 flex items-center justify-center shrink-0 font-mono text-xs">
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-gray-300">{title}</div>
                      <div className="text-gray-600">{desc}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Model card */}
            <div className="card">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Model Specs
              </div>
              <div className="space-y-2 text-xs">
                <InfoRow label="Model"    value="NyayaAI v2.1" />
                <InfoRow label="Base"     value="XGBoost + BERT" mono />
                <InfoRow label="Dataset"  value="18.42 Cr eCourts cases" />
                <InfoRow label="Port"     value="8012" mono />
                <InfoRow label="Training" value="UP + National HC corpus" />
              </div>
            </div>

            {/* Legal disclaimer */}
            <div className="card">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Disclaimer
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-1.5">
                <p>NyayaAI provides statistical predictions, not legal advice.</p>
                <p>Consult an advocate before filing. Probabilities are based on historical case patterns and may not reflect your specific facts.</p>
              </div>
            </div>

            {/* Access to justice stats */}
            <div className="card">
              <div className="flex items-center gap-1.5 mb-2">
                <Shield className="w-3.5 h-3.5 text-brand-400" />
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Access to Justice
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-1.5">
                <p>
                  Land disputes account for <span className="text-red-400 font-medium">66%</span> of
                  all civil litigation in UP, with avg case duration of <span className="text-red-400 font-medium">11 years</span>.
                </p>
                <p>
                  NyayaAI helps citizens identify <span className="text-brand-400 font-medium">strong precedents</span> before
                  incurring legal costs — cutting frivolous filings and speeding resolution.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function OutcomeCard({
  label, pct, color, primary,
}: {
  label: string;
  pct: number;
  color: 'brand' | 'amber' | 'red';
  primary?: boolean;
}) {
  const cls = {
    brand: { bg: 'bg-brand-950', border: 'border-brand-800', text: 'text-brand-300', num: 'text-brand-200' },
    amber: { bg: 'bg-amber-950', border: 'border-amber-800', text: 'text-amber-400', num: 'text-amber-300' },
    red:   { bg: 'bg-red-950',   border: 'border-red-800',   text: 'text-red-400',   num: 'text-red-300'   },
  }[color];

  return (
    <div className={clsx('rounded-xl border p-3 text-center', cls.bg, cls.border, primary && 'ring-1 ring-brand-500')}>
      <div className={clsx('text-2xl font-bold', cls.num)}>
        {Math.round(pct * 100)}%
      </div>
      <div className={clsx('text-xs font-semibold mt-1', cls.text)}>{label}</div>
    </div>
  );
}

function PrecedentCard({
  precedent,
  rank,
}: {
  precedent: typeof DEMO_PREDICTION.precedents[0];
  rank: number;
}) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-gray-700 text-gray-400 flex items-center justify-center text-xs font-bold shrink-0">
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-brand-300 font-mono">{precedent.caseNo}</span>
            <span className="text-xs bg-brand-900 text-brand-400 px-1.5 py-0.5 rounded">
              {Math.round(precedent.relevance * 100)}% match
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{precedent.court} · {precedent.year}</div>
          <div className="text-sm text-gray-300 mt-2 leading-relaxed">{precedent.ruling}</div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={clsx('text-gray-200 text-right', mono && 'font-mono')}>{value}</span>
    </div>
  );
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
