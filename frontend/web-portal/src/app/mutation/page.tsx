'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  GitMerge, Clock, CheckCircle, AlertTriangle, Send, XCircle, Plus,
  RefreshCw, ArrowRight, Shield, FileText, Upload, AlertCircle, FilePlus,
  ArrowLeftRight, FileCheck, Check
} from 'lucide-react';
import clsx from 'clsx';
import Sidebar from '@/components/dashboard/Sidebar';
import { getUser, apiFetch, type JWTUser } from '@/lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  step: string;
  label: string;
  actor: string;
  at: string;
}

interface TimelineStep {
  step: string;
  label: string;
  actor: string;
  at: string | null;
  done: boolean;
}

interface Mutation {
  mutationId: string;
  dlpiId: string;
  mutationType: string;
  officerName: string;
  officerRank: string;
  currentOwnerName: string;
  newOwnerName: string;
  reason: string;
  status: string;
  initiatedAt: string;
  rejectionReason?: string | null;
  objectionReason?: string | null;
  applicantDetails?: {
    fullName: string;
    fatherName: string;
    aadhaarNumber: string;
    mobileNumber: string;
  };
  landDetails?: {
    district: string;
    tehsil: string;
    village: string;
    khataNumber: string;
    plotNumber: string;
    area: string;
  };
  previousOwnerDetails?: {
    fullName: string;
    aadhaarNumber: string;
  };
  newOwnerDetails?: {
    fullName: string;
    aadhaarNumber: string;
  };
  dynamicFields?: {
    registryNumber?: string;
    registryDate?: string;
    caseNumber?: string;
    schemeName?: string;
  };
  history: HistoryEntry[];
  timeline: TimelineStep[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_THEME: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  'Pending at Patwari':  { label: 'Pending at Patwari',  color: 'text-yellow-400', bg: 'bg-yellow-950/30', border: 'border-yellow-700/50', icon: Clock },
  'Pending at Kanungo':  { label: 'Pending at Kanungo',  color: 'text-orange-400', bg: 'bg-orange-950/30', border: 'border-orange-700/50', icon: Clock },
  'Pending at Tehsildar':{ label: 'Pending at Tehsildar',color: 'text-blue-400',   bg: 'bg-blue-950/30',   border: 'border-blue-700/50',   icon: Clock },
  'Approved':            { label: 'Approved',            color: 'text-green-400',  bg: 'bg-green-950/30',  border: 'border-green-700/50',  icon: CheckCircle },
  'Rejected':            { label: 'Rejected',            color: 'text-red-400',    bg: 'bg-red-950/30',    border: 'border-red-700/50',    icon: XCircle },
  'Objection Filed':     { label: 'Objection Filed',     color: 'text-purple-400', bg: 'bg-purple-950/30', border: 'border-purple-700/50', icon: AlertCircle },
};

export default function MutationDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<JWTUser | null>(null);
  const [mutations, setMutations] = useState<Mutation[]>([]);
  const [selectedMutation, setSelectedMutation] = useState<Mutation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Active Tab state
  // Citizens: 'track' | 'apply'
  // Officers: 'verify' | 'track'
  // Tehsildar: 'verify' | 'track' | 'special' | 'objections'
  const [activeTab, setActiveTab] = useState<string>('track');

  // Rejection Reason Modal/Input
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Objection Form
  const [filingObjection, setFilingObjection] = useState(false);
  const [objectionText, setObjectionText] = useState('');

  // ── CITIZEN FORM STATE ──────────────────────────────────────────────────────
  const [mutationType, setMutationType] = useState('Sale');
  const [applicantName, setApplicantName] = useState('');
  const [applicantFather, setApplicantFather] = useState('');
  const [applicantAadhaar, setApplicantAadhaar] = useState('');
  const [applicantMobile, setApplicantMobile] = useState('');

  const [landDistrict, setLandDistrict] = useState('Gautam Buddha Nagar');
  const [landTehsil, setLandTehsil] = useState('Dadri');
  const [landVillage, setLandVillage] = useState('Gharbara');
  const [landKhata, setLandKhata] = useState('142');
  const [landPlot, setLandPlot] = useState('00142');
  const [landArea, setLandArea] = useState('0.45');

  const [prevOwnerName, setPrevOwnerName] = useState('Deepak Narayan Singh');
  const [prevOwnerAadhaar, setPrevOwnerAadhaar] = useState('999900010010');

  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerAadhaar, setNewOwnerAadhaar] = useState('');

  // Dynamic fields
  const [registryNumber, setRegistryNumber] = useState('');
  const [registryDate, setRegistryDate] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [schemeName, setSchemeName] = useState('');

  const [declaration, setDeclaration] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);

  // ── Fetch Operations ────────────────────────────────────────────────────────
  const fetchMutations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/mutation');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to load');
      setMutations(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || 'Could not load mutations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
    fetchMutations();
    if (u.role !== 'citizen') {
      setActiveTab('verify');
    }
  }, [router, fetchMutations]);

  // ── Initiate Mutation ───────────────────────────────────────────────────────
  const handleApplyMutation = async (e: React.FormEvent, isSpecial: boolean = false) => {
    e.preventDefault();
    if (!declaration) {
      setError('Please check the declaration box.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const payload = {
      mutationType: isSpecial ? `Special: ${mutationType}` : mutationType,
      applicantDetails: {
        fullName: applicantName,
        fatherName: applicantFather,
        aadhaarNumber: applicantAadhaar,
        mobileNumber: applicantMobile,
      },
      landDetails: {
        district: landDistrict,
        tehsil: landTehsil,
        village: landVillage,
        khataNumber: landKhata,
        plotNumber: landPlot,
        area: landArea,
      },
      previousOwnerDetails: {
        fullName: prevOwnerName,
        aadhaarNumber: prevOwnerAadhaar,
      },
      newOwnerDetails: {
        fullName: newOwnerName,
        aadhaarNumber: newOwnerAadhaar,
      },
      dynamicFields: {
        registryNumber,
        registryDate,
        caseNumber,
        schemeName,
      },
      status: 'Pending at Patwari',
      officerName: user?.role !== 'citizen' ? user?.name : 'Citizen',
      officerRank: user?.role !== 'citizen' ? user?.role : 'Citizen',
    };

    try {
      const res = await apiFetch('/api/mutation', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to submit application');
      
      setSuccess(`Application submitted! Generated ID: ${data.mutationId}`);
      // Reset form
      setNewOwnerName('');
      setNewOwnerAadhaar('');
      setRegistryNumber('');
      setRegistryDate('');
      setCaseNumber('');
      setSchemeName('');
      setDeclaration(false);
      
      await fetchMutations();
      setActiveTab('track');
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Workflows: Approve & Reject Transitions ─────────────────────────────────
  const handleStatusTransition = async (targetStatus: string, reasonText: string = '') => {
    if (!selectedMutation) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await apiFetch(`/api/mutation/${selectedMutation.mutationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: targetStatus,
          reason: reasonText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Status transition failed');

      setSuccess(`Mutation ${selectedMutation.mutationId} updated to: ${targetStatus}`);
      setSelectedMutation(data);
      setRejecting(false);
      setRejectReason('');
      await fetchMutations();
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  // ── File Objection ──────────────────────────────────────────────────────────
  const handleFileObjection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMutation) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await apiFetch(`/api/mutation/${selectedMutation.mutationId}/objection`, {
        method: 'POST',
        body: JSON.stringify({
          objectionReason: objectionText,
          evidenceCID: 'QmUploadedObjectionFiles',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Objection filing failed');

      // Update status to Objection Filed on backend side too
      const statusRes = await apiFetch(`/api/mutation/${selectedMutation.mutationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'Objection Filed',
          reason: objectionText,
        }),
      });
      const updated = await statusRes.json();

      setSuccess('Objection filed successfully! The application will be reviewed by the Tehsildar.');
      setSelectedMutation(updated);
      setFilingObjection(false);
      setObjectionText('');
      await fetchMutations();
    } catch (err: any) {
      setError(err.message || 'Filing failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Filtering Lists ─────────────────────────────────────────────────────────
  const getFilteredMutations = () => {
    if (activeTab === 'verify') {
      // Shows pending items matching user role
      if (user?.role === 'patwari') {
        return mutations.filter(m => m.status === 'Pending at Patwari');
      }
      if (user?.role === 'circle_inspector') {
        return mutations.filter(m => m.status === 'Pending at Kanungo');
      }
      if (user?.role === 'tehsildar') {
        return mutations.filter(m => m.status === 'Pending at Tehsildar' || m.status === 'Objection Filed');
      }
      return [];
    }
    
    if (activeTab === 'objections') {
      return mutations.filter(m => m.status === 'Objection Filed');
    }

    // Default: 'track' tab shows everything or citizen's own
    return mutations;
  };

  const isCitizen = user?.role === 'citizen';
  const displayRoleLabel = (r: string) => {
    return { tehsildar: 'Tehsildar', circle_inspector: 'Kanungo / CI', patwari: 'Patwari', citizen: 'Citizen' }[r] ?? r;
  };

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden font-sans text-gray-200">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

          {/* Header Banner */}
          <div className="flex items-center justify-between border-b border-gray-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <GitMerge className="w-6 h-6 text-brand-500" />
                <h1 className="text-2xl font-bold tracking-tight text-white">Mutation Portal</h1>
              </div>
              <p className="text-gray-400 text-sm mt-1">
                Role: <span className="font-semibold text-brand-400">{displayRoleLabel(user?.role || '')}</span>
                {user?.jurisdictionCode && ` · Jurisdiction: ${user.jurisdictionCode}`}
              </p>
            </div>
            <button
              onClick={fetchMutations}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border border-gray-800 bg-gray-900 hover:bg-gray-800 hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={clsx('w-4 h-4 text-brand-400', loading && 'animate-spin')} />
              Sync Ledger
            </button>
          </div>

          {/* Toast Notifications */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-900/20 border border-red-800/60 text-red-300 text-sm animate-fade-in">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-900/20 border border-green-800/60 text-green-300 text-sm animate-fade-in">
              <CheckCircle className="w-5 h-5 shrink-0 text-green-400" />
              {success}
            </div>
          )}

          {/* TABS NAVIGATION */}
          <div className="flex gap-2 border-b border-gray-850 p-1 bg-gray-900/40 rounded-xl max-w-fit">
            {isCitizen ? (
              <>
                <button
                  onClick={() => { setActiveTab('track'); setSelectedMutation(null); }}
                  className={clsx('px-4 py-2 text-sm font-semibold rounded-lg transition-all', activeTab === 'track' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200')}
                >
                  Track Applications
                </button>
                <button
                  onClick={() => { setActiveTab('apply'); setSelectedMutation(null); }}
                  className={clsx('px-4 py-2 text-sm font-semibold rounded-lg transition-all', activeTab === 'apply' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200')}
                >
                  Apply Mutation
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setActiveTab('verify'); setSelectedMutation(null); }}
                  className={clsx('px-4 py-2 text-sm font-semibold rounded-lg transition-all', activeTab === 'verify' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200')}
                >
                  My Work Queue ({getFilteredMutations().length})
                </button>
                <button
                  onClick={() => { setActiveTab('track'); setSelectedMutation(null); }}
                  className={clsx('px-4 py-2 text-sm font-semibold rounded-lg transition-all', activeTab === 'track' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200')}
                >
                  All Mutation Records
                </button>
                {user?.role === 'tehsildar' && (
                  <>
                    <button
                      onClick={() => { setActiveTab('objections'); setSelectedMutation(null); }}
                      className={clsx('px-4 py-2 text-sm font-semibold rounded-lg transition-all', activeTab === 'objections' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200')}
                    >
                      Objections Queue ({mutations.filter(m => m.status === 'Objection Filed').length})
                    </button>
                    <button
                      onClick={() => { setActiveTab('special'); setSelectedMutation(null); }}
                      className={clsx('px-4 py-2 text-sm font-semibold rounded-lg transition-all', activeTab === 'special' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200')}
                    >
                      Create Special Mutation
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {/* MAIN GRID WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT / LIST / FORM LAYER */}
            <div className={clsx('lg:col-span-7 space-y-4', (activeTab === 'apply' || activeTab === 'special') && 'lg:col-span-12')}>
              
              {/* Form Render (Apply/Special) */}
              {(activeTab === 'apply' || activeTab === 'special') ? (
                <form onSubmit={(e) => handleApplyMutation(e, activeTab === 'special')} className="space-y-6">
                  <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-6">
                    
                    <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                      <FilePlus className="w-5 h-5 text-brand-400" />
                      <h2 className="text-lg font-bold text-white">
                        {activeTab === 'special' ? 'Special Mutation Creation (Tehsildar)' : 'New Land Mutation Application'}
                      </h2>
                    </div>

                    {/* Mutation Type Dropdown */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Select Mutation Type</label>
                      <select
                        value={mutationType}
                        onChange={(e) => setMutationType(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm focus:border-brand-500 outline-none text-gray-200 transition-colors"
                      >
                        {activeTab === 'special' ? (
                          <>
                            <option value="Suo-Moto Mutation">Suo-Moto Mutation</option>
                            <option value="Govt Land Allocation">Government Land Allocation</option>
                            <option value="Administrative Correction">Administrative Correction</option>
                          </>
                        ) : (
                          <>
                            <option value="Sale">Sale (Registry)</option>
                            <option value="Gift">Gift</option>
                            <option value="Inheritance">Inheritance</option>
                            <option value="Partition">Partition</option>
                            <option value="Government Land Allotment">Government Land Allotment</option>
                            <option value="Court Order Mutation">Court Order Mutation</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Form Fields: Grid layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Section 1: Applicant */}
                      <div className="bg-gray-950/60 border border-gray-850 p-5 rounded-2xl space-y-3">
                        <span className="text-xs font-bold text-brand-400 uppercase">1. Applicant Details</span>
                        <input
                          type="text" required placeholder="Applicant Full Name"
                          value={applicantName} onChange={e => setApplicantName(e.target.value)}
                          className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500"
                        />
                        <input
                          type="text" required placeholder="Father's Name"
                          value={applicantFather} onChange={e => setApplicantFather(e.target.value)}
                          className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500"
                        />
                        <input
                          type="text" required maxLength={12} placeholder="Aadhaar Number (12 digits)"
                          value={applicantAadhaar} onChange={e => setApplicantAadhaar(e.target.value.replace(/\D/g,''))}
                          className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500 font-mono"
                        />
                        <input
                          type="tel" required placeholder="Mobile Number"
                          value={applicantMobile} onChange={e => setApplicantMobile(e.target.value)}
                          className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500"
                        />
                      </div>

                      {/* Section 2: Land Details */}
                      <div className="bg-gray-950/60 border border-gray-850 p-5 rounded-2xl space-y-3">
                        <span className="text-xs font-bold text-brand-400 uppercase">2. Land Details</span>
                        <input
                          type="text" required placeholder="District"
                          value={landDistrict} onChange={e => setLandDistrict(e.target.value)}
                          className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500"
                        />
                        <input
                          type="text" required placeholder="Tehsil"
                          value={landTehsil} onChange={e => setLandTehsil(e.target.value)}
                          className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500"
                        />
                        <input
                          type="text" required placeholder="Village"
                          value={landVillage} onChange={e => setLandVillage(e.target.value)}
                          className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text" required placeholder="Khata No"
                            value={landKhata} onChange={e => setLandKhata(e.target.value)}
                            className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-2 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500 font-mono"
                          />
                          <input
                            type="text" required placeholder="Plot No"
                            value={landPlot} onChange={e => setLandPlot(e.target.value)}
                            className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-2 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500 font-mono"
                          />
                          <input
                            type="text" required placeholder="Area (Hect)"
                            value={landArea} onChange={e => setLandArea(e.target.value)}
                            className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-2 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500 font-mono"
                          />
                        </div>
                      </div>

                      {/* Section 3: Previous Owner */}
                      <div className="bg-gray-950/60 border border-gray-850 p-5 rounded-2xl space-y-3">
                        <span className="text-xs font-bold text-brand-400 uppercase">3. Previous Owner Details</span>
                        <input
                          type="text" required placeholder="Full Name"
                          value={prevOwnerName} onChange={e => setPrevOwnerName(e.target.value)}
                          className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500"
                        />
                        <input
                          type="text" required maxLength={12} placeholder="Aadhaar Number (12 digits)"
                          value={prevOwnerAadhaar} onChange={e => setPrevOwnerAadhaar(e.target.value.replace(/\D/g,''))}
                          className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500 font-mono"
                        />
                      </div>

                      {/* Section 4: New Owner */}
                      <div className="bg-gray-950/60 border border-gray-850 p-5 rounded-2xl space-y-3">
                        <span className="text-xs font-bold text-brand-400 uppercase">4. New Owner Details</span>
                        <input
                          type="text" required placeholder="Full Name"
                          value={newOwnerName} onChange={e => setNewOwnerName(e.target.value)}
                          className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500"
                        />
                        <input
                          type="text" required maxLength={12} placeholder="Aadhaar Number"
                          value={newOwnerAadhaar} onChange={e => setNewOwnerAadhaar(e.target.value.replace(/\D/g,''))}
                          className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500 font-mono"
                        />
                      </div>

                    </div>

                    {/* Section 5: Dynamic Mutation-Type Fields */}
                    <div className="bg-gray-950/60 border border-gray-850 p-5 rounded-2xl space-y-3">
                      <span className="text-xs font-bold text-brand-400 uppercase block">5. Mutation-Type Dynamic Fields</span>
                      
                      {mutationType === 'Sale' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input
                            type="text" required placeholder="Registry Document Number"
                            value={registryNumber} onChange={e => setRegistryNumber(e.target.value)}
                            className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500 font-mono"
                          />
                          <input
                            type="date" required
                            value={registryDate} onChange={e => setRegistryDate(e.target.value)}
                            className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500 font-mono"
                          />
                        </div>
                      )}

                      {(mutationType === 'Court Order Mutation' || mutationType === 'Suo-Moto Mutation') && (
                        <input
                          type="text" required placeholder="Court Case Reference Number"
                          value={caseNumber} onChange={e => setCaseNumber(e.target.value)}
                          className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500 font-mono"
                        />
                      )}

                      {(mutationType === 'Government Land Allotment' || mutationType === 'Govt Land Allocation') && (
                        <input
                          type="text" required placeholder="Government Scheme Name"
                          value={schemeName} onChange={e => setSchemeName(e.target.value)}
                          className="w-full bg-gray-905 border border-gray-800/80 rounded-xl px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-brand-500"
                        />
                      )}

                      {(!['Sale', 'Court Order Mutation', 'Suo-Moto Mutation', 'Government Land Allotment', 'Govt Land Allocation'].includes(mutationType)) && (
                        <p className="text-xs text-gray-500 italic">No additional custom fields required for {mutationType} mutation.</p>
                      )}
                    </div>

                    {/* Section 6: Document Upload (Mock) */}
                    <div className="bg-gray-950/60 border border-gray-850 p-5 rounded-2xl space-y-4">
                      <span className="text-xs font-bold text-brand-400 uppercase block">6. Document Upload Section</span>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div 
                          onClick={() => { setUploadProgress(true); setTimeout(() => setUploadProgress(false), 800); }}
                          className="border border-dashed border-gray-850 hover:border-brand-500/60 bg-gray-905/60 p-4 rounded-xl flex flex-col items-center justify-center cursor-pointer text-center transition-colors group"
                        >
                          <Upload className="w-5 h-5 text-gray-500 group-hover:text-brand-400 mb-2" />
                          <span className="text-xs font-semibold text-gray-300">Registry Copy</span>
                          <span className="text-[10px] text-gray-600 mt-1">PDF or image (max 10MB)</span>
                        </div>

                        <div 
                          onClick={() => { setUploadProgress(true); setTimeout(() => setUploadProgress(false), 800); }}
                          className="border border-dashed border-gray-850 hover:border-brand-500/60 bg-gray-905/60 p-4 rounded-xl flex flex-col items-center justify-center cursor-pointer text-center transition-colors group"
                        >
                          <Upload className="w-5 h-5 text-gray-500 group-hover:text-brand-400 mb-2" />
                          <span className="text-xs font-semibold text-gray-300">Aadhaar / ID Proof</span>
                          <span className="text-[10px] text-gray-600 mt-1">PDF or image (max 10MB)</span>
                        </div>

                        <div 
                          onClick={() => { setUploadProgress(true); setTimeout(() => setUploadProgress(false), 800); }}
                          className="border border-dashed border-gray-850 hover:border-brand-500/60 bg-gray-905/60 p-4 rounded-xl flex flex-col items-center justify-center cursor-pointer text-center transition-colors group"
                        >
                          <Upload className="w-5 h-5 text-gray-500 group-hover:text-brand-400 mb-2" />
                          <span className="text-xs font-semibold text-gray-300">Supporting Docs</span>
                          <span className="text-[10px] text-gray-600 mt-1">Multi-upload field</span>
                        </div>
                      </div>
                      
                      {uploadProgress && (
                        <div className="h-1 w-full bg-gray-850 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 w-1/2 animate-[pulse_1s_infinite]"></div>
                        </div>
                      )}
                    </div>

                    {/* Section 7: Declaration Checkbox */}
                    <div className="flex items-start gap-3 bg-gray-950/40 p-4 border border-gray-850 rounded-2xl">
                      <input
                        type="checkbox" required id="decl"
                        checked={declaration} onChange={e => setDeclaration(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-gray-850 bg-gray-905 text-brand-600 focus:ring-brand-500"
                      />
                      <label htmlFor="decl" className="text-xs text-gray-400 leading-relaxed cursor-pointer select-none">
                        I hereby declare that all details filled above are accurate to the best of my knowledge. I understand that fraudulent submissions can lead to strict administrative/legal actions under UP Land Revenue rules.
                      </label>
                    </div>

                    {/* Section 8: Submit */}
                    <button
                      type="submit" disabled={loading}
                      className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg text-sm disabled:opacity-50"
                    >
                      Submit Mutation Application
                    </button>

                  </div>
                </form>
              ) : (
                /* List View of Active Queue */
                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-md font-bold text-white">
                      {activeTab === 'verify' ? 'Mutations Awaiting Action' : 'All Ledger Mutations'}
                    </h3>
                    <span className="text-xs font-medium text-gray-500 font-mono bg-gray-950 px-2 py-1 rounded">
                      Count: {getFilteredMutations().length}
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                    {loading && mutations.length === 0 ? (
                      [1, 2, 3].map(n => (
                        <div key={n} className="h-20 bg-gray-850 rounded-2xl animate-pulse" />
                      ))
                    ) : getFilteredMutations().length === 0 ? (
                      <div className="py-16 text-center border border-dashed border-gray-850 rounded-2xl">
                        <GitMerge className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                        <p className="text-xs text-gray-500">No mutations found in this queue</p>
                      </div>
                    ) : (
                      getFilteredMutations().map(m => {
                        const statusConfig = STATUS_THEME[m.status] || STATUS_THEME['Pending at Patwari'];
                        const StatusIcon = statusConfig.icon;
                        const isSelected = selectedMutation?.mutationId === m.mutationId;

                        return (
                          <div
                            key={m.mutationId}
                            onClick={() => { setSelectedMutation(m); setFilingObjection(false); }}
                            className={clsx(
                              'p-4 rounded-2xl border cursor-pointer hover:bg-gray-850/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 text-left',
                              isSelected ? 'bg-gray-800 border-brand-500/60 shadow-lg' : 'bg-gray-950/40 border-gray-850'
                            )}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-brand-400">{m.mutationId}</span>
                                <span className="text-[10px] text-gray-500 font-mono">{m.dlpiId}</span>
                              </div>
                              <div className="text-sm font-bold text-gray-200">{m.mutationType}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                <span>{m.currentOwnerName}</span>
                                <ArrowRight className="w-3 h-3 text-gray-600" />
                                <span className="text-gray-300 font-medium">{m.newOwnerName}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
                              <span className={clsx(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border capitalize',
                                statusConfig.bg, statusConfig.color, statusConfig.border
                              )}>
                                <StatusIcon className="w-3 h-3" />
                                {statusConfig.label}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* RIGHT SIDE: SELECTED DETAIL VIEW / WORKFLOW TRANSITIONS */}
            {activeTab !== 'apply' && activeTab !== 'special' && (
              <div className="lg:col-span-5 space-y-4">
                {selectedMutation ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-6 animate-slide-in">
                    
                    {/* Unique Tracking ID */}
                    <div className="border-b border-gray-800 pb-4 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-mono block">Unique ID</span>
                        <h3 className="font-mono text-md font-extrabold text-brand-400">{selectedMutation.mutationId}</h3>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-mono block text-right">Plot</span>
                        <span className="font-mono text-xs text-gray-300 font-semibold">{selectedMutation.dlpiId}</span>
                      </div>
                    </div>

                    {/* Stepper Progress Bar */}
                    <div className="space-y-4">
                      <span className="text-xs font-semibold text-gray-400 uppercase block tracking-wider">Mutation Stages Timeline</span>
                      
                      <div className="relative pl-6 space-y-5 border-l-2 border-gray-800">
                        {/* 1. Submitted */}
                        <div className="relative">
                          <span className={clsx(
                            'absolute -left-[31px] top-0 w-4 h-4 rounded-full flex items-center justify-center border-2 border-gray-900',
                            selectedMutation.timeline?.find(t => t.step === 'SUBMITTED')?.done ? 'bg-brand-500' : 'bg-gray-800'
                          )}>
                            <Check className="w-2.5 h-2.5 text-white" />
                          </span>
                          <div className="text-xs">
                            <div className="font-bold text-gray-200">Mutation Submitted</div>
                            <div className="text-gray-500 text-[10px]">By: {selectedMutation.timeline?.find(t => t.step === 'SUBMITTED')?.actor || 'Applicant'}</div>
                          </div>
                        </div>

                        {/* 2. Patwari */}
                        <div className="relative">
                          <span className={clsx(
                            'absolute -left-[31px] top-0 w-4 h-4 rounded-full flex items-center justify-center border-2 border-gray-900',
                            selectedMutation.timeline?.find(t => t.step === 'PATWARI')?.done ? 'bg-brand-500' : 'bg-gray-800'
                          )}>
                            {selectedMutation.timeline?.find(t => t.step === 'PATWARI')?.done && <Check className="w-2.5 h-2.5 text-white" />}
                          </span>
                          <div className="text-xs">
                            <div className={clsx('font-bold', selectedMutation.status === 'Pending at Patwari' ? 'text-yellow-400' : 'text-gray-200')}>
                              Patwari Verification
                            </div>
                            <div className="text-gray-500 text-[10px]">
                              {selectedMutation.timeline?.find(t => t.step === 'PATWARI')?.at 
                                ? `Approved at: ${new Date(selectedMutation.timeline?.find(t => t.step === 'PATWARI')?.at || '').toLocaleDateString()}`
                                : 'Pending verification'}
                            </div>
                          </div>
                        </div>

                        {/* 3. Kanungo */}
                        <div className="relative">
                          <span className={clsx(
                            'absolute -left-[31px] top-0 w-4 h-4 rounded-full flex items-center justify-center border-2 border-gray-900',
                            selectedMutation.timeline?.find(t => t.step === 'KANUNGO')?.done ? 'bg-brand-500' : 'bg-gray-800'
                          )}>
                            {selectedMutation.timeline?.find(t => t.step === 'KANUNGO')?.done && <Check className="w-2.5 h-2.5 text-white" />}
                          </span>
                          <div className="text-xs">
                            <div className={clsx('font-bold', selectedMutation.status === 'Pending at Kanungo' ? 'text-orange-400' : 'text-gray-200')}>
                              Kanungo (CI) Review
                            </div>
                            <div className="text-gray-500 text-[10px]">
                              {selectedMutation.timeline?.find(t => t.step === 'KANUNGO')?.at 
                                ? `Approved at: ${new Date(selectedMutation.timeline?.find(t => t.step === 'KANUNGO')?.at || '').toLocaleDateString()}`
                                : 'Pending review'}
                            </div>
                          </div>
                        </div>

                        {/* 4. Tehsildar */}
                        <div className="relative">
                          <span className={clsx(
                            'absolute -left-[31px] top-0 w-4 h-4 rounded-full flex items-center justify-center border-2 border-gray-900',
                            selectedMutation.status === 'Approved' ? 'bg-green-500' : selectedMutation.status === 'Rejected' ? 'bg-red-500' : 'bg-gray-800'
                          )}>
                            {selectedMutation.status === 'Approved' && <Check className="w-2.5 h-2.5 text-white" />}
                          </span>
                          <div className="text-xs">
                            <div className={clsx('font-bold', 
                              selectedMutation.status === 'Pending at Tehsildar' ? 'text-blue-400' : 
                              selectedMutation.status === 'Approved' ? 'text-green-400' : 
                              selectedMutation.status === 'Rejected' ? 'text-red-400' : 'text-gray-200'
                            )}>
                              Tehsildar final decision
                            </div>
                            <div className="text-gray-500 text-[10px]">
                              {selectedMutation.status === 'Approved' ? 'Final Approved & Updated in Jamabandi' : 
                               selectedMutation.status === 'Rejected' ? 'Application Rejected' : 'Awaiting final sign-off'}
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Land & Owner Card */}
                    <div className="bg-gray-950/40 p-4 border border-gray-850 rounded-2xl text-xs space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-semibold">Land Type:</span>
                        <span className="text-gray-300 font-mono">Bhumidhari</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-semibold">Previous Owner:</span>
                        <span className="text-gray-300 font-medium">{selectedMutation.currentOwnerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-semibold">New Title Owner:</span>
                        <span className="text-gray-300 font-semibold text-brand-400">{selectedMutation.newOwnerName}</span>
                      </div>
                      {selectedMutation.dynamicFields?.registryNumber && (
                        <div className="flex justify-between border-t border-gray-850/60 pt-2">
                          <span className="text-gray-500 font-semibold">Registry No:</span>
                          <span className="text-gray-300 font-mono">{selectedMutation.dynamicFields.registryNumber}</span>
                        </div>
                      )}
                    </div>

                    {/* Rejection / Objection Feedback Boxes */}
                    {selectedMutation.status === 'Rejected' && selectedMutation.rejectionReason && (
                      <div className="p-4 rounded-2xl bg-red-950/30 border border-red-900/60 text-xs space-y-2">
                        <div className="font-bold text-red-400 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" />
                          Rejection Reason (Tehsildar)
                        </div>
                        <p className="text-gray-400 italic">"{selectedMutation.rejectionReason}"</p>
                      </div>
                    )}

                    {selectedMutation.status === 'Objection Filed' && selectedMutation.objectionReason && (
                      <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-900/60 text-xs space-y-2">
                        <div className="font-bold text-purple-400 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" />
                          Objection Arguments
                        </div>
                        <p className="text-gray-400 italic">"{selectedMutation.objectionReason}"</p>
                      </div>
                    )}

                    {/* Dynamic Action Triggers */}
                    <div className="space-y-3">
                      
                      {/* Officer Dashboard Decision Making Buttons */}
                      {!isCitizen && (
                        <>
                          {/* Patwari actions */}
                          {user?.role === 'patwari' && selectedMutation.status === 'Pending at Patwari' && (
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => handleStatusTransition('Pending at Kanungo')}
                                className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Approve to Kanungo
                              </button>
                              <button
                                onClick={() => setRejecting(true)}
                                className="bg-gray-850 hover:bg-red-900/40 border border-gray-700 hover:border-red-800 text-gray-300 hover:text-red-300 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                              >
                                <XCircle className="w-4 h-4" />
                                Reject Application
                              </button>
                            </div>
                          )}

                          {/* Kanungo actions */}
                          {user?.role === 'circle_inspector' && selectedMutation.status === 'Pending at Kanungo' && (
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => handleStatusTransition('Pending at Tehsildar')}
                                className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Approve to Tehsildar
                              </button>
                              <button
                                onClick={() => setRejecting(true)}
                                className="bg-gray-850 hover:bg-red-900/40 border border-gray-700 hover:border-red-800 text-gray-300 hover:text-red-300 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                              >
                                <XCircle className="w-4 h-4" />
                                Reject Application
                              </button>
                            </div>
                          )}

                          {/* Tehsildar actions */}
                          {user?.role === 'tehsildar' && (selectedMutation.status === 'Pending at Tehsildar' || selectedMutation.status === 'Objection Filed') && (
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => handleStatusTransition('Approved')}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                              >
                                <FileCheck className="w-4 h-4" />
                                Final Approval
                              </button>
                              <button
                                onClick={() => setRejecting(true)}
                                className="bg-gray-800 hover:bg-red-900/40 border border-gray-700 hover:border-red-800 text-gray-300 hover:text-red-300 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                              >
                                <XCircle className="w-4 h-4" />
                                Reject Application
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      {/* Citizen Rejection -> Objection filing button trigger */}
                      {isCitizen && selectedMutation.status === 'Rejected' && !filingObjection && (
                        <button
                          onClick={() => setFilingObjection(true)}
                          className="w-full bg-purple-700 hover:bg-purple-800 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                        >
                          <AlertCircle className="w-4 h-4" />
                          File Legal Objection
                        </button>
                      )}

                    </div>

                    {/* Objection filing form panel inline */}
                    {isCitizen && filingObjection && (
                      <form onSubmit={handleFileObjection} className="space-y-4 border-t border-gray-800 pt-4 animate-fade-in">
                        <span className="text-xs font-bold text-purple-400 block uppercase tracking-wider">File Objection Arguments</span>
                        <div className="space-y-2">
                          <textarea
                            required rows={3} placeholder="Type detailed arguments/reasons why the mutation should not be rejected..."
                            value={objectionText} onChange={e => setObjectionText(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-850 rounded-xl p-3 text-xs outline-none focus:border-purple-500 text-gray-300"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] text-gray-500">Upload supporting evidence</label>
                          <div className="border border-dashed border-gray-800 p-3 rounded-xl flex items-center justify-center bg-gray-950 cursor-pointer">
                            <Upload className="w-4 h-4 text-gray-600 mr-2" />
                            <span className="text-xs text-gray-400">Add documents / certificates</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="submit"
                            className="bg-purple-700 hover:bg-purple-850 text-white font-bold py-2 rounded-xl text-xs"
                          >
                            Submit Objection
                          </button>
                          <button
                            type="button" onClick={() => setFilingObjection(false)}
                            className="bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-xl text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Rejection input box panel inline (for officers) */}
                    {rejecting && (
                      <div className="space-y-3 border-t border-gray-800 pt-4 animate-fade-in">
                        <span className="text-xs font-bold text-red-400 block uppercase tracking-wider">Describe Rejection Reason</span>
                        <textarea
                          required rows={2} placeholder="Explain why this record cannot be verified or approved..."
                          value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-850 rounded-xl p-3 text-xs outline-none focus:border-red-500 text-gray-300"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleStatusTransition('Rejected', rejectReason)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs"
                          >
                            Confirm Reject
                          </button>
                          <button
                            onClick={() => setRejecting(false)}
                            className="bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-xl text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="h-full border border-dashed border-gray-850 rounded-3xl p-16 flex flex-col items-center justify-center text-center text-gray-600 bg-gray-900/10">
                    <Shield className="w-12 h-12 text-gray-800 mb-4" />
                    <p className="text-xs font-semibold">Select an application from the queue to view status details and perform workflows.</p>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>
      </main>
    </div>
  );
}
