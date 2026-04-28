# Affine TechSpec (UI prototype)

Production-style **UI-only** frontend for **Affine Analytics — Affine TechSpec**: a FinTech integration support and AI troubleshooting workspace for **JPMorgan Chase (JPMC) API** clients. All data is **mock**; there is **no backend**.

## Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4 (`@tailwindcss/vite`)
- Recharts
- React Router 7
- Lucide React (icons)

## Local development

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview
```

## Project structure (overview)

- `src/pages/` — route-level screens (Overview, Clients, Issues, AI Troubleshooter, Uploads)
- `src/components/` — reusable UI (tables, charts shell, chat, badges, shell pieces)
- `src/layouts/AppShell.tsx` — sidebar + top bar + outlet
- `src/data/` — mock datasets (`clients`, `issues`, `uploads`, `knowledgeBase`, `analytics`, `chatThreads`, `userProfile`, `filters`, `dashboard`)
- `src/types/` — shared TypeScript entities
- `src/utils/` — formatters, chart palette helpers, confidence helpers
- `src/routes/AppRoutes.tsx` — router configuration
- `src/assets/logo.svg` — placeholder wordmark (**Affine Analytics** in brand blue). Replace or point to your CDN URL when available.

## Branding

- Footer (also in app shell): **Affine Analytics — Affine TechSpec v1.0**
- Logo URL placeholder for production assets: **`[PLACEHOLDER — Replace with actual logo URL when available]`** (see sidebar user card and footer note)

## Extending the app

1. **New page**: add `src/pages/YourPage.tsx`, register a `<Route>` in `src/routes/AppRoutes.tsx`, and add a `NavLink` in `src/components/Sidebar.tsx`.
2. **New widget**: add a component under `src/components/` and import it from the relevant page.
3. **New mock data**: add a file under `src/data/` and types under `src/types/` as needed.

## Notes

- Loading states use a short `setTimeout` via `useMockLoad` to mimic async fetches.
- Tables support sticky headers, hover rows, and optional pagination where wired.
