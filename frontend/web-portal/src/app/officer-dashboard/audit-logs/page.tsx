'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, FileText, Clock, CheckCircle, Search, Filter, RefreshCw,
  ExternalLink, Layers, Cpu, Award, Download, UserCheck, Lock, AlertCircle, ArrowLeft
} from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import AppHeader from '@/components/dashboard/AppHeader';
import { getUser, apiFetch, type JWTUser } from '@/lib/auth';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface ChainLog {
  blockNumber: number;
  txHash: string;
  type: string;
  dlpiId: string;
  officerName: string;
  officerRole: string;
  peerNode: string;
  timestamp: string;
  status: 'COMMITTED' | 'VERIFIED' | 'MUTATED';
}

interface MutationLog {
  caseId: string;
  dlpiId: string;
  mutationType: 'PROPERTY_SALE' | 'VIRASAT_SUCCESSION';
  oldOwner: string;
  newOwner: string;
  khasraNo: string;
  area: string;
  executedAt: string;
  orderNo: string;
  pdfUrl: string;
}

interface SlaLog {
  caseId: string;
  dlpiId: string;
  applicant: string;
  patwariDays: number;
  kanungoDays: number;
  tehsildarDays: number;
  totalDays: number;
  slaTargetDays: number;
  status: 'ON_TIME' | 'EXPEDITED' | 'ATTENTION';
}

export default function AuditLogsPage() {
  const router = useRouter();
  const [user, setUser] = useState<JWTUser | null>(null);
  const [activeTab, setActiveTab] = useState<'fabric' | 'mutations' | 'field' | 'sla'>('fabric');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Mock data representing authentic BiharBhumi Hyperledger Fabric audit trails
  const [chainLogs] = useState<ChainLog[]>([
    {
      blockNumber: 48921,
      txHash: '0x8f4b9a1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a',
      type: 'TITLE_MUTATION_EXECUTION',
      dlpiId: 'DLPI-4503',
      officerName: 'Amit Saxena',
      officerRole: 'Circle Officer (Tehsildar)',
      peerNode: 'peer0.patna.bhumichain.gov.in',
      timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      status: 'MUTATED'
    },
    {
      blockNumber: 48918,
      txHash: '0x3a7b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7b8',
      type: 'KANUNGO_FIELD_APPROVAL',
      dlpiId: 'DLPI-4753',
      officerName: 'Rajesh Verma',
      officerRole: 'Kanungo (Anchal Nirikshak)',
      peerNode: 'peer1.phulwari.bhumichain.gov.in',
      timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      status: 'VERIFIED'
    },
    {
      blockNumber: 48905,
      txHash: '0x9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0',
      type: 'VIRASAT_HEIR_DIVISION',
      dlpiId: 'DLPI-8450',
      officerName: 'Amit Saxena',
      officerRole: 'Circle Officer (Tehsildar)',
      peerNode: 'peer0.patna.bhumichain.gov.in',
      timestamp: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
      status: 'MUTATED'
    },
    {
      blockNumber: 48892,
      txHash: '0x1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0',
      type: 'PATWARI_INSPECTION_RECORDED',
      dlpiId: 'DLPI-5829',
      officerName: 'Vijay Singh',
      officerRole: 'Patwari (Karmachari)',
      peerNode: 'peer0.patna.bhumichain.gov.in',
      timestamp: new Date(Date.now() - 1000 * 60 * 1440).toISOString(),
      status: 'COMMITTED'
    }
  ]);

  const [mutationLogs] = useState<MutationLog[]>([
    {
      caseId: 'MUT-2026-00491',
      dlpiId: 'DLPI-4503',
      mutationType: 'PROPERTY_SALE',
      oldOwner: 'Suresh Kumar',
      newOwner: 'Priya Sharma',
      khasraNo: '4503/1',
      area: '2.4 Ha (Bhumidhari)',
      executedAt: '28/07/2026 18:42 IST',
      orderNo: 'ORD/PLW/2026/8941',
      pdfUrl: '#'
    },
    {
      caseId: 'MUT-2026-00388',
      dlpiId: 'DLPI-8450',
      mutationType: 'VIRASAT_SUCCESSION',
      oldOwner: 'Late Ramchandra Prasad',
      newOwner: 'Sunita Devi (50%), Anil Prasad (50%)',
      khasraNo: '8450/2',
      area: '1.8 Ha (Joint Coparcenary)',
      executedAt: '27/07/2026 11:15 IST',
      orderNo: 'ORD/PLW/2026/8912',
      pdfUrl: '#'
    },
    {
      caseId: 'MUT-2026-00301',
      dlpiId: 'DLPI-1539',
      mutationType: 'PROPERTY_SALE',
      oldOwner: 'Mahesh Kumar',
      newOwner: 'Vikram Singh',
      khasraNo: '1539/4',
      area: '0.85 Ha',
      executedAt: '25/07/2026 16:30 IST',
      orderNo: 'ORD/PLW/2026/8850',
      pdfUrl: '#'
    }
  ]);

  const [slaLogs] = useState<SlaLog[]>([
    { caseId: 'MUT-2026-00491', dlpiId: 'DLPI-4503', applicant: 'Priya Sharma', patwariDays: 2, kanungoDays: 3, tehsildarDays: 1, totalDays: 6, slaTargetDays: 21, status: 'EXPEDITED' },
    { caseId: 'MUT-2026-00388', dlpiId: 'DLPI-8450', applicant: 'Sunita Devi', patwariDays: 4, kanungoDays: 5, tehsildarDays: 2, totalDays: 11, slaTargetDays: 21, status: 'ON_TIME' },
    { caseId: 'MUT-2026-00301', dlpiId: 'DLPI-1539', applicant: 'Vikram Singh', patwariDays: 3, kanungoDays: 4, tehsildarDays: 1, totalDays: 8, slaTargetDays: 21, status: 'ON_TIME' }
  ]);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace('/login'); return; }
    const isTehsildar = u.role && ['circle_officer', 'anchalAdhikari', 'tehsildar'].includes(u.role);
    if (!isTehsildar) {
      toast.error('Audit & Chain Logs are restricted to Circle Officer (Tehsildar)');
      router.replace('/officer-dashboard');
      return;
    }
    setUser(u);
  }, []);

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    toast.success('Tx Hash copied to clipboard!');
  };

  const filteredChain = chainLogs.filter(l => 
    l.dlpiId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.txHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.officerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Header Title Banner */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#0F4C81]/10 text-[#0F4C81] text-xs font-bold font-mono">
                  Phulwari Sharif Anchal · Patna
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Fabric Mainnet Real-time
                </span>
              </div>
              <h1 className="text-xl font-black text-gray-900 mt-2 flex items-center gap-2">
                <Shield className="w-6 h-6 text-[#0F4C81]" />
                Audit & Mutation Ledger Logs
              </h1>
              <p className="text-gray-500 text-xs mt-1">
                Statutory Revenue Court Audit Trail under <strong className="text-gray-700">Bihar Mutation Act 2011 (Sec 5 & 12)</strong> & <strong className="text-gray-700">CPC 1908 (Sec 16)</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 600); toast.success('Ledger updated'); }} className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors">
                <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
                Refresh Ledger
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="text-gray-400 text-xs font-medium">Total Ledger Blocks</div>
                <div className="text-lg font-black text-gray-900 font-mono">48,921</div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="text-gray-400 text-xs font-medium">Titles Mutated (RoR)</div>
                <div className="text-lg font-black text-gray-900 font-mono">894 Cases</div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-gray-400 text-xs font-medium">Avg SLA Compliance</div>
                <div className="text-lg font-black text-emerald-600 font-mono">8.3 Days (Limit 21)</div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-gray-400 text-xs font-medium">Peer Endorsement</div>
                <div className="text-xs font-bold text-gray-800 truncate">peer0.patna (100%)</div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
              <button
                onClick={() => setActiveTab('fabric')}
                className={clsx(
                  'px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0',
                  activeTab === 'fabric'
                    ? 'bg-[#0F4C81] text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                )}
              >
                <Cpu className="w-4 h-4" />
                Hyperledger Fabric Ledger
              </button>

              <button
                onClick={() => setActiveTab('mutations')}
                className={clsx(
                  'px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0',
                  activeTab === 'mutations'
                    ? 'bg-[#0F4C81] text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                )}
              >
                <FileText className="w-4 h-4" />
                Executed Mutation Orders (RoR)
              </button>

              <button
                onClick={() => setActiveTab('sla')}
                className={clsx(
                  'px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0',
                  activeTab === 'sla'
                    ? 'bg-[#0F4C81] text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                )}
              >
                <Clock className="w-4 h-4" />
                RTPS SLA Compliance Logs
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search DLPI, Tx Hash, Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
              />
            </div>
          </div>

          {/* TAB 1: FABRIC LEDGER LOGS */}
          {activeTab === 'fabric' && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#0F4C81]" />
                  <h3 className="text-sm font-bold text-gray-900">Cryptographic Blockchain Transaction Audit Trail</h3>
                </div>
                <span className="text-xs text-gray-500 font-mono">Consensus: Raft (4 Nodes)</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100/70 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Block #</th>
                      <th className="px-4 py-3">Transaction Hash</th>
                      <th className="px-4 py-3">Event Type</th>
                      <th className="px-4 py-3">Parcel DLPI</th>
                      <th className="px-4 py-3">Executing Officer</th>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {filteredChain.map((log) => (
                      <tr key={log.txHash} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-gray-900">#{log.blockNumber}</td>
                        <td className="px-4 py-3 font-mono text-[#0F4C81] break-all max-w-[280px]">
                          <button
                            onClick={() => copyHash(log.txHash)}
                            className="hover:underline text-left cursor-pointer text-[11px] leading-tight font-mono select-all font-semibold"
                            title="Click to copy full transaction hash"
                          >
                            {log.txHash}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{log.type}</td>
                        <td className="px-4 py-3 font-mono text-purple-700 font-bold">{log.dlpiId}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{log.officerName}</div>
                          <div className="text-[10px] text-gray-500">{log.officerRole}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: EXECUTED MUTATION ORDERS (RoR) */}
          {activeTab === 'mutations' && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0F4C81]" />
                  <h3 className="text-sm font-bold text-gray-900">Official Dakhil-Kharij Title Mutation Orders</h3>
                </div>
                <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  DigiLocker Pinned
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100/70 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Case ID</th>
                      <th className="px-4 py-3">Parcel DLPI</th>
                      <th className="px-4 py-3">Mutation Type</th>
                      <th className="px-4 py-3">Previous Owner</th>
                      <th className="px-4 py-3">New Title Holder(s)</th>
                      <th className="px-4 py-3">Execution Time</th>
                      <th className="px-4 py-3">Order PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {mutationLogs.map((log) => (
                      <tr key={log.caseId} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-[#0F4C81]">{log.caseId}</td>
                        <td className="px-4 py-3 font-mono text-purple-700 font-bold">{log.dlpiId}</td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border',
                            log.mutationType === 'PROPERTY_SALE' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-purple-50 border-purple-200 text-purple-700'
                          )}>
                            {log.mutationType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium">{log.oldOwner}</td>
                        <td className="px-4 py-3 text-emerald-800 font-bold">{log.newOwner}</td>
                        <td className="px-4 py-3 text-gray-500">{log.executedAt}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toast.success(`Downloading Mutation Order PDF ${log.orderNo}`)}
                            className="px-3 py-1.5 bg-[#0F4C81]/10 hover:bg-[#0F4C81]/20 text-[#0F4C81] rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Order PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SLA COMPLIANCE LOGS */}
          {activeTab === 'sla' && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#0F4C81]" />
                  <h3 className="text-sm font-bold text-gray-900">Bihar RTPS Act SLA Compliance Tracking</h3>
                </div>
                <span className="text-xs text-gray-500 font-medium">Statutory SLA Target: 21 Days</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100/70 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Case ID</th>
                      <th className="px-4 py-3">Applicant Name</th>
                      <th className="px-4 py-3">Patwari Days</th>
                      <th className="px-4 py-3">Kanungo Days</th>
                      <th className="px-4 py-3">Tehsildar Days</th>
                      <th className="px-4 py-3">Total Days</th>
                      <th className="px-4 py-3">SLA Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {slaLogs.map((log) => (
                      <tr key={log.caseId} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-[#0F4C81]">{log.caseId}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{log.applicant}</td>
                        <td className="px-4 py-3 font-mono text-gray-600">{log.patwariDays} days</td>
                        <td className="px-4 py-3 font-mono text-gray-600">{log.kanungoDays} days</td>
                        <td className="px-4 py-3 font-mono text-gray-600">{log.tehsildarDays} days</td>
                        <td className="px-4 py-3 font-mono font-bold text-gray-900">{log.totalDays} / {log.slaTargetDays} Days</td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            'px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1',
                            log.status === 'EXPEDITED' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-blue-50 border-blue-200 text-blue-700'
                          )}>
                            <CheckCircle className="w-3 h-3" />
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
