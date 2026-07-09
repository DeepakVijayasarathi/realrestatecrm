import { Property } from "@prisma/client";
import { getIntegrationSettings } from "./integrationSettings.service";

export type SyncAction = "created" | "updated" | "deleted";

/**
 * Push a property change back to the public website's API so listings created or
 * edited in the CRM appear live without a separate manual re-entry step.
 *
 * Best-effort and fire-and-forget by design: a slow or failing website endpoint must
 * never block or fail the CRM's own create/update/delete request. Logs to the console
 * (rather than calling out) when it isn't configured in Settings → Integrations, so
 * this is safe to leave wired up in every environment including local dev.
 */
export async function pushPropertyToWebsite(property: Property, action: SyncAction): Promise<void> {
  const settings = (await getIntegrationSettings()).websiteSync;
  if (!settings.apiUrl) {
    console.log(`[propertySync:mock] ${action} → ${property.id} (${property.title}) — website sync not configured`);
    return;
  }
  try {
    const res = await fetch(`${settings.apiUrl}/properties/${property.externalId ?? property.id}`, {
      method: action === "deleted" ? "DELETE" : "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
      },
      body: action === "deleted" ? undefined : JSON.stringify(toWebsitePayload(property)),
    });
    if (!res.ok) {
      console.error(`[propertySync] website API responded ${res.status} for property ${property.id}`);
    }
  } catch (err) {
    console.error(`[propertySync] failed to push property ${property.id}:`, err instanceof Error ? err.message : err);
  }
}

function toWebsitePayload(p: Property) {
  return {
    crmId: p.id,
    title: p.title,
    type: p.type,
    category: p.category,
    location: p.location,
    address: p.address,
    areaSqft: p.areaSqft,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    price: p.price,
    currency: p.currency,
    description: p.description,
    status: p.status,
    latitude: p.latitude,
    longitude: p.longitude,
    youtubeUrl: p.youtubeUrl,
  };
}
