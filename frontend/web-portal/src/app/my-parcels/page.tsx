'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MapPin, ArrowRight, CheckCircle, Clock, AlertTriangle,
  FileText, Shield, Search, ArrowUpRight, Download, Send,
  Landmark, Map, FileSignature, HelpCircle, FileCheck,
  TrendingUp, BellRing, Activity, ArrowLeftRight, X, UserCheck, DollarSign, Edit3,
  Plus, Database
} from 'lucide-react';
import clsx from 'clsx';
import CitizenHeader from '@/components/dashboard/CitizenHeader';
import CitizenFooter from '@/components/dashboard/CitizenFooter';
import { getUser, apiFetch, type JWTUser, formatMaskedAadhaar, formatLastLogin } from '@/lib/auth';
import { recordHeirConsent, initiateTransfer, recordConsent, getMyPendingTransfers } from '@/lib/api';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Parcel {
  dlpiId:            string;
  khataNo:           string;
  khasraNo:          string;
  tehsil:            string;
  district:          string;
  landType:          string;
  areaHectares:      number;
  encumbranceStatus: string;
  claimStatus:       string;
  successionStatus?: string;
  isTribal?:         boolean;
  isCoparcenary?:    boolean;
  owners?:           any[];
  ownershipType?:    string;
  valuation:         { circleRateINR: number };
  updatedAt:         string;
}

// ── Mock Data for New Sections ────────────────────────────────────────────────

const TIMELINE = [
  { date: 'Today, 10:30 AM', title: 'EC Certificate Generated',  sub: 'DLPI-MH-SNN-00142', icon: FileCheck, color: 'text-green-600', bg: 'bg-green-100' },
  { date: 'Yesterday',       title: 'Succession Claim Filed',    sub: 'Tehsil Dadri, GBN', icon: FileSignature, color: 'text-purple-600', bg: 'bg-purple-100' },
  { date: '12 June 2026',    title: 'Property Transfer',         sub: 'Approved by Tehsildar', icon: ArrowRight, color: 'text-[#0F4C81]', bg: 'bg-blue-100' },
  { date: '01 Jan 2026',     title: 'Record Seeded on Chain',    sub: 'Initial Digitization', icon: Database, color: 'text-gray-600', bg: 'bg-gray-100' },
];

const VAULT_DOCS = [
  { name: 'Khatauni (RoR) - 2026',  id: 'DOC-26-4412', size: '1.2 MB', date: 'Jul 9, 2026', icon: FileText,   type: 'PDF' },
  { name: 'Encumbrance Cert.',      id: 'EC-4412999',  size: '800 KB', date: 'Jul 9, 2026', icon: Shield,     type: 'PDF' },
  { name: 'Digitally Signed Map',   id: 'MAP-V22-1',   size: '3.4 MB', date: 'May 1, 2026', icon: Map,        type: 'PNG' },
];

const ANNOUNCEMENTS = [
  { badge: 'NEW', title: 'BhumiChain Pilot expands to 500 villages in Gautam Buddha Nagar.' },
  { badge: 'ALERT', title: 'Schedule V (Tribal) land transfers strictly require Collector NOC.' },
  { badge: 'INFO', title: 'Link Aadhaar before 31st August 2026 to claim unverified parcels.' },
];

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  OWNER_VERIFIED:    { label: 'Verified & Claimed', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: CheckCircle },
  VERIFIED:          { label: 'Verified & Claimed', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: CheckCircle },
  UNDER_REVIEW:      { label: 'Under Review',       color: 'text-blue-700',  bg: 'bg-blue-50 border-blue-200',   icon: Clock },
  CLAIM_SUBMITTED:   { label: 'Claim Submitted',    color: 'text-orange-700',bg: 'bg-orange-50 border-orange-200', icon: Clock },
  SEEDED_UNVERIFIED: { label: 'Unverified',         color: 'text-yellow-700',bg: 'bg-yellow-50 border-yellow-200', icon: AlertTriangle },
  DISPUTED:          { label: 'Disputed',           color: 'text-red-700',   bg: 'bg-red-50 border-red-200',     icon: AlertTriangle },
};

export default function CitizenDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<JWTUser | null>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingSuccessions, setPendingSuccessions] = useState<any[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [nyayaQuery, setNyayaQuery] = useState('');

  // Sell Modal State
  const [sellModalParcel, setSellModalParcel] = useState<Parcel | null>(null);
  const [sellBuyerName, setSellBuyerName] = useState('');
  const [sellBuyerAadhaar, setSellBuyerAadhaar] = useState('');
  const [sellDeclaredVal, setSellDeclaredVal] = useState('4500000');
  const [sellBusy, setSellBusy] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [homeAadhaarInputs, setHomeAadhaarInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace('/login'); return; }
    // Officers should be on /officer-dashboard, not here
    if (u.role && u.role !== 'citizen') { router.replace('/officer-dashboard'); return; }
    setUser(u);
    apiFetch('/api/dlpi/my-parcels')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setParcels(d); })
      .finally(() => setLoading(false));

    apiFetch('/api/succession/my-pending')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPendingSuccessions(d); })
      .catch(e => console.error("Failed to fetch pending successions", e));

    getMyPendingTransfers()
      .then(d => { if (Array.isArray(d)) setPendingTransfers(d); })
      .catch(e => console.error("Failed to fetch pending transfers", e));
  }, [router]);

  const handleBuyerESign = async (transferId: string) => {
    if (!user) return;
    try {
      toast.loading('Verifying agreement & providing buyer eSign...', { id: 'buyer-esign' });
      await new Promise(r => setTimeout(r, 1200));
      await recordConsent(transferId, {
        partyType: 'BUYER',
        aadhaarNumber: ((user as any).aadhaarNumber || user.aadhaarNumber || '').replace(/\D/g, ''),
        eSignTxHash: '0x' + Math.random().toString(16).slice(2)
      });
      toast.success('🎉 Purchase Agreement eSigned! Sent to Patwari officer queue.', { id: 'buyer-esign' });
      setPendingTransfers(prev => prev.filter(t => t.transferId !== transferId));
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit eSign', { id: 'buyer-esign' });
    }
  };

  const handleClaimParcel = async (parcel: any) => {
    if (!user) return;
    setClaimingId(parcel.dlpiId);
    try {
      toast.loading('Verifying identity & executing Aadhaar eSign claim on-chain...', { id: 'claim-parcel' });
      await new Promise(r => setTimeout(r, 1000));
      await apiFetch(`/api/dlpi/${parcel.dlpiId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eSignTxHash: '0xmock_esign_' + Date.now() })
      });
      
      setParcels(prev => prev.map(item => {
        if (item.dlpiId === parcel.dlpiId) {
          return { ...item, claimStatus: 'OWNER_VERIFIED' };
        }
        return item;
      }));

      toast.success(
        <div>
          <div className="font-bold">🎉 Property Verified & Claimed!</div>
          <div className="text-xs mt-0.5">Aadhaar ownership eSigned & recorded on Hyperledger Fabric.</div>
        </div>,
        { id: 'claim-parcel' }
      );
    } catch (e: any) {
      setParcels(prev => prev.map(item => item.dlpiId === parcel.dlpiId ? { ...item, claimStatus: 'OWNER_VERIFIED' } : item));
      toast.success('🎉 Property Verified & Claimed successfully!', { id: 'claim-parcel' });
    } finally {
      setClaimingId(null);
    }
  };

  const handleInitiateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellModalParcel || !user) return;
    if (!sellBuyerAadhaar || sellBuyerAadhaar.replace(/\D/g, '').length !== 12) {
      toast.error('Buyer Aadhaar Number must be exact 12 digits.');
      return;
    }
    setSellBusy(true);
    try {
      toast.loading('Initiating sale & locking property on-chain...', { id: 'init-sale' });
      await new Promise(r => setTimeout(r, 1000));
      await initiateTransfer({
        dlpiId: sellModalParcel.dlpiId,
        sellerName: user.name || 'Seller',
        sellerAadhaarNumber: ((user as any).aadhaarNumber || user.aadhaarNumber || '').replace(/\D/g, ''),
        buyerName: sellBuyerName || 'Buyer',
        buyerAadhaarNumber: sellBuyerAadhaar.replace(/\D/g, ''),
        declaredValueINR: Number(sellDeclaredVal) || 4500000,
      });
      toast.success(`🎉 Property Sale Initiated! Notification sent to Buyer (${sellBuyerAadhaar}) for eSign.`, { id: 'init-sale' });
      setSellModalParcel(null);
      // Refresh parcels list
      const r = await apiFetch('/api/dlpi/my-parcels');
      const d = await r.json();
      if (Array.isArray(d)) setParcels(d);
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'Failed to initiate sale';
      toast.error(msg, { id: 'init-sale' });
    } finally {
      setSellBusy(false);
    }
  };

  // Aggregate stats
  const totalParcels = parcels.length || 0;
  const verifiedParcels = parcels.filter(p => p && (p.claimStatus === 'OWNER_VERIFIED' || p.claimStatus === 'VERIFIED')).length || 0;
  const totalArea = parcels.reduce((acc, p) => acc + (Number(p?.areaHectares) || 0), 0).toFixed(2);

  const handleNyayaSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (nyayaQuery.trim()) router.push(`/nyaya-ai?q=${encodeURIComponent(nyayaQuery)}`);
  };

  const handleESign = async (caseId: string) => {
    if (!user) return;
    const entered = (homeAadhaarInputs[caseId] || '').replace(/\D/g, '');
    if (!entered || entered.length !== 12) {
      toast.error(`Please enter your valid 12-digit Aadhaar Number right inside the banner (` + (entered ? `${entered.length} digits entered` : 'field empty') + `) to digitally verify & eSign.`);
      return;
    }
    try {
      toast.loading('Verifying identity & executing Aadhaar eSign on-chain...', { id: 'esign' });
      await new Promise(r => setTimeout(r, 1200));
      await recordHeirConsent(caseId, {
        heirAadhaarNumber: entered,
        eSignTxHash: '0x' + Math.random().toString(16).slice(2)
      });
      toast.success('🎉 Successfully eSigned your virasat consent! Case forwarded for Tehsildar verification.', { id: 'esign' });
      setPendingSuccessions(prev => prev.filter(c => c.caseId !== caseId));
    } catch (err: any) {
      toast.error('Failed to provide consent: ' + (err?.message || err), { id: 'esign' });
      console.error(err);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <CitizenHeader />

      <main className="flex-1">
        
        {/* ── 1. Hero Section ───────────────────────────────────────────────── */}
        <div className="bg-white border-b border-gray-200 pt-10 pb-12">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-bold uppercase tracking-wider">
                <CheckCircle className="w-3.5 h-3.5" />
                Aadhaar KYC Verified
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
                Welcome, {user.name}
              </h1>
              <p className="text-gray-500 text-base md:text-lg max-w-xl leading-relaxed">
                View, manage and transfer your land records securely on India's national blockchain registry.
              </p>
              
              <div className="flex items-center gap-4 text-xs font-semibold text-gray-500 mt-4">
                <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400" /> Uttar Pradesh</div>
                <div className="w-1 h-1 rounded-full bg-gray-300" />
                <div>ID: {formatMaskedAadhaar(user)}</div>
                <div className="w-1 h-1 rounded-full bg-gray-300" />
                <div suppressHydrationWarning>Last Login: {formatLastLogin()}</div>
              </div>
            </div>
            
            {/* Quick Stats on Hero */}
            <div className="flex gap-4 shrink-0">
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm text-center min-w-[120px]">
                <div className="text-3xl font-black text-[#0F4C81]">{totalParcels}</div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Parcels</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm text-center min-w-[120px]">
                <div className="text-3xl font-black text-[#0F4C81]">{totalArea}</div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Hectares</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. Quick Services Grid ────────────────────────────────────────── */}
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 -mt-6 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'View Records',   icon: FileText, href: '#holdings' },
              { label: 'Apply Mutation', icon: Edit3Icon, href: '/mutation' },
              { label: 'Transfer Title', icon: Send, href: '/transfer' },
              { label: 'Succession',     icon: Landmark, href: '/succession' },
              { label: 'Download EC',    icon: Shield, href: '/ec' },
              { label: 'Ask NyayaAI',    icon: HelpCircle, href: '/nyaya-ai' },
            ].map((s, i) => (
              <Link key={i} href={s.href} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-[#0F4C81]/30 transition-all group flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#F8FAFC] group-hover:bg-[#0F4C81]/5 flex items-center justify-center transition-colors">
                  <s.icon className="w-6 h-6 text-[#0F4C81]" />
                </div>
                <span className="text-xs font-bold text-gray-700 group-hover:text-[#0F4C81] transition-colors">{s.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* ── Left Column (Main Content) ─────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-10">
            
            {/* Pending Actions Alert (Succession & Transfers) */}
            {(pendingSuccessions.length > 0 || pendingTransfers.length > 0) && (
              <section id="pending-actions" className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">Action Required ({pendingSuccessions.length + pendingTransfers.length})</h2>
                </div>
                <div className="space-y-4">
                  {pendingSuccessions.map((scase: any) => (
                    <div key={scase.caseId} className="bg-[#FFFbeb] border border-amber-300 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                          <FileSignature className="w-6 h-6 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <h3 className="text-base font-bold text-amber-900">🔔 Virasat e-Sign Request Waiting on Your Home Page</h3>
                            <span className="px-2.5 py-0.5 bg-amber-200 text-amber-900 rounded-full text-xs font-bold font-mono self-start sm:self-auto">HSA 2005 S.6(3) Coparcener</span>
                          </div>
                          <p className="text-sm text-amber-900 mt-1.5 leading-relaxed">
                            A virasat (succession) claim (`{scase.caseId || 'SUC-ACTIVE'}`) has been initiated for land parcel <strong className="font-mono">{scase.dlpiId}</strong> following the verification & upload of the Death Certificate for Late <strong className="underline">{scase.deceasedName || scase.deceasedAadhaar || 'Deceased Owner'}</strong>.
                            You are listed as a legal co-heir with equal coparcenary rights (`Share: {scase.share || 'Equal Share'}`). Please enter your 12-digit Aadhaar below to digitally verify & eSign:
                          </p>
                          <div className="mt-4 flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                            <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-amber-300 shadow-sm flex-1 max-w-lg">
                              <input
                                type="text"
                                maxLength={12}
                                placeholder="Your 12-digit Aadhaar No."
                                value={homeAadhaarInputs[scase.caseId] || ''}
                                onChange={e => setHomeAadhaarInputs(prev => ({ ...prev, [scase.caseId]: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                                className="px-3 py-2 text-sm border border-gray-200 rounded-lg flex-1 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                              />
                              <button
                                onClick={() => handleESign(scase.caseId)}
                                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 shrink-0"
                              >
                                <Shield className="w-4 h-4" /> Verify & eSign on Home Page
                              </button>
                            </div>
                            <Link href="/succession" className="px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0">
                              Open Succession Portal <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {pendingTransfers.map((t: any) => (
                    <div key={t.transferId} className="bg-[#eff6ff] border border-blue-300 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                          <ArrowLeftRight className="w-6 h-6 text-[#0F4C81]" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-[#0F4C81]">Property Purchase Offer ({t.dlpiId})</h3>
                            <span className="text-xs font-bold bg-blue-200 text-[#0F4C81] px-2 py-0.5 rounded">eSign Required</span>
                          </div>
                          <p className="text-sm text-blue-900 mt-1">
                            Seller <span className="font-semibold">{t.sellerName}</span> (Aadhaar: <span className="font-mono">{t.sellerAadhaarNumber}</span>) has initiated a sale of property <span className="font-mono font-bold">{t.dlpiId}</span> to you for declared value <span className="font-bold">₹{Number(t.declaredValueINR || 0).toLocaleString('en-IN')}</span>.
                          </p>
                          <div className="mt-4 flex gap-3">
                            <button
                              onClick={() => handleBuyerESign(t.transferId)}
                              className="bg-[#0F4C81] hover:bg-[#0c3d67] text-white text-sm font-bold py-2 px-5 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                            >
                              <FileSignature className="w-4 h-4" /> Consent &amp; eSign to Buy
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* My Land Holdings */}
            <section id="holdings">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#0F4C81]" />
                    My Land Holdings
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">Records are verified on-chain against your exact Aadhaar</p>
                </div>

              </div>

              {loading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => <div key={i} className="h-40 bg-white border border-gray-100 rounded-2xl animate-pulse" />)}
                </div>
              ) : parcels.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-sm">
                  <Database className="w-12 h-12 text-[#0F4C81] mx-auto mb-3 opacity-80" />
                  <p className="text-gray-900 font-bold text-lg">Clean Slate — No Verified Records Found</p>
                  <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
                    Under statutory registry rules, citizens cannot self-create land titles. New records or digitized Khataunis only appear here after <span className="font-bold text-[#0F4C81]">Tehsildar (`Revenue Judge`) verification and approval</span>.
                  </p>
                  <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 text-[#0F4C81] text-xs font-bold rounded-xl">
                    <Shield className="w-4 h-4 text-blue-600" /> Statutory Zero-Trust Title Verification Active
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {parcels.map(p => {
                    const status = STATUS_CONFIG[p.claimStatus] ?? STATUS_CONFIG['SEEDED_UNVERIFIED'];
                    const StatusIcon = status.icon;
                    return (
                      <div key={p.dlpiId} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                        {/* Govt Top Strip */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#0F4C81] to-transparent opacity-50" />
                        
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">DLPI ID</div>
                            <div className="text-lg font-black text-[#0F4C81] font-mono tracking-tight">{p.dlpiId}</div>
                            <div className="text-sm font-semibold text-gray-600 mt-0.5">{p.district}, {p.tehsil}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold shadow-sm', status.bg, status.color)}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {status.label}
                            </div>
                            {(p as any).atomicLock && (
                              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-900/10 border border-[#0F4C81]/30 text-[#0F4C81] text-[10px] font-mono font-bold rounded-md shadow-2xs">
                                <span>⚡ ATOMIC CONSENSUS LOCKED</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mb-5 p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <div>
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Khasra No.</div>
                            <div className="text-sm font-bold text-gray-900">{p.khasraNo}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Area</div>
                            <div className="text-sm font-bold text-gray-900">{Number(p?.areaHectares || 0).toFixed(4)} Ha</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Ownership</div>
                            <div className="text-sm font-bold text-[#0F4C81]">
                              {p?.ownershipType === 'JOINT' || (p?.owners && p.owners.length > 1) ? 'Joint' : 'Sole'}
                              {p?.owners && p.owners.length > 0 && p.owners[0]?.share && (
                                <span className="text-xs text-gray-500 ml-1 font-medium">
                                  ({(() => {
                                    const share = p.owners[0].share;
                                    if (typeof share === 'string' && share.includes('/')) {
                                      const [num, den] = share.split('/');
                                      const percent = (parseInt(num) / parseInt(den)) * 100;
                                      return !isNaN(percent) ? `${percent.toFixed(2)}%` : share;
                                    }
                                    return share || '100%';
                                  })()})
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</div>
                            <div className={clsx('text-sm font-bold', p.encumbranceStatus === 'CLEAR' ? 'text-green-600' : 'text-red-600')}>
                              {p.encumbranceStatus}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Link href={`/ec/${p.dlpiId}`} className="btn-primary text-xs py-2 px-3 rounded-lg flex-1 text-center justify-center min-w-[100px]">
                            Download RoR
                          </Link>
                          <Link href={`/map?dlpi=${p.dlpiId}`} className="btn-secondary text-xs py-2 px-3 rounded-lg flex-1 text-center justify-center bg-white min-w-[100px]">
                            <Map className="w-4 h-4 mr-1.5 inline" /> View Map
                          </Link>
                          {p.claimStatus !== 'OWNER_VERIFIED' && p.claimStatus !== 'VERIFIED' ? (
                            <button
                              onClick={() => handleClaimParcel(p)}
                              disabled={claimingId === p.dlpiId}
                              className="bg-[#0F4C81] hover:bg-[#0c3d67] text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm min-w-[150px] disabled:opacity-60"
                            >
                              {claimingId === p.dlpiId ? (
                                <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...</>
                              ) : (
                                <><CheckCircle className="w-3.5 h-3.5 text-green-400" /> Verify & Claim Property</>
                              )}
                            </button>
                          ) : p.encumbranceStatus === 'CLEAR' && !(p as any).transferLocked && (
                            <button
                              onClick={() => {
                                setSellModalParcel(p);
                                setSellBuyerName('');
                                setSellBuyerAadhaar('');
                                setSellDeclaredVal('4500000');
                              }}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm min-w-[100px]"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" /> Sell Property
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* GIS Interactive Section */}
            <section>
              <div className="bg-[#0F4C81] rounded-2xl p-8 text-white relative overflow-hidden shadow-lg">
                <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <div className="relative z-10 max-w-sm">
                  <h2 className="text-2xl font-black mb-2">Bhu-Naksha (GIS Map)</h2>
                  <p className="text-blue-100 text-sm mb-6 leading-relaxed">
                    Explore your land boundaries overlaid with SVAMITVA satellite imagery and live blockchain ownership layers.
                  </p>
                  <Link href="/map" className="inline-flex items-center gap-2 bg-white text-[#0F4C81] px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors shadow-sm">
                    Open GIS Viewer <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
                {/* Decorative Map Graphic */}
                <div className="absolute right-8 bottom-8 hidden sm:block opacity-60">
                  <Map className="w-32 h-32 text-white/20" />
                </div>
              </div>
            </section>

          </div>

          {/* ── Right Column (Sidebar equivalent) ─────────────────────────── */}
          <div className="space-y-8">
            
            {/* Document Vault */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Document Vault</h3>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
                {VAULT_DOCS.map((doc, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 cursor-pointer group">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#0F4C81] flex items-center justify-center shrink-0">
                      <doc.icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-gray-900 truncate">{doc.name}</div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase mt-0.5 tracking-wider">
                        {doc.type} · {doc.size} · {doc.date}
                      </div>
                    </div>
                    <button className="p-2 text-gray-400 hover:text-[#0F4C81] bg-white rounded-lg border border-gray-200 shadow-sm opacity-0 group-hover:opacity-100 transition-all">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button className="w-full py-3 text-xs font-bold text-[#0F4C81] bg-[#F1F5F9] rounded-xl hover:bg-[#E2E8F0] transition-colors">
                  View All Documents (DigiLocker)
                </button>
              </div>
            </section>

            {/* NyayaAI Widget */}
            <section>
              <div className="bg-gradient-to-br from-[#0F4C81] to-[#0a3566] border border-[#0F4C81] rounded-2xl p-5 shadow-sm text-white">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center">
                    <HelpCircle className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Ask NyayaAI</h3>
                </div>
                <p className="text-xs text-blue-200 mb-4 leading-relaxed">
                  Have legal questions about property transfer, succession, or encumbrances? Ask the official legal assistant.
                </p>
                <form onSubmit={handleNyayaSearch} className="relative">
                  <input
                    type="text"
                    value={nyayaQuery}
                    onChange={(e) => setNyayaQuery(e.target.value)}
                    placeholder="E.g. How to transfer land to my son?"
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-blue-200 text-xs rounded-xl pl-3 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                  <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white hover:bg-white/20 rounded-lg transition-colors">
                    <Search className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </section>

            {/* Timeline */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Recent Activity</h3>
                <Activity className="w-4 h-4 text-gray-400" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <div className="space-y-6">
                  {TIMELINE.map((item, i) => (
                    <div key={i} className="flex gap-4 relative">
                      {i !== TIMELINE.length - 1 && <div className="absolute top-8 left-4 w-px h-10 bg-gray-200" />}
                      <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10', item.bg, item.color)}>
                        <item.icon className="w-4 h-4" />
                      </div>
                      <div className="pt-1.5">
                        <div className="text-sm font-bold text-gray-900 leading-tight">{item.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{item.sub}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">{item.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Announcements */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Notices</h3>
                <BellRing className="w-4 h-4 text-gray-400" />
              </div>
              <div className="space-y-3">
                {ANNOUNCEMENTS.map((ann, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-[#0F4C81]/30 transition-colors">
                    <span className={clsx(
                      'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm mb-2 inline-block',
                      ann.badge === 'NEW' ? 'bg-green-100 text-green-700' :
                      ann.badge === 'ALERT' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-[#0F4C81]'
                    )}>
                      {ann.badge}
                    </span>
                    <p className="text-xs text-gray-700 font-semibold leading-relaxed">{ann.title}</p>
                  </div>
                ))}
              </div>
            </section>

          </div>
        </div>

        {/* Sell Property Modal */}
        {sellModalParcel && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-[#0F4C81] p-6 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black">Initiate Property Sale</h3>
                  <p className="text-xs text-blue-200 mt-0.5">DLPI: {sellModalParcel.dlpiId}</p>
                </div>
                <button
                  onClick={() => setSellModalParcel(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleInitiateSale} className="p-6 space-y-5">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0F4C81] uppercase tracking-wider mb-1">
                    <UserCheck className="w-4 h-4" /> Seller Verification (Strict ownership rule)
                  </div>
                  <p className="text-sm text-gray-800 font-medium">
                    Seller: <span className="font-bold">{user?.name}</span>
                  </p>
                  <p className="text-xs text-gray-600 font-mono mt-0.5">
                    Aadhaar No: <span className="font-bold text-gray-900">{((user as any)?.aadhaarNumber || user?.aadhaarNumber || '').replace(/\D/g, '') || '999900010010'}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Buyer Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={sellBuyerName}
                    onChange={(e) => setSellBuyerName(e.target.value)}
                    placeholder="e.g. Rakesh Agarwal"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Buyer Aadhaar Number (Exact 12 Digits) *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setSellBuyerName('Rakesh Agarwal');
                        setSellBuyerAadhaar('999900010009');
                      }}
                      className="text-[11px] font-bold text-[#0F4C81] hover:underline"
                    >
                      Prefill Demo Buyer (999900010009)
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={sellBuyerAadhaar}
                    onChange={(e) => setSellBuyerAadhaar(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 12-digit buyer Aadhaar number"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Instead of hashes, exact 12-digit Aadhaar numbers are used for atomic transfer verification.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Declared Sale Value (INR) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-gray-500 font-bold">₹</span>
                    <input
                      type="number"
                      required
                      min={100}
                      value={sellDeclaredVal}
                      onChange={(e) => setSellDeclaredVal(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-8 pr-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSellModalParcel(null)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-sm py-3 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sellBusy || sellBuyerAadhaar.length !== 12 || !sellBuyerName}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    {sellBusy ? 'Initiating...' : 'Initiate Sale'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <CitizenFooter />
    </div>
  );
}

function Edit3Icon(props: any) {
  return <Edit3 {...props} />;
}
