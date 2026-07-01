'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MapPin, ArrowRight, CheckCircle, Clock, AlertTriangle,
  XCircle, FileText, RefreshCw, Shield,
} from 'lucide-react';
import clsx from 'clsx';
import Sidebar from '@/components/dashboard/Sidebar';
import { getUser, apiFetch } from '@/lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Parcel {
  dlpiId:            string;
  khataNo:           string;
  khasraNo:          string;
  tehsil:            string;
  district:          string;
  landType:          string;
  landTypeDesc:      string;
  areaHectares:      number;
  encumbranceStatus: string;
  claimStatus:       string;
  disputeNote?:      string;
  isTribal?:         boolean;
  isCoparcenary?:    boolean;
  location:          { latitude: number; longitude: number };
  valuation:         { circleRateINR: number };
  updatedAt:         string;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  icon: React.ElementType;
  hint: string;
}> = {
  VERIFIED: {
    label: 'Verified',
    color: 'text-green-400',
    bg:    'bg-green-900 bg-opacity-40 border-green-700',
    icon:  CheckCircle,
    hint:  'Your ownership is confirmed on BhumiChain.',
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    color: 'text-blue-400',
    bg:    'bg-blue-900 bg-opacity-40 border-blue-700',
    icon:  Clock,
    hint:  'Patwari / Circle Inspector is verifying your claim.',
  },
  CI_APPROVED: {
    label: 'CI Approved',
    color: 'text-blue-400',
    bg:    'bg-blue-900 bg-opacity-40 border-blue-700',
    icon:  Clock,
    hint:  'Approved by Circle Inspector. Awaiting Tehsildar final sign-off.',
  },
  CLAIM_SUBMITTED: {
    label: 'Claim Submitted',
    color: 'text-saffron-400',
    bg:    'bg-orange-900 bg-opacity-40 border-orange-700',
    icon:  Clock,
    hint:  'Your claim is submitted. Next: submit for field verification.',
  },
  SEEDED_UNVERIFIED: {
    label: 'Unverified',
    color: 'text-yellow-400',
    bg:    'bg-yellow-900 bg-opacity-30 border-yellow-700',
    icon:  AlertTriangle,
    hint:  'Record migrated from government database. Claim to verify ownership.',
  },
  DISPUTED: {
    label: 'Disputed',
    color: 'text-red-400',
    bg:    'bg-red-900 bg-opacity-40 border-red-700',
    icon:  AlertTriangle,
    hint:  'Dispute raised on this parcel. Check details.',
  },
  REJECTED: {
    label: 'Rejected',
    color: 'text-gray-400',
    bg:    'bg-gray-800 border-gray-700',
    icon:  XCircle,
    hint:  'Claim rejected by revenue officer. Contact your Patwari.',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatArea(ha: number): string {
  if (ha < 0.1) return `${(ha * 10000).toFixed(0)} sq.m`;
  return `${ha.toFixed(3)} ha`;
}

function formatValue(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

type Filter = 'all' | 'verified' | 'pending' | 'disputed';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'verified', label: 'Verified' },
  { key: 'pending',  label: 'Pending' },
  { key: 'disputed', label: 'Disputed' },
];

function matchFilter(parcel: Parcel, filter: Filter): boolean {
  if (filter === 'all')      return true;
  if (filter === 'verified') return parcel.claimStatus === 'VERIFIED';
  if (filter === 'disputed') return parcel.claimStatus === 'DISPUTED';
  return ['SEEDED_UNVERIFIED', 'CLAIM_SUBMITTED', 'UNDER_REVIEW', 'CI_APPROVED'].includes(parcel.claimStatus);
}

// ── Parcel Card ───────────────────────────────────────────────────────────────

function ParcelCard({ parcel }: { parcel: Parcel }) {
  const status = STATUS_CONFIG[parcel.claimStatus] ?? STATUS_CONFIG['SEEDED_UNVERIFIED'];
  const StatusIcon = status.icon;

  const cta = (() => {
    switch (parcel.claimStatus) {
      case 'SEEDED_UNVERIFIED': return { label: 'Claim Now',       href: `/claim/${parcel.dlpiId}`, primary: true };
      case 'CLAIM_SUBMITTED':   return { label: 'Submit for Review', href: `/claim/${parcel.dlpiId}`, primary: true };
      case 'UNDER_REVIEW':      return { label: 'Track Review',    href: `/claim/${parcel.dlpiId}`, primary: false };
      case 'CI_APPROVED':       return { label: 'Track Review',    href: `/claim/${parcel.dlpiId}`, primary: false };
      case 'VERIFIED':          return { label: 'Get EC',          href: `/ec/${parcel.dlpiId}`,    primary: true };
      case 'DISPUTED':          return { label: 'View Dispute',    href: `/claim/${parcel.dlpiId}`, primary: false };
      default:                  return { label: 'View Details',    href: `/claim/${parcel.dlpiId}`, primary: false };
    }
  })();

  return (
    <div className="card flex flex-col gap-4 hover:border-gray-600 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-brand-400 text-xs font-semibold tracking-wide">{parcel.dlpiId}</div>
          <div className="text-gray-200 font-medium text-sm mt-0.5 truncate">
            Khasra {parcel.khasraNo}
          </div>
          <div className="flex items-center gap-1 text-gray-500 text-xs mt-0.5">
            <MapPin className="w-3 h-3 shrink-0" />
            {parcel.tehsil}, {parcel.district}
          </div>
        </div>
        <span className={clsx(
          'shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-semibold',
          status.bg, status.color,
        )}>
          <StatusIcon className="w-3 h-3" />
          {status.label}
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-800 rounded-lg px-3 py-2">
          <div className="text-gray-500">Land Type</div>
          <div className="text-gray-200 font-medium mt-0.5">{parcel.landType}</div>
        </div>
        <div className="bg-gray-800 rounded-lg px-3 py-2">
          <div className="text-gray-500">Area</div>
          <div className="text-gray-200 font-medium mt-0.5">{formatArea(parcel.areaHectares)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg px-3 py-2">
          <div className="text-gray-500">Circle Rate</div>
          <div className="text-gray-200 font-medium mt-0.5">{formatValue(parcel.valuation.circleRateINR)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg px-3 py-2">
          <div className="text-gray-500">Encumbrance</div>
          <div className={clsx(
            'font-medium mt-0.5',
            parcel.encumbranceStatus === 'CLEAR' ? 'text-green-400' : 'text-red-400',
          )}>
            {parcel.encumbranceStatus.replace('_', ' ')}
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        {parcel.isTribal && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-900 bg-opacity-40 border border-amber-700 text-amber-400 text-xs">
            <Shield className="w-3 h-3" />
            Schedule V Protected
          </span>
        )}
        {parcel.isCoparcenary && (
          <span className="px-2 py-0.5 rounded-full bg-purple-900 bg-opacity-40 border border-purple-700 text-purple-400 text-xs">
            Coparcenary
          </span>
        )}
      </div>

      {/* Status hint */}
      <p className="text-xs text-gray-500">{status.hint}</p>

      {/* CTAs */}
      <div className="flex gap-2 pt-1 border-t border-gray-800">
        <Link
          href={cta.href}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors',
            cta.primary
              ? 'bg-brand-600 hover:bg-brand-700 text-white'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-300',
          )}
        >
          {cta.label}
          <ArrowRight className="w-3 h-3" />
        </Link>
        <Link
          href={`/map?dlpi=${parcel.dlpiId}`}
          className="px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors flex items-center gap-1"
        >
          <MapPin className="w-3 h-3" />
          Map
        </Link>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="card animate-pulse space-y-4">
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="h-3 w-36 bg-gray-700 rounded" />
          <div className="h-4 w-48 bg-gray-700 rounded" />
          <div className="h-3 w-32 bg-gray-700 rounded" />
        </div>
        <div className="h-6 w-24 bg-gray-700 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-800 rounded-lg" />)}
      </div>
      <div className="h-8 bg-gray-800 rounded-lg" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MyParcelsPage() {
  const router  = useRouter();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState<Filter>('all');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const user = getUser();
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'citizen') { router.replace('/officer-dashboard'); return; }
    setUserName(user.name);
    fetchParcels();
  }, []);

  async function fetchParcels() {
    setLoading(true);
    setError('');
    try {
      const res  = await apiFetch('/api/dlpi/my-parcels');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to load parcels');
      setParcels(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load parcels');
    } finally {
      setLoading(false);
    }
  }

  const filtered  = parcels.filter(p => matchFilter(p, filter));
  const counts    = {
    all:      parcels.length,
    verified: parcels.filter(p => p.claimStatus === 'VERIFIED').length,
    pending:  parcels.filter(p => ['SEEDED_UNVERIFIED', 'CLAIM_SUBMITTED', 'UNDER_REVIEW', 'CI_APPROVED'].includes(p.claimStatus)).length,
    disputed: parcels.filter(p => p.claimStatus === 'DISPUTED').length,
  };

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">My Parcels</h1>
              <p className="text-gray-400 text-sm mt-1">
                {userName && <span>{userName} · </span>}
                {loading ? 'Loading…' : `${parcels.length} parcel${parcels.length !== 1 ? 's' : ''} on BhumiChain`}
              </p>
            </div>
            <button
              onClick={fetchParcels}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-900 bg-opacity-30 border border-red-700 text-red-300 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Filter tabs */}
          {!loading && parcels.length > 0 && (
            <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl w-fit">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={clsx(
                    'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                    filter === f.key
                      ? 'bg-brand-600 text-white'
                      : 'text-gray-400 hover:text-gray-200',
                  )}
                >
                  {f.label}
                  {counts[f.key] > 0 && (
                    <span className={clsx(
                      'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                      filter === f.key ? 'bg-brand-500 text-white' : 'bg-gray-800 text-gray-500',
                    )}>
                      {counts[f.key]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Parcels grid */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="w-12 h-12 text-gray-700 mb-4" />
              <p className="text-gray-400 font-medium">
                {filter === 'all' ? 'No parcels found' : `No ${filter} parcels`}
              </p>
              {filter === 'all' && (
                <p className="text-gray-600 text-sm mt-2 max-w-sm">
                  Your land records will appear here once they are seeded into BhumiChain by your Tehsildar.
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map(p => <ParcelCard key={p.dlpiId} parcel={p} />)}
            </div>
          )}

          {/* Footer note */}
          {!loading && parcels.length > 0 && (
            <p className="text-xs text-gray-600 text-center pb-4">
              Data on BhumiChain is tamper-proof once VERIFIED. Dispute window: 30 days from seeding.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
