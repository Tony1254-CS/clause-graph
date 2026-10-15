import { createServerFn } from "@tanstack/react-start";
import type { AuthUser } from "./auth.server";
import { requireAuth } from "./auth-middleware";

export const signInWithPasswordFn = createServerFn({ method: "POST" })
  .validator((input: { email: string; password: string }) => {
    const email = String(input?.email ?? "").trim();
    const password = String(input?.password ?? "");
    if (!email || !password) throw new Error("Email and password are required");
    return { email, password };
  })
  .handler(async ({ data }): Promise<{ user: AuthUser; token: string }> => {
    const { loginWithPassword } = await import("./auth.server");
    return await loginWithPassword(data);
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
    const { registerUser } = await import("./auth.server");
    return await registerUser(data);
  });

export const demoLoginFn = createServerFn({ method: "POST" })
  .handler(async (): Promise<{ user: AuthUser; token: string }> => {
    const { ensureAndLoginDemoJudge } = await import("./auth.server");
    return await ensureAndLoginDemoJudge();
  });

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
    await query(
      `UPDATE auth.users SET encrypted_password = $1, updated_at = now() WHERE id = $2`,
      [hash, context.userId]
    );
    return { ok: true };
  });
