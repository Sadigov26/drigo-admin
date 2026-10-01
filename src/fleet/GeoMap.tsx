import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { polygon, type Row } from './fleetApi';
export default function GeoMap({ rows }: { rows: Row[] }) {
  const element = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const valid = rows.flatMap(row => { try { return [{ row, points: polygon(row.polygon) }]; } catch { return []; } });
  useEffect(() => {
    if (!element.current) return;
    const map = L.map(element.current, { scrollWheelZoom: false }).setView([25.2, 55.27], 10);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).on('tileerror', () => setError(true)).addTo(map);
    const bounds: L.LatLngTuple[] = [];
    for (const row of rows) {
      try {
        const points: L.LatLngTuple[] = polygon(row.polygon).map(p => [p.lat, p.lng]);
        const popup = document.createElement('span'); popup.textContent = `${row.name} · ${row.type} · ${row.isActive ? 'Active' : 'Inactive'}`;
        L.polygon(points, { color: /^#[0-9a-f]{6}$/i.test(String(row.color)) ? String(row.color) : '#315d88', fillOpacity: row.isActive ? .2 : .06, dashArray: row.isActive ? undefined : '6 6' }).bindPopup(popup).addTo(map);
        bounds.push(...points);
      } catch { /* Invalid geometry remains visible in record details. */ }
    }
    if (bounds.length) map.fitBounds(bounds, { padding: [20, 20], maxZoom: 13 });
    const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(element.current);
    return () => { observer.disconnect(); map.remove(); };
  }, [rows]);
  return <><div className="fleet-map" ref={element} role="region" aria-label="Geo zone polygons" /><p className="fleet-source">{valid.length} polygons · dashed outline: inactive.{valid.length < rows.length && ` ${rows.length - valid.length} records have invalid geometry; details remain available below.`}</p>{error && <p role="status">Map tiles unavailable. Zone records and coordinates are available below.</p>}</>;
}
