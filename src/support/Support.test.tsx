import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as api from './supportApi';
import { TicketDetail } from './TicketDetail';
vi.mock('./supportApi', async importOriginal => ({ ...await importOriginal<typeof api>(), ticket: vi.fn(), messages: vi.fn(), context: vi.fn(), templates: vi.fn(), suggestions: vi.fn(), operators: vi.fn(), actOnTicket: vi.fn() }));
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.ticket).mockResolvedValue({ id: 1, memberName: 'Customer', status: 'Open', isMuted: false, operatorId: null });
  vi.mocked(api.messages).mockResolvedValue([]);
  vi.mocked(api.context).mockResolvedValue({ activeRental: null, outstandingDebt: { total: 20, currency: 'AED' } });
  vi.mocked(api.operators).mockResolvedValue([{ id: 'operator', fullName: 'Support operator', username: 'operator' }]);
  vi.mocked(api.templates).mockResolvedValue([{ id: 1, title: 'Greeting', body: 'Hello customer', category: 'General' }]);
  vi.mocked(api.suggestions).mockResolvedValue([{ id: 1, text: 'Suggested response', confidence: 0.9 }]);
  vi.mocked(api.actOnTicket).mockResolvedValue(undefined);
});
function setup(canEdit = true) { const changed = vi.fn(); render(<TicketDetail id={1} unread={2} canEdit={canEdit} onChanged={changed} onBusy={vi.fn()} />); return changed; }
it('templates and suggestions only update draft; Enter sends and refreshes', async () => {
  const changed = setup();
  await screen.findByText('No messages yet.');
  fireEvent.click(screen.getByText('Saved replies'));
  fireEvent.click(screen.getByRole('button', { name: 'Use template' }));
  const input = screen.getByLabelText('Reply to customer') as HTMLTextAreaElement;
  expect(input.value).toBe('Hello customer');
  expect(api.actOnTicket).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('AI suggestions'));
  fireEvent.click(screen.getByRole('button', { name: 'Use this' }));
  expect(input.value).toContain('Suggested response');
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
  expect(api.actOnTicket).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(changed).toHaveBeenCalled());
  expect(api.actOnTicket).toHaveBeenCalledTimes(1);
  expect(input.value).toBe('');
  await waitFor(() => expect(api.messages).toHaveBeenCalledTimes(2));
});
it('prevents double submit and retains draft after uncertain failure', async () => {
  let reject!: (error: Error) => void;
  vi.mocked(api.actOnTicket).mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  setup(); await screen.findByText('No messages yet.');
  const input = screen.getByLabelText('Reply to customer') as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: 'Reply' } });
  const button = screen.getByRole('button', { name: 'Send reply' });
  fireEvent.click(button); fireEvent.click(button);
  expect(api.actOnTicket).toHaveBeenCalledTimes(1);
  reject(new Error('Connection lost'));
  await screen.findByText('Connection lost');
  expect(input.value).toBe('Reply');
  expect((screen.getByRole('button', { name: 'Send reply' }) as HTMLButtonElement).disabled).toBe(true);
  await waitFor(() => expect((screen.getByRole('button', { name: 'I checked the refreshed conversation' }) as HTMLButtonElement).disabled).toBe(false));
});
it('keeps context usable when messages fail and supports retry', async () => {
  vi.mocked(api.messages).mockRejectedValueOnce(new Error('Chat unavailable'));
  setup(); await screen.findByText('Chat unavailable');
  expect(screen.getByText('Outstanding debt')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('No messages yet.');
});
it('read-only users see the conversation without mutation controls', async () => {
  setup(false); await screen.findByText('No messages yet.');
  expect(screen.queryByLabelText('Reply to customer')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Assign' })).toBeNull();
  expect(api.operators).not.toHaveBeenCalled();
});
