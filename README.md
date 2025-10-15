# Dungeons & Dragons Combat Tracker

A modern React + Vite encounter manager for tabletop combat. Sign in, build encounters, track initiative, and keep your party in sync with the bundled Express + SQLite API server.

## Features

- Turn timeline with auto-sorted initiative, active combatant highlighting, and a running round counter.
- Combatant cards with quick damage/heal controls, health bars, AC badges, notes, and status summaries.
- Status effect panel with preset conditions, fully custom effects, optional round timers, and automatic decrement when rounds advance.
- Saved combatant library you can create, edit, reuse, export to JSON, and restore via import.
- Encounter library per account with modal-driven create/rename/delete flows, instant switching, and automatic persistence.
- Dice tray for common polyhedral rolls plus rewind/advance turn controls, backed by secure email/password auth with HTTP-only cookies.
- Pop-out player viewer window that mirrors the active encounter so players can track turns without touching the GM screen.

## Tech Stack

- React 18 with TypeScript, Vite, and React Router on the client.
- Context-based state management with dedicated hooks for auth, encounters, and combatant templates.
- Express API written in TypeScript, powered by better-sqlite3 for fast local persistence.
- JSON Web Tokens issued as HTTP-only cookies for session management.
- Developer workflow via Vite for the client, `tsx` for the API watcher, and `concurrently` for combined dev mode.

## Prerequisites

- Node.js 18 or newer.
- npm (bundled with Node).
- On Linux, make sure `python3`, `make`, and a C/C++ toolchain (such as `build-essential`) are available so `better-sqlite3` can compile.

## Environment Variables

- `PORT` - port for the API server (default `4000`).
- `JWT_SECRET` - secret used to sign session tokens; set this to a strong value in production (default `change-me-in-production`).
- `NODE_ENV` - set to `production` in deployed environments so cookies are marked secure.

Export variables inline when running scripts, for example:

```
PORT=4100 JWT_SECRET=supersecret npm run server
```

## Local Development

1. Install dependencies:

        npm install

2. Start the API server (defaults to http://localhost:4000):

        npm run server

3. In a separate terminal, start the Vite dev server (http://localhost:5173):

        npm run dev

   The dev server proxies `/api` calls to the API (see `vite.config.ts`), so keep the API process running.

4. Prefer a single command? Launch both processes together:

        npm run dev:all

5. Sign up or sign in inside the app, create an encounter, and start adding combatants.

## Combatant Library Export & Import

- Open the **Add Combatant** form and use the buttons above the saved combatant list.
- `Export JSON` downloads your current library as `combatant-library-YYYY-MM-DD.json`. The payload includes a `version` field (currently `1`) plus the templates.
- `Import JSON` is available when your library is empty. Choose a previously exported file to bulk-create the listed templates.
- Invalid entries in the file are skipped; successful imports report how many combatants were restored.
- You must be signed in for export or import to succeed.

Example export payload:

```json
{
  "version": 1,
  "exportedAt": "2024-05-26T18:17:42.123Z",
  "templates": [
    {
      "name": "Goblin Raider",
      "type": "enemy",
      "defaultInitiative": 12,
      "maxHp": 7,
      "ac": 15,
      "icon": "👺",
      "note": "Pack tactics; retreats at half HP."
    }
  ]
}
```

## Build & Preview

Create a production build of the client and serve it locally:

        npm run build
        npm run preview

`npm run build` runs TypeScript checks and `vite build`. `npm run preview` serves the static client; run `npm run server` in another terminal so API requests continue to work.

## Docker

A multi-stage `Dockerfile` is included with two targets:

- `frontend` - builds the Vite client and serves it with Nginx.
- `api` - runs the Express server on Node.js.

The accompanying `docker-compose.yml` ties both together and persists the SQLite database. Example usage:

```
docker compose build
JWT_SECRET=supersecret docker compose up -d
```

You can also run the included helper script, which builds the images and redeploys the stack in one step:

```
npm run deploy
```

The API listens on port 4000 inside the compose network, the frontend on port 80, and `./data` is mounted into the API container so database files survive restarts. Adjust Traefik labels or networks in `docker-compose.yml` to match your infrastructure.

## Data & Persistence

- The API creates and manages a SQLite database at `data/combat-tracker.db`; delete that file to wipe all accounts, encounters, and saved combatants.
- Schema migrations are handled at server start (tables are recreated if shapes change). Removing tables manually may cause data loss.
- Sessions are stored in an HTTP-only cookie named `combat_tracker_token` with a seven-day lifetime.

## Project Structure

```
dnd-combat-tracker/
  src/
    components/          Combat tracker UI pieces (tracker, cards, modals, forms)
    context/             Global providers for auth, encounters, and saved combatants
    data/                Client-side API helpers and preset libraries
    hooks/               Encounter state management and persistence logic
    pages/               Auth routes
    App.tsx              Router and protected route shell
    main.tsx             App bootstrap
    styles.css           App-wide styling
    types.ts             Shared TypeScript types
  server/
    index.ts             Express API entry point
  public/                Static assets served by Vite
  data/                  SQLite database lives here at runtime
  Dockerfile             Multi-stage build for frontend and API
  docker-compose.yml     Compose stack for nginx + API + Traefik labels
  nginx.conf             Nginx config used by the frontend image
  vite.config.ts         Vite dev/proxy configuration
  index.html             Vite entry document
  package.json
```

## API Overview

All data routes (except sign-up and sign-in) require an authenticated session via HTTP-only cookie:

- `POST /api/signup`, `POST /api/login`, `POST /api/logout`, `GET /api/session` - authentication lifecycle.
- `GET /api/encounters` - list encounter summaries.
- `POST /api/encounters` - create an encounter.
- `GET /api/encounters/:id` - fetch encounter details and state.
- `PUT /api/encounters/:id/state` - persist encounter state changes.
- `PATCH /api/encounters/:id` - rename an encounter.
- `DELETE /api/encounters/:id` - delete an encounter.
- `GET /api/combatants` - list saved combatant templates.
- `POST /api/combatants` - create a saved combatant template.
- `PUT /api/combatants/:id` - update a saved combatant template.
- `DELETE /api/combatants/:id` - delete a saved combatant template.

## Customizing

- Extend `src/data/statusEffects.ts` to add or tweak preset conditions for your table.
- Add new icons or labels in `src/data/combatantIcons.ts` to theme the avatar picker.
- Update CSS variables and layout rules in `src/styles.css` to match your campaign branding.
- Enhance or replace API routes in `server/index.ts` if you need remote sync, additional fields, or alternate persistence.

Happy adventuring!
