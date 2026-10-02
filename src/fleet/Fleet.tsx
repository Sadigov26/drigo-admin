import Parking from './Parking';
import { lazy, Suspense, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usePromotionData as useData } from '../promotions/usePromotionData';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { object, read, rows, type Row } from './fleetApi';
import { Fields, Records, label } from './FleetShared';
import { ResourceList } from './ResourceList';
import './fleet.css';
const GeoMap = lazy(() => import('./GeoMap'));
function Chart({ data, x, series }: { data: Row[]; x: string; series: string[] }) {
  if (!data.length) return <EmptyState message="No chart data available." />;
  return <div className="fleet-chart"><ResponsiveContainer width="100%" height={300} minWidth={0}><BarChart data={data} accessibilityLayer><CartesianGrid vertical={false} stroke="#e3eaf1" /><XAxis dataKey={x} fontSize={12} /><YAxis /><Tooltip /><Legend />{series.map((key, i) => <Bar key={key} dataKey={key} name={label(key)} fill={['#315d88', '#43836c'][i % 2]} />)}</BarChart></ResponsiveContainer></div>;
}
function Plan() {
  const state = useData(useCallback(async (signal: AbortSignal) => { const row = object(await read('fleetplan', signal)); return { updatedAt: row.updatedAt, targets: rows(row.targets) }; }, []));
  return <section className="fleet-panel"><div className="fleet-heading"><h2>Fleet allocation by city</h2><button onClick={state.refresh} disabled={state.loading}>Refresh</button></div>{state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={state.refresh} /> : state.data && <><Fields row={{ updatedAt: state.data.updatedAt }} /><Chart data={state.data.targets} x="city" series={['targetCars', 'currentCars']} /><Records title="Fleet plan" keys={['city', 'targetCars', 'currentCars']} data={state.data.targets} loading={false} error={null} refresh={state.refresh} /></>}</section>;
}
function Utilization() {
  const state = useData(useCallback(async (signal: AbortSignal) => object(await read('fleet-utilization/summary', signal)), []));
  return <><section className="fleet-panel"><div className="fleet-heading"><h2>Fleet utilization</h2><button disabled={state.loading} onClick={state.refresh}>Refresh summary</button></div><p className="fleet-note">“Active cars” means currently rented cars. “Idle cars” includes every other car, even deactivated vehicles. Revenue and distance are cumulative.</p>{state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={state.refresh} /> : state.data && <><Fields row={state.data} /><Chart data={[{ group: 'Vehicles', currentlyRented: state.data.activeCars, otherCars: state.data.idleCars }]} x="group" series={['currentlyRented', 'otherCars']} /></>}</section>
    <ResourceList title="Utilization by car" path="fleet-utilization/by-car" keys={['plateNumber', 'carName', 'currentlyRented', 'rentalCount', 'totalDistance', 'revenue']} />
    <ResourceList title="Distance" path="fleet-utilization/distance" keys={['plateNumber', 'odometer', 'rentedDistance']} note="Showing the first 40 vehicles only." />
    <ResourceList title="Fuel" path="fleet-utilization/fuel" keys={['plateNumber', 'fuelType', 'fuelLevel', 'tankCapacity']} note="Showing the first 40 vehicles only. Fuel levels are rounded for display." />
  </>;
}
const tabs = ['Plan', 'Moves', 'Utilization', 'Geo zones', 'Parking cards', 'Parking zones', 'Gas stations'];
export default function Fleet() {
  const [params, setParams] = useSearchParams(), tab = tabs.includes(params.get('view') ?? '') ? params.get('view')! : tabs[0];
  return <div className="fleet-module"><header className="fleet-banner"><h1>Fleet & Geo</h1><p>Vehicle allocation, utilization and operating areas</p></header><div className="fleet-tabs" aria-label="Fleet views">{tabs.map(name => <button key={name} aria-pressed={tab === name} onClick={() => setParams({ view: name })}>{name}</button>)}</div>
    <div key={tab}>{tab === 'Plan' ? <Plan /> : tab === 'Moves' ? <ResourceList title="Fleet moves" path="fleet-moves" keys={['plateNumber', 'fromCity', 'toCity', 'status', 'assignedTo', 'scheduledAt']} /> : tab === 'Utilization' ? <Utilization /> : tab === 'Geo zones' ? <ResourceList title="Geo zones" path="geozones" keys={['name', 'type', 'isActive', 'color', 'createdAt']} editable note="Define the zone boundary on the map.">{data => data.length ? <Suspense fallback={<LoadingState />}><GeoMap rows={data} /></Suspense> : null}</ResourceList> : tab === 'Parking cards' ? <Parking /> : tab === 'Parking zones' ? <ResourceList title="Parking zones" path="parkingZones" keys={['name', 'latitude', 'longitude', 'radiusMeters', 'isFree']} /> : <ResourceList title="Gas stations" path="gasStations" keys={['name', 'brand', 'latitude', 'longitude']} />}</div>
  </div>;
}
