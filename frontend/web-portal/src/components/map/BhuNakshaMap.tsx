'use client';

import React, { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Parcel {
  dlpiId: string;
  khataNo: string;
  khasraNo: string;
  tehsil: string;
  district: string;
  state: string;
  landType: string;
  areaHectares: number;
  ownerName: string;
  latitude: number;
  longitude: number;
}

interface Props {
  parcels: Parcel[];
  selectedParcelId?: string | null;
}

export default function BhuNakshaMap({ parcels, selectedParcelId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());

  // 1. Initialize Map
  useEffect(() => {
    let mapInstance: LeafletMap | null = null;

    (async () => {
      if (typeof window === 'undefined' || !containerRef.current) return;
      
      const L = await import('leaflet');

      // Setup default marker shadows
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      if (mapRef.current) return;

      // Center around Phulwari Sharif, Patna, Bihar
      mapInstance = L.map(containerRef.current, {
        center: [25.5500, 85.0800],
        zoom: 13,
        zoomControl: true,
      });

      // Light, professional theme
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(mapInstance);

      mapRef.current = mapInstance;
    })();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 2. Render and Update Markers when parcels or selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    (async () => {
      const L = await import('leaflet');

      // Define Red & Blue Icons
      const blueIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
        iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      const redIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      // Clear existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      if (!parcels || parcels.length === 0) return;

      let targetMarker: LeafletMarker | null = null;
      let bounds: any[] = [];

      parcels.forEach((p) => {
        if (!p.latitude || !p.longitude) return;

        const isSelected = p.dlpiId === selectedParcelId;
        const marker = L.marker([p.latitude, p.longitude], {
          icon: isSelected ? redIcon : blueIcon,
          zIndexOffset: isSelected ? 1000 : 0
        });

        // Set detailed popup
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 11px; line-height: 1.4;">
            <div style="font-weight: bold; font-size: 12px; color: #0F4C81; margin-bottom: 4px;">Bhu-Naksha Parcel Info</div>
            <div><strong>ID:</strong> <span style="font-family: monospace;">${p.dlpiId}</span></div>
            <div><strong>Khata No:</strong> ${p.khataNo}</div>
            <div><strong>Khasra (Plot) No:</strong> ${p.khasraNo}</div>
            <div><strong>Land Type:</strong> ${p.landType}</div>
            <div><strong>Area:</strong> ${p.areaHectares} Hectares</div>
            <div style="margin-top: 4px; border-t: 1px solid #eee; pt: 4px;"><strong>Owner:</strong> ${p.ownerName}</div>
          </div>
        `);

        marker.addTo(map);
        markersRef.current.set(p.dlpiId, marker);
        bounds.push([p.latitude, p.longitude]);

        if (isSelected) {
          targetMarker = marker;
        }
      });

      // Auto-focus and open popup on selection
      if (targetMarker) {
        const marker = targetMarker as LeafletMarker;
        const coords = marker.getLatLng();
        map.setView(coords, 15, { animate: true });
        marker.openPopup();
      } else if (bounds.length > 0) {
        // Zoom map to fit all returned blue markers
        map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 14 });
      }
    })();
  }, [parcels, selectedParcelId]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-gray-200 shadow-inner">
      <div ref={containerRef} className="w-full h-full min-h-[500px]" id="bhu-naksha-map-instance" />
    </div>
  );
}
