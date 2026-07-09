import dotenv from "dotenv";

// .env is authoritative: values there win over inherited shell variables
dotenv.config({ override: true });

export const env = {
  port: Number(process.env.PORT || 4000),
  appUrl: process.env.APP_URL || "http://localhost:3000",
  // This server's own public origin — needed to turn "/uploads/xxx.jpg" into a real
  // link when embedding property media in outbound WhatsApp/email messages.
  publicUrl: (process.env.PUBLIC_API_URL || `http://localhost:${Number(process.env.PORT || 4000)}`).replace(/\/$/, ""),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  whatsapp: {
    provider: process.env.WHATSAPP_PROVIDER || "mock",
    apiUrl: process.env.WHATSAPP_CLOUD_API_URL || "https://graph.facebook.com/v19.0",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  },
  msg91: {
    authKey: process.env.MSG91_AUTH_KEY || "",
    integratedNumber: process.env.MSG91_INTEGRATED_NUMBER || "",
    whatsappUrl: process.env.MSG91_WHATSAPP_URL || "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/",
  },
  smartping: {
    apiKey: process.env.SMARTPING_API_KEY || "",
    campaignName: process.env.SMARTPING_CAMPAIGN_NAME || "",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    apiUrl: process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions",
    // USD per 1,000,000 tokens — defaults match gpt-4o-mini's public pricing at the time
    // this was written. Cost tracking is an estimate for budget awareness, not a billing
    // record; update these if your OpenAI plan/model pricing differs.
    inputPricePerMillion: Number(process.env.OPENAI_INPUT_PRICE_PER_MILLION || 0.15),
    outputPricePerMillion: Number(process.env.OPENAI_OUTPUT_PRICE_PER_MILLION || 0.6),
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || "RealRest CRM <noreply@realrest.example>",
  },
  clientUrl: (process.env.CLIENT_URL || "").replace(/\/$/, ""),
  // Bi-directional sync with the public marketing website's property catalog.
  // Unconfigured by default — outbound pushes no-op (logged) and the inbound
  // webhook returns 503 until both are set.
  websiteSync: {
    apiUrl: (process.env.WEBSITE_API_URL || "").replace(/\/$/, ""),
    apiKey: process.env.WEBSITE_API_KEY || "",
    webhookSecret: process.env.WEBSITE_WEBHOOK_SECRET || "",
  },
  // Shared-secret auth for generic inbound lead webhooks (contact forms, CTA
  // pop-ups, WhatsApp click-to-chat relays). Unset = webhook endpoints reject all calls.
  leadWebhookSecret: process.env.LEAD_WEBHOOK_SECRET || "",
  meta: {
    verifyToken: process.env.META_VERIFY_TOKEN || "",
    appSecret: process.env.META_APP_SECRET || "",
    pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN || "",
    graphApiUrl: process.env.META_GRAPH_API_URL || "https://graph.facebook.com/v19.0",
  },
};
