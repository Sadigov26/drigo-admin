import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Customers from './Customers';
import CustomerDetails, { CustomerImage } from './CustomerDetails';
import { Modal } from '../components/Modal';
import { allowedActions, customerStatus, getCustomer, getCustomers, parseCustomer, performCustomerAction } from './customersApi';

const id = '11111111-1111-4111-8111-111111111111';
const base = { id, fullName: 'Test Customer', phoneNumber: '+971123456', email: null, createdAt: '2026-09-01T10:00:00Z', isApproved: false, isVerified: false, isBlocked: false, isDeleted: false, passportDetail: { status: 'Pending', frontUrl: 'javascript:alert(1)' }, faceVerifyDetail: null, referralDetail: null };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
let editable = true;
vi.mock('../permissions/PermissionsContext', () => ({ usePermissions: () => ({ can: () => editable }) }));
beforeEach(() => {
  editable = true;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('renders backend photo previews without cropping and handles image failures', () => {
  render(<CustomerImage value="https://example.com/passport.jpg" title="Passport front" />);
  const image = screen.getByRole('img', { name: 'Passport front' });
  expect(image.getAttribute('src')).toBe('https://example.com/passport.jpg');
  expect(image.getAttribute('referrerpolicy')).toBe('no-referrer');
  fireEvent.error(image);
  expect(screen.queryByRole('img')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry image' }));
  fireEvent.load(screen.getByRole('img'));
  expect(screen.queryByText('Loading image…')).toBeNull();
});
it('enlarges a document in a dialog without navigating away and closes with Escape', () => {
  const closeParent = vi.fn();
  render(<Modal isOpen title="Customer details" onClose={closeParent}><CustomerImage value="https://example.com/passport.jpg" title="Passport front" /></Modal>);
  const trigger = screen.getByRole('button', { name: 'Enlarge passport front' });
  trigger.focus();
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Passport front' })).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Passport front enlarged' })).toBeTruthy();
  expect(screen.queryByRole('link')).toBeNull();
  fireEvent(screen.getByRole('dialog', { name: 'Passport front' }), new Event('cancel', { bubbles: false, cancelable: true }));
  expect(screen.queryByRole('dialog', { name: 'Passport front' })).toBeNull();
  expect(closeParent).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(trigger);
});
it('does not request missing or unsafe image URLs', () => {
  const { rerender } = render(<CustomerImage value={null} title="Profile photo" />);
  expect(screen.getByText('No image uploaded')).toBeTruthy();
  rerender(<CustomerImage value="javascript:alert(1)" title="Profile photo" />);
  expect(screen.getByText('Unavailable')).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
});

it('uses approved filter, encoded search and cookie requests', async () => {
  const fetcher = vi.fn().mockResolvedValue(json({ data: [base], total: 1, page: 1, pageSize: 10 }));
  vi.stubGlobal('fetch', fetcher);
  await getCustomers({ page: 1, pageSize: 10, search: 'a&b', approvalStatus: 'approved', sortBy: 'fullName', sortOrder: 'asc' });
  expect(String(fetcher.mock.calls[0][0])).toContain('approvalStatus=approved');
  expect(String(fetcher.mock.calls[0][0])).toContain('search=a%26b');
  expect(fetcher.mock.calls[0][1].credentials).toBe('include');
});
it('validates IDs, payloads and overlapping account states', async () => {
  await expect(getCustomer('../users')).rejects.toThrow('UUID');
  expect(() => parseCustomer({ ...base, isApproved: 'yes' })).toThrow();
  expect(customerStatus({ ...base, isApproved: true, isBlocked: true })).toBe('Blocked');
  expect(allowedActions({ ...base, isDeleted: true })).toEqual(['restore']);
  expect(allowedActions({ ...base, isBlocked: true })).not.toContain('approve');
});
it.each([
  ['approve', 'PUT', '/verify', { approve: true }],
  ['reject', 'PUT', '/verify', { approve: false, rejectionReason: 'Check document' }],
  ['block', 'PATCH', '/block', { blocked: true, reason: 'Check document' }],
  ['delete', 'DELETE', '', undefined],
  ['restore', 'POST', '/restore', undefined],
] as const)('sends the real %s contract after a fresh state check', async (action, method, suffix, body) => {
  const fetcher = vi.fn().mockResolvedValueOnce(json({ ...base, isDeleted: action === 'restore' })).mockResolvedValueOnce(json({ success: true }));
  vi.stubGlobal('fetch', fetcher);
  await performCustomerAction(id, action, 'Check document');
  expect(fetcher.mock.calls[1][0]).toContain(`/users/${id}${suffix}`);
  expect(fetcher.mock.calls[1][1].method).toBe(method);
  expect(fetcher.mock.calls[1][1].body).toBe(body ? JSON.stringify(body) : undefined);
});
it('does not approve a record that changed while confirmation was open', async () => {
  const fetcher = vi.fn().mockResolvedValue(json({ ...base, isBlocked: true })); vi.stubGlobal('fetch', fetcher);
  await expect(performCustomerAction(id, 'approve', '')).rejects.toThrow('state changed');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('opens a customer from the row, guards nulls and unsafe document URLs', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => json(url.includes('?') ? { data: [base], total: 1, page: 1, pageSize: 10 } : base)));
  render(<Customers />);
  fireEvent.click(await screen.findByText('+971123456'));
  await screen.findByRole('heading', { name: 'Personal information' });
  fireEvent.click(screen.getByRole('button', { name: 'Documents' }));
  expect(screen.getByText('Unavailable')).toBeTruthy();
  expect(screen.queryByRole('link')).toBeNull();
});
it('confirms once, refreshes approval and hides approve after success', async () => {
  let approved = false;
  const fetcher = vi.fn(async (_url: string, options: RequestInit) => {
    if (options.method === 'PUT') { approved = true; return json({ success: true }); }
    return json({ ...base, isApproved: approved, isVerified: approved });
  });
  vi.stubGlobal('fetch', fetcher);
  const changed = vi.fn();
  render(<CustomerDetails id={id} canEdit canDelete onBusy={() => {}} onChanged={changed} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Approve customer' }));
  expect(fetcher.mock.calls.filter(call => call[1].method === 'PUT')).toHaveLength(0);
  const confirm = screen.getByRole('button', { name: 'Confirm action' });
  fireEvent.click(confirm); fireEvent.click(confirm);
  await screen.findByText('Approved');
  expect(changed).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls.filter(call => call[1].method === 'PUT')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Approve customer' })).toBeNull();
});
it('shows server errors without claiming success and requires refresh', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => options.method === 'DELETE' ? json({ message: 'Conflict' }, 409) : json(base)));
  render(<CustomerDetails id={id} canEdit canDelete onBusy={() => {}} onChanged={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete customer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Conflict'));
  expect((screen.getByRole('button', { name: 'Delete customer' }) as HTMLButtonElement).disabled).toBe(true);
});
it('keeps read-only users from account actions', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(base)));
  render(<CustomerDetails id={id} canEdit={false} canDelete={false} onBusy={() => {}} onChanged={() => {}} />);
  await screen.findByRole('heading', { name: 'Personal information' });
  expect(screen.queryByRole('button', { name: 'Approve customer' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Delete customer' })).toBeNull();
});
