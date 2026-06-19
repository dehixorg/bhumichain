'use client';

import React, { useEffect } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import BhumiGPT from '@/components/dashboard/BhumiGPT';
import { getDemoToken } from '@/lib/api';
import {
  MessageSquare, BookOpen, Globe, Cpu, Shield,
} from 'lucide-react';

export default function BhumiGPTPage() {
  useEffect(() => {
    getDemoToken('citizen', 'Demo Citizen').catch(() => {});
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar demoMode />

      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-3 shrink-0">
          <MessageSquare className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-semibold text-gray-200">BhumiGPT</span>
          <span className="text-xs text-gray-500">— Demo Scene 7</span>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-brand-400">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
              Claude API + Land Law RAG
            </div>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">

          {/* ── Chat area ───────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            <BhumiGPT className="flex-1 min-h-0" />
          </div>

          {/* ── Right info panel ────────────────────────────────────────── */}
          <div className="w-64 shrink-0 border-l border-gray-800 flex flex-col overflow-y-auto">

            {/* Capabilities */}
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="w-3.5 h-3.5 text-brand-400" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Capabilities</span>
              </div>
              <div className="space-y-2 text-xs text-gray-400">
                {[
                  'Succession & inheritance law',
                  'Tribal land rights (TribalGuard)',
                  'Encumbrance certificates',
                  'Stamp duty calculation',
                  'Mutation process guidance',
                  'Court order interpretation',
                  'FRA 2006 forest rights',
                  'SVAMITVA scheme queries',
                  'PM Kisan eligibility',
                ].map((cap) => (
                  <div key={cap} className="flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-brand-500 shrink-0" />
                    {cap}
                  </div>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-3.5 h-3.5 text-brand-400" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Languages</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {[
                  ['मराठी', 'Marathi', 'Primary'],
                  ['हिंदी', 'Hindi', 'Supported'],
                  ['English', '', 'Supported'],
                ].map(([script, name, status]) => (
                  <div key={script} className="flex items-center justify-between">
                    <span className="text-gray-300">{script} {name && `(${name})`}</span>
                    <span className={status === 'Primary' ? 'text-brand-400 font-medium' : 'text-gray-600'}>{status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sources */}
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-3.5 h-3.5 text-brand-400" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Knowledge Base</span>
              </div>
              <div className="space-y-1.5 text-xs text-gray-500">
                {[
                  'Hindu Succession Act 1956/2005',
                  'Forest Rights Act 2006',
                  'Maharashtra Land Revenue Code',
                  'Registration Act 1908',
                  'Transfer of Property Act 1882',
                  'SVAMITVA Scheme Guidelines 2021',
                  'NALSA Tribal Guidelines',
                  '127 Supreme Court land judgments',
                  'Mahabhulekh Registry Manual',
                ].map((s) => (
                  <div key={s} className="flex items-start gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-gray-600 shrink-0 mt-1" />
                    {s}
                  </div>
                ))}
              </div>
            </div>

            {/* Safety notice */}
            <div className="p-4">
              <div className="flex items-start gap-2 bg-amber-950 border border-amber-900 rounded-xl p-3">
                <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-400">
                  BhumiGPT provides legal information, not legal advice. Consult a qualified advocate for specific cases.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
