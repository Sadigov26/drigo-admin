import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '../components/States';
import type { TrendPoint } from './dashboardApi';
import { formatMetric } from './KpiCards';

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
function formatDate(value: string) { return dayFormat.format(new Date(value + 'T00:00:00Z')); }

export function TrendChart({ title, data, currency = false }: { title: string; data: TrendPoint[]; currency?: boolean }) {
  const unit = currency ? 'AED' : undefined;
  return <section className="trend-panel" aria-label={title}>
    <h3>{title}</h3>
    {data.length === 0 ? <EmptyState message="No trend data available." /> : <>
      <p className="trend-period">{formatDate(data[0].date)} – {formatDate(data[data.length - 1].date)} · {currency ? 'AED' : 'Rentals created'}</p>
      <div className="trend-chart">
        <ResponsiveContainer width="100%" height={240} minWidth={0}>
          <LineChart data={data} accessibilityLayer margin={{ top: 12, right: 18, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#e7e9ec" vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={24} tickLine={false} axisLine={false} fontSize={11} />
            <YAxis allowDecimals={currency} tickFormatter={value => new Intl.NumberFormat('en-GB', { notation: 'compact' }).format(value as number)}
              width={54} tickLine={false} axisLine={false} fontSize={11} domain={[0, 'auto']} />
            <Tooltip labelFormatter={label => formatDate(String(label))} formatter={value => [formatMetric(Number(value), unit), currency ? 'Revenue' : 'Rentals']} />
            <Line type="linear" dataKey="value" name={title} stroke={currency ? '#315f8a' : '#477566'} strokeWidth={2}
              dot={{ r: 2 }} activeDot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="trend-data">
        <summary>View {title.toLowerCase()} data</summary>
        <table><caption className="sr-only">{title} source values</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">{currency ? 'Revenue (AED)' : 'Rentals'}</th></tr></thead>
          <tbody>{data.map(point => <tr key={point.date}><th scope="row">{point.date}</th><td>{formatMetric(point.value, unit)}</td></tr>)}</tbody>
        </table>
      </details>
    </>}
  </section>;
}
