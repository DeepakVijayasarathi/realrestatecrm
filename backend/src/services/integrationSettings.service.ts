import { prisma } from "../lib/prisma";
import { env } from "../config/env";

export interface WhatsAppSettings {
  provider: "mock" | "cloud" | "msg91" | "smartping";
  cloudApiUrl: string;
  phoneNumberId: string;
  accessToken: string;
  msg91AuthKey: string;
  msg91IntegratedNumber: string;
  msg91WhatsappUrl: string;
  smartpingApiKey: string;
  smartpingCampaignName: string;
}

export interface OpenAiSettings {
  apiKey: string;
  model: string;
  apiUrl: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
}

export interface MetaSettings {
  verifyToken: string;
  appSecret: string;
  pageAccessToken: string;
  graphApiUrl: string;
}

export interface WebsiteSyncSettings {
  apiUrl: string;
  apiKey: string;
  webhookSecret: string;
}

export interface LeadWebhookSettings {
  secret: string;
}

export interface IntegrationSettings {
  whatsapp: WhatsAppSettings;
  openai: OpenAiSettings;
  meta: MetaSettings;
  websiteSync: WebsiteSyncSettings;
  leadWebhook: LeadWebhookSettings;
}

/** Fields that hold real secrets — masked in API responses, and never overwritten by a
 * PUT that just echoes back the mask (see settings.routes.ts). */
export const SECRET_FIELDS: { [K in keyof IntegrationSettings]: (keyof IntegrationSettings[K])[] } = {
  whatsapp: ["accessToken", "msg91AuthKey", "smartpingApiKey"],
  openai: ["apiKey"],
  meta: ["appSecret", "pageAccessToken"],
  websiteSync: ["apiKey", "webhookSecret"],
  leadWebhook: ["secret"],
};

const DB_KEY_PREFIX = "integration_";

/** env vars remain the defaults a fresh install starts from — the Settings UI writes
 * overrides into the database, which win once configured. */
function defaults(): IntegrationSettings {
  return {
    whatsapp: {
      provider: (env.whatsapp.provider as WhatsAppSettings["provider"]) || "mock",
      cloudApiUrl: env.whatsapp.apiUrl,
      phoneNumberId: env.whatsapp.phoneNumberId,
      accessToken: env.whatsapp.accessToken,
      msg91AuthKey: env.msg91.authKey,
      msg91IntegratedNumber: env.msg91.integratedNumber,
      msg91WhatsappUrl: env.msg91.whatsappUrl,
      smartpingApiKey: env.smartping.apiKey,
      smartpingCampaignName: env.smartping.campaignName,
    },
    openai: {
      apiKey: env.openai.apiKey,
      model: env.openai.model,
      apiUrl: env.openai.apiUrl,
      inputPricePerMillion: env.openai.inputPricePerMillion,
      outputPricePerMillion: env.openai.outputPricePerMillion,
    },
    meta: {
      verifyToken: env.meta.verifyToken,
      appSecret: env.meta.appSecret,
      pageAccessToken: env.meta.pageAccessToken,
      graphApiUrl: env.meta.graphApiUrl,
    },
    websiteSync: {
      apiUrl: env.websiteSync.apiUrl,
      apiKey: env.websiteSync.apiKey,
      webhookSecret: env.websiteSync.webhookSecret,
    },
    leadWebhook: {
      secret: env.leadWebhookSecret,
    },
  };
}

let cache: IntegrationSettings | null = null;

async function loadFromDb(): Promise<IntegrationSettings> {
  const merged = defaults();
  const rows = await prisma.setting.findMany({
    where: { key: { in: (Object.keys(merged) as (keyof IntegrationSettings)[]).map((k) => DB_KEY_PREFIX + k) } },
  });
  for (const row of rows) {
    const section = row.key.slice(DB_KEY_PREFIX.length) as keyof IntegrationSettings;
    if (section in merged) Object.assign(merged[section], row.value as object);
  }
  return merged;
}

/** Cached after first load (this process is the only writer, via updateIntegrationSection
 * below, which updates the cache directly) — avoids a DB round-trip on every WhatsApp/AI call. */
export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  if (!cache) cache = await loadFromDb();
  return cache;
}

export async function updateIntegrationSection<K extends keyof IntegrationSettings>(
  section: K,
  patch: Partial<IntegrationSettings[K]>
): Promise<IntegrationSettings[K]> {
  const current = await getIntegrationSettings();
  const merged = { ...current[section], ...patch };
  await prisma.setting.upsert({
    where: { key: DB_KEY_PREFIX + section },
    create: { key: DB_KEY_PREFIX + section, value: merged as object },
    update: { value: merged as object },
  });
  current[section] = merged;
  return merged;
}

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

/** Masks every secret field in a section for API responses — the real value is never sent
 * back to the browser after it's saved once. */
export function maskSection<K extends keyof IntegrationSettings>(section: K, value: IntegrationSettings[K]): IntegrationSettings[K] {
  const masked = { ...value };
  for (const field of SECRET_FIELDS[section]) {
    (masked as unknown as Record<string, unknown>)[field as string] = maskSecret(String(value[field] ?? ""));
  }
  return masked;
}

export function maskAll(settings: IntegrationSettings): IntegrationSettings {
  return {
    whatsapp: maskSection("whatsapp", settings.whatsapp),
    openai: maskSection("openai", settings.openai),
    meta: maskSection("meta", settings.meta),
    websiteSync: maskSection("websiteSync", settings.websiteSync),
    leadWebhook: maskSection("leadWebhook", settings.leadWebhook),
  };
}

/** Strips any secret field whose incoming value is still the masked placeholder (i.e. the
 * user didn't actually change it) so saving the form never overwrites a real secret with dots. */
export function stripUnchangedSecrets<K extends keyof IntegrationSettings>(section: K, patch: Record<string, unknown>) {
  const cleaned = { ...patch };
  for (const field of SECRET_FIELDS[section]) {
    const v = cleaned[field as string];
    if (typeof v === "string" && v.startsWith("••••")) delete cleaned[field as string];
  }
  return cleaned;
}
