import { createMiddleware } from "@tanstack/react-start";

export const attachAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | null = null;
    if (typeof window !== "undefined") {
      token = localStorage.getItem("clausegraph_token");
    }
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }
);
