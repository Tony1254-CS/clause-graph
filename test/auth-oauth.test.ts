import { describe, it, expect, vi, beforeEach } from "vitest";
import { signToken, verifyToken } from "../src/lib/auth.server";

// Mock database query functions
vi.mock("../src/lib/db.server", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

import { queryOne } from "../src/lib/db.server";
import { loginWithOAuth } from "../src/lib/auth.server";

describe("OAuth Authentication Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully signs and verifies JWT token with org and role", async () => {
    const user = {
      id: "user-oauth-123",
      email: "counsel@enterprise.com",
      orgId: "org-oauth-456",
      role: "admin" as const,
    };

    const token = await signToken(user);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);

    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("user-oauth-123");
    expect(payload?.email).toBe("counsel@enterprise.com");
    expect(payload?.orgId).toBe("org-oauth-456");
    expect(payload?.role).toBe("admin");
  });

  it("authenticates an existing OAuth user without re-creating", async () => {
    const existingUserId = "99999999-9999-9999-9999-999999999999";
    const email = "google.workspace@clausegraph.ai";

    vi.mocked(queryOne).mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT id FROM auth.users")) {
        return { id: existingUserId };
      }
      if (sql.includes("SELECT \n      u.id") || sql.includes("SELECT \r\n      u.id") || sql.includes("u.id, \n      u.email")) {
        return {
          id: existingUserId,
          email,
          full_name: "Google Enterprise User",
          org_id: "org-123",
          org_name: "Google Enterprise Workspace",
          plan: "pro",
          role: "admin",
        };
      }
      return null;
    });

    const result = await loginWithOAuth({ provider: "google" });
    expect(result.user.email).toBe(email);
    expect(result.user.orgId).toBe("org-123");
    expect(result.token).toBeDefined();

    const decoded = await verifyToken(result.token);
    expect(decoded?.sub).toBe(existingUserId);
  });

  it("provisions a new OAuth user with Google provider metadata when account does not exist", async () => {
    const newUserId = "88888888-8888-8888-8888-888888888888";
    const customEmail = "partner@firm-law.com";

    vi.mocked(queryOne).mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT id FROM auth.users")) {
        return null; // Not found initially
      }
      if (sql.includes("INSERT INTO auth.users")) {
        return { id: newUserId, email: customEmail };
      }
      if (sql.includes("u.id, \n      u.email") || sql.includes("u.id, \r\n      u.email") || sql.includes("SELECT \n      u.id")) {
        return {
          id: newUserId,
          email: customEmail,
          full_name: "Senior Partner",
          org_id: "org-789",
          org_name: "Partner's Workspace",
          plan: "enterprise",
          role: "admin",
        };
      }
      return null;
    });

    const result = await loginWithOAuth({
      provider: "google",
      email: customEmail,
      fullName: "Senior Partner",
    });

    expect(result.user.id).toBe(newUserId);
    expect(result.user.email).toBe(customEmail);
    expect(result.token).toBeDefined();

    const decoded = await verifyToken(result.token);
    expect(decoded?.email).toBe(customEmail);
  });

  it("handles GitHub OAuth provider flow", async () => {
    const githubUserId = "77777777-7777-7777-7777-777777777777";
    const defaultGithubEmail = "github.developer@clausegraph.ai";

    vi.mocked(queryOne).mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT id FROM auth.users")) {
        return { id: githubUserId };
      }
      if (sql.includes("SELECT \n      u.id") || sql.includes("SELECT \r\n      u.id") || sql.includes("u.id, \n      u.email")) {
        return {
          id: githubUserId,
          email: defaultGithubEmail,
          full_name: "GitHub Developer",
          org_id: "org-git",
          org_name: "Developer Workspace",
          plan: "pro",
          role: "admin",
        };
      }
      return null;
    });

    const result = await loginWithOAuth({ provider: "github" });
    expect(result.user.email).toBe(defaultGithubEmail);
    expect(result.token).toBeDefined();
  });
});
