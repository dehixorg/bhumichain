'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowLeftRight, CheckCircle, AlertTriangle, Shield,
  FileText, Send, Building2, UserCheck, Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import Sidebar from '@/components/dashboard/Sidebar';
import AppHeader from '@/components/dashboard/AppHeader';
import { getUser, apiFetch, isOfficer, type JWTUser } from '@/lib/auth';
import toast from 'react-hot-toast';

export default function InitiateMutationPage() {
  const router = useRouter();
  const [user, setUser] = useState<JWTUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [dlpiId, setDlpiId] = useState('DLPI-Bihar-GBN-2026-0045');
  const [mutationType, setMutationType] = useState('Sale');
  const [currentOwnerName, setCurrentOwnerName] = useState('Ram Prasad Sharma');
  const [newOwnerName, setNewOwnerName] = useState('Amit Saxena');
  const [newOwnerAadhaar, setNewOwnerAadhaar] = useState('999988887777');
  const [reason, setReason] = useState('Registered Sale Deed No. 4412/2026 executed at Sub-Registrar Patna');
  const [supportingCID, setSupportingCID] = useState('QmSaleDeedGBN2026Hash99182x');
  const [courtOrderNo, setCourtOrderNo] = useState('');

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
  }, [router]);

  const handleQuickFill = (preset: 'Sale' | 'Inheritance' | 'Court_Order') => {
    if (preset === 'Sale') {
      setDlpiId('DLPI-Bihar-GBN-2026-0045');
      setMutationType('Sale');
      setCurrentOwnerName('Ram Prasad Sharma');
      setNewOwnerName('Amit Saxena');
      setNewOwnerAadhaar('999988887777');
      setReason('Registered Sale Deed No. 4412/2026 executed at Sub-Registrar Patna.');
      setSupportingCID('QmSaleDeedGBN2026Hash99182x');
      setCourtOrderNo('');
    } else if (preset === 'Inheritance') {
      setDlpiId('DLPI-Bihar-GBN-2026-0089');
      setMutationType('Inheritance');
      setCurrentOwnerName('Late Suresh Chandra');
      setNewOwnerName('Priya Kumar');
      setNewOwnerAadhaar('999900010012');
      setReason('Succession claim finalized following verification of Death Certificate CRS Reg. No. Bihar-2026-8812.');
      setSupportingCID('QmSuccessionCertificate2026');
      setCourtOrderNo('');
    } else if (preset === 'Court_Order') {
      setDlpiId('DLPI-Bihar-GBN-2026-0112');
      setMutationType('Court_Order');
      setCurrentOwnerName('Vijay Pal Singh');
      setNewOwnerName('Ankur Singh');
      setNewOwnerAadhaar('888877776666');
      setReason('Execution of Civil Court Decree dated 12/06/2026 ordering title transfer.');
      setSupportingCID('QmCourtDecreeHash2026');
      setCourtOrderNo('Civil Suit No. 112/2025 Allahabad High Court');
    }
    toast.success(`${preset} preset loaded!`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError('');

    try {
      toast.loading('Initiating Dakhil Kharij mutation on Hyperledger Fabric...', { id: 'init-mut' });
      const officerAadhaar = user.aadhaarNumber || user.aadhaar || user.aadhaarNo || user.aadhaarId || '999900010001';
      const cleanAadhaar = newOwnerAadhaar.replace(/\D/g, '');
      
      const payload = {
        dlpiId: dlpiId.trim(),
        mutationType,
        officerName: user.name || 'Revenue Officer',
        officerAadhaar: officerAadhaar,
        officerRank: user.role || 'circle_officer',
        newOwnerName: newOwnerName.trim(),
        newOwnerAadhaar: cleanAadhaar,
        reason: reason.trim(),
        supportingCID: supportingCID.trim(),
        courtOrderNo: courtOrderNo.trim(),
      };

      const res = await apiFetch('/api/mutation/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        let errorMsg = data.message || data.error;
        if (data.errors && Array.isArray(data.errors)) {
          errorMsg = data.errors.map((e: any) => `${e.param}: ${e.msg}`).join(', ');
        }
        throw new Error(errorMsg || 'Failed to initiate mutation');
      }

      toast.success(
        <div>
          <div className="font-bold">🎉 Mutation Initiated On-Chain!</div>
          <div className="text-xs mt-0.5 font-mono">{data.mutationId || 'MUT-ACTIVE'}</div>
          <div className="text-[11px] text-gray-200 mt-1">30-day statutory notice & Telegram alerts dispatched.</div>
        </div>,
        { id: 'init-mut', duration: 4000 }
      );

      router.push('/mutation');
    } catch (err: any) {
      const msg = err.message || 'Could not initiate mutation.';
      setError(msg);
      toast.error(msg, { id: 'init-mut' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <AppHeader />
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          
          {/* Top navigation bar */}
          <div className="flex items-center justify-between">
            <Link
              href="/mutation"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F4C81] hover:underline"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Mutation Manager
            </Link>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Presets:</span>
              {(['Sale', 'Inheritance', 'Court_Order'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleQuickFill(p)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#F8FAFC] hover:bg-[#0F4C81] hover:text-white text-gray-700 transition-colors border border-gray-200"
                >
                  {p === 'Court_Order' ? 'Court Order' : p}
                </button>
              ))}
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 lg:p-8 shadow-sm space-y-6">
            <div className="border-b border-gray-100 pb-5 flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0F4C81] text-xs font-bold uppercase tracking-wider mb-2">
                  <Shield className="w-3.5 h-3.5" /> Dakhil Kharij (दाखिल खारिज) Application
                </div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  Initiate Land Mutation
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Create a new statutory mutation case on Hyperledger Fabric. This starts the mandatory 30-day public objection window and triggers immediate alerts to the current owner.
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-300 text-red-800 text-sm font-medium">
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Section 1: Parcel & Mutation Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#F8FAFC] p-5 rounded-xl border border-gray-200">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Land Parcel ID (DLPI) *
                  </label>
                  <input
                    type="text"
                    required
                    value={dlpiId}
                    onChange={(e) => setDlpiId(e.target.value.toUpperCase())}
                    placeholder="DLPI-Bihar-GBN-2026-0045"
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                  />
                  <span className="text-[11px] text-gray-400 mt-1 block">National 16-digit land parcel unique identifier</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Mutation Type *
                  </label>
                  <select
                    value={mutationType}
                    onChange={(e) => setMutationType(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                  >
                    <option value="Sale">Sale / Bainama (बिक्री / बैनामा)</option>
                    <option value="Inheritance">Inheritance / Virasat (उत्तराधिकार / विरासत)</option>
                    <option value="Gift">Gift Deed / Danpatra (दानपत्र)</option>
                    <option value="Partition">Partition / Batwara (बँटवारा)</option>
                    <option value="Court_Order">Court Order / Decree (न्यायालय आदेश)</option>
                    <option value="Will">Will / Wasiyat (वसीयत)</option>
                  </select>
                  <span className="text-[11px] text-gray-400 mt-1 block">Select statutory classification under Bihar Revenue Code</span>
                </div>
              </div>

              {/* Section 2: Parties Involved */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl border border-gray-200 space-y-4 bg-white">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b pb-2">
                    <Building2 className="w-4 h-4 text-gray-400" /> Current Title Holder (`Transferor`)
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Owner Full Name *</label>
                    <input
                      type="text"
                      required
                      value={currentOwnerName}
                      onChange={(e) => setCurrentOwnerName(e.target.value)}
                      placeholder="e.g. Ram Prasad Sharma"
                      className="w-full bg-[#F8FAFC] border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                    />
                  </div>
                </div>

                <div className="p-5 rounded-xl border border-blue-200 space-y-4 bg-blue-50/30">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#0F4C81] border-b border-blue-100 pb-2">
                    <UserCheck className="w-4 h-4 text-[#0F4C81]" /> New Title Holder (`Transferee`)
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">New Owner Full Name *</label>
                    <input
                      type="text"
                      required
                      value={newOwnerName}
                      onChange={(e) => setNewOwnerName(e.target.value)}
                      placeholder="e.g. Amit Saxena"
                      className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">New Owner 12-Digit Aadhaar No. *</label>
                    <input
                      type="text"
                      required
                      maxLength={12}
                      value={newOwnerAadhaar}
                      onChange={(e) => setNewOwnerAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder="e.g. 999988887777"
                      className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Legal Basis & Documentation */}
              <div className="space-y-4 p-5 rounded-xl border border-gray-200 bg-[#F8FAFC]">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Statutory Basis / Reason for Mutation *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Provide full details of registered deed, court order, or succession case..."
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81] resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Supporting IPFS Document CID *
                    </label>
                    <input
                      type="text"
                      required
                      value={supportingCID}
                      onChange={(e) => setSupportingCID(e.target.value)}
                      placeholder="QmYourIPFSHash..."
                      className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                    />
                  </div>

                  {mutationType === 'Court_Order' && (
                    <div>
                      <label className="block text-xs font-bold text-red-700 uppercase tracking-wider mb-1.5">
                        Court Order / Decree No. *
                      </label>
                      <input
                        type="text"
                        required
                        value={courtOrderNo}
                        onChange={(e) => setCourtOrderNo(e.target.value)}
                        placeholder="Civil Suit No. 112/2025..."
                        className="w-full bg-white border border-red-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-red-600"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
                <Link
                  href="/mutation"
                  className="px-6 py-3 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-8 py-3 rounded-xl text-sm font-bold bg-[#0F4C81] hover:bg-[#0a3860] text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {busy ? 'Initiating on Hyperledger Fabric...' : 'Initiate Mutation & Dispatch Alerts'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
