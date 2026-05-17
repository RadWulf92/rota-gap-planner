# Rota Gap Planner

A local rota planner for the Ward 12 rotation and lung clinic cover.

Live app: https://radwulf92.github.io/rota-gap-planner/

## What it does

- Rotates Igor Randulfe, Daniel Neto, and Maria Michaelidou through Ward 12.
- Uses the dated AO ward rota through early September 2026.
- Uses Manchester-relevant England and Wales bank holidays from the GOV.UK bank-holiday feed, with an offline fallback through 2028.
- Lets you refresh bank holidays and export/import a JSON backup of the saved rota.
- Lets you edit ward slot status/cover and clinic slot details from the rota cards.
- Opens on the diary first, with leave, clinic, personnel, and settings tools on separate pages.
- Lets you edit team names, roles, group, and lung clinic auto-assignment as the team changes.
- Uses contained checkbox-style staff pickers instead of cramped native multi-select boxes.
- Auto-assigns Igor/Daniel to the lung clinic pattern when they are not on the ward.
- Tracks Christie, Wythenshawe, MDT, and ward meeting templates.
- Lets you add annual leave and flags ward or clinic gaps.
- Lets you add or remove people using `Name - role`, edit clinic templates, and set one-off ward cover.
- Saves changes in the browser with `localStorage`.
- Can be hosted as a small installable phone app from GitHub Pages.

## Run

```bash
npm start
```

Then open http://localhost:4173.

## Test

```bash
npm test
```
