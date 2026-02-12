# Copilot Instructions — Living Ledger

## Project overview
- Next.js App Router project using `app/` for routes and layouts.
- Current UI is the default Next.js starter in `app/page.tsx` and shared layout in `app/layout.tsx`.
- Product vision and narrative context lives in `Layout.md` (long form spec / transcript). Read it before major feature decisions.
- Build plan and feature checklist live in `Guidance.md` (step-by-step implementation details). Keep changes aligned to that doc.

## What the platform is
- A contribution marketplace where people post requests for help and others offer micro-acts of assistance.
- Contributions generate “Gratitude Credits” used for boosts, tools, or other offerings in the ecosystem.
- MVP focuses on accounts, request/offer posts, categories, and a credit tally.
- Intended stack: Next.js + Supabase, with optional Stripe for buying credits.

## Architecture & key files
- App Router entry: `app/layout.tsx` sets global fonts (Geist) and metadata; keep global wrappers here.
- Home route: `app/page.tsx` is the main landing page; replace starter content here first.
- Global styles: `app/globals.css` uses Tailwind (`@import "tailwindcss"`) and CSS variables for theme.
- Supabase client: `lib/supabase.js` creates a browser client from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Data & integrations
- Supabase is the planned backend. Use the shared client from `lib/supabase.js` for client-side queries.
- Supabase browser env vars must be `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Developer workflows
- Dev server: `npm run dev` (or yarn/pnpm/bun). The app runs at http://localhost:3000.
- No test framework is configured yet.

## Conventions & patterns
- Prefer App Router conventions (Server/Client Components as needed). Keep shared layout concerns in `app/layout.tsx`.
- Keep styling in Tailwind utilities + `globals.css`; avoid introducing new styling systems without discussion.
- When adding new data access, centralize Supabase setup in `lib/` and avoid duplicating client creation.

## References
- Product direction & feature ideas: `Layout.md` (read for narrative/spec context).
- Implementation plan (auth, tables, Stripe, UI steps): `Guidance.md`.
- Starter UI: `app/page.tsx` and `app/layout.tsx`.
