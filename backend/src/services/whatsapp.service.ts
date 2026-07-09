import { MessageStatus } from "@prisma/client";
import { env } from "../config/env";

export interface SendResult {
  status: MessageStatus;
  providerMessageId?: string;
  error?: string;
}

export interface WhatsAppProvider {
  sendText(toNumber: string, body: string, contactName?: string): Promise<SendResult>;
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

/**
 * SmartPing (https://smartping.in) WhatsApp Business API — a campaign/template
 * provider, not a free-form-text one: every send targets a pre-approved WhatsApp
 * template ("campaign") and fills its {{n}} placeholders via `templateParams`.
 *
 * The rest of this app already renders one final message string per send (via
 * renderTemplate() against our own WhatsAppTemplate rows), so bridging the two means
 * the SmartPing campaign's template must have exactly ONE variable that holds the
 * whole rendered message — set SMARTPING_CAMPAIGN_NAME to that campaign's name.
 *
 * Template to submit for Meta approval (in Meta Business Manager → WhatsApp Manager
 * → Message Templates, or wherever SmartPing's dashboard forwards the request to):
 *   Category: UTILITY
 *   Language: English (en_US)
 *   Body:     {{1}}
 *
 *             _Sent via RealRest CRM_
 * Once Meta approves it, create a Live "campaign" in SmartPing pointing at that
 * template and put its name in SMARTPING_CAMPAIGN_NAME. If your approved template
 * instead has multiple named variables, this integration needs adjusting to pass a
 * matching templateParams array instead of a single-element one.
 */
class SmartPingProvider implements WhatsAppProvider {
  async sendText(toNumber: string, body: string, contactName?: string): Promise<SendResult> {
    if (!env.smartping.apiKey || !env.smartping.campaignName) {
      return { status: MessageStatus.FAILED, error: "SmartPing is not configured — set SMARTPING_API_KEY and SMARTPING_CAMPAIGN_NAME" };
    }
    try {
      const res = await fetch("https://backend.api-wa.co/campaign/smartpingbsp/api/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: env.smartping.apiKey,
          campaignName: env.smartping.campaignName,
          destination: toNumber,
          userName: contactName || "Customer",
          source: "RealRest CRM",
          templateParams: [body],
        }),
      });
      const raw = await res.text();
      let data: { id?: string; messageId?: string; message?: string; error?: string; msg?: string } = {};
      try { data = JSON.parse(raw); } catch { /* keep raw for the error message */ }
      if (!res.ok) {
        return { status: MessageStatus.FAILED, error: data.message || data.error || data.msg || raw.slice(0, 300) || `HTTP ${res.status}` };
      }
      return { status: MessageStatus.SENT, providerMessageId: data.id || data.messageId };
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
  : env.whatsapp.provider === "smartping" ? new SmartPingProvider()
  : new MockProvider();

/** Replace {{placeholders}} in a template body with values. */
export function renderTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}
