import type { KpiKey, Kpis } from './dashboardApi';

type Metric = { key: KpiKey | 'customerDebt' | 'companyDebt'; label: string; unit?: 'AED' | 'hours' };
const primary: Metric[] = [
  { key: 'activeRentals', label: 'Active rentals' },
  { key: 'todayRevenue', label: 'Revenue today', unit: 'AED' },
  { key: 'monthlyRevenue', label: 'Revenue this month', unit: 'AED' },
  { key: 'totalDebt', label: 'Outstanding debt', unit: 'AED' },
];
const groups: { title: string; metrics: Metric[] }[] = [
  { title: 'Operations', metrics: [
    { key: 'totalCars', label: 'Cars' },
    { key: 'activeReservations', label: 'Active reservations' },
    { key: 'openSupportTickets', label: 'Open support tickets' },
    { key: 'totalDeliveryDrivers', label: 'Delivery drivers' },
    { key: 'onlineDrivers', label: 'Online or busy drivers' },
  ] },
  { title: 'Revenue & debt', metrics: [
    { key: 'totalRevenue', label: 'Revenue, all time', unit: 'AED' },
    { key: 'stripeMonthlyRevenue', label: 'Stripe revenue this month', unit: 'AED' },
    { key: 'stripeTotalRevenue', label: 'Stripe revenue, all time', unit: 'AED' },
    { key: 'customerDebt', label: 'Customer debt', unit: 'AED' },
    { key: 'companyDebt', label: 'Company debt', unit: 'AED' },
  ] },
  { title: 'Members & verification', metrics: [
    { key: 'totalMembers', label: 'Members' },
    { key: 'approvedMembers', label: 'Approved members' },
    { key: 'pendingVerificationCount', label: 'Awaiting verification' },
    { key: 'averageVerificationTimeHours', label: 'Average verification time', unit: 'hours' },
    { key: 'iosUsers', label: 'iOS users' },
    { key: 'androidUsers', label: 'Android users' },
  ] },
];

export function formatMetric(value: number, unit?: Metric['unit']) {
  const number = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: unit === 'AED' ? 2 : 0,
    maximumFractionDigits: unit === 'AED' ? 2 : unit === 'hours' ? 1 : 0,
  }).format(value);
  return unit ? `${number} ${unit}` : number;
}

function Cards({ metrics, data }: { metrics: Metric[]; data: Kpis }) {
  return <dl className="kpi-grid">{metrics.map(metric => {
    const value = metric.key === 'customerDebt' ? data.totalDebtBreakdown.customer
      : metric.key === 'companyDebt' ? data.totalDebtBreakdown.company : data[metric.key];
    return <div className="kpi-card" key={metric.key}>
      <dt>{metric.label}</dt><dd>{formatMetric(value, metric.unit)}</dd>
    </div>;
  })}</dl>;
}

export function KpiCards({ data, detail = false }: { data: Kpis; detail?: boolean }) {
  if (!detail) return <Cards metrics={primary} data={data} />;
  return <div className="kpi-details">{groups.map(group => <section key={group.title} aria-label={group.title}>
    <h2>{group.title}</h2><Cards metrics={group.metrics} data={data} />
  </section>)}</div>;
}
