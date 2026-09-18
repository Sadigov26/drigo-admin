import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getActivity, getCommands, getPoints, getProblems, getStatus, getTracking, parsePoints, parseTracking, sendCommand, toggleActive } from './telematicsApi';
import { useVehicleResource } from './useVehicleResource';
import { VehicleControls } from './VehicleControls';
import { SESSION_EXPIRED_EVENT } from '../api/client';
const permission = vi.hoisted(() => ({ edit: true }));
vi.mock('../permissions/PermissionsContext', () => ({ usePermissions: () => ({ can: () => permission.edit }) }));
const tracked = { id: 1, plateNumber: 'TEST', brandName: 'Toyota', modelName: 'Yaris', latitude: 25, longitude: 55, speed: 0, fuelLevel: 15.99, status: 'Available', online: true };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); permission.edit = true; });
describe('telematics contracts', () => {
  it('validates coordinate ranges and duplicate IDs', () => {
    expect(parseTracking([tracked])[0].latitude).toBe(25);
    expect(() => parseTracking([{ ...tracked, latitude: 91 }])).toThrow();
    expect(() => parseTracking([tracked, tracked])).toThrow();
    expect(() => parseTracking([{ ...tracked, online: null }])).toThrow();
  });
  it('orders GPS points chronologically without swapping lat/lng', () => {
    const points = parsePoints([{ latitude: 25, longitude: 55, speed: 0, at: '2026-09-17T12:00:00Z' }, { latitude: 24, longitude: 54, speed: 1, at: '2026-09-17T11:00:00Z' }]);
    expect(points.map(p => [p.latitude, p.longitude])).toEqual([[24, 54], [25, 55]]);
    expect(() => parsePoints([{ latitude: 25, longitude: 55, speed: 0, at: 'bad' }])).toThrow();
  });
  it('maps actual problematic issues and guards null plate and zero fuel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([{ id: 1, plateNumber: null, brandName: 'Toyota', modelName: 'Yaris', isActive: false, activeRentalId: null, fuelLevel: 0, issues: ['Low fuel', 'Offline'] }])));
    const rows = await getProblems(new AbortController().signal);
    expect(rows[0].issueText).toBe('Low fuel, Offline'); expect(rows[0].fuelLevel).toBe(0);
  });
  it('uses real paths and cookie client for all reads', async () => {
    const fn = vi.fn(async (input: RequestInfo | URL, _options?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/tracking')) return json([tracked]);
      if (url.endsWith('/gps-points')) return json([]);
      if (url.endsWith('/status')) return json({ carId: 1, engineOn: false, doorsLocked: true, online: true, speed: 0, fuelLevel: 0, activeRentalId: null });
      if (url.endsWith('/last-activity')) return json({ carId: 1, lastActivityAt: null, event: 'Parked' });
      return json([{ code: 'lock', name: 'Lock doors' }]);
    });
    vi.stubGlobal('fetch', fn); const signal = new AbortController().signal;
    await getTracking(signal); await getPoints(1, signal); await getStatus(1, signal); await getActivity(1, signal); await getCommands(signal);
    expect(fn).toHaveBeenCalledTimes(5);
    for (const call of fn.mock.calls) expect((call as unknown as [unknown, RequestInit])[1].credentials).toBe('include');
  });
  it('sends commands as POST and only toggles through the explicit endpoint', async () => {
    const fn = vi.fn().mockResolvedValueOnce(json({ success: true, command: 'lock' })).mockResolvedValueOnce(json({ success: true, isActive: false })); vi.stubGlobal('fetch', fn);
    await sendCommand(1, 'lock'); await toggleActive(1);
    expect(fn.mock.calls[0][1].method).toBe('POST'); expect(JSON.parse(fn.mock.calls[0][1].body)).toEqual({ command: 'lock' });
    expect(fn.mock.calls[1][0]).toContain('/1/toggle-active'); expect(fn.mock.calls[1][1].cache).toBe('no-store');
  });
  it('rejects mismatched IDs and propagates expired sessions', async () => {
    const fn = vi.fn().mockResolvedValueOnce(json({ carId: 2 })).mockResolvedValueOnce(json({ message: 'Not authenticated' }, 401)); vi.stubGlobal('fetch', fn);
    await expect(getStatus(1, new AbortController().signal)).rejects.toThrow('mismatch');
    const listener = vi.fn(); window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    try { await expect(getTracking(new AbortController().signal)).rejects.toThrow('Not authenticated'); expect(listener).toHaveBeenCalledOnce(); }
    finally { window.removeEventListener(SESSION_EXPIRED_EVENT, listener); }
  });
});
describe('vehicle request lifecycle', () => {
  it('clears polling and aborts requests on unmount', async () => {
    vi.useFakeTimers();
    const load = vi.fn(async (_signal: AbortSignal) => [1]);
    const hook = renderHook(() => useVehicleResource(load, true));
    await act(async () => {}); expect(load).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); }); expect(load).toHaveBeenCalledTimes(2);
    hook.unmount(); expect(load.mock.calls[0][0].aborted).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); }); expect(load).toHaveBeenCalledTimes(2);
  });
  it('ignores an old response after loader changes', async () => {
    let resolveOld!: (value: string) => void;
    const old = () => new Promise<string>(resolve => { resolveOld = resolve; });
    const fresh = async () => 'new';
    const hook = renderHook(({ load }) => useVehicleResource(load), { initialProps: { load: old } });
    hook.rerender({ load: fresh }); await waitFor(() => expect(hook.result.current.data).toBe('new'));
    await act(async () => resolveOld('old')); expect(hook.result.current.data).toBe('new');
  });
});
describe('vehicle actions', () => {
  function setup() {
    let engine = false;
    const fn = vi.fn(async (input: RequestInfo | URL, _options?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/commands')) return json([{ code: 'engine_on', name: 'Enable engine' }]);
      if (url.endsWith('/send-command')) { engine = true; return json({ success: true, command: 'engine_on' }); }
      if (url.endsWith('/status')) return json({ carId: 1, engineOn: engine, doorsLocked: !engine, online: true, speed: 0, fuelLevel: 80, activeRentalId: null });
      if (url.endsWith('/last-activity')) return json({ carId: 1, lastActivityAt: null, event: engine ? 'Driving' : 'Parked' });
      return json({ id: 1, isActive: true });
    }); vi.stubGlobal('fetch', fn); render(<VehicleControls carId={1} />); return fn;
  }
  it('confirms and re-fetches state after sending a command', async () => {
    const fn = setup(); await screen.findByText('Off');
    fireEvent.click(screen.getByRole('button', { name: 'Enable engine' }));
    expect(fn.mock.calls.some(call => call[1]?.method === 'POST')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }));
    await screen.findByText('On'); expect(screen.getByText('Unlocked')).toBeTruthy();
    expect(fn.mock.calls.filter(call => String(call[0]).endsWith('/status'))).toHaveLength(2);
  });
  it('hides mutations without edit permission', async () => {
    permission.edit = false; setup(); await screen.findByText('Off');
    expect(screen.queryByRole('button', { name: 'Enable engine' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Deactivate car' })).toBeNull();
  });
});
