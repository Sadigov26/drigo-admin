import { useState } from 'react';
import { validate, type Resource, type Row } from './deliveryApi';

export function DeliveryForm({ resource, row, zones, busy, onSave, onCancel }: {
  resource: Exclude<Resource, 'reservations'>; row?: Row; zones: Row[]; busy: boolean;
  onSave: (value: Record<string, unknown>) => void; onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(row ? { ...row } : resource === 'deliveryDrivers'
    ? { fullName: '', phoneNumber: '', email: '', zoneId: '', status: 'Offline', isActive: true }
    : { name: '', centerLat: '', centerLng: '', radiusKm: '', isActive: true });
  const [error, setError] = useState('');
  const field = (key: string, title: string, type = 'text', required = true) => <label>{title}<input type={type} required={required} step={type === 'number' ? 'any' : undefined} value={String(values[key] ?? '')} onChange={event => setValues({ ...values, [key]: event.target.value })} /></label>;
  return <form className="delivery-form" onSubmit={event => {
    event.preventDefault();
    try { const value = validate(resource, values); setError(''); onSave(value); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Check the form.'); }
  }}><fieldset disabled={busy}><legend>{row ? 'Edit' : 'New'} {resource === 'deliveryDrivers' ? 'driver' : 'zone'}</legend>
    <div className="delivery-form-grid">{resource === 'deliveryDrivers' ? <>
      {field('fullName', 'Full name')}{field('phoneNumber', 'Phone number', 'tel')}{field('email', 'Email', 'email', false)}
      <label>Zone<select value={String(values.zoneId ?? '')} onChange={event => setValues({ ...values, zoneId: event.target.value })}><option value="">No zone</option>{zones.map(zone => <option key={zone.id} value={zone.id}>#{zone.id} · {String(zone.name)}</option>)}</select></label>
      {row ? <label>Availability<select value={String(values.status)} onChange={event => setValues({ ...values, status: event.target.value })}>{['Online', 'Offline', ...(values.status === 'Busy' ? ['Busy'] : [])].map(status => <option key={status}>{status}</option>)}</select></label> : <p>New drivers start Offline. Edit their availability when they are ready.</p>}
    </> : <>{field('name', 'Zone name')}{field('centerLat', 'Centre latitude', 'number')}{field('centerLng', 'Centre longitude', 'number')}{field('radiusKm', 'Radius · km', 'number')}</>}
    {(row || resource === 'deliveryZones') && <label className="delivery-checkbox"><input type="checkbox" checked={values.isActive === true} onChange={event => setValues({ ...values, isActive: event.target.checked })} />Active</label>}
    </div>{error && <p role="alert" className="delivery-error">{error}</p>}<div className="delivery-actions"><button type="button" onClick={onCancel}>Cancel</button><button className="primary-button" type="submit">Review changes</button></div>
  </fieldset></form>;
}
