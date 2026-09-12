const baseUrl = import.meta.env.VITE_API_BASE_URL;

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

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  const text = await response.text();
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
