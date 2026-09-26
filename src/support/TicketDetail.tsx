import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';
import { CustomerImage, date } from '../customers/CustomerDetails';
import { RecordDetails } from '../fines/RecordDetails';
import { actOnTicket, context, messages, operators, statuses, suggestions, templates, ticket, type Action } from './supportApi';
import { useSupportData } from './useSupportData';
import '../fines/fines.css';

function LoadPanel({ state, children }: { state: { loading: boolean; error: string | null; refresh: () => void }; children: ReactNode }) {
  return state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={state.refresh} /> : <>{children}</>;
}
export function TicketDetail({ id, unread, canEdit, onChanged, onBusy }: { id: number; unread: number; canEdit: boolean; onChanged: () => void; onBusy: (value: boolean) => void }) {
  const detail = useSupportData(useCallback((signal: AbortSignal) => ticket(id, signal), [id]));
  const chat = useSupportData(useCallback((signal: AbortSignal) => messages(id, signal), [id]));
  const member = useSupportData(useCallback((signal: AbortSignal) => context(id, signal), [id]));
  const replies = useSupportData(templates);
  const ai = useSupportData(useCallback((signal: AbortSignal) => suggestions(id, signal), [id]));
  const admins = useSupportData(useCallback((signal: AbortSignal) => canEdit ? operators(signal) : Promise.resolve([]), [canEdit]));
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [operator, setOperator] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [unreadCount, setUnreadCount] = useState(unread);
  const locked = useRef(false);
  const alive = useRef(true);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setUnreadCount(unread); }, [unread]);
  useEffect(() => { if (detail.data) { setStatus(detail.data.status); setOperator(detail.data.operatorId ?? ''); } }, [detail.data]);
  useEffect(() => { if (chat.data && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [chat.data]);
  function refresh() { detail.refresh(); chat.refresh(); member.refresh(); onChanged(); }
  async function submit(action: Action) {
    if (locked.current || !canEdit || uncertain || !detail.data || chat.loading || chat.error) return;
    locked.current = true; setBusy(true); onBusy(true); setError(''); setNotice('');
    try {
      await actOnTicket(id, action);
      if (!alive.current) return;
      if (action.type === 'reply') { setDraft(''); setUnreadCount(0); }
      setNotice(action.type === 'reply' ? 'Reply sent.' : 'Ticket updated.');
      refresh();
    } catch (cause) {
      if (alive.current) {
        setError(cause instanceof Error ? cause.message : 'Unable to update ticket.');
        setUncertain(true); refresh();
      }
    } finally { locked.current = false; if (alive.current) { setBusy(false); onBusy(false); } }
  }
  const disabled = busy || uncertain || detail.loading || !!detail.error || chat.loading || !!chat.error;
  const addDraft = (text: string) => { setDraft(value => value ? `${value}\n${text}` : text); setNotice('Draft updated. Review before sending.'); };
  return <div className="support-detail">
    <div className="support-ticket-heading"><div><h3>{detail.data?.memberName ?? 'Customer conversation'}</h3><p>{String(detail.data?.reasonName ?? '—')} · {String(detail.data?.memberPhone ?? '—')}</p></div><div>{detail.data && <StatusBadge status={detail.data.status} />}{unreadCount > 0 && <span className="support-unread">{unreadCount} unread</span>}</div><button onClick={refresh} disabled={busy}><Icon name="refresh" />Refresh conversation</button></div>
    <LoadPanel state={detail}>{detail.data && <div className="support-controls">
      {canEdit ? <><label>Status<select value={status} onChange={event => setStatus(event.target.value)} disabled={disabled}>{!statuses.some(value => value === status) && <option>{status}</option>}{statuses.map(value => <option key={value}>{value}</option>)}</select></label><button disabled={disabled || status === detail.data.status} onClick={() => void submit({ type: 'status', status })}>Update status</button>
        <LoadPanel state={admins}><label>Operator<select value={operator} onChange={event => setOperator(event.target.value)} disabled={disabled}><option value="">Choose operator</option>{admins.data?.map(row => <option value={row.id} key={row.id}>{row.fullName || row.username}</option>)}</select></label><button disabled={disabled || !operator || operator === detail.data.operatorId} onClick={() => void submit({ type: 'assign', operatorId: operator })}>Assign</button></LoadPanel>
        <button disabled={disabled} aria-pressed={detail.data.isMuted} onClick={() => void submit({ type: 'mute', isMuted: !detail.data!.isMuted })}>{detail.data.isMuted ? 'Unmute notifications' : 'Mute notifications'}</button></> : <p>Read-only access · {String(detail.data.operatorName ?? 'Unassigned')} · {detail.data.isMuted ? 'Muted' : 'Notifications on'}</p>}
    </div>}</LoadPanel>
    {notice && <p role="status" className="support-notice">{notice}</p>}{error && <p role="alert" className="error-message">{error}</p>}
    {uncertain && <div className="support-warning"><p>The result may be uncertain. Check the refreshed conversation before sending again; a failed response does not always mean the message was not saved.</p><button disabled={busy || detail.loading || chat.loading || !!detail.error || !!chat.error} onClick={() => { setUncertain(false); setError(''); }}>I checked the refreshed conversation</button></div>}
    <div className="support-workspace"><section className="support-chat" aria-label="Conversation">
      <h3>Conversation</h3><div className="support-messages" ref={scroller} role="region" aria-label="Message history" tabIndex={0}>
        <LoadPanel state={chat}>{chat.data?.length ? chat.data.map(message => <article key={message.id} className={`support-message ${message.isBot ? 'is-bot' : message.isOperator ? 'is-operator' : 'is-customer'}`}>
          <header><strong>{message.isBot ? 'Automated assistant' : message.isOperator ? message.operatorName || message.createdBy || 'Operator' : message.createdBy || detail.data?.memberName || 'Customer'}</strong><time dateTime={message.createdAt}>{date(message.createdAt)}</time></header>
          <p>{message.message}</p>{message.mediaUrl && <div className="incident-photos"><CustomerImage value={message.mediaUrl} title={`Message #${message.id} attachment`} /></div>}
          <small>#{message.id}{message.isBot && message.botMessageKind ? ` · ${String(message.botMessageKind)}` : ''}</small>
        </article>) : <EmptyState message="No messages yet." />}</LoadPanel>
      </div>
      {canEdit && <form className="support-composer" onSubmit={event => { event.preventDefault(); void submit({ type: 'reply', message: draft }); }}>
        <label htmlFor={`reply-${id}`}>Reply to customer</label><textarea id={`reply-${id}`} value={draft} maxLength={5000} disabled={busy} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!disabled && draft.trim()) void submit({ type: 'reply', message: draft }); } }} />
        <div><small>Enter to send · Shift+Enter for a new line · {draft.length}/5000</small><button className="btn-primary" disabled={disabled || !draft.trim() || draft.length > 5000}>{busy ? 'Saving…' : 'Send reply'}</button></div>
      </form>}
      {canEdit && <div className="support-assistance"><details><summary>Saved replies</summary><LoadPanel state={replies}>{replies.data?.length ? replies.data.map(row => <div className="support-suggestion" key={row.id}><strong>{row.title}</strong><small>{row.category}</small><p>{row.body}</p><button disabled={busy} onClick={() => addDraft(row.body)}>Use template</button></div>) : <EmptyState message="No saved replies." />}</LoadPanel></details>
        <details><summary>AI suggestions</summary><p>Suggestions are drafts, not verified resolutions. Review the customer's context before sending.</p><LoadPanel state={ai}>{ai.data?.length ? ai.data.map(row => <div className="support-suggestion" key={row.id}><p>{row.text}</p>{Number.isFinite(row.confidence) && <small>Model confidence: {Math.round(row.confidence * 100)}%</small>}<button disabled={busy} onClick={() => addDraft(row.text)}>Use this</button></div>) : <EmptyState message="No suggestions available." />}</LoadPanel></details></div>}
    </section><aside className="support-context" aria-label="Customer context"><h3>Customer context</h3><LoadPanel state={member}>
      {member.data && Object.entries(member.data).sort(([a], [b]) => {
        const order = ['outstandingDebt', 'activeRental', 'verification', 'member', 'flags', 'recentPayments', 'ticketHistory', 'manualFines'];
        return (order.includes(a) ? order.indexOf(a) : 99) - (order.includes(b) ? order.indexOf(b) : 99);
      }).map(([key, value]) => {
        const heading: Record<string, string> = { member: 'Customer', verification: 'Verification', activeRental: 'Active rental', outstandingDebt: 'Outstanding debt', recentPayments: 'Recent payments', ticketHistory: 'Other tickets', manualFines: 'Manual fines', flags: 'Account flags' };
        const contents = value == null ? <p>None</p> : Array.isArray(value) ? value.length ? value.map((row, index) => <div className="support-context-record" key={index}><RecordDetails row={row} /></div>) : <p>None</p> : typeof value === 'object' ? <RecordDetails row={value as Record<string, unknown>} /> : <p>{String(value)}</p>;
        return ['verification', 'activeRental', 'outstandingDebt'].includes(key) ? <section className="support-context-card" key={key}><h4>{heading[key] ?? key}</h4>{contents}</section> : <details className="support-context-card" key={key}><summary>{heading[key] ?? key}{Array.isArray(value) ? ` (${value.length})` : ''}</summary>{contents}</details>;
      })}
    </LoadPanel>{detail.data && <details className="support-context-card"><summary>Ticket details</summary><RecordDetails row={detail.data} /></details>}</aside></div>
  </div>;
}
