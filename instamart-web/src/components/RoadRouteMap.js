import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export const HUB_LOCATION = { lat: 20.2961, lng: 85.8245, label: 'Camigo Hub' };
const FALLBACK_CUSTOMER = { lat: 20.3059, lng: 85.8574, label: 'Customer' };
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const makeIcon = (className) => L.divIcon({
  className: `route-div-icon ${className}`,
  html: '<span></span>',
  iconSize: [54, 42],
  iconAnchor: [27, 21]
});

function RoadRouteMap({ partnerLocation, customerLocation, destination = 'customer', compact = false, onRoute }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const routeRef = useRef(null);
  const markersRef = useRef([]);
  const [hub, setHub] = useState(HUB_LOCATION);

  useEffect(() => {
    fetch(`${API_URL}/hubs/active`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.lat && data?.lng) setHub({ lat: Number(data.lat), lng: Number(data.lng), label: data.name || 'Camigo Hub' });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;

    mapRef.current = L.map(mapEl.current, {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true
    }).setView([hub.lat, hub.lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(mapRef.current);

    setTimeout(() => mapRef.current?.invalidateSize(), 250);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const start = partnerLocation?.lat && partnerLocation?.lng
      ? { lat: Number(partnerLocation.lat), lng: Number(partnerLocation.lng), label: 'Partner' }
      : hub;
    const customerEnd = customerLocation?.lat && customerLocation?.lng
      ? { lat: Number(customerLocation.lat), lng: Number(customerLocation.lng), label: 'Customer' }
      : FALLBACK_CUSTOMER;
    const end = destination === 'hub' ? hub : customerEnd;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [
      L.marker([hub.lat, hub.lng], { icon: makeIcon('hub-route-icon') }).addTo(map).bindTooltip(hub.label || 'Camigo Hub'),
      destination !== 'hub' && L.marker([customerEnd.lat, customerEnd.lng], { icon: makeIcon('home-route-icon') }).addTo(map).bindTooltip('Delivery address'),
      L.marker([start.lat, start.lng], { icon: makeIcon('partner-route-icon') }).addTo(map).bindTooltip('Delivery partner live location')
    ];
    markersRef.current = markersRef.current.filter(Boolean);

    const fallbackLine = [[start.lat, start.lng], [20.3012, 85.8399], [20.3094, 85.8464], [end.lat, end.lng]];
    const drawRoute = (latLngs, info = null) => {
      if (routeRef.current) routeRef.current.remove();
      routeRef.current = L.polyline(latLngs, {
        color: '#1455ff',
        weight: 7,
        opacity: 0.92,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      L.polyline(latLngs, {
        color: '#ffffff',
        weight: 11,
        opacity: 0.6,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map).bringToBack();
      map.fitBounds(routeRef.current.getBounds(), { padding: [34, 34] });
      setTimeout(() => map.invalidateSize(), 50);
      if (onRoute) onRoute(info || { distanceKm: 4.2, durationMin: 18, fallback: true });
    };

    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=false`;
    fetch(url)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const route = data?.routes?.[0];
        const coords = route?.geometry?.coordinates;
        if (!Array.isArray(coords) || !coords.length) {
          drawRoute(fallbackLine);
          return;
        }
        drawRoute(coords.map(([lng, lat]) => [lat, lng]), {
          distanceKm: route.distance / 1000,
          durationMin: Math.max(1, Math.round(route.duration / 60))
        });
      })
      .catch(() => drawRoute(fallbackLine));
  }, [partnerLocation?.lat, partnerLocation?.lng, customerLocation?.lat, customerLocation?.lng, destination, hub.lat, hub.lng, hub.label, onRoute]);

  return <div className={compact ? 'road-route-map compact' : 'road-route-map'} ref={mapEl} />;
}

export default RoadRouteMap;
