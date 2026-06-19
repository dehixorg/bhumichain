'use client';

import React from 'react';
import { LAND_TYPE_COLOR, LAND_TYPE_LABELS } from '@/lib/mapColors';
import type { LandType } from '@/types';

interface Props {
  stats: {
    total: number;
    tribal: number;
    coparcenary: number;
    encumbered: number;
  };
}

export default function MapLegend({ stats }: Props) {
  return (
    <div className="absolute bottom-6 left-4 z-[1000] card min-w-[200px] shadow-2xl">
      <div className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">
        Land Type
      </div>
      {(Object.entries(LAND_TYPE_LABELS) as [LandType, string][]).map(([type, label]) => (
        <div key={type} className="flex items-center gap-2 py-0.5">
          <div
            className="w-3 h-3 rounded-sm shrink-0 border border-gray-700"
            style={{ backgroundColor: LAND_TYPE_COLOR[type] }}
          />
          <span className="text-xs text-gray-400">{label}</span>
        </div>
      ))}

      <div className="mt-3 pt-3 border-t border-gray-800">
        <div className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">
          Boundaries
        </div>
        <div className="flex items-center gap-2 py-0.5">
          <div className="w-6 h-0.5 bg-red-500 rounded" />
          <span className="text-xs text-gray-400">Encumbered</span>
        </div>
        <div className="flex items-center gap-2 py-0.5">
          <div className="w-6 h-0.5 bg-amber-500 rounded" />
          <span className="text-xs text-gray-400">Tribal / Schedule V</span>
        </div>
        <div className="flex items-center gap-2 py-0.5">
          <div className="w-6 h-0.5 bg-yellow-400 rounded" />
          <span className="text-xs text-gray-400">Live Event</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-2 gap-2">
        <Stat label="Total" value={stats.total.toLocaleString()} />
        <Stat label="Tribal" value={stats.tribal.toLocaleString()} color="text-amber-400" />
        <Stat label="Coparcenary" value={stats.coparcenary.toLocaleString()} color="text-purple-400" />
        <Stat label="Encumbered" value={stats.encumbered.toLocaleString()} color="text-red-400" />
      </div>
    </div>
  );
}

function Stat({ label, value, color = 'text-brand-400' }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className={`text-sm font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
