'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import AppHeader from '@/components/dashboard/AppHeader';
import { getUser, JWTUser } from '@/lib/auth';
import { apiFetch } from '@/lib/auth';
import { Map, Search, Eye, BadgeAlert, Layers, Home, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// Supress Leaflet SSR
const BhuNakshaMap = dynamic(() => import('@/components/map/BhuNakshaMap'), { ssr: false });

interface Parcel {
  dlpiId: string;
  khataNo: string;
  khasraNo: string;
  tehsil: string;
  district: string;
  state: string;
  landType: string;
  areaHectares: number;
  ownerName: string;
  latitude: number;
  longitude: number;
}

export default function BhuNakshaPage() {
  const router = useRouter();
  const [user, setUser] = useState<JWTUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search/Fetch states
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [selectedParcelId, setSelectedParcelId] = useState<string>('');
  
  // Officer search input
  const [searchAadhaar, setSearchAadhaar] = useState('');

  const isCitizen = user?.role === 'citizen';
  const selectedParcel = parcels.find(p => p.dlpiId === selectedParcelId);

  // Fetch parcels based on role and Aadhaar
  const loadParcels = useCallback(async (aadhaarQuery: string = '') => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const url = aadhaarQuery 
        ? `/api/bhu-naksha/parcels?aadhaar=${encodeURIComponent(aadhaarQuery)}`
        : '/api/bhu-naksha/parcels';
        
      const res = await apiFetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch map parcels.');
      
      const results = Array.isArray(data) ? data : [];
      setParcels(results);
      setSelectedParcelId(''); // Reset selection

      if (results.length > 0) {
        if (aadhaarQuery) {
          setSuccess(`Successfully loaded ${results.length} properties owned by ${results[0].ownerName}.`);
        } else {
          setSuccess(`Loaded ${results.length} registered properties.`);
        }
      } else {
        setError(aadhaarQuery ? 'No registered properties found for this Aadhaar card.' : 'No registered properties found.');
      }
    } catch (e: any) {
      setError(e.message || 'Could not fetch parcels.');
      toast.error('Map fetch failed.');
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
    
    // Automatically load citizen's own properties on page entry
    if (u.role === 'citizen') {
      loadParcels();
    }
  }, [router, loadParcels]);

  const handleOfficerSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchAadhaar.length !== 12) {
      toast.error('Aadhaar must be exactly 12 digits.');
      return;
    }
    loadParcels(searchAadhaar);
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans text-gray-800">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          
          {/* Header Banner */}
          <div className="flex items-center justify-between border-b border-gray-200 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <Map className="w-6 h-6 text-[#0F4C81]" />
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Bhu-Naksha (Map Viewer)</h1>
              </div>
              <p className="text-gray-500 text-sm mt-1">
                📍 State Pilot: Bihar Land Registration GIS Mapping &amp; SVAMITVA Verification
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-[#0F4C81] text-xs font-bold font-mono">
              Role: {isCitizen ? 'Citizen Self-Service' : 'Circle Officer'}
            </span>
          </div>

          {/* Status Toasts */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm animate-fade-in">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-50 border border-green-200 text-green-800 text-sm animate-fade-in">
              <CheckCircle className="w-5 h-5 shrink-0 text-green-600" />
              {success}
            </div>
          )}

          {/* Workspace Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Control Panel */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Aadhaar Search Card (Circle Officer only) */}
              {!isCitizen && (
                <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
                    <Search className="w-4 h-4 text-[#0F4C81]" />
                    <span className="text-sm font-bold text-gray-900 uppercase">Search Landholder</span>
                  </div>

                  <form onSubmit={handleOfficerSearch} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Aadhaar Number *</label>
                      <input
                        type="text"
                        maxLength={12}
                        placeholder="Enter 12-digit Aadhaar e.g. 999900010010"
                        value={searchAadhaar}
                        onChange={(e) => setSearchAadhaar(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-[#F8FAFC] border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60 font-mono transition-colors"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || searchAadhaar.length !== 12}
                      className="w-full py-2.5 bg-[#0F4C81] hover:bg-[#0a3566] text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <Search className="w-4 h-4" />
                      {loading ? 'Searching...' : 'Fetch Properties'}
                    </button>
                  </form>
                </div>
              )}

              {/* Property Selector Card */}
              <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
                  <Layers className="w-4 h-4 text-[#0F4C81]" />
                  <span className="text-sm font-bold text-gray-900 uppercase">Select Land Parcel</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Visited Property *</label>
                  <select
                    value={selectedParcelId}
                    disabled={parcels.length === 0}
                    onChange={(e) => setSelectedParcelId(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-gray-200 rounded-xl px-3 py-3 text-xs text-gray-800 outline-none focus:border-[#0F4C81]/60 font-medium transition-colors"
                  >
                    <option value="">-- Choose registered property --</option>
                    {parcels.map(p => (
                      <option key={p.dlpiId} value={p.dlpiId}>
                        {p.dlpiId} · Khasra {p.khasraNo} ({p.areaHectares} Hect, {p.landType})
                      </option>
                    ))}
                  </select>
                </div>

                {parcels.length > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 text-[#0F4C81] rounded-2xl flex gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">
                      All registered properties for this owner are flagged <strong className="text-blue-600">BLUE</strong>. The currently selected/visited property is highlighted in <strong className="text-red-600">RED</strong>.
                    </p>
                  </div>
                )}
              </div>

              {/* Selected Property Details Panel */}
              {selectedParcel && (
                <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm space-y-4 animate-fade-in">
                  <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
                    <Home className="w-4 h-4 text-[#0F4C81]" />
                    <span className="text-sm font-bold text-gray-900 uppercase">Visited Parcel Details</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#F8FAFC] p-3 rounded-xl border border-gray-200/50">
                      <div className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Khasra (Plot)</div>
                      <div className="font-bold text-gray-900 text-sm mt-0.5">{selectedParcel.khasraNo}</div>
                    </div>
                    <div className="bg-[#F8FAFC] p-3 rounded-xl border border-gray-200/50">
                      <div className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Khata Number</div>
                      <div className="font-bold text-gray-900 text-sm mt-0.5">{selectedParcel.khataNo}</div>
                    </div>
                    <div className="bg-[#F8FAFC] p-3 rounded-xl border border-gray-200/50">
                      <div className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Area (Hectares)</div>
                      <div className="font-bold text-gray-900 text-sm mt-0.5">{selectedParcel.areaHectares}</div>
                    </div>
                    <div className="bg-[#F8FAFC] p-3 rounded-xl border border-gray-200/50">
                      <div className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Land Classification</div>
                      <div className="font-bold text-gray-900 text-sm mt-0.5">{selectedParcel.landType}</div>
                    </div>
                  </div>

                  <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-gray-200/50 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Owner Name:</span>
                      <strong className="text-gray-900">{selectedParcel.ownerName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">District:</span>
                      <strong className="text-gray-900">{selectedParcel.district}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tehsil:</span>
                      <strong className="text-gray-900">{selectedParcel.tehsil}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Coordinates:</span>
                      <strong className="text-gray-900 font-mono text-[10px]">{selectedParcel.latitude.toFixed(4)}, {selectedParcel.longitude.toFixed(4)}</strong>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Right Map Canvas Panel */}
            <div className="lg:col-span-8 bg-white border border-gray-200 rounded-3xl p-4 shadow-sm">
              <div className="h-[550px] w-full">
                <BhuNakshaMap 
                  parcels={parcels} 
                  selectedParcelId={selectedParcelId} 
                />
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
