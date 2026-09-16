import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SESSION_EXPIRED_EVENT } from '../api/client';
import { getFleet, getOnlineUsers, getRecentActivity } from './operationsApi';
import { useDashboardResource } from './useDashboardResource';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('does not let an old response overwrite the latest refresh', async () => {
  const requests: { signal: AbortSignal; resolve: (value: number) => void }[] = [];
  const load = (signal: AbortSignal) => new Promise<number>(resolve => requests.push({ signal, resolve }));
  const { result, rerender } = renderHook(({ version }) => useDashboardResource(load, version), { initialProps: { version: 0 } });
  rerender({ version: 1 });
  expect(requests[0].signal.aborted).toBe(true);
  await act(async () => { requests[1].resolve(20); });
  expect(result.current.state).toMatchObject({ status: 'ready', data: 20 });
  await act(async () => { requests[0].resolve(10); });
  expect(result.current.state).toMatchObject({ status: 'ready', data: 20 });
});

it.each([
  ['fleet', getFleet], ['online users', getOnlineUsers], ['recent activity', getRecentActivity],
] as const)('expires the session when %s returns 401', async (_name, request) => {
  const expired = vi.fn();
  window.addEventListener(SESSION_EXPIRED_EVENT, expired);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Session expired' }), { status: 401 })));
  try {
    await expect(request(new AbortController().signal)).rejects.toThrow('Session expired');
    expect(expired).toHaveBeenCalledOnce();
  } finally {
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  }
});
