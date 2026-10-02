import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePromotionData as useData } from '../promotions/usePromotionData';
import { usePermissions } from '../permissions/PermissionsContext';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { Fields, regionName, valueView } from '../fleet/FleetShared';
import { read, object, feeFields, type Action } from './operationsApi';
import { ActionDialog } from './ActionDialog';
import { OpsList } from './Operations';
import '../fleet/fleet.css';
import './operations.css';

const modeHelp: Record<string, string> = { whitelist: 'Allowed countries configuration.', blacklist: 'Restricted countries configuration.' };
function SmsView({ data }: { data: Record<string, unknown> }) {
  const mode = String(data.mode ?? ''), countries = Array.isArray(data.countries) ? data.countries.map(String) : [];
  return <div className="sms-mode"><div className="sms-mode-summary"><div><span>Mode</span><strong>{mode || '—'}</strong>{modeHelp[mode.toLowerCase()] && <small>{modeHelp[mode.toLowerCase()]}</small>}</div><div><span>Updated · Dubai</span><strong>{valueView(data.updatedAt, 'updatedAt')}</strong></div></div>
    <h3>Countries · {countries.length}</h3>{countries.length ? <ul className="fleet-chips sms-countries">{countries.map(code => <li key={code}><strong>{code.toUpperCase()}</strong>{regionName(code) && <span>{regionName(code)}</span>}</li>)}</ul> : <p className="rental-empty">No countries selected.</p>}</div>;
}
function Singleton({ path, title }: { path: string; title: string }) {
  const state = useData(useCallback(async (signal: AbortSignal) => object(await read(path, signal)), [path]));
  const { can } = usePermissions(), [edit, setEdit] = useState(false), [notice, setNotice] = useState('');
  const sms = path.startsWith('security/');
  const action: Action | null = state.data ? { title: `Edit ${title}`, path, method: sms ? 'POST' : 'PUT', kind: sms ? 'sms' : 'fee', danger: sms,
    initial: sms ? { ...state.data, countries: Array.isArray(state.data.countries) ? state.data.countries.join(', ') : '' } : state.data,
    fields: sms ? [{ key: 'mode', label: 'Mode label', type: 'text', required: true }, { key: 'countries', label: 'Country codes · comma separated', type: 'text' }] : feeFields(path),
    note: sms ? 'Review the messaging mode and country list before saving.' : 'Review the amount before saving. Existing rental totals will not be recalculated.' } : null;
  return <section className="fleet-panel"><div className="fleet-heading"><h2>{title}</h2><div className="fleet-actions"><button disabled={state.loading} onClick={state.refresh}>Refresh</button>{can('settings.edit') && <button className="btn-soft-primary" disabled={!state.data || state.loading} onClick={() => setEdit(true)}>Edit</button>}</div></div>{notice && <p role="status">{notice}</p>}{state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={state.refresh} /> : state.data && Object.keys(state.data).length ? sms ? <SmsView data={state.data} /> : <Fields row={state.data} /> : <EmptyState />}{edit && action && <ActionDialog action={action} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); setNotice('Settings saved. Loading current values…'); state.refresh(); }} />}</section>;
}
function BlockList({ countries }: { countries: boolean }) {
  const { can } = usePermissions();
  const key = countries ? 'countryCode' : 'entry', endpoint = countries ? 'security/block-country-code' : 'security/block-ip';
  const add: Action = { title: countries ? 'Block country' : 'Block IP', path: endpoint, method: 'POST', kind: countries ? 'country' : 'ip', fields: [{ key, label: countries ? 'Country code · two letters' : 'IP address or CIDR range', type: 'text', required: true }, { key: 'reason', label: 'Reason', type: 'textarea', required: true }], initial: {}, danger: true, note: 'Check the address or country and enter a reason before confirming.' };
  return <OpsList title={countries ? 'Blocked countries' : 'Blocked IPs'} path={countries ? 'security/blocked-country-codes' : 'security/blocked-ips'} keys={[key, 'reason', 'blockedAt']} permission="settings.create" addAction={add} actionFor={row => can('settings.delete') ? { title: 'Unblock', path: `${endpoint}/${encodeURIComponent(String(row[key]))}`, method: 'DELETE', fields: [], initial: {}, danger: true, note: `Remove the block for ${row[key]}? Existing reason: ${row.reason ?? '—'}.` } : null} actionPermission="settings.delete" />;
}
const tabs = ['Trip fee', 'Excess km', 'Service fees', 'Penalty configs', 'Blocked IPs', 'Blocked countries', 'SMS mode'];
export default function Settings() {
  const [params, setParams] = useSearchParams(), tab = tabs.includes(params.get('view') ?? '') ? params.get('view')! : tabs[0];
  return <div className="fleet-module"><header className="fleet-banner"><h1>Settings & Security</h1><p>Fees and access-control configuration</p></header><div className="fleet-tabs" aria-label="Settings views">{tabs.map(name => <button key={name} aria-pressed={tab === name} onClick={() => setParams({ view: name })}>{name}</button>)}</div><div key={tab}>
    {tab === 'Trip fee' ? <Singleton title="Trip fee" path="trip-fee" /> : tab === 'Excess km' ? <Singleton title="Excess km charge" path="excess-km-charge" /> : tab === 'SMS mode' ? <Singleton title="SMS country mode" path="security/sms-country-mode" /> : tab === 'Blocked IPs' || tab === 'Blocked countries' ? <BlockList countries={tab === 'Blocked countries'} /> : <OpsList title={tab} path={tab === 'Service fees' ? 'service-fees' : 'penalty-configs'} keys={['name', 'amount', 'currency', 'isActive']} permission="settings.edit" actionFor={row => { const path = tab === 'Service fees' ? 'service-fees' : 'penalty-configs'; return { title: 'Edit', path: `${path}/${row.id}`, method: 'PUT', kind: 'fee', fields: feeFields(path), initial: row, note: `Update ${row.name}. Currency remains ${row.currency ?? 'AED'}.` }; }} />}
  </div></div>;
}
