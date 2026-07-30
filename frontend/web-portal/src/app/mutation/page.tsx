'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  GitMerge, Clock, CheckCircle, AlertTriangle, Send, XCircle, Plus,
  RefreshCw, ArrowRight, Shield, FileText, Upload, AlertCircle, FilePlus,
  ArrowLeftRight, FileCheck, Check, Search
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
  'Pending at Circle Officer':{ label: 'Pending at Circle Officer',color: 'text-blue-400',   bg: 'bg-blue-950/30',   border: 'border-blue-700/50',   icon: Clock },
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
  // Circle Officer: 'verify' | 'track' | 'special' | 'objections'
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

  // ── AADHAAR SEARCH & AUTOFILL STATE ─────────────────────────────────────────
  const [searchAadhaar, setSearchAadhaar] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [fetchedParcels, setFetchedParcels] = useState<any[]>([]);
  const [fetchedSellerName, setFetchedSellerName] = useState('');
  const [selectedParcelId, setSelectedParcelId] = useState('');

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

      setSuccess('Objection filed successfully! The application will be reviewed by the Circle Officer.');
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

  // ── Aadhaar Search & Autofill Handlers ─────────────────────────────────────
  const handleAadhaarSearch = async () => {
    if (searchAadhaar.length !== 12) {
      setError('Please enter a valid 12-digit Aadhaar number.');
      return;
    }
    setError('');
    setSearchError('');
    setSearchLoading(true);
    setFetchedParcels([]);
    setFetchedSellerName('');
    try {
      const res = await apiFetch(`/api/dlpi/by-aadhaar/${searchAadhaar}`);
      if (!res.ok) {
        throw new Error('Failed to search Aadhaar. No response from gateway.');
      }
      const data = await res.json();
      if (data && data.parcels && data.parcels.length > 0) {
        setFetchedSellerName(data.ownerName);
        setFetchedParcels(data.parcels);
        setSelectedParcelId('');
        setSuccess(`Found ${data.parcels.length} matching properties for ${data.ownerName}!`);
      } else {
        setSearchError('No properties found registered on BhumiChain for this Aadhaar card.');
        setError('Aadhaar lookup found no matching property records.');
      }
    } catch (err: any) {
      setSearchError(err.message || 'Error occurred while looking up Aadhaar.');
      setError(err.message || 'Lookup failed.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectParcel = (parcelId: string) => {
    setSelectedParcelId(parcelId);
    const p = fetchedParcels.find(x => x.dlpiId === parcelId);
    if (p) {
      setLandDistrict(p.district || 'Gautam Buddha Nagar');
      setLandTehsil(p.tehsil || 'Dadri');
      setLandVillage(p.gram || p.village || 'Gharbara');
      setLandKhata(p.khataNo || '');
      setLandPlot(p.khasraNo || '');
      setLandArea(String(p.areaHectares || ''));

      setPrevOwnerName(fetchedSellerName || p.ownerName || p.owner?.name || '');
      setPrevOwnerAadhaar(searchAadhaar);
      setSuccess(`Autofilled details from property ${parcelId}!`);
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
      if (user?.role === 'circle_officer') {
        return mutations.filter(m => m.status === 'Pending at Circle Officer' || m.status === 'Objection Filed');
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
    return { circle_officer: 'Circle Officer', circle_inspector: 'Kanungo / CI', patwari: 'Patwari', citizen: 'Citizen' }[r] ?? r;
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans text-gray-800">
      <style dangerouslySetInnerHTML={{ __html: `
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 30px #ffffff inset !important;
            -webkit-text-fill-color: #111827 !important;
            transition: background-color 5000s ease-in-out 0s;
        }
        input[type="date"] {
            color-scheme: light;
        }
      `}} />
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

          {/* Header Banner */}
          <div className="flex items-center justify-between border-b border-gray-200 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <GitMerge className="w-6 h-6 text-[#0F4C81]" />
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Mutation Portal</h1>
              </div>
              <p className="text-gray-400 text-sm mt-1">
                Role: <span className="font-semibold text-[#0F4C81]">{displayRoleLabel(user?.role || '')}</span>
                {user?.jurisdictionCode && ` · Jurisdiction: ${user.jurisdictionCode}`}
              </p>
            </div>
            <button
              onClick={fetchMutations}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border border-gray-200 bg-white hover:bg-gray-800 hover:text-gray-900 transition-all disabled:opacity-50"
            >
              <RefreshCw className={clsx('w-4 h-4 text-[#0F4C81]', loading && 'animate-spin')} />
              Sync Ledger
            </button>
          </div>

          {/* Toast Notifications */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-850 text-sm animate-fade-in">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-50 border border-green-200 text-green-850 text-sm animate-fade-in">
              <CheckCircle className="w-5 h-5 shrink-0 text-green-400" />
              {success}
            </div>
          )}

          {/* TABS NAVIGATION */}
          <div className="flex gap-2 border-b border-gray-200 p-1 bg-white/40 rounded-xl max-w-fit">
            {isCitizen ? (
              <>
                <button
                  onClick={() => { setActiveTab('track'); setSelectedMutation(null); }}
                  className={clsx('px-4 py-2 text-sm font-semibold rounded-lg transition-all', activeTab === 'track' ? 'bg-[#0F4C81] text-gray-900 shadow-lg' : 'text-gray-400 hover:text-gray-800')}
                >
                  Track Applications
                </button>
                <button
                  onClick={() => { setActiveTab('apply'); setSelectedMutation(null); }}
                  className={clsx('px-4 py-2 text-sm font-semibold rounded-lg transition-all', activeTab === 'apply' ? 'bg-[#0F4C81] text-gray-900 shadow-lg' : 'text-gray-400 hover:text-gray-800')}
                >
                  Apply Mutation
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setActiveTab('verify'); setSelectedMutation(null); }}
                  className={clsx('px-4 py-2 text-sm font-semibold rounded-lg transition-all', activeTab === 'verify' ? 'bg-[#0F4C81] text-gray-900 shadow-lg' : 'text-gray-400 hover:text-gray-800')}
                >
                  My Work Queue ({getFilteredMutations().length})
                </button>
                <button
                  onClick={() => { setActiveTab('track'); setSelectedMutation(null); }}
                  className={clsx('px-4 py-2 text-sm font-semibold rounded-lg transition-all', activeTab === 'track' ? 'bg-[#0F4C81] text-gray-900 shadow-lg' : 'text-gray-400 hover:text-gray-800')}
                >
                  All Mutation Records
                </button>
                {user?.role === 'circle_officer' && (
                  <>
                    <button
                      onClick={() => { setActiveTab('objections'); setSelectedMutation(null); }}
                      className={clsx('px-4 py-2 text-sm font-semibold rounded-lg transition-all', activeTab === 'objections' ? 'bg-[#0F4C81] text-gray-900 shadow-lg' : 'text-gray-400 hover:text-gray-800')}
                    >
                      Objections Queue ({mutations.filter(m => m.status === 'Objection Filed').length})
                    </button>
                    <button
                      onClick={() => { setActiveTab('special'); setSelectedMutation(null); }}
                      className={clsx('px-4 py-2 text-sm font-semibold rounded-lg transition-all', activeTab === 'special' ? 'bg-[#0F4C81] text-gray-900 shadow-lg' : 'text-gray-400 hover:text-gray-800')}
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
                  <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-2xl space-y-6">
                    
                    <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
                      <FilePlus className="w-5 h-5 text-[#0F4C81]" />
                      <h2 className="text-lg font-bold text-gray-900">
                        {activeTab === 'special' ? 'Special Mutation Creation (Circle Officer)' : 'New Land Mutation Application'}
                      </h2>
                    </div>

                    {/* Mutation Type Dropdown */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Select Mutation Type</label>
                      <select
                        value={mutationType}
                        onChange={(e) => setMutationType(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-[#0F4C81]/60 outline-none text-gray-800 transition-colors"
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

                    {/* Aadhaar Seller & Property Lookup Card */}
                    <div className="bg-[#F8FAFC]/80 border border-[#0F4C81]/30 p-5 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                        <span className="text-xs font-bold text-[#0F4C81] uppercase tracking-wider flex items-center gap-1.5">
                          <Search className="w-3.5 h-3.5" /> Seller &amp; Property lookup by Aadhaar
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">Real-time BhumiChain Query</span>
                      </div>
                      
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <input
                            type="text"
                            maxLength={12}
                            placeholder="Enter Seller Aadhaar Number (12 digits) e.g. 999900010010"
                            value={searchAadhaar}
                            onChange={(e) => setSearchAadhaar(e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60 font-mono"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={searchLoading || searchAadhaar.length !== 12}
                          onClick={handleAadhaarSearch}
                          className="px-4 py-2 bg-[#0F4C81] hover:bg-[#0a3566] text-gray-900 rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {searchLoading ? 'Fetching...' : 'Fetch Details'}
                        </button>
                      </div>

                      {searchError && (
                        <p className="text-red-400 text-xs mt-1">{searchError}</p>
                      )}

                      {fetchedSellerName && (
                        <div className="bg-white/60 p-4 rounded-xl border border-gray-200 space-y-3">
                          <div className="flex justify-between items-center text-xs text-gray-700">
                            <span>Seller Name: <strong>{fetchedSellerName}</strong></span>
                            <span className="text-[10px] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[#0F4C81]">Match Found</span>
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-xs text-gray-400">Select Property to Mutate *</label>
                            <select
                              value={selectedParcelId}
                              onChange={(e) => handleSelectParcel(e.target.value)}
                              className="w-full bg-[#F8FAFC] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60"
                            >
                              <option value="">-- Choose a property --</option>
                              {fetchedParcels.map(p => (
                                <option key={p.dlpiId} value={p.dlpiId}>
                                  {p.dlpiId} - Khasra {p.khasraNo} ({p.areaHectares} Hect, {p.gram || p.tehsil})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Form Fields: Grid layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Section 1: Applicant */}
                      <div className="bg-[#F8FAFC]/60 border border-gray-200 p-5 rounded-2xl space-y-3">
                        <span className="text-xs font-bold text-[#0F4C81] uppercase">1. Applicant Details</span>
                        <input
                          type="text" required placeholder="Applicant Full Name"
                          value={applicantName} onChange={e => setApplicantName(e.target.value)}
                          className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60"
                        />
                        <input
                          type="text" required placeholder="Father's Name"
                          value={applicantFather} onChange={e => setApplicantFather(e.target.value)}
                          className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60"
                        />
                        <input
                          type="text" required maxLength={12} placeholder="Aadhaar Number (12 digits)"
                          value={applicantAadhaar} onChange={e => setApplicantAadhaar(e.target.value.replace(/\D/g,''))}
                          className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60 font-mono"
                        />
                        <input
                          type="tel" required placeholder="Mobile Number"
                          value={applicantMobile} onChange={e => setApplicantMobile(e.target.value)}
                          className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60"
                        />
                      </div>

                      {/* Section 2: Land Details */}
                      <div className="bg-[#F8FAFC]/60 border border-gray-200 p-5 rounded-2xl space-y-3">
                        <span className="text-xs font-bold text-[#0F4C81] uppercase">2. Land Details</span>
                        <input
                          type="text" required placeholder="District"
                          value={landDistrict} onChange={e => setLandDistrict(e.target.value)}
                          className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60"
                        />
                        <input
                          type="text" required placeholder="Tehsil"
                          value={landTehsil} onChange={e => setLandTehsil(e.target.value)}
                          className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60"
                        />
                        <input
                          type="text" required placeholder="Village"
                          value={landVillage} onChange={e => setLandVillage(e.target.value)}
                          className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text" required placeholder="Khata No"
                            value={landKhata} onChange={e => setLandKhata(e.target.value)}
                            className="w-full bg-white border border-gray-200/80 rounded-xl px-2 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60 font-mono"
                          />
                          <input
                            type="text" required placeholder="Plot No"
                            value={landPlot} onChange={e => setLandPlot(e.target.value)}
                            className="w-full bg-white border border-gray-200/80 rounded-xl px-2 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60 font-mono"
                          />
                          <input
                            type="text" required placeholder="Area (Hect)"
                            value={landArea} onChange={e => setLandArea(e.target.value)}
                            className="w-full bg-white border border-gray-200/80 rounded-xl px-2 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60 font-mono"
                          />
                        </div>
                      </div>

                      {/* Section 3: Previous Owner */}
                      <div className="bg-[#F8FAFC]/60 border border-gray-200 p-5 rounded-2xl space-y-3">
                        <span className="text-xs font-bold text-[#0F4C81] uppercase">3. Previous Owner Details</span>
                        <input
                          type="text" required placeholder="Full Name"
                          value={prevOwnerName} onChange={e => setPrevOwnerName(e.target.value)}
                          className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60"
                        />
                        <input
                          type="text" required maxLength={12} placeholder="Aadhaar Number (12 digits)"
                          value={prevOwnerAadhaar} onChange={e => setPrevOwnerAadhaar(e.target.value.replace(/\D/g,''))}
                          className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60 font-mono"
                        />
                      </div>

                      {/* Section 4: New Owner */}
                      <div className="bg-[#F8FAFC]/60 border border-gray-200 p-5 rounded-2xl space-y-3">
                        <span className="text-xs font-bold text-[#0F4C81] uppercase">4. New Owner Details</span>
                        <input
                          type="text" required placeholder="Full Name"
                          value={newOwnerName} onChange={e => setNewOwnerName(e.target.value)}
                          className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60"
                        />
                        <input
                          type="text" required maxLength={12} placeholder="Aadhaar Number"
                          value={newOwnerAadhaar} onChange={e => setNewOwnerAadhaar(e.target.value.replace(/\D/g,''))}
                          className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60 font-mono"
                        />
                      </div>

                    </div>

                    {/* Section 5: Dynamic Mutation-Type Fields */}
                    <div className="bg-[#F8FAFC]/60 border border-gray-200 p-5 rounded-2xl space-y-3">
                      <span className="text-xs font-bold text-[#0F4C81] uppercase block">5. Mutation-Type Dynamic Fields</span>
                      
                      {mutationType === 'Sale' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input
                            type="text" required placeholder="Registry Document Number"
                            value={registryNumber} onChange={e => setRegistryNumber(e.target.value)}
                            className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60 font-mono"
                          />
                          <input
                            type="date" required
                            value={registryDate} onChange={e => setRegistryDate(e.target.value)}
                            className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60 font-mono"
                          />
                        </div>
                      )}

                      {(mutationType === 'Court Order Mutation' || mutationType === 'Suo-Moto Mutation') && (
                        <input
                          type="text" required placeholder="Court Case Reference Number"
                          value={caseNumber} onChange={e => setCaseNumber(e.target.value)}
                          className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60 font-mono"
                        />
                      )}

                      {(mutationType === 'Government Land Allotment' || mutationType === 'Govt Land Allocation') && (
                        <input
                          type="text" required placeholder="Government Scheme Name"
                          value={schemeName} onChange={e => setSchemeName(e.target.value)}
                          className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60"
                        />
                      )}

                      {(!['Sale', 'Court Order Mutation', 'Suo-Moto Mutation', 'Government Land Allotment', 'Govt Land Allocation'].includes(mutationType)) && (
                        <p className="text-xs text-gray-400 italic">No additional custom fields required for {mutationType} mutation.</p>
                      )}
                    </div>

                    {/* Section 6: Document Upload (Mock) */}
                    <div className="bg-[#F8FAFC]/60 border border-gray-200 p-5 rounded-2xl space-y-4">
                      <span className="text-xs font-bold text-[#0F4C81] uppercase block">6. Document Upload Section</span>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div 
                          onClick={() => { setUploadProgress(true); setTimeout(() => setUploadProgress(false), 800); }}
                          className="border border-dashed border-gray-200 hover:border-brand-500/60 bg-white/60 p-4 rounded-xl flex flex-col items-center justify-center cursor-pointer text-center transition-colors group"
                        >
                          <Upload className="w-5 h-5 text-gray-400 group-hover:text-[#0F4C81] mb-2" />
                          <span className="text-xs font-semibold text-gray-700">Registry Copy</span>
                          <span className="text-[10px] text-gray-600 mt-1">PDF or image (max 10MB)</span>
                        </div>

                        <div 
                          onClick={() => { setUploadProgress(true); setTimeout(() => setUploadProgress(false), 800); }}
                          className="border border-dashed border-gray-200 hover:border-brand-500/60 bg-white/60 p-4 rounded-xl flex flex-col items-center justify-center cursor-pointer text-center transition-colors group"
                        >
                          <Upload className="w-5 h-5 text-gray-400 group-hover:text-[#0F4C81] mb-2" />
                          <span className="text-xs font-semibold text-gray-700">Aadhaar / ID Proof</span>
                          <span className="text-[10px] text-gray-600 mt-1">PDF or image (max 10MB)</span>
                        </div>

                        <div 
                          onClick={() => { setUploadProgress(true); setTimeout(() => setUploadProgress(false), 800); }}
                          className="border border-dashed border-gray-200 hover:border-brand-500/60 bg-white/60 p-4 rounded-xl flex flex-col items-center justify-center cursor-pointer text-center transition-colors group"
                        >
                          <Upload className="w-5 h-5 text-gray-400 group-hover:text-[#0F4C81] mb-2" />
                          <span className="text-xs font-semibold text-gray-700">Supporting Docs</span>
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
                    <div className="flex items-start gap-3 bg-[#F8FAFC]/40 p-4 border border-gray-200 rounded-2xl">
                      <input
                        type="checkbox" required id="decl"
                        checked={declaration} onChange={e => setDeclaration(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-gray-200 bg-white text-brand-600 focus:ring-brand-500"
                      />
                      <label htmlFor="decl" className="text-xs text-gray-400 leading-relaxed cursor-pointer select-none">
                        I hereby declare that all details filled above are accurate to the best of my knowledge. I understand that fraudulent submissions can lead to strict administrative/legal actions under UP Land Revenue rules.
                      </label>
                    </div>

                    {/* Section 8: Submit */}
                    <button
                      type="submit" disabled={loading}
                      className="w-full bg-[#0F4C81] hover:bg-[#0a3566] text-gray-900 font-bold py-3 px-4 rounded-xl transition-all shadow-lg text-sm disabled:opacity-50"
                    >
                      Submit Mutation Application
                    </button>

                  </div>
                </form>
              ) : (
                /* List View of Active Queue */
                <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-md font-bold text-gray-900">
                      {activeTab === 'verify' ? 'Mutations Awaiting Action' : 'All Ledger Mutations'}
                    </h3>
                    <span className="text-xs font-medium text-gray-400 font-mono bg-[#F8FAFC] px-2 py-1 rounded">
                      Count: {getFilteredMutations().length}
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                    {loading && mutations.length === 0 ? (
                      [1, 2, 3].map(n => (
                        <div key={n} className="h-20 bg-gray-850 rounded-2xl animate-pulse" />
                      ))
                    ) : getFilteredMutations().length === 0 ? (
                      <div className="py-16 text-center border border-dashed border-gray-200 rounded-2xl">
                        <GitMerge className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                        <p className="text-xs text-gray-400">No mutations found in this queue</p>
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
                              isSelected ? 'bg-gray-800 border-brand-500/60 shadow-lg' : 'bg-[#F8FAFC]/40 border-gray-200'
                            )}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-[#0F4C81]">{m.mutationId}</span>
                                <span className="text-[10px] text-gray-400 font-mono">{m.dlpiId}</span>
                              </div>
                              <div className="text-sm font-bold text-gray-800">{m.mutationType}</div>
                              <div className="text-xs text-gray-400 flex items-center gap-1.5">
                                <span>{m.currentOwnerName}</span>
                                <ArrowRight className="w-3 h-3 text-gray-600" />
                                <span className="text-gray-700 font-medium">{m.newOwnerName}</span>
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
                  <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-2xl space-y-6 animate-slide-in">
                    
                    {/* Unique Tracking ID */}
                    <div className="border-b border-gray-200 pb-4 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-mono block">Unique ID</span>
                        <h3 className="font-mono text-md font-extrabold text-[#0F4C81]">{selectedMutation.mutationId}</h3>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-mono block text-right">Plot</span>
                        <span className="font-mono text-xs text-gray-700 font-semibold">{selectedMutation.dlpiId}</span>
                      </div>
                    </div>

                    {/* Stepper Progress Bar */}
                    <div className="space-y-4">
                      <span className="text-xs font-semibold text-gray-400 uppercase block tracking-wider">Mutation Stages Timeline</span>
                      
                      <div className="relative pl-6 space-y-5 border-l-2 border-gray-200">
                        {/* 1. Submitted */}
                        <div className="relative">
                          <span className={clsx(
                            'absolute -left-[31px] top-0 w-4 h-4 rounded-full flex items-center justify-center border-2 border-gray-900',
                            selectedMutation.timeline?.find(t => t.step === 'SUBMITTED')?.done ? 'bg-brand-500' : 'bg-gray-800'
                          )}>
                            <Check className="w-2.5 h-2.5 text-gray-900" />
                          </span>
                          <div className="text-xs">
                            <div className="font-bold text-gray-800">Mutation Submitted</div>
                            <div className="text-gray-400 text-[10px]">By: {selectedMutation.timeline?.find(t => t.step === 'SUBMITTED')?.actor || 'Applicant'}</div>
                          </div>
                        </div>

                        {/* 2. Patwari */}
                        <div className="relative">
                          <span className={clsx(
                            'absolute -left-[31px] top-0 w-4 h-4 rounded-full flex items-center justify-center border-2 border-gray-900',
                            selectedMutation.timeline?.find(t => t.step === 'PATWARI')?.done ? 'bg-brand-500' : 'bg-gray-800'
                          )}>
                            {selectedMutation.timeline?.find(t => t.step === 'PATWARI')?.done && <Check className="w-2.5 h-2.5 text-gray-900" />}
                          </span>
                          <div className="text-xs">
                            <div className={clsx('font-bold', selectedMutation.status === 'Pending at Patwari' ? 'text-yellow-400' : 'text-gray-800')}>
                              Patwari Verification
                            </div>
                            <div className="text-gray-400 text-[10px]">
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
                            {selectedMutation.timeline?.find(t => t.step === 'KANUNGO')?.done && <Check className="w-2.5 h-2.5 text-gray-900" />}
                          </span>
                          <div className="text-xs">
                            <div className={clsx('font-bold', selectedMutation.status === 'Pending at Kanungo' ? 'text-orange-400' : 'text-gray-800')}>
                              Kanungo (CI) Review
                            </div>
                            <div className="text-gray-400 text-[10px]">
                              {selectedMutation.timeline?.find(t => t.step === 'KANUNGO')?.at 
                                ? `Approved at: ${new Date(selectedMutation.timeline?.find(t => t.step === 'KANUNGO')?.at || '').toLocaleDateString()}`
                                : 'Pending review'}
                            </div>
                          </div>
                        </div>

                        {/* 4. Circle Officer */}
                        <div className="relative">
                          <span className={clsx(
                            'absolute -left-[31px] top-0 w-4 h-4 rounded-full flex items-center justify-center border-2 border-gray-900',
                            selectedMutation.status === 'Approved' ? 'bg-green-500' : selectedMutation.status === 'Rejected' ? 'bg-red-500' : 'bg-gray-800'
                          )}>
                            {selectedMutation.status === 'Approved' && <Check className="w-2.5 h-2.5 text-gray-900" />}
                          </span>
                          <div className="text-xs">
                            <div className={clsx('font-bold', 
                              selectedMutation.status === 'Pending at Circle Officer' ? 'text-blue-400' : 
                              selectedMutation.status === 'Approved' ? 'text-green-400' : 
                              selectedMutation.status === 'Rejected' ? 'text-red-400' : 'text-gray-800'
                            )}>
                              Circle Officer final decision
                            </div>
                            <div className="text-gray-400 text-[10px]">
                              {selectedMutation.status === 'Approved' ? 'Final Approved & Updated in Jamabandi' : 
                               selectedMutation.status === 'Rejected' ? 'Application Rejected' : 'Awaiting final sign-off'}
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Land & Owner Card */}
                    <div className="bg-[#F8FAFC]/40 p-4 border border-gray-200 rounded-2xl text-xs space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-semibold">Land Type:</span>
                        <span className="text-gray-700 font-mono">Bhumidhari</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-semibold">Previous Owner:</span>
                        <span className="text-gray-700 font-medium">{selectedMutation.currentOwnerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-semibold">New Title Owner:</span>
                        <span className="text-gray-700 font-semibold text-[#0F4C81]">{selectedMutation.newOwnerName}</span>
                      </div>
                      {selectedMutation.dynamicFields?.registryNumber && (
                        <div className="flex justify-between border-t border-gray-200/60 pt-2">
                          <span className="text-gray-400 font-semibold">Registry No:</span>
                          <span className="text-gray-700 font-mono">{selectedMutation.dynamicFields.registryNumber}</span>
                        </div>
                      )}
                    </div>

                    {/* Rejection / Objection Feedback Boxes */}
                    {selectedMutation.status === 'Rejected' && selectedMutation.rejectionReason && (
                      <div className="p-4 rounded-2xl bg-red-950/30 border border-red-900/60 text-xs space-y-2">
                        <div className="font-bold text-red-400 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" />
                          Rejection Reason (Circle Officer)
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
                                className="bg-[#0F4C81] hover:bg-[#0a3566] text-gray-900 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Approve to Kanungo
                              </button>
                              <button
                                onClick={() => setRejecting(true)}
                                className="bg-gray-850 hover:bg-red-900/40 border border-gray-350 hover:border-red-800 text-gray-700 hover:text-red-300 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
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
                                onClick={() => handleStatusTransition('Pending at Circle Officer')}
                                className="bg-[#0F4C81] hover:bg-[#0a3566] text-gray-900 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Approve to Circle Officer
                              </button>
                              <button
                                onClick={() => setRejecting(true)}
                                className="bg-gray-850 hover:bg-red-900/40 border border-gray-350 hover:border-red-800 text-gray-700 hover:text-red-300 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                              >
                                <XCircle className="w-4 h-4" />
                                Reject Application
                              </button>
                            </div>
                          )}

                          {/* Circle Officer actions */}
                          {user?.role === 'circle_officer' && (selectedMutation.status === 'Pending at Circle Officer' || selectedMutation.status === 'Objection Filed') && (
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => handleStatusTransition('Approved')}
                                className="bg-green-600 hover:bg-green-700 text-gray-900 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                              >
                                <FileCheck className="w-4 h-4" />
                                Final Approval
                              </button>
                              <button
                                onClick={() => setRejecting(true)}
                                className="bg-gray-800 hover:bg-red-900/40 border border-gray-350 hover:border-red-800 text-gray-700 hover:text-red-300 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
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
                          className="w-full bg-purple-700 hover:bg-purple-800 text-gray-900 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                        >
                          <AlertCircle className="w-4 h-4" />
                          File Legal Objection
                        </button>
                      )}

                    </div>

                    {/* Objection filing form panel inline */}
                    {isCitizen && filingObjection && (
                      <form onSubmit={handleFileObjection} className="space-y-4 border-t border-gray-200 pt-4 animate-fade-in">
                        <span className="text-xs font-bold text-purple-400 block uppercase tracking-wider">File Objection Arguments</span>
                        <div className="space-y-2">
                          <textarea
                            required rows={3} placeholder="Type detailed arguments/reasons why the mutation should not be rejected..."
                            value={objectionText} onChange={e => setObjectionText(e.target.value)}
                            className="w-full bg-[#F8FAFC] border border-gray-200 rounded-xl p-3 text-xs outline-none focus:border-purple-500 text-gray-700"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] text-gray-400">Upload supporting evidence</label>
                          <div className="border border-dashed border-gray-200 p-3 rounded-xl flex items-center justify-center bg-[#F8FAFC] cursor-pointer">
                            <Upload className="w-4 h-4 text-gray-600 mr-2" />
                            <span className="text-xs text-gray-400">Add documents / certificates</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="submit"
                            className="bg-purple-700 hover:bg-purple-850 text-gray-900 font-bold py-2 rounded-xl text-xs"
                          >
                            Submit Objection
                          </button>
                          <button
                            type="button" onClick={() => setFilingObjection(false)}
                            className="bg-gray-800 hover:bg-gray-700 text-gray-700 py-2 rounded-xl text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Rejection input box panel inline (for officers) */}
                    {rejecting && (
                      <div className="space-y-3 border-t border-gray-200 pt-4 animate-fade-in">
                        <span className="text-xs font-bold text-red-400 block uppercase tracking-wider">Describe Rejection Reason</span>
                        <textarea
                          required rows={2} placeholder="Explain why this record cannot be verified or approved..."
                          value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                          className="w-full bg-[#F8FAFC] border border-gray-200 rounded-xl p-3 text-xs outline-none focus:border-red-500 text-gray-700"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleStatusTransition('Rejected', rejectReason)}
                            className="bg-red-600 hover:bg-red-700 text-gray-900 font-bold py-2 rounded-xl text-xs"
                          >
                            Confirm Reject
                          </button>
                          <button
                            onClick={() => setRejecting(false)}
                            className="bg-gray-800 hover:bg-gray-700 text-gray-700 py-2 rounded-xl text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="h-full border border-dashed border-gray-200 rounded-3xl p-16 flex flex-col items-center justify-center text-center text-gray-600 bg-white/10">
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
