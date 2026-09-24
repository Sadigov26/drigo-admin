import { useState, type FormEvent } from 'react';
import { accidentStatuses, validateAccident, type AccidentInput, type RecordRow } from './finesApi';

export function AccidentForm({ row, busy, onSave, onCancel }: { row?: RecordRow; busy: boolean; onSave: (input: AccidentInput) => void; onCancel: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => ({
    carId: String(row?.carId ?? ''), rentalId: String(row?.rentalId ?? ''), userId: String(row?.userId ?? ''),
    status: String(row?.status ?? 'Reported'), faultParty: String(row?.faultParty ?? 'Unknown'), description: String(row?.description ?? ''),
    estimatedCost: String(row?.estimatedCost ?? '0'), location: String(row?.location ?? ''),
    accidentDate: typeof row?.accidentDate === 'string' ? row.accidentDate : new Date().toISOString(),
  }));
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    try {
      const input: AccidentInput = {
        carId: values.carId.trim() ? Number(values.carId) : null, rentalId: values.rentalId.trim() ? Number(values.rentalId) : null,
        userId: values.userId.trim() || null, status: values.status, faultParty: values.faultParty,
        description: values.description.trim(), estimatedCost: Number(values.estimatedCost), location: values.location.trim(), accidentDate: values.accidentDate,
      };
      if (!values.estimatedCost.trim() || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.accidentDate)) throw new Error('Enter a cost and an ISO date with timezone, e.g. 2026-09-24T10:00:00+04:00.');
      validateAccident(input); onSave(input);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Check the form.'); }
  }
  const fields = [['carId', 'Car ID (optional)'], ['rentalId', 'Rental ID (optional)'], ['userId', 'Customer UUID (optional)'], ['estimatedCost', 'Estimated cost · AED'], ['location', 'Location'], ['accidentDate', 'Accident date · ISO with timezone']];
  return <form className="incident-form" onSubmit={submit}>
    <fieldset disabled={busy}><legend>{row ? 'Edit accident' : 'New accident'}</legend>
      <div className="incident-grid">{fields.map(([key, label]) => <label key={key}>{label}<input required={['location', 'accidentDate', 'estimatedCost'].includes(key)} value={values[key]} onChange={e => setValues({ ...values, [key]: e.target.value })} /></label>)}
        <label>Status<select value={values.status} onChange={e => setValues({ ...values, status: e.target.value })}>{accidentStatuses.map(status => <option key={status}>{status}</option>)}</select></label>
        <label>Fault party<select value={values.faultParty} onChange={e => setValues({ ...values, faultParty: e.target.value })}>{Array.from(new Set(['Unknown', 'Customer', 'ThirdParty', 'Company', values.faultParty])).map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      <label>Description<textarea required maxLength={2000} value={values.description} onChange={e => setValues({ ...values, description: e.target.value })} /></label>
      {error && <p role="alert" className="error-message">{error}</p>}
      <div className="incident-actions"><button type="button" onClick={onCancel}>Cancel</button><button className="primary-button" type="submit">Review changes</button></div>
    </fieldset>
  </form>;
}
