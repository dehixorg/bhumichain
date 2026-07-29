'use client';

import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export default function MapPreview() {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mapInstance: any = null;

    (async () => {
      if (typeof window === 'undefined' || !containerRef.current) return;
      
      const L = await import('leaflet');

      // Setup default marker icons for Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      if (mapRef.current) return;

      // Initialize map over Patna (Phulwari Sharif)
      mapInstance = L.map(containerRef.current, {
        center: [28.4744, 77.5040], // Patna coordinates
        zoom: 11,
        zoomControl: true,
      });

      // Use a light, professional map theme
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(mapInstance);

      // Add a couple of sample markers/polygons for visual effect
      L.marker([28.4744, 77.5040]).addTo(mapInstance)
        .bindPopup('<b>BhuNaksha Area</b><br>Patna')
        .openPopup();

      L.circle([28.5355, 77.3910], {
        color: '#0F4C81',
        fillColor: '#FF9933',
        fillOpacity: 0.5,
        radius: 2000
      }).addTo(mapInstance).bindPopup('Sector 15, Phulwari Sharif Parcels');

      mapRef.current = mapInstance;
    })();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full min-h-[300px]" />;
}
