import {
  db,
  restaurantsTable,
  supervisorsTable,
  supervisorSessionsTable,
  deviceSessionsTable,
  supervisorRestaurantsTable,
} from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { Request, Response } from "express";
import crypto from "crypto";
import type { Principal } from "../middleware/principal";

type SupervisorPrincipal = Extract<Principal, { kind: "supervisor" }>;

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = "sha512";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const verify = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(verify, "hex"), Buffer.from(hash, "hex"));
}

export async function getRestaurantFromToken(token: string) {
  if (!token) return null;
  const [session] = await db
    .select()
    .from(deviceSessionsTable)
    .where(and(eq(deviceSessionsTable.token, token), isNull(deviceSessionsTable.revokedAt)))
    .limit(1);
  if (!session) return null;
  const [restaurant] = await db
    .select()
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, session.restaurantId))
    .limit(1);
  return restaurant ?? null;
}

export async function getDeviceSessionFromToken(token: string) {
  if (!token) return null;
  const [session] = await db
    .select()
    .from(deviceSessionsTable)
    .where(and(eq(deviceSessionsTable.token, token), isNull(deviceSessionsTable.revokedAt)))
    .limit(1);
  return session ?? null;
}

export async function getSupervisorFromToken(token: string) {
  if (!token) return null;
  const [session] = await db
    .select()
    .from(supervisorSessionsTable)
    .where(eq(supervisorSessionsTable.token, token))
    .limit(1);
  if (!session) return null;
  const [supervisor] = await db
    .select()
    .from(supervisorsTable)
    .where(and(eq(supervisorsTable.id, session.supervisorId), eq(supervisorsTable.isActive, true)))
    .limit(1);
  return supervisor ?? null;
}

export async function getAdminFromToken(token: string) {
  const supervisor = await getSupervisorFromToken(token);
  if (!supervisor || supervisor.role !== "admin") return null;
  return supervisor;
}

export function extractToken(req: Request): string {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return "";
}

// ---------------------------------------------------------------------------
// Principal-based guards (Phase 2). These read req.principal (set by
// principalMiddleware) and respond with the appropriate 401/403/400. They
// coexist with the legacy getRestaurantFromToken/getSupervisorFromToken helpers
// during the gradual route migration in Phase 2c.
// ---------------------------------------------------------------------------

export function requireAuth(req: Request, res: Response): Principal | null {
  if (!req.principal) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return req.principal;
}

export function requireSupervisor(req: Request, res: Response): SupervisorPrincipal | null {
  const p = req.principal;
  if (!p) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  if (p.kind !== "supervisor") {
    res.status(403).json({ error: "Supervisor access required" });
    return null;
  }
  return p;
}

export function requireOrgAdmin(
  req: Request,
  res: Response,
): (SupervisorPrincipal & { organizationId: number }) | null {
  const p = req.principal;
  if (!p) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  if (p.kind !== "supervisor" || p.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  if (p.organizationId == null) {
    res.status(400).json({ error: "Organization context required" });
    return null;
  }
  return p as SupervisorPrincipal & { organizationId: number };
}

export function requireSuperAdmin(req: Request, res: Response): SupervisorPrincipal | null {
  const p = req.principal;
  if (!p) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  if (p.kind !== "supervisor" || p.role !== "super_admin") {
    res.status(403).json({ error: "Super admin access required" });
    return null;
  }
  return p;
}

// ---------------------------------------------------------------------------
// Access helpers (Phase 2c). These centralise the org+assignment checks used
// by by-ID endpoints so a non-admin supervisor can't fetch arbitrary issues by
// guessing an ID, and a future second-org admin can't reach across orgs.
// ---------------------------------------------------------------------------

/**
 * Returns true if the principal is allowed to act on the given restaurant.
 * - device:     must be the device's own restaurant.
 * - super_admin: yes (cross-org by design).
 * - admin:      restaurant must belong to admin's organization.
 * - supervisor: must have an explicit supervisor_restaurants assignment.
 */
export async function principalCanAccessRestaurant(
  principal: Principal,
  restaurantId: number,
): Promise<boolean> {
  if (principal.kind === "device") {
    return principal.restaurantId === restaurantId;
  }
  if (principal.role === "super_admin") {
    return true;
  }
  if (principal.role === "admin") {
    if (principal.organizationId == null) return false;
    const [r] = await db
      .select({ organizationId: restaurantsTable.organizationId })
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, restaurantId))
      .limit(1);
    return r?.organizationId === principal.organizationId;
  }
  // non-admin supervisor: assignment required
  const [a] = await db
    .select({ supervisorId: supervisorRestaurantsTable.supervisorId })
    .from(supervisorRestaurantsTable)
    .where(
      and(
        eq(supervisorRestaurantsTable.supervisorId, principal.supervisorId),
        eq(supervisorRestaurantsTable.restaurantId, restaurantId),
      ),
    )
    .limit(1);
  return !!a;
}

/**
 * Issue-level access check. Requires org match (unless super_admin) AND
 * restaurant access for the principal.
 */
export async function principalCanAccessIssue(
  principal: Principal,
  issue: { restaurantId: number; organizationId: number | null },
): Promise<boolean> {
  // Devices are never super_admin; supervisors with role "super_admin" bypass
  // the org check (cross-org by design). Everyone else must match orgs.
  const isSuperAdmin = principal.kind === "supervisor" && principal.role === "super_admin";
  if (!isSuperAdmin && principal.organizationId != null) {
    if (issue.organizationId !== principal.organizationId) return false;
  }
  return principalCanAccessRestaurant(principal, issue.restaurantId);
}
