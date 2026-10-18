import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { AuthUser } from "./auth.server";

export type AuthContext = {
  userId: string;
  orgId: string;
  role: "admin" | "member";
  user: AuthUser;
};

export const requireAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();

    if (!request?.headers) {
      throw new Error("Unauthorized: No request headers available");
    }

    let token: string | null = null;
    const authHeader = request.headers.get("authorization");

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "").trim();
    }

    // Also check cookie if header is not present
    if (!token) {
      const cookieHeader = request.headers.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(/clausegraph_token=([^;]+)/);
        if (match) {
          token = match[1];
        }
      }
    }

    if (!token) {
      throw new Error("Unauthorized: No authorization token provided");
    }

    const { verifyToken, getUserDetails } = await import("./auth.server");
    const payload = await verifyToken(token);
    if (!payload) {
      throw new Error("Unauthorized: Invalid or expired token");
    }

    const user = await getUserDetails(payload.sub);
    if (!user) {
      throw new Error("Unauthorized: User account not found");
    }

    return next({
      context: {
        userId: user.id,
        orgId: user.orgId,
        role: user.role,
        user,
      },
    });
  }
);
