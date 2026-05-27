import type { NextFunction, Request, Response } from "express";
import { db, restaurantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { extractToken, getDeviceSessionFromToken, getSupervisorFromToken } from "../lib/auth";
import { logger } from "../lib/logger";

/**
 * The authenticated principal for the request, attached by principalMiddleware.
 *
 * - `device` is a tablet paired to a restaurant. organizationId is derived from
 *   the restaurant — currently nullable until Phase 2 flips the column to NOT
 *   NULL, but post-backfill should always be set for real device sessions.
 * - `supervisor` covers admin, supervisor, and super_admin roles. super_admin
 *   intentionally has organizationId = null (operates across all orgs).
 */
export type Principal =
  | {
      kind: "device";
      restaurantId: number;
      organizationId: number | null;
    }
  | {
      kind: "supervisor";
      supervisorId: number;
      role: string;
      organizationId: number | null;
    };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}

/**
 * Resolves a Bearer token to req.principal. Fails open — if the token is
 * missing or invalid, principal is left undefined and the route's auth guard
 * is responsible for the 401. This middleware never short-circuits a response,
 * which keeps it safe to mount globally (unauthenticated routes pass through).
 */
export async function principalMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const deviceSession = await getDeviceSessionFromToken(token);
    if (deviceSession) {
      const [r] = await db
        .select({ organizationId: restaurantsTable.organizationId })
        .from(restaurantsTable)
        .where(eq(restaurantsTable.id, deviceSession.restaurantId))
        .limit(1);
      req.principal = {
        kind: "device",
        restaurantId: deviceSession.restaurantId,
        organizationId: r?.organizationId ?? null,
      };
      next();
      return;
    }

    const supervisor = await getSupervisorFromToken(token);
    if (supervisor) {
      req.principal = {
        kind: "supervisor",
        supervisorId: supervisor.id,
        role: supervisor.role,
        organizationId: supervisor.organizationId,
      };
    }
  } catch (err) {
    logger.error({ err }, "principal middleware lookup failed");
  }

  next();
}
