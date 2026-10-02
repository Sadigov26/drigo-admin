import { useCallback, useState } from 'react';
import { getHistoryRoutes, getHistoryPoints } from './telematicsApi';
import { useVehicleResource } from './useVehicleResource';
import { TrackingMap } from './TrackingMap';
import { EmptyState, ErrorState, LoadingState } from '../components/States';

function JourneyMap({ routeId }: { routeId: number }) {
  const load = useCallback((signal: AbortSignal) => getHistoryPoints(routeId, signal), [routeId]);
  const state = useVehicleResource(load);
  return state.loading ? <LoadingState message="Loading journey…" /> : state.error ? <ErrorState message={state.error} onRetry={state.refresh} /> : state.data?.length ? <TrackingMap cars={[]} selected={null} points={state.data} onSelect={() => {}} /> : <EmptyState message="No points for this journey." />;
}
export default function CarJourneys({ carId }: { carId: number }) {
  const load = useCallback((signal: AbortSignal) => getHistoryRoutes(carId, signal), [carId]);
  const state = useVehicleResource(load);
  const [selected, setSelected] = useState<number | null>(null);
  return <section className="vehicle-controls"><div className="vehicle-section-heading"><h3>Previous journeys</h3><button disabled={state.loading} onClick={() => { setSelected(null); state.refresh(); }}>Refresh journeys</button></div>
    {state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={state.refresh} /> : state.data?.length ? <><div className="table-scroll" role="region" aria-label="Previous journeys" tabIndex={0}><table><thead><tr><th>Journey</th><th>Date · Dubai</th><th>From</th><th>To</th><th>Distance</th><th>Duration</th></tr></thead><tbody>{state.data.map(row => <tr key={row.routeId}><td><button aria-pressed={selected === row.routeId} onClick={() => setSelected(row.routeId)}>#{row.routeId}</button></td><td>{new Date(row.date).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}</td><td>{row.startAddress}</td><td>{row.endAddress}</td><td>{row.distanceKm} km</td><td>{row.durationMin} min</td></tr>)}</tbody></table></div>{selected !== null && <JourneyMap key={selected} routeId={selected} />}</> : <EmptyState message="No previous journeys available." />}
  </section>;
}
