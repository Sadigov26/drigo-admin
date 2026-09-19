import { lazy, Suspense, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { getPayments, getRental } from './rentalsApi';
import { useVehicleResource } from '../cars/useVehicleResource';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
const RentalRoute = lazy(() => import('./RentalRoute'));
export const text = (value: unknown) => typeof value === 'string' && value.trim() ? value : '—';
export function date(value: unknown) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' }) : '—';
}
export function money(value: unknown, currency: unknown = 'AED') {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${text(currency)}` : '—';
}
const label = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase());
// Decorative color-name indicators, not a manufacturer paint-code lookup.
const colorIndicators: Record<string, string> = { silver: '#c0c0c0', white: '#ffffff', black: '#222222', red: '#b91c1c', blue: '#315d88', grey: '#808080', gray: '#808080', green: '#365e50', yellow: '#e8bf48' };
function valueView(value: unknown, key = ''): ReactNode {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? <ul className="rental-records">{value.map((item, index) => <li key={index}>{valueView(item)}</li>)}</ul> : 'None';
  if (typeof value === 'object') return <dl className="rental-fields">{Object.entries(value).map(([name, item]) => <div key={name}><dt>{label(name)}</dt><dd>{valueView(item, name)}</dd></div>)}</dl>;
  if (key === 'id' && typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) return <details className="rental-identifier"><summary>{value.slice(0, 8)}…</summary><span>{value}</span></details>;
  if (key === 'color' && typeof value === 'string') return <span className="rental-color">{colorIndicators[value.toLowerCase()] && <span aria-hidden="true" style={{ backgroundColor: colorIndicators[value.toLowerCase()] }} />}{value}</span>;
  if (typeof value === 'string' && (/Date$|At$|Until$|Due$/.test(key) || ['at', 'from', 'to', 'periodStart', 'periodEnd'].includes(key))) return date(value);
  return typeof value === 'number' ? value.toLocaleString('en-GB', { maximumFractionDigits: 6, useGrouping: !/id$|year$/i.test(key) }) : String(value);
}
function Section({ title, value }: { title: string; value: unknown }) {
  return <section className="rental-section"><h3>{title}</h3>{valueView(value)}</section>;
}
function Photos({ title, value }: { title: string; value: unknown }) {
  const urls = Array.isArray(value) ? value.filter((item): item is string => {
    if (typeof item !== 'string') return false;
    try { return ['https:', 'http:'].includes(new URL(item).protocol); } catch { return false; }
  }) : [];
  return <section className="rental-section"><h3>{title}</h3>{urls.length ? <div className="rental-photos">{urls.map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={`${title} ${index + 1}`} loading="lazy" referrerPolicy="no-referrer" /></a>)}</div> : <EmptyState message="No photos available." />}</section>;
}
function Payments({ rentalId }: { rentalId: number }) {
  const load = useCallback((signal: AbortSignal) => getPayments(rentalId, signal), [rentalId]);
  const payments = useVehicleResource(load);
  return <section><button disabled={payments.loading} onClick={payments.refresh}>Refresh payments</button>
    {payments.loading ? <LoadingState /> : payments.error ? <ErrorState message={payments.error} onRetry={payments.refresh} /> : payments.data?.length ? <div className="payment-records">{payments.data.map((payment, index) => <article className="payment-receipt" key={String(payment.id ?? index)} aria-label={`Payment ${payment.id}`}>
      <header><div><span className="receipt-eyebrow">DRIGO · Payment record</span><h3>#{String(payment.id)} · {text(payment.transactionType)}</h3></div><StatusBadge status={text(payment.status)} /></header>
      <div className="receipt-total"><span>Payment amount</span><strong>{money(payment.amount, payment.currency)}</strong></div>
      <dl className="receipt-lines"><div><dt>Rental</dt><dd>#{rentalId}</dd></div><div><dt>Date · Dubai</dt><dd>{date(payment.createdAt)}</dd></div><div><dt>Service fee</dt><dd>{money(payment.serviceFee, payment.currency)}</dd></div><div><dt>Period</dt><dd>{date(payment.periodStart)} — {date(payment.periodEnd)}</dd></div><div><dt>Final payment</dt><dd>{payment.isFinalPayment == null ? '—' : payment.isFinalPayment ? 'Yes' : 'No'}</dd></div></dl>
      {typeof payment.failureReason === 'string' && payment.failureReason && <p className="error-message">{payment.failureReason}</p>}
      <details><summary>Transaction details</summary>{valueView(payment)}</details>
    </article>)}</div> : <EmptyState message="No payments recorded." />}
  </section>;
}
export default function RentalDetails({ rentalId }: { rentalId: number }) {
  const load = useCallback((signal: AbortSignal) => getRental(rentalId, signal), [rentalId]);
  const detail = useVehicleResource(load);
  const [tab, setTab] = useState('summary');
  const row = detail.data;
  const grouped = ['user', 'car', 'tariff', 'debts', 'actionHistory', 'startPhotoUrls', 'endPhotoUrls', ...(row?.status === 'PaymentPending' ? ['paymentRetryState'] : []), ...(row?.status === 'Cancelled' ? ['cancelReason'] : [])];
  return <div className="rental-detail">
    <nav className="rental-tabs" aria-label="Rental detail views">{['summary', 'payments', 'route'].map(value => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{label(value)}</button>)}</nav>
    {tab === 'payments' ? <Payments rentalId={rentalId} /> : tab === 'route' ? <Suspense fallback={<LoadingState message="Loading map…" />}><RentalRoute rentalId={rentalId} /></Suspense> : <>
      <button disabled={detail.loading} onClick={detail.refresh}>Refresh details</button>
      {detail.loading ? <LoadingState /> : detail.error ? <ErrorState message={detail.error} onRetry={detail.refresh} /> : row && <>
        <div className="rental-summary"><div><span className="summary-label">Rental status</span><StatusBadge status={row.status} /></div><div className="summary-amount"><span className="summary-label">Rental amount</span><strong>{money(row.totalPrice)}</strong></div><div className="summary-date"><span className="summary-label">Started · Dubai</span><span>{date(row.startDate)}</span></div></div>
        {row.status === 'PaymentPending' && <Section title="Payment retry state" value={row.paymentRetryState} />}
        {row.status === 'Cancelled' && <Section title="Cancellation reason" value={row.cancelReason} />}
        <Section title="Customer" value={row.user} /><Section title="Car" value={row.car} /><Section title="Tariff" value={row.tariff} />
        <Section title="Debts" value={row.debts} /><Section title="Action history" value={row.actionHistory} />
        <Photos title="Start photos" value={row.startPhotoUrls} /><Photos title="End photos" value={row.endPhotoUrls} />
        <details className="rental-section"><summary>Additional rental details</summary>{valueView(Object.fromEntries(Object.entries(row).filter(([key]) => !grouped.includes(key))))}</details>
      </>}
    </>}
  </div>;
}
