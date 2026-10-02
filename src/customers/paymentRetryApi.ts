import { apiRequest } from '../api/client';
import { validId } from './customersApi';

export type PaymentSnapshot = { status?: unknown; failureReason?: unknown } | undefined;
export type RetryOutcome = { status: 'Succeeded' | 'Failed'; failureReason: string | null };

// Re-reads the payment before and after the retry. The caller supplies the reader, because a payment is
// reachable from two places (a rental's payments and a customer's paginated payments).
export async function retryPayment(userId: string, paymentId: number, read: () => Promise<PaymentSnapshot>): Promise<RetryOutcome> {
  if (!validId(userId)) throw new Error('Invalid customer ID.');
  if (!Number.isSafeInteger(paymentId) || paymentId < 1) throw new Error('Invalid payment ID.');
  const before = await read();
  if (!before) throw new Error('This payment could not be found. Refresh and try again.');
  if (before.status !== 'Failed') throw new Error('This payment is no longer failed. Refresh before trying again.');
  await apiRequest<unknown>(`/api/admin/users/${encodeURIComponent(userId)}/payments/${paymentId}/retry`, { method: 'POST', cache: 'no-store' });
  // The response shape is not relied on: the stored payment is the source of truth.
  let after: PaymentSnapshot;
  try { after = await read(); } catch { throw new Error('The charge was attempted but its result could not be checked. Refresh payments before trying again.'); }
  if (!after || (after.status !== 'Succeeded' && after.status !== 'Failed')) throw new Error('The retry result is uncertain. Refresh payments before trying again.');
  return { status: after.status, failureReason: typeof after.failureReason === 'string' && after.failureReason ? after.failureReason : null };
}
