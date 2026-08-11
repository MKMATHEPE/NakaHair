# NAKA Hair

NAKA Hair is a multi-vendor ecommerce storefront being migrated from a single-file JavaScript application to a typed Next.js architecture.

## Stack

- Next.js 16 App Router and React 19
- TypeScript with strict checking
- Tailwind CSS 4 and owned shadcn-style UI primitives
- Supabase Postgres, Auth and Storage
- Zod validation at external-data boundaries
- Vitest for unit tests
- Vercel for previews and production deployments

The application requires Node.js 22 or newer. Supabase client libraries are dropping Node.js 20 support, so the runtime is pinned deliberately.

## Current migration status

The new Next.js storefront includes:

- Server-rendered catalogue data
- The three NAKA Hair collections
- Search and collection filtering
- Responsive product cards and product detail routes
- Multiple-image product galleries
- Cart feedback
- Loading, error and not-found states
- Supabase browser and server client utilities

The existing account, vendor application, vendor product editor and vendor order tools remain in `public/index.html` while they are ported. The Next.js header links to that portal at `/index.html#account`, and the ownership-scoped Vercel functions remain in `api/`.

## Local development

Copy the environment template and fill only the server secret locally:

```bash
cp .env.example .env.local
npm install
npm run dev
```

Never expose `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` through a variable prefixed with `NEXT_PUBLIC_`.

Useful checks:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Structure

```text
src/app/                 App Router pages and route-level states
src/components/          Storefront and shared UI components
src/lib/catalog.ts       Server-only Supabase catalogue access
src/lib/supabase/        Browser/server Supabase client factories
src/types/               Domain models
api/                     Existing ownership-scoped Vercel functions
public/index.html        Legacy account/vendor UI during migration
supabase/migrations/     Reviewed database migrations
```

## Security model

- Service-role and secret keys are server-only.
- Public clients use only the Supabase publishable key.
- Vendor access remains a capability attached to an approved vendor record; it does not replace the customer's profile role.
- Vendor product and order APIs verify the authenticated user and filter every mutation by vendor ownership.
- Uploaded product files are validated for type, signature and size.

## Migration strategy

The migration is intentionally incremental. The customer storefront is ported first, then Supabase cookie-based authentication, customer account pages, vendor tools, checkout and payment webhooks. Production should only switch to the Next.js entry point after those flows reach parity and pass end-to-end tests.
