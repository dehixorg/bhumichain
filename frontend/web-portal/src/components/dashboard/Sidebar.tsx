'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Map, FileText, ArrowLeftRight, Users, Shield, MessageSquare,
  BarChart3, Layers, Settings, Zap
} from 'lucide-react';
import clsx from 'clsx';

const NAV = [
  { href: '/map',        icon: Map,             label: 'GIS Map',          scene: null },
  { href: '/scan',       icon: FileText,         label: 'RecordScan AI',    scene: 2 },
  { href: '/succession', icon: Users,            label: 'Succession',       scene: 3 },
  { href: '/transfer',   icon: ArrowLeftRight,   label: 'Property Transfer', scene: 4 },
  { href: '/tribal',     icon: Shield,           label: 'TribalGuard',      scene: 6 },
  { href: '/bhumi-gpt',  icon: MessageSquare,    label: 'BhumiGPT',         scene: 7 },
  { href: '/analytics',  icon: BarChart3,        label: 'Analytics',        scene: 8 },
  { href: '/janganana',  icon: Layers,           label: 'Janganana',        scene: null },
];

interface Props {
  demoMode?: boolean;
}

export default function Sidebar({ demoMode }: Props) {
  const pathname = usePathname();

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
            <div className="text-gray-500 text-xs">Maharashtra Pilot</div>
          </div>
        </div>
      </div>

      {/* Demo mode badge */}
      {demoMode && (
        <div className="mx-3 mt-3 bg-saffron-500 bg-opacity-20 border border-saffron-500 border-opacity-40 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-saffron-400" />
          <span className="text-saffron-400 text-xs font-semibold">Demo Mode</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 mt-2">
        {NAV.map(({ href, icon: Icon, label, scene }) => {
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

      {/* Bottom status */}
      <div className="p-3 border-t border-gray-800">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          <span className="text-xs text-gray-400">Fabric</span>
          <span className="text-xs text-brand-400 font-semibold ml-auto">MOCK</span>
        </div>
        <div className="text-xs text-gray-600 text-center mt-2">
          Nashik · 5,000 parcels
        </div>
      </div>
    </aside>
  );
}
