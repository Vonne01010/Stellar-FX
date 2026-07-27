import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

// This is a STUB. It verifies a token exists and is validly signed,
// and extracts a userId + role — but does not yet know about
// Member 4's real login/session flow, refresh tokens, etc.
// Swap the verification logic here once Member 4's auth is finalized;
// nothing in the route handlers below needs to change if the shape
// (userId, role) stays the same.

export type AuthContext = {
  userId: string;
  role: "ADMIN" | "EMPLOYEE";
};

export class AuthError extends Error {
  constructor(message: string, public status: number = 401) {
    super(message);
  }
}

export function requireAuth(request: NextRequest): AuthContext {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AuthError("Missing or malformed Authorization header");
  }

  const token = authHeader.slice("Bearer ".length);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    // This is a server misconfiguration, not a client error —
    // 500, not 401, and log it loudly since it means every
    // authenticated route is currently broken.
    console.error("JWT_SECRET is not set in environment variables");
    throw new AuthError("Server auth configuration error", 500);
  }

  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;

    if (!payload.userId || !payload.role) {
      throw new AuthError("Token is missing required claims (userId, role)");
    }

    return { userId: payload.userId, role: payload.role };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    // jwt.verify throws its own errors for expired/invalid/tampered tokens
    throw new AuthError("Invalid or expired token");
  }
}

// Convenience wrapper for role-gating specific routes, e.g. only
// admins can create payroll runs.
export function requireRole(
  context: AuthContext,
  allowedRoles: AuthContext["role"][]
) {
  if (!allowedRoles.includes(context.role)) {
    throw new AuthError(
      `This action requires one of these roles: ${allowedRoles.join(", ")}`,
      403
    );
  }
}

/*
  HOW TO USE THIS IN A ROUTE (example, not wired in yet):

  import { requireAuth, requireRole, AuthError } from "@/middleware/auth";

  export async function POST(request: NextRequest) {
    try {
      const auth = requireAuth(request);
      requireRole(auth, ["ADMIN"]);
      // ... rest of your route logic
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      // ... existing error handling
    }
  }
*/