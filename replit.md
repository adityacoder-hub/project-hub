# Project Hub Preview

An owner-curated catalog for browsing original software projects, with personal accounts and a private owner studio.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `PROJECT_HUB_OWNER_EMAIL`, `PROJECT_HUB_ADMIN_SETUP_TOKEN`
- `PROJECT_HUB_ADMIN_SETUP_TOKEN` is a Replit Secret with at least 32 characters; keep it private and use it only for the first owner account setup.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/project-hub.ts` — catalog, account, subscription, and session tables
- `lib/api-spec/openapi.yaml` — API contract; generated client hooks and validation live in the workspace libraries
- `artifacts/api-server/src/lib/project-hub-auth.ts` — password hashing, sessions, and server-side authorization
- `artifacts/project-hub/src/App.tsx` — catalog pages and account flows

## Architecture decisions

- Authentication is custom and database-backed: scrypt password hashes and random opaque session tokens stored as hashes, delivered through HttpOnly cookies.
- The first administrator account requires both `PROJECT_HUB_OWNER_EMAIL` and `PROJECT_HUB_ADMIN_SETUP_TOKEN`; sign-up never grants administrator access by itself.
- Development schema changes use `pnpm --filter @workspace/db run push`; do not apply them to production without an explicit request.

## Product

- Visitors can browse the owner-curated catalog. Signed-in users can save favorites and view their account activity and access status.
- Only the owner administrator can add, edit, publish, unpublish, or delete projects. Regular accounts must never receive project-management permissions.

## User preferences

- Do not use Clerk or another paid authentication provider.
- Do not rely on localStorage as the sole security mechanism for authentication or premium access.

## Gotchas

- Set the owner email and the 32+ character setup secret before creating the administrator account; only one administrator is allowed.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
