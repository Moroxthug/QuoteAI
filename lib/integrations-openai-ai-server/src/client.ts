import OpenAI from "openai";

function buildClient(): OpenAI {
  // Option 1: Groq (fast, free, OpenAI-compatible)
  if (process.env.GROQ_API_KEY) {
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });

    // Intercept chat completions to rewrite model names for Groq compatibility.
    // llama-3.3-70b-versatile and llama-4-scout were retired from this account's
    // model catalog after the move to a paid Groq plan (2026-08-18) — gpt-oss
    // and qwen3.6 are the current equivalents. gpt-oss models bill reasoning
    // tokens separately from `content`, so reasoning_effort caps that overhead;
    // qwen3.6 instead inlines its <think> block into `content` unless told not
    // to, which would otherwise break every caller's JSON.parse(content).
    const originalCreate = client.chat.completions.create.bind(client.chat.completions);
    (client.chat.completions as any).create = function (body: any, options: any) {
      if (body.model === "gpt-4o-mini") {
        body.model = "openai/gpt-oss-20b";
        body.reasoning_effort ??= "low";
      } else if (body.model === "gpt-4o") {
        const hasImages = body.messages.some((msg: any) =>
          Array.isArray(msg.content) && msg.content.some((c: any) => c.type === "image_url")
        );
        if (hasImages) {
          body.model = "qwen/qwen3.6-27b";
          body.reasoning_effort ??= "none";
        } else {
          body.model = "openai/gpt-oss-120b";
          body.reasoning_effort ??= "low";
        }
      }
      if (body.max_completion_tokens && body.max_completion_tokens > 16384) {
        body.max_completion_tokens = 16384;
      }
      if (body.max_tokens && body.max_tokens > 16384) {
        body.max_tokens = 16384;
      }
      return originalCreate(body, options);
    };

    return client;
  }

  // Option 2: Custom base URL (any OpenAI-compatible provider)
  if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }

  // Option 3: Standard OpenAI
  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  throw new Error(
    "No AI API key configured. Set GROQ_API_KEY (free at console.groq.com), " +
    "OPENAI_API_KEY, or AI_INTEGRATIONS_OPENAI_API_KEY + AI_INTEGRATIONS_OPENAI_BASE_URL."
  );
}

export const openai = buildClient();
