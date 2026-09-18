import { useCallback, useEffect, useRef, useState } from 'react';
import { getCar } from './carsApi';
import { getActivity, getCommands, getStatus, sendCommand, toggleActive } from './telematicsApi';
import { useVehicleResource } from './useVehicleResource';
import { usePermissions } from '../permissions/PermissionsContext';
import { ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';

export function VehicleControls({ carId, onChanged }: { carId: number; onChanged?: () => void }) {
  const { can } = usePermissions();
  const load = useCallback(async (signal: AbortSignal) => {
    const [status, activity, car] = await Promise.all([getStatus(carId, signal), getActivity(carId, signal), getCar(carId, signal)]);
    return { status, activity, active: car.isActive === true };
  }, [carId]);
  const [automatic, setAutomatic] = useState(false);
  const resource = useVehicleResource(load, automatic);
  const commands = useVehicleResource(getCommands);
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function execute() {
    if (!pending || lock.current || !can('cars.edit')) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (pending === 'toggle') await toggleActive(carId); else await sendCommand(carId, pending);
      if (alive.current) { setPending(null); setMessage(pending === 'toggle' ? 'Availability updated.' : 'Command accepted.'); resource.refresh(); onChanged?.(); }
    } catch (cause) { if (alive.current) { setError(cause instanceof Error ? cause.message : 'Action failed.'); resource.refresh(); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const data = resource.data;
  return <section className="vehicle-controls"><div className="vehicle-section-heading"><h3>Vehicle status</h3><button disabled={busy || resource.loading} onClick={resource.refresh}>Refresh status</button></div>
    <label><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} /> Auto-refresh status · 10s</label>
    {resource.loading && <LoadingState message="Loading vehicle status…" />}
    {resource.error && <ErrorState message={resource.error} onRetry={resource.refresh} />}
    {data && <dl className="car-details">
      <div><dt>Connection</dt><dd><StatusBadge status={data.status.online ? 'Online' : 'Offline'} /></dd></div>
      <div><dt>Engine</dt><dd>{data.status.engineOn ? 'On' : 'Off'}</dd></div>
      <div><dt>Doors</dt><dd>{data.status.doorsLocked ? 'Locked' : 'Unlocked'}</dd></div>
      <div><dt>Availability</dt><dd>{data.active ? 'Active' : 'Inactive'}</dd></div>
      <div><dt>Speed</dt><dd>{data.status.speed.toFixed(0)} km/h</dd></div>
      <div><dt>Fuel</dt><dd>{data.status.fuelLevel.toFixed(0)}%</dd></div>
      <div><dt>Active rental</dt><dd>{data.status.activeRentalId == null ? '—' : `#${data.status.activeRentalId}`}</dd></div>
      <div><dt>Last activity · Dubai time</dt><dd>{data.activity.lastActivityAt ? new Date(data.activity.lastActivityAt).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' }) : '—'} · {data.activity.event}</dd></div>
    </dl>}
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="error-message">{error}</p>}
    {can('cars.edit') && <>
      {commands.error && <ErrorState message={commands.error} onRetry={commands.refresh} />}
      {commands.loading && <LoadingState message="Loading commands…" />}
      <div className="car-actions">{commands.data?.map(command => <button key={command.code} disabled={busy || !data || resource.loading || !!resource.error} onClick={() => setPending(command.code)}>{command.name}</button>)}
        <button disabled={busy || !data || resource.loading || !!resource.error} onClick={() => setPending('toggle')}>{data?.active ? 'Deactivate car' : 'Activate car'}</button></div>
      {pending && <div className="command-confirm"><p>{pending === 'toggle' ? 'Change this car’s availability?' : `Send “${commands.data?.find(command => command.code === pending)?.name ?? pending}” to this car?`}</p><div className="car-actions"><button disabled={busy} onClick={() => setPending(null)}>Cancel action</button><button disabled={busy} onClick={() => void execute()}>{busy ? 'Sending…' : 'Confirm action'}</button></div></div>}
    </>}
  </section>;
}
