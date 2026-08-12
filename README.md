# NAKA Hair

NAKA Hair is a Next.js storefront with customer accounts, a separate vendor portal, vendor-owned products and orders, multi-image product galleries, and Supabase-backed authentication and storage.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript 7
- Supabase Auth, Postgres, and Storage
- Vercel Functions through typed Route Handlers
- Vitest

The current storefront markup and CSS are preserved during the compatibility phase so the migration does not redesign the live website. New server routes live under `app/api`, while the proven business rules are retained under `legacy/api` until they are converted incrementally to native TypeScript modules.

## Requirements

- Node.js 22 or later
- npm
- A Supabase project with the migrations in `supabase/migrations`

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm run typecheck
npm test
npm run build
```

## Project layout

```text
app/                  Next.js pages, client bootstrap, and Route Handlers
legacy/index.html     Preserved storefront markup, CSS, and behavior source
legacy/api/           Existing validated commerce and vendor business rules
lib/                  Server helpers and the Route Handler adapter
public/               Static assets and generated storefront script
scripts/              Compatibility build tooling
supabase/migrations/  Database and storage migrations
tests/                Vitest coverage
```

`public/scripts/storefront.js` is generated from `legacy/index.html` by `npm run extract:legacy`; edit the legacy source rather than the generated file.

## Environment variables

Set all variables from `.env.example` in Vercel. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only and marked sensitive. Public variables are embedded into the browser bundle during the build.

Customer and vendor capabilities remain separate: becoming a vendor does not replace the customer profile role, and every vendor product/order operation is ownership-scoped on the server.
