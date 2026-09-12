import { apiRequest } from '../api/client';

export type Admin = {
  id: string;
  username: string;
  email: string | null;
  fullName: string | null;
  isSuperAdmin: boolean;
};

export function login(username: string, password: string, signal: AbortSignal) {
  return apiRequest<{ username: string }>('/api/admin/auth/login', {
    method: 'POST', body: JSON.stringify({ username, password }), signal,
  });
}

export async function verifyOtp(username: string, code: string, signal: AbortSignal) {
  const result = await apiRequest<{ isVerified: boolean }>('/api/admin/auth/verify', {
    method: 'POST', body: JSON.stringify({ username, code }), signal,
  });
  if (result?.isVerified !== true) throw new Error('Verification was not completed. Please try again.');
}

export async function getSession(signal: AbortSignal): Promise<Admin> {
  const admin = await apiRequest<Admin>('/api/admin/auth/me', { signal, cache: 'no-store' });
  // TypeScript types do not validate a response at runtime.
  if (!admin || typeof admin.id !== 'string' || typeof admin.username !== 'string'
    || typeof admin.isSuperAdmin !== 'boolean') {
    throw new Error('The server returned an invalid account. Please try again.');
  }
  return admin;
}

export function logout() {
  return apiRequest<{ success: boolean }>('/api/admin/auth/logout', { method: 'POST' });
}
