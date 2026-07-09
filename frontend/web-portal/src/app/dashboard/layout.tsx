'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Map, 
  MapPin, 
  ArrowRightLeft, 
  FileEdit, 
  Users, 
  FileText, 
  Gavel, 
  Scale, 
  ShieldAlert, 
  Bell, 
  Settings,
  LogOut,
  Menu
} from 'lucide-react';

const SIDEBAR_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'My Parcels', href: '/dashboard/my-parcels', icon: MapPin },
  { name: 'GIS Map', href: '/dashboard/map', icon: Map },
  { name: 'Property Transfer', href: '/dashboard/transfer', icon: ArrowRightLeft },
  { name: 'Mutation Manager', href: '/dashboard/mutation', icon: FileEdit },
  { name: 'Succession', href: '/dashboard/succession', icon: Users },
  { name: 'Encumbrance Certificate', href: '/dashboard/ec', icon: FileText },
  { name: 'BhumiAuction', href: '/dashboard/auction', icon: Gavel },
  { name: 'NyayaAI', href: '/dashboard/nyaya-ai', icon: Scale },
  { name: 'TribalGuard', href: '/dashboard/tribal', icon: ShieldAlert },
  { name: 'Notifications', href: '/dashboard/notifications', icon: Bell },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, React_useState] = React.useState(false); // Wait, useState isn't imported from react directly, I used React.useState which is fine

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      
      {/* ─── Fixed Header ──────────────────────────────────────────────────────── */}
      <header className="w-full bg-white flex-none sticky top-0 z-50 shadow-sm border-b border-gray-100">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 h-[80px] flex items-center justify-between">
          
          {/* Left: Emblem & Mobile Toggle */}
          <div className="w-1/3 flex items-center justify-start gap-4">
            <button 
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-md"
              onClick={() => React_useState(!isMobileMenuOpen)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <img 
              src="/Government_of_India_logo.svg.webp" 
              alt="Government of India" 
              className="h-12 sm:h-14 w-auto object-contain hidden sm:block" 
              onError={(e) => { e.currentTarget.style.display = 'none'; }} 
            />
          </div>

          {/* Center: Title */}
          <div className="w-1/3 flex flex-col items-center justify-center text-center">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F4C81] tracking-tight leading-tight">BhumiChain</h1>
            <h2 className="text-[10px] sm:text-[11px] text-gray-500 font-bold uppercase tracking-widest leading-tight mt-0.5">National Land Registry Platform</h2>
          </div>

          {/* Right: Digital India */}
          <div className="w-1/3 flex justify-end">
            <img 
              src="/Digital-India-Color.svg" 
              alt="Digital India" 
              className="h-10 sm:h-12 w-auto object-contain hidden sm:block" 
              onError={(e) => { e.currentTarget.style.display = 'none'; }} 
            />
          </div>

        </div>
        {/* Tricolor Accent Line */}
        <div className="h-1 w-full flex">
           <div className="flex-1 bg-[#FF9933]"></div>
           <div className="flex-1 bg-[#FFFFFF]"></div>
           <div className="flex-1 bg-[#138808]"></div>
        </div>
      </header>

      {/* ─── Main Layout Body ────────────────────────────────────────────────── */}
      <div className="flex-1 flex max-w-[1920px] w-full mx-auto overflow-hidden relative">
        
        {/* Sidebar */}
        <aside className={`
          absolute lg:static inset-y-0 left-0 z-40 h-full
          w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          {/* User Profile Card */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#0F4C81]/10 flex items-center justify-center text-[#0F4C81] font-bold text-lg border border-[#0F4C81]/20">
                RK
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Ramesh Kumar</h3>
                <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span> Citizen
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
            {SIDEBAR_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => React_useState(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                    ${isActive 
                      ? 'bg-[#0F4C81] text-white shadow-md shadow-[#0F4C81]/20' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-100">
            <Link
              href="/login"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </Link>
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="absolute inset-0 bg-white/50 z-30 lg:hidden"
            onClick={() => React_useState(false)}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 relative custom-scrollbar">
          {children}
        </main>

      </div>
    </div>
  );
}
