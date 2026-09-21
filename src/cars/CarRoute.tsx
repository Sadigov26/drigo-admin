import { useCallback } from 'react';
import { getPoints } from './telematicsApi';
import { useVehicleResource } from './useVehicleResource';
import { TrackingMap } from './TrackingMap';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import type { TrackedCar } from './telematicsApi';
import { Icon } from '../components/Icon';

const noCars: TrackedCar[] = [];
const ignoreSelection = () => {};

export default function CarRoute({ carId }: { carId: number }) {
  const load = useCallback((signal: AbortSignal) => getPoints(carId, signal), [carId]);
  const route = useVehicleResource(load);
  return <section className="vehicle-controls">
    <div className="vehicle-section-heading"><h3>GPS route</h3><button disabled={route.loading} onClick={route.refresh}><Icon name="refresh" />Refresh route</button></div>
    {route.loading && <LoadingState message="Loading GPS history…" />}
    {route.error && <ErrorState message={route.error} onRetry={route.refresh} />}
    {!route.loading && !route.error && route.data && (route.data.length
      ? <><p className="car-note">{route.data.length} GPS points</p><TrackingMap cars={noCars} selected={null} points={route.data} onSelect={ignoreSelection} /></>
      : <EmptyState message="No GPS history available." />)}
  </section>;
}
