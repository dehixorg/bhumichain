"use client";

import React from "react";
import dynamic from "next/dynamic";
import { formatLastLogin } from "@/lib/auth";
import {
  Map,
  MapPin,
  ArrowRightLeft,
  FileEdit,
  Users,
  FileText,
  Scale,
  ShieldAlert,
  Search,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
} from "lucide-react";

const MapPreview = dynamic(() => import("./MapPreview"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[300px] w-full items-center justify-center bg-blue-50 text-sm font-semibold text-[#0F4C81] animate-pulse">
      Loading Interactive Map...
    </div>
  ),
});

const STATS = [
  {
    label: "Total Parcels",
    value: "1,45,230",
    icon: MapPin,
    color: "border-blue-500",
    text: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    label: "Active Mutations",
    value: "1,204",
    icon: FileEdit,
    color: "border-orange-500",
    text: "text-orange-600",
    bg: "bg-orange-50",
  },
  {
    label: "Pending Transfers",
    value: "432",
    icon: ArrowRightLeft,
    color: "border-yellow-500",
    text: "text-yellow-600",
    bg: "bg-yellow-50",
  },
  {
    label: "Succession Cases",
    value: "89",
    icon: Users,
    color: "border-purple-500",
    text: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    label: "Blockchain Records",
    value: "2.4M",
    icon: ShieldAlert,
    color: "border-green-500",
    text: "text-green-600",
    bg: "bg-green-50",
  },
  {
    label: "Encumbrance Certs",
    value: "8,430",
    icon: FileText,
    color: "border-indigo-500",
    text: "text-indigo-600",
    bg: "bg-indigo-50",
  },
];

const QUICK_ACTIONS = [
  {
    label: "View Land Records",
    icon: MapPin,
    desc: "Search by Khesra/Jamabandi",
  },
  { label: "Download RoR", icon: Download, desc: "Get digitally signed copy" },
  { label: "Apply Mutation", icon: FileEdit, desc: "Initiate name change" },
  {
    label: "Transfer Property",
    icon: ArrowRightLeft,
    desc: "Start transfer process",
  },
  { label: "Register Succession", icon: Users, desc: "Update legal heirs" },
  { label: "Verify Encumbrance", icon: FileText, desc: "Check EC status" },
  { label: "Open GIS Map", icon: Map, desc: "View BhuNaksha" },
  { label: "Ask NyayaAI", icon: Scale, desc: "Legal guidance bot" },
];

const RECENT_ACTIVITY = [
  {
    type: "Mutation Submitted",
    desc: "Application #MUT-2026-892 for Parcel ID KL-456-789",
    time: "2 hours ago",
    icon: Clock,
    color: "text-yellow-500",
    bg: "bg-yellow-100",
  },
  {
    type: "Property Transfer Approved",
    desc: "Transfer #TRF-901 completed successfully.",
    time: "1 day ago",
    icon: CheckCircle2,
    color: "text-green-500",
    bg: "bg-green-100",
  },
  {
    type: "Land Record Updated",
    desc: "Area correction updated on blockchain.",
    time: "3 days ago",
    icon: ShieldAlert,
    color: "text-blue-500",
    bg: "bg-blue-100",
  },
  {
    type: "Succession Registered",
    desc: "Legal heirs added for late Mr. Sharma.",
    time: "1 week ago",
    icon: Users,
    color: "text-purple-500",
    bg: "bg-purple-100",
  },
  {
    type: "EC Generated",
    desc: "Certificate #EC-8822 generated with QR code.",
    time: "2 weeks ago",
    icon: FileText,
    color: "text-indigo-500",
    bg: "bg-indigo-100",
  },
];

const PARCELS = [
  {
    id: "KL-456-789",
    owner: "Ramesh Kumar",
    village: "Sadarpur",
    area: "1.2 Hectares",
    status: "Verified",
    updated: "12-May-2026",
  },
  {
    id: "KL-456-790",
    owner: "Ramesh Kumar",
    village: "Sadarpur",
    area: "0.8 Hectares",
    status: "Pending Mutation",
    updated: "08-Jul-2026",
  },
  {
    id: "KL-456-812",
    owner: "Ramesh Kumar",
    village: "Chhalera",
    area: "2.5 Hectares",
    status: "Verified",
    updated: "22-Mar-2026",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-[16px] border border-gray-100 bg-white shadow-[0_2px_12px_rgb(0,0,0,0.04)]">
        <div className="absolute left-0 top-0 h-full w-1 bg-[#FF9933]" />
        <div className="flex flex-col items-start justify-between gap-6 p-6 sm:p-8 md:flex-row md:items-center">
          <div>
            <h2 className="mb-2 text-2xl font-bold text-[#0F4C81] sm:text-3xl">
              Welcome to BhumiChain National Land Registry
            </h2>
            <p className="mb-6 text-gray-600">
              Government of India secure portal for transparent land
              administration.
            </p>

            <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-green-700">
                <CheckCircle2 className="h-4 w-4" /> Aadhaar Verified
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-gray-700">
                <span className="text-gray-500">District:</span> Patna
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-gray-700">
                <span className="text-gray-500">State:</span> Bihar
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm font-medium text-gray-500">Last Login</p>
            <p
              className="text-base font-bold text-gray-900"
              suppressHydrationWarning
            >
              {formatLastLogin()}
            </p>
            <p className="mt-1 text-xs text-gray-500">IP: 103.119.xxx.xx</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {STATS.map((stat, idx) => (
          <div
            key={idx}
            className={`group cursor-pointer rounded-xl border border-gray-100 border-t-[3px] bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${stat.color}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className={`rounded-lg p-2.5 ${stat.bg} ${stat.text}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
            <h3 className="mb-1 text-2xl font-bold text-gray-900">
              {stat.value}
            </h3>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 transition-colors group-hover:text-gray-700">
              {stat.label}
            </p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 sm:gap-8 xl:grid-cols-3">
        <section className="space-y-4 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <Zap className="h-5 w-5 text-[#FF9933]" /> Quick Actions
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_ACTIONS.map((action, idx) => (
              <button
                key={idx}
                className="group flex flex-col items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-[#0F4C81] hover:shadow-md"
              >
                <div className="rounded-xl bg-gray-50 p-3 text-[#0F4C81] transition-colors group-hover:bg-[#0F4C81]/10">
                  <action.icon className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-bold text-gray-900 transition-colors group-hover:text-[#0F4C81]">
                    {action.label}
                  </h4>
                  <p className="text-xs text-gray-500">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm xl:col-span-1">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 p-5">
            <h3 className="text-base font-bold text-gray-900">
              Recent Activity
            </h3>
            <button className="text-xs font-bold text-[#0F4C81] hover:underline">
              View All
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {RECENT_ACTIVITY.map((activity, idx) => (
                <div key={idx} className="relative flex gap-4">
                  {idx !== RECENT_ACTIVITY.length - 1 && (
                    <div className="absolute bottom-[-24px] left-[19px] top-10 w-0.5 bg-gray-100" />
                  )}
                  <div
                    className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${activity.bg} ${activity.color}`}
                  >
                    <activity.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">
                      {activity.type}
                    </h4>
                    <p className="mt-0.5 text-xs text-gray-600">
                      {activity.desc}
                    </p>
                    <p className="mt-1.5 text-[11px] font-semibold text-gray-500">
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:gap-8 xl:grid-cols-3">
        <section className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm xl:col-span-1">
          <div className="flex items-center justify-between border-b border-gray-100 p-5">
            <h3 className="text-base font-bold text-gray-900">
              GIS BhuNaksha Overview
            </h3>
            <button className="text-xs font-bold text-[#0F4C81] hover:underline">
              Open Map
            </button>
          </div>
          <div className="relative z-0 min-h-[300px] flex-1">
            <MapPreview />
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm xl:col-span-2">
          <div className="flex flex-col justify-between gap-4 border-b border-gray-100 bg-gray-50/50 p-5 sm:flex-row sm:items-center">
            <h3 className="text-base font-bold text-gray-900">
              My Registered Parcels
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search parcels..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F4C81] sm:w-64"
                />
              </div>
              <button className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 transition-colors hover:bg-gray-50">
                <Filter className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500">
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
                  <tr
                    key={idx}
                    className="group cursor-pointer transition-colors hover:bg-gray-50/50"
                  >
                    <td className="p-4 pl-6">
                      <span className="text-sm font-bold text-[#0F4C81] group-hover:underline">
                        {parcel.id}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-semibold text-gray-900">
                      {parcel.owner}
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {parcel.village}
                    </td>
                    <td className="p-4 text-sm text-gray-600">{parcel.area}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${parcel.status === "Verified" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
                      >
                        {parcel.status}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-sm text-gray-500">
                      {parcel.updated}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {PARCELS.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <AlertCircle className="mb-3 h-12 w-12 text-gray-600" />
              <h4 className="text-sm font-bold text-gray-900">
                No Parcels Found
              </h4>
              <p className="mt-1 max-w-sm text-xs text-gray-500">
                You haven't registered any land parcels yet or they are still
                pending verification.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
