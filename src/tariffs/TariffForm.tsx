import { useState } from 'react';
import type { FormEvent } from 'react';
import { Icon } from '../components/Icon';
import type { Resource, TariffDraft, TariffRow } from './tariffsApi';

export function TariffForm({ resource, row, busy, blocked, onSave, onCancel }: { resource: Resource; row?: TariffRow; busy: boolean; blocked: boolean; onSave: (draft: TariffDraft) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<TariffDraft>({ name: String(row?.name ?? ''), description: String(row?.description ?? ''), unitCount: String(row?.unitCount ?? 1), timeUnit: String(row?.timeUnit ?? 'Day'), price: String(row?.price ?? ''), currency: String(row?.currency ?? 'AED'), isActive: row?.isActive !== false });
  const update = (key: keyof TariffDraft, value: string | boolean) => setDraft(current => ({ ...current, [key]: value }));
  function submit(event: FormEvent) { event.preventDefault(); onSave(draft); }
  return <form className="tariff-form" onSubmit={submit}><fieldset disabled={busy}>
    {resource === 'tariff-packages' ? <>
      <label>Duration<input required type="number" min="1" step="1" value={draft.unitCount} onChange={e => update('unitCount', e.target.value)} /></label>
      <label>Time unit<select value={draft.timeUnit} onChange={e => update('timeUnit', e.target.value)}>{['Hour', 'Day', 'Month'].map(unit => <option key={unit}>{unit}</option>)}</select></label>
      <label>Price<input required type="number" min="0" step="0.01" value={draft.price} onChange={e => update('price', e.target.value)} /></label>
      <label>Currency<input required maxLength={3} pattern="[A-Z]{3}" value={draft.currency} onChange={e => update('currency', e.target.value.toUpperCase())} /></label>
    </> : <><label className="tariff-wide">Name<input required maxLength={120} value={draft.name} onChange={e => update('name', e.target.value)} /></label><label className="tariff-wide">Description<textarea rows={4} maxLength={2000} value={draft.description} onChange={e => update('description', e.target.value)} /></label></>}
    <label className="tariff-check tariff-wide"><input type="checkbox" checked={draft.isActive} onChange={e => update('isActive', e.target.checked)} />Active</label>
  </fieldset><div className="tariff-actions"><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button className="primary-button" disabled={busy || blocked}><Icon name="check" />{busy ? 'Saving…' : 'Save'}</button></div></form>;
}
