import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { usePermissions } from '../permissions/PermissionsContext';
import { Modal } from '../components/Modal';
import { audiences, object, payload, preview, write, type Row } from './fleetApi';
import { Fields } from './FleetShared';
import { ResourceList } from './ResourceList';
import './fleet.css';

export function Broadcast() {
  const { can } = usePermissions();
  const [draft, setDraft] = useState<Row>({ title: '', body: '', targetAudience: 'All' });
  const [count, setCount] = useState<number | null>(null), [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState<Row | null>(null), [uncertain, setUncertain] = useState(false);
  const locked = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function change(key: string, value: string) { setDraft(row => ({ ...row, [key]: value })); setCount(null); setConfirm(false); setResult(null); setError(''); }
  async function act(send: boolean) {
    if (locked.current || uncertain || !can('settings.create')) return;
    locked.current = true; setBusy(true); setError('');
    let dispatched = false;
    try {
      const body = payload('notifications/broadcast', draft);
      const fresh = await preview(String(body.targetAudience));
      if (!alive.current) return;
      setCount(fresh);
      if (!send) return;
      if (count !== fresh || fresh === 0) { setConfirm(false); setError('The audience changed. Review the new count before confirming again.'); return; }
      dispatched = true;
      const response = object(await write('notifications/broadcast', 'POST', body));
      if (response.success !== true || !Number.isSafeInteger(response.recipientCount)) throw new Error('Unexpected send response. Check history before resending.');
      if (alive.current) { setResult(response); setConfirm(false); setCount(null); setDraft({ title: '', body: '', targetAudience: 'All' }); }
    } catch (cause) {
      if (alive.current) {
        setError(cause instanceof Error ? cause.message : 'Unable to process notification.');
        if (dispatched && (!(cause instanceof ApiError) || cause.status >= 500 || cause.status < 400)) { setUncertain(true); setConfirm(false); }
      }
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  return <section className="fleet-panel"><h2>Broadcast notification</h2><p className="fleet-note">Preview recipients and review the message before confirming. Recipient counts may change.</p>
    <form className="fleet-form" onSubmit={e => { e.preventDefault(); void act(false); }}><fieldset disabled={busy || uncertain || !can('settings.create')}>
      <label>Title<input required maxLength={200} value={String(draft.title)} onChange={e => change('title', e.target.value)} /></label>
      <label>Message<textarea required rows={5} maxLength={5000} value={String(draft.body)} onChange={e => change('body', e.target.value)} /></label>
      <label>Target audience<select value={String(draft.targetAudience)} onChange={e => change('targetAudience', e.target.value)}>{audiences.map(a => <option key={a}>{a}</option>)}</select></label>
      <div className="fleet-actions"><button type="submit">{busy ? 'Loading…' : 'Preview recipients'}</button>{count !== null && <button type="button" className="btn-primary" disabled={count === 0} onClick={() => setConfirm(true)}>Review & send</button>}</div>
    </fieldset></form>
    {!can('settings.create') && <p>Read-only access. Sending requires Settings create permission.</p>}
    {count !== null && <p role="status" className="fleet-preview"><strong>{count.toLocaleString()}</strong> estimated recipients · {String(draft.targetAudience)}</p>}
    {error && <p role="alert" className="error-message">{error}</p>}{uncertain && <p role="alert" className="fleet-note">Send result is uncertain. Your draft is preserved. Check History before starting another broadcast; retry is disabled to avoid duplicate messages.</p>}
    {result && <div role="status"><h3>Broadcast recorded</h3><Fields row={result} /></div>}
    {confirm && <Modal isOpen title="Send broadcast?" onClose={() => { if (!locked.current) setConfirm(false); }}><div className="fleet-detail"><Fields row={{ title: draft.title, body: draft.body, targetAudience: draft.targetAudience, estimatedRecipients: count }} /><p>This action cannot be undone.</p>{error && <p role="alert">{error}</p>}<div className="fleet-actions"><button disabled={busy} onClick={() => setConfirm(false)}>Cancel</button><button disabled={busy} className="btn-primary" onClick={() => void act(true)}>{busy ? 'Sending…' : 'Confirm send'}</button></div></div></Modal>}
  </section>;
}
const tabs = ['Broadcast', 'Campaigns', 'Scheduled', 'History', 'Feed'];
export default function Notifications() {
  const [params, setParams] = useSearchParams(), tab = tabs.includes(params.get('view') ?? '') ? params.get('view')! : 'History';
  return <div className="fleet-module"><header className="fleet-banner"><h1>Notifications</h1><p>Audiences, campaigns and message history</p></header><div className="fleet-tabs" aria-label="Notification views">{tabs.map(name => <button key={name} aria-pressed={tab === name} onClick={() => setParams({ view: name })}>{name}</button>)}</div>
    {tab === 'Broadcast' ? <Broadcast /> : tab === 'Campaigns' ? <ResourceList key={tab} title="Campaigns" path="notifications/campaigns" keys={['title', 'targetAudience', 'status', 'scheduledAt', 'recipientCount', 'openCount']} editable note="Saving a campaign does not send it." /> : tab === 'Scheduled' ? <ResourceList key={tab} title="Scheduled notifications" path="notifications/scheduled" keys={['title', 'targetAudience', 'scheduledAt', 'createdAt']} editable createOnly note="Schedules are saved for reference. Automatic delivery is not available." /> : <ResourceList key={tab} title={tab === 'Feed' ? 'Notification feed' : 'Notification history'} path={`notifications/${tab.toLowerCase()}`} keys={['title', 'body', 'type', 'channel', 'status', 'createdAt']} note="Open a notification to see its details." />}
  </div>;
}
