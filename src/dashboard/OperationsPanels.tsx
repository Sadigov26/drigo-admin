import type { ReactNode } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import type { Column } from '../components/Table';
import type { Resource } from './useDashboardResource';
import type { Fleet, OnlineUser, RecentActivity, RecentRental, RecentReservation, SupportMessage } from './operationsApi';
import { SnapshotTable } from './SnapshotTable';
import { formatMetric } from './KpiCards';

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dubai' });
function dateCell(value: string | null) { return value ? <time dateTime={value}>{dateFormat.format(new Date(value))}</time> : 'Not provided'; }
function moneyCell(value: number | null) { return value === null ? 'Not provided' : formatMetric(value, 'AED'); }

function Panel<T>({ title, state, retry, children }: { title: string; state: Resource<T>; retry: () => void; children: (data: T) => ReactNode }) {
  return <section className="operations-section" aria-label={title} aria-busy={state.status === 'loading'}>
    <h2>{title}</h2>
    {state.status === 'loading' && <LoadingState message={`Loading ${title.toLowerCase()}…`} />}
    {state.status === 'error' && <ErrorState message={state.message} onRetry={retry} />}
    {state.status === 'ready' && <>
      <p className="dashboard-updated">Fetched at {state.loadedAt.toLocaleTimeString('en-GB')}</p>
      {children(state.data)}
    </>}
  </section>;
}

export function FleetPanel({ state, retry }: { state: Resource<Fleet | null>; retry: () => void }) {
  return <Panel title="Fleet summary" state={state} retry={retry}>{data => data ? <>
    <dl className="fleet-counts">{([
      ['Total', data.total], ['Available', data.available], ['Rented', data.rented],
      ['Inactive', data.inactive], ['Online', data.online], ['Low fuel', data.lowFuel],
    ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value.toLocaleString('en-GB')}</dd></div>)}</dl>
    <h3>By city</h3>
    {data.byCity.length ? <dl className="city-counts">{data.byCity.map((city, index) => <div key={`${city.city}-${index}`}>
      <dt>{city.city}</dt><dd>{city.count.toLocaleString('en-GB')}</dd>
    </div>)}</dl> : <EmptyState message="No city breakdown available." />}
    <p className="dashboard-note">Online and low-fuel counts can overlap other fleet statuses.</p>
  </> : <EmptyState message="No fleet data available." />}</Panel>;
}

const userColumns: Column<OnlineUser>[] = [
  { key: 'fullName', label: 'Customer', sortable: true },
  { key: 'platform', label: 'Platform', sortable: true },
  { key: 'lastLoginAt', label: 'Last login (Dubai)', sortable: true, render: row => dateCell(row.lastLoginAt) },
];
export function OnlineUsersPanel({ state, retry }: { state: Resource<OnlineUser[]>; retry: () => void }) {
  return <Panel title="Online users" state={state} retry={retry}>{data => <>
    <p className="dashboard-note">Up to 50 customers marked online by the backend. Last login is not a live activity timestamp.</p>
    {data.length ? <SnapshotTable title="Online users" rows={data} columns={userColumns} filterKey="platform" filterLabel="Platform" pageSize={10} />
      : <EmptyState message="No customers are currently online." />}
  </>}</Panel>;
}

const rentalColumns: Column<RecentRental>[] = [
  { key: 'id', label: 'Rental', sortable: true }, { key: 'customer', label: 'Customer', sortable: true },
  { key: 'car', label: 'Plate' }, { key: 'status', label: 'Status', render: row => <StatusBadge status={row.status} /> },
  { key: 'startDate', label: 'Started (Dubai)', sortable: true, render: row => dateCell(row.startDate) },
  { key: 'totalPrice', label: 'Total (AED)', sortable: true, render: row => moneyCell(row.totalPrice) },
];
const reservationColumns: Column<RecentReservation>[] = [
  { key: 'id', label: 'Reservation', sortable: true }, { key: 'customer', label: 'Customer', sortable: true },
  { key: 'car', label: 'Plate' }, { key: 'status', label: 'Status', render: row => <StatusBadge status={row.status} /> },
  { key: 'reservationDate', label: 'Reserved (Dubai)', sortable: true, render: row => dateCell(row.reservationDate) },
  { key: 'totalPrice', label: 'Total (AED)', sortable: true, render: row => moneyCell(row.totalPrice) },
];
const messageColumns: Column<SupportMessage>[] = [
  { key: 'supportId', label: 'Ticket', sortable: true }, { key: 'createdBy', label: 'From', sortable: true },
  { key: 'sender', label: 'Sender' }, { key: 'message', label: 'Message', render: row => <span className="support-message">{row.message}</span> },
  { key: 'createdAt', label: 'Sent (Dubai)', sortable: true, render: row => dateCell(row.createdAt) },
];
export function RecentActivityPanel({ state, retry }: { state: Resource<RecentActivity>; retry: () => void }) {
  return <Panel title="Recent activity" state={state} retry={retry}>{data => <>
    <p className="dashboard-note">Up to six records per section, in the order returned by the backend.</p>
    <section aria-label="Recent rentals"><h3>Recent rentals</h3>
      {data.rentals.length ? <SnapshotTable title="Recent rentals" rows={data.rentals} columns={rentalColumns} filterKey="status" filterLabel="Rental status" /> : <EmptyState message="No recent rentals." />}
    </section>
    <section aria-label="Recent reservations"><h3>Recent reservations</h3>
      {data.reservations.length ? <SnapshotTable title="Recent reservations" rows={data.reservations} columns={reservationColumns} filterKey="status" filterLabel="Reservation status" /> : <EmptyState message="No recent reservations." />}
    </section>
    <section aria-label="Recent support messages"><h3>Recent support messages</h3>
      {data.messages.length ? <SnapshotTable title="Recent support messages" rows={data.messages} columns={messageColumns} filterKey="sender" filterLabel="Sender type" /> : <EmptyState message="No recent support messages." />}
    </section>
  </>}</Panel>;
}
