import { lazy, Suspense, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { RecordMedia, RecordLink } from '../components/RecordMedia';
import { getPayments, getRental } from './rentalsApi';
import { useVehicleResource } from '../cars/useVehicleResource';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { Icon, type IconName } from '../components/Icon';
import { RentalActions } from './RentalActions';
import { RetryPayment } from '../customers/RetryPayment';
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
function valueView(value: unknown, key = '', currency: unknown = 'AED'): ReactNode {
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) return /photo|image|thumbnail|media|^url$/i.test(key) ? <RecordMedia value={value} /> : <RecordLink value={value} />;
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? <ul className="rental-records">{value.map((item, index) => <li key={index}>{valueView(item, '', currency)}</li>)}</ul> : 'None';
  if (typeof value === 'object') return <dl className="rental-fields">{Object.entries(value).map(([name, item]) => <div key={name}><dt>{label(name)}</dt><dd>{valueView(item, name, 'currency' in value ? value.currency : currency)}</dd></div>)}</dl>;
  if (key === 'id' && typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) return <details className="rental-identifier"><summary>{value.slice(0, 8)}…</summary><span>{value}</span></details>;
  if (key === 'color' && typeof value === 'string') return <span className="rental-color">{colorIndicators[value.toLowerCase()] && <span aria-hidden="true" style={{ backgroundColor: colorIndicators[value.toLowerCase()] }} />}{value}</span>;
  if (typeof value === 'string' && (/Date$|At$|Until$|Due$/.test(key) || ['at', 'from', 'to', 'periodStart', 'periodEnd', 'freeTimeEnd'].includes(key))) return date(value);
  if (typeof value === 'number' && /price|amount|fee|totalPaid|totalDebt|bonusBalance|deductible|nextPaymentTotal|bundledDebts/i.test(key)) return money(value, currency);
  if (typeof value === 'number' && /distance|includedKm/i.test(key)) return `${value.toLocaleString('en-GB', { maximumFractionDigits: 2 })} km`;
  return typeof value === 'number' ? value.toLocaleString('en-GB', { maximumFractionDigits: 6, useGrouping: !/id$|year$/i.test(key) }) : String(value);
}
function Section({ title, value }: { title: string; value: unknown }) {
  return <section className="rental-section"><h3>{title}</h3>{valueView(value)}</section>;
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function IdentityCard({ title, value, primary, secondary }: { title: string; value: unknown; primary: string; secondary: string[] }) {
  const fields = record(value);
  const rest = Object.fromEntries(Object.entries(fields).filter(([key]) => key !== primary && key !== 'id' && !secondary.includes(key)));
  return <section className="rental-identity"><span className="rental-eyebrow">{title}</span><h3>{text(fields[primary])}</h3>
    {secondary.length > 0 && <p className="identity-subtitle">{secondary.map(key => fields[key]).filter(value => value != null && value !== '').join(' · ') || '—'}</p>}
    {valueView(rest)}
    {fields.id != null && <details className="identity-reference"><summary>{title} reference</summary>{valueView(fields.id, 'id')}</details>}
  </section>;
}
function Timeline({ value }: { value: unknown }) {
  const rows = Array.isArray(value) ? value : [];
  return <section className="rental-section"><h3>Action history</h3>{rows.length ? <ol className="rental-timeline">{rows.map((value, index) => {
    const item = record(value);
    const extra = Object.fromEntries(Object.entries(item).filter(([key]) => !['action', 'at', 'by', 'note'].includes(key)));
    return <li key={index}><div><strong>{label(text(item.action))}</strong><time>{date(item.at)}</time></div><p>{text(item.by)}{item.note ? ` · ${text(item.note)}` : ''}</p><details><summary>Event reference</summary>{valueView(extra)}</details></li>;
  })}</ol> : <p className="rental-empty">No activity recorded.</p>}</section>;
}
function RentalHistory({ value }: { value: unknown }) {
  const rows = Array.isArray(value) ? value : [];
  return <section className="rental-section"><h3>Customer rental history</h3>{rows.length ? <div className="rental-history-scroll"><table><thead><tr><th>Rental</th><th>Status</th><th>Started · Dubai</th><th>Ended · Dubai</th><th>Amount</th></tr></thead><tbody>{rows.map((value, index) => {
    const item = record(value);
    return <tr key={index}><td>#{String(item.id ?? '—')}</td><td><StatusBadge status={text(item.status)} /></td><td>{date(item.startDate)}</td><td>{date(item.endDate)}</td><td>{money(item.totalPrice)}</td></tr>;
  })}</tbody></table></div> : <p className="rental-empty">No previous rentals.</p>}</section>;
}
const detailGroups = [
  { title: 'Dates & rental period', matches: /Date$|At$|Until$|Due$|freeTimeEnd|currentPeriod|isPackageExpired|isMonthlySubscription/ },
  { title: 'Distance & allowances', matches: /[Dd]istance/ },
  { title: 'Billing & bonuses', matches: /[Pp]rice|[Pp]aid|[Pp]ayment|[Dd]ebt|[Dd]iscount|[Bb]onus|useBonus/ },
  { title: 'Location & vehicle segments', matches: /route|[Ll]ocation|carSegments/ },
  { title: 'Insurance & booking', matches: /insurance|booking/ },
];
function TechnicalDetails({ value }: { value: Record<string, unknown> }) {
  const remaining = { ...value };
  const groups = detailGroups.map(group => {
    const fields = Object.fromEntries(Object.entries(remaining).filter(([key]) => group.matches.test(key)));
    Object.keys(fields).forEach(key => delete remaining[key]);
    return { title: group.title, fields };
  });
  groups.push({ title: 'References & other details', fields: remaining });
  return <div className="rental-detail-groups">{groups.filter(group => Object.keys(group.fields).length).map(group => <details key={group.title} className="rental-detail-group"><summary>{group.title}</summary>{valueView(group.fields)}</details>)}</div>;
}
function Photos({ title, value }: { title: string; value: unknown }) {
  const urls = Array.isArray(value) ? value.filter((item): item is string => {
    if (typeof item !== 'string') return false;
    try { return ['https:', 'http:'].includes(new URL(item).protocol); } catch { return false; }
  }) : [];
  return <section className="rental-section"><h3>{title}</h3>{urls.length ? <div className="rental-photos">{urls.map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={`${title} ${index + 1}`} loading="lazy" referrerPolicy="no-referrer" /></a>)}</div> : <EmptyState message="No photos available." />}</section>;
}
function Payments({ rentalId, userId, canRetry, busy, onBusy, onRetried }: { rentalId: number; userId: string; canRetry: boolean; busy: boolean; onBusy: (busy: boolean) => void; onRetried: (notice: string) => void }) {
  const load = useCallback((signal: AbortSignal) => getPayments(rentalId, signal), [rentalId]);
  const payments = useVehicleResource(load);
  return <section><button disabled={payments.loading || busy} onClick={payments.refresh}>Refresh payments</button>
    {payments.loading ? <LoadingState /> : payments.error ? <ErrorState message={payments.error} onRetry={payments.refresh} /> : payments.data?.length ? <div className="payment-records">{payments.data.map((payment, index) => <article className="payment-receipt" key={String(payment.id ?? index)} aria-label={`Payment ${payment.id}`}>
      <header><div><span className="receipt-eyebrow">DRIGO · Payment record</span><h3>#{String(payment.id)} · {text(payment.transactionType)}</h3></div><StatusBadge status={text(payment.status)} /></header>
      <div className="receipt-total"><span>Payment amount</span><strong>{money(payment.amount, payment.currency)}</strong></div>
      <dl className="receipt-lines"><div><dt>Rental</dt><dd>#{rentalId}</dd></div><div><dt>Date · Dubai</dt><dd>{date(payment.createdAt)}</dd></div><div><dt>Service fee</dt><dd>{money(payment.serviceFee, payment.currency)}</dd></div><div><dt>Period</dt><dd>{date(payment.periodStart)} — {date(payment.periodEnd)}</dd></div><div><dt>Final payment</dt><dd>{payment.isFinalPayment == null ? '—' : payment.isFinalPayment ? 'Yes' : 'No'}</dd></div></dl>
      {typeof payment.failureReason === 'string' && payment.failureReason && <p className="error-message">{payment.failureReason}</p>}
      {canRetry && userId && Number.isSafeInteger(payment.id) && <RetryPayment disabled={busy} onBusy={onBusy} userId={userId} paymentId={Number(payment.id)} status={payment.status} amount={money(payment.amount, payment.currency)} read={async () => (await getPayments(rentalId)).find(item => item.id === payment.id)} onDone={notice => { payments.refresh(); onRetried(notice); }} />}
      <details><summary>Transaction details</summary>{valueView(payment)}</details>
    </article>)}</div> : <EmptyState message="No payments recorded." />}
  </section>;
}
export default function RentalDetails({ rentalId, canEdit = false, canRetry = false, onChanged, onBusy }: { rentalId: number; canEdit?: boolean; canRetry?: boolean; onChanged?: () => void; onBusy?: (busy: boolean) => void }) {
  const load = useCallback((signal: AbortSignal) => getRental(rentalId, signal), [rentalId]);
  const detail = useVehicleResource(load);
  const [tab, setTab] = useState('summary');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const row = detail.data;
  const grouped = ['user', 'car', 'tariff', 'debts', 'actionHistory', 'startPhotoUrls', 'endPhotoUrls', 'userRentalHistory', ...(row?.status === 'PaymentPending' ? ['paymentRetryState'] : []), ...(row?.status === 'Cancelled' ? ['cancelReason'] : [])];
  return <div className="rental-detail">
    {message && <p role="status">{message}</p>}
    <nav className="rental-tabs" aria-label="Rental detail views">{['summary', 'payments', 'route', 'history', 'photos', 'details'].map(value => <button key={value} disabled={busy} aria-pressed={tab === value} onClick={() => setTab(value)}><Icon name={({ summary: 'info', payments: 'receipt', route: 'map', history: 'history', photos: 'image', details: 'settings' } as Record<string, IconName>)[value]} />{label(value)}</button>)}</nav>
    {tab === 'payments' ? <Payments rentalId={rentalId} userId={typeof record(row?.user).id === 'string' ? String(record(row?.user).id) : ''} canRetry={canRetry} busy={busy} onBusy={value => { setBusy(value); onBusy?.(value); }} onRetried={notice => { setMessage(notice); detail.refresh(); onChanged?.(); }} /> : tab === 'route' ? <Suspense fallback={<LoadingState message="Loading map…" />}><RentalRoute rentalId={rentalId} /></Suspense> : <>
      <button disabled={busy || detail.loading} onClick={detail.refresh}>Refresh details</button>
      {detail.loading ? <LoadingState /> : detail.error ? <ErrorState message={detail.error} onRetry={detail.refresh} /> : row && <>
        {tab === 'summary' && <>
        <div className="rental-summary"><div><span className="summary-label">Rental status</span><StatusBadge status={row.status} /></div><div className="summary-amount"><span className="summary-label">Rental amount</span><strong>{money(row.totalPrice)}</strong></div><div className="summary-date"><span className="summary-label">Started · Dubai</span><span>{date(row.startDate)}</span></div></div>
        {row.status === 'PaymentPending' && <><Section title="Payment retry state" value={row.paymentRetryState} /><p className="rental-note">Review the failed payments and any outstanding debts. A payment retry does not automatically close this rental or settle its debts. {canRetry ? 'Retry the failed payment from the Payments tab.' : 'A colleague with payment access can retry the failed payment.'}</p>{canRetry && <button className="btn-soft-primary" onClick={() => setTab('payments')}><Icon name="receipt" />Go to payments</button>}</>}
        {row.status === 'Cancelled' && <Section title="Cancellation reason" value={row.cancelReason} />}
        {canEdit && <RentalActions rental={row} onBusy={value => { setBusy(value); onBusy?.(value); }} onChanged={notice => { setMessage(notice); detail.refresh(); onChanged?.(); }} />}
        <div className="rental-identity-grid"><IdentityCard title="Customer" value={row.user} primary="fullName" secondary={['phoneNumber', 'email']} /><IdentityCard title="Car" value={row.car} primary="plateNumber" secondary={['brand', 'model']} /></div>
        <div className="rental-overview-grid"><IdentityCard title="Tariff" value={row.tariff} primary="packageName" secondary={[]} /><section className="rental-section rental-billing"><h3>Rental balance</h3><dl className="receipt-lines">{['totalPaid', 'totalDebt', 'nextPaymentTotal'].filter(key => key !== 'totalPaid' || row[key] != null).map(key => <div key={key}><dt>{label(key)}</dt><dd>{money(row[key])}</dd></div>)}</dl><details><summary>Debt records</summary>{Array.isArray(row.debts) && row.debts.length === 0 ? <p className="rental-empty">No debts recorded.</p> : valueView(row.debts)}</details></section></div>
        </>}
        {tab === 'history' && <><Timeline value={row.actionHistory} /><RentalHistory value={row.userRentalHistory} /></>}
        {tab === 'photos' && <div className="rental-photo-groups"><Photos title="Start photos" value={row.startPhotoUrls} /><Photos title="End photos" value={row.endPhotoUrls} /></div>}
        {tab === 'details' && <TechnicalDetails value={Object.fromEntries(Object.entries(row).filter(([key]) => !grouped.includes(key)))} />}
      </>}
    </>}
  </div>;
}
