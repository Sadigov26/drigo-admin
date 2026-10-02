import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { Icon } from '../components/Icon';
import { retryPayment, type PaymentSnapshot, type RetryOutcome } from './paymentRetryApi';
import './retryPayment.css';

type Props = {
  userId: string; paymentId: number; status: unknown; amount: string;
  disabled?: boolean; read: () => Promise<PaymentSnapshot>; onDone: (notice: string, outcome: RetryOutcome) => void; onBusy?: (busy: boolean) => void;
};

// Only failed payments can be retried. The first click asks for confirmation because a retry charges the customer.
export function RetryPayment({ userId, paymentId, status, amount, read, onDone, onBusy, disabled = false }: Props) {
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [uncertain, setUncertain] = useState(false);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  if (status !== 'Failed') return null;
  async function confirm() {
    if (lock.current || uncertain || disabled) return;
    lock.current = true; setBusy(true); onBusy?.(true); setError('');
    try {
      const outcome = await retryPayment(userId, paymentId, read);
      if (!alive.current) return;
      setConfirming(false);
      onDone(outcome.status === 'Succeeded' ? `Payment #${paymentId} succeeded.` : `Payment #${paymentId} failed again${outcome.failureReason ? `: ${outcome.failureReason}` : '.'}`, outcome);
    } catch (cause) {
      if (!alive.current) return;
      setError(cause instanceof Error ? cause.message : 'Unable to retry this payment.');
      // A network failure or 5xx may still have charged the customer, so repeating immediately is blocked.
      if (!(cause instanceof ApiError) || cause.status >= 500 || cause.status < 400) setUncertain(true);
    } finally { lock.current = false; if (alive.current) setBusy(false); onBusy?.(false); }
  }
  if (!confirming) return <button type="button" className="btn-soft-primary" disabled={disabled} onClick={() => { setConfirming(true); setError(''); }}><Icon name="refresh" />Retry payment</button>;
  return <div className="retry-payment" role="group" aria-label={`Retry payment ${paymentId}`}>
    <p>Retry payment #{paymentId} for <strong>{amount}</strong>? A new charge attempt will be made.</p>
    {error && <p role="alert" className="error-message">{error}</p>}
    {uncertain && <p role="alert" className="retry-payment-note">The charge may have been attempted. Close this and refresh payments before trying again.</p>}
    <div className="retry-payment-actions">
      <button type="button" disabled={busy} onClick={() => setConfirming(false)}>Back</button>
      <button type="button" className="btn-primary" disabled={busy || uncertain || disabled} onClick={() => { void confirm(); }}>{busy ? 'Retrying…' : 'Confirm retry'}</button>
    </div>
  </div>;
}
