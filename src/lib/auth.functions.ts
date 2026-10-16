import { createServerFn } from "@tanstack/react-start";
import type { AuthUser } from "./auth.server";
import { requireAuth } from "./auth-middleware";

/**
 * Helper to set secure, HttpOnly session cookie
 */
async function attachSessionCookie(token: string) {
  try {
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie("clausegraph_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });
  } catch (err) {
    console.warn("[auth] Error setting session cookie:", err instanceof Error ? err.message : err);
  }
}

export const signInWithPasswordFn = createServerFn({ method: "POST" })
  .validator((input: { email: string; password: string }) => {
    const email = String(input?.email ?? "").trim();
    const password = String(input?.password ?? "");
    if (!email || !password) throw new Error("Email and password are required");
    return { email, password };
  })
  .handler(async ({ data }): Promise<{ user: AuthUser; token: string }> => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { assertRateLimit, getClientIp, AUTH_RATE_LIMIT } = await import("./rate-limit.server");
    const req = getRequest();
    const ip = getClientIp(req?.headers);
    assertRateLimit(`auth:login:${ip}`, AUTH_RATE_LIMIT, "login attempts");

    const { loginWithPassword } = await import("./auth.server");
    const result = await loginWithPassword({ ...data, ip });
    await attachSessionCookie(result.token);
    return result;
  });

export const signUpWithPasswordFn = createServerFn({ method: "POST" })
  .validator((input: { email: string; password: string; fullName?: string }) => {
    const email = String(input?.email ?? "").trim();
    const password = String(input?.password ?? "");
    const fullName = input?.fullName ? String(input.fullName).trim() : undefined;
    if (!email || !password) throw new Error("Email and password are required");
    if (password.length < 8) throw new Error("Password must be at least 8 characters");
    return { email, password, fullName };
  })
  .handler(async ({ data }): Promise<{ user: AuthUser; token: string }> => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { assertRateLimit, getClientIp, AUTH_RATE_LIMIT } = await import("./rate-limit.server");
    const req = getRequest();
    const ip = getClientIp(req?.headers);
    assertRateLimit(`auth:signup:${ip}`, AUTH_RATE_LIMIT, "account creation");

    const { registerUser } = await import("./auth.server");
    const result = await registerUser({ ...data, ip });
    await attachSessionCookie(result.token);
    return result;
  });

export const demoLoginFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ user: AuthUser; token: string }> => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { assertRateLimit, getClientIp, AUTH_RATE_LIMIT } = await import("./rate-limit.server");
    const req = getRequest();
    const ip = getClientIp(req?.headers);
    assertRateLimit(`auth:demo:${ip}`, AUTH_RATE_LIMIT, "demo login");

    const { ensureAndLoginDemoJudge } = await import("./auth.server");
    const result = await ensureAndLoginDemoJudge({ ip });
    await attachSessionCookie(result.token);
    return result;
  },
);

export const signOutFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: boolean }> => {
    try {
      const { getRequest, deleteCookie } = await import("@tanstack/react-start/server");
      const { revokeSession } = await import("./auth.server");
      const req = getRequest();
      let token: string | null = null;
      const authHeader = req?.headers?.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.replace("Bearer ", "").trim();
      }
      if (!token && req?.headers) {
        const cookie = req.headers.get("cookie");
        const m = cookie?.match(/clausegraph_token=([^;]+)/);
        if (m) token = m[1];
      }
      if (token) {
        await revokeSession(token);
      }
      deleteCookie("clausegraph_token", { path: "/" });
    } catch (err) {
      console.warn("[auth] Error in signOutFn:", err);
    }
    return { ok: true };
  },
);

export const getCurrentUserFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<AuthUser> => {
    return context.user;
  });

export const updatePasswordFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { password: string }) => {
    const password = String(input?.password ?? "");
    if (password.length < 8) throw new Error("Password must be at least 8 characters");
    return { password };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { hashPassword } = await import("./auth.server");
    const { query } = await import("./db.server");
    const hash = await hashPassword(data.password);
    await query(`UPDATE auth.users SET encrypted_password = $1, updated_at = now() WHERE id = $2`, [
      hash,
      context.userId,
    ]);
    return { ok: true };
  });

export const validateInviteTokenFn = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => {
    const token = String(input?.token ?? "").trim();
    if (!token) throw new Error("Invite token is required");
    return { token };
  })
  .handler(async ({ data }): Promise<{ valid: boolean; email?: string; orgName?: string }> => {
    const { verifyInviteToken } = await import("./auth.server");
    const { queryOne } = await import("./db.server");
    const payload = await verifyInviteToken(data.token);
    if (!payload) return { valid: false };

    // Check if user already set password
    const userRow = await queryOne<{ encrypted_password: string | null }>(
      `SELECT encrypted_password FROM auth.users WHERE id = $1`,
      [payload.sub],
    );
    if (!userRow || userRow.encrypted_password !== null) {
      return { valid: false };
    }

    const orgRow = await queryOne<{ name: string }>(
      `SELECT name FROM public.organizations WHERE id = $1`,
      [payload.orgId],
    );

    return {
      valid: true,
      email: payload.email,
      orgName: orgRow?.name ?? "ClauseGraph Workspace",
    };
  });

export const acceptInviteFn = createServerFn({ method: "POST" })
  .validator((input: { token: string; password: string; fullName?: string }) => {
    const token = String(input?.token ?? "").trim();
    const password = String(input?.password ?? "");
    const fullName = input?.fullName ? String(input.fullName).trim() : undefined;
    if (!token) throw new Error("Invite token is required");
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    return { token, password, fullName };
  })
  .handler(async ({ data }): Promise<{ user: AuthUser; token: string }> => {
    const { verifyInviteToken, hashPassword, getUserDetails, signToken, recordSession } =
      await import("./auth.server");
    const { query, queryOne } = await import("./db.server");

    const payload = await verifyInviteToken(data.token);
    if (!payload) {
      throw new Error("Invalid or expired invitation token.");
    }

    const userRow = await queryOne<{ id: string; encrypted_password: string | null }>(
      `SELECT id, encrypted_password FROM auth.users WHERE id = $1`,
      [payload.sub],
    );

    if (!userRow) {
      throw new Error("User record not found for this invitation.");
    }

    if (userRow.encrypted_password !== null) {
      throw new Error(
        "This invitation has already been accepted. Please log in with your password.",
      );
    }

    const hashedPassword = await hashPassword(data.password);
    await query(
      `UPDATE auth.users 
       SET encrypted_password = $1, email_confirmed_at = now(), updated_at = now() 
       WHERE id = $2`,
      [hashedPassword, userRow.id],
    );

    if (data.fullName) {
      await query(`UPDATE public.profiles SET full_name = $1 WHERE id = $2`, [
        data.fullName,
        userRow.id,
      ]);
    }

    const user = await getUserDetails(userRow.id);
    if (!user) throw new Error("Could not load user profile after accepting invitation.");

    const sessionToken = await signToken(user);
    await recordSession({
      userId: user.id,
      orgId: user.orgId,
      token: sessionToken,
    });
    await attachSessionCookie(sessionToken);
    return { user, token: sessionToken };
  });
