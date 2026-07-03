import { MessageStatus } from "@prisma/client";
import { env } from "../config/env";

export interface SendResult {
  status: MessageStatus;
  providerMessageId?: string;
  error?: string;
}

export interface WhatsAppProvider {
  sendText(toNumber: string, body: string): Promise<SendResult>;
}

/** WhatsApp Cloud API (Meta Graph API) provider. */
class CloudApiProvider implements WhatsAppProvider {
  async sendText(toNumber: string, body: string): Promise<SendResult> {
    const url = `${env.whatsapp.apiUrl}/${env.whatsapp.phoneNumberId}/messages`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.whatsapp.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toNumber.replace(/[^\d+]/g, ""),
          type: "text",
          text: { body },
        }),
      });
      const data = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };
      if (!res.ok || data.error) {
        return { status: MessageStatus.FAILED, error: data.error?.message ?? `HTTP ${res.status}` };
      }
      return { status: MessageStatus.SENT, providerMessageId: data.messages?.[0]?.id };
    } catch (err) {
      return { status: MessageStatus.FAILED, error: err instanceof Error ? err.message : "Network error" };
    }
  }
}

/**
 * MSG91 WhatsApp provider (https://msg91.com).
 * Sends a session (free-form text) message — the recipient must have messaged
 * the integrated number within the last 24 hours; outside that window MSG91
 * requires an approved template, which is account-specific.
 */
class Msg91Provider implements WhatsAppProvider {
  async sendText(toNumber: string, body: string): Promise<SendResult> {
    // MSG91 expects numbers as digits with country code, no "+"
    const to = toNumber.replace(/\D/g, "");
    try {
      const res = await fetch(env.msg91.whatsappUrl, {
        method: "POST",
        headers: {
          authkey: env.msg91.authKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          integrated_number: env.msg91.integratedNumber.replace(/\D/g, ""),
          content_type: "text",
          recipient_number: to,
          text: body,
        }),
      });
      const raw = await res.text();
      let data: { status?: string; errors?: unknown; message?: unknown; request_id?: string } = {};
      try { data = JSON.parse(raw); } catch { /* keep raw for the error message */ }
      if (!res.ok || data.status === "fail" || data.status === "error") {
        const detail = [data.errors, data.message].find((v) => typeof v === "string") as string | undefined;
        return { status: MessageStatus.FAILED, error: detail || raw.slice(0, 300) || `HTTP ${res.status}` };
      }
      return { status: MessageStatus.SENT, providerMessageId: data.request_id };
    } catch (err) {
      return { status: MessageStatus.FAILED, error: err instanceof Error ? err.message : "Network error" };
    }
  }
}

/** Development provider: logs the message and reports it as sent. */
class MockProvider implements WhatsAppProvider {
  async sendText(toNumber: string, body: string): Promise<SendResult> {
    console.log(`[whatsapp:mock] to=${toNumber}\n${body}`);
    return { status: MessageStatus.SENT, providerMessageId: `mock-${Date.now()}` };
  }
}

export const whatsappProvider: WhatsAppProvider =
  env.whatsapp.provider === "cloud" ? new CloudApiProvider()
  : env.whatsapp.provider === "msg91" ? new Msg91Provider()
  : new MockProvider();

/** Replace {{placeholders}} in a template body with values. */
export function renderTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}
