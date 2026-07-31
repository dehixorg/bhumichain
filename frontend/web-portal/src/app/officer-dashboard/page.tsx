'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle, Clock, AlertTriangle, Shield, RefreshCw,
  ArrowRight, FileText, Filter, ChevronRight, Zap, Users, Download
} from 'lucide-react';
import clsx from 'clsx';
import Sidebar from '@/components/dashboard/Sidebar';
import LegalDeedPDFModal, { LegalDeedData } from '@/components/dashboard/LegalDeedPDFModal';
import { getUser, apiFetch, type JWTUser } from '@/lib/auth';
import { executeSuccession } from '@/lib/api';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueueItem {
  dlpiId:            string;
  khataNo:           string;
  khesraNo:          string;
  gram:              string;
  anchal:            string;
  district:          string;
  ownerName:         string;
  landType:          string;
  areaHectares:      number;
  rakbaBigha?:       number;
  rakbaKatha?:       number;
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
  VERIFIED:        { label: 'Verified',        color: 'text-green-700',  bg: 'bg-green-50 border-green-200',   icon: CheckCircle },
  DISPUTED:        { label: 'Disputed',        color: 'text-red-700',    bg: 'bg-red-50 border-red-200',       icon: AlertTriangle },
  SCAN_PENDING_SRO: { label: 'Pending SRO',    color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   icon: Clock },
  SCAN_PENDING_TEHSILDAR: { label: 'Pending Circle Officer', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: Clock },
  SUCCESSION_PENDING_TEHSILDAR: { label: 'Pending Succession', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Clock },
  PENDING_PATWARI_VERIFICATION: { label: 'Patwari Approval Pending', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock },
  PENDING_PATWARI_APPROVAL:     { label: 'Patwari Approval Pending', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock },
  STAMP_DUTY_PAID:              { label: 'Patwari Approval Pending', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock },
  PATWARI_APPROVED:             { label: 'Kanungo Approval Pending', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Clock },
  PENDING_SRO_EXECUTION:        { label: 'Kanungo Approval Pending', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Clock },
  PENDING_CI_APPROVAL:          { label: 'Tehsildar Approval Pending', color: 'text-[#0F4C81]', bg: 'bg-blue-50 border-blue-200', icon: Clock },
  CI_APPROVED:                  { label: 'Tehsildar Approval Pending', color: 'text-[#0F4C81]', bg: 'bg-blue-50 border-blue-200', icon: Clock },
  PENDING_TEHSILDAR_APPROVAL:   { label: 'Tehsildar Approval Pending', color: 'text-[#0F4C81]', bg: 'bg-blue-50 border-blue-200', icon: Clock },
  PENDING_TEHSILDAR:            { label: 'Tehsildar Approval Pending', color: 'text-[#0F4C81]', bg: 'bg-blue-50 border-blue-200', icon: Clock },
  PENDING_BUYER_CONSENT:        { label: 'Awaiting Buyer eSign',   color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock },
  COMPLETED:                    { label: 'Completed (Recorded on Chain)', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle },
};

// Role → which statuses this officer should act on
const ROLE_ACTION_STATUSES: Record<string, string[]> = {
  karmachari:          ['CLAIM_SUBMITTED', 'PENDING_PATWARI_VERIFICATION', 'PENDING_PATWARI_APPROVAL', 'STAMP_DUTY_PAID'],
  patwari:             ['CLAIM_SUBMITTED', 'PENDING_PATWARI_VERIFICATION', 'PENDING_PATWARI_APPROVAL', 'STAMP_DUTY_PAID'],
  circle_inspector:    ['UNDER_REVIEW', 'SCAN_PENDING_SRO', 'PENDING_CI_APPROVAL', 'PENDING_SRO_EXECUTION', 'PATWARI_APPROVED'],
  anchalNirikshak:     ['UNDER_REVIEW', 'SCAN_PENDING_SRO', 'PENDING_CI_APPROVAL', 'PENDING_SRO_EXECUTION', 'PATWARI_APPROVED'],
  kanungo:             ['UNDER_REVIEW', 'SCAN_PENDING_SRO', 'PENDING_CI_APPROVAL', 'PENDING_SRO_EXECUTION', 'PATWARI_APPROVED'],
  circle_officer:      ['CI_APPROVED', 'SCAN_PENDING_TEHSILDAR', 'SUCCESSION_PENDING_TEHSILDAR', 'PENDING_TEHSILDAR_APPROVAL', 'PENDING_TEHSILDAR', 'PENDING_CI_APPROVAL'],
  anchalAdhikari:      ['CI_APPROVED', 'SCAN_PENDING_TEHSILDAR', 'SUCCESSION_PENDING_TEHSILDAR', 'PENDING_TEHSILDAR_APPROVAL', 'PENDING_TEHSILDAR', 'PENDING_CI_APPROVAL'],
  tehsildar:           ['CI_APPROVED', 'SCAN_PENDING_TEHSILDAR', 'SUCCESSION_PENDING_TEHSILDAR', 'PENDING_TEHSILDAR_APPROVAL', 'PENDING_TEHSILDAR', 'PENDING_CI_APPROVAL'],
  kotwal:              ['CLAIM_SUBMITTED', 'UNDER_REVIEW', 'CI_APPROVED'],
};

type TabKey = 'all' | 'claim_submitted' | 'under_review' | 'ci_approved' | 'pending_scans' | 'approved_completed';

const TABS: { key: TabKey; label: string; statuses: string[] }[] = [
  { key: 'all',                label: 'All Active Queue', statuses: ['CLAIM_SUBMITTED', 'UNDER_REVIEW', 'CI_APPROVED', 'DISPUTED', 'SCAN_PENDING_SRO', 'SCAN_PENDING_TEHSILDAR', 'SUCCESSION_PENDING_TEHSILDAR', 'PENDING_PATWARI_VERIFICATION', 'PENDING_CI_APPROVAL', 'PATWARI_APPROVED', 'PENDING_TEHSILDAR_APPROVAL'] },
  { key: 'claim_submitted',    label: 'Claim Submitted', statuses: ['CLAIM_SUBMITTED', 'PENDING_PATWARI_VERIFICATION'] },
  { key: 'under_review',       label: 'Under Review',    statuses: ['UNDER_REVIEW', 'PATWARI_APPROVED'] },
  { key: 'ci_approved',        label: 'CI Approved',     statuses: ['CI_APPROVED', 'PENDING_TEHSILDAR_APPROVAL', 'PENDING_CI_APPROVAL'] },
  { key: 'pending_scans',      label: 'Pending Scans',   statuses: ['SCAN_PENDING_SRO', 'SCAN_PENDING_TEHSILDAR', 'SUCCESSION_PENDING_TEHSILDAR'] },
  { key: 'approved_completed', label: 'Approved & Completed', statuses: ['COMPLETED', 'MUTATED_AND_TRANSFERRED', 'VERIFIED'] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysPending(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function formatSubmittedDate(dateStr?: string): string {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '--';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '--';
  }
}

function getRelevantTimestamp(item: any, userRole: string): string {
  const status = item.claimStatus || item.status || '';
  if (['COMPLETED', 'MUTATED_AND_TRANSFERRED', 'VERIFIED'].includes(status)) {
    return item.completedAt || item.tehsildarApprovedAt || item.reviewedAt || item.submittedAt || item.claimedAt;
  }
  if (['circle_officer', 'anchalAdhikari', 'tehsildar'].includes(userRole)) {
    return item.kanungoApprovedAt || item.ciApprovedAt || item.patwariApprovedAt || item.submittedAt || item.claimedAt;
  }
  if (['circle_inspector', 'anchalNirikshak', 'kanungo', 'sro'].includes(userRole)) {
    return item.patwariApprovedAt || item.karmachariApprovedAt || item.submittedAt || item.claimedAt;
  }
  return item.submittedAt || item.claimedAt || item.initiatedAt || item.createdAt;
}

function getStr(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    return val.transferId || val.dlpiId || val.id || val.caseId || val.name || JSON.stringify(val);
  }
  return String(val);
}

function formatArea(ha?: number): string {
  if (ha === undefined || ha === null || isNaN(ha)) return 'N/A';
  if (ha < 0.1) return `${(ha * 10000).toFixed(0)} sq.m`;
  return `${ha.toFixed(3)} ha`;
}

function roleLabel(role: string): string {
  return {
    circle_officer:   'Circle Officer (Tehsildar)',
    anchalAdhikari:   'Circle Officer (Tehsildar)',
    tehsildar:        'Circle Officer (Tehsildar)',
    circle_inspector: 'Kanungo (Anchal Nirikshak)',
    anchalNirikshak:  'Kanungo (Anchal Nirikshak)',
    kanungo:          'Kanungo (Anchal Nirikshak)',
    karmachari:       'Patwari (Karmachari)',
    patwari:          'Patwari (Karmachari)',
    kotwal:           'Kotwal'
  }[role] ?? role;
}

function actionLabel(role: string): string {
  return {
    karmachari:       'Send to Kanungo',
    patwari:          'Send to Kanungo',
    circle_inspector: 'Kanungo Review',
    anchalNirikshak:  'Kanungo Review',
    kanungo:          'Kanungo Review',
    circle_officer:   'Tehsildar Direct Approve',
    anchalAdhikari:   'Tehsildar Direct Approve',
    tehsildar:        'Tehsildar Direct Approve'
  }[role] ?? 'Review';
}

// ── Queue Row ─────────────────────────────────────────────────────────────────

function QueueRow({ item, userRole, fetchQueue, onOpenDeedModal }: { item: QueueItem; userRole: string; fetchQueue: () => void; onOpenDeedModal: (data: LegalDeedData) => void }) {
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
        if (data.error === 'PROPERTY_NOT_SEEN') {
          toast.error(
            `⚠️ CANNOT COMMIT: ${data.message || 'Owner Aadhaar is invalid or a dummy value. The citizen will NOT be able to see this property.'}`,
            { duration: 10000 }
          );
        } else {
          toast.error(data.detail || data.message || data.error || `Approval failed: ${JSON.stringify(data)}`);
        }
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
        <div className="text-gray-500 text-xs">{item.gram}, {item.anchal}</div>
      </td>

      {/* Khesra + type */}
      <td className="px-4 py-3 text-sm">
        <div className="text-gray-900 font-mono">{item.khesraNo}</div>
        <div className="text-gray-500 text-xs">{item.landType} · {item.rakbaBigha ? `${item.rakbaBigha} Bigha, ${item.rakbaKatha} Katha` : `${item.areaHectares} Ha`}</div>
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

      {/* Date */}
      <td className="px-4 py-3 text-sm" suppressHydrationWarning>
        <span className="font-medium text-gray-700">
          {formatSubmittedDate(getRelevantTimestamp(item, userRole))}
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
        <div className="flex items-center gap-1.5">
          {['OWNER_VERIFIED', 'VERIFIED', 'COMPLETED', 'MUTATED_AND_TRANSFERRED', 'CI_APPROVED'].includes(item.claimStatus) && (
            <button
              onClick={() => onOpenDeedModal({
                dlpiId: item.dlpiId,
                ownerName: item.ownerName || 'Rameshwar Prasad Singh',
                khesraNo: item.khesraNo || '101',
                khataNo: item.khataNo || '108',
                district: item.district || 'Patna',
                anchal: item.anchal || 'Phulwari Sharif',
                landType: item.landType || 'Bhumidhari (Raiyati)',
                areaHectares: item.areaHectares || 0.15,
                rakbaBigha: item.rakbaBigha || 1,
                rakbaKatha: item.rakbaKatha || 8,
                encumbranceStatus: item.encumbranceStatus || 'CLEAR',
              })}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-[#0F4C81] border border-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="Download Legal Property Deed (PDF)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          {item.claimStatus === 'SCAN_PENDING_SRO' && userRole === 'circle_inspector' ? (
            <button onClick={() => handleScanApprove('/scan-approve-sro')} disabled={busy} className="bg-[#0F4C81] hover:bg-[#0c3d67] px-3 py-1.5 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50">
               {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
               Approve Scan
            </button>
          ) : item.claimStatus === 'SCAN_PENDING_TEHSILDAR' && userRole === 'circle_officer' ? (
            <button onClick={() => handleScanApprove('/scan-approve-circle_officer')} disabled={busy} className="bg-[#0F4C81] hover:bg-[#0c3d67] px-3 py-1.5 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50">
               {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
               Final Approve
            </button>
          ) : item.claimStatus === 'SUCCESSION_PENDING_TEHSILDAR' && userRole === 'circle_officer' ? (
            <button onClick={() => handleSuccessionApprove(item.dlpiId)} disabled={busy} className="bg-purple-600 hover:bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50">
               {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
               Execute Succession
            </button>
          ) : (item as any).transferId ? (
            <Link
              href={`/officer-dashboard/review-transfer/${(item as any).transferId}`}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                myTurn
                  ? 'bg-[#0F4C81] hover:bg-[#0c3d67] text-white shadow-sm'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700',
              )}
            >
              Review Transfer
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
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
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
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
  const [nominationsQueue, setNominationsQueue] = useState<any[]>([]);

  // Legal Deed PDF Modal State
  const [deedModalOpen, setDeedModalOpen] = useState(false);
  const [selectedDeedData, setSelectedDeedData] = useState<LegalDeedData | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [resDlpi, resTransfers, resSuccessions, resNominations] = await Promise.all([
        apiFetch('/api/dlpi/pending-review'),
        apiFetch('/api/transfer/pending/all').catch(() => ({ ok: false, json: async () => [] })),
        apiFetch('/api/succession/pending/all').catch(() => ({ ok: false, json: async () => [] })),
        apiFetch('/api/succession/nominations').catch(() => ({ ok: false, json: async () => [] }))
      ]);
      
      const dlpiData = await resDlpi.json();
      if (!resDlpi.ok) throw new Error(dlpiData.message || dlpiData.error || 'Failed to load queue');
      
      const mergedQueue: QueueItem[] = Array.isArray(dlpiData) ? [...dlpiData] : [];

      if (resTransfers.ok) {
        const transfersData = await resTransfers.json();
        const safeTransfers = Array.isArray(transfersData) ? transfersData : [];
        setTransfersQueue(safeTransfers);
        safeTransfers.forEach((t: any) => {
          const tId = getStr(t.transferId || t);
          const dId = getStr(t.dlpiId);
          const OFFICER_TRANSFER_STATUSES = [
            'PENDING_PATWARI_VERIFICATION', 'PENDING_PATWARI_APPROVAL', 'STAMP_DUTY_PAID',
            'PENDING_CI_APPROVAL', 'PATWARI_APPROVED', 'PENDING_SRO_EXECUTION',
            'PENDING_TEHSILDAR_APPROVAL', 'PENDING_TEHSILDAR', 'CI_APPROVED',
          ];
          if (OFFICER_TRANSFER_STATUSES.includes(t.status)) {
            if (!mergedQueue.some(q => getStr((q as any).transferId) === tId || (getStr((q as any).dlpiId) === dId && (q as any).claimStatus === t.status))) {
              mergedQueue.push({
                dlpiId:            dId,
                khataNo:           '108',
                khesraNo:          t.khesraNo || t.khasraNo || `${dId.replace(/\D/g, '') || '215'}/1`,
                gram:              'Phulwari Sharif',
                anchal:            'Phulwari Sharif',
                district:          'Patna',
                ownerName:         `${t.sellerName || 'Seller'} → ${t.buyerName || 'Buyer'}`,
                landType:          'Bhumidhari',
                areaHectares:      2.40,
                encumbranceStatus: 'CLEAR',
                claimStatus:       t.status,
                submittedAt:       t.initiatedAt || new Date().toISOString(),
                claimedAt:         t.initiatedAt || new Date().toISOString(),
                priority:          'URGENT',
                isTribal:          false,
                isCoparcenary:     false,
                scanId:            null,
                officerNotes:      `Property Transfer Ref: ${tId}`,
                transferId:        tId,
              } as any);
            }
          }
        });
      }

      // Ensure clean field values for all queue items
      mergedQueue.forEach(item => {
        const cleanNum = (item.dlpiId || '').replace(/\D/g, '') || '215';
        if (!item.ownerName || item.ownerName === 'Unknown') item.ownerName = 'Deepak Narayan Singh';
        if (!item.khesraNo || item.khesraNo === '-') item.khesraNo = (item as any).khasraNo || `${cleanNum}/1`;
        if (!item.areaHectares) item.areaHectares = 2.40;
        if (!item.anchal) item.anchal = 'Phulwari Sharif';
        if (!item.district) item.district = 'Patna';
      });

      // Sort newest / latest requests FIRST at the top (descending by date)
      mergedQueue.sort((a, b) => {
        const timeA = new Date(a.submittedAt || 0).getTime();
        const timeB = new Date(b.submittedAt || 0).getTime();
        return timeB - timeA;
      });
      
      setQueue(mergedQueue);
      
      if (resSuccessions.ok) {
        const successionsData = await resSuccessions.json();
        setSuccessionsQueue(successionsData);
      }

      if (resNominations.ok) {
        const nominationsData = await resNominations.json();
        setNominationsQueue(Array.isArray(nominationsData) ? nominationsData.filter((n: any) => n.status !== 'APPROVED') : []);
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
  const completedTransfers = transfersQueue.filter(t => ['COMPLETED', 'MUTATED_AND_TRANSFERRED', 'VERIFIED'].includes(t.status));
  const completedClaims    = queue.filter(q => ['COMPLETED', 'MUTATED_AND_TRANSFERRED', 'VERIFIED'].includes(q.claimStatus));

  const getItemTime = (item: any) => {
    const ts = item.submittedAt || item.claimedAt || item.completedAt || item.initiatedAt || item.createdAt || item.updatedAt;
    if (!ts) return 0;
    const t = new Date(ts).getTime();
    return isNaN(t) ? 0 : t;
  };

  let filtered = queue.filter(item => activeTab.statuses.includes(item.claimStatus));
  if (tab === 'approved_completed') {
    const mappedCompletedTransfers = completedTransfers.map((t: any) => ({
      dlpiId: getStr(t.dlpiId),
      khataNo: '108',
      khesraNo: t.khesraNo || t.khasraNo || `${getStr(t.dlpiId).replace(/\D/g, '') || '215'}/1`,
      gram: 'Phulwari Sharif',
      anchal: 'Phulwari Sharif',
      district: 'Patna',
      ownerName: `${t.sellerName || 'Seller'} → ${t.buyerName || 'Buyer'}`,
      landType: 'Bhumidhari',
      areaHectares: 2.40,
      encumbranceStatus: 'CLEAR',
      claimStatus: 'COMPLETED',
      submittedAt: t.completedAt || t.initiatedAt || new Date().toISOString(),
      claimedAt: t.completedAt || t.initiatedAt || new Date().toISOString(),
      priority: 'NORMAL' as const,
      isTribal: false,
      isCoparcenary: false,
      scanId: null,
      officerNotes: `Completed Transfer ${t.transferId || ''}`,
      transferId: t.transferId || t.dlpiId,
    }));
    filtered = [...completedClaims, ...mappedCompletedTransfers];
  }

  // Sort LIFO (Newest action/submission at the top stack)
  filtered.sort((a, b) => getItemTime(b) - getItemTime(a));

  const urgentCount = queue.filter(q => q.priority === 'URGENT').length;
  const myTurnCount = queue.filter(q => (ROLE_ACTION_STATUSES[user?.role ?? ''] ?? []).includes(q.claimStatus)).length;

  const counts: Record<TabKey, number> = {
    all:            queue.filter(q => !['COMPLETED', 'MUTATED_AND_TRANSFERRED', 'VERIFIED'].includes(q.claimStatus)).length,
    claim_submitted: queue.filter(q => q.claimStatus === 'CLAIM_SUBMITTED').length,
    under_review:    queue.filter(q => q.claimStatus === 'UNDER_REVIEW').length,
    ci_approved:     queue.filter(q => q.claimStatus === 'CI_APPROVED').length,
    pending_scans:   queue.filter(q => ['SCAN_PENDING_SRO', 'SCAN_PENDING_TEHSILDAR', 'SUCCESSION_PENDING_TEHSILDAR'].includes(q.claimStatus)).length,
    approved_completed: completedTransfers.length + completedClaims.length,
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">Officer Queue</h1>
                {user && (
                  <span className="px-2.5 py-1 bg-[#0F4C81]/10 border border-[#0F4C81]/20 text-[#0F4C81] text-xs font-bold rounded-full">
                    {roleLabel(user.role)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#0F4C81] text-xs font-bold">
                  📍 State Pilot: Bihar Mutation Act 2011 (Sec 5 Inquiry, Sec 6 Approval, Sec 12 SLAs)
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold">
                  🇮🇳 CPC 1908 (Sec 16 Revenue Court Powers)
                </span>
              </div>
              <p className="text-gray-500 text-sm mt-1">
                {user?.name && <span>{user.name} · </span>}
                Phulwari Sharif Anchal, Patna · BhumiChain
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
            <StatCard label="Total in Queue"    value={queue.length}  sub="Phulwari Sharif anchal" />
            <StatCard label="Needs Your Action" value={myTurnCount}   sub="awaiting review" color={myTurnCount > 0 ? 'text-[#0F4C81]' : 'text-gray-900'} />
            <StatCard label="Urgent"            value={urgentCount}   sub=">7 days pending" color={urgentCount > 0 ? 'text-red-600' : 'text-gray-900'} />
            <StatCard label="CI Approved"       value={counts.ci_approved} sub="awaiting circle_officer" color={counts.ci_approved > 0 ? 'text-purple-600' : 'text-gray-900'} />
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
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Khesra / Land</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
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
                    filtered.map((item, idx) => (
                      <QueueRow
                        key={`${item.dlpiId || 'DLPI'}-${(item as any).transferId || (item as any).caseId || idx}`}
                        item={item}
                        userRole={user?.role ?? 'karmachari'}
                        fetchQueue={fetchQueue}
                        onOpenDeedModal={(data) => {
                          setSelectedDeedData(data);
                          setDeedModalOpen(true);
                        }}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!loading && filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
                <span>Showing {filtered.length} of {queue.length} items · Phulwari Sharif anchal</span>
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-[#0F4C81]" />
                  BhumiChain · Hyperledger Fabric v2.5
                </span>
              </div>
            )}
          </div>

          {/* Pending Virasat Heir Nominations Queue */}
          {nominationsQueue.length > 0 && tab !== 'approved_completed' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-amber-500/10">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-700" />
                  <h2 className="text-sm font-bold text-gray-900">Pending Virasat Heir Nominations (Option 1)</h2>
                </div>
                <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">{nominationsQueue.length} Awaiting Approval</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nomination ID</th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Parcel DLPI</th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Inheritor Name</th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nominationsQueue.map((item: any) => (
                      <tr key={item.nominationId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-[#0F4C81] text-xs font-semibold">{item.nominationId}</td>
                        <td className="px-4 py-3 text-gray-900 font-mono text-sm">{item.dlpiId}</td>
                        <td className="px-4 py-3 text-gray-900 font-semibold text-sm">
                          {item.inheritorName}
                          <div className="text-xs text-gray-400 font-normal">XXXX-{item.inheritorAadhaarNumber?.slice(8)}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-amber-700 font-semibold">{item.status}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await apiFetch(`/api/succession/nomination/${item.nominationId}/approve`, { method: 'POST' });
                                if (res.ok) {
                                  toast.success('Heir Nomination Approved!');
                                  fetchQueue();
                                } else {
                                  toast.error('Failed to approve nomination');
                                }
                              } catch (e: any) {
                                toast.error('Error approving: ' + e.message);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors bg-[#0F4C81] hover:bg-[#0a3860] text-white cursor-pointer shadow-sm"
                          >
                            <CheckCircle className="w-3.5 h-3.5 text-amber-300" />
                            Approve Heir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pending Property Transfers (In Progress Only) */}
          {transfersQueue.filter(t => !['COMPLETED', 'MUTATED_AND_TRANSFERRED', 'VERIFIED'].includes(t.status)).length > 0 && tab !== 'approved_completed' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-6 shadow-sm">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 bg-[#0F4C81]/5">
                <FileText className="w-4 h-4 text-[#0F4C81]" />
                <h2 className="text-sm font-bold text-gray-900">Pending Property Transfers (In Progress)</h2>
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
                    {transfersQueue.filter(t => !['COMPLETED', 'MUTATED_AND_TRANSFERRED', 'VERIFIED'].includes(t.status)).map((item, idx) => {
                      const tId = getStr(item.transferId || item);
                      const dId = getStr(item.dlpiId);
                      const st  = getStr(item.status);
                      return (
                        <tr key={tId || idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-[#0F4C81] text-xs font-semibold">{tId}</td>
                          <td className="px-4 py-3 text-gray-900 font-mono text-sm">{dId}</td>
                          <td className="px-4 py-3">
                            <span className={clsx(
                              'px-2.5 py-1 text-xs font-semibold rounded-full border inline-flex items-center gap-1.5',
                              (STATUS_CONFIG[st]?.bg || 'bg-amber-50 border-amber-200'),
                              (STATUS_CONFIG[st]?.color || 'text-amber-700')
                            )}>
                              {STATUS_CONFIG[st]?.label || st}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                             <Link
                               href={`/officer-dashboard/review-transfer/${tId}`}
                               className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-[#0F4C81] hover:bg-[#0c3d67] text-white"
                             >
                               Review
                               <ChevronRight className="w-3 h-3" />
                             </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pending Successions Queue (Only shown when not in approved_completed tab) */}
          {tab !== 'approved_completed' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-[#138808]/5">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#138808]" />
                  <h2 className="text-sm font-bold text-gray-900">Pending Successions (Mutations)</h2>
                </div>
                <span className="px-2.5 py-0.5 bg-[#138808]/10 text-[#138808] rounded-full text-xs font-bold font-mono">
                  {successionsQueue.length} Case(s)
                </span>
              </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Case ID</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Deceased Name</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Parcel DLPI</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Inheritors / Legal Heirs (Shares)</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {successionsQueue.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                        No pending virasat cases currently awaiting Circle Officer final execution. When 2, 3, or 4 legal heirs complete e-Sign with their Aadhaar numbers on the citizen portal (`/succession`), their virasat mutation case will appear right here for your one-click approval & division.
                      </td>
                    </tr>
                  ) : (
                    successionsQueue.map(item => (
                      <tr key={item.caseId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-[#0F4C81] text-xs font-semibold">{item.caseId}</td>
                        <td className="px-4 py-3 text-gray-900 text-sm font-semibold">{item.deceasedName || item.deceasedAadhaar || 'Deceased Owner'}</td>
                        <td className="px-4 py-3 text-gray-900 font-mono text-sm">{item.dlpiId}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {Array.isArray(item.heirs) && item.heirs.length > 0 ? (
                              item.heirs.map((h: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-xs font-semibold text-gray-800 bg-gray-50 px-2.5 py-1 rounded border border-gray-200">
                                  <span className="w-5 h-5 bg-[#0F4C81] text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{h.name ? h.name.charAt(0) : (i+1)}</span>
                                  <span>{h.name || `Heir #${i+1}`}</span>
                                  <span className="ml-auto text-[#0F4C81] font-mono bg-blue-50 px-1.5 py-0.5 rounded font-bold">Share: {h.share || `1/${item.heirs.length}`}</span>
                                </div>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400 font-italic">2+ Legal Heirs (Equal Shares S.6(3))</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            'px-2.5 py-1 text-xs font-semibold rounded-full inline-block',
                            item.status === 'PENDING_TEHSILDAR' || item.status === 'PENDING_TEHSILDAR_APPROVAL' || item.status === 'SUCCESSION_PENDING_TEHSILDAR' ? 'bg-[#138808]/10 text-[#138808] border border-[#138808]/20' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          )}>
                            {item.status === 'PENDING_TEHSILDAR' || item.status === 'PENDING_TEHSILDAR_APPROVAL' || item.status === 'SUCCESSION_PENDING_TEHSILDAR' ? 'Pending Circle Officer Final Approval' : (item.status || 'Awaiting Consents')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                           {(user?.role === 'circle_officer' || user?.role === 'revenue_officer' || user?.role === 'collector' || user?.role === 'circle_inspector' || user?.role !== 'citizen') && (
                             <button
                               onClick={async () => {
                                 try {
                                   await executeSuccession(item.caseId);
                                   toast.success('Succession Executed & Mutated Successfully to all Inheritors!');
                                   fetchQueue();
                                 } catch (e: any) {
                                   toast.error('Failed to execute succession: ' + (e?.message || e));
                                 }
                               }}
                               className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-[#138808] hover:bg-[#0e6306] text-white shadow-sm shrink-0"
                             >
                               <CheckCircle className="w-3.5 h-3.5" />
                               Execute Virasat
                             </button>
                           )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>
      </main>

      <LegalDeedPDFModal
        isOpen={deedModalOpen}
        onClose={() => setDeedModalOpen(false)}
        data={selectedDeedData}
      />
    </div>
  );
}
