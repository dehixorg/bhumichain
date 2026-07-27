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

// Phulwari Sharif, Patna District, Bihar — map centre
const MAP_CENTER: [number, number] = [25.55, 85.08];
const DEFAULT_ZOOM = 13;

// Random but deterministic location within Phulwari Sharif based on DLPI string
function getDlpiLocation(dlpiId: string): [number, number] {
  let hash = 0;
  for (let i = 0; i < dlpiId.length; i++) {
    hash = (hash * 31 + dlpiId.charCodeAt(i)) & 0xffffffff;
  }
  // Phulwari Sharif bounding box approx: lat 25.52–25.58, lng 85.04–85.12
  const lat = 25.52 + ((Math.abs(hash) % 600) / 10000);
  const lng = 85.04 + ((Math.abs(hash >> 8) % 800) / 10000);
  return [lat, lng];
}

interface Props {
  geojson: GeoFeatureCollection;
  initialDlpiId?: string | null;
  onParcelSelect?: (dlpiId: string) => void;
}

export default function ParcelMap({ geojson, initialDlpiId, onParcelSelect }: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const geoLayerRef = useRef<LeafletGeoJSON | null>(null);
  const pinMarkerRef = useRef<L.Marker | null>(null);
  const layersByDlpi = useRef<Map<string, L.Layer>>(new Map());

  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [highlightedDlpiId, setHighlightedDlpiId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Stats
  const stats = {
    total: geojson?.features?.length ?? 0,
    tribal: geojson?.features?.filter((f) => f?.properties?.isTribal)?.length ?? 0,
    coparcenary: geojson?.features?.filter((f) => f?.properties?.isCoparcenary)?.length ?? 0,
    encumbered: geojson?.features?.filter((f) => f?.properties?.encumbranceStatus !== 'CLEAR')?.length ?? 0,
  };

  // ── WebSocket: highlight parcel on live Fabric events ──────────────────────
  const { on: onWs } = useWebSocket();

  useEffect(() => {
    const off = onWs('*', (msg: WsMessage) => {
      const dlpiId = msg.payload?.dlpiId as string | undefined;
      if (!dlpiId) return;
      setHighlightedDlpiId(dlpiId);
      setTimeout(() => setHighlightedDlpiId(null), 4000);
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
    if (mapRef.current) return;

    (async () => {
      const L = await import('leaflet');

      const container = L.DomUtil.get('bhumichain-map');
      if (container && (container as any)._leaflet_id) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const map = L.map('bhumichain-map', {
        center: MAP_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 20,
        },
      ).addTo(map);

      mapRef.current = map;

      // If a DLPI is requested, drop a pin marker at a random location in the area
      if (initialDlpiId) {
        const [lat, lng] = getDlpiLocation(initialDlpiId);

        // Red highlighted marker for the target parcel
        const redIcon = L.divIcon({
          html: `<div style="
            width: 32px; height: 32px;
            background: #DC2626;
            border: 3px solid #fff;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          "></div>`,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -36],
        });

        const marker = L.marker([lat, lng], { icon: redIcon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family: system-ui; min-width: 180px;">
              <div style="font-weight:700; font-size:13px; color:#0F4C81; margin-bottom:4px;">📍 ${initialDlpiId}</div>
              <div style="font-size:11px; color:#374151;">Phulwari Sharif Anchal</div>
              <div style="font-size:11px; color:#374151;">Patna District, Bihar</div>
              <div style="font-size:10px; color:#6B7280; margin-top:4px; padding-top:4px; border-top:1px solid #E5E7EB;">
                Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}
              </div>
            </div>`,
            { maxWidth: 240 }
          )
          .openPopup();

        pinMarkerRef.current = marker;
        map.setView([lat, lng], 16);

        // Pulsing circle around the pin
        L.circle([lat, lng], {
          radius: 80,
          color: '#DC2626',
          fillColor: '#FEE2E2',
          fillOpacity: 0.35,
          weight: 2,
          dashArray: '4 4',
        }).addTo(map);

        onParcelSelect?.(initialDlpiId);
      }

      renderGeoJSON(L, map);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-render GeoJSON when filter/search changes ────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    (async () => {
      const L = await import('leaflet');
      renderGeoJSON(L, mapRef.current!);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedDlpiId, filterType, searchQuery]);

  const renderGeoJSON = useCallback(async (L: typeof import('leaflet'), map: LeafletMap) => {
    if (!geojson?.features || !Array.isArray(geojson.features)) return;

    if (geoLayerRef.current) {
      geoLayerRef.current.remove();
    }
    layersByDlpi.current.clear();

    const filtered = geojson.features.filter((f) => {
      if (!f?.properties) return false;
      const p = f.properties;
      if (filterType === 'tribal' && !p.isTribal) return false;
      if (filterType === 'coparcenary' && !p.isCoparcenary) return false;
      if (filterType === 'encumbered' && p.encumbranceStatus === 'CLEAR') return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (p.dlpiId ?? '').toLowerCase().includes(q) ||
          (p.owner ?? '').toLowerCase().includes(q) ||
          (p.surveyNumber ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });

    const layer = L.geoJSON(
      { type: 'FeatureCollection', features: filtered } as GeoJSON.FeatureCollection,
      {
        style: (feature) => {
          const f = feature as GeoFeature;
          if (!f?.properties) return {};
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
          if (!f?.properties) return;
          const dlpiId = f.properties.dlpiId;
          if (!dlpiId) return;
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
              `<div class="text-xs"><strong>${f.properties.owner ?? ''}</strong><br/>${f.properties.dlpiId ?? ''}</div>`,
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

    // Pan to WS-highlighted parcel
    if (highlightedDlpiId) {
      const hlLayer = layersByDlpi.current.get(highlightedDlpiId);
      if (hlLayer && 'getBounds' in hlLayer) {
        map.fitBounds((hlLayer as L.Polygon).getBounds(), { maxZoom: 14, animate: true });
      }
    }
  }, [geojson, filterType, searchQuery, highlightedDlpiId, selectedParcel, onParcelSelect]);

  return (
    <div className="relative w-full h-full">
      {/* Search + filter toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2">
        <input
          type="text"
          placeholder="Search DLPI, owner, survey no..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64 bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-1.5 placeholder-gray-500 focus:outline-none focus:border-[#0F4C81]/60"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#0F4C81]/60"
        >
          <option value="all">All Parcels</option>
          <option value="coparcenary">Coparcenary</option>
          <option value="encumbered">Encumbered</option>
        </select>
      </div>

      {/* Pinned DLPI banner */}
      {initialDlpiId && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
          <span className="w-2 h-2 rounded-full bg-red-300 animate-pulse" />
          Pinpointed: {initialDlpiId} — Phulwari Sharif, Patna
        </div>
      )}

      {/* Leaflet map container */}
      <div id="bhumichain-map" className="w-full h-full" />

      {/* Legend */}
      <MapLegend stats={stats} />

      {/* Selected parcel panel */}
      {selectedParcel && (
        <div className="absolute top-4 right-4 z-[1000] card w-80 shadow-2xl animate-slide-up overflow-y-auto max-h-[80vh]">
          <button
            onClick={() => setSelectedParcel(null)}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-600 text-lg leading-none"
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
    case 'HeirNotificationRequired': return `⚖️ Succession initiated — 3 heirs notified`;
    case 'AllHeirsConsented': return `✅ All heirs consented — mutation executing`;
    case 'DakhilKharijInitiated': return `⚠️ Mutation alert sent in 64 seconds`;
    case 'SuccessionDisputeFiled': return `⚖️ Dispute filed — case referred to court`;
    default: return null;
  }
}
