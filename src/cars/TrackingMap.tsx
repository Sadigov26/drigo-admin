import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Point, TrackedCar } from './telematicsApi';

export function markerColor(car: TrackedCar) {
  if (car.status === 'Inactive' || !car.online) return '#68717b';
  if (car.fuelLevel < 20) return '#a77710';
  return car.status === 'Rented' ? '#345f8b' : '#28623b';
}
export function TrackingMap({ cars, selected, points, onSelect }: { cars: TrackedCar[]; selected: number | null; points: Point[]; onSelect: (id: number) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const route = useRef<L.Polyline | null>(null);
  const fitted = useRef(false);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, { scrollWheelZoom: false }).setView([25.2048, 55.2708], 10);
    map.current = instance;
    // Only base tiles go to OpenStreetMap; vehicle labels and routes stay in the browser.
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(instance);
    tiles.on('tileerror', () => setTileError(true));
    markers.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; markers.current = null; route.current = null; fitted.current = false; };
  }, []);
  useEffect(() => {
    if (!map.current || !markers.current) return;
    markers.current.clearLayers();
    cars.forEach(car => {
      const content = document.createElement('div');
      const heading = document.createElement('strong'); heading.textContent = car.plateNumber;
      const description = document.createElement('p'); description.textContent = `${car.brandName} ${car.modelName} · ${car.status} · ${car.online ? 'Online' : 'Offline'} · Fuel ${Math.round(car.fuelLevel)}% · ${Math.round(car.speed)} km/h`;
      content.append(heading, description);
      const marker = L.circleMarker([car.latitude, car.longitude], { radius: car.id === selected ? 10 : 7, color: markerColor(car), fillColor: markerColor(car), fillOpacity: .85, weight: car.id === selected ? 4 : 2 }).bindPopup(content, { maxWidth: 220, keepInView: true }).addTo(markers.current!);
      marker.on('click', () => onSelect(car.id));
      if (car.id === selected) marker.openPopup();
    });
    if (!fitted.current && cars.length) {
      map.current.fitBounds(L.latLngBounds(cars.map(car => [car.latitude, car.longitude] as L.LatLngTuple)), { padding: [35, 35], maxZoom: 14 });
      fitted.current = true;
    }
  }, [cars, selected, onSelect]);
  useEffect(() => {
    if (!map.current) return;
    route.current?.remove(); route.current = null;
    if (points.length) {
      route.current = L.polyline(points.map(point => [point.latitude, point.longitude] as L.LatLngTuple), { color: '#6f4b94', weight: 4 }).addTo(map.current);
      map.current.fitBounds(route.current.getBounds(), { padding: [45, 45], maxZoom: 15 });
    }
  }, [points]);
  return <><div ref={container} className="tracking-map" role="region" aria-label="Vehicle tracking map" />{tileError && <p role="status" className="car-note">Some map tiles could not load. Vehicle coordinates remain available in the list.</p>}</>;
}
