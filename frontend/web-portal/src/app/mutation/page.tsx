'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight, Clock, CheckCircle, AlertTriangle,
  RefreshCw, ChevronRight, Shield, Send, XCircle,
} from 'lucide-react';
import clsx from 'clsx';
import Sidebar from '@/components/dashboard/Sidebar';
import { getUser, apiFetch, isOfficer, type JWTUser } from '@/lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Mutation {
  mutationId:       string;
  dlpiId:           string;
  mutationType:     string;
  officerName:      string;
  currentOwnerName: string;
  newOwnerName:     string;
  status:           string;
  initiatedAt:      string;
  objectionDeadline:string | null;
  slaMet:           boolean;
  requiresPublicNotice: boolean;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  ALERT_SENT:      { label: 'Alert Sent',      color: 'text-saffron-400', bg: 'bg-orange-900/30 border-orange-700',  icon: Send },
  CONSENT_GIVEN:   { label: 'Consent Given',   color: 'text-blue-400',   bg: 'bg-blue-900/30 border-blue-700',      icon: CheckCircle },
  OBJECTION_FILED: { label: 'Objection Filed', color: 'text-red-400',    bg: 'bg-red-900/30 border-red-700',        icon: XCircle },
  EXECUTED:        { label: 'Executed',        color: 'text-green-400',  bg: 'bg-green-900/30 border-green-700',    icon: CheckCircle },
  REJECTED:        { label: 'Rejected',        color: 'text-gray-400',   bg: 'bg-gray-800 border-gray-700',         icon: XCircle },
};

const MUTATION_TYPE_COLOR: Record<string, string> = {
  Inheritance: 'text-purple-400',
  Sale:        'text-blue-400',
  Gift:        'text-green-400',
  Partition:   'text-yellow-400',
  Court_Order: 'text-red-400',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000));
}

// ── Row ───────────────────────────────────────────────────────────────────────

function MutationRow({ m, isCitizen }: { m: Mutation; isCitizen: boolean }) {
  const status  = STATUS_CONFIG[m.status] ?? STATUS_CONFIG['ALERT_SENT'];
  const Icon    = status.icon;
  const left    = daysLeft(m.objectionDeadline);
  const typeKey = m.mutationType.replace('Virasat (', '').replace('Bikri (', '').replace(')', '');

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-900/50 transition-colors">
      <td className="px-4 py-3">
        <div className="font-mono text-brand-400 text-xs font-semibold">{m.mutationId}</div>
        <div className="text-gray-500 text-xs mt-0.5 font-mono">{m.dlpiId}</div>
      </td>
      <td className="px-4 py-3">
        <div className={clsx('text-sm font-semibold', MUTATION_TYPE_COLOR[typeKey] ?? 'text-gray-300')}>
          {m.mutationType}
        </div>
        <div className="text-gray-500 text-xs">by {m.officerName}</div>
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="text-gray-200">{m.currentOwnerName}</div>
        <div className="flex items-center gap-1 text-gray-500 text-xs">
          <ArrowLeftRight className="w-3 h-3" />
          {m.newOwnerName}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={clsx(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-semibold',
          status.bg, status.color,
        )}>
          <Icon className="w-3 h-3" />
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3 text-xs">
        {left !== null ? (
          <span className={clsx('font-semibold', left <= 5 ? 'text-red-400' : left <= 15 ? 'text-yellow-400' : 'text-gray-300')}>
            {left === 0 ? 'Expired' : `${left}d left`}
          </span>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/mutation/${m.mutationId}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-brand-700 text-gray-300 hover:text-white transition-colors"
        >
          {isCitizen && m.status === 'ALERT_SENT' ? 'Act Now' : 'View'}
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
      {[120, 100, 120, 80, 60, 60].map((w, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-3 bg-gray-800 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MutationListPage() {
  const router = useRouter();
  const [user, setUser]       = useState<JWTUser | null>(null);
  const [mutations, setMutations] = useState<Mutation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [tab, setTab]         = useState<'all' | 'pending' | 'executed'>('all');

  const fetchMutations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await apiFetch('/api/mutation');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to load');
      setMutations(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load mutations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace('/login'); return; }
    setUser(u);
    fetchMutations();
  }, []);

  const isCitizen = user?.role === 'citizen';
  const filtered = mutations.filter(m => {
    if (tab === 'pending')  return ['ALERT_SENT', 'CONSENT_GIVEN'].includes(m.status);
    if (tab === 'executed') return ['EXECUTED', 'REJECTED'].includes(m.status);
    return true;
  });

  const alertCount  = mutations.filter(m => m.status === 'ALERT_SENT').length;
  const pendingCount = mutations.filter(m => ['ALERT_SENT', 'CONSENT_GIVEN'].includes(m.status)).length;

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Mutation Manager</h1>
              <p className="text-gray-400 text-sm mt-1">
                {isCitizen
                  ? 'Mutations initiated on your parcels — consent, object, or track status'
                  : 'All mutations in Dadri tehsil — initiate, monitor, execute'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isCitizen && (
                <Link
                  href="/mutation/initiate"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-colors"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Initiate Mutation
                </Link>
              )}
              <button
                onClick={fetchMutations}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* Stats row */}
          {!loading && (
            <div className="grid grid-cols-3 gap-4">
              <div className="card !py-3">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Total</div>
                <div className="text-2xl font-bold text-gray-100 mt-1">{mutations.length}</div>
              </div>
              <div className="card !py-3">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Objection Window Open</div>
                <div className={clsx('text-2xl font-bold mt-1', alertCount > 0 ? 'text-saffron-400' : 'text-gray-100')}>{alertCount}</div>
              </div>
              <div className="card !py-3">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Pending Execution</div>
                <div className={clsx('text-2xl font-bold mt-1', pendingCount > 0 ? 'text-blue-400' : 'text-gray-100')}>{pendingCount}</div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-900/30 border border-red-700 text-red-300 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Alert banner for citizen */}
          {isCitizen && alertCount > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-orange-900/30 border border-orange-700 text-orange-300 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <span className="font-semibold">{alertCount} mutation{alertCount !== 1 ? 's' : ''}</span>
                {' '}initiated on your parcel{alertCount !== 1 ? 's' : ''}. You have <strong>30 days</strong> to consent or object.
              </div>
            </div>
          )}

          {/* Tabs + Table */}
          <div className="card !p-0 overflow-hidden">
            <div className="flex border-b border-gray-800 px-4">
              {(['all', 'pending', 'executed'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={clsx(
                    'px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px capitalize',
                    tab === t ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-300',
                  )}
                >
                  {t === 'all' ? `All (${mutations.length})` : t === 'pending' ? `Pending (${pendingCount})` : 'Executed'}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900/50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Mutation ID</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Owner → New Owner</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Window</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [0, 1, 2].map(i => <SkeletonRow key={i} />)
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <ArrowLeftRight className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-400 font-medium">No mutations found</p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map(m => (
                      <MutationRow key={m.mutationId} m={m} isCitizen={isCitizen} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
