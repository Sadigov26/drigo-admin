import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ErrorState, LoadingState } from '../components/States';
import { getBrands, getLookups } from './carsApi';
import type { CarDetail, Lookup } from './carsApi';
import { Icon } from '../components/Icon';

type Props = { car: CarDetail | null; busy: boolean; onSave: (body: Record<string, string | number>) => void; onCancel: () => void };
const numbers = [
  { key: 'manufactureYear', label: 'Year', min: 1886, max: new Date().getFullYear() + 1, step: 1 },
  { key: 'maxSpeed', label: 'Maximum speed (km/h)', min: 1, max: 500, step: 1 },
  { key: 'engineCapacity', label: 'Engine capacity', min: 0, max: 1000, step: 0.01 },
  { key: 'distance', label: 'Odometer (km)', min: 0, max: 10000000, step: 0.1 },
];
export function CarForm({ car, busy, onSave, onCancel }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(
    ['plateNumber', 'brandId', 'modelId', 'colorId', 'fuelTypeId', 'manufactureYear', 'maxSpeed', 'engineCapacity', 'distance', 'chassisNumber', 'engineUnit', 'transmission', 'city'].map(key => [key, String(car?.[key] ?? '')]),
  ));
  const [base, setBase] = useState<{ brands: Lookup[]; fuels: Lookup[]; cities: Lookup[] } | null>(null);
  const [dependent, setDependent] = useState<{ brandId: string; models: Lookup[]; colors: Lookup[] } | null>(null);
  const [error, setError] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setBase(null); setLookupError('');
    Promise.all([getBrands(controller.signal), getLookups('/cars/fuel-types', controller.signal), getLookups('/cities', controller.signal)])
      .then(([brands, fuels, cities]) => { if (!controller.signal.aborted) setBase({ brands, fuels, cities }); })
      .catch(cause => { if (!controller.signal.aborted) setLookupError(cause.message); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    setDependent(null);
    if (!values.brandId) return;
    const controller = new AbortController();
    setLookupError('');
    Promise.all([getLookups(`/brands/${values.brandId}/models`, controller.signal), getLookups(`/brands/${values.brandId}/colors`, controller.signal)])
      .then(([models, colors]) => { if (!controller.signal.aborted) setDependent({ brandId: values.brandId, models, colors }); })
      .catch(cause => { if (!controller.signal.aborted) setLookupError(cause.message); });
    return () => controller.abort();
  }, [values.brandId, attempt]);
  function change(key: string, value: string) {
    setError('');
    setValues(previous => ({ ...previous, [key]: value, ...(key === 'brandId' ? { modelId: '', colorId: '' } : {}) }));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !base || !dependent || dependent.brandId !== values.brandId) return;
    const choices: [string, Lookup[]][] = [['brandId', base.brands], ['modelId', dependent.models], ['colorId', dependent.colors], ['fuelTypeId', base.fuels]];
    if (choices.some(([key, list]) => !list.some(item => item.id === Number(values[key])))) { setError('Choose valid brand, model, color and fuel type values.'); return; }
    if (!values.plateNumber.trim()) { setError('Plate number is required.'); return; }
    const body: Record<string, string | number> = { plateNumber: values.plateNumber.trim() };
    for (const [key] of choices) body[key] = Number(values[key]);
    for (const field of numbers) {
      if (!values[field.key].trim()) { setError(`${field.label} is required.`); return; }
      const value = Number(values[field.key]);
      if (!Number.isFinite(value) || value < field.min || value > field.max || (field.step === 1 && !Number.isInteger(value))) { setError(`Check ${field.label.toLowerCase()}.`); return; }
      body[field.key] = value;
    }
    if (!['0', '1', '2'].includes(values.transmission)) { setError('Choose a transmission.'); return; }
    body.transmission = Number(values.transmission);
    body.engineUnit = values.engineUnit.trim() || 'L';
    if (values.chassisNumber.trim()) body.chassisNumber = values.chassisNumber.trim();
    if (!car) {
      if (!base.cities.some(city => city.name === values.city)) { setError('Choose a city.'); return; }
      if (Number(body.engineCapacity) === 0) { setError('This mock defaults zero capacity to 2.0 on creation. Use a positive capacity, then edit it to zero if needed.'); return; }
      body.city = values.city;
    }
    // Do not overwrite live fields (such as distance) when only another field changed.
    if (car) {
      for (const key of Object.keys(body)) {
        if (String(body[key]) === String(car[key] ?? '')) delete body[key];
      }
      if (!Object.keys(body).length) { setError('No changes to save.'); return; }
    }
    onSave(body);
  }
  function select(key: string, label: string, options: Lookup[], disabled = false) {
    return <label key={key}>{label}<select value={values[key]} onChange={event => change(key, event.target.value)} required disabled={disabled}>
      <option value="">Select {label.toLowerCase()}</option>{options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
    </select></label>;
  }
  if (lookupError) return <ErrorState message={lookupError} onRetry={() => setAttempt(value => value + 1)} />;
  if (!base) return <LoadingState message="Loading form options…" />;
  return <form onSubmit={submit} className="car-form"><fieldset disabled={busy}>
    <div className="car-fields">
      <label>Plate number<input required maxLength={30} value={values.plateNumber} onChange={event => change('plateNumber', event.target.value)} /></label>
      {select('brandId', 'Brand', base.brands)}
      {select('modelId', 'Model', dependent?.models ?? [], !dependent)}
      {select('colorId', 'Color', dependent?.colors ?? [], !dependent)}
      {select('fuelTypeId', 'Fuel type', base.fuels)}
      {numbers.map(field => <label key={field.key}>{field.label}<input type="number" required min={field.min} max={field.max} step={field.step} value={values[field.key]} onChange={event => change(field.key, event.target.value)} /></label>)}
      <label>Engine unit<input maxLength={12} placeholder="L or kWh" value={values.engineUnit} onChange={event => change('engineUnit', event.target.value)} /></label>
      <label>Transmission<select required value={values.transmission} onChange={event => change('transmission', event.target.value)}><option value="">Select transmission</option><option value="0">Automatic</option><option value="1">Manual</option><option value="2">Semi-automatic</option></select></label>
      <label>Chassis number<input maxLength={40} value={values.chassisNumber} onChange={event => change('chassisNumber', event.target.value)} /></label>
      {!car && <label>City<select required value={values.city} onChange={event => change('city', event.target.value)}><option value="">Select city</option>{base.cities.map(city => <option key={city.id}>{city.name}</option>)}</select></label>}
    </div>
    {!car && <p className="car-note">Creates one active car. Leave the chassis number blank to generate it automatically.</p>}
    {error && <p role="alert" className="error-message">{error}</p>}
    <div className="car-actions"><button type="button" onClick={onCancel}><Icon name="close" />Cancel</button><button className="car-primary" type="submit" disabled={!dependent}><Icon name="check" />{busy ? 'Saving…' : 'Save car'}</button></div>
  </fieldset></form>;
}
