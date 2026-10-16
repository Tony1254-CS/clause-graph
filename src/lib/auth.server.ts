import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { query, queryOne } from "./db.server";

let _devSecret: string | null = null;

/**
 * Get JWT secret with fail-closed security in production (>= 32 chars required)
 * and an ephemeral random secret per-process in development if unset.
 */
export function getJwtSecret(
  env: { NODE_ENV?: string; JWT_SECRET?: string } = process.env,
): Uint8Array {
  const isProd = env.NODE_ENV === "production";
  const secret = env.JWT_SECRET;

  if (isProd) {
    if (!secret || secret.trim().length < 32) {
      throw new Error(
        "FATAL: JWT_SECRET must be set and at least 32 characters long in production environments.",
      );
    }
    return new TextEncoder().encode(secret);
  }

  if (secret && secret.trim().length > 0) {
    if (secret.length < 32) {
      console.warn("[SECURITY WARNING] JWT_SECRET is shorter than 32 characters in development.");
    }
    return new TextEncoder().encode(secret);
  }

  if (!_devSecret) {
    _devSecret = `dev-ephemeral-${crypto.randomUUID()}-${Date.now()}`;
    console.warn(
      "[SECURITY WARNING] JWT_SECRET is unset in development. Using an ephemeral per-process secret.",
    );
  }
  return new TextEncoder().encode(_devSecret);
}

const TOKEN_EXPIRY = "7d";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string | null;
  orgId: string;
  orgName: string;
  plan: string;
  role: "admin" | "member";
};

export type JWTPayload = {
  sub: string;
  email: string;
  orgId: string;
  role: "admin" | "member";
};

export type InvitePayload = {
  purpose: "invite";
  sub: string;
  email: string;
  orgId: string;
  role: "admin" | "member";
  invitedBy: string;
};

/**
 * Sign a JWT token for the authenticated user
 */
export async function signToken(user: {
  id: string;
  email: string;
  orgId: string;
  role: "admin" | "member";
}): Promise<string> {
  const secret = getJwtSecret();
  return await new SignJWT({
    sub: user.id,
    email: user.email,
    orgId: user.orgId,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secret);
}

/**
 * Sign an invite token with 7-day expiration
 */
export async function signInviteToken(payload: {
  userId: string;
  email: string;
  orgId: string;
  role: "admin" | "member";
  invitedBy: string;
}): Promise<string> {
  const secret = getJwtSecret();
  return await new SignJWT({
    purpose: "invite",
    sub: payload.userId,
    email: payload.email,
    orgId: payload.orgId,
    role: payload.role,
    invitedBy: payload.invitedBy,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

/**
 * Verify and decode an invite token
 */
export async function verifyInviteToken(token: string): Promise<InvitePayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    if (payload.purpose !== "invite" || !payload.sub || !payload.email || !payload.orgId) {
      return null;
    }
    return {
      purpose: "invite",
      sub: payload.sub as string,
      email: payload.email as string,
      orgId: payload.orgId as string,
      role: (payload.role as "admin" | "member") || "member",
      invitedBy: (payload.invitedBy as string) || "",
    };
  } catch {
    return null;
  }
}

/**
 * Verify and decode a session JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || !payload.email) return null;
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      orgId: (payload.orgId as string) || "",
      role: (payload.role as "admin" | "member") || "member",
    };
  } catch (err) {
    return null;
  }
}

/**
 * Check if a workspace is the pre-seeded public evaluation/demo workspace
 */
export async function isDemoWorkspace(orgId: string): Promise<boolean> {
  const row = await queryOne<{ email: string }>(
    `SELECT u.email 
     FROM public.profiles p 
     JOIN auth.users u ON u.id = p.id 
     WHERE p.org_id = $1 AND LOWER(u.email) = 'judge@clausegraph.ai'
     LIMIT 1`,
    [orgId],
  );
  return Boolean(row);
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

/**
 * Compare plain password against bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Get complete user details including organization and role
 */
export async function getUserDetails(userId: string): Promise<AuthUser | null> {
  const row = await queryOne<{
    id: string;
    email: string;
    full_name: string | null;
    org_id: string;
    org_name: string;
    plan: string;
    role: "admin" | "member" | null;
  }>(
    `SELECT 
      u.id, 
      u.email, 
      p.full_name, 
      p.org_id, 
      o.name AS org_name, 
      o.plan,
      COALESCE(r.role, 'member') AS role
     FROM auth.users u
     LEFT JOIN public.profiles p ON p.id = u.id
     LEFT JOIN public.organizations o ON o.id = p.org_id
     LEFT JOIN public.user_roles r ON r.user_id = u.id AND r.org_id = p.org_id
     WHERE u.id = $1`,
    [userId],
  );

  if (!row || !row.org_id) return null;

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    orgId: row.org_id,
    orgName: row.org_name,
    plan: row.plan || "pro",
    role: row.role || "member",
  };
}

/**
 * Create a new user with automatic workspace, profile, and sample portfolio initialization
 */
export async function registerUser(params: {
  email: string;
  password: string;
  fullName?: string;
}): Promise<{ user: AuthUser; token: string }> {
  const normalizedEmail = params.email.trim().toLowerCase();

  // Check if user already exists
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM auth.users WHERE LOWER(email) = $1`,
    [normalizedEmail],
  );
  if (existing) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await hashPassword(params.password);
  const fullName = params.fullName?.trim() || null;

  // Insert user into auth.users (trigger on_auth_user_created automatically creates org, profile, role, samples)
  const inserted = await queryOne<{ id: string; email: string }>(
    `INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data)
     VALUES ($1, $2, $3::jsonb)
     RETURNING id, email`,
    [normalizedEmail, hashedPassword, JSON.stringify({ full_name: fullName })],
  );

  if (!inserted) {
    throw new Error("Failed to create user record");
  }

  const user = await getUserDetails(inserted.id);
  if (!user) {
    throw new Error("Failed to load user workspace profile");
  }

  const token = await signToken(user);
  return { user, token };
}

/**
 * Authenticate existing user with email and password
 */
export async function loginWithPassword(params: {
  email: string;
  password: string;
}): Promise<{ user: AuthUser; token: string }> {
  const normalizedEmail = params.email.trim().toLowerCase();

  const userRow = await queryOne<{
    id: string;
    email: string;
    encrypted_password: string | null;
  }>(`SELECT id, email, encrypted_password FROM auth.users WHERE LOWER(email) = $1`, [
    normalizedEmail,
  ]);

  if (!userRow || !userRow.encrypted_password) {
    throw new Error("Invalid email or password");
  }

  const valid = await verifyPassword(params.password, userRow.encrypted_password);
  if (!valid) {
    throw new Error("Invalid email or password");
  }

  const user = await getUserDetails(userRow.id);
  if (!user) {
    throw new Error("User account workspace not found");
  }

  const token = await signToken(user);
  return { user, token };
}

/**
 * Pre-seeded enterprise evaluation workspace for judges & hackathon evaluation
 */
export async function ensureAndLoginDemoJudge(): Promise<{ user: AuthUser; token: string }> {
  const demoEmail = "judge@clausegraph.ai";
  const demoPassword = "DemoPassword2026!";

  // Try logging in first
  const existing = await queryOne<{ id: string; encrypted_password: string }>(
    `SELECT id, encrypted_password FROM auth.users WHERE LOWER(email) = $1`,
    [demoEmail],
  );

  if (existing) {
    const user = await getUserDetails(existing.id);
    if (user) {
      const token = await signToken(user);
      return { user, token };
    }
  }

  // Create judge user if not yet initialized
  const hashedPassword = await hashPassword(demoPassword);
  const inserted = await queryOne<{ id: string }>(
    `INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data)
     VALUES ($1, $2, '{"full_name": "Judge Evaluation Account"}'::jsonb)
     ON CONFLICT (email) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password
     RETURNING id`,
    [demoEmail, hashedPassword],
  );

  if (!inserted) throw new Error("Could not initialize evaluation workspace");

  const user = await getUserDetails(inserted.id);
  if (!user) throw new Error("Could not load evaluation workspace profile");

  const token = await signToken(user);
  return { user, token };
}
