# Workspace

## Overview

**DownTime** — Restaurant equipment and technology issue tracking app. iPad-optimized for shared restaurant use. Full-stack: Expo mobile app + Express API + PostgreSQL via Drizzle ORM.

pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo (React Native) + Expo Router

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   └── mobile/             # Expo app
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks + custom fetch
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
└── pnpm-workspace.yaml
```

## DownTime App

### Features

- **Restaurant PIN login**: Shared iPad access with 4-digit PIN
- **Supervisor login**: Individual username/password
- **Restaurant home**: Issues list with status filters (Open / In Progress / Waiting / Resolved / All)
- **Report issue flow**: Multi-step: Area → Equipment → Sub-item → Description → Submit
- **Issue detail**: Status update, priority (supervisor only), comments
- **Supervisor dashboard**: Per-restaurant stats + issue summaries
- **Supervisor issues**: Filterable list across all restaurants with area filter

### Auth

- Sessions stored in AsyncStorage (persistent across app restarts)
- Bearer token via `setAuthTokenGetter` in the API client
- Token set on root `_layout.tsx` load

### Equipment Catalog

The equipment catalog (`lib/api-server/src/lib/equipment.ts`) is a **global in-memory constant** — not a per-restaurant database table. All restaurants share the same catalog of equipment items organized by area (Front Counter, Grill, Back of House, Technology). This is intentional for V1: the catalog is consistent across all restaurant locations. The `GET /api/equipment` endpoint requires authentication (bearer token) and optionally accepts an `area` query param to filter the response.

### Seed Data

| Restaurant | PIN | Location |
|---|---|---|
| Maple Street | 1234 | Maple St & 5th Ave |
| Downtown West | 5678 | 100 Main St |
| Airport Rd | 4321 | 2200 Airport Road |
| Riverside | 9876 | 300 River Blvd |

| Supervisor | Username | Password |
|---|---|---|
| Alex Johnson | admin | admin123 |
| Maria Garcia | supervisor | pass123 |

Supervisor passwords are stored as PBKDF2-SHA512 with a random 16-byte salt in `salt:hash` format (100,000 iterations). The seed script and API auth lib use identical hashing logic.

### Navigation (Expo Router)

```
app/
  _layout.tsx         ← Root stack + QueryClient + AuthProvider
  index.tsx           ← Auth redirect (restaurant/supervisor/login)
  login.tsx           ← Login screen (choose → PIN or supervisor form)
  (restaurant)/
    _layout.tsx       ← Stack layout
    index.tsx         ← Issues home + Report Issue FAB
    report.tsx        ← Multi-step report issue flow
  (supervisor)/
    _layout.tsx       ← Tab layout (Dashboard + All Issues)
    index.tsx         ← Supervisor dashboard
    issues.tsx        ← All issues with filters
  issue/[id].tsx      ← Shared issue detail (status/priority/comments)
```

### Colors

Flat color object in `constants/colors.ts`:
- `primary`: `#0F3460` (deep navy)
- `accent`: `#E63946` (red/alert)
- `success`: `#2D9651`
- `warning`: `#E6A817`
- Status colors: openStatus, inProgressStatus, waitingStatus, resolvedStatus
- Priority colors: urgent, high, normal (each with `*Bg` variant)

### API Routes

| Method | Path | Description |
|---|---|---|
| POST | /api/auth/restaurant/login | PIN login → token + restaurant |
| POST | /api/auth/supervisor/login | Cred login → token + supervisor |
| POST | /api/auth/supervisor/logout | Clear supervisor session |
| GET | /api/auth/me | Current user info |
| GET | /api/restaurants | List all (supervisor) |
| GET | /api/restaurants/:id/issues | Restaurant issues with status filter |
| GET | /api/issues | All issues (supervisor) with filters |
| POST | /api/issues | Create issue |
| GET | /api/issues/:id | Issue detail with comments |
| PATCH | /api/issues/:id | Update status/priority/assignedTo |
| POST | /api/issues/:id/comments | Add comment { authorName, body } |
| GET | /api/equipment | Equipment catalog by area |

### Issue Schema

- `area`: Front Counter / Grill / Back of House / Technology
- `category`: auto-derived (Front Counter/Grill/Back of House → equipment; Technology → technology)
- `status`: open / in_progress / waiting / resolved
- `priority`: urgent / high / normal / null (supervisor-only)
- Sort: priority desc (urgent first), then createdAt asc (oldest first)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files emitted during typecheck
- **Project references** — cross-package imports need references in tsconfig

## Key Commands

```bash
# Run development
pnpm --filter @workspace/api-server run dev   # API on port 8080
pnpm --filter @workspace/mobile run dev       # Expo (port from PORT env)

# Database
pnpm --filter @workspace/db run push          # Push schema to DB
pnpm --filter @workspace/scripts run seed     # Seed demo data

# Code generation
pnpm --filter @workspace/api-spec run codegen # Regenerate API client
```
