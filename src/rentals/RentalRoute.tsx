import { useCallback } from 'react';
import { getRoute } from './rentalsApi';
import { useVehicleResource } from '../cars/useVehicleResource';
import { TrackingMap } from '../cars/TrackingMap';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import type { TrackedCar } from '../cars/telematicsApi';
import '../cars/telematics.css';
const cars: TrackedCar[] = [];
const ignore = () => {};
export default function RentalRoute({ rentalId }: { rentalId: number }) {
  const load = useCallback((signal: AbortSignal) => getRoute(rentalId, signal), [rentalId]);
  const route = useVehicleResource(load);
  return <section><button disabled={route.loading} onClick={route.refresh}>Refresh route</button>
    {route.loading ? <LoadingState /> : route.error ? <ErrorState message={route.error} onRetry={route.refresh} /> : route.data?.points.length ? <><p className="rental-note">Distance: {route.data.distance == null ? '—' : `${route.data.distance.toFixed(1)} km`}</p><TrackingMap cars={cars} selected={null} points={route.data.points} onSelect={ignore} /></> : <EmptyState message="No route points available." />}
  </section>;
}
