import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Parking from './Parking';
vi.mock('../permissions/PermissionsContext', () => ({ usePermissions: () => ({ can: () => true }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('requires confirmation for sync and reloads parking cards', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const fetcher = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.endsWith('/sync') ? { success: true } : { summary: { totalZones: 1 }, cards: [{ id: 1, plateNumber: 'A12', balance: 20, status: 'Active' }], lastSyncedAt: '2026-10-01T00:00:00Z' }))));
  vi.stubGlobal('fetch', fetcher);
  await render(<Parking />);
  await screen.findByText('A12');
  fireEvent.click(screen.getByRole('button', { name: 'Sync parking' }));
  expect(fetcher).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Review change' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  expect(fetcher.mock.calls[1][1].method).toBe('POST');
});
