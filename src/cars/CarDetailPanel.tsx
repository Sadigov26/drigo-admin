import { lazy, Suspense } from 'react';
import { CarDetails } from './CarDetails';
import type { CarDetail } from './carsApi';
import { VehicleControls } from './VehicleControls';
import { LoadingState } from '../components/States';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import './telematics.css';
const CarRoute = lazy(() => import('./CarRoute'));
export type CarTab = 'summary' | 'status' | 'route' | 'technical';
const tabs: { key: CarTab; label: string; icon: IconName }[] = [
  { key: 'summary', label: 'Summary', icon: 'car' }, { key: 'status', label: 'Vehicle status', icon: 'power' },
  { key: 'route', label: 'GPS route', icon: 'map' }, { key: 'technical', label: 'Technical details', icon: 'settings' },
];
export function CarDetailPanel({ car, tab, onTab, onChanged, busy, onBusy }: { car: CarDetail; tab: CarTab; onTab: (tab: CarTab) => void; onChanged: () => void; busy: boolean; onBusy: (busy: boolean) => void }) {
  return <div className="car-detail-panel">
    <nav className="car-detail-tabs" aria-label="Car detail views">{tabs.map(item => <button key={item.key} disabled={busy} aria-pressed={tab === item.key} onClick={() => onTab(item.key)}><Icon name={item.icon} />{item.label}</button>)}</nav>
    {tab === 'summary' && <CarDetails car={car} />}
    {tab === 'technical' && <CarDetails car={car} technical />}
    {tab === 'status' && <VehicleControls carId={car.id} onChanged={onChanged} onBusy={onBusy} />}
    {tab === 'route' && <Suspense fallback={<LoadingState message="Loading map…" />}><CarRoute carId={car.id} /></Suspense>}
  </div>;
}
