import { badRequest } from "../lib/errors";
import { getIntegrationSettings } from "./integrationSettings.service";

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
  model: string;
}

/** Calls OpenAI's chat completions API using whatever's configured in Settings →
 * Integrations (falling back to env vars if never configured there). Throws a 400 if
 * no key is set, so the caller gets a clear message instead of a silent failure. */
export async function askOpenAI(messages: ChatMessage[]): Promise<AiResponse> {
  const settings = (await getIntegrationSettings()).openai;
  if (!settings.apiKey) {
    throw badRequest("AI features are not configured — set an OpenAI API key in Settings → Integrations");
  }
  const res = await fetch(settings.apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
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
    (promptTokens / 1_000_000) * settings.inputPricePerMillion +
    (completionTokens / 1_000_000) * settings.outputPricePerMillion;

  return {
    text,
    model: settings.model,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: data.usage?.total_tokens ?? promptTokens + completionTokens,
      estimatedCostUsd,
    },
  };
}
