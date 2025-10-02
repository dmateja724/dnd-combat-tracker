# Dungeons & Dragons - Combat Tracker

A modern React and Vite encounter manager for tabletop combat. Sign in, build encounters, track initiative, and sync everything through the bundled Express and SQLite API server.

## Features

- Turn timeline with auto-sorted initiative, active combatant highlighting, and a running round counter.
- Combatant management with quick damage and healing controls, visual HP bars, AC and notes, and per-card status summaries.
- Status effect library that supports preset conditions, custom effects, and optional round-based timers.
- Saved combatant library so you can store frequently used monsters or NPCs and drop them into any encounter with one click.
- Encounter library per account with create, rename, delete, and switch actions, all persisted automatically.
- Dice tray for common polyhedral rolls plus rewind and advance turn controls to keep the flow moving.
- Email and password authentication with HTTP-only session cookies and hashed passwords stored in SQLite.
- Automatic encounter persistence after every change so you can leave and return without losing progress.

## Tech Stack

- React 18 with TypeScript, Vite, and React Router for the client.
- Context-based state management with dedicated hooks for encounters, authentication, and combatant templates.
- Express API written in TypeScript, powered by better-sqlite3 for fast local persistence.
- JSON Web Tokens issued as HTTP-only cookies for session management.
- Concurrent development workflow via Vite for the client and `tsx` for the server.

## Prerequisites

- Node.js 18 or newer.
- npm (bundled with Node).

## Running Locally

1. Install dependencies:

        npm install

2. Start the API server (defaults to http://localhost:4000):

        npm run server

   Set `PORT` or `JWT_SECRET` in the same shell if you need to override defaults, for example `PORT=4100 JWT_SECRET=supersecret npm run server`.

3. In a separate terminal, launch the Vite dev server (defaults to http://localhost:5173):

        npm run dev

4. Sign up or log in inside the app, create an encounter, and start adding combatants.

Use `npm run dev:all` to start both servers with a single command during development.

## Build and Preview

Create a production build of the client and check it locally:

        npm run build
        npm run preview

The preview server only serves the static client; run `npm run server` in another terminal so API requests continue to work.

## Data and Persistence

- The API creates and manages a SQLite database at `data/combat-tracker.db`; delete that file to wipe all accounts, encounters, and saved combatants.
- Schema migrations are handled at server start. Removing tables manually may cause data loss.
- Sessions are stored in an HTTP-only cookie named `combat_tracker_token` with a seven day lifetime.

## Project Structure

```
combat-tracker/
  src/
    components/          Combat tracker UI pieces
    context/             Global providers for auth, encounters, and templates
    data/                Client-side API helpers and preset libraries
    hooks/               State management and persistence logic
    pages/               Auth routes
    styles.css           App-wide styling
    App.tsx              Root router and layout shell
  server/                Express API (entry point at server/index.ts)
  public/                Static assets served by Vite
  data/                  SQLite database lives here at runtime
  index.html             Vite entry document
  package.json
  vite.config.ts
```

## Customizing

- Extend `src/data/statusEffects.ts` to add or tweak preset conditions for your table.
- Add new icons or labels in `src/data/combatantIcons.ts` to theme the avatar picker.
- Update CSS variables and layout rules in `src/styles.css` to match your campaign branding.
- Enhance or replace API routes in `server/index.ts` if you need remote sync, additional fields, or alternate persistence.

## API Overview

- `POST /api/signup`, `POST /api/login`, `POST /api/logout`, and `GET /api/session` manage authentication.
- `GET/POST /api/encounters` list and create encounters; `GET /api/encounters/:id`, `PUT /api/encounters/:id/state`, `PATCH /api/encounters/:id`, and `DELETE /api/encounters/:id` load, save, rename, and remove encounters.
- `GET/POST /api/combatants` and `DELETE /api/combatants/:id` manage saved combatant templates.

Happy adventuring!
