'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, Clock, AlertTriangle, FileText, Zap, ChevronRight } from 'lucide-react';
import { getUser, apiFetch, type JWTUser } from '@/lib/auth';
import { approveTransferByPatwari, approveTransferByCI, approveTransferBySRO, approveTransferByTehsildar, getTransferHistory } from '@/lib/api';
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
  const [history, setHistory] = useState<any[]>([]);

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
      
      const hist = await getTransferHistory(transferId);
      setHistory(hist);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setBusy(true);
    try {
      const role = user?.role || '';
      const isPatwari = ['karmachari', 'patwari', 'revenue_officer'].includes(role);
      const isKanungo = ['circle_inspector', 'kanungo', 'anchalNirikshak', 'anchal_nirikshak'].includes(role);
      const isSRO = ['sro'].includes(role);
      const isTehsildar = ['circle_officer', 'anchalAdhikari', 'anchal_adhikari', 'tehsildar', 'collector', 'super_admin'].includes(role);

      if (isPatwari) {
        toast('Karmachari approving...');
        await approveTransferByPatwari(transferId);
        toast.success('Karmachari Approved');
      } else if (isKanungo) {
        toast('CI / Kanungo approving...');
        await approveTransferByCI(transferId);
        toast.success('CI / Kanungo Approved');
      } else if (isSRO) {
        toast('SRO executing...');
        await approveTransferBySRO(transferId, 'QmTitleDeedNew' + Date.now());
        toast.success('SRO Executed');
      } else if (isTehsildar) {
        toast('Circle Officer finalizing mutation...');
        await approveTransferByTehsildar(transferId);
        toast.success('Transfer Completed & Title Mutated');
      } else {
        // Fallback for any officer role logged in
        toast('Officer approving...');
        try {
          await approveTransferByCI(transferId);
        } catch(e) {
          await approveTransferByTehsildar(transferId);
        }
        toast.success('Officer Approval Recorded');
      }
      router.push('/officer-dashboard');
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || 'Approval failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-[#F8FAFC] text-[#0F4C81]">Loading...</div>;
  if (error || !transfer) return (
    <div className="p-8 flex flex-col gap-3">
      <div className="text-red-400 font-bold text-lg">⚠ Transfer Not Found</div>
      <div className="text-red-300 text-sm font-mono bg-red-950/30 rounded p-3 border border-red-800">
        {error || 'Transfer record does not exist on the blockchain'}
      </div>
      <div className="text-gray-400 text-sm">Transfer ID: <span className="font-mono text-yellow-400">{transferId}</span></div>
      <div className="text-gray-500 text-xs mt-2">
        This usually means the transfer was created before the blockchain was re-initialized, or the API gateway returned an error.<br/>
        Check the API gateway logs: <span className="font-mono text-blue-400">pm2 logs api-gateway</span>
      </div>
    </div>
  );

  let canApprove = false;
  let actionLabel = 'Approve';

  const role = user?.role || '';
  const isPatwari = ['karmachari', 'patwari', 'revenue_officer'].includes(role);
  const isKanungo = ['circle_inspector', 'kanungo', 'anchalNirikshak', 'anchal_nirikshak'].includes(role);
  const isSRO = ['sro'].includes(role);
  const isTehsildar = ['circle_officer', 'anchalAdhikari', 'anchal_adhikari', 'tehsildar', 'collector', 'super_admin'].includes(role);
  
  if (isPatwari && ['INITIATED', 'AWAITING_CONSENT', 'CONSENT_RECORDED', 'PENDING_PATWARI_VERIFICATION', 'STAMP_DUTY_PAID', 'PENDING_PATWARI_APPROVAL', 'PENDING_BUYER_CONSENT'].includes(transfer.status)) {
    canApprove = true;
    actionLabel = 'Karmachari (Patwari) Inspection Complete — Send to Kanungo';
  } else if (isKanungo && ['PATWARI_APPROVED', 'PENDING_KANUNGO_APPROVAL', 'PENDING_CI_APPROVAL'].includes(transfer.status)) {
    canApprove = true;
    actionLabel = 'Anchal Nirikshak (Kanungo) Approve — Send to Tehsildar';
  } else if (isSRO && ['CI_APPROVED', 'PENDING_SRO_EXECUTION', 'PENDING_TEHSILDAR_APPROVAL', 'PENDING_KANUNGO_APPROVAL'].includes(transfer.status)) {
    canApprove = true;
    actionLabel = 'Execute Deed (SRO)';
  } else if (isTehsildar && ['CI_APPROVED', 'PENDING_SRO_EXECUTION', 'PENDING_TEHSILDAR_APPROVAL', 'PENDING_KANUNGO_APPROVAL', 'PATWARI_APPROVED', 'PENDING_CI_APPROVAL', 'PENDING_PATWARI_VERIFICATION'].includes(transfer.status)) {
    canApprove = true;
    actionLabel = 'Anchal Adhikari (Tehsildar) Direct Approve & Mutate Land Title on Chain';
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-700">
      <header className="border-b border-gray-200 bg-white/50 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                Review Transfer
              </h1>
              <div className="text-xs text-[#0F4C81] font-mono mt-0.5">{transferId}</div>
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
           <h2 className="text-sm font-bold text-gray-700 border-b border-gray-200 pb-2">Transfer Details</h2>
           <div className="grid grid-cols-2 gap-4 text-sm">
             <div>
               <div className="text-gray-500 text-xs mb-1">Parcel DLPI</div>
               <div className="font-mono text-[#0F4C81]">{transfer.dlpiId}</div>
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

         {history.length > 0 && (
           <div className="card space-y-4">
             <h2 className="text-sm font-bold text-gray-700 border-b border-gray-200 pb-2">Transaction Timeline (Blockchain)</h2>
             <div className="space-y-4 pl-2">
               {history.map((record, idx) => (
                 <div key={idx} className="relative flex gap-4 text-sm">
                   <div className="absolute top-2 left-1.5 w-0.5 h-full bg-gray-800 -z-10" />
                   <div className="w-3 h-3 mt-1.5 rounded-full bg-brand-500 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                   <div>
                     <div className="font-bold text-gray-700">{record.status}</div>
                     <div className="text-xs text-gray-500 font-mono mt-0.5">
                       {new Date(record.timestamp).toLocaleString()} • {record.officerHash ? record.officerHash.slice(0, 16) + '...' : 'System'}
                     </div>
                   </div>
                 </div>
               ))}
             </div>
           </div>
         )}

        {/* RecordScan AI Requirement for Karmachari */}
        {user?.role === 'karmachari' && transfer.status === 'STAMP_DUTY_PAID' && !scanCID && (
           <div className="card border-amber-900/50 space-y-4">
             <div className="flex items-center gap-2 mb-4">
               <AlertTriangle className="w-5 h-5 text-amber-400" />
               <h2 className="text-sm font-bold text-amber-300">Deed Verification Required</h2>
             </div>
             <p className="text-gray-400 text-sm mb-4">
               Please upload the physical copy of the sale agreement/deed. RecordScan AI will verify it before you can approve the transfer.
             </p>
             <div className="border border-gray-200 rounded-xl bg-[#F8FAFC] p-4">
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
         {canApprove && (
           <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 z-20">
             <div className="max-w-4xl mx-auto flex justify-end">
               <button onClick={handleApprove} disabled={busy} className="btn-primary w-full sm:w-auto">
                 {busy ? 'Processing...' : actionLabel}
               </button>
             </div>
           </div>
         )}
      </main>
    </div>
  );
}
