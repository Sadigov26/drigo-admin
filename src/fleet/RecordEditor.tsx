import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { ApiError } from '../api/client';
import { audiences, campaignStatuses, payload, write, zoneTypes, type Row } from './fleetApi';

function localDate(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
}
export function RecordEditor({ path, record, remove = false, onClose, onSaved }: { path: string; record: Row | null; remove?: boolean; onClose: () => void; onSaved: () => void }) {
  const geo = path === 'geozones';
  const [draft, setDraft] = useState<Row>(() => ({ name: '', title: '', body: '', type: 'Operating', color: '#2563EB', isActive: true, targetAudience: 'All', status: 'Draft', ...record, polygon: JSON.stringify(record?.polygon ?? [], null, 2), scheduledAt: localDate(record?.scheduledAt) }));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [uncertain, setUncertain] = useState(false);
  const locked = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const change = (key: string, value: unknown) => setDraft(previous => ({ ...previous, [key]: value }));
  const close = () => { if (!locked.current) onClose(); };
  async function submit() {
    if (locked.current || uncertain) return;
    locked.current = true; setBusy(true); setError('');
    let dispatched = false;
    try {
      const body = remove ? undefined : payload(path, draft);
      dispatched = true;
      await write(path + (record ? `/${encodeURIComponent(String(record.id))}` : ''), remove ? 'DELETE' : record ? 'PUT' : 'POST', body);
      if (alive.current) onSaved();
    } catch (cause) {
      if (alive.current) {
        setError(cause instanceof Error ? cause.message : 'The change failed.');
        if (dispatched && (!(cause instanceof ApiError) || cause.status >= 500 || cause.status < 400)) setUncertain(true);
      }
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  const title = `${remove ? 'Delete' : record ? 'Edit' : 'Add'} ${geo ? 'geo zone' : path.endsWith('campaigns') ? 'campaign' : 'scheduled notification'}`;
  return <Modal isOpen title={title} onClose={close}><form className="fleet-form" onSubmit={e => { e.preventDefault(); void submit(); }}>
    {remove ? <p>Delete “{String(record?.name ?? record?.title ?? record?.id)}”? This cannot be undone.</p> : <fieldset disabled={busy || uncertain}>
      <label>{geo ? 'Zone name' : 'Title'}<input required maxLength={200} value={String(draft[geo ? 'name' : 'title'])} onChange={e => change(geo ? 'name' : 'title', e.target.value)} /></label>
      {geo ? <>
        <div className="fleet-form-grid"><label>Type<select value={String(draft.type)} onChange={e => change('type', e.target.value)}>{zoneTypes.map(type => <option key={type}>{type}</option>)}</select></label><label>Color<input type="color" value={String(draft.color)} onChange={e => change('color', e.target.value)} /></label></div>
        <label className="fleet-checkbox"><input type="checkbox" checked={draft.isActive === true} onChange={e => change('isActive', e.target.checked)} />Active zone</label>
        <label>Polygon coordinates<textarea required rows={8} value={String(draft.polygon)} onChange={e => change('polygon', e.target.value)} /></label>
        <p className="fleet-note">Enter at least three points as JSON: [{'{"lat":25.20,"lng":55.27}'}, …]. Latitude first, longitude second. City is not stored by this backend.</p>
      </> : <>
        <label>Message<textarea required maxLength={5000} rows={5} value={String(draft.body)} onChange={e => change('body', e.target.value)} /></label>
        <div className="fleet-form-grid"><label>Target audience<select value={String(draft.targetAudience)} onChange={e => change('targetAudience', e.target.value)}>{audiences.map(a => <option key={a}>{a}</option>)}</select></label>
          {path.endsWith('campaigns') && <label>Status<select value={String(draft.status)} onChange={e => change('status', e.target.value)}>{campaignStatuses.map(s => <option key={s}>{s}</option>)}</select></label>}</div>
        <label>Schedule time · your device time ({Intl.DateTimeFormat().resolvedOptions().timeZone})<input type="datetime-local" value={String(draft.scheduledAt)} onChange={e => change('scheduledAt', e.target.value)} /></label>
        <p className="fleet-note">Stored in UTC; lists display Dubai time. Saving a campaign updates its record, it does not execute or send it.</p>
      </>}
    </fieldset>}
    {error && <p role="alert" className="error-message">{error}</p>}
    {uncertain && <p role="alert" className="fleet-note">The server may have applied this change. Close and refresh the list before trying again; automatic resubmission is disabled.</p>}
    <div className="fleet-actions"><button type="button" disabled={busy} onClick={close}>Cancel</button><button className={remove ? 'btn-soft-danger' : 'btn-primary'} disabled={busy || uncertain}>{busy ? 'Saving…' : remove ? 'Confirm delete' : 'Save'}</button></div>
  </form></Modal>;
}
