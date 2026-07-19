# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

DownTime is a **multi-tenant** restaurant equipment issue tracking app — each paying customer is an Organization that owns its restaurants, users, issues, equipment catalog, and photos. It's a **pnpm monorepo** with an Express 5 API server, a React Native (Expo) mobile app, and a PostgreSQL database accessed via Drizzle ORM.

## Commands

### Workspace-wide
```bash
pnpm run typecheck          # Full workspace TypeScript check
pnpm run build              # Typecheck all packages + build
```

### API Server (`artifacts/api-server`)
```bash
pnpm --filter @workspace/api-server run dev    # Build + start on port 8080
pnpm --filter @workspace/api-server run build  # esbuild → dist/index.mjs
pnpm --filter @workspace/api-server run start  # Run compiled dist
```

### Mobile App (`artifacts/mobile`)
```bash
pnpm --filter @workspace/mobile run dev        # Expo dev server
pnpm --filter @workspace/mobile run dev:web    # Web dev mode (port 3000)
pnpm --filter @workspace/mobile run build      # Build for web
```

### Database (`lib/db`)
```bash
pnpm --filter @workspace/db run push           # Push Drizzle schema to PostgreSQL
pnpm --filter @workspace/db run push-force     # Force migration
```

### API Codegen (`lib/api-spec`)
```bash
pnpm --filter @workspace/api-spec run codegen  # Regenerate Orval client from openapi.yaml
```

### Seeding & Migration Scripts (`scripts`)
```bash
pnpm --filter @workspace/scripts run seed                    # Dev: wipe & re-seed (destructive)
pnpm --filter @workspace/scripts run backfill-organizations  # Idempotent: adopts any orphan rows into the default org
pnpm --filter @workspace/scripts run migrate-phase2-pr3      # Idempotent: applies the Phase 2 PR-3 schema migration (NOT NULL + CHECK + per-org username unique). Already applied to prod.
pnpm --filter @workspace/scripts run reset-passwords         # Dev: reset admin/supervisor passwords to seed defaults
```

## Architecture

### Package Structure
```
artifacts/
  api-server/    # Express 5 server
  mobile/        # Expo React Native app
lib/
  db/            # Drizzle schema + PostgreSQL client
  api-spec/      # openapi.yaml (source of truth for API)
  api-zod/       # Generated Zod schemas (from Orval)
  api-client-react/  # Generated React Query hooks (from Orval)
scripts/         # One-off scripts (seed, etc.)
```

### OpenAPI-First Design
`lib/api-spec/openapi.yaml` is the **single source of truth** for all API contracts. After modifying the spec, run codegen to regenerate:
- `lib/api-zod/src/` — Zod request/response schemas used by the API server for validation
- `lib/api-client-react/src/generated/` — TanStack React Query hooks used by the mobile app

Never manually edit the generated files in `api-zod` or `api-client-react/src/generated/`.

### Multi-tenant Model
Every API request resolves to a `req.principal` (set by `middleware/principal.ts`) that includes the user's `organizationId`. Routes use `requireAuth` / `requireSupervisor` / `requireOrgAdmin` / `requireSuperAdmin` guards plus the `principalCanAccessRestaurant` / `principalCanAccessIssue` helpers in `lib/auth.ts` to scope every query by org.

- **Roles:** `super_admin` (platform owner, `organization_id = NULL`, cross-org — used to provision new customers) → `admin` (org admin, scoped to one org) → `supervisor` (org member, further scoped to assigned restaurants via `supervisor_restaurants`). A `device` principal is a paired tablet bound to one restaurant.
- **DB invariants:** `organization_id` is **NOT NULL** on `restaurants`, `issues`, `equipment_items`. `supervisors.organization_id` is nullable but the `supervisors_org_required` CHECK enforces `role='super_admin' OR organization_id IS NOT NULL`. Username uniqueness is composite `(organization_id, username)` so two orgs can both have an "admin"; a partial unique index covers super_admin names.
- **Storage:** photo uploads land at `<orgId>/uploads/<uuid>` in GCS; `GET /storage/objects/*` verifies the org prefix against the principal's org (super_admin bypasses). Legacy flat-path photos from before the Phase 4 cutover remain readable.
- **Migration history:** single-tenant → multi-tenant was a phased rollout (Phase 1 schema/backfill → Phase 2 isolation + NOT NULL → Phase 4 storage paths). Phase 3 (super-admin provisioning UI) is the only outstanding piece. See the `project_multitenant_migration.md` and `project_phase3_plan.md` memories for full context.

### API Server (`artifacts/api-server/src`)
- `app.ts` — Express app setup (CORS, middleware, route mounting); mounts `principalMiddleware` globally before `/api`.
- `index.ts` — Entry point (auto-seeds if DB empty, then listens)
- `middleware/principal.ts` — Resolves Bearer token → `req.principal`. Fails open: missing/invalid token leaves principal undefined so unauthenticated routes still work.
- `routes/` — Route handlers per resource: auth, issues, restaurants, equipment, admin-users, storage. Phase 3 will add `super-admin.ts`.
- `lib/auth.ts` — PBKDF2-SHA512 password hashing (100k iterations), token ops, principal guards (`requireAuth/Supervisor/OrgAdmin/SuperAdmin`), and access helpers (`principalCanAccessRestaurant/Issue`).
- `lib/objectStorage.ts` — Google Cloud Storage integration for photo uploads. New uploads land under `<orgId>/uploads/<uuid>`; `parseOrgFromObjectPath` extracts the prefix for the read-path auth check.
- `lib/notifications.ts` — Expo Push Notifications. Admin broadcast on new issues is **same-org only**.
- `lib/equipment.ts` — Equipment area → category mapping helper (`getCategoryForArea`). The catalog itself is DB-backed and per-org in `equipment_items`.

### Mobile App (`artifacts/mobile`)
- Uses **Expo Router** (file-based routing under `app/`)
- `app/(restaurant)/` — Device-mode routes (report issues, view issues list)
- `app/(supervisor)/` — Supervisor routes with bottom tabs (dashboard, issues, settings)
- `app/issue/[id].tsx` — Shared issue detail screen
- `context/AuthContext.tsx` — Global auth state, persisted to AsyncStorage
- `lib/queryClient.ts` — TanStack React Query client setup
- API calls go through Orval-generated hooks from `@workspace/api-client-react`

### Database Schema (`lib/db/src/schema/`)
- `organizations.ts` — Tenant root. Every other entity row belongs to exactly one org (super_admins are the lone exception).
- `restaurants.ts`, `supervisors.ts` — Core entities; both carry `organizationId` (NOT NULL on restaurants, nullable on supervisors with the `supervisors_org_required` CHECK + composite/partial unique on username).
- `sessions.ts` — `device_sessions`, `supervisor_sessions`, `pairing_codes` (org-derived via their parent rows).
- `issues.ts` — Issues with enums: area (4 types), status (open/waiting/resolved), priority (urgent/normal/low). Denormalized `organizationId` (NOT NULL) for fast list scoping.
- `comments.ts` — Issue comments (org-derived via issue).
- `equipment.ts` — `equipment_items` — per-org equipment catalog (was a single global catalog before Phase 1).
- `supervisor-restaurants.ts` — M2M assignment of supervisors to restaurants within their org.

### Authentication Flow
- **Devices/restaurants**: 6-char PIN pairing code → stored token in `device_sessions`
- **Supervisors / admins / super_admin**: Username + password (PBKDF2) → stored token in `supervisor_sessions`
- All requests: `Authorization: Bearer <token>` header
- Sessions are stored in DB (not JWTs); can be revoked
- `principalMiddleware` resolves the token to `req.principal = { kind, role, organizationId, ... }` on every request so route handlers don't repeat the token lookup. Routes should use the guards/access helpers in `lib/auth.ts` rather than reading the session row directly.

### State Management
- **Auth state**: React Context (`AuthContext`) + AsyncStorage persistence; clears React Query cache on login/logout
- **Server state**: TanStack React Query v5 via Orval-generated hooks

## Key Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `PORT` — Mobile dev server port (optional)
- GCS credentials are expected for photo upload functionality
