import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { getKpis, getTrends } from './dashboardApi';
import { KpiCards } from './KpiCards';
import { TrendChart } from './TrendChart';
import { useDashboardResource } from './useDashboardResource';
import './dashboard.css';

export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const kpis = useDashboardResource(getKpis, refreshKey);
  const trends = useDashboardResource(getTrends, refreshKey);
  const loading = kpis.state.status === 'loading' || trends.state.status === 'loading';
  return <div className="dashboard">
    <div className="dashboard-heading">
      <div><h1>Dashboard</h1><p className="page-description">Rental operations and revenue</p></div>
      <button type="button" onClick={() => setRefreshKey(value => value + 1)} disabled={loading}>
        {loading ? 'Refreshing…' : 'Refresh dashboard'}
      </button>
    </div>
    <section aria-label="Key figures" aria-busy={kpis.state.status === 'loading'}>
      {kpis.state.status === 'loading' && <LoadingState message="Loading key figures…" />}
      {kpis.state.status === 'error' && <ErrorState message={kpis.state.message} onRetry={kpis.retry} />}
      {kpis.state.status === 'ready' && <>
        <p className="dashboard-updated">Key figures fetched at {kpis.state.loadedAt.toLocaleTimeString('en-GB')} · Amounts in AED</p>
        {kpis.state.data ? <KpiCards data={kpis.state.data} /> : <EmptyState message="No KPI data available." />}
      </>}
    </section>
    <section className="dashboard-trends" aria-label="Trends" aria-busy={trends.state.status === 'loading'}>
      <h2>Daily trends</h2>
      {trends.state.status === 'loading' && <LoadingState message="Loading trends…" />}
      {trends.state.status === 'error' && <ErrorState message={trends.state.message} onRetry={trends.retry} />}
      {trends.state.status === 'ready' && <>
        <p className="dashboard-updated">Trends fetched at {trends.state.loadedAt.toLocaleTimeString('en-GB')} · Dates as supplied by the backend</p>
        <div className="trend-grid">
          <TrendChart title="Revenue" data={trends.state.data.revenue} currency />
          <TrendChart title="New rentals" data={trends.state.data.rentals} />
        </div>
      </>}
    </section>
    {kpis.state.status === 'ready' && kpis.state.data && <KpiCards data={kpis.state.data} detail />}
    <p className="dashboard-note">Percentage changes are not supplied by this API.</p>
  </div>;
}
