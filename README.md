# Dungeons & Dragons – Combat Tracker

A sleek React + Vite encounter manager tailored for D&D-style combat. Track initiative, damage, status effects, and party notes in a single, modern control panel with a hint of arcane flair.

## Features

- Initiative timeline – sortable turn order with active combatant highlighting and round counter.
- HP management – quick damage/heal buttons, configurable adjustments, and visual health bars.
- Status effect library – preset debuffs/buffs, per-combatant timers, and custom effects with color plus icon.
- Notes and metadata – capture AC, tactics, and reminders directly on each combatant card.
- Persistent state – encounter state is saved to localStorage so a page refresh does not wipe progress.
- Preloaded demo – starts with a sample skirmish so you can explore the UI immediately.

## Getting Started

1. Install dependencies:

        npm install

2. Start the dev server:

        npm run dev

3. Open the printed URL (default http://localhost:5173) to run the tracker.

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

- The tracker relies on browser localStorage; if you clear storage or use incognito mode the encounter will reset.
- No backend is required, but feel free to integrate one by wiring the reducer actions to your own API.
- The UI is responsive down to tablet sizes; mobile works but may feel compressed—future iterations could add a condensed mode.

Happy adventuring! 🐉
