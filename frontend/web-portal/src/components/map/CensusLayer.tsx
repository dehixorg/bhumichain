'use client';

import React, { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';

interface CensusHousehold {
  householdId: string;
  dlpiId: string;
  latitude: number;
  longitude: number;
  anomalyType: string | null;
  anomalySeverity: string | null;
  isFlagged: boolean;
}

interface Props {
  map: LeafletMap | null;
  households: CensusHousehold[];
  visible: boolean;
}

// Severity → marker colour
const SEVERITY_COLOR: Record<string, string> = {
  HIGH:   '#ef4444',
  MEDIUM: '#f59e0b',
  LOW:    '#22c55e',
};

export default function CensusLayer({ map, households, visible }: Props) {
  const layerRef = useRef<import('leaflet').LayerGroup | null>(null);

  useEffect(() => {
    if (!map) return;

    (async () => {
      const L = (await import('leaflet')).default;

      // Remove existing layer
      if (layerRef.current) {
        layerRef.current.remove();
        layerRef.current = null;
      }

      if (!visible) return;

      const group = L.layerGroup();

      households.forEach((hh) => {
        const color = hh.isFlagged
          ? (SEVERITY_COLOR[hh.anomalySeverity || 'LOW'])
          : '#6b7280';

        const marker = L.circleMarker([hh.latitude, hh.longitude], {
          radius: hh.isFlagged ? 6 : 3,
          fillColor: color,
          color: hh.isFlagged ? '#ffffff' : color,
          weight: hh.isFlagged ? 1.5 : 0,
          opacity: 1,
          fillOpacity: hh.isFlagged ? 0.9 : 0.4,
        });

        if (hh.isFlagged) {
          marker.bindPopup(`
            <div style="font-size:12px; color:#f3f4f6">
              <div style="font-weight:600;margin-bottom:4px">Census Anomaly Detected</div>
              <div style="color:#9ca3af;margin-bottom:2px">Household: ${hh.householdId}</div>
              <div style="color:#9ca3af;margin-bottom:2px">DLPI: ${hh.dlpiId}</div>
              <div style="color:${color};font-weight:600">${hh.anomalyType?.replace(/_/g, ' ')} · ${hh.anomalySeverity}</div>
              <div style="color:#6b7280;font-size:10px;margin-top:4px">Janganana 2026-27 GPS cross-reference</div>
            </div>
          `);
        }

        group.addLayer(marker);
      });

      group.addTo(map);
      layerRef.current = group;
    })();
  }, [map, households, visible]);

  return null;
}
