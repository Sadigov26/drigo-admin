import { useCallback, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Table, type Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { usePromotionData as useData } from '../promotions/usePromotionData';
import { array, at, getReport, grouped, monthDetail, monthly, monthlySeries, object, points, transactions, type Row, type Series } from './analyticsApi';
import './analytics.css';

const number = (value: unknown, unit = '') => typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: unit === 'AED' ? 2 : 0 })}${unit ? ` ${unit}` : ''}` : '—';
const label = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
function Fields({ row, prefix = '' }: { row: Row; prefix?: string }) {
  return <dl className="analytics-fields">{Object.entries(row).map(([key, value]) => {
    const path = prefix + key;
    const monetary = /revenue|cost|amount|bonus|billedTotal|debt\.(added|collected|unpaid)$|salik\.(total|billed)$|enoc\.total$|totals\.(salik|enoc|finesBilled|debtCollected)$/i.test(path) && !/currency/i.test(path);
    return <div key={key} className={value && typeof value === 'object' ? 'analytics-wide' : ''}><dt>{label(key)}</dt><dd>{value == null ? '—' : Array.isArray(value) ? value.length ? value.map((item, i) => <Fields key={i} row={object(item)} prefix={path + '.'} />) : 'No records' : typeof value === 'object' ? <Fields row={value as Row} prefix={path + '.'} /> : typeof value === 'number' ? number(value, monetary ? 'AED' : /rate/i.test(key) ? '%' : /liters/i.test(key) ? 'L' : /Km$/.test(key) ? 'km' : '') : typeof value === 'boolean' ? value ? 'Yes' : 'No' : /Date$|At$/.test(key) ? new Date(String(value)).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' }) : String(value)}</dd></div>;
  })}</dl>;
}
const palette = ['#315d88', '#447b67', '#b77922', '#8b5cb4', '#b44455'];
function Chart({ data, x, series, unit = '', bar = false }: { data: Row[]; x: string; series: Series[]; unit?: string; bar?: boolean }) {
  if (!data.length) return <EmptyState message="No chart data available." />;
  const marks = <><CartesianGrid stroke="#e4ebf2" vertical={false} /><XAxis dataKey={x} fontSize={11} minTickGap={15} /><YAxis width={65} fontSize={11} tickFormatter={v => new Intl.NumberFormat('en', { notation: 'compact' }).format(Number(v))} /><Tooltip formatter={v => number(Number(v), unit)} /><Legend /></>;
  return <><p className="analytics-source">Unit: {unit || 'count'}</p><div className="analytics-chart"><ResponsiveContainer width="100%" height={290} minWidth={0}>{bar ? <BarChart data={data} accessibilityLayer margin={{ top: 12, right: 16, bottom: 8 }}>{marks}{series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={palette[i % palette.length]} isAnimationActive={false} />)}</BarChart> : <LineChart data={data} accessibilityLayer margin={{ top: 12, right: 16, bottom: 8 }}>{marks}{series.map((s, i) => <Line key={s.key} dataKey={s.key} name={s.label} stroke={palette[i % palette.length]} strokeWidth={2} dot={false} type="linear" isAnimationActive={false} />)}</LineChart>}</ResponsiveContainer></div><details className="analytics-source-table"><summary>View source values</summary><div className="table-scroll"><table><thead><tr><th>{label(x)}</th>{series.map(s => <th key={s.key}>{s.label}{unit && ` (${unit})`}</th>)}</tr></thead><tbody>{data.map((row, i) => <tr key={i}><th scope="row">{String(row[x])}</th>{series.map(s => <td key={s.key}>{number(at(row, s.key))}</td>)}</tr>)}</tbody></table></div></details></>;
}
function Resource({ title, path, children }: { title: string; path: string; children: (row: Row) => React.ReactNode }) {
  const state = useData(useCallback((signal: AbortSignal) => getReport(path, signal), [path]));
  return <section className="analytics-panel"><div className="analytics-heading"><h2>{title}</h2><button onClick={state.refresh} disabled={state.loading}><Icon name="refresh" />Refresh</button></div><p className="analytics-source">Source: /api/admin/{path}</p>{state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={state.refresh} /> : state.data && children(state.data)}</section>;
}
// Validate chart responses inside the request promise, so malformed data becomes a recoverable panel error.
function RemoteChart({ title, path, list = 'points', x = 'date', series, unit, bar, note }: { title: string; path: string; list?: string; x?: string; series: Series[]; unit?: string; bar?: boolean; note?: string }) {
  const signature = JSON.stringify(series);
  const state = useData(useCallback(async (signal: AbortSignal) => points((await getReport(path, signal))[list], x, JSON.parse(signature) as Series[]), [path, list, x, signature]));
  return <section className="analytics-panel"><div className="analytics-heading"><h2>{title}</h2><button onClick={state.refresh} disabled={state.loading}><Icon name="refresh" />Refresh</button></div><p className="analytics-source">Source: /api/admin/{path}</p>{note && <p className="analytics-note">{note}</p>}{state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={state.refresh} /> : state.data && <Chart data={state.data} x={x} series={series} unit={unit} bar={bar} />}</section>;
}
function Charts() {
  const [days, setDays] = useState(30);
  return <><label className="analytics-range">Daily period<select value={days} onChange={e => setDays(Number(e.target.value))}>{[7, 30, 90, 180].map(d => <option key={d} value={d}>{d} days</option>)}</select></label><div className="analytics-grid">
    <RemoteChart title="Daily revenue" path={`analytics/revenue-daily?days=${days}`} series={[{ key: 'revenue', label: 'Revenue' }]} unit="AED" />
    <RemoteChart title="Daily debt activity" path={`analytics/debt-daily?days=${days}`} series={[{ key: 'added', label: 'Added' }, { key: 'collected', label: 'Collected' }]} unit="AED" note="Daily additions and collections, not outstanding balance." />
    <RemoteChart title="Daily utilization" path={`analytics/utilization-daily?days=${days}`} series={[{ key: 'utilization', label: 'Utilization' }]} unit="%" />
    <RemoteChart title="Customer funnel" path="analytics/customer-funnel" list="steps" x="step" series={[{ key: 'count', label: 'Customers' }]} bar />
    {(['platform', 'age', 'gender'] as const).map(key => <RemoteChart key={key} title={`Demographics · ${key}`} path="analytics/demographics" list={key} x={key === 'age' ? 'range' : key} series={[{ key: 'count', label: 'Customers' }]} bar />)}
    <RemoteChart title="Fleet health" path="analytics/fleet-health" list="conditions" x="condition" series={[{ key: 'count', label: 'Records' }]} bar note="Conditions overlap. Needs service counts open service records, not unique cars." />
    <Resource title="Fleet health details" path="analytics/fleet-health">{row => <Fields row={row} />}</Resource>
  </div></>;
}
const reportColumns = [
  ['revenue.rental', 'Rental revenue'], ['revenue.extraKm', 'Extra km'], ['revenue.total', 'Total revenue'], ['rentals.total', 'Rentals'], ['rentals.completed', 'Completed'], ['salik.total', 'Salik'], ['enoc.total', 'ENOC'], ['enoc.liters', 'Liters'], ['fines.billedTotal', 'Billed fines'], ['debt.added', 'Debt added'], ['debt.collected', 'Debt collected'], ['operatingCost', 'Operating cost'], ['netRevenue', 'Net revenue'],
];
function Monthly() {
  const [months, setMonths] = useState(6), [selected, setSelected] = useState<string | null>(null);
  const state = useData(useCallback((signal: AbortSignal) => monthly(months, signal), [months]));
  const rows = state.data ? array(state.data.months) : [];
  return <><Resource title="All-time statistics" path="reports/statistics">{row => <><div className="analytics-kpis">{[['revenue.total', 'Revenue', 'AED'], ['fleet.utilizationRate', 'Fleet utilization', '%'], ['rentals.total', 'Rentals', ''], ['debt.unpaid', 'Unpaid debt', 'AED']].map(([key, title, unit]) => <div key={key}><span>{title}</span><strong>{number(at(row, key), unit)}</strong></div>)}</div><details><summary>All statistics</summary><Fields row={row} /></details></>}</Resource>
    <section className="analytics-panel"><div className="analytics-heading"><h2>Monthly report</h2><div className="analytics-controls"><label>Period<select value={months} onChange={e => setMonths(Number(e.target.value))}>{[3, 6, 12, 24].map(m => <option key={m} value={m}>{m} months</option>)}</select></label><button onClick={state.refresh} disabled={state.loading}><Icon name="refresh" />Refresh report</button></div></div><p className="analytics-source">Source: /api/admin/reports/monthly?months={months} · Financial amounts in AED</p><p className="analytics-note">Operating cost = Salik + ENOC. Billed fines and debt collections are separate figures, not added again to net revenue. Month labels are supplied by the backend.</p>
    {state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={state.refresh} /> : !rows.length ? <EmptyState /> : <><Chart data={rows} x="month" series={monthlySeries} unit="AED" /><div className="table-scroll" role="region" aria-label="Monthly report" tabIndex={0}><table><thead><tr><th>Month</th>{reportColumns.map(([key, title]) => <th key={key}>{title}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={String(row.month)}><th scope="row"><button className="table-link" onClick={() => setSelected(String(row.month))}>{String(row.month)}</button></th>{reportColumns.map(([key]) => <td key={key}>{number(at(row, key))}</td>)}</tr>)}</tbody></table></div><h3>Period totals · backend totals</h3><Fields row={object(state.data!.totals)} prefix="totals." /></>}
    </section><RemoteChart title="Monthly financials" path={`dashboard/monthly-financials?months=${months}`} list="months" x="month" unit="AED" series={[{ key: 'revenue', label: 'Revenue' }, { key: 'salikCost', label: 'Salik' }, { key: 'enocCost', label: 'ENOC' }, { key: 'operatingCost', label: 'Operating cost' }, { key: 'netRevenue', label: 'Net revenue' }]} note="Separate backend series; month boundaries may differ from the report on a non-UTC server." />
    <Modal isOpen={!!selected} title={`Monthly report · ${selected ?? ''}`} onClose={() => setSelected(null)}>{selected && <MonthDetail month={selected} />}</Modal></>;
}
function MonthDetail({ month }: { month: string }) {
  const state = useData(useCallback((signal: AbortSignal) => monthDetail(month, signal), [month]));
  return <div className="analytics-detail"><p className="analytics-source">Source: /api/admin/reports/monthly/{month}</p>{state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={state.refresh} /> : state.data && <Fields row={state.data} />}</div>;
}
function Operations({ kind }: { kind: 'salik' | 'enoc' }) {
  const state = useData(useCallback((signal: AbortSignal) => transactions(kind, signal), [kind]));
  const [page, setPage] = useState(1), [search, setSearch] = useState(''), [selected, setSelected] = useState<Row | null>(null);
  const [sort, setSort] = useState<{ key: string; order: 'asc' | 'desc' }>({ key: kind === 'salik' ? 'tripDate' : 'transactionDate', order: 'desc' });
  const rows = useMemo(() => (state.data ?? []).filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())).sort((a, b) => (typeof a[sort.key] === 'number' && typeof b[sort.key] === 'number' ? Number(a[sort.key]) - Number(b[sort.key]) : String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''))) * (sort.order === 'asc' ? 1 : -1)), [state.data, search, sort]);
  const breakdown = useMemo(() => grouped(state.data ?? [], kind === 'salik' ? 'gate' : 'station'), [state.data, kind]);
  const columns: Column<Row>[] = [{ key: 'id', label: 'Record', sortable: true, render: row => <button className="table-link" onClick={() => setSelected(row)}>#{String(row.id)}</button> }, { key: 'plateNumber', label: 'Plate', sortable: true }, { key: kind === 'salik' ? 'gate' : 'station', label: kind === 'salik' ? 'Gate' : 'Station', sortable: true }, { key: 'amount', label: 'Amount · AED', sortable: true, render: row => number(row.amount, 'AED') }, { key: kind === 'salik' ? 'tripDate' : 'transactionDate', label: 'Date · Dubai', sortable: true, render: row => new Date(String(row[kind === 'salik' ? 'tripDate' : 'transactionDate'])).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' }) }];
  columns.push(kind === 'salik' ? { key: 'billed', label: 'Billing', render: row => row.billed ? 'Billed' : 'Unbilled' } : { key: 'liters', label: 'Liters', sortable: true, render: row => number(row.liters, 'L') });
  return <><Resource title={`${kind.toUpperCase()} summary · all time`} path={`${kind}/summary`}>{row => <Fields row={row} />}</Resource><section className="analytics-panel"><div className="analytics-heading"><h2>{kind === 'salik' ? 'Salik trips' : 'ENOC transactions'}</h2><button disabled={state.loading} onClick={state.refresh}><Icon name="refresh" />Refresh transactions</button></div><p className="analytics-source">Source: /api/admin/{kind}/{kind === 'salik' ? 'trips' : 'transactions'} · complete snapshot</p><Table caption={kind === 'salik' ? 'Salik trips' : 'ENOC transactions'} columns={columns} data={rows.slice((page - 1) * 10, page * 10)} rowKey={row => String(row.id)} page={page} pageSize={10} total={rows.length} loading={state.loading} error={state.error} search={search} sortBy={sort.key} sortOrder={sort.order} onSearch={setSearch} onSort={(key, order) => setSort({ key, order })} onPageChange={setPage} onRetry={state.refresh} onRowClick={setSelected} />{!state.loading && !state.error && <><h3>{kind === 'salik' ? 'By gate' : 'By station'} · all loaded records</h3><Chart data={breakdown} x="name" series={[{ key: 'amount', label: 'Amount' }]} bar unit="AED" /><Fields row={{ groups: breakdown }} /></>}</section><Modal isOpen={!!selected} title="Transaction details" onClose={() => setSelected(null)}>{selected && <div className="analytics-detail"><Fields row={selected} /></div>}</Modal></>;
}
export default function Analytics() {
  const [tab, setTab] = useState('Charts');
  return <div className="analytics-module"><header className="analytics-banner"><h1>Analytics & monthly report</h1><p>Revenue, operations and fleet insights from the backend</p></header><nav className="analytics-tabs" aria-label="Analytics sections">{['Charts', 'Monthly report', 'Salik', 'ENOC'].map(name => <button key={name} aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</button>)}</nav>{tab === 'Charts' ? <Charts /> : tab === 'Monthly report' ? <Monthly /> : <Operations key={tab} kind={tab === 'Salik' ? 'salik' : 'enoc'} />}</div>;
}
