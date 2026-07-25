'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, User, LogOut, ChevronDown, Globe } from 'lucide-react';
import { getUser, logout, type JWTUser, formatMaskedAadhaar } from '@/lib/auth';
import clsx from 'clsx';

export default function CitizenHeader() {
  const router = useRouter();
  const [user, setUser] = useState<JWTUser | null>(null);
  const [digitalIndiaError, setDigitalIndiaError] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

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
      'sticky top-0 z-50 transition-all duration-200 bg-white/95 backdrop-blur-md border-b border-gray-200',
      scrolled && 'shadow-sm'
    )}>
      {/* Govt Top Strip */}
      <div className="bg-[#0F4C81] text-white text-[11px] font-medium py-1 px-4 sm:px-8 flex justify-between items-center tracking-wide">
        <div className="flex items-center gap-2">
          <span className="font-bold">Government of India (भारत सरकार)</span>
          <span className="opacity-40">|</span>
          <span>Ministry of Rural Development</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="hover:underline flex items-center gap-1">Skip to main content</button>
          <span className="opacity-40">|</span>
          <button className="flex items-center gap-1 hover:text-orange-300 font-semibold">
            <Globe className="w-3 h-3" /> English (India)
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        {/* Logo Section */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex items-center gap-2.5 pr-3 border-r border-gray-300">
            <img 
              src="/Government_of_India_logo.svg.webp" 
              alt="National Emblem of India" 
              className="h-10 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-800 leading-none tracking-tight">भारत सरकार</span>
              <span className="text-[9px] font-extrabold text-[#0F4C81] leading-tight tracking-wider uppercase">GOVERNMENT<br/>OF INDIA</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0F4C81] text-white flex items-center justify-center font-black text-base shadow-sm group-hover:bg-[#0c3d67] transition-colors">
              भू
            </div>
            <div>
              <span className="text-lg font-black text-gray-900 tracking-tight block leading-none">
                Bhumi<span className="text-[#0F4C81]">Chain</span>
              </span>
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block leading-none mt-0.5">
                NATIONAL LAND REGISTRY
              </span>
            </div>
          </div>
        </Link>

        {/* Right Nav / User Profile */}
        <div className="flex items-center gap-4">
          {/* Digital India Logo */}
          <div className="hidden sm:flex items-center border-r border-gray-200 pr-4">
            {!digitalIndiaError ? (
              <img 
                src="https://www.digitalindia.gov.in/writereaddata/files/di-logo.png" 
                alt="Digital India" 
                className="h-8 w-auto object-contain"
                onError={() => setDigitalIndiaError(true)}
              />
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-orange-50 via-white to-green-50 border border-gray-200 rounded-md">
                <div className="w-2 h-2 rounded-full bg-[#FF9933]" />
                <span className="text-[10px] font-black tracking-wider text-[#0F4C81]">DIGITAL INDIA</span>
                <div className="w-2 h-2 rounded-full bg-[#138808]" />
              </div>
            )}
          </div>

          <div className="relative">
            <button 
              onClick={() => setShowNotifications(prev => !prev)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full relative transition focus:outline-none"
            >
              <Bell className="w-5 h-5 text-amber-600" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white animate-ping" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-amber-200 rounded-xl shadow-2xl z-[100] overflow-hidden transform transition-all">
                <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-amber-50/70">
                  <span className="text-xs font-bold text-gray-900">Notifications</span>
                  <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">1 Action Required</span>
                </div>
                <div className="p-2">
                  <Link 
                    href="/succession" 
                    onClick={() => {
                      setShowNotifications(false);
                      if (typeof window !== 'undefined' && window.location.pathname.includes('/my-parcels')) {
                        const el = document.getElementById('pending-actions');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="flex items-start gap-3 p-3 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer block border border-amber-200/60 bg-amber-50/20"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-amber-950 flex items-center justify-between">
                        <span>📜 Virasat eSign Request</span>
                        <span className="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-mono">eSign</span>
                      </div>
                      <div className="text-[11px] text-amber-800 mt-1 leading-snug">
                        Click here to open Virasat &amp; eSign consent for your property.
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {user ? (
            <div className="relative group">
              <button className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-300 bg-gray-50/50 transition">
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
                  <p className="text-xs text-gray-500 truncate">{formatMaskedAadhaar(user)}</p>
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
