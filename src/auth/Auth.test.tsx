import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';

const admin = { id: 'admin-id', username: 'admin', fullName: 'Test Admin', email: 'admin@example.test', isSuperAdmin: true };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

let authenticated = false;
let failLogout = false;
const fetchMock = vi.fn<typeof fetch>();

function open(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

async function submitLogin() {
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: 'Sign in' });
  await user.type(screen.getByLabelText('Username'), 'admin');
  await user.type(screen.getByLabelText('Password'), 'admin123');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByRole('heading', { name: 'Verify your sign-in' });
  return user;
}

beforeEach(() => {
  authenticated = false;
  failLogout = false;
  localStorage.clear();
  sessionStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input, options) => {
    const path = new URL(String(input)).pathname;
    const body = options?.body ? JSON.parse(String(options.body)) : {};
    if (path === '/api/admin/auth/me') return authenticated ? json(admin) : json({ message: 'Not authenticated' }, 401);
    if (path === '/api/admin/auth/login') return body.password === 'admin123'
      ? json({ username: body.username }) : json({ message: 'Invalid username or password' }, 401);
    if (path === '/api/admin/auth/verify') {
      if (body.code !== '123456') return json({ message: 'Invalid verification code' }, 401);
      authenticated = true;
      return json({ isVerified: true, email: admin.email });
    }
    if (path === '/api/admin/auth/logout') {
      if (failLogout) return json({ message: 'Please try again later' }, 503);
      authenticated = false;
      return json({ success: true });
    }
    if (path === '/api/health') return json({ status: 'ok' });
    if (path === '/api/admin/permissions/my-permissions') return json({ adminId: admin.id, isSuperAdmin: true, permissionCodes: ['dashboard.view'] });
    throw new Error('Unexpected test request: ' + path);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('cookie authentication UI', () => {
  it('waits for /me before rendering either the panel or login', async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
    open();
    expect(screen.getByRole('status').textContent).toContain('Checking your session');
    expect(screen.queryByRole('heading', { name: 'Overview' })).toBeNull();
    expect(screen.queryByLabelText('Password')).toBeNull();
    await act(async () => { resolve(json({ message: 'Not authenticated' }, 401)); });
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
  });

  it('keeps wrong-password errors on the login form', async () => {
    open();
    const user = userEvent.setup();
    await screen.findByLabelText('Username');
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid username or password');
    expect(screen.queryByRole('heading', { name: 'Overview' })).toBeNull();
  });

  it('handles a wrong OTP, then confirms /me before opening the panel', async () => {
    open();
    const user = await submitLogin();
    await user.type(screen.getByLabelText('Verification code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify and sign in' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid verification code');
    await user.clear(screen.getByLabelText('Verification code'));
    await user.type(screen.getByLabelText('Verification code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify and sign in' }));
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeTruthy();
    expect(screen.getByText(admin.fullName)).toBeTruthy();
    const paths = fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname);
    expect(paths.slice(paths.lastIndexOf('/api/admin/auth/verify'), paths.lastIndexOf('/api/admin/auth/verify') + 2))
      .toEqual(['/api/admin/auth/verify', '/api/admin/auth/me']);
    expect(fetchMock.mock.calls.every(([, options]) => options?.credentials === 'include')).toBe(true);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('restores an existing session on refresh, including when opening /login', async () => {
    authenticated = true;
    open('/login');
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeTruthy();
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('does not grant access if OTP succeeds but /me returns 401', async () => {
    open();
    const user = await submitLogin();
    fetchMock.mockResolvedValueOnce(json({ isVerified: true }));
    await user.type(screen.getByLabelText('Verification code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify and sign in' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Overview' })).toBeNull();
  });

  it('shows a retry screen for network errors instead of claiming the session expired', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    open();
    expect(await screen.findByRole('heading', { name: 'Unable to connect' })).toBeTruthy();
    expect(screen.queryByLabelText('Password')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
  });

  it('returns direct OTP access to login without a pending username', async () => {
    open('/verify');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
  });

  it('does not claim successful logout if the server rejects it, and allows retry', async () => {
    authenticated = true;
    failLogout = true;
    open();
    await screen.findByRole('heading', { name: 'Overview' });
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Please try again later');
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeTruthy();
    failLogout = false;
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
  });

  it('rechecks the session on window focus and redirects after a 401', async () => {
    authenticated = true;
    open();
    await screen.findByRole('heading', { name: 'Overview' });
    authenticated = false;
    fireEvent.focus(window);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
  });

  it('disables submission while login is pending', async () => {
    open();
    const user = userEvent.setup();
    await screen.findByLabelText('Username');
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'admin123');
    let resolve!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const button = screen.getByRole('button', { name: 'Signing in…' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await user.click(button);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/login')).length).toBe(1);
    await act(async () => { resolve(json({ username: 'admin' })); });
    await waitFor(() => expect(screen.getByLabelText('Verification code')).toBeTruthy());
  });
});
