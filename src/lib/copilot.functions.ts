import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";
import type { CopilotChatMessage, CopilotInspectContext, CopilotResponse } from "./copilot.server";

export type CopilotQueryInput = {
  message: string;
  history?: CopilotChatMessage[];
  inspectContext?: CopilotInspectContext | null;
  userApiKey?: string;
};

export const chatWithCopilotFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: CopilotQueryInput) => {
    const message = String(input?.message ?? "").trim();
    if (!message) throw new Error("Message cannot be empty");

    return {
      message,
      history: Array.isArray(input?.history) ? input.history : [],
      inspectContext: input?.inspectContext ?? null,
      userApiKey: input?.userApiKey ? String(input.userApiKey).trim() : undefined,
    };
  })
  .handler(async ({ data, context }): Promise<CopilotResponse> => {
    const { orgId, userId } = context;
    const { executeCopilotQuery } = await import("./copilot.server");

    return await executeCopilotQuery({
      message: data.message,
      history: data.history,
      inspectContext: data.inspectContext,
      orgId,
      userId,
      userApiKey: data.userApiKey,
    });
  });
