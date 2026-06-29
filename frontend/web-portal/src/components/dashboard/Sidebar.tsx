'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Map, FileText, ArrowLeftRight, Users, Shield, MessageSquare,
  BarChart3, Layers, Zap, LogOut, ScrollText, Gavel, Home, GitMerge,
} from 'lucide-react';
import clsx from 'clsx';
import { getUser, logout, isOfficer, type JWTUser } from '@/lib/auth';

const NAV_CITIZEN = [
  { href: '/my-parcels', icon: Home,           label: 'My Parcels',        scene: null },
  { href: '/map',        icon: Map,            label: 'GIS Map',           scene: 1    },
  { href: '/mutation',   icon: GitMerge,       label: 'Mutations',         scene: null },
  { href: '/transfer',   icon: ArrowLeftRight, label: 'Property Transfer', scene: 4    },
  { href: '/succession', icon: Users,          label: 'Succession',        scene: 3    },
  { href: '/nyaya-ai',   icon: MessageSquare,  label: 'NyayaAI',          scene: 5    },
  { href: '/ec',         icon: ScrollText,     label: 'EC Certificate',    scene: null },
  { href: '/auction',    icon: Gavel,          label: 'BhumiAuction',      scene: null },
  { href: '/tribal',     icon: Shield,         label: 'TribalGuard',       scene: 6    },
];

const NAV_OFFICER = [
  { href: '/officer-dashboard', icon: Home,           label: 'Officer Queue',     scene: null },
  { href: '/map',               icon: Map,            label: 'GIS Map',           scene: 1    },
  { href: '/scan',              icon: FileText,       label: 'RecordScan AI',     scene: 2    },
  { href: '/mutation',          icon: GitMerge,       label: 'Mutation Manager',  scene: null },
  { href: '/succession',        icon: Users,          label: 'Succession',        scene: 3    },
  { href: '/transfer',          icon: ArrowLeftRight, label: 'Property Transfer', scene: 4    },
  { href: '/nyaya-ai',          icon: MessageSquare,  label: 'NyayaAI',          scene: 5    },
  { href: '/tribal',            icon: Shield,         label: 'TribalGuard',       scene: 6    },
  { href: '/auction',           icon: Gavel,          label: 'BhumiAuction',      scene: null },
  { href: '/analytics',         icon: BarChart3,      label: 'Analytics',         scene: 8    },
  { href: '/janganana',         icon: Layers,         label: 'Janganana',         scene: null },
];

interface Props {
  demoMode?: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  tehsildar:        'Tehsildar',
  circle_inspector: 'Kanungo / CI',
  patwari:          'Patwari',
  citizen:          'Citizen',
  kotwal:           'Kotwal',
};

export default function Sidebar({ demoMode }: Props) {
  const pathname = usePathname() ?? '';
  const router   = useRouter();
  const [user, setUser] = useState<JWTUser | null>(null);
  const fabricMode = process.env.NEXT_PUBLIC_FABRIC_MODE || 'mock';

  useEffect(() => { setUser(getUser()); }, []);

  const nav = user && isOfficer() ? NAV_OFFICER : NAV_CITIZEN;

  return (
    <aside className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col h-screen">
      {/* Logo */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">भू</span>
          </div>
          <div>
            <div className="font-bold text-gray-100 text-sm">BhumiChain</div>
            <div className="text-gray-500 text-xs">Uttar Pradesh Pilot</div>
          </div>
        </div>
      </div>

      {/* Logged-in user chip */}
      {user && (
        <div className="mx-3 mt-3 bg-gray-800 rounded-lg px-3 py-2">
          <div className="text-gray-200 text-xs font-semibold truncate">{user.name}</div>
          <div className="text-gray-500 text-xs">{ROLE_LABEL[user.role] ?? user.role}</div>
          {user.jurisdictionCode && (
            <div className="text-brand-500 text-xs font-mono mt-0.5">{user.jurisdictionCode}</div>
          )}
        </div>
      )}

      {/* Demo mode badge */}
      {demoMode && (
        <div className="mx-3 mt-2 bg-saffron-500 bg-opacity-20 border border-saffron-500 border-opacity-40 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-saffron-400" />
          <span className="text-saffron-400 text-xs font-semibold">Demo Mode</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 mt-2 overflow-y-auto">
        {nav.map(({ href, icon: Icon, label, scene }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-brand-900 text-brand-300 font-medium'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {scene && (
                <span className={clsx(
                  'text-xs font-mono px-1.5 py-0.5 rounded',
                  active ? 'bg-brand-800 text-brand-300' : 'bg-gray-800 text-gray-500',
                )}>
                  S{scene}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Fabric status + logout */}
      <div className="p-3 border-t border-gray-800 space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800">
          <div className={clsx(
            'w-1.5 h-1.5 rounded-full animate-pulse',
            fabricMode === 'real' ? 'bg-green-400' : 'bg-brand-400',
          )} />
          <span className="text-xs text-gray-400">Fabric</span>
          <span className={clsx(
            'text-xs font-semibold ml-auto',
            fabricMode === 'real' ? 'text-green-400' : 'text-brand-400',
          )}>
            {fabricMode.toUpperCase()}
          </span>
        </div>
        <div className="text-xs text-gray-600 text-center">Noida · 500 Khataunis</div>
        {user && (
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Logout
          </button>
        )}
      </div>
    </aside>
  );
}
