'use client';

import React, { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';

// ─── Synthetic fraud risk dataset ─────────────────────────────────────────────
// Spread across Nashik district (approx 19.5–20.5°N, 73.4–74.6°E)

type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

interface RiskPoint {
  lat: number;
  lng: number;
  dlpiId: string;
  fraudScore: number;
  level: RiskLevel;
  type: string;
}

const RISK_POINTS: RiskPoint[] = [
  // HIGH risk — dual-sale / benami
  { lat: 19.883, lng: 74.016, dlpiId: 'DLPI-MH-NSK-01832', fraudScore: 0.94, level: 'HIGH', type: 'Dual-sale attempt blocked' },
  { lat: 20.023, lng: 73.912, dlpiId: 'DLPI-MH-NSK-02891', fraudScore: 0.87, level: 'HIGH', type: 'Benami suspect — 5 parcels same owner' },
  { lat: 19.742, lng: 73.915, dlpiId: 'DLPI-MH-IGT-04421', fraudScore: 0.91, level: 'HIGH', type: 'Tribal land illegal transfer attempt' },
  { lat: 20.156, lng: 74.212, dlpiId: 'DLPI-MH-DIN-00892', fraudScore: 0.88, level: 'HIGH', type: 'Forged document detected — RecordScan' },
  { lat: 19.621, lng: 73.762, dlpiId: 'DLPI-MH-NSK-03312', fraudScore: 0.92, level: 'HIGH', type: 'Price under-declaration ×3' },
  { lat: 20.289, lng: 74.112, dlpiId: 'DLPI-MH-NIK-01223', fraudScore: 0.85, level: 'HIGH', type: 'Ghost record — no occupant 8 years' },
  { lat: 19.812, lng: 74.389, dlpiId: 'DLPI-MH-DIN-00554', fraudScore: 0.89, level: 'HIGH', type: 'Succession bypassed — direct transfer' },
  // MEDIUM risk
  { lat: 19.998, lng: 73.790, dlpiId: 'DLPI-MH-SNN-00142', fraudScore: 0.12, level: 'LOW', type: 'Demo parcel — CLEAN' },
  { lat: 20.301, lng: 73.856, dlpiId: 'DLPI-MH-NSK-04512', fraudScore: 0.71, level: 'MEDIUM', type: 'Valuation gap > 40%' },
  { lat: 19.912, lng: 73.634, dlpiId: 'DLPI-MH-IGT-02211', fraudScore: 0.68, level: 'MEDIUM', type: 'Mutation objection pending 45 days' },
  { lat: 20.089, lng: 74.356, dlpiId: 'DLPI-MH-DIN-01122', fraudScore: 0.74, level: 'MEDIUM', type: 'IT attachment — under review' },
  { lat: 19.678, lng: 74.023, dlpiId: 'DLPI-MH-NSK-05002', fraudScore: 0.62, level: 'MEDIUM', type: 'Double mortgage attempt' },
  { lat: 20.445, lng: 73.923, dlpiId: 'DLPI-MH-NIK-02341', fraudScore: 0.69, level: 'MEDIUM', type: 'FRA claim vs DLPI ownership conflict' },
  { lat: 19.556, lng: 73.889, dlpiId: 'DLPI-MH-NSK-00912', fraudScore: 0.75, level: 'MEDIUM', type: 'NRI transfer without FEMA clearance' },
  { lat: 20.178, lng: 73.678, dlpiId: 'DLPI-MH-IGT-03312', fraudScore: 0.67, level: 'MEDIUM', type: 'Survey boundary dispute flagged' },
  { lat: 19.834, lng: 74.156, dlpiId: 'DLPI-MH-NSK-02212', fraudScore: 0.72, level: 'MEDIUM', type: 'Janganana mismatch — occupant ≠ DLPI owner' },
  { lat: 20.367, lng: 74.289, dlpiId: 'DLPI-MH-DIN-02891', fraudScore: 0.63, level: 'MEDIUM', type: 'Stamp duty under-declaration' },
  // LOW risk (monitoring)
  { lat: 20.012, lng: 74.089, dlpiId: 'DLPI-MH-NSK-03412', fraudScore: 0.38, level: 'LOW', type: 'Minor annotation anomaly' },
  { lat: 19.745, lng: 73.689, dlpiId: 'DLPI-MH-IGT-T0023', fraudScore: 0.05, level: 'LOW', type: 'Tribal parcel — protected (CLEAN)' },
  { lat: 20.223, lng: 73.812, dlpiId: 'DLPI-MH-NSK-04122', fraudScore: 0.41, level: 'LOW', type: 'Heir notification pending 12 days' },
  { lat: 19.934, lng: 74.234, dlpiId: 'DLPI-MH-DIN-00334', fraudScore: 0.33, level: 'LOW', type: 'Old survey record not yet digitised' },
  { lat: 20.134, lng: 73.534, dlpiId: 'DLPI-MH-NIK-00892', fraudScore: 0.45, level: 'LOW', type: 'Court case — pending' },
  { lat: 19.612, lng: 74.312, dlpiId: 'DLPI-MH-NSK-05512', fraudScore: 0.29, level: 'LOW', type: 'Encumbrance released — monitoring' },
  { lat: 20.489, lng: 74.089, dlpiId: 'DLPI-MH-NIK-03312', fraudScore: 0.42, level: 'LOW', type: 'Coparcenary without legal heir eSign' },
  { lat: 19.789, lng: 73.456, dlpiId: 'DLPI-MH-NSK-01123', fraudScore: 0.36, level: 'LOW', type: 'PM Kisan eligibility review' },
];

const RISK_COLOR: Record<RiskLevel, string> = {
  HIGH:   '#ef4444',
  MEDIUM: '#f59e0b',
  LOW:    '#22c55e',
};

const NASHIK_CENTER: [number, number] = [20.0, 73.95];

// ─── Component ────────────────────────────────────────────────────────────────

export default function FraudHeatmap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current || mapRef.current) return;

    // Dynamic import — Leaflet must only run client-side
    import('leaflet').then((L) => {
      if (!containerRef.current || (containerRef.current as any)._leaflet_id) return;
      // Fix default icon
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, {
        center: NASHIK_CENTER,
        zoom: 10,
        zoomControl: true,
        attributionControl: false,
      });
      mapRef.current = map;

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { maxZoom: 18 },
      ).addTo(map);

      // Plot risk points as circle markers
      for (const pt of RISK_POINTS) {
        const radius     = pt.level === 'HIGH' ? 14 : pt.level === 'MEDIUM' ? 10 : 7;
        const fillOpacity = pt.level === 'HIGH' ? 0.80 : pt.level === 'MEDIUM' ? 0.65 : 0.50;

        const circle = L.circleMarker([pt.lat, pt.lng], {
          radius,
          fillColor:   RISK_COLOR[pt.level],
          color:       pt.level === 'HIGH' ? '#ffffff' : RISK_COLOR[pt.level],
          weight:      pt.level === 'HIGH' ? 1.5 : 0.8,
          opacity:     1,
          fillOpacity,
        }).addTo(map);

        circle.bindPopup(`
          <div style="font-family:monospace;font-size:11px;color:#f3f4f6;min-width:200px">
            <div style="font-weight:bold;margin-bottom:4px;color:${RISK_COLOR[pt.level]}">
              ${pt.level} RISK
            </div>
            <div style="color:#9ca3af;margin-bottom:2px">${pt.dlpiId}</div>
            <div style="margin-bottom:4px">${pt.type}</div>
            <div style="color:#6b7280">
              FraudSense: <span style="color:${RISK_COLOR[pt.level]};font-weight:bold">${pt.fraudScore.toFixed(2)}</span>
            </div>
          </div>
        `);
      }

      // Nashik city label
      L.marker(NASHIK_CENTER, {
        icon: L.divIcon({
          html: '<div style="color:#9ca3af;font-size:11px;font-family:sans-serif;white-space:nowrap">Nashik District</div>',
          className: '',
          iconAnchor: [30, 0],
        }),
      }).addTo(map);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" />;
}
