import {
  db,
  restaurantsTable,
  supervisorsTable,
  supervisorSessionsTable,
  deviceSessionsTable,
} from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { Request } from "express";
import crypto from "crypto";

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
