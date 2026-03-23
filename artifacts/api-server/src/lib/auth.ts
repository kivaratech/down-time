import { db, restaurantSessionsTable, supervisorSessionsTable, restaurantsTable, supervisorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Request } from "express";
import crypto from "crypto";

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function getRestaurantFromToken(token: string) {
  if (!token) return null;
  const [session] = await db
    .select()
    .from(restaurantSessionsTable)
    .where(eq(restaurantSessionsTable.token, token))
    .limit(1);
  if (!session) return null;
  const [restaurant] = await db
    .select()
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, session.restaurantId))
    .limit(1);
  return restaurant ?? null;
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
    .where(eq(supervisorsTable.id, session.supervisorId))
    .limit(1);
  return supervisor ?? null;
}

export function extractToken(req: Request): string {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return "";
}
