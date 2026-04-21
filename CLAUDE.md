# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

DownTime is a restaurant equipment issue tracking app. It's a **pnpm monorepo** with an Express 5 API server, a React Native (Expo) mobile app, and a PostgreSQL database accessed via Drizzle ORM.

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

### Seeding (`scripts`)
```bash
pnpm --filter @workspace/scripts run seed      # Seed demo restaurants + supervisors
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

### API Server (`artifacts/api-server/src`)
- `app.ts` — Express app setup (CORS, middleware, route mounting)
- `index.ts` — Entry point (auto-seeds if DB empty, then listens)
- `routes/` — Route handlers per resource: auth, issues, restaurants, equipment, admin-users, storage
- `lib/auth.ts` — PBKDF2-SHA512 password hashing (100k iterations), token ops
- `lib/objectStorage.ts` — Google Cloud Storage integration for photo uploads
- `lib/notifications.ts` — Expo Push Notifications to supervisors
- `lib/equipment.ts` — In-memory equipment catalog (not DB-backed by design)

### Mobile App (`artifacts/mobile`)
- Uses **Expo Router** (file-based routing under `app/`)
- `app/(restaurant)/` — Device-mode routes (report issues, view issues list)
- `app/(supervisor)/` — Supervisor routes with bottom tabs (dashboard, issues, settings)
- `app/issue/[id].tsx` — Shared issue detail screen
- `context/AuthContext.tsx` — Global auth state, persisted to AsyncStorage
- `lib/queryClient.ts` — TanStack React Query client setup
- API calls go through Orval-generated hooks from `@workspace/api-client-react`

### Database Schema (`lib/db/src/schema/`)
- `restaurants.ts`, `supervisors.ts` — Core entities
- `sessions.ts` — `device_sessions`, `supervisor_sessions`, `pairing_codes`
- `issues.ts` — Issues with enums: area (4 types), status (open/in_progress/waiting/resolved), priority (urgent/high/normal)
- `comments.ts` — Issue comments
- `supervisor-restaurants.ts` — M2M relationship

### Authentication Flow
- **Devices/restaurants**: 6-char PIN pairing code → stored token in `device_sessions`
- **Supervisors**: Username + password (PBKDF2) → stored token in `supervisor_sessions`
- All requests: `Authorization: Bearer <token>` header
- Sessions are stored in DB (not JWTs); can be revoked

### State Management
- **Auth state**: React Context (`AuthContext`) + AsyncStorage persistence; clears React Query cache on login/logout
- **Server state**: TanStack React Query v5 via Orval-generated hooks

## Key Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `PORT` — Mobile dev server port (optional)
- GCS credentials are expected for photo upload functionality
