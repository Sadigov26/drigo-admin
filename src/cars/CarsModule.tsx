import { lazy, Suspense, useState } from 'react';
import Cars from './Cars';
import { LoadingState } from '../components/States';
import './telematics.css';
const Tracking = lazy(() => import('./Tracking'));
const Problems = lazy(() => import('./ProblematicCars'));
export default function CarsModule() {
  const [view, setView] = useState('list');
  return <div className="cars-page"><nav className="cars-tabs" aria-label="Cars views">{[['list', 'All cars'], ['tracking', 'Tracking'], ['problems', 'Problematic']].map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}</nav>
    {view === 'list' ? <Cars /> : <><h1 className="vehicle-page-title">Cars</h1><Suspense fallback={<LoadingState message="Loading view…" />}>{view === 'tracking' ? <Tracking /> : <Problems />}</Suspense></>}
  </div>;
}
