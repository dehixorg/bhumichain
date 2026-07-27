'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/dashboard/Sidebar';
import type { GeoFeatureCollection } from '@/types';
import { Layers, Eye, EyeOff } from 'lucide-react';

// Dynamic import — Leaflet needs the browser, can't SSR
const ParcelMap = dynamic(() => import('@/components/map/ParcelMap'), { ssr: false });

function MapContent() {
  const searchParams = useSearchParams();
  const initialDlpiId = searchParams ? searchParams.get('dlpi') : null;

  const [geojson, setGeojson] = useState<GeoFeatureCollection | null>(null);
  const [censusData, setCensusData] = useState<unknown[]>([]);
  const [showCensus, setShowCensus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDlpiId, setSelectedDlpiId] = useState<string | null>(initialDlpiId);

  useEffect(() => {
    fetch('/data/nashik_parcels.geojson')
      .then((r) => r.json())
      .then((d) => {
        setGeojson(d);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

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
  }>).filter((h) => h?.isFlagged);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0F4C81]" />
            <span className="text-sm font-semibold text-gray-700">Land Parcel Map</span>
            <span className="text-xs text-gray-500">— Phulwari Sharif Anchal, Patna District, Bihar</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => setShowCensus((v) => !v)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                showCensus
                  ? 'bg-blue-900 border-blue-600 text-blue-300'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300'
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

            <span className="text-xs text-gray-600">Source: SVAMITVA · Census 2026-27</span>
          </div>
        </div>

        {/* Map area */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-[#0F4C81]/60 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <div className="text-gray-400 text-sm">Loading Phulwari Sharif land parcels...</div>
              </div>
            </div>
          ) : geojson ? (
            <ParcelMap
              geojson={geojson}
              initialDlpiId={initialDlpiId}
              onParcelSelect={setSelectedDlpiId}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="card text-center max-w-sm">
                <div className="text-gray-400 text-sm mb-2">GeoJSON data loaded</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="fixed bottom-0 left-56 right-0 h-6 bg-white border-t border-gray-200 flex items-center px-4 gap-6 text-xs text-gray-600 z-50">
        {selectedDlpiId && <span>Selected DLPI: <span className="text-[#0F4C81] font-mono font-bold">{selectedDlpiId}</span></span>}
        <span className="ml-auto">Hyperledger Fabric v2.5 · CouchDB · IPFS</span>
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#F8FAFC] flex items-center justify-center text-xs text-gray-400">Loading Map...</div>}>
      <MapContent />
    </Suspense>
  );
}
