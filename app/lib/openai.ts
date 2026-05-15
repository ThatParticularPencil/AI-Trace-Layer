import OpenAI from "openai";

export type LlmProvider = "openai" | "gemini" | "groq";

type ChatClient = {
  client: OpenAI;
  provider: LlmProvider;
  model: string;
};

const providerOrder: LlmProvider[] = ["gemini", "groq", "openai"];

function configuredProvider() {
  const provider = process.env.LLM_PROVIDER?.toLowerCase();
  if (provider === "openai" || provider === "gemini" || provider === "groq") return provider;
  return null;
}

function hasKey(provider: LlmProvider) {
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
  if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY);
  return Boolean(process.env.GROQ_API_KEY);
}

function resolveProvider() {
  const explicit = configuredProvider();
  if (explicit) return hasKey(explicit) ? explicit : null;
  return providerOrder.find(hasKey) ?? null;
}

export function getChatClient(): ChatClient | null {
  const provider = resolveProvider();
  if (!provider) return null;

  if (provider === "gemini") {
    return {
      provider,
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      client: new OpenAI({
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
      })
    };
  }

  if (provider === "groq") {
    return {
      provider,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1"
      })
    };
  }

  return {
    provider,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  };
}
