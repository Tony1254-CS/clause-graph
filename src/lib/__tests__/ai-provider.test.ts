import { describe, it, expect } from "vitest";
import { resolveAiProvider } from "../ai.server";

describe("T1.5 (B-3): AI Provider Resolution", () => {
  it("resolves to OpenAI when OPENAI_API_KEY is present", () => {
    const provider = resolveAiProvider({
      OPENAI_API_KEY: "sk-test-key",
    });

    expect(provider.kind).toBe("openai");
    expect(provider.endpoint).toBe("https://api.openai.com/v1/chat/completions");
    expect(provider.headers["Authorization"]).toBe("Bearer sk-test-key");
    expect(provider.defaultModel).toBe("gpt-4o-mini");
  });

  it("resolves to Gemini OpenAI-compatible endpoint when only GEMINI_API_KEY is set (B-3 fix)", () => {
    const provider = resolveAiProvider({
      GEMINI_API_KEY: "AIzaSyTestKey",
    });

    expect(provider.kind).toBe("gemini");
    expect(provider.endpoint).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    );
    expect(provider.headers["Authorization"]).toBe("Bearer AIzaSyTestKey");
    expect(provider.defaultModel).toBe("gemini-2.5-flash");
  });

  it("resolves to custom OpenAI-compatible endpoint when OPENAI_BASE_URL is set", () => {
    const provider = resolveAiProvider({
      OPENAI_BASE_URL: "http://localhost:8000/v1",
      OPENAI_API_KEY: "test-token",
    });

    expect(provider.kind).toBe("custom");
    expect(provider.endpoint).toBe("http://localhost:8000/v1/chat/completions");
    expect(provider.headers["Authorization"]).toBe("Bearer test-token");
  });

  it("resolves to Lovable gateway when only LOVABLE_API_KEY is set", () => {
    const provider = resolveAiProvider({
      LOVABLE_API_KEY: "lov-test-key",
    });

    expect(provider.kind).toBe("lovable");
    expect(provider.endpoint).toBe("https://ai.gateway.lovable.dev/v1/chat/completions");
    expect(provider.headers["Lovable-API-Key"]).toBe("lov-test-key");
  });

  it("resolves to none when no keys or URLs are configured", () => {
    const provider = resolveAiProvider({});

    expect(provider.kind).toBe("none");
    expect(provider.endpoint).toBe("");
  });

  it("respects custom AI_MODEL and AI_MODEL_STRONG overrides", () => {
    const provider = resolveAiProvider({
      OPENAI_API_KEY: "sk-test",
      AI_MODEL: "gpt-4.1-mini",
      AI_MODEL_STRONG: "gpt-4.1-strong",
    });

    expect(provider.defaultModel).toBe("gpt-4.1-mini");
    expect(provider.strongModel).toBe("gpt-4.1-strong");
  });
});
