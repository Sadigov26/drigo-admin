# Day 2: Authentication

## Request flow

1. On load, `AuthProvider` requests `GET /api/admin/auth/me`. The UI waits for the response.
2. A 401 opens `/login`. Other failures show a retry screen, not a false signed-out state.
3. Login sends username and password to `POST /api/admin/auth/login`. Only the returned username is retained in React state for the OTP step.
4. `/verify` sends that username and the entered code to `POST /api/admin/auth/verify`.
5. A successful verification sets a cookie on the server response. The frontend calls `/auth/me` again before allowing access to Overview.
6. Sign out calls `POST /api/admin/auth/logout`. Successful logout clears frontend account state and the guard returns to `/login`. A failed request shows an error and allows retry.

## Responsibilities

- `authApi.ts` contains the four auth requests and the account response type, based on the backend mapper.
- `AuthContext.tsx` holds the current session and pending username. It rechecks the session on window focus and cancels superseded checks.
- `AuthRoutes.tsx` separates session loading/errors, guest pages and protected pages.
- `LoginPage.tsx` and `VerifyPage.tsx` handle input and form errors. Duplicate submissions are disabled while requests are pending.
- `api/client.ts` is the only file that calls fetch. It includes cookies, preserves HTTP errors and limits requests to 15 seconds.

## Security boundaries

The frontend does not save passwords, OTPs or session identifiers in localStorage or sessionStorage. The pending username is memory-only; refreshing the OTP screen returns to login unless a session already exists. Passwords and codes do not appear in URLs or logs.

The session cookie belongs to the backend. Its current mock configuration is HttpOnly, SameSite=Lax and Secure=false for local HTTP. The fixed OTP and permissive verification implementation are training behavior, not production MFA. Production deployment requires backend review, including HTTPS cookies, CSRF protection, OTP expiry/rate limits and permission enforcement. No backend files were changed for this task.

Route guards control what the UI renders; the backend must authorize every protected request. A protected API response with status 401 clears the session. Login/OTP 401 responses stay on their forms; 403 does not log the user out. Session checks and logout handle their own 401 responses.

React renders messages as text. No raw HTML is inserted. Redirect destinations are fixed local routes, not user-supplied URLs.

## Verification

Run `npm test` and `npm run build`. Integration tests cover initial loading, wrong password, wrong OTP, successful OTP followed by /me, missing session after OTP, existing session restoration, network retry, direct OTP access, failed/successful logout, expired session on focus and duplicate submissions. API tests cover 401/403 handling.

Live browser checks used the local mock: wrong password, wrong OTP, successful login, reload with session restoration, logout and protected-route redirection. Login layout was inspected at desktop size and a 390px viewport.

## Review questions

- Why does a successful login response not open Overview?
- Why is /me required after OTP verification and on page reload?
- How do 401, 403 and a network error differ in this UI?
- What remains true if the logout request fails?
- Which protections belong to the backend rather than the route guard?

## Git

This task starts from main commit `07e69de` on `feature/auth`. Merge only through a reviewed PR. Keep meaningful commits on at least 21 distinct working days over the internship; the number of commits on one date does not replace that requirement.
