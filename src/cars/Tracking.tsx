import { useCallback, useState } from 'react';
import { getPoints, getTracking } from './telematicsApi';
import { useVehicleResource } from './useVehicleResource';
import { TrackingMap } from './TrackingMap';
import { VehicleControls } from './VehicleControls';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import type { Point } from './telematicsApi';
const noPoints: Point[] = [];

function SelectedVehicle({ carId, onPoints, onChanged }: { carId: number; onPoints: (points: Point[]) => void; onChanged: () => void }) {
  const load = useCallback(async (signal: AbortSignal) => {
    const points = await getPoints(carId, signal);
    if (!signal.aborted) onPoints(points);
    return points;
  }, [carId, onPoints]);
  const gps = useVehicleResource(load);
  return <>
    <div className="vehicle-section-heading"><h3>GPS history</h3><button disabled={gps.loading} onClick={() => { onPoints(noPoints); gps.refresh(); }}>Refresh route</button></div>
    {gps.loading && <LoadingState message="Loading GPS history…" />}
    {gps.error && <ErrorState message={gps.error} onRetry={gps.refresh} />}
    {gps.data && (gps.data.length ? <p className="car-note">{gps.data.length} points · {new Date(gps.data[0].at).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })} – {new Date(gps.data[gps.data.length - 1].at).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })} (Dubai)</p> : <EmptyState message="No GPS history available." />)}
    <VehicleControls key={carId} carId={carId} onChanged={onChanged} />
  </>;
}
export default function Tracking() {
  const [automatic, setAutomatic] = useState(false);
  const tracking = useVehicleResource(getTracking, automatic);
  const [selected, setSelected] = useState<number | null>(null);
  const [points, setPoints] = useState<Point[]>(noPoints);
  const select = useCallback((id: number) => { if (id !== selected) { setSelected(id); setPoints(noPoints); } }, [selected]);
  const cars = tracking.data ?? [];
  const current = cars.find(car => car.id === selected);
  return <section>
    <div className="vehicle-section-heading"><h2>Live tracking</h2><div className="car-actions"><label><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} /> Auto-refresh · 10s</label><button disabled={tracking.loading} onClick={tracking.refresh}>Refresh tracking</button></div></div>
    {tracking.loading && <LoadingState message="Loading vehicle locations…" />}
    {tracking.error && <ErrorState message={`${tracking.error}${tracking.data ? ' Showing the last successful positions.' : ''}`} onRetry={tracking.refresh} />}
    {tracking.data && !cars.length && <EmptyState message="No active vehicles to track." />}
    {tracking.updatedAt && <p className="car-note">Updated {tracking.updatedAt.toLocaleTimeString('en-GB')}</p>}
    <div className="tracking-legend"><span>● Available</span><span>● Rented</span><span>● Low fuel</span><span>● Offline / inactive</span><span>━ GPS history</span></div>
    <TrackingMap cars={cars} selected={selected} points={points} onSelect={select} />
    <label className="vehicle-picker">Vehicle<select value={selected ?? ''} onChange={event => { if (event.target.value) select(Number(event.target.value)); else { setSelected(null); setPoints(noPoints); } }}><option value="">Select a vehicle</option>{selected != null && !current && <option value={selected}>Vehicle #{selected} · not currently tracked</option>}{cars.map(car => <option key={car.id} value={car.id}>{car.plateNumber} · {car.brandName} {car.modelName}</option>)}</select></label>
    {current && <p className="car-note">{current.latitude.toFixed(6)}, {current.longitude.toFixed(6)} · {current.status} · {Math.round(current.fuelLevel)}% fuel · {Math.round(current.speed)} km/h</p>}
    {selected != null && <SelectedVehicle key={selected} carId={selected} onPoints={setPoints} onChanged={tracking.refresh} />}
  </section>;
}
