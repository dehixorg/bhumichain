'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/dashboard/Sidebar';
import type { GeoFeatureCollection } from '@/types';
import { getDemoToken } from '@/lib/api';
import { Layers, Eye, EyeOff } from 'lucide-react';

// Dynamic import — Leaflet needs the browser, can't SSR
const ParcelMap = dynamic(() => import('@/components/map/ParcelMap'), { ssr: false });
const CensusLayer = dynamic(() => import('@/components/map/CensusLayer'), { ssr: false });

export default function MapPage() {
  const [geojson, setGeojson] = useState<GeoFeatureCollection | null>(null);
  const [censusData, setCensusData] = useState<unknown[]>([]);
  const [showCensus, setShowCensus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDlpiId, setSelectedDlpiId] = useState<string | null>(null);
  const mapRef = useRef(null);

  useEffect(() => {
    // Acquire demo token on mount
    getDemoToken('revenue_officer', 'Prakash Kulkarni').catch(() => {});

    // Load synthetic GeoJSON (served from /public/data/)
    fetch('/data/nashik_parcels.geojson')
      .then((r) => r.json())
      .then((d) => {
        setGeojson(d);
        setLoading(false);
      })
      .catch(() => {
        // Fallback: load directly from the data directory path (dev only)
        setLoading(false);
      });

    // Load census mock data
    fetch('/data/nashik_census_mock.json')
      .then((r) => r.json())
      .then((d) => setCensusData(d))
      .catch(() => {});
  }, []);

  const flaggedHouseholds = (censusData as Array<{
    isFlagged: boolean;
    latitude: number;
    longitude: number;
    householdId: string;
    dlpiId: string;
    anomalyType: string | null;
    anomalySeverity: string | null;
  }>).filter((h) => h.isFlagged);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar demoMode />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-semibold text-gray-200">Land Parcel Map</span>
            <span className="text-xs text-gray-500">— Nashik District, Maharashtra</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Janganana overlay toggle */}
            <button
              onClick={() => setShowCensus((v) => !v)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                showCensus
                  ? 'bg-blue-900 border-blue-600 text-blue-300'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {showCensus ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              Janganana Overlay
              {showCensus && flaggedHouseholds.length > 0 && (
                <span className="bg-red-600 text-white rounded-full px-1.5 py-0.5 text-xs ml-1">
                  {flaggedHouseholds.length}
                </span>
              )}
            </button>

            {/* SVAMITVA source note */}
            <span className="text-xs text-gray-600">Source: SVAMITVA · Census 2026-27</span>
          </div>
        </div>

        {/* Map area */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <div className="text-gray-400 text-sm">Loading 5,000 Nashik parcels...</div>
              </div>
            </div>
          ) : geojson ? (
            <Suspense fallback={<div className="absolute inset-0 bg-gray-950" />}>
              <ParcelMap
                geojson={geojson}
                onParcelSelect={setSelectedDlpiId}
              />
            </Suspense>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="card text-center max-w-sm">
                <div className="text-gray-400 text-sm mb-2">GeoJSON not found at /public/data/</div>
                <div className="text-gray-600 text-xs">
                  Copy nashik_parcels.geojson to<br />
                  <code className="text-brand-400">frontend/web-portal/public/data/</code>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="fixed bottom-0 left-56 right-0 h-6 bg-gray-900 border-t border-gray-800 flex items-center px-4 gap-6 text-xs text-gray-600 z-50">
        {selectedDlpiId && <span>Selected: <span className="text-brand-400 font-mono">{selectedDlpiId}</span></span>}
        <span className="ml-auto">Hyperledger Fabric v2.5 · CouchDB · IPFS</span>
      </div>
    </div>
  );
}
