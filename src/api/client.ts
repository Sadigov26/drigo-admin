const baseUrl = import.meta.env.VITE_API_BASE_URL;
export const SESSION_EXPIRED_EVENT = 'drigo:session-expired';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// The caller supplies a path such as /api/health or /api/admin/auth/me.
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!baseUrl) throw new Error('VITE_API_BASE_URL is missing. Check the frontend .env file.');

  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const timeout = AbortSignal.timeout(15000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      ...options,
      headers,
      signal,
      credentials: 'include',
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error(timeout.aborted
      ? 'The request timed out. Please try again.'
      : 'Unable to reach the server. Check your connection and try again.');
  }
  // Form errors belong on the form. Session checks and logout handle their own 401s.
  if (response.status === 401 && path.startsWith('/api/admin/') && !path.startsWith('/api/admin/auth/')) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error(timeout.aborted
      ? 'The request timed out. Please try again.'
      : 'The response was interrupted. Please try again.');
  }
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError('The server returned an unexpected response.', response.status);
    }
  }
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'message' in data
      && typeof data.message === 'string' ? data.message : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }
  return data as T;
}
