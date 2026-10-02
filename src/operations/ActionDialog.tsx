import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { Modal } from '../components/Modal';
import { Fields } from '../fleet/FleetShared';
import { buildBody, execute, type Action, type Row } from './operationsApi';

export function ActionDialog({ action, onClose, onSaved }: { action: Action; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(action.initial), [review, setReview] = useState<Row | undefined | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [uncertain, setUncertain] = useState(false);
  const locked = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const close = () => { if (!locked.current) onClose(); };
  async function submit() {
    if (locked.current || uncertain) return;
    setError('');
    if (review === null) { try { setReview(buildBody(action, draft)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Invalid fields.'); } return; }
    locked.current = true; setBusy(true);
    try { await execute(action, review); if (alive.current) onSaved(); }
    catch (cause) {
      if (alive.current) {
        setError(cause instanceof Error ? cause.message : 'Unable to save.');
        if (!(cause instanceof ApiError) || cause.status >= 500 || cause.status < 400) setUncertain(true);
      }
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  return <Modal isOpen title={action.title} onClose={close}><form className="fleet-form" onSubmit={e => { e.preventDefault(); void submit(); }}>
    {action.note && <p className="fleet-note">{action.note}</p>}
    {review !== null ? <><h3>Review change</h3>{review && Object.keys(review).length ? <Fields row={review} /> : <p>{action.title}? Confirm to apply this change.</p>}<p>Only confirm if these changes are intended.</p></> : <fieldset disabled={busy}>{action.fields.map(field => <label key={field.key} className={field.type === 'boolean' ? 'fleet-checkbox' : undefined}>{field.type === 'boolean' ? <><input type="checkbox" checked={draft[field.key] === true} onChange={e => setDraft(row => ({ ...row, [field.key]: e.target.checked }))} />{field.label}</> : <>{field.label}{field.type === 'select' ? <select value={String(draft[field.key] ?? '')} onChange={e => setDraft(row => ({ ...row, [field.key]: e.target.value }))}><option value="">Select…</option>{field.options?.map(option => <option key={option}>{option}</option>)}</select> : field.type === 'textarea' ? <textarea rows={4} maxLength={2000} required={field.required} value={String(draft[field.key] ?? '')} onChange={e => setDraft(row => ({ ...row, [field.key]: e.target.value }))} /> : <input type={field.type} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? '0.01' : undefined} max={field.max} required={field.required} value={String(draft[field.key] ?? '')} onChange={e => setDraft(row => ({ ...row, [field.key]: e.target.value }))} />}</>}</label>)}</fieldset>}
    {error && <p role="alert" className="error-message">{error}</p>}{uncertain && <p role="alert" className="fleet-note">Result may be uncertain. Close and refresh to verify the current state before retrying. Automatic retry is disabled.</p>}
    <div className="fleet-actions"><button type="button" disabled={busy} onClick={close}>Cancel</button>{review !== null && !uncertain && <button type="button" disabled={busy} onClick={() => setReview(null)}>Back</button>}<button disabled={busy || uncertain} className={action.danger ? 'btn-soft-danger' : 'btn-primary'}>{busy ? 'Applying…' : review === null ? 'Review change' : 'Confirm change'}</button></div>
  </form></Modal>;
}
