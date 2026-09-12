import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, SESSION_EXPIRED_EVENT } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('API errors', () => {
  it('preserves 403 and the server message without expiring the session', async () => {
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'No permission' }), { status: 403 })));
    await expect(apiRequest('/api/admin/cars')).rejects.toMatchObject({ status: 403, message: 'No permission' });
    expect(expired).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });

  it('expires the session on a protected request 401, but not a login 401', async () => {
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(
      new Response(JSON.stringify({ message: 'Not authenticated' }), { status: 401 }),
    )));
    await expect(apiRequest('/api/admin/auth/login')).rejects.toMatchObject({ status: 401 });
    expect(expired).not.toHaveBeenCalled();
    await expect(apiRequest('/api/admin/cars')).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });
});
