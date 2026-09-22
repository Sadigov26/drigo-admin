import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, LoadingState } from '../components/States';
import { allowedActions, customerStatus, getCustomer, performCustomerAction } from './customersApi';
import type { Action, Customer } from './customersApi';

export function date(value: unknown, dateOnly = false) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone: dateOnly ? 'UTC' : 'Asia/Dubai', dateStyle: 'medium', ...(dateOnly ? {} : { timeStyle: 'short' as const }) }).format(new Date(value));
}
const fieldLabels: Record<string, string> = { ocr: 'Document data (OCR)', profilePhotoUrl: 'Profile photo', frontUrl: 'Front image', backUrl: 'Back image', selfieUrl: 'Selfie', isApproved: 'Approved', isVerified: 'Verified', isBlocked: 'Blocked', isDeleted: 'Deleted', createdAt: 'Registered · Dubai' };
const label = (key: string) => fieldLabels[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase());
function safeUrl(value: string) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
function Value({ value, name }: { value: unknown; name: string }) {
  if (value == null || value === '') return <>—</>;
  if (typeof value === 'boolean') return <>{value ? 'Yes' : 'No'}</>;
  if (Array.isArray(value)) return value.length ? <ul>{value.map((item, index) => <li key={index}><Value value={item} name={name} /></li>)}</ul> : <>—</>;
  if (typeof value === 'object') return <Fields data={value as Record<string, unknown>} />;
  if (typeof value === 'string' && /Url$/.test(name)) {
    const url = safeUrl(value);
    return url ? <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">View {label(name.replace(/Url$/, '')).toLowerCase()}</a> : <>Unavailable</>;
  }
  if (typeof value === 'string' && /(At|Date)$/.test(name)) return <>{date(value, /birth|expiry/i.test(name))}</>;
  if (name === 'status') return <StatusBadge status={String(value)} />;
  if (typeof value === 'number' && /bonus|balance/i.test(name)) return <>{value.toLocaleString('en-GB', { maximumFractionDigits: 2 })} AED</>;
  return <>{String(value)}</>;
}
function Fields({ data }: { data: Record<string, unknown> }) {
  return <dl className="customer-fields">{Object.entries(data).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd><Value value={value} name={key} /></dd></div>)}</dl>;
}
const names: Record<Action, string> = { approve: 'Approve customer', reject: 'Reject documents', block: 'Block customer', unblock: 'Unblock customer', delete: 'Delete customer', restore: 'Restore customer' };
const danger = (action: Action) => ['reject', 'block', 'delete'].includes(action);
export default function CustomerDetails({ id, canEdit, canDelete, onChanged, onBusy }: {
  id: string; canEdit: boolean; canDelete: boolean; onChanged: () => void; onBusy: (busy: boolean) => void;
}) {
  const [data, setData] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState('Summary');
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setActionError(''); setAction(null);
    getCustomer(id, controller.signal).then(row => { if (!controller.signal.aborted) setData(row); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load customer.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, attempt]);
  async function confirm() {
    if (!action || lock.current || (action === 'delete' ? !canDelete : !canEdit)) return;
    lock.current = true; setBusy(true); onBusy(true); setNotice(''); setActionError('');
    let applied = false;
    try {
      await performCustomerAction(id, action, reason);
      applied = true;
      if (!alive.current) return;
      onChanged(); setAction(null);
      const refreshed = await getCustomer(id);
      if (alive.current) { setData(refreshed); setNotice('Saved. Customer details updated.'); }
    } catch (cause) {
      if (alive.current) setActionError(`${applied ? 'Saved, but details could not be refreshed. ' : ''}${cause instanceof Error ? cause.message : 'Action failed.'} Refresh details before another action.`);
    } finally {
      lock.current = false;
      if (alive.current) { setBusy(false); onBusy(false); }
    }
  }
  if (loading) return <LoadingState message="Loading customer…" />;
  if (error) return <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />;
  if (!data) return null;
  const documentKeys = ['passportDetail', 'driverLicenseDetail', 'nationalIdentityDetail', 'faceVerifyDetail'];
  const personalKeys = ['phoneNumber', 'phoneCountryCode', 'phoneNumberConfirmed', 'email', 'birthDate', 'gender', 'userType', 'createdAt', 'profilePhotoUrl'];
  const others = Object.fromEntries(Object.entries(data).filter(([key]) => !['id', 'fullName', ...personalKeys, ...documentKeys, 'referralDetail'].includes(key)));
  return <div className="customer-detail">
    <header className="customer-profile"><div><StatusBadge status={customerStatus(data)} /><h3>{data.fullName || 'Unnamed customer'}</h3><p>{String(data.email || data.phoneNumber || '—')}</p></div><button disabled={busy} onClick={() => { setNotice(''); onChanged(); setAttempt(value => value + 1); }}><Icon name="refresh" />Refresh details</button></header>
    {notice && <p role="status" className="customer-notice">{notice}</p>}
    {actionError && <p role="alert" className="error-message">{actionError}</p>}
    <div className="customer-actions">{allowedActions(data).filter(item => item === 'delete' ? canDelete : canEdit).map(item => <button key={item} disabled={busy || !!actionError} className={danger(item) ? 'btn-soft-danger' : 'btn-soft-primary'} onClick={() => { setAction(item); setReason(''); }}><Icon name={item === 'delete' ? 'trash' : item === 'block' ? 'lock' : item === 'unblock' ? 'unlock' : 'check'} />{names[item]}</button>)}</div>
    {action && !actionError && <form className="customer-confirm" onSubmit={event => { event.preventDefault(); void confirm(); }}><h3>{names[action]}?</h3><p>{action === 'delete' ? 'This hides the customer from the list. You can restore this record using its UUID.' : `Apply this change to ${data.fullName || 'this customer'}?`}</p>{['reject', 'block'].includes(action) && <label>Reason (optional)<textarea maxLength={500} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>}<div className="customer-actions"><button type="button" disabled={busy} onClick={() => setAction(null)}>Cancel</button><button disabled={busy} className={danger(action) ? 'btn-danger' : 'btn-primary'}><Icon name="check" />{busy ? 'Saving…' : 'Confirm action'}</button></div></form>}
    <nav className="customer-tabs" aria-label="Customer sections">{['Summary', 'Documents', 'Account details'].map(item => <button key={item} disabled={busy} aria-pressed={tab === item} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {tab === 'Summary' && <div className="customer-grid"><section className="customer-card"><h3>Personal information</h3><Fields data={Object.fromEntries(personalKeys.map(key => [key, data[key]]))} /></section><section className="customer-card"><h3>Referral</h3><Value name="referralDetail" value={data.referralDetail} /><h3>Customer reference</h3><p className="customer-reference">{data.id}</p></section></div>}
    {tab === 'Documents' && <div className="customer-grid">{documentKeys.map(key => <section className="customer-card" key={key}><h3>{({ passportDetail: 'Passport', driverLicenseDetail: 'Driving licence', nationalIdentityDetail: 'National identity', faceVerifyDetail: 'Face verification' })[key]}</h3><Value name={key} value={data[key]} /></section>)}</div>}
    {tab === 'Account details' && <section className="customer-card"><h3>Account and verification</h3><Fields data={others} /></section>}
  </div>;
}
