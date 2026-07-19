import { Property, PropertyImage } from "@prisma/client";
import { getIntegrationSettings } from "./integrationSettings.service";
import { resolveMediaUrl } from "../lib/media";

type PropertyWithImages = Property & { images?: PropertyImage[] };

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
export async function pushPropertyToWebsite(property: PropertyWithImages, action: SyncAction): Promise<void> {
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

function toWebsitePayload(p: PropertyWithImages) {
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
    videoUrl: resolveMediaUrl(p.videoUrl),
    // Previously omitted entirely — a property created/edited through the CRM synced to
    // the public site with every field except its photos, since the images relation
    // (loaded on every route that calls this) was never read into the payload.
    images: (p.images ?? [])
      .slice()
      .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || a.sortOrder - b.sortOrder)
      .map((img) => ({ url: resolveMediaUrl(img.url), isPrimary: img.isPrimary })),
  };
}
