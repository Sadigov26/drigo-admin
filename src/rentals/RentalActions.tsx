import { useCallback, useEffect, useRef, useState } from 'react';
import { useVehicleResource } from '../cars/useVehicleResource';
import { ErrorState, LoadingState } from '../components/States';
import { getAvailableCars, getPackages, performRentalAction } from './rentalActionsApi';
import type { RentalAction } from './rentalActionsApi';
import type { Detail } from './rentalsApi';
import { statuses } from './rentalsApi';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
const actionIcons: Record<string, IconName> = { end: 'power', switch: 'car', comp: 'plus', package: 'receipt', status: 'settings' };

type Props = { rental: Detail; onChanged: (message: string) => void; onBusy: (busy: boolean) => void };
const titles = { end: 'End rental', switch: 'Switch car', comp: 'Compensate kilometres', package: 'Add km package', status: 'Change status' };
type ActionType = keyof typeof titles;

function ActionForm({ rental, type, onConfirm, onCancel }: { rental: Detail; type: ActionType; onConfirm: (action: RentalAction) => void; onCancel: () => void }) {
  const load = useCallback(async (signal: AbortSignal) => ({
    cars: type === 'switch' ? await getAvailableCars(signal) : [],
    packages: type === 'package' ? await getPackages(rental.id, signal) : [],
  }), [rental.id, type]);
  const options = useVehicleResource(load);
  const [selection, setSelection] = useState('');
  const [km, setKm] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const cars = options.data?.cars.filter(car => car.id !== rental.car?.id) ?? [];
  function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (type === 'end') return onConfirm({ type });
    if (type === 'comp') {
      if (!km.trim() || !Number.isFinite(Number(km)) || Number(km) <= 0) return setError('Enter a positive number of kilometres.');
      return onConfirm({ type, km: Number(km), reason });
    }
    if (type === 'status' && selection) return onConfirm({ type, status: selection });
    if (type === 'switch' && cars.some(car => car.id === Number(selection))) return onConfirm({ type, carId: Number(selection) });
    const option = options.data?.packages.find(item => item.id === Number(selection));
    if (type === 'package' && option) return onConfirm({ type, package: option });
    setError('Choose an option first.');
  }
  return <form className="rental-action-form" onSubmit={submit}>
    <h4>{titles[type]}</h4>
    {options.loading ? <LoadingState /> : options.error ? <ErrorState message={options.error} onRetry={options.refresh} /> : <>
      {type === 'end' && <p>Ending this rental will settle it and release the car.</p>}
      {type === 'switch' && <label>Available car<select required value={selection} onChange={event => setSelection(event.target.value)}><option value="">Choose a car</option>{cars.map(car => <option key={car.id} value={car.id}>{car.plateNumber ?? `#${car.id}`} · {car.brandName} {car.modelName}</option>)}</select>{!cars.length && <span>No available cars.</span>}</label>}
      {type === 'comp' && <><label>Kilometres<input required type="number" min="0.01" step="any" value={km} onChange={event => setKm(event.target.value)} /></label><label>Reason (optional)<input maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label></>}
      {type === 'package' && <label>Package<select required value={selection} onChange={event => setSelection(event.target.value)}><option value="">Choose a package</option>{options.data?.packages.map(item => <option key={item.id} value={item.id}>{item.km} km · {item.price.toFixed(2)} {item.currency}</option>)}</select>{!options.data?.packages.length && <span>No packages available.</span>}</label>}
      {type === 'status' && <><label>New status<select required value={selection} onChange={event => setSelection(event.target.value)}><option value="">Choose status</option>{statuses.filter(status => status !== rental.status).map(status => <option key={status}>{status}</option>)}</select></label><p>Status correction does not settle payments or run the end-rental process. Use End rental to finish a trip.</p></>}
    </>}
    {error && <p role="alert">{error}</p>}
    <div className="rental-action-buttons"><button type="button" onClick={onCancel}><Icon name="close" />Cancel</button><button className="btn-soft-primary" disabled={options.loading || !!options.error}><Icon name="check" />Review action</button></div>
  </form>;
}

export function RentalActions({ rental, onChanged, onBusy }: Props) {
  const [type, setType] = useState<ActionType | null>(null);
  const [pending, setPending] = useState<RentalAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const active = ['Active', 'Started'].includes(rental.status);
  async function execute() {
    if (!pending || lock.current) return;
    lock.current = true; setBusy(true); onBusy(true); setError('');
    try {
      await performRentalAction(rental.id, pending);
      if (alive.current) { setPending(null); setType(null); onChanged('Action completed. Latest rental details requested.'); }
    } catch (cause) {
      if (alive.current) {
        setError(`${cause instanceof Error ? cause.message : 'Action failed.'} Refresh the rental before trying again; a lost response does not mean the action was not applied.`);
        setPending(null); setType(null);
      }
    } finally { lock.current = false; onBusy(false); if (alive.current) setBusy(false); }
  }
  let confirmation = pending ? `${titles[pending.type]} for rental #${rental.id}?` : '';
  if (pending?.type === 'end') confirmation = `End rental #${rental.id}? This cannot be undone.`;
  if (pending?.type === 'comp') confirmation = `Grant ${pending.km} complimentary km to rental #${rental.id}?`;
  if (pending?.type === 'package') confirmation = `Add ${pending.package.km} km for ${pending.package.price.toFixed(2)} ${pending.package.currency}? This creates a payment.`;
  if (pending?.type === 'switch') confirmation = `Switch rental #${rental.id} to car #${pending.carId}? The current car will be released.`;
  if (pending?.type === 'status') confirmation = `Change ${rental.status} to ${pending.status}? This changes car allocation but does not settle payments.`;
  return <section className="rental-actions" aria-label="Rental actions"><h3>Rental actions</h3>
    {error && <p role="alert" className="error-message">{error}</p>}
    {!type && !pending && <div className="rental-action-buttons">{(Object.keys(titles) as ActionType[]).filter(item => active || item === 'status').map(item => <button key={item} className={`rental-command rental-command-${item} ${item === 'end' ? 'btn-soft-danger' : 'btn-soft-primary'}`} disabled={!!error} onClick={() => { setType(item); setError(''); }}><Icon name={actionIcons[item]} />{titles[item]}</button>)}</div>}
    {type && !pending && <ActionForm key={type} rental={rental} type={type} onCancel={() => setType(null)} onConfirm={setPending} />}
    {pending && <div className="rental-action-confirm" role="group" aria-label="Confirm rental action"><p>{confirmation}</p><div className="rental-action-buttons"><button disabled={busy} onClick={() => setPending(null)}><Icon name="left" />Back</button><button className={pending.type === 'end' ? 'btn-danger' : 'btn-primary'} disabled={busy} onClick={() => void execute()}><Icon name="check" />{busy ? 'Applying…' : 'Confirm action'}</button></div></div>}
  </section>;
}
