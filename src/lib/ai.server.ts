/**
 * Direct AI Engine for ClauseGraph
 *
 * Production-grade client supporting:
 * 1. Native OpenAI (OPENAI_API_KEY)
 * 2. Google Gemini via OpenAI-compatible endpoint (GEMINI_API_KEY)
 * 3. Custom OpenAI-compatible base URLs (OPENAI_BASE_URL for vLLM/Ollama/Groq/Azure)
 * 4. Backward-compatible Lovable API Key (LOVABLE_API_KEY)
 * 5. Deterministic fallback mode when no AI provider keys are configured.
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionOptions = {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  response_format?: { type: "json_object" | "text" };
  timeoutMs?: number;
};

export type AiProviderKind = "openai" | "gemini" | "lovable" | "custom" | "none";

export type AiProvider = {
  kind: AiProviderKind;
  apiKey?: string;
  baseUrl: string;
  endpoint: string;
  defaultModel: string;
  strongModel: string;
  headers: Record<string, string>;
};

/**
 * Resolve active AI provider from environment with proper precedence and endpoints.
 */
export function resolveAiProvider(
  env: Record<string, string | undefined> = process.env,
): AiProvider {
  const customBaseUrl = env.OPENAI_BASE_URL?.trim();
  const openaiKey = env.OPENAI_API_KEY?.trim();
  const geminiKey = env.GEMINI_API_KEY?.trim();
  const lovableKey = env.LOVABLE_API_KEY?.trim();

  // 1. Custom OpenAI-compatible endpoint (vLLM, Ollama, Groq, Azure, etc.)
  if (customBaseUrl) {
    const key = openaiKey || geminiKey || "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (key) headers["Authorization"] = `Bearer ${key}`;
    return {
      kind: "custom",
      apiKey: key,
      baseUrl: customBaseUrl,
      endpoint: `${customBaseUrl.replace(/\/+$/, "")}/chat/completions`,
      defaultModel: env.AI_MODEL || "gpt-4o-mini",
      strongModel: env.AI_MODEL_STRONG || "gpt-4o",
      headers,
    };
  }

  // 2. Native OpenAI
  if (openaiKey) {
    return {
      kind: "openai",
      apiKey: openaiKey,
      baseUrl: "https://api.openai.com/v1",
      endpoint: "https://api.openai.com/v1/chat/completions",
      defaultModel: env.AI_MODEL || "gpt-4o-mini",
      strongModel: env.AI_MODEL_STRONG || "gpt-4o",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
    };
  }

  // 3. Google Gemini (via official OpenAI-compatible endpoint)
  if (geminiKey) {
    return {
      kind: "gemini",
      apiKey: geminiKey,
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      defaultModel: env.AI_MODEL || "gemini-2.5-flash",
      strongModel: env.AI_MODEL_STRONG || "gemini-2.5-pro",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${geminiKey}`,
      },
    };
  }

  // 4. Legacy Lovable AI Gateway
  if (lovableKey) {
    return {
      kind: "lovable",
      apiKey: lovableKey,
      baseUrl: "https://ai.gateway.lovable.dev/v1",
      endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
      defaultModel: env.AI_MODEL || "google/gemini-2.5-flash",
      strongModel: env.AI_MODEL_STRONG || "google/gemini-2.5-pro",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableKey,
      },
    };
  }

  // 5. No provider configured (offline / deterministic mode)
  return {
    kind: "none",
    baseUrl: "",
    endpoint: "",
    defaultModel: "",
    strongModel: "",
    headers: {},
  };
}

/**
 * Execute chat completion with resolved provider routing and timeouts.
 */
export async function chatCompletion(options: ChatCompletionOptions): Promise<string | null> {
  const provider = resolveAiProvider();
  if (provider.kind === "none") return null;

  let model = options.model;
  if (!model) {
    model = provider.defaultModel;
  } else if (provider.kind === "gemini" && !model.startsWith("gemini")) {
    model = provider.defaultModel;
  } else if (provider.kind === "openai" && model.startsWith("google/")) {
    model = provider.defaultModel;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);

  try {
    const res = await fetch(provider.endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: provider.headers,
      body: JSON.stringify({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.2,
        ...(options.response_format ? { response_format: options.response_format } : {}),
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`AI API error status ${res.status}:`, errText.slice(0, 300));
      return null;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error("AI chat completion request failed:", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
