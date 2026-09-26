import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Row } from './deliveryApi';

export function point(lat: unknown, lng: unknown): L.LatLngTuple | null {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null;
}
export default function DeliveryMap({ rows }: { rows: Row[] }) {
  const container = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null), layer = useRef<L.LayerGroup | null>(null);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, { scrollWheelZoom: false }).setView([25.2048, 55.2708], 10);
    map.current = instance;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).on('tileerror', () => setTileError(true)).addTo(instance);
    layer.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize()); observer.observe(container.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; layer.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const bounds: L.LatLngTuple[] = [];
    rows.forEach(row => {
      const driver = point(row.driverLat, row.driverLng), destination = point(row.deliveryLat, row.deliveryLng);
      const coordinates = driver ?? destination;
      if (!coordinates) return;
      bounds.push(coordinates);
      const popup = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = `#${row.id} · ${row.plateNumber ?? '—'}`;
      const description = document.createElement('p'); description.textContent = `${row.driverName ?? 'No assigned driver'} · ${row.status ?? '—'} · ${driver ? 'Driver position' : 'Delivery destination (driver position unavailable)'}`;
      popup.append(title, description);
      L.circleMarker(coordinates, { color: driver ? '#315d88' : '#a77710', radius: 8, fillOpacity: .85 }).bindPopup(popup).addTo(layer.current!);
    });
    if (bounds.length) map.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 14 });
  }, [rows]);
  const missing = rows.filter(row => !point(row.driverLat, row.driverLng) && !point(row.deliveryLat, row.deliveryLng)).length;
  return <><div className="delivery-map" ref={container} role="region" aria-label="Active deliveries map" /><p className="delivery-map-key">Blue: driver position · Amber: delivery destination when driver position is unavailable.{missing > 0 && ` ${missing} deliveries have no usable coordinates; see the list below.`}</p>{tileError && <p role="status">Map tiles could not load. Delivery records remain available below.</p>}</>;
}
