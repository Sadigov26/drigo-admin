import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { retryPayment } from './paymentRetryApi';
import { RetryPayment } from './RetryPayment';

const USER = '11111111-2222-3333-4444-555555555555';
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('posts the retry to the customer payment endpoint and reports the stored result', async () => {
  const fetcher = vi.fn().mockResolvedValue(json({ success: true })); vi.stubGlobal('fetch', fetcher);
  const read = vi.fn().mockResolvedValueOnce({ status: 'Failed' }).mockResolvedValueOnce({ status: 'Succeeded' });
  await expect(retryPayment(USER, 7, read)).resolves.toEqual({ status: 'Succeeded', failureReason: null });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe(`http://localhost:4000/api/admin/users/${USER}/payments/7/retry`);
  expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include', cache: 'no-store' });
});
it('reports a payment that fails again with its reason', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({})));
  const read = vi.fn().mockResolvedValueOnce({ status: 'Failed' }).mockResolvedValueOnce({ status: 'Failed', failureReason: 'Card declined' });
  await expect(retryPayment(USER, 7, read)).resolves.toEqual({ status: 'Failed', failureReason: 'Card declined' });
});
it.each([{ status: 'Succeeded' }, undefined])('does not post when the payment is not failed (%o)', async current => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(retryPayment(USER, 7, async () => current)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([['not-a-uuid', 7], [USER, 0], [USER, 1.5]])('rejects invalid ids without a request (%s, %s)', async (user, payment) => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(retryPayment(user, payment, async () => ({ status: 'Failed' }))).rejects.toThrow('Invalid');
  expect(fetcher).not.toHaveBeenCalled();
});
it('treats an unreadable result as uncertain instead of guessing', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({})));
  const read = vi.fn().mockResolvedValueOnce({ status: 'Failed' }).mockResolvedValueOnce({ status: 'Pending' });
  await expect(retryPayment(USER, 7, read)).rejects.toThrow('uncertain');
});

const props = { userId: USER, paymentId: 7, amount: '25.00 AED' };
it('shows nothing for payments that did not fail', () => {
  const { container } = render(<RetryPayment {...props} status="Succeeded" read={async () => undefined} onDone={() => undefined} />);
  expect(container.innerHTML).toBe('');
});
it('asks for confirmation before any request, then reports the outcome', async () => {
  const fetcher = vi.fn().mockResolvedValue(json({ success: true })); vi.stubGlobal('fetch', fetcher);
  const read = vi.fn().mockResolvedValueOnce({ status: 'Failed' }).mockResolvedValueOnce({ status: 'Succeeded' });
  const done = vi.fn();
  render(<RetryPayment {...props} status="Failed" read={read} onDone={done} />);
  fireEvent.click(screen.getByRole('button', { name: /Retry payment/ }));
  expect(screen.getByText(/25.00 AED/)).toBeTruthy();
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm retry' }));
  await waitFor(() => expect(done).toHaveBeenCalledWith('Payment #7 succeeded.', { status: 'Succeeded', failureReason: null }));
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('blocks an immediate repeat after a server error because the charge may have happened', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ message: 'Gateway down' }, 502)));
  render(<RetryPayment {...props} status="Failed" read={async () => ({ status: 'Failed' })} onDone={() => undefined} />);
  fireEvent.click(screen.getByRole('button', { name: /Retry payment/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm retry' }));
  expect((await screen.findAllByRole('alert')).length).toBe(2);
  expect((screen.getByRole('button', { name: 'Confirm retry' }) as HTMLButtonElement).disabled).toBe(true);
});
it('lets the admin try again after a client error such as 409', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ message: 'Already processing' }, 409)));
  render(<RetryPayment {...props} status="Failed" read={async () => ({ status: 'Failed' })} onDone={() => undefined} />);
  fireEvent.click(screen.getByRole('button', { name: /Retry payment/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm retry' }));
  expect(await screen.findByText('Already processing')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Confirm retry' }) as HTMLButtonElement).disabled).toBe(false);
});
it('does not treat a post-charge read failure as a safe client error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ success: true })));
  const read = vi.fn().mockResolvedValueOnce({ status: 'Failed' }).mockRejectedValueOnce(new Error('Read unavailable'));
  await expect(retryPayment(USER, 7, read)).rejects.toThrow('charge was attempted');
});
