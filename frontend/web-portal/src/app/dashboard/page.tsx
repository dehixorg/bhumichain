'use client';

import React from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

const MapPreview = dynamic(() => import('./MapPreview'), {
  ssr: false,
  loading: () => <div className="w-full h-full min-h-[300px] bg-blue-50 animate-pulse flex items-center justify-center text-[#0F4C81] font-semibold text-sm">Loading Interactive Map...</div>
});

import { 
  Map, 
  MapPin, 
  ArrowRightLeft, 
  FileEdit, 
  Users, 
  FileText, 
  Gavel, 
  Scale, 
  ShieldAlert, 
  Search,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap
} from 'lucide-react';

// --- Dummy Data ---
const STATS = [
  { label: 'Total Parcels', value: '1,45,230', icon: MapPin, color: 'border-blue-500', text: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Active Mutations', value: '1,204', icon: FileEdit, color: 'border-orange-500', text: 'text-orange-600', bg: 'bg-orange-50' },
  { label: 'Pending Transfers', value: '432', icon: ArrowRightLeft, color: 'border-yellow-500', text: 'text-yellow-600', bg: 'bg-yellow-50' },
  { label: 'Succession Cases', value: '89', icon: Users, color: 'border-purple-500', text: 'text-purple-600', bg: 'bg-purple-50' },
  { label: 'Blockchain Records', value: '2.4M', icon: ShieldAlert, color: 'border-green-500', text: 'text-green-600', bg: 'bg-green-50' },
  { label: 'Encumbrance Certs', value: '8,430', icon: FileText, color: 'border-indigo-500', text: 'text-indigo-600', bg: 'bg-indigo-50' },
];

const QUICK_ACTIONS = [
  { label: 'View Land Records', icon: MapPin, desc: 'Search by Khasra/Khatauni' },
  { label: 'Download RoR', icon: Download, desc: 'Get digitally signed copy' },
  { label: 'Apply Mutation', icon: FileEdit, desc: 'Initiate name change' },
  { label: 'Transfer Property', icon: ArrowRightLeft, desc: 'Start transfer process' },
  { label: 'Register Succession', icon: Users, desc: 'Update legal heirs' },
  { label: 'Verify Encumbrance', icon: FileText, desc: 'Check EC status' },
  { label: 'Open GIS Map', icon: Map, desc: 'View BhuNaksha' },
  { label: 'Ask NyayaAI', icon: Scale, desc: 'Legal guidance bot' },
];

const RECENT_ACTIVITY = [
  { type: 'Mutation Submitted', desc: 'Application #MUT-2026-892 for Parcel ID KL-456-789', time: '2 hours ago', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100' },
  { type: 'Property Transfer Approved', desc: 'Transfer #TRF-901 completed successfully.', time: '1 day ago', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-100' },
  { type: 'Land Record Updated', desc: 'Area correction updated on blockchain.', time: '3 days ago', icon: ShieldAlert, color: 'text-blue-500', bg: 'bg-blue-100' },
  { type: 'Succession Registered', desc: 'Legal heirs added for late Mr. Sharma.', time: '1 week ago', icon: Users, color: 'text-purple-500', bg: 'bg-purple-100' },
  { type: 'EC Generated', desc: 'Certificate #EC-8822 generated with QR code.', time: '2 weeks ago', icon: FileText, color: 'text-indigo-500', bg: 'bg-indigo-100' },
];

const PARCELS = [
  { id: 'KL-456-789', owner: 'Ramesh Kumar', village: 'Sadarpur', area: '1.2 Hectares', status: 'Verified', updated: '12-May-2026' },
  { id: 'KL-456-790', owner: 'Ramesh Kumar', village: 'Sadarpur', area: '0.8 Hectares', status: 'Pending Mutation', updated: '08-Jul-2026' },
  { id: 'KL-456-812', owner: 'Ramesh Kumar', village: 'Chhalera', area: '2.5 Hectares', status: 'Verified', updated: '22-Mar-2026' },
];

// --- Framer Motion Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export default function DashboardPage() {
  return (
    <motion.div 
      className="space-y-6 sm:space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      
      {/* ─── Hero Section ──────────────────────────────────────────────────────── */}
      <motion.section variants={itemVariants} className="bg-white rounded-[16px] shadow-[0_2px_12px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#FF9933]"></div>
        <div className="p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0F4C81] mb-2">Welcome to BhumiChain National Land Registry</h2>
            <p className="text-gray-600 mb-6">Government of India secure portal for transparent land administration.</p>
            
            <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
              <div className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Aadhaar Verified
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 border border-gray-200">
                <span className="text-gray-500">District:</span> Gautam Buddha Nagar
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 border border-gray-200">
                <span className="text-gray-500">State:</span> Uttar Pradesh
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-sm text-gray-500 font-medium">Last Login</p>
            <p className="text-base font-bold text-gray-900">09 July 2026, 10:45 AM</p>
            <p className="text-xs text-gray-500 mt-1">IP: 103.119.xxx.xx</p>
          </div>
        </div>
      </motion.section>

      {/* ─── Top Statistics Cards ──────────────────────────────────────────────── */}
      <motion.section variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {STATS.map((stat, idx) => (
          <div 
            key={idx} 
            className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 border-t-[3px] ${stat.color} hover:shadow-md transition-shadow cursor-pointer group`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-lg ${stat.bg} ${stat.text}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</h3>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide group-hover:text-gray-700 transition-colors">{stat.label}</p>
          </div>
        ))}
      </motion.section>

      {/* ─── Grid: Quick Actions & Timeline ────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Quick Actions (Takes up 2 columns on XL) */}
        <motion.section variants={itemVariants} className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#FF9933]" /> Quick Actions
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {QUICK_ACTIONS.map((action, idx) => (
              <button 
                key={idx}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-[#0F4C81] hover:shadow-md transition-all text-left flex flex-col items-start gap-4 group"
              >
                <div className="p-3 rounded-xl bg-gray-50 group-hover:bg-[#0F4C81]/10 text-[#0F4C81] transition-colors">
                  <action.icon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1 group-hover:text-[#0F4C81] transition-colors">{action.label}</h4>
                  <p className="text-xs text-gray-500">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </motion.section>

        {/* Recent Activity Timeline */}
        <motion.section variants={itemVariants} className="xl:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-base font-bold text-gray-900">Recent Activity</h3>
            <button className="text-xs font-bold text-[#0F4C81] hover:underline">View All</button>
          </div>
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="space-y-6">
              {RECENT_ACTIVITY.map((activity, idx) => (
                <div key={idx} className="flex gap-4 relative">
                  {idx !== RECENT_ACTIVITY.length - 1 && (
                    <div className="absolute left-[19px] top-10 bottom-[-24px] w-0.5 bg-gray-100"></div>
                  )}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${activity.bg} ${activity.color} z-10 ring-4 ring-white`}>
                    <activity.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{activity.type}</h4>
                    <p className="text-xs text-gray-600 mt-0.5">{activity.desc}</p>
                    <p className="text-[11px] font-semibold text-gray-500 mt-1.5">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

      </div>

      {/* ─── Grid: GIS Map Preview & Parcel Table ──────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Map Preview */}
        <motion.section variants={itemVariants} className="xl:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">GIS BhuNaksha Overview</h3>
            <button className="text-xs font-bold text-[#0F4C81] hover:underline">Open Map</button>
          </div>
          <div className="flex-1 relative min-h-[300px] z-0">
            <MapPreview />
          </div>
        </motion.section>

        {/* Parcel Table */}
        <motion.section variants={itemVariants} className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
            <h3 className="text-base font-bold text-gray-900">My Registered Parcels</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Search parcels..." 
                  className="pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F4C81] w-full sm:w-64"
                />
              </div>
              <button className="p-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="p-4 pl-6">Parcel ID</th>
                  <th className="p-4">Owner</th>
                  <th className="p-4">Village</th>
                  <th className="p-4">Area</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {PARCELS.map((parcel, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                    <td className="p-4 pl-6">
                      <span className="text-sm font-bold text-[#0F4C81] group-hover:underline">{parcel.id}</span>
                    </td>
                    <td className="p-4 text-sm font-semibold text-gray-900">{parcel.owner}</td>
                    <td className="p-4 text-sm text-gray-600">{parcel.village}</td>
                    <td className="p-4 text-sm text-gray-600">{parcel.area}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                        ${parcel.status === 'Verified' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}
                      `}>
                        {parcel.status}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-sm text-gray-500">{parcel.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {PARCELS.length === 0 && (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-12 h-12 text-gray-600 mb-3" />
              <h4 className="text-sm font-bold text-gray-900">No Parcels Found</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">You haven't registered any land parcels yet or they are still pending verification.</p>
            </div>
          )}
        </motion.section>

      </div>

    </motion.div>
  );
}
// Zap is not imported, let's fix it above by ensuring Zap is added to lucide-react imports. Wait, I didn't import Zap! I need to add it to the import list.
