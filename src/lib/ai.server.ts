/**
 * Direct AI Engine for ClauseGraph
 *
 * Production-grade client supporting native OpenAI (OPENAI_API_KEY), custom
 * OpenAI-compatible base URLs (OPENAI_BASE_URL for vLLM/Ollama/Groq/Azure),
 * with backward-compatible fallback to LOVABLE_API_KEY if present.
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

export async function chatCompletion(options: ChatCompletionOptions): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;
  const apiKey = openaiKey || geminiKey || lovableKey;

  if (!apiKey) return null;

  const isLovable = !openaiKey && !geminiKey && Boolean(lovableKey);
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const endpoint = isLovable
    ? "https://ai.gateway.lovable.dev/v1/chat/completions"
    : `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (isLovable) {
    headers["Lovable-API-Key"] = apiKey;
  } else {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  // Choose appropriate model based on availability
  let model = options.model ?? "gpt-4o";
  if (!isLovable && model.startsWith("google/")) {
    model = "gpt-4o-mini";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers,
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
