const tones: Record<string, string> = {
  Active: 'success', Connected: 'success', Online: 'success', Verified: 'success',
  Succeeded: 'success', Approved: 'success', Granted: 'success',
  Pending: 'warning', Checking: 'warning', PaymentPending: 'warning', Review: 'warning',
  UnderReview: 'warning', Busy: 'warning',
  Cancelled: 'danger', Offline: 'danger', Blocked: 'danger', Failed: 'danger', Accident: 'danger',
  Completed: 'info', Started: 'info', DriverAssigned: 'info', PickingUp: 'info',
  InDelivery: 'info', Delivered: 'info', Confirmed: 'info', Billed: 'info',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${tones[status] ?? 'neutral'}`}>{status || 'Unknown'}</span>;
}
