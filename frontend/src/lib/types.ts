export type Role = "SUPER_ADMIN" | "SALES_MANAGER" | "SALES_EXECUTIVE" | "PROPERTY_STAFF" | "PARTNER_USER";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  isActive?: boolean;
  partnerCompanyId?: string | null;
  partnerCompany?: { id: string; name: string } | null;
  createdAt?: string;
}

export const LEAD_STATUSES = [
  "NEW", "CONTACTED", "PROPERTY_SHARED", "FOLLOW_UP", "INTERESTED",
  "NEGOTIATION", "SHARED_TO_PARTNER", "CONVERTED", "CLOSED_LOST", "INVALID",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

// Display/Kanban-column order — a lead moves left to right through its own pipeline;
// SHARED_TO_PARTNER is the one branch (handed off to a vendor partner instead of being
// serviced internally), placed right after PROPERTY_MATCHING where that decision is
// actually made, not after BANK_LOAN where it previously sat.
export const PIPELINE_STAGES = [
  "NEW_LEAD", "INITIAL_CONTACT", "REQUIREMENT_ANALYSIS", "PROPERTY_MATCHING", "SHARED_TO_PARTNER",
  "PROPERTY_SHARED", "FOLLOW_UP_PENDING", "SITE_VISIT_SCHEDULED", "SITE_VISIT_COMPLETED", "NEGOTIATION",
  "BANK_LOAN", "REGISTRATION", "LOST_CLOSED",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

// Stages that fire an automated WhatsApp message to the client the moment a lead is
// moved there (see backend pipelineAutomation.service.ts TEMPLATE_BY_STAGE) — surfaced
// in stage-change dropdowns so picking one isn't a silent send.
export const AUTO_MESSAGE_STAGES = new Set<PipelineStage>([
  "INITIAL_CONTACT", "FOLLOW_UP_PENDING", "SITE_VISIT_SCHEDULED", "SITE_VISIT_COMPLETED", "NEGOTIATION", "BANK_LOAN", "REGISTRATION",
]);

export const LEAD_SOURCES = ["VISA_FORM", "WEBSITE_FORM", "MANUAL", "REFERRAL", "WHATSAPP", "IMPORT", "PARTNER", "META_ADS"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const PROPERTY_TYPES = ["APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "STUDIO", "PLOT", "OFFICE", "RETAIL", "WAREHOUSE", "OTHER"] as const;
export const PROPERTY_CATEGORIES = ["SALE", "RENT", "LEASE", "COMMERCIAL", "RESIDENTIAL"] as const;
export const AVAILABILITY = ["AVAILABLE", "BOOKED", "SOLD", "RENTED", "INACTIVE"] as const;
export const FURNISHING = ["FURNISHED", "SEMI_FURNISHED", "UNFURNISHED"] as const;
export const PARTNER_SHARE_STATUSES = ["SHARED", "ACCEPTED", "IN_PROGRESS", "CLIENT_CONTACTED", "PROPERTY_SENT", "CONVERTED", "REJECTED", "CLOSED"] as const;

// Native-script label alongside the English name so staff can spot their language at a
// glance rather than reading only the English name — used by the AI console and the
// WhatsApp send language picker.
export const AI_LANGUAGES = [
  { value: "English", label: "English" },
  { value: "Tamil", label: "Tamil · தமிழ்" },
  { value: "Hindi", label: "Hindi · हिन्दी" },
  { value: "Telugu", label: "Telugu · తెలుగు" },
  { value: "Kannada", label: "Kannada · ಕನ್ನಡ" },
  { value: "Malayalam", label: "Malayalam · മലയാളം" },
] as const;

export interface Lead {
  id: string;
  fullName: string;
  mobile: string;
  whatsappNumber?: string | null;
  email?: string | null;
  country?: string | null;
  city?: string | null;
  preferredArea?: string | null;
  budgetMin?: string | number | null;
  budgetMax?: string | number | null;
  currency: string;
  propertyType?: string | null;
  bedrooms?: number | null;
  visaType?: string | null;
  visaRequired: boolean;
  source: string;
  status: LeadStatus;
  stage: PipelineStage;
  priority: string;
  requirementNotes?: string | null;
  assignedToId?: string | null;
  assignedTo?: { id: string; name: string } | null;
  partnerCompany?: { id: string; name: string } | null;
  followUpAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyImage {
  id: string;
  url: string;
  isPrimary: boolean;
}

export interface Property {
  id: string;
  title: string;
  type: string;
  category: string;
  location: string;
  address?: string | null;
  areaSqft?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  furnishing?: string | null;
  amenities: string[];
  price: string | number;
  currency: string;
  description?: string | null;
  videoUrl?: string | null;
  youtubeUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
  ownerName?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  images: PropertyImage[];
  assignedTo?: { id: string; name: string } | null;
  createdAt: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  body: string;
  isPublished: boolean;
  publishedAt?: string | null;
  author?: { name: string } | null;
  createdAt: string;
}

export interface PartnerCompany {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  city?: string | null;
  country?: string | null;
  status: "ACTIVE" | "INACTIVE";
  notes?: string | null;
  _count?: { shares: number; users: number };
}

export const VENDOR_STAGES = [
  "NEW", "REQUIREMENT_SENT", "PROPERTY_SHARED", "MORE_DETAILS_REQUESTED",
  "PROPERTY_VERIFIED", "SHORTLISTED", "SITE_VISIT_SCHEDULED", "NEGOTIATION",
  "DEAL_CLOSED", "DEAL_LOST",
] as const;
export type VendorStage = (typeof VENDOR_STAGES)[number];

// Stages that auto-send a WhatsApp template when a vendor is moved there (mirrors
// AUTO_MESSAGE_STAGES for leads) — kept in sync manually with TEMPLATE_BY_STAGE in
// vendorPipelineAutomation.service.ts.
export const VENDOR_AUTO_MESSAGE_STAGES = new Set<VendorStage>([
  "REQUIREMENT_SENT", "MORE_DETAILS_REQUESTED", "SHORTLISTED", "SITE_VISIT_SCHEDULED", "NEGOTIATION", "DEAL_CLOSED",
]);

export interface Vendor {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  city?: string | null;
  propertyTypes?: string | null;
  notes?: string | null;
  stage: VendorStage;
  siteVisitAt?: string | null;
  createdBy?: { name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function fmtMoney(value: string | number | null | undefined, currency = "INR") {
  if (value === null || value === undefined || value === "") return "—";
  // INR uses Indian lakh/crore grouping (1,75,00,000); other currencies keep western grouping
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return `${currency === "INR" ? "₹" : `${currency} `}${Number(value).toLocaleString(locale)}`;
}

export function fmtDate(value?: string | null, withTime = false) {
  if (!value) return "—";
  const d = new Date(value);
  return withTime
    ? d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function labelize(value?: string | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
