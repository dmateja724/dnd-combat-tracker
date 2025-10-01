# Dungeons & Dragons – Combat Tracker

A sleek React + Vite encounter manager tailored for D&D-style combat. Track initiative, damage, status effects, and party notes in a single, modern control panel with a hint of arcane flair.

## Features

- Initiative timeline – sortable turn order with active combatant highlighting and round counter.
- HP management – quick damage/heal buttons, configurable adjustments, and visual health bars.
- Status effect library – preset debuffs/buffs, per-combatant timers, and custom effects with color plus icon.
- Notes and metadata – capture AC, tactics, and reminders directly on each combatant card.
- Player accounts – sign up or sign in to sync your encounters to a local SQLite database.
- Encounter library – maintain multiple saved battles per account and switch between them on demand.
- Persistent state – encounter state is saved to a local SQLite database via the bundled API server.
- Blank canvas – start with an empty encounter and populate it with your party.

## Getting Started

1. Install dependencies:

        npm install

2. In a separate terminal start the API server:

        npm run server

   (Alternatively run both servers together with `npm run dev:all`.)

3. Start the Vite dev server:

        npm run dev

4. Open the printed URL (default http://localhost:5173) to run the tracker.

To create a production build run

        npm run build

and then

        npm run preview

to serve the bundle locally.

## Project Structure

        combat-tracker/
          src/
            components/         UI building blocks
            data/               Icon and status effect libraries
            hooks/              State management with persistence
            assets/             Placeholder for future images or SVGs
            types.ts            Shared TypeScript contracts
            App.tsx             Root layout shell
            styles.css          Theme and layout styling
          public/               Static assets (favicon)
          index.html            Vite entry document
          package.json
          vite.config.ts

## Customizing

- Add more icons by extending src/data/combatantIcons.ts with additional tokens or emoji.
- Expand the status library by editing src/data/statusEffects.ts to include campaign specific conditions.
- Adjust theming by tweaking the CSS variables in src/styles.css for a different palette.

## Notes

- The tracker stores state in a local SQLite database (stored in `data/combat-tracker.db`). Delete that file to reset saved encounters.
- The bundled API server is intentionally simple; extend its routes if you need multiple saved encounters, remote sync, or other campaign tools.
- The UI is responsive down to tablet sizes; mobile works but may feel compressed—future iterations could add a condensed mode.

## Authentication

- Create an account from the Sign Up screen; the API will hash your password and keep it inside the local SQLite database.
- Sessions are managed with an HTTP-only cookie. Use the **Sign Out** button in the tracker header to end a session and return to the sign-in page.
- Encounter data is scoped per account, so each user gets their own saved battle state.

## Managing Encounters

- After signing in the tracker opens with the encounter picker modal—create a fresh battle or reopen any of your saved encounters before diving in.
- Rename or delete encounters directly from that modal, and bring it back anytime with the **Switch** button in the tracker header.
- Each encounter opens with a clean slate, letting you build the roster exactly as the session demands.

Happy adventuring! 🐉
