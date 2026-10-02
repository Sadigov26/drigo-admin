import { useCallback, useState } from 'react';
import { usePromotionData } from '../promotions/usePromotionData';
import { read, object } from './fleetApi';
import { Fields, Records } from './FleetShared';
import { usePermissions } from '../permissions/PermissionsContext';
import { ActionDialog } from '../operations/ActionDialog';
import { ErrorState, LoadingState } from '../components/States';

export default function Parking() {
  const state = usePromotionData(useCallback(async (signal: AbortSignal) => {
    const row = object(await read('parking', signal));
    if (!Array.isArray(row.cards)) throw new Error('Parking cards could not be loaded.');
    return { summary: object(row.summary), cards: row.cards.map(object), lastSyncedAt: row.lastSyncedAt };
  }, []));
  const { can } = usePermissions();
  const [confirm, setConfirm] = useState(false), [notice, setNotice] = useState('');
  return <section className="fleet-panel"><div className="fleet-heading"><h2>Parking cards</h2><div className="fleet-actions"><button disabled={state.loading} onClick={state.refresh}>Refresh</button>{can('fleet.edit') && <button className="btn-soft-primary" disabled={state.loading || !!state.error} onClick={() => setConfirm(true)}>Sync parking</button>}</div></div>
    {notice && <p role="status">{notice}</p>}
    {state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={state.refresh} /> : state.data && <><Fields row={{ ...state.data.summary, lastSyncedAt: state.data.lastSyncedAt }} /><Records title="Parking cards" keys={['plateNumber', 'cardNumber', 'balance', 'status']} data={state.data.cards} loading={false} error={null} refresh={state.refresh} filterStatus /></>}
    {confirm && <ActionDialog action={{ title: 'Sync parking', path: 'parking/sync', method: 'POST', initial: {}, fields: [], note: 'Request a parking update and reload the cards?' }} onClose={() => setConfirm(false)} onSaved={() => { setConfirm(false); setNotice('Sync request accepted. Reloading parking cards.'); state.refresh(); }} />}
  </section>;
}
