# Dungeons & Dragons Combat Tracker

A React + TypeScript encounter manager paired with an Express + SQLite API. Sign in, build encounters, and keep players and the GM synchronized across multiple windows.

## Highlights

- Initiative timeline that auto-sorts combatants, highlights the active turn, and tracks the current round.
- Combatant cards with quick damage/heal buttons, editable HP/AC/notes, custom status effects (with optional round timers), and automatically logged attack and healing events.
- Dedicated modals for resolving multi-target attacks and single-target healing with optional source annotations.
- Encounter manager for creating, renaming, deleting, and switching between encounters without leaving the tracker.
- Saved combatant library so common stat blocks can be stored once and dropped into any fight.
- Pop-out player view (`/viewer`) and pop-out combat log (`/log`) that mirror the main tracker via `BroadcastChannel`.
- Dice tray and turn controls (advance/rewind) for fast round management.
- Account-level backup and restore that packages encounters, combat logs, and the combatant library into a single ZIP file.

## Architecture

- React 18 + Vite + React Router on the client with context-driven state (auth, encounters, combatant library, combat tracker).
- Express API written in TypeScript, backed by `better-sqlite3` for local persistence under `data/combat-tracker.db`.
- Email/password authentication with bcrypt hashing and JWTs stored in HTTP-only cookies.
- Encounter state is persisted on every change and broadcast to any open windows (tracker, viewer, log) to keep them in sync.

## Prerequisites

- Node.js 18 or newer.
- npm (bundled with Node).
- On Linux, install `python3`, `make`, and a C/C++ toolchain so `better-sqlite3` can compile native bindings.

## Quick Start

1. Install dependencies: `npm install`
2. Start the API server (default http://localhost:4000): `npm run server`
3. In another terminal, launch the Vite dev server (http://localhost:5173): `npm run dev`
4. Prefer one command? Use `npm run dev:all` to run both concurrently.
5. Sign up or sign in within the app, create/select an encounter, add combatants, and resolve attacks or healing from the turn controls while the log records actions automatically.

### Resolving Combat Actions

- Use the ⚔️ Attack button to open the attack modal, choose an attacker/target, and apply damage with an optional damage type.
- Use the ✨ Heal button to open the healing modal, pick who regains hit points, optionally note the source (spell, potion, etc.), and apply the restoration with built-in clamping to max HP.

The Vite dev server proxies `/api` requests to the API (configured in `vite.config.ts`), so keep the backend running alongside the frontend.

## Environment Variables

- `PORT` – port for the API server (default `4000`).
- `JWT_SECRET` – secret used to sign JWT session cookies (default `change-me-in-production`).
- `NODE_ENV` – set to `production` in deployed environments to enable secure cookies.

Example usage:

```
PORT=4100 JWT_SECRET=supersecret npm run server
```

## npm Scripts

- `npm run dev` – start the Vite dev server.
- `npm run server` – run the Express API with `tsx`.
- `npm run dev:all` – run API and frontend together via `concurrently`.
- `npm run build` – type-check and build the production bundle.
- `npm run preview` – serve the built frontend (requires the API running separately).
- `npm run deploy` – build and redeploy the Docker stack with the current package version.
- `npm run version:print` – print the package version.

## Account Backup & Restore

- Use the tracker account menu (☰) or the encounter selector to **Export Account**. The downloaded `combat-tracker-backup-YYYY-MM-DD.zip` contains:
  - `combatant-library.json` – saved combatant templates.
  - `encounters/*.json` – encounter metadata, state, and combat log.
  - `metadata.json` – counts, version, and timestamp.
- Importing a backup replaces the current encounters and combatant library after user confirmation. Warnings are surfaced in-app if any files are skipped.

## Persistence & Data

- The API stores data in `data/combat-tracker.db` (created on first run).
- Encounter schemas are validated on startup; incompatible tables are recreated automatically.
- Sessions live in an HTTP-only cookie named `combat_tracker_token` with a seven-day lifetime.

Delete the database file to wipe all accounts, encounters, and templates (irreversible).

## API Overview

Authenticated endpoints require the session cookie; sign-up and sign-in do not.

- `POST /api/signup` – create an account.
- `POST /api/login` – sign in and receive a session cookie.
- `POST /api/logout` – clear the session cookie.
- `GET /api/session` – return the current user or `204` if unauthenticated.
- `GET /api/encounters` – list encounter summaries.
- `POST /api/encounters` – create an encounter.
- `GET /api/encounters/:id` – load encounter state.
- `PUT /api/encounters/:id/state` – persist encounter state changes.
- `PATCH /api/encounters/:id` – rename an encounter.
- `DELETE /api/encounters/:id` – delete an encounter.
- `GET /api/combatants` – list saved combatant templates.
- `POST /api/combatants` – create a template.
- `PUT /api/combatants/:id` – update a template.
- `DELETE /api/combatants/:id` – delete a template.

## Project Layout

```
dnd-combat-tracker/
  src/
    components/          Tracker UI (main tracker, viewer, log, forms, modals)
    context/             React context providers (auth, encounters, combatant library)
    data/                Client-side API clients and preset libraries
    hooks/               Encounter state management (useCombatTracker)
    pages/               Auth pages (sign-in/sign-up)
    utils/               Account backup helpers
    App.tsx              App routing and guards
    main.tsx             App bootstrap
    styles.css           Global styling
    types.ts             Shared TypeScript types
  server/
    index.ts             Express API entry point
  scripts/
    deploy.mjs           Docker deploy helper
  public/                Static assets served by Vite
  data/                  SQLite database location (runtime)
  Dockerfile             Multi-stage build for frontend and API
  docker-compose.yml     Compose stack tying API + frontend together
  nginx.conf             Frontend Nginx config used in the Docker build
  index.html             Vite entry document
  package.json
  vite.config.ts         Vite config with proxy + version injection
```

## Customization

- Edit `src/data/statusEffects.ts` to add or tweak preset status effects.
- Add or rename avatar icons in `src/data/combatantIcons.ts`.
- Adjust look-and-feel in `src/styles.css`.
- Extend the Express API in `server/index.ts` if you need remote sync or alternate persistence.

## Docker & Deployment

- The multi-stage `Dockerfile` builds the frontend and API images.
- `docker-compose.yml` runs the stack (frontend served by Nginx, API on Node.js) and mounts `./data` for persistent storage.
- `npm run deploy` reads the package version, sets `APP_VERSION`/`VITE_APP_VERSION`, runs `docker compose build`, then `docker compose up -d`.

Happy adventuring!
