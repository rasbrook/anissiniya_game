# Copilot / AI Agent Instructions for this repo

This React + Vite single-page app is small and straightforward. The notes below focus on repository-specific patterns, build/dev commands, important files, and gotchas an AI coding agent should know to be immediately productive.

## Quick commands

- Dev server: `npm run dev` (uses `vite`).
- Build production bundle: `npm run build`.
- Preview production build: `npm run preview`.
- Lint: `npm run lint`.
- Install dependencies: `npm install`.

Example (PowerShell):
```powershell
npm install
npm run dev
```

## High-level architecture

- Vite + React app (entry: `src/main.jsx`).
- Client-side routing with `react-router-dom` (routes defined in `src/App.jsx`, pages in `src/pages/`).
- Presentation components live under `src/components/` (e.g. header, displays, payment components).
- Small constants collected in `src/constants/` (colors, font sizes).

Why this layout: it's a classic SPA structure — router + page-level containers (`src/pages`) and reusable UI in `src/components`.

## Important files to inspect first

- `package.json` — scripts and dependencies (useful for build/test commands).
- `src/main.jsx` — app bootstrap; note it applies the saved theme early by toggling `document.documentElement.classList`.
- `src/App.jsx` — router and top-level composition (imports `Header` and page components).
- `src/pages/` — route components: `home.jsx`, `bingo.jsx`, `keno.jsx`, `blackjack.jsx`.
- `src/components/header/header.jsx` and `src/components/header/header.css` — top-level navigation and theme toggle.
- `src/components/chapa.payment.jsx` — payment/integration example (third-party integration present).

## Repo-specific conventions & patterns

- The theme is applied globally by adding/removing the `theme-dark` class on `document.documentElement`. The saved theme key is `app-theme` in `localStorage`; apply changes consistently when editing UI.
- Routes: `App.jsx` registers routes with `react-router-dom` v7; note one route uses `/Keno` (capital `K`) — watch for route casing when refactoring.
- CSS: plain CSS files are used (no CSS modules). Header styles are in `src/components/header/header.css`.
- Assets: static imports (e.g. `import './assets/react.svg'`) and absolute `/vite.svg` are both used. Use Vite-style imports.
- Animations: `gsap` and `framer-motion` are in use — prefer editing small, isolated components when changing animations.

## External integrations

- Payment: `@chapa_et/inline.js` is a runtime dependency. See `src/components/chapa.payment.jsx` for usage.
- Animations: `gsap`, `framer-motion` used across displays/components.

## Files/places to update for common tasks

- Add a new route: create page file in `src/pages/` and add a `<Route path="/yourpath" element={<YourPage/>} />` entry in `src/App.jsx`.
- Add global styles: update `src/index.css` or `src/App.css`.
- Update theme defaults: edit `src/main.jsx` (theme detection and early application).

## Linting and code style

- ESLint is configured via project devDependencies — run `npm run lint`. Follow existing code style in `src/` (JSX with PascalCase components and camelCase props).

## Common gotchas for agents

- No tests present — do not add test expectations without asking the maintainer.
- Routes may be case-sensitive depending on hosting; be careful when renaming paths (see `/Keno` vs `/keno`).
- Theme toggling happens before React mounts; changing that flow can cause flash-of-incorrect-theme if not handled early.

## Examples for quick finds

- To see how the theme key is read: `src/main.jsx` — search for `app-theme`.
- To find checkout/payment flow: open `src/components/chapa.payment.jsx`.
- To view route-to-page mapping: open `src/App.jsx` and `src/pages/`.

## If you need more context

- Ask for runtime logs or a recorded repro if behavior differs from source (animations and payments can depend on environment and keys).
- If a build or dependency problem occurs, provide the `npm install` and `npm run build` output.

---
If any of these notes are unclear or you'd like me to expand a specific area (routing, theming, the payment flow, or animation patterns), tell me which part and I'll update this file accordingly.
