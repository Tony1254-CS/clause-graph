import { describe, it, expect, vi } from "vitest";
import { getJwtSecret, signInviteToken, verifyInviteToken } from "../auth.server";

describe("T1.1 (S-3): JWT Secret Fail-Closed Policy", () => {
  it("throws in production when JWT_SECRET is missing", () => {
    expect(() => {
      getJwtSecret({ NODE_ENV: "production", JWT_SECRET: undefined });
    }).toThrow(/FATAL: JWT_SECRET must be set/);
  });

  it("throws in production when JWT_SECRET is less than 32 characters", () => {
    expect(() => {
      getJwtSecret({ NODE_ENV: "production", JWT_SECRET: "short-secret" });
    }).toThrow(/at least 32 characters long/);
  });

  it("returns Uint8Array in production when JWT_SECRET is at least 32 characters", () => {
    const validSecret = "a".repeat(32);
    const result = getJwtSecret({ NODE_ENV: "production", JWT_SECRET: validSecret });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(32);
  });

  it("provides an ephemeral per-process fallback in development without throwing", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = getJwtSecret({ NODE_ENV: "development", JWT_SECRET: "" });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
    consoleSpy.mockRestore();
  });
});

describe("T1.2 (S-1/S-2): Invite Token Cryptographic Lifecycle", () => {
  it("signs and successfully verifies an invite token", async () => {
    const payload = {
      userId: "user-123",
      email: "teammate@example.com",
      orgId: "org-456",
      role: "member" as const,
      invitedBy: "admin-789",
    };

    const token = await signInviteToken(payload);
    expect(typeof token).toBe("string");

    const decoded = await verifyInviteToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.purpose).toBe("invite");
    expect(decoded?.email).toBe(payload.email);
    expect(decoded?.orgId).toBe(payload.orgId);
    expect(decoded?.sub).toBe(payload.userId);
  });

  it("rejects corrupted or forged invite tokens", async () => {
    const validToken = await signInviteToken({
      userId: "u1",
      email: "test@example.com",
      orgId: "o1",
      role: "member",
      invitedBy: "admin",
    });

    const tampered = validToken.slice(0, -5) + "xyz12";
    const result = await verifyInviteToken(tampered);
    expect(result).toBeNull();
  });
});
