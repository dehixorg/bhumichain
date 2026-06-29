'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle, Clock, AlertTriangle, Shield, RefreshCw,
  ArrowRight, FileText, Filter, ChevronRight, Zap, Users,
} from 'lucide-react';
import clsx from 'clsx';
import Sidebar from '@/components/dashboard/Sidebar';
import { getUser, apiFetch, type JWTUser } from '@/lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueueItem {
  dlpiId:            string;
  khataNo:           string;
  khasraNo:          string;
  gram:              string;
  tehsil:            string;
  district:          string;
  ownerName:         string;
  landType:          string;
  areaHectares:      number;
  encumbranceStatus: string;
  claimStatus:       string;
  submittedAt:       string;
  claimedAt:         string;
  priority:          'URGENT' | 'NORMAL';
  isTribal:          boolean;
  isCoparcenary:     boolean;
  scanId:            string | null;
  officerNotes:      string;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  CLAIM_SUBMITTED: { label: 'Claim Submitted', color: 'text-saffron-400', bg: 'bg-orange-900/30 border-orange-700', icon: Clock },
  UNDER_REVIEW:    { label: 'Under Review',    color: 'text-blue-400',    bg: 'bg-blue-900/30 border-blue-700',    icon: Clock },
  CI_APPROVED:     { label: 'CI Approved',     color: 'text-purple-400',  bg: 'bg-purple-900/30 border-purple-700', icon: CheckCircle },
  VERIFIED:        { label: 'Verified',        color: 'text-green-400',   bg: 'bg-green-900/30 border-green-700',  icon: CheckCircle },
  DISPUTED:        { label: 'Disputed',        color: 'text-red-400',     bg: 'bg-red-900/30 border-red-700',      icon: AlertTriangle },
};

// Role → which statuses this officer should act on
const ROLE_ACTION_STATUSES: Record<string, string[]> = {
  patwari:          ['CLAIM_SUBMITTED'],
  circle_inspector: ['UNDER_REVIEW'],
  tehsildar:        ['CI_APPROVED'],
  kotwal:           ['CLAIM_SUBMITTED', 'UNDER_REVIEW', 'CI_APPROVED'],
};

type TabKey = 'all' | 'claim_submitted' | 'under_review' | 'ci_approved';

const TABS: { key: TabKey; label: string; statuses: string[] }[] = [
  { key: 'all',            label: 'All',           statuses: ['CLAIM_SUBMITTED', 'UNDER_REVIEW', 'CI_APPROVED', 'DISPUTED'] },
  { key: 'claim_submitted',label: 'Claim Submitted', statuses: ['CLAIM_SUBMITTED'] },
  { key: 'under_review',   label: 'Under Review',  statuses: ['UNDER_REVIEW'] },
  { key: 'ci_approved',    label: 'CI Approved',   statuses: ['CI_APPROVED'] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysPending(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function formatArea(ha: number): string {
  if (ha < 0.1) return `${(ha * 10000).toFixed(0)} sq.m`;
  return `${ha.toFixed(3)} ha`;
}

function roleLabel(role: string): string {
  return { tehsildar: 'Tehsildar', circle_inspector: 'Kanungo / CI', patwari: 'Patwari', kotwal: 'Kotwal' }[role] ?? role;
}

function actionLabel(role: string): string {
  return { patwari: 'Send to CI', circle_inspector: 'CI Review', tehsildar: 'Final Approve' }[role] ?? 'Review';
}

// ── Queue Row ─────────────────────────────────────────────────────────────────

function QueueRow({ item, userRole }: { item: QueueItem; userRole: string }) {
  const status  = STATUS_CONFIG[item.claimStatus] ?? STATUS_CONFIG['CLAIM_SUBMITTED'];
  const Icon    = status.icon;
  const days    = daysPending(item.submittedAt);
  const myTurn  = (ROLE_ACTION_STATUSES[userRole] ?? []).includes(item.claimStatus);

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-900/50 transition-colors group">
      {/* DLPI + owner */}
      <td className="px-4 py-3">
        <div className="font-mono text-brand-400 text-xs font-semibold">{item.dlpiId}</div>
        <div className="text-gray-200 text-sm font-medium mt-0.5">{item.ownerName}</div>
        <div className="text-gray-500 text-xs">{item.gram}, {item.tehsil}</div>
      </td>

      {/* Khasra + type */}
      <td className="px-4 py-3 text-sm">
        <div className="text-gray-200 font-mono">{item.khasraNo}</div>
        <div className="text-gray-500 text-xs">{item.landType} · {formatArea(item.areaHectares)}</div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={clsx(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-semibold',
          status.bg, status.color,
        )}>
          <Icon className="w-3 h-3" />
          {status.label}
        </span>
      </td>

      {/* Age */}
      <td className="px-4 py-3 text-sm">
        <span className={clsx('font-medium', days >= 7 ? 'text-red-400' : 'text-gray-300')}>
          {days}d
        </span>
        {item.priority === 'URGENT' && (
          <span className="ml-2 px-1.5 py-0.5 bg-red-900/40 border border-red-700 text-red-400 text-xs rounded-full font-semibold">
            URGENT
          </span>
        )}
      </td>

      {/* Badges */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {item.isTribal && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-900/40 border border-amber-700 text-amber-400 text-xs">
              <Shield className="w-3 h-3" />ST
            </span>
          )}
          {item.isCoparcenary && (
            <span className="px-1.5 py-0.5 rounded-full bg-purple-900/40 border border-purple-700 text-purple-400 text-xs">
              Joint
            </span>
          )}
          {item.encumbranceStatus !== 'CLEAR' && (
            <span className="px-1.5 py-0.5 rounded-full bg-yellow-900/40 border border-yellow-700 text-yellow-400 text-xs">
              {item.encumbranceStatus}
            </span>
          )}
          {item.scanId && (
            <span className="px-1.5 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-400 text-xs">
              Scan
            </span>
          )}
        </div>
      </td>

      {/* Action */}
      <td className="px-4 py-3">
        <Link
          href={`/officer-dashboard/review/${item.dlpiId}`}
          className={clsx(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
            myTurn
              ? 'bg-brand-600 hover:bg-brand-700 text-white'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-300',
          )}
        >
          {myTurn ? actionLabel(userRole) : 'View'}
          <ChevronRight className="w-3 h-3" />
        </Link>
      </td>
    </tr>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-800 animate-pulse">
      {[160, 120, 100, 60, 80, 80].map((w, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-3 bg-gray-800 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card">
      <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</div>
      <div className={clsx('text-3xl font-bold mt-1', color ?? 'text-gray-100')}>{value}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OfficerDashboardPage() {
  const router = useRouter();
  const [user, setUser]     = useState<JWTUser | null>(null);
  const [queue, setQueue]   = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [tab, setTab]       = useState<TabKey>('all');

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await apiFetch('/api/dlpi/pending-review');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to load queue');
      setQueue(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace('/login'); return; }
    if (u.role === 'citizen') { router.replace('/my-parcels'); return; }
    setUser(u);
    fetchQueue();
  }, []);

  const activeTab   = TABS.find(t => t.key === tab) ?? TABS[0];
  const filtered    = queue.filter(item => activeTab.statuses.includes(item.claimStatus));
  const urgentCount = queue.filter(q => q.priority === 'URGENT').length;
  const myTurnCount = queue.filter(q => (ROLE_ACTION_STATUSES[user?.role ?? ''] ?? []).includes(q.claimStatus)).length;

  const counts: Record<TabKey, number> = {
    all:            queue.length,
    claim_submitted: queue.filter(q => q.claimStatus === 'CLAIM_SUBMITTED').length,
    under_review:    queue.filter(q => q.claimStatus === 'UNDER_REVIEW').length,
    ci_approved:     queue.filter(q => q.claimStatus === 'CI_APPROVED').length,
  };

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-100">Officer Queue</h1>
                {user && (
                  <span className="px-2 py-0.5 bg-brand-900/40 border border-brand-700 text-brand-400 text-xs font-semibold rounded-full">
                    {roleLabel(user.role)}
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-sm mt-1">
                {user?.name && <span>{user.name} · </span>}
                Dadri Tehsil, Gautam Buddha Nagar · BhumiChain
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/scan"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
              >
                <FileText className="w-4 h-4" />
                New Scan
              </Link>
              <button
                onClick={fetchQueue}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total in Queue"    value={queue.length}  sub="Dadri tehsil" />
            <StatCard label="Needs Your Action" value={myTurnCount}   sub="awaiting review" color={myTurnCount > 0 ? 'text-brand-400' : 'text-gray-100'} />
            <StatCard label="Urgent"            value={urgentCount}   sub=">7 days pending" color={urgentCount > 0 ? 'text-red-400' : 'text-gray-100'} />
            <StatCard label="CI Approved"       value={counts.ci_approved} sub="awaiting tehsildar" color={counts.ci_approved > 0 ? 'text-purple-400' : 'text-gray-100'} />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-900/30 border border-red-700 text-red-300 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Tabs + Table */}
          <div className="card !p-0 overflow-hidden">
            {/* Tabs */}
            <div className="flex items-center gap-0 border-b border-gray-800 px-4">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={clsx(
                    'px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
                    tab === t.key
                      ? 'border-brand-500 text-brand-400'
                      : 'border-transparent text-gray-500 hover:text-gray-300',
                  )}
                >
                  {t.label}
                  {counts[t.key] > 0 && (
                    <span className={clsx(
                      'ml-1.5 px-1.5 py-0.5 rounded-full text-xs',
                      tab === t.key ? 'bg-brand-900/60 text-brand-300' : 'bg-gray-800 text-gray-500',
                    )}>
                      {counts[t.key]}
                    </span>
                  )}
                </button>
              ))}
              <div className="ml-auto pr-1 py-2">
                <Filter className="w-4 h-4 text-gray-600" />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900/50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">DLPI / Owner</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Khasra / Land</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Age</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Flags</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [0, 1, 2, 3].map(i => <SkeletonRow key={i} />)
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <Users className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-400 font-medium">No items in this category</p>
                        <p className="text-gray-600 text-sm mt-1">Check other tabs or refresh the queue.</p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map(item => (
                      <QueueRow key={item.dlpiId} item={item} userRole={user?.role ?? 'patwari'} />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!loading && filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-600 flex items-center justify-between">
                <span>Showing {filtered.length} of {queue.length} items · Dadri tehsil</span>
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-brand-500" />
                  BhumiChain · Hyperledger Fabric v2.5
                </span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
