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
import { executeSuccession } from '@/lib/api';
import toast from 'react-hot-toast';

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
  CLAIM_SUBMITTED: { label: 'Claim Submitted', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: Clock },
  UNDER_REVIEW:    { label: 'Under Review',    color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     icon: Clock },
  CI_APPROVED:     { label: 'CI Approved',     color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: CheckCircle },
  VERIFIED:        { label: 'Verified',        color: 'text-green-700',  bg: 'bg-green-50 border-green-200',   icon: CheckCircle },
  DISPUTED:        { label: 'Disputed',        color: 'text-red-700',    bg: 'bg-red-50 border-red-200',       icon: AlertTriangle },
  SCAN_PENDING_SRO: { label: 'Pending SRO',    color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   icon: Clock },
  SCAN_PENDING_TEHSILDAR: { label: 'Pending Tehsildar', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: Clock },
  SUCCESSION_PENDING_TEHSILDAR: { label: 'Pending Succession', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Clock },
};

// Role → which statuses this officer should act on
// Role → which statuses this officer should act on
const ROLE_ACTION_STATUSES: Record<string, string[]> = {
  patwari:          ['CLAIM_SUBMITTED'],
  circle_inspector: ['UNDER_REVIEW', 'SCAN_PENDING_SRO'],
  tehsildar:        ['CI_APPROVED', 'SCAN_PENDING_TEHSILDAR', 'SUCCESSION_PENDING_TEHSILDAR'],
  kotwal:           ['CLAIM_SUBMITTED', 'UNDER_REVIEW', 'CI_APPROVED'],
};

type TabKey = 'all' | 'claim_submitted' | 'under_review' | 'ci_approved' | 'pending_scans';

const TABS: { key: TabKey; label: string; statuses: string[] }[] = [
  { key: 'all',            label: 'All',           statuses: ['CLAIM_SUBMITTED', 'UNDER_REVIEW', 'CI_APPROVED', 'DISPUTED', 'SCAN_PENDING_SRO', 'SCAN_PENDING_TEHSILDAR', 'SUCCESSION_PENDING_TEHSILDAR'] },
  { key: 'claim_submitted',label: 'Claim Submitted', statuses: ['CLAIM_SUBMITTED'] },
  { key: 'under_review',   label: 'Under Review',  statuses: ['UNDER_REVIEW'] },
  { key: 'ci_approved',    label: 'CI Approved',   statuses: ['CI_APPROVED'] },
  { key: 'pending_scans',  label: 'Pending Scans', statuses: ['SCAN_PENDING_SRO', 'SCAN_PENDING_TEHSILDAR', 'SUCCESSION_PENDING_TEHSILDAR'] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysPending(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function formatArea(ha?: number): string {
  if (ha === undefined || ha === null || isNaN(ha)) return 'N/A';
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

function QueueRow({ item, userRole, fetchQueue }: { item: QueueItem; userRole: string; fetchQueue: () => void }) {
  const [busy, setBusy] = useState(false);
  const status  = STATUS_CONFIG[item.claimStatus] ?? STATUS_CONFIG['CLAIM_SUBMITTED'];
  const Icon    = status.icon;
  const days    = daysPending(item.submittedAt || new Date().toISOString());
  const myTurn  = (ROLE_ACTION_STATUSES[userRole] ?? []).includes(item.claimStatus);

  async function handleScanApprove(endpoint: string) {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/dlpi/${item.dlpiId}${endpoint}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(data.message || 'Scan approved successfully!');
        fetchQueue();
      } else {
        console.error('Approval error data:', data);
        toast.error(data.detail || data.message || data.error || `Approval failed: ${JSON.stringify(data)}`);
      }
    } catch (e: any) {
      toast.error(e.message || 'An error occurred during approval');
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleSuccessionApprove(caseId: string) {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/succession/${caseId}/execute`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(data.message || 'Succession approved successfully!');
        fetchQueue();
      } else {
        toast.error(data.detail || data.message || data.error || `Approval failed`);
      }
    } catch (e: any) {
      toast.error(e.message || 'An error occurred during approval');
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors group">
      {/* DLPI + owner */}
      <td className="px-4 py-3">
        <div className="font-mono text-[#0F4C81] text-xs font-semibold">{item.dlpiId}</div>
        <div className="text-gray-900 text-sm font-medium mt-0.5">{item.ownerName}</div>
        <div className="text-gray-500 text-xs">{item.gram}, {item.tehsil}</div>
      </td>

      {/* Khasra + type */}
      <td className="px-4 py-3 text-sm">
        <div className="text-gray-900 font-mono">{item.khasraNo}</div>
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
        <span className={clsx('font-medium', days >= 7 ? 'text-red-600' : 'text-gray-700')}>
          {days}d
        </span>
        {item.priority === 'URGENT' && (
          <span className="ml-2 px-1.5 py-0.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-full font-semibold">
            URGENT
          </span>
        )}
      </td>

      {/* Badges */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {item.isTribal && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs">
              <Shield className="w-3 h-3" />ST
            </span>
          )}
          {item.isCoparcenary && (
            <span className="px-1.5 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs">
              Joint
            </span>
          )}
          {item.encumbranceStatus !== 'CLEAR' && (
            <span className="px-1.5 py-0.5 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs">
              {item.encumbranceStatus}
            </span>
          )}
          {item.scanId && (
            <span className="px-1.5 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-500 text-xs">
              Scan
            </span>
          )}
        </div>
      </td>

      {/* Action */}
      <td className="px-4 py-3">
        {item.claimStatus === 'SCAN_PENDING_SRO' && userRole === 'circle_inspector' ? (
          <button onClick={() => handleScanApprove('/scan-approve-sro')} disabled={busy} className="bg-[#0F4C81] hover:bg-[#0c3d67] px-3 py-1.5 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50">
             {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
             Approve Scan
          </button>
        ) : item.claimStatus === 'SCAN_PENDING_TEHSILDAR' && userRole === 'tehsildar' ? (
          <button onClick={() => handleScanApprove('/scan-approve-tehsildar')} disabled={busy} className="bg-[#0F4C81] hover:bg-[#0c3d67] px-3 py-1.5 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50">
             {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
             Final Approve
          </button>
        ) : item.claimStatus === 'SUCCESSION_PENDING_TEHSILDAR' && userRole === 'tehsildar' ? (
          <button onClick={() => handleSuccessionApprove(item.dlpiId)} disabled={busy} className="bg-purple-600 hover:bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50">
             {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
             Execute Succession
          </button>
        ) : (
          <Link
            href={`/officer-dashboard/review/${item.dlpiId}`}
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              myTurn
                ? 'bg-[#0F4C81] hover:bg-[#0c3d67] text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700',
            )}
          >
            {myTurn ? actionLabel(userRole) : 'View'}
            <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </td>
    </tr>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100 animate-pulse">
      {[160, 120, 100, 60, 80, 80].map((w, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-3 bg-gray-100 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{label}</div>
      <div className={clsx('text-3xl font-bold mt-1', color ?? 'text-gray-900')}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
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
  const [transfersQueue, setTransfersQueue] = useState<any[]>([]);
  const [successionsQueue, setSuccessionsQueue] = useState<any[]>([]);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [resDlpi, resTransfers, resSuccessions] = await Promise.all([
        apiFetch('/api/dlpi/pending-review'),
        apiFetch('/api/transfer/pending/all').catch(() => ({ ok: false, json: async () => [] })),
        apiFetch('/api/succession/pending/all').catch(() => ({ ok: false, json: async () => [] }))
      ]);
      
      const dlpiData = await resDlpi.json();
      if (!resDlpi.ok) throw new Error(dlpiData.message || dlpiData.error || 'Failed to load queue');
      setQueue(dlpiData);

      if (resTransfers.ok) {
        const transfersData = await resTransfers.json();
        setTransfersQueue(transfersData);
      }
      
      if (resSuccessions.ok) {
        const successionsData = await resSuccessions.json();
        setSuccessionsQueue(successionsData);
      }
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
    pending_scans:   queue.filter(q => ['SCAN_PENDING_SRO', 'SCAN_PENDING_TEHSILDAR', 'SUCCESSION_PENDING_TEHSILDAR'].includes(q.claimStatus)).length,
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">Officer Queue</h1>
                {user && (
                  <span className="px-2.5 py-1 bg-[#0F4C81]/10 border border-[#0F4C81]/20 text-[#0F4C81] text-xs font-bold rounded-full">
                    {roleLabel(user.role)}
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-sm mt-1">
                {user?.name && <span>{user.name} · </span>}
                Dadri Tehsil, Gautam Buddha Nagar · BhumiChain
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/scan"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 hover:border-gray-300 text-gray-700 transition-colors shadow-sm"
              >
                <FileText className="w-4 h-4" />
                New Scan
              </Link>
              <button
                onClick={fetchQueue}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-50 border border-transparent hover:border-gray-200"
              >
                <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total in Queue"    value={queue.length}  sub="Dadri tehsil" />
            <StatCard label="Needs Your Action" value={myTurnCount}   sub="awaiting review" color={myTurnCount > 0 ? 'text-[#0F4C81]' : 'text-gray-900'} />
            <StatCard label="Urgent"            value={urgentCount}   sub=">7 days pending" color={urgentCount > 0 ? 'text-red-600' : 'text-gray-900'} />
            <StatCard label="CI Approved"       value={counts.ci_approved} sub="awaiting tehsildar" color={counts.ci_approved > 0 ? 'text-purple-600' : 'text-gray-900'} />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Tabs + Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* Tabs */}
            <div className="flex items-center gap-0 border-b border-gray-200 px-4 bg-gray-50/50">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={clsx(
                    'px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
                    tab === t.key
                      ? 'border-[#0F4C81] text-[#0F4C81]'
                      : 'border-transparent text-gray-500 hover:text-gray-700',
                  )}
                >
                  {t.label}
                  {counts[t.key] > 0 && (
                    <span className={clsx(
                      'ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-semibold',
                      tab === t.key ? 'bg-[#0F4C81]/10 text-[#0F4C81]' : 'bg-gray-100 text-gray-500',
                    )}>
                      {counts[t.key]}
                    </span>
                  )}
                </button>
              ))}
              <div className="ml-auto pr-1 py-2">
                <Filter className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">DLPI / Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Khasra / Land</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Age</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Flags</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [0, 1, 2, 3].map(i => <SkeletonRow key={i} />)
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No items in this category</p>
                        <p className="text-gray-400 text-sm mt-1">Check other tabs or refresh the queue.</p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map(item => (
                      <QueueRow key={item.dlpiId} item={item} userRole={user?.role ?? 'patwari'} fetchQueue={fetchQueue} />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!loading && filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
                <span>Showing {filtered.length} of {queue.length} items · Dadri tehsil</span>
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-[#0F4C81]" />
                  BhumiChain · Hyperledger Fabric v2.5
                </span>
              </div>
            )}
          </div>

          {/* Pending Transfers Queue */}
          {transfersQueue.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-6 shadow-sm">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 bg-[#0F4C81]/5">
                <FileText className="w-4 h-4 text-[#0F4C81]" />
                <h2 className="text-sm font-bold text-gray-900">Pending Property Transfers (Sales)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Transfer ID</th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Parcel DLPI</th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfersQueue.map(item => (
                      <tr key={item.transferId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-[#0F4C81] text-xs font-semibold">{item.transferId}</td>
                        <td className="px-4 py-3 text-gray-900 font-mono text-sm">{item.dlpiId}</td>
                        <td className="px-4 py-3 text-xs text-amber-700 font-semibold">{item.status}</td>
                        <td className="px-4 py-3">
                           <Link
                             href={`/officer-dashboard/review-transfer/${item.transferId}`}
                             className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-[#0F4C81] hover:bg-[#0c3d67] text-white"
                           >
                             Review
                             <ChevronRight className="w-3 h-3" />
                           </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pending Successions Queue */}
          {successionsQueue.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-6 shadow-sm">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 bg-[#138808]/5">
                <Users className="w-4 h-4 text-[#138808]" />
                <h2 className="text-sm font-bold text-gray-900">Pending Successions (Mutations)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Case ID</th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Deceased Name</th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Parcel DLPI</th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {successionsQueue.map(item => (
                      <tr key={item.caseId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-[#0F4C81] text-xs font-semibold">{item.caseId}</td>
                        <td className="px-4 py-3 text-gray-900 text-sm font-semibold">{item.deceasedName}</td>
                        <td className="px-4 py-3 text-gray-900 font-mono text-sm">{item.dlpiId}</td>
                        <td className="px-4 py-3">
                           {user?.role === 'tehsildar' && (
                             <button
                               onClick={async () => {
                                 try {
                                   await executeSuccession(item.caseId);
                                   toast.success('Succession Executed');
                                   fetchQueue();
                                 } catch (e: any) {
                                   toast.error('Failed to execute succession: ' + e.message);
                                 }
                               }}
                               className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-[#138808] hover:bg-[#0e6306] text-white"
                             >
                               Execute
                               <CheckCircle className="w-3 h-3" />
                             </button>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
