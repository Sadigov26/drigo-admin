# DRIGO Admin

DRIGO internship frontend built with React, TypeScript and Vite.

## Current scope

- Two-step login and OTP verification using the provided backend.
- Cookie session restoration, protected routes and logout.
- A restrained responsive layout with Overview and a protected 404 page.
- Shared API client with cookies, request timeouts and HTTP error handling.
- Live backend health check and the signed-in admin's account details.
- Permissions-based navigation and direct-route access checks.
- Shared table, modal, status badges and loading/empty/error states.
- A searchable permission list using the signed-in account's real grants.
- Dashboard KPI cards and two live trend charts, with manual refresh and independent retries.
- Fleet summary with city counts, online users, and separate recent rental/reservation/support lists.

Cars includes list/detail, create/edit/delete, tracking with GPS history, vehicle controls and a problematic-cars table. Dashboard code covers Section 8.2. See the daily notes for verification and outstanding review steps.

## Local setup

Use Node.js 22.12+; development was verified with Node 24.

1. Start the separate backend: run `npm start` in `../drigo.dev.node`.
2. Copy `.env.example` to `.env` if it does not exist.
3. Run `npm install`, then `npm run dev` here.
4. Open http://localhost:5173.

The mock login is `admin` / `admin123`, followed by OTP `123456`. These are local training credentials. Other provided accounts are `operator` and `fleet`; check the backend README for their setup.

The frontend uses `VITE_API_BASE_URL=http://localhost:4000`. VITE-prefixed variables are visible to the browser: never put secrets there. Keep both frontend and backend on localhost, not a mixture of localhost and 127.0.0.1.

## Checks

- `npm test`: auth, API errors, permissions, shared components and dashboard tests.
- `npm run typecheck`: strict TypeScript checks.
- `npm run build`: types and production build.
- `npm audit`: dependency advisory check.

The browser verifies the real session cookie behavior; mocked integration tests cover failure states deterministically.

## Source structure

- `src/auth/`: forms, auth requests, session state and route guards.
- `src/api/client.ts`: shared fetch wrapper.
- `src/permissions/`: permissions requests, account-scoped state, menu and module guards.
- `src/components/`: table, modal, status badges and reusable states.
- `src/dashboard/`: validated dashboard responses, independent request state, cards, charts and snapshot lists.
- `src/App.tsx`: page routes, layout and logout control.
- `src/pages/Overview.tsx`: health check and current account.
- `src/styles.css`: shared styling, using system fonts.
- `docs/DAY_02.md`: auth flow, tradeoffs and review notes.
- `docs/DAY_03.md`: permissions, shared components and review notes.
- `docs/DAY_04.md`: dashboard scope, response contracts and review notes.
- `docs/DAY_05.md`: fleet, online users, recent activity and the Week 1 handoff checklist.

`dist/`, `node_modules/` and `.env` are ignored by Git. Review source files under `src/`, not generated build files.

## Workflow

Start each task from up-to-date main on its own feature branch. Push the feature branch, open a PR with a screenshot, and merge after review. Do not push application changes directly to main or commit to the separate backend repository.

Understand each change before committing. Work on at least 21 different days during the internship. The original car-browser project remains separate.

## Next task

This branch adds Cars list/detail and create/edit/delete. See `docs/DAY_06.md` for real API contracts, backend limitations and verification. Day 5 dashboard work was merged through its own PR and is included from updated main.

Day 7 adds tracking, detail GPS maps, active-status transitions, commands and problematic cars; see `docs/DAY_07.md` for contracts and mock limitations. Publishing and PR review remain separate steps. Complete PR review and merge before marking the module done. The next planned task is Brands/Models/Colors CRUD.
