'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/dashboard/Sidebar';
import { getDemoToken } from '@/lib/api';
import {
  Layers, AlertTriangle, CheckCircle, MapPin, Users,
  TrendingUp, Shield, ExternalLink, Info,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Janganana anomaly dataset (mirrors nashik_census_mock.json demo entries) ─

const ANOMALIES = [
  {
    householdId:   'JGNN-NSK-DEMO-01',
    type:          'ENCROACHMENT',
    severity:      'HIGH',
    gps:           [19.7234, 73.6891] as [number, number],
    dlpiId:        null,
    tehsil:        'Igatpuri',
    casteCategory: 'ST',
    desc:          'Household of 6 found on Forest Reserve land near Igatpuri. No legal patta exists.',
    action:        'Revenue Department field survey. Verify if FRA claim pending.',
    householdSize: 6,
  },
  {
    householdId:   'JGNN-NSK-DEMO-02',
    type:          'BENAMI_SUSPECT',
    severity:      'HIGH',
    gps:           [19.9812, 73.7823] as [number, number],
    dlpiId:        'DLPI-MH-NSK-02891',
    tehsil:        'Nashik City',
    casteCategory: 'General',
    desc:          'No household found at registered address. Owner holds 5 similar parcels — benami pattern.',
    action:        'Escalate to I-T Department. FraudSense score: 0.87.',
    householdSize: 0,
  },
  {
    householdId:   'JGNN-NSK-DEMO-03',
    type:          'MISMATCH',
    severity:      'MEDIUM',
    gps:           [20.1456, 73.9234] as [number, number],
    dlpiId:        'DLPI-MH-NSK-04512',
    tehsil:        'Nashik City',
    casteCategory: 'OBC',
    desc:          'Census occupant name does not match DLPI owner. Possible unauthorised transfer without mutation.',
    action:        'Cross-check with Revenue Records Office. Issue mutation notice.',
    householdSize: 4,
  },
  {
    householdId:   'JGNN-NSK-DEMO-04',
    type:          'GHOST_RECORD',
    severity:      'MEDIUM',
    gps:           [19.8345, 74.0123] as [number, number],
    dlpiId:        'DLPI-MH-SNN-00789',
    tehsil:        'Sinnar',
    casteCategory: 'SC',
    desc:          'DLPI shows owner but Janganana enumerator found abandoned land for 8 years. No occupant.',
    action:        'Check if owner deceased — trigger succession process if confirmed.',
    householdSize: 0,
  },
];

const ANOMALY_COLOR: Record<string, string> = {
  ENCROACHMENT:   '#ef4444',
  BENAMI_SUSPECT: '#f59e0b',
  MISMATCH:       '#3b82f6',
  GHOST_RECORD:   '#8b5cf6',
};

const SUMMARY = {
  totalEnumerated: 4_814,
  matchedToDLPI:   4_512,
  anomalies:         302,
  fieldReviewDone:    67,
};

// ─── Map component (client-only) ──────────────────────────────────────────────

function JangananaMap({ anomalies }: { anomalies: typeof ANOMALIES }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<ReturnType<typeof import('leaflet')['map']> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current || mapRef.current) return;

    import('leaflet').then((L) => {
      if (!containerRef.current || (containerRef.current as any)._leaflet_id) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, { center: [19.95, 73.85], zoom: 10 });
      mapRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);

      for (const a of anomalies) {
        const color = ANOMALY_COLOR[a.type] || '#9ca3af';
        L.circleMarker(a.gps, {
          radius: a.severity === 'HIGH' ? 14 : 10,
          fillColor: color, color: '#fff', weight: 1.5,
          fillOpacity: 0.80,
        })
          .addTo(map)
          .bindPopup(`
            <div style="font-size:11px;color:#f3f4f6;min-width:180px">
              <div style="font-weight:bold;color:${color};margin-bottom:3px">${a.type.replace(/_/g,' ')}</div>
              <div style="color:#9ca3af;margin-bottom:2px">${a.householdId}</div>
              ${a.dlpiId ? `<div style="font-family:monospace;color:#6b7280;margin-bottom:4px">${a.dlpiId}</div>` : ''}
              <div style="margin-bottom:2px">${a.desc.slice(0, 80)}…</div>
              <div style="color:#6b7280;margin-top:4px">${a.tehsil} tehsil</div>
            </div>
          `);
      }

      // Legend
      const legend = new L.Control({ position: 'bottomright' });
      legend.onAdd = () => {
        const div = L.DomUtil.create('div', '');
        div.innerHTML = Object.entries(ANOMALY_COLOR)
          .map(([k, c]) => `<div style="display:flex;align-items:center;gap:5px;margin-bottom:3px;font-size:10px;color:#d1d5db">
            <div style="width:10px;height:10px;border-radius:50%;background:${c};flex-shrink:0"></div>${k.replace(/_/g,' ')}
          </div>`)
          .join('');
        div.style.cssText = 'background:rgba(17,24,39,0.9);padding:8px 10px;border-radius:8px;border:1px solid #374151';
        return div;
      };
      legend.addTo(map);
    });

    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  return <div ref={containerRef} className="w-full h-full rounded-xl" />;
}

const JangananaMapDynamic = dynamic(() => Promise.resolve(JangananaMap), { ssr: false, loading: () => (
  <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500 text-sm animate-pulse rounded-xl">
    Loading map…
  </div>
) });

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JangananaPage() {
  const [selected, setSelected] = useState<typeof ANOMALIES[number] | null>(null);

  useEffect(() => {
    getDemoToken('revenue_officer', 'Janganana Officer').catch(() => {});
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar demoMode />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Topbar */}
        <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-3 shrink-0">
          <Layers className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-semibold text-gray-200">Janganana Integration</span>
          <span className="text-xs text-gray-500">— Census 2026-27 × BhumiChain cross-reference</span>
        </div>

        <div className="p-6 space-y-5">

          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Households enumerated', value: SUMMARY.totalEnumerated.toLocaleString('en-IN'), icon: <Users className="w-4 h-4" />, color: 'brand' },
              { label: 'Matched to DLPI',        value: SUMMARY.matchedToDLPI.toLocaleString('en-IN'),  icon: <CheckCircle className="w-4 h-4" />, color: 'brand' },
              { label: 'Anomalies flagged',       value: SUMMARY.anomalies.toString(),                   icon: <AlertTriangle className="w-4 h-4" />, color: 'red' },
              { label: 'Field reviews complete',  value: SUMMARY.fieldReviewDone.toString(),             icon: <TrendingUp className="w-4 h-4" />, color: 'amber' },
            ].map(({ label, value, icon, color }) => {
              const text = { brand: 'text-brand-300', red: 'text-red-300', amber: 'text-amber-300' }[color];
              const bg   = { brand: 'bg-brand-950',   red: 'bg-red-950',   amber: 'bg-amber-950'   }[color];
              return (
                <div key={label} className="card flex items-center gap-3">
                  <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', bg)}>
                    <span className={text}>{icon}</span>
                  </div>
                  <div>
                    <div className={clsx('text-xl font-bold font-mono', text)}>{value}</div>
                    <div className="text-xs text-gray-500">{label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-5" style={{ height: '380px' }}>

            {/* Map */}
            <div className="flex-1 card p-0 overflow-hidden">
              <JangananaMapDynamic anomalies={ANOMALIES} />
            </div>

            {/* Anomaly type breakdown */}
            <div className="w-64 shrink-0 space-y-3">
              <div className="card">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Anomaly Types
                </div>
                {Object.entries(ANOMALY_COLOR).map(([type, color]) => {
                  const count = type === 'ENCROACHMENT' ? 89 : type === 'BENAMI_SUSPECT' ? 47 : type === 'MISMATCH' ? 134 : 32;
                  const pct   = Math.round((count / SUMMARY.anomalies) * 100);
                  return (
                    <div key={type} className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-300">{type.replace(/_/g, ' ')}</span>
                        <span className="text-xs font-mono font-bold" style={{ color }}>{count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="card">
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-500 space-y-1.5">
                    <p>Janganana GPS data is cross-referenced with the BhumiChain DLPI registry in real-time.</p>
                    <p>Anomalies are auto-prioritised by severity and forwarded to the relevant tehsildar.</p>
                    <p className="text-brand-400">SVAMITVA scheme: 3.10 crore property cards issued across 3.29 lakh villages.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Anomaly detail table */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-brand-400" />
              <span className="text-sm font-semibold text-gray-200">Demo Anomaly Records</span>
              <span className="ml-auto text-xs text-gray-500">Click row for details</span>
            </div>
            <div className="space-y-2">
              {ANOMALIES.map((a) => (
                <button
                  key={a.householdId}
                  onClick={() => setSelected(selected?.householdId === a.householdId ? null : a)}
                  className={clsx(
                    'w-full text-left rounded-xl border transition-colors',
                    selected?.householdId === a.householdId
                      ? 'bg-gray-800 border-brand-700'
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600',
                  )}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: ANOMALY_COLOR[a.type] || '#9ca3af' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-200">{a.type.replace(/_/g, ' ')}</span>
                        <span className={clsx(
                          'text-xs px-1.5 py-0.5 rounded font-semibold',
                          a.severity === 'HIGH' ? 'bg-red-950 text-red-400' : 'bg-amber-950 text-amber-400',
                        )}>{a.severity}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{a.desc}</div>
                    </div>
                    <div className="text-right text-xs text-gray-600 shrink-0">
                      <div className="font-mono">{a.dlpiId || '—'}</div>
                      <div>{a.tehsil}</div>
                    </div>
                  </div>

                  {selected?.householdId === a.householdId && (
                    <div className="px-4 pb-3 pt-1 border-t border-gray-700 space-y-2 text-xs text-gray-400">
                      <div className="flex gap-4">
                        <span className="text-gray-500">GPS</span>
                        <span className="font-mono">{a.gps[0].toFixed(4)}, {a.gps[1].toFixed(4)}</span>
                      </div>
                      <div className="flex gap-4">
                        <span className="text-gray-500">Household ID</span>
                        <span className="font-mono">{a.householdId}</span>
                      </div>
                      <div className="flex gap-4">
                        <span className="text-gray-500">Household size</span>
                        <span>{a.householdSize === 0 ? 'No occupant found' : `${a.householdSize} members`}</span>
                      </div>
                      <div className="flex gap-4">
                        <span className="text-gray-500">Caste</span>
                        <span>{a.casteCategory}</span>
                      </div>
                      <div className="flex gap-2 mt-2 pt-2 border-t border-gray-800">
                        <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span className="text-amber-300">Recommended: {a.action}</span>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
