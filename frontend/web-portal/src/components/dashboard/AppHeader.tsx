'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, User, LogOut, ChevronDown, Globe } from 'lucide-react';
import { getUser, logout, type JWTUser } from '@/lib/auth';
import clsx from 'clsx';

export default function CitizenHeader() {
  const router = useRouter();
  const [user, setUser] = useState<JWTUser | null>(null);
  const [digitalIndiaError, setDigitalIndiaError] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setUser(getUser());
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className={clsx(
      'sticky top-0 z-50 bg-white transition-all duration-200',
      scrolled ? 'shadow-md border-b-transparent' : 'border-b border-gray-200 shadow-sm'
    )}>
      {/* Top micro-header for accessibility / language */}
      <div className="bg-gray-50 border-b border-gray-200 py-1.5 px-6 sm:px-10 flex justify-between items-center text-[11px] font-medium text-gray-500">
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline">Government of India (भारत सरकार)</span>
          <span className="hidden sm:inline">·</span>
          <span>Ministry of Rural Development</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="hover:text-gray-900 transition-colors">Skip to main content</button>
          <div className="h-3 w-px bg-gray-300" />
          <button className="flex items-center gap-1 hover:text-gray-900 transition-colors">
            <Globe className="w-3.5 h-3.5" />
            English (India) <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Header */}
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 h-20 grid grid-cols-3 items-center gap-6">
        {/* Left: Emblems & Logo */}
        <div className="flex items-center gap-4">
          <img
            src="/Government_of_India_logo.svg.webp"
            alt="Emblem of India"
            className="h-14 w-auto object-contain"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="h-10 w-px bg-gray-200 hidden sm:block" />
          <Link href="/my-parcels" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-[#0F4C81] flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <span className="text-white font-black text-lg leading-none mt-0.5">भू</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-[#0F4C81] tracking-tight leading-none">BhumiChain</span>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1 leading-none">National Land Registry</span>
            </div>
          </Link>
        </div>

        {/* Centre: empty spacer for grid centering */}
        <div />

        {/* Right: Digital India & User Auth */}
        <div className="flex items-center justify-end gap-4">
          {!digitalIndiaError && (
            <div className="hidden lg:block">
              <img
                src="/Digital-India-Color.svg"
                alt="Digital India"
                className="h-11 w-auto object-contain"
                onError={() => setDigitalIndiaError(true)}
              />
            </div>
          )}
          
          <div className="h-8 w-px bg-gray-200 hidden sm:block" />

          {/* Notifications */}
          <button className="relative p-2 text-gray-500 hover:text-[#0F4C81] hover:bg-gray-50 rounded-full transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border border-white rounded-full"></span>
          </button>

          {/* User Profile */}
          {user ? (
            <div className="relative group">
              <button className="flex items-center gap-3 pl-2 pr-4 py-1.5 border border-gray-200 rounded-full hover:border-gray-300 hover:shadow-sm transition-all bg-gray-50">
                <div className="w-7 h-7 rounded-full bg-[#0F4C81] flex items-center justify-center text-white text-xs font-bold shadow-inner">
                  {user.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-xs font-bold text-gray-900 leading-none">{user.name}</span>
                  <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider mt-0.5 leading-none">Aadhaar Verified</span>
                </div>
                <ChevronDown className="w-3 h-3 text-gray-400 ml-1" />
              </button>
              
              {/* Dropdown */}
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right scale-95 group-hover:scale-100">
                <div className="p-3 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.aadhaarId || 'xxxx-xxxx-xxxx'}</p>
                </div>
                <div className="p-1.5">
                  <Link href="/my-parcels" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#0F4C81] rounded-lg">
                    <User className="w-4 h-4" /> My Profile
                  </Link>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <Link href="/login" className="btn-primary">Sign In</Link>
          )}
        </div>
      </div>

      {/* Tricolor Bottom Strip */}
      <div className="h-[3px] w-full flex">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>
    </header>
  );
}
