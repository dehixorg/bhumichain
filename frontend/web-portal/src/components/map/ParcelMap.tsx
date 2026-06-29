'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON } from 'leaflet';
import type { GeoFeatureCollection, GeoFeature, Parcel, WsMessage } from '@/types';
import { getParcelStyle } from '@/lib/mapColors';
import MapLegend from './MapLegend';
import ParcelPopup from './ParcelPopup';
import { useWebSocket } from '@/hooks/useWebSocket';
import { getParcel } from '@/lib/api';
import toast from 'react-hot-toast';

// Nashik district centre
const NASHIK_CENTER: [number, number] = [20.0, 74.0];
const DEFAULT_ZOOM = 10;

interface Props {
  geojson: GeoFeatureCollection;
  onParcelSelect?: (dlpiId: string) => void;
}

export default function ParcelMap({ geojson, onParcelSelect }: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const geoLayerRef = useRef<LeafletGeoJSON | null>(null);
  const layersByDlpi = useRef<Map<string, L.Layer>>(new Map());
  const popupRef = useRef<HTMLDivElement | null>(null);

  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [highlightedDlpiId, setHighlightedDlpiId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Stats
  const stats = {
    total: geojson.features.length,
    tribal: geojson.features.filter((f) => f.properties.isTribal).length,
    coparcenary: geojson.features.filter((f) => f.properties.isCoparcenary).length,
    encumbered: geojson.features.filter((f) => f.properties.encumbranceStatus !== 'CLEAR').length,
  };

  // ── WebSocket: highlight parcel on live Fabric events ──────────────────────
  const { on: onWs, triggerMock } = useWebSocket();

  useEffect(() => {
    // On any chaincode event that carries a dlpiId, pulse that parcel
    const off = onWs('*', (msg: WsMessage) => {
      const dlpiId = msg.payload?.dlpiId as string | undefined;
      if (!dlpiId) return;

      setHighlightedDlpiId(dlpiId);
      setTimeout(() => setHighlightedDlpiId(null), 4000);

      // Human-readable toast
      const text = getEventToast(msg.event, msg.payload);
      if (text) {
        if (msg.event.includes('Rejected') || msg.event.includes('Hard')) {
          toast.error(text, { duration: 6000 });
        } else {
          toast.success(text, { duration: 4000 });
        }
      }
    });
    return off;
  }, [onWs]);

  // ── Leaflet init (client-side only) ───────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return; // already initialised

    // Dynamic import to prevent SSR crash
    (async () => {
      const L = await import('leaflet');

      // Fix default marker icon path (Next.js bundles break it)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const map = L.map('bhumichain-map', {
        center: NASHIK_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        attributionControl: true,
      });

      // Dark base tiles (CartoDB Dark Matter)
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 20,
        },
      ).addTo(map);

      mapRef.current = map;
      renderGeoJSON(L, map);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-render when highlight changes ──────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    (async () => {
      const L = await import('leaflet');
      renderGeoJSON(L, mapRef.current!);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedDlpiId, filterType, searchQuery]);

  const renderGeoJSON = useCallback(async (L: typeof import('leaflet'), map: LeafletMap) => {
    if (geoLayerRef.current) {
      geoLayerRef.current.remove();
    }
    layersByDlpi.current.clear();

    // Filter features
    const filtered = geojson.features.filter((f) => {
      const p = f.properties;
      if (filterType === 'tribal' && !p.isTribal) return false;
      if (filterType === 'coparcenary' && !p.isCoparcenary) return false;
      if (filterType === 'encumbered' && p.encumbranceStatus === 'CLEAR') return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          p.dlpiId.toLowerCase().includes(q) ||
          p.owner.toLowerCase().includes(q) ||
          p.surveyNumber.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const layer = L.geoJSON(
      { type: 'FeatureCollection', features: filtered } as GeoJSON.FeatureCollection,
      {
        style: (feature) => {
          const f = feature as GeoFeature;
          return getParcelStyle({
            landType: f.properties.landType,
            encumbranceStatus: f.properties.encumbranceStatus,
            isTribal: f.properties.isTribal,
            isCoparcenary: f.properties.isCoparcenary,
            dlpiId: f.properties.dlpiId,
            isHighlighted: f.properties.dlpiId === highlightedDlpiId,
            isSelected: f.properties.dlpiId === selectedParcel?.dlpiId,
          });
        },
        onEachFeature: (feature, featureLayer) => {
          const f = feature as GeoFeature;
          const dlpiId = f.properties.dlpiId;
          layersByDlpi.current.set(dlpiId, featureLayer);

          featureLayer.on('click', async () => {
            try {
              const parcel = await getParcel(dlpiId);
              setSelectedParcel(parcel);
              onParcelSelect?.(dlpiId);
            } catch {
              toast.error(`Could not load parcel ${dlpiId}`);
            }
          });

          featureLayer.on('mouseover', (e) => {
            (e.target as L.Path).setStyle({ fillOpacity: 0.95, weight: 2 });
            featureLayer.bindTooltip(
              `<div class="text-xs"><strong>${f.properties.owner}</strong><br/>${f.properties.dlpiId}</div>`,
              { direction: 'top', className: 'leaflet-tooltip-dark' },
            ).openTooltip();
          });

          featureLayer.on('mouseout', (e) => {
            layer.resetStyle(e.target as L.Path);
          });
        },
      },
    ).addTo(map);

    geoLayerRef.current = layer;

    // If a parcel is highlighted, pan to it
    if (highlightedDlpiId) {
      const hlLayer = layersByDlpi.current.get(highlightedDlpiId);
      if (hlLayer && 'getBounds' in hlLayer) {
        map.fitBounds((hlLayer as L.Polygon).getBounds(), { maxZoom: 14, animate: true });
      }
    }
  }, [geojson, filterType, searchQuery, highlightedDlpiId, selectedParcel, onParcelSelect]);

  const flyToDemoParcel = (dlpiId: string) => {
    const layer = layersByDlpi.current.get(dlpiId);
    if (layer && 'getBounds' in layer && mapRef.current) {
      mapRef.current.fitBounds((layer as L.Polygon).getBounds(), { maxZoom: 15, animate: true, duration: 1 });
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Search + filter toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2">
        <input
          type="text"
          placeholder="Search DLPI, owner, survey no..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64 bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-1.5 placeholder-gray-500 focus:outline-none focus:border-brand-500"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-500"
        >
          <option value="all">All Parcels</option>
          <option value="tribal">Tribal / Schedule V</option>
          <option value="coparcenary">Coparcenary</option>
          <option value="encumbered">Encumbered</option>
        </select>
      </div>

      {/* Demo jump buttons */}
      <div className="absolute top-16 left-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => flyToDemoParcel('DLPI-MH-SNN-00142')}
          className="bg-brand-700 hover:bg-brand-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap"
        >
          → Ramesh Patil (Scene 2–5)
        </button>
        <button
          onClick={() => flyToDemoParcel('DLPI-MH-IGT-T0023')}
          className="bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap"
        >
          → Tribal Parcel (Scene 6)
        </button>
      </div>

      {/* Leaflet map container */}
      <div id="bhumichain-map" className="w-full h-full" />

      {/* Legend */}
      <MapLegend stats={stats} />

      {/* Selected parcel panel */}
      {selectedParcel && (
        <div className="absolute top-4 right-4 z-[1000] card w-80 shadow-2xl animate-slide-up overflow-y-auto max-h-[80vh]">
          <button
            onClick={() => setSelectedParcel(null)}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-300 text-lg leading-none"
          >
            ×
          </button>
          <ParcelPopup parcel={selectedParcel} onViewFull={onParcelSelect} />
        </div>
      )}

      {/* Live event indicator */}
      {highlightedDlpiId && (
        <div className="absolute bottom-6 right-4 z-[1000] flex items-center gap-2 bg-yellow-900 border border-yellow-600 text-yellow-300 text-xs font-semibold px-3 py-2 rounded-full shadow-lg">
          <span className="w-2 h-2 rounded-full bg-yellow-400 pulse-ring" />
          Live Event · {highlightedDlpiId}
        </div>
      )}
    </div>
  );
}

// ─── Toast messages per event ─────────────────────────────────────────────────
function getEventToast(event: string, payload: Record<string, unknown>): string | null {
  switch (event) {
    case 'DLPICreated': return `✅ DLPI ${payload.dlpiId} recorded on BhumiChain`;
    case 'TransferInitiated': return `🔒 National lock acquired for ${payload.dlpiId}`;
    case 'TransferCompleted': return `🎉 Title transferred! DigiLocker delivery sent.`;
    case 'TribalTransferHardRejected': return `🚫 TRIBAL BLOCK — ${payload.rejectionCode}`;
    case 'HeirNotificationRequired': return `⚖️ Succession initiated — 3 heirs notified`;
    case 'AllHeirsConsented': return `✅ All heirs consented — mutation executing`;
    case 'MutationInitiated': return `⚠️ Mutation alert sent in 64 seconds`;
    case 'SuccessionDisputeFiled': return `⚖️ Dispute filed — case referred to court`;
    default: return null;
  }
}
