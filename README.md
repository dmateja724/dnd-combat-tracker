# Dungeons & Dragons Combat Tracker

A full-stack React + TypeScript encounter manager backed by an Express + SQLite API. Sign in, build encounters, and keep the GM, players, and combat log in sync across windows.

## Features

- Turn timeline automatically sorts by initiative, highlights the active combatant, tracks the current round, and provides quick advance/rewind controls with a built-in d20-d4 dice tray.
- Combatant cards support quick damage/heal chips, editable HP/AC/notes, status effects with optional round timers, death save tracking, and one-click saving to the combatant library.
- Attack and healing modals capture attacker/target, amount, and optional annotations while clamping results and writing detailed entries to the combat log.
- Encounter manager and account menu handle creating, renaming, deleting, and switching encounters, opening the player (`/viewer`) and combat log (`/log`) pop-outs, exporting/importing accounts, resetting encounters, and signing out.
- Combatant library integrates with the add form and combatant cards so reusable stat blocks can be stored, edited, and dropped into any encounter.
- BroadcastChannel keeps the tracker, player view, and log view synchronized in real time, and account backups preserve encounters, combatants, and logs in a single ZIP.

## Architecture

- React 18 + Vite + React Router on the client with dedicated contexts for auth, encounters, combatant library, and the combat tracker state machine.
- `useCombatTracker` persists encounter state to the API after each change and mirrors updates across windows via BroadcastChannel.
- Express 4 API written in TypeScript using `better-sqlite3` (WAL mode) for local persistence at `data/combat-tracker.db`.
- Email/password authentication stores bcrypt-hashed credentials and issues JWTs in HTTP-only cookies (seven-day lifetime).

## Requirements

- Node.js 18 or newer (developed against Node 18+).
- npm (bundled with Node).
- On Linux, install `python3`, `make`, and a C/C++ toolchain so `better-sqlite3` can compile native bindings.
- Optional: Docker and Docker Compose v2 for containerized deployment.

## Quick Start

1. Install dependencies: `npm install`
2. (Optional) Copy `.env.example` to `.env` and set `JWT_SECRET` before running in production.
3. Start the API server (http://localhost:4000): `npm run server`
4. In another terminal, start the Vite dev server (http://localhost:5173): `npm run dev`
5. Prefer one command? Use `npm run dev:all` to launch both concurrently.
6. Sign up or sign in, create/select an encounter, add combatants, and run rounds; changes appear instantly in the player and log views.

The Vite dev server proxies `/api` requests to the API (configured in `vite.config.ts`), so keep the backend running alongside the frontend during development.

### Combat Actions

- Select `⚔️ Attack` to choose an attacker and target, optionally note a damage type, and apply damage with automatic logging.
- Select `✨ Heal` to choose a recipient, note the source (spell, potion, etc.), and restore HP with clamping to the combatant’s maximum.
- Quick damage/heal chips (+/-1, +/-5, +/-10) and a custom amount field let you adjust HP without opening modals.

### Death Saves & Status Effects

- When an ally hits 0 HP, the tracker queues a decision to begin death saves or mark the combatant dead.
- Record successes and failures directly on the combatant card; stable or dead states lock further rolls until cleared.
- The status panel includes preset effects and supports custom icons/colors/notes with optional round durations that tick down automatically each time the round advances.

### Account Menu & Pop-Outs

- Use the account menu (☰) to switch encounters, open the standalone combat log and player views, export/import account archives, reset the current encounter, or sign out.
- The encounter selector modal (auto-opens when no encounter is chosen) can also import backups, rename encounters, and delete unwanted ones.
- Player (`/viewer`) and combat log (`/log`) windows stay synchronized with the main tracker through the shared BroadcastChannel.

## Environment Variables

- `PORT` – API server port (default `4000`).
- `JWT_SECRET` – secret used to sign JWT session cookies (default `change-me-in-production`; set a strong value in production).
- `NODE_ENV` – set to `production` in deployed environments to enable secure cookies.
- `APP_VERSION` (optional) – version string injected during Docker builds and surfaced in the UI; defaults to `package.json` version.
- `VITE_APP_VERSION` (optional) – overrides the UI version badge when building/running the frontend.

Example:

```
PORT=4100 JWT_SECRET=supersecret npm run server
```

## npm Scripts

- `npm run dev` – start the Vite dev server.
- `npm run server` – start the Express API with `tsx`.
- `npm run dev:all` – run API and frontend together via `concurrently`.
- `npm run build` – type-check and build the production bundle.
- `npm run preview` – serve the built frontend (requires the API running separately).
- `npm run deploy` – inject the package version and run `docker compose build && docker compose up -d`.
- `npm run version:print` – print the package version.

## Account Backup & Restore

- Export an account from the account menu or encounter selector. The downloaded `combat-tracker-backup-YYYY-MM-DD.zip` contains:
  - `combatant-library.json` – saved combatant templates.
  - `encounters/*.json` – encounter metadata, state, and combat log snapshots.
  - `metadata.json` – counts, version, and export timestamp.
- Importing a backup replaces the current encounters and combatant library after user confirmation. Warnings are surfaced if any files cannot be read.

## Persistence & Data

- The API stores all data in `data/combat-tracker.db` (created automatically on first run).
- Schema validation occurs at startup; incompatible encounter or template tables are recreated as needed.
- Encounter state is saved on every change, keeping the tracker resilient across reloads.
- Combat log entries are retained (up to 250) and mirrored to the pop-out log viewer.
- Sessions live in an HTTP-only cookie named `combat_tracker_token` with a seven-day lifetime.

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
- `GET /api/combatants` – list combatant templates.
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
    pages/               Auth screens (sign-in/sign-up)
    utils/               Account backup helpers and shared utilities
    version.ts           Injected app version constant
    styles.css           Global styling
    types.ts             Shared TypeScript types
  server/
    index.ts             Express API entry point
  scripts/
    deploy.mjs           Docker deploy helper
  public/                Static assets served by Vite
  data/                  SQLite database location (runtime)
  dist/                  Production build output (after `npm run build`)
  Dockerfile             Multi-stage build for frontend and API
  docker-compose.yml     Compose stack wiring API + frontend (with Traefik labels)
  nginx.conf             Frontend Nginx config used in the Docker build
  index.html             Vite entry document
  package.json
  tsconfig.json
  tsconfig.node.json
  vite.config.ts         Vite config with proxy + version injection
```

## Customization

- Edit `src/data/statusEffects.ts` to adjust preset status effects.
- Update `src/data/combatantIcons.ts` to add or rename the avatar icon library.
- Tweak look-and-feel in `src/styles.css`.
- Modify `vite.config.ts` if you need to change proxy targets or metadata injection.
- Extend the Express API in `server/index.ts` to support external sync or alternate persistence.

## Docker & Deployment

- The multi-stage `Dockerfile` builds both the frontend and API images and exposes an Nginx frontend stage plus a Node.js API stage.
- `docker-compose.yml` runs the stack, mounts `./data` for persistent storage, and includes Traefik labels; update hostnames or networks to match your infrastructure.
- `npm run deploy` reads `package.json` for the version, sets `APP_VERSION`/`VITE_APP_VERSION`, runs `docker compose build`, then `docker compose up -d`.
- Provide `JWT_SECRET` (and any other env overrides) to the API service before deploying.

Happy adventuring!
