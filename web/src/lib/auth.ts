import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import type { Employee, Role } from "@prisma/client";

// Fail loudly at startup rather than silently signing tokens with "undefined".
// `as string` here (not just the runtime check below) is what fixes the
// jwt.sign/jwt.verify overload errors — TypeScript's narrowing from the
// `if (!JWT_SECRET) throw` guard doesn't carry into signSession/verifySession,
// since those are separate function declarations further down the file.
const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not set. Add it to web/.env (any long random string works for dev)."
  );
}

const COOKIE_NAME = "stellarfx_session";
const SESSION_DAYS = 7;

export interface SessionPayload {
  employeeId: string;
  companyId: string;
  role: Role;
}

// ---------- Passwords ----------

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ---------- JWT ----------

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    // Expired, tampered, or malformed — all treated the same: not logged in.
    return null;
  }
}

// ---------- Cookie helpers ----------
// Next.js 14 App Router: cookies() is async in route handlers/server actions.

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = signSession(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// ---------- Current employee ----------

/**
 * Reads the session cookie, verifies it, and loads the full Employee row.
 * Returns null if there's no valid session — callers decide what to do
 * about that (401 in an API route, redirect in a page/layout).
 */
export async function getCurrentEmployee(): Promise<Employee | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = verifySession(token);
  if (!session) return null;

  const employee = await prisma.employee.findUnique({
    where: { id: session.employeeId },
  });

  return employee;
}

// ---------- Invite tokens ----------

export function generateInviteToken(): string {
  // Two concatenated UUIDs — plenty of entropy for a single-use invite link,
  // no extra dependency needed.
  return randomUUID() + randomUUID();
}