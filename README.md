# DRIGO Admin

DRIGO internship frontend built with React, TypeScript and Vite.

## Day 1 scope

- Independent frontend project with strict TypeScript.
- Responsive sidebar, header, overview route and a 404 page.
- A shared fetch wrapper that includes session cookies and preserves server error messages/statuses.
- A live backend health check with loading, success, error, retry and an eight-second timeout.

Authentication, permissions, dashboard KPIs and business modules are future work. The overview is a public setup screen; it does not claim that an admin is signed in. No fake business data is displayed.

## Run locally

Requires Node.js 22.12+ (Node 24 is used locally).

1. Start the separate backend with `npm start` in `../drigo.dev.node`.
2. Copy `.env.example` to `.env` if `.env` does not exist.
3. Run `npm install`, then `npm run dev` in this directory.
4. Open http://localhost:5173. The overview should show an online backend.

`VITE_API_BASE_URL=http://localhost:4000` is the backend origin. Requests supply complete paths such as `/api/health`. Vite exposes `VITE_` variables to the browser: never put secrets there.

## Validation

`npm run typecheck` checks TypeScript. `npm run build` checks types and produces the production build in `dist/`.

Manual checks: refresh the overview, use Check again, stop the backend to verify the error and retry flow, restart it and retry, open an unknown URL for the 404 page, and check the layout on a narrow screen. Google Fonts are optional; local sans-serif fallbacks remain usable without a network connection.

## Structure

- `src/main.tsx`: starts React and BrowserRouter.
- `src/App.tsx`: routes and the shared admin layout.
- `src/pages/Overview.tsx`: the health check lifecycle and first screen.
- `src/api/client.ts`: credentials, JSON responses and ApiError.
- `src/styles.css`: responsive layout and visual styling.

## Git workflow

Use one branch per task, beginning with `feature/project-setup`. Open a PR with a description and screenshot; merge after review. Never push directly to main. The GitHub remote and initial main-branch bootstrap must be established before the first PR. Do not commit changes to the separate backend repository.

Work on at least 21 distinct days during the internship, with meaningful commits. Understand and explain each change before committing.

## Next task

`feature/auth`: login, OTP verification, session restoration with `/api/admin/auth/me`, logout and route protection. Handle 401 in auth/routing rather than redirecting unconditionally inside the fetch wrapper: wrong credentials also return 401 and must remain visible on the login form.
