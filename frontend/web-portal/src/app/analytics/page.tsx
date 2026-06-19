'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/dashboard/Sidebar';
import { useWebSocket } from '@/hooks/useWebSocket';
import { getDemoToken } from '@/lib/api';
import {
  BarChart3, Shield, AlertTriangle, CheckCircle, Users, Clock,
  ArrowLeftRight, Zap, TrendingUp, MapPin, FileText, Activity,
} from 'lucide-react';
import clsx from 'clsx';

const FraudHeatmap = dynamic(
  () => import('@/components/map/FraudHeatmap'),
  { ssr: false, loading: () => <MapSkeleton /> },
);

// ─── Mock live metrics ────────────────────────────────────────────────────────

interface Metrics {
  totalParcels:        number;
  tribalProtected:     number;
  encumbered:          number;
  mutationsPending:    number;
  fraudBlocked:        number;
  successionResolved:  number;
  txLast24h:           number;
  avgBlockTime:        number;    // seconds
  tribalRejections:    number;
  ecGenerated:         number;
}

const BASE_METRICS: Metrics = {
  totalParcels:       5_000,
  tribalProtected:      847,
  encumbered:           312,
  mutationsPending:      67,
  fraudBlocked:          23,
  successionResolved:    41,
  txLast24h:            284,
  avgBlockTime:         2.3,
  tribalRejections:      18,
  ecGenerated:          156,
};

// Live WS event feed items
interface FeedItem {
  id: string;
  event: string;
  dlpiId: string;
  actor: string;
  ts: Date;
  severity: 'info' | 'warn' | 'danger' | 'success';
}

const SEED_FEED: FeedItem[] = [
  { id: '1', event: 'TransferCompleted',         dlpiId: 'DLPI-MH-SNN-00142', actor: 'SRO Sinnar',       ts: ago(2),  severity: 'success' },
  { id: '2', event: 'TribalTransferHardRejected', dlpiId: 'DLPI-MH-IGT-T0023', actor: 'TribalGuard',      ts: ago(5),  severity: 'danger'  },
  { id: '3', event: 'MutationAlert',             dlpiId: 'DLPI-MH-NSK-02891', actor: 'Mutation Manager',  ts: ago(8),  severity: 'warn'    },
  { id: '4', event: 'ECGenerated',               dlpiId: 'DLPI-MH-DIN-00554', actor: 'Encumbrance CC',   ts: ago(11), severity: 'info'    },
  { id: '5', event: 'HeirNotificationRequired',  dlpiId: 'DLPI-MH-SNN-00142', actor: 'Uttaradhikar CC',  ts: ago(14), severity: 'info'    },
  { id: '6', event: 'FraudScoreRecorded',        dlpiId: 'DLPI-MH-NSK-03312', actor: 'FraudSense AI',    ts: ago(19), severity: 'danger'  },
  { id: '7', event: 'DLPICreated',               dlpiId: 'DLPI-MH-NIK-04891', actor: 'Revenue Dept',     ts: ago(25), severity: 'success' },
  { id: '8', event: 'GramSabhaApprovalRecorded', dlpiId: 'DLPI-MH-IGT-03312', actor: 'Gram Sabha',       ts: ago(31), severity: 'success' },
];

function ago(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

const SEVERITY_COLOR = {
  success: 'text-brand-400',
  info:    'text-blue-400',
  warn:    'text-amber-400',
  danger:  'text-red-400',
};

const SEVERITY_DOT = {
  success: 'bg-brand-500',
  info:    'bg-blue-500',
  warn:    'bg-amber-500',
  danger:  'bg-red-500',
};

// Janganana anomaly summary
const JANGANANA_ANOMALIES = [
  { type: 'ENCROACHMENT',   count: 89,  severity: 'HIGH',   icon: '🚨', tehsil: 'Igatpuri' },
  { type: 'BENAMI_SUSPECT', count: 47,  severity: 'HIGH',   icon: '🕵️', tehsil: 'Nashik City' },
  { type: 'MISMATCH',       count: 134, severity: 'MEDIUM', icon: '⚠️', tehsil: 'Various' },
  { type: 'GHOST_RECORD',   count: 32,  severity: 'MEDIUM', icon: '👻', tehsil: 'Sinnar' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<Metrics>(BASE_METRICS);
  const [feed, setFeed]       = useState<FeedItem[]>(SEED_FEED);
  const [liveCount, setLiveCount] = useState(0);

  const { on: onWs } = useWebSocket();

  useEffect(() => {
    getDemoToken('revenue_officer', 'Analytics Officer').catch(() => {});
  }, []);

  // Simulate live counter increments
  useEffect(() => {
    const t = setInterval(() => {
      setMetrics((m) => ({
        ...m,
        txLast24h:  m.txLast24h + (Math.random() < 0.4 ? 1 : 0),
        ecGenerated: m.ecGenerated + (Math.random() < 0.2 ? 1 : 0),
      }));
    }, 4_000);
    return () => clearInterval(t);
  }, []);

  // Append real WS events to feed
  useEffect(() => {
    return onWs('*', (msg) => {
      setLiveCount((c) => c + 1);
      setFeed((prev) => [{
        id:       `ws-${Date.now()}`,
        event:    msg.event,
        dlpiId:   (msg.payload?.dlpiId as string) || '—',
        actor:    'BhumiChain',
        ts:       new Date(),
        severity: msg.event.includes('Rejected') || msg.event.includes('Fraud') ? 'danger'
                : msg.event.includes('Alert') || msg.event.includes('Mismatch') ? 'warn'
                : msg.event.includes('Completed') || msg.event.includes('Created') ? 'success'
                : 'info',
      }, ...prev.slice(0, 19)]);
    });
  }, [onWs]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar demoMode />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Topbar */}
        <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-3 shrink-0">
          <BarChart3 className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-semibold text-gray-200">BhumiAnalytics</span>
          <span className="text-xs text-gray-500">— Demo Scene 8 · Nashik Pilot</span>
          <div className="ml-auto flex items-center gap-3">
            {liveCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-brand-400">
                <Activity className="w-3 h-3 animate-pulse" />
                {liveCount} live event{liveCount > 1 ? 's' : ''} received
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
              Fabric · Raft consensus · 3 orderers
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* ── KPI row ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-5 gap-4">
            <StatCard
              icon={<FileText className="w-4 h-4" />}
              label="Total Parcels"
              value={metrics.totalParcels.toLocaleString('en-IN')}
              sub="Nashik pilot"
              color="brand"
            />
            <StatCard
              icon={<Shield className="w-4 h-4" />}
              label="Tribal Protected"
              value={metrics.tribalProtected.toLocaleString('en-IN')}
              sub="FRA + Schedule V/VI"
              color="amber"
            />
            <StatCard
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Fraud Attempts Blocked"
              value={metrics.fraudBlocked.toString()}
              sub="Auto-rejected by chaincode"
              color="red"
              live
            />
            <StatCard
              icon={<Users className="w-4 h-4" />}
              label="Succession Cases"
              value={metrics.successionResolved.toString()}
              sub="Auto-mutated on consent"
              color="purple"
            />
            <StatCard
              icon={<Zap className="w-4 h-4" />}
              label="TX (24h)"
              value={metrics.txLast24h.toLocaleString('en-IN')}
              sub={`Avg block: ${metrics.avgBlockTime}s`}
              color="brand"
              live
            />
          </div>

          {/* ── Second KPI row ──────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-4">
            <MiniStat label="Mutations pending SLA" value={metrics.mutationsPending} unit="cases" color="amber" />
            <MiniStat label="Encumbered parcels"    value={metrics.encumbered}       unit="parcels" color="red" />
            <MiniStat label="EC generated"          value={metrics.ecGenerated}      unit="certs"  color="brand" live />
            <MiniStat label="Tribal rejections"     value={metrics.tribalRejections}  unit="total"  color="amber" />
          </div>

          {/* ── Main content ────────────────────────────────────────────── */}
          <div className="flex gap-6 min-h-0" style={{ height: '480px' }}>

            {/* Fraud heatmap */}
            <div className="flex-1 flex flex-col min-w-0 card p-0 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
                <MapPin className="w-4 h-4 text-red-400" />
                <span className="text-sm font-semibold text-gray-200">Fraud Risk Heatmap — Nashik District</span>
                <div className="ml-auto flex items-center gap-3 text-xs">
                  <LegendDot color="#ef4444" label="HIGH (≥0.85)" />
                  <LegendDot color="#f59e0b" label="MEDIUM (0.60–0.85)" />
                  <LegendDot color="#22c55e" label="LOW / CLEAN" />
                </div>
              </div>
              <div className="flex-1">
                <FraudHeatmap />
              </div>
            </div>

            {/* Right: event feed + anomalies */}
            <div className="w-80 shrink-0 flex flex-col gap-4">

              {/* Live event feed */}
              <div className="card flex-1 min-h-0 flex flex-col p-0 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 shrink-0">
                  <Activity className="w-4 h-4 text-brand-400" />
                  <span className="text-xs font-semibold text-gray-200">Live Fabric Events</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {feed.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 px-3 py-2.5 border-b border-gray-800 last:border-0">
                      <div className={clsx('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', SEVERITY_DOT[item.severity])} />
                      <div className="flex-1 min-w-0">
                        <div className={clsx('text-xs font-medium truncate', SEVERITY_COLOR[item.severity])}>
                          {item.event}
                        </div>
                        <div className="text-xs text-gray-600 font-mono truncate">{item.dlpiId}</div>
                        <div className="text-xs text-gray-600">{item.actor}</div>
                      </div>
                      <div className="text-xs text-gray-700 shrink-0 font-mono">
                        {item.ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Janganana anomaly summary ──────────────────────────────── */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-brand-400" />
              <span className="text-sm font-semibold text-gray-200">Janganana Census 2026-27 — Cross-reference Anomalies</span>
              <div className="ml-auto text-xs text-gray-500">
                302 of 5,000 parcels flagged · 6.04%
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4">
              {JANGANANA_ANOMALIES.map((a) => (
                <div key={a.type} className={clsx(
                  'rounded-xl p-3 border',
                  a.severity === 'HIGH'   ? 'bg-red-950 border-red-800' : 'bg-amber-950 border-amber-800',
                )}>
                  <div className="text-lg mb-1">{a.icon}</div>
                  <div className={clsx(
                    'text-lg font-bold font-mono',
                    a.severity === 'HIGH' ? 'text-red-300' : 'text-amber-300',
                  )}>
                    {a.count}
                  </div>
                  <div className="text-xs text-gray-300 font-semibold">{a.type.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Primarily {a.tehsil}</div>
                </div>
              ))}
            </div>

            {/* Summary stats row */}
            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-800 text-xs text-gray-400">
              <div>
                <div className="text-gray-200 font-bold text-sm">4,512</div>
                <div>Census households matched to DLPI</div>
              </div>
              <div>
                <div className="text-gray-200 font-bold text-sm">302</div>
                <div>Anomalies auto-flagged for field review</div>
              </div>
              <div>
                <div className="text-gray-200 font-bold text-sm">₹ 847 Cr</div>
                <div>Estimated value of flagged parcels</div>
              </div>
            </div>
          </div>

          {/* ── Network health row ────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Chaincode Health
              </div>
              {[
                ['dlpi',              'DLPI Core',        'RUNNING'],
                ['property-transfer', 'PropertyTransfer', 'RUNNING'],
                ['tribal-guard',      'TribalGuard',      'RUNNING'],
                ['uttaradhikar',      'Uttaradhikar',     'RUNNING'],
                ['mutation-manager',  'MutationManager',  'RUNNING'],
                ['encumbrance',       'Encumbrance',      'RUNNING'],
              ].map(([id, label, status]) => (
                <div key={id} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0 text-xs">
                  <div>
                    <span className="text-gray-300">{label}</span>
                    <span className="text-gray-600 font-mono ml-2">{id}</span>
                  </div>
                  <span className="text-brand-400 font-semibold">{status}</span>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                AI Services
              </div>
              {[
                ['RecordScan',        ':8010', 'MOCK'],
                ['CoparcenaryMapper', ':8011', 'MOCK'],
                ['BhumiGPT',          ':8012', 'MOCK'],
                ['ValuationOracle',   ':8001', 'MOCK'],
                ['FraudSense',        ':8001', 'MOCK'],
              ].map(([name, port, mode]) => (
                <div key={name} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0 text-xs">
                  <div>
                    <span className="text-gray-300">{name}</span>
                    <span className="text-gray-600 font-mono ml-2">{port}</span>
                  </div>
                  <span className="text-amber-400 font-semibold">{mode}</span>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Demo Story Progress
              </div>
              {[
                [2, 'RecordScan AI', true],
                [3, 'Succession / Coparcenary', true],
                [4, 'Property Transfer', true],
                [5, 'Fraud Attempt Block', true],
                [6, 'TribalGuard Reject', true],
                [7, 'BhumiGPT Query', true],
                [8, 'BhumiAnalytics', true],
              ].map(([scene, label, done]) => (
                <div key={String(scene)} className="flex items-center gap-2 py-1.5 border-b border-gray-800 last:border-0 text-xs">
                  <div className={clsx(
                    'w-4 h-4 rounded-full flex items-center justify-center font-mono text-xs shrink-0',
                    done ? 'bg-brand-800 text-brand-300' : 'bg-gray-800 text-gray-500',
                  )}>
                    {done ? '✓' : scene}
                  </div>
                  <span className={done ? 'text-gray-300' : 'text-gray-600'}>{label}</span>
                  {done && <CheckCircle className="w-3 h-3 text-brand-500 ml-auto shrink-0" />}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, color, live,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: 'brand' | 'red' | 'amber' | 'purple';
  live?: boolean;
}) {
  const ring  = { brand: 'border-brand-800', red: 'border-red-900', amber: 'border-amber-900', purple: 'border-purple-900' }[color];
  const bg    = { brand: 'bg-brand-950',     red: 'bg-red-950',     amber: 'bg-amber-950',     purple: 'bg-purple-950'    }[color];
  const text  = { brand: 'text-brand-300',   red: 'text-red-300',   amber: 'text-amber-300',   purple: 'text-purple-300'  }[color];

  return (
    <div className={clsx('card border', ring, 'relative overflow-hidden')}>
      {live && (
        <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
      )}
      <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center mb-2', bg)}>
        <span className={text}>{icon}</span>
      </div>
      <div className={clsx('text-2xl font-bold font-mono', text)}>{value}</div>
      <div className="text-xs text-gray-300 font-semibold mt-1">{label}</div>
      <div className="text-xs text-gray-600 mt-0.5">{sub}</div>
    </div>
  );
}

function MiniStat({
  label, value, unit, color, live,
}: {
  label: string;
  value: number;
  unit: string;
  color: 'brand' | 'red' | 'amber';
  live?: boolean;
}) {
  const text = { brand: 'text-brand-400', red: 'text-red-400', amber: 'text-amber-400' }[color];
  return (
    <div className="card flex items-center gap-3">
      <div>
        <div className={clsx('text-xl font-bold font-mono', text)}>
          {value.toLocaleString('en-IN')}
          {live && <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse inline-block ml-1.5 mb-0.5" />}
        </div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
      <div className="ml-auto text-xs text-gray-600">{unit}</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-gray-400">{label}</span>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500 text-sm animate-pulse rounded-xl">
      Loading fraud heatmap…
    </div>
  );
}
