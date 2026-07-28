'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Map, FileText, Users, Shield, MessageSquare,
  BarChart3, Layers, LogOut, Gavel, Home, GitMerge,
  Building2,
} from 'lucide-react';
import clsx from 'clsx';
import { getUser, logout, isOfficer, type JWTUser } from '@/lib/auth';

const NAV_CITIZEN = [
  { href: '/my-parcels', icon: Home,           label: 'My Parcels'         },
  { href: '/map',        icon: Map,            label: 'GIS Map'            },
  { href: '/mutation',   icon: GitMerge,       label: 'Mutations'          },
  { href: '/succession', icon: Users,          label: 'Succession'         },
  { href: '/nyaya-ai',   icon: MessageSquare,  label: 'NyayaAI'           },
  { href: '/auction',    icon: Gavel,          label: 'BhumiAuction'       },
];

const NAV_OFFICER = [
  { href: '/officer-dashboard', icon: Building2,      label: 'Officer Queue'      },
  { href: '/map',               icon: Map,            label: 'GIS Map'            },
  { href: '/scan',              icon: FileText,       label: 'RecordScan AI'      },
  { href: '/mutation',          icon: GitMerge,       label: 'Mutation Manager'   },
  { href: '/succession',        icon: Users,          label: 'Succession'         },
  { href: '/nyaya-ai',          icon: MessageSquare,  label: 'NyayaAI'           },
  { href: '/auction',           icon: Gavel,          label: 'BhumiAuction'       },
  { href: '/analytics',         icon: BarChart3,      label: 'Analytics'          },
  { href: '/janganana',         icon: Layers,         label: 'Janganana'          },
];

const ROLE_LABEL: Record<string, string> = {
  circle_officer:   'Circle Officer (Tehsildar)',
  anchalAdhikari:   'Circle Officer (Tehsildar)',
  tehsildar:        'Circle Officer (Tehsildar)',
  circle_inspector: 'Kanungo (Anchal Nirikshak)',
  anchalNirikshak:  'Kanungo (Anchal Nirikshak)',
  kanungo:          'Kanungo (Anchal Nirikshak)',
  karmachari:       'Patwari (Karmachari)',
  patwari:          'Patwari (Karmachari)',
  citizen:          'Citizen',
  kotwal:           'Kotwal',
};

interface Props {
  demoMode?: boolean;
}

export default function Sidebar({ demoMode }: Props = {}) {
  const pathname = usePathname() ?? '';
  const [user, setUser] = useState<JWTUser | null>(null);
  const fabricMode = process.env.NEXT_PUBLIC_FABRIC_MODE || 'mock';

  useEffect(() => { setUser(getUser()); }, []);

  let nav = user && isOfficer() ? NAV_OFFICER : NAV_CITIZEN;
  const isTehsildarUser = user?.role && ['circle_officer', 'anchalAdhikari', 'tehsildar'].includes(user.role);

  if (user?.role === 'karmachari') {
    nav = nav.filter((item) => !['Mutation Manager', 'Mutations', 'Succession', 'Analytics', 'Janganana'].includes(item.label));
  } else if (user?.role === 'circle_inspector') {
    nav = nav.filter((item) => !['Analytics', 'Janganana'].includes(item.label));
  } else if (isTehsildarUser) {
    nav = nav.filter((item) => item.label !== 'Succession');
  }
  const initials = user?.name?.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U';

  return (
    <aside className="w-[220px] shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen custom-scrollbar">

      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0F4C81] flex items-center justify-center shadow-sm flex-shrink-0">
            <span className="text-white font-black text-[13px] leading-none">भू</span>
          </div>
          <div className="min-w-0">
            <div className="font-bold text-gray-900 text-sm leading-tight">BhumiChain</div>
            <div className="text-[10px] text-gray-400 font-medium leading-tight mt-0.5">Bihar · Pilot</div>
          </div>
        </div>
        {/* Tricolor accent */}
        <div className="flex mt-4 rounded-full overflow-hidden h-[3px]">
          <div className="flex-1 bg-[#FF9933]" />
          <div className="flex-1 bg-gray-100" />
          <div className="flex-1 bg-[#138808]" />
        </div>
      </div>

      {/* ── User Profile ──────────────────────────────────────────────── */}
      {user && (
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#F8FAFC] border border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-[#0F4C81]/10 border border-[#0F4C81]/15 flex items-center justify-center text-[#0F4C81] font-bold text-xs flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-gray-900 text-[12px] font-bold truncate leading-tight">{user.name}</div>
              <div className="text-gray-400 text-[10px] font-medium leading-tight mt-0.5">{ROLE_LABEL[user.role] ?? user.role}</div>
              {user.jurisdictionCode && (
                <div className="text-[#0F4C81] text-[9px] font-mono mt-0.5 truncate">{user.jurisdictionCode}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation ────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto custom-scrollbar">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all group',
                active
                  ? 'bg-[#0F4C81] text-white shadow-sm shadow-[#0F4C81]/20'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <Icon className={clsx('w-[15px] h-[15px] shrink-0 transition-colors', active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600')} />
              <span className="flex-1 leading-none">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-2">
        {/* Fabric status */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
          <div className="flex items-center gap-2">
            <div className={clsx(
              'w-1.5 h-1.5 rounded-full',
              fabricMode === 'real' ? 'bg-green-500 animate-pulse' : 'bg-blue-500',
            )} />
            <span className="text-[11px] text-gray-500 font-medium">Fabric</span>
          </div>
          <span className={clsx(
            'text-[10px] font-black uppercase tracking-wider',
            fabricMode === 'real' ? 'text-green-600' : 'text-[#0F4C81]',
          )}>
            {fabricMode}
          </span>
        </div>
        <div className="text-[10px] text-gray-400 text-center font-medium">Phulwari Sharif · 500 Khataunis</div>
        {user && (
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100 border border-transparent transition-all font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        )}
      </div>
    </aside>
  );
}
