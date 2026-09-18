import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import Cars from './Cars';
import { LoadingState } from '../components/States';
import './telematics.css';
const Tracking = lazy(() => import('./Tracking'));
const Problems = lazy(() => import('./ProblematicCars'));
export default function CarsModule() {
  const [params, setParams] = useSearchParams();
  const requestedView = params.get('view');
  const view = requestedView === 'tracking' || requestedView === 'problems' ? requestedView : 'list';
  function setView(next: string) {
    setParams(previous => {
      const updated = new URLSearchParams(previous);
      if (next === 'list') updated.delete('view'); else updated.set('view', next);
      return updated;
    });
  }
  return <div className="cars-page"><nav className="cars-tabs" aria-label="Cars views">{[['list', 'All cars'], ['tracking', 'Tracking'], ['problems', 'Problematic']].map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}</nav>
    {view === 'list' ? <Cars /> : <><h1 className="vehicle-page-title">Cars</h1><Suspense fallback={<LoadingState message="Loading view…" />}>{view === 'tracking' ? <Tracking /> : <Problems />}</Suspense></>}
  </div>;
}
