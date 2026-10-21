/**
 * High-Performance Groq LPU Engine Client
 *
 * Connects directly to Groq's ultra-low latency OpenAI-compatible API endpoint
 * (https://api.groq.com/openai/v1) powered by Language Processing Units (LPUs).
 *
 * Supported Models:
 * - llama-3.3-70b-versatile (Primary: 128k context, deep legal reasoning & tool execution)
 * - llama-3.1-8b-instant (Fast: sub-50ms intent classification and context pruning)
 * - deepseek-r1-distill-llama-70b (Reasoning: native Chain-of-Thought)
 */

export type GroqChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
};

export type GroqToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type GroqCompletionOptions = {
  messages: GroqChatMessage[];
  model?: "llama-3.3-70b-versatile" | "llama-3.1-8b-instant" | "deepseek-r1-distill-llama-70b" | string;
  temperature?: number;
  max_tokens?: number;
  tools?: GroqToolDefinition[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
  response_format?: { type: "json_object" | "text" };
  userApiKey?: string;
  timeoutMs?: number;
};

export type GroqCompletionResult = {
  content: string | null;
  reasoning_thought?: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export async function callGroqChat(options: GroqCompletionOptions): Promise<GroqCompletionResult | null> {
  const apiKey = (options.userApiKey || process.env.GROQ_API_KEY || "").trim();

  // If no Groq key is present, check fallback OpenAI or Gemini or return null to trigger smart fallback
  if (!apiKey) {
    return null;
  }

  const candidateModels = Array.from(
    new Set([
      options.model,
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "qwen/qwen3.8-27b",
      "llama-3.3-70b-versatile",
    ].filter(Boolean))
  ) as string[];

  for (const model of candidateModels) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

    try {
      const payload: Record<string, unknown> = {
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.max_tokens ?? 2048,
      };

      if (options.response_format) {
        payload.response_format = options.response_format;
      }

      if (options.tools && options.tools.length > 0) {
        payload.tools = options.tools;
        payload.tool_choice = options.tool_choice || "auto";
      }

      const res = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.warn(`[Groq Model ${model} returned ${res.status}]:`, errBody.slice(0, 200));
        continue; // Try next available model in candidate list
      }

      const data = await res.json() as {
        choices?: Array<{
          message?: {
            content?: string;
            reasoning_content?: string;
            tool_calls?: Array<{
              id: string;
              type: "function";
              function: { name: string; arguments: string };
            }>;
          };
        }>;
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };

      const choice = data.choices?.[0]?.message;
      if (!choice) continue;

      let content = choice.content ?? null;
      let reasoning_thought = choice.reasoning_content ?? null;

      if (content && content.includes("<think>")) {
        const match = content.match(/<think>([\s\S]*?)<\/think>/);
        if (match) {
          reasoning_thought = match[1].trim();
          content = content.replace(/<think>[\s\S]*?<\/think>/, "").trim();
        }
      }

      return {
        content,
        reasoning_thought,
        tool_calls: choice.tool_calls,
        model,
        usage: data.usage,
      };
    } catch (err) {
      clearTimeout(timeout);
      console.warn(`[Groq attempt failed for ${model}]:`, err);
    }
  }

  return null;
}

