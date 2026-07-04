'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, Clock, AlertTriangle, FileText, Zap, ChevronRight } from 'lucide-react';
import { getUser, apiFetch, type JWTUser } from '@/lib/auth';
import { approveTransferByPatwari, approveTransferBySRO, approveTransferByTehsildar } from '@/lib/api';
import RecordScan from '@/components/forms/RecordScan';
import toast from 'react-hot-toast';

export default function ReviewTransferPage() {
  const router = useRouter();
  const { transferId } = useParams() as { transferId: string };
  const [user, setUser] = useState<JWTUser | null>(null);
  const [transfer, setTransfer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scanCID, setScanCID] = useState<string | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace('/login'); return; }
    setUser(u);
    fetchTransfer();
  }, [transferId]);

  const fetchTransfer = async () => {
    try {
      const res = await apiFetch(`/api/transfer/${transferId}`);
      if (!res.ok) throw new Error('Failed to fetch transfer details');
      const data = await res.json();
      setTransfer(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setBusy(true);
    try {
      if (user?.role === 'patwari') {
        toast('Patwari approving...');
        await approveTransferByPatwari(transferId);
        toast.success('Patwari Approved');
      } else if (user?.role === 'sro') {
        toast('SRO executing...');
        await approveTransferBySRO(transferId, 'QmTitleDeedNew' + Date.now());
        toast.success('SRO Executed');
      } else if (user?.role === 'tehsildar') {
        toast('Tehsildar finalizing mutation...');
        await approveTransferByTehsildar(transferId);
        toast.success('Transfer Completed & Title Mutated');
      } else {
        toast.error('Unauthorized role for approval');
      }
      router.push('/officer-dashboard');
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || 'Approval failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-950 text-brand-400">Loading...</div>;
  if (error || !transfer) return <div className="p-8 text-red-400">{error || 'Not found'}</div>;

  let canApprove = false;
  let actionLabel = 'Approve';
  
  if (user?.role === 'patwari' && transfer.status === 'STAMP_DUTY_PAID') {
    canApprove = scanCID !== null; // Patwari MUST scan deed first
    actionLabel = 'Approve (Patwari)';
  } else if (user?.role === 'sro' && transfer.status === 'PATWARI_APPROVED') {
    canApprove = true;
    actionLabel = 'Execute Deed (SRO)';
  } else if (user?.role === 'tehsildar' && transfer.status === 'SRO_EXECUTED') {
    canApprove = true;
    actionLabel = 'Finalize & Mutate (Tehsildar)';
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <header className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                Review Transfer
              </h1>
              <div className="text-xs text-brand-400 font-mono mt-0.5">{transferId}</div>
            </div>
          </div>
          {canApprove && (
            <button
              onClick={handleApprove}
              disabled={busy}
              className="btn-primary flex items-center gap-2"
            >
              {busy ? <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {actionLabel}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="card space-y-4">
           <h2 className="text-sm font-bold text-gray-200 border-b border-gray-800 pb-2">Transfer Details</h2>
           <div className="grid grid-cols-2 gap-4 text-sm">
             <div>
               <div className="text-gray-500 text-xs mb-1">Parcel DLPI</div>
               <div className="font-mono text-brand-400">{transfer.dlpiId}</div>
             </div>
             <div>
               <div className="text-gray-500 text-xs mb-1">Status</div>
               <div className="text-amber-400 font-bold">{transfer.status}</div>
             </div>
             <div>
               <div className="text-gray-500 text-xs mb-1">Sellers</div>
               <div>{transfer.sellers?.map((s: any) => s.name).join(', ')}</div>
             </div>
             <div>
               <div className="text-gray-500 text-xs mb-1">Buyers</div>
               <div>{transfer.buyers?.map((b: any) => b.name).join(', ')}</div>
             </div>
           </div>
        </div>

        {/* RecordScan AI Requirement for Patwari */}
        {user?.role === 'patwari' && transfer.status === 'STAMP_DUTY_PAID' && !scanCID && (
           <div className="card border-amber-900/50 space-y-4">
             <div className="flex items-center gap-2 mb-4">
               <AlertTriangle className="w-5 h-5 text-amber-400" />
               <h2 className="text-sm font-bold text-amber-300">Deed Verification Required</h2>
             </div>
             <p className="text-gray-400 text-sm mb-4">
               Please upload the physical copy of the sale agreement/deed. RecordScan AI will verify it before you can approve the transfer.
             </p>
             <div className="border border-gray-800 rounded-xl bg-gray-950 p-4">
               <RecordScan mode="transfer" onScanComplete={(cid) => setScanCID(cid)} />
             </div>
           </div>
         )}
         {scanCID && (
           <div className="card border-brand-900/50 flex items-center gap-3 text-brand-300 bg-brand-950/20">
             <CheckCircle className="w-5 h-5 shrink-0" />
             <div>
               <div className="text-sm font-bold">Document verified and pinned to IPFS</div>
               <div className="text-xs font-mono text-gray-500 mt-1">{scanCID}</div>
             </div>
           </div>
         )}
      </main>
    </div>
  );
}
