import { env } from "../config/env";
import { badRequest } from "../lib/errors";

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface AiResponse {
  text: string;
  usage: AiUsage;
}

/** Calls OpenAI's chat completions API. Throws a 400 if no key is configured, so the caller gets a clear message instead of a silent failure. */
export async function askOpenAI(messages: ChatMessage[]): Promise<AiResponse> {
  if (!env.openai.apiKey) {
    throw badRequest("AI features are not configured — set OPENAI_API_KEY on the server");
  }
  const res = await fetch(env.openai.apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openai.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openai.model,
      messages,
      temperature: 0.6,
    }),
  });
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    error?: { message: string };
  };
  if (!res.ok || data.error) {
    throw badRequest(`AI request failed: ${data.error?.message ?? `HTTP ${res.status}`}`);
  }
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw badRequest("AI returned an empty response");

  const promptTokens = data.usage?.prompt_tokens ?? 0;
  const completionTokens = data.usage?.completion_tokens ?? 0;
  const estimatedCostUsd =
    (promptTokens / 1_000_000) * env.openai.inputPricePerMillion +
    (completionTokens / 1_000_000) * env.openai.outputPricePerMillion;

  return {
    text,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: data.usage?.total_tokens ?? promptTokens + completionTokens,
      estimatedCostUsd,
    },
  };
}
