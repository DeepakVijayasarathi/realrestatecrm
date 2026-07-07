import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { askOpenAI } from "../../services/openai.service";

const router = Router();
router.use(requireAuth);
// AI tooling exposes internal client/pricing context — keep it staff-only
router.use((req, _res, next) => (req.user!.role === Role.PARTNER_USER ? next(forbidden()) : next()));

const money = (v: unknown, currency: string) => `${currency} ${Number(v).toLocaleString("en-IN")}`;

async function getProperty(id: string) {
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) throw notFound("Property");
  return property;
}

async function getLead(id: string) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw notFound("Lead");
  return lead;
}

function propertyBlock(p: Awaited<ReturnType<typeof getProperty>>) {
  return [
    `Title: ${p.title}`,
    `Type: ${p.type} (${p.category})`,
    `Location: ${p.location}${p.address ? `, ${p.address}` : ""}`,
    `Area: ${p.areaSqft ? `${p.areaSqft} sqft` : "n/a"}, Bedrooms: ${p.bedrooms ?? "n/a"}, Bathrooms: ${p.bathrooms ?? "n/a"}`,
    `Furnishing: ${p.furnishing ?? "n/a"}`,
    `Price: ${money(p.price, p.currency)}`,
    `Amenities: ${p.amenities.join(", ") || "none listed"}`,
    p.description ? `Description: ${p.description}` : null,
  ].filter(Boolean).join("\n");
}

function leadBlock(l: Awaited<ReturnType<typeof getLead>>) {
  return [
    `Name: ${l.fullName}`,
    `Looking for: ${l.propertyType ?? "any type"}${l.bedrooms != null ? `, ${l.bedrooms} BR` : ""}`,
    `Preferred area: ${l.preferredArea || l.city || "not specified"}`,
    l.budgetMin || l.budgetMax
      ? `Budget: ${[l.budgetMin, l.budgetMax].filter(Boolean).map((v) => money(v, l.currency)).join(" – ")}`
      : null,
    l.requirementNotes ? `Notes: ${l.requirementNotes}` : null,
  ].filter(Boolean).join("\n");
}

const SYSTEM_PROMPT =
  "You are an AI assistant embedded in RealRest, a real estate CRM used by sales staff in Tamil Nadu, India. " +
  "Write in clear, professional English. Prices are in Indian Rupees (INR) using lakh/crore-friendly phrasing where natural. " +
  "Never invent property or client facts beyond what is given in the context — if information is missing, note that plainly.";

router.post(
  "/sales-pitch",
  validate(z.object({ propertyId: z.string().min(1), leadId: z.string().optional() })),
  async (req, res, next) => {
    try {
      const property = await getProperty(req.body.propertyId);
      const lead = req.body.leadId ? await getLead(req.body.leadId) : null;
      const prompt = [
        "Write a short, persuasive WhatsApp-ready sales pitch (120-180 words) for this property.",
        propertyBlock(property),
        lead ? `\nTailor it for this specific client:\n${leadBlock(lead)}` : "\nNo specific client — write a general pitch.",
      ].join("\n\n");
      const text = await askOpenAI([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ]);
      res.json({ data: { text } });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/investment-proposal",
  validate(z.object({ propertyId: z.string().min(1) })),
  async (req, res, next) => {
    try {
      const property = await getProperty(req.body.propertyId);
      const prompt = [
        "Write a one-page investment proposal for this property aimed at a prospective investor.",
        "Cover: opportunity summary, location highlights, expected rental/appreciation angle (state assumptions clearly since no market data is provided), and a call to action.",
        "Use short headed sections, not a wall of text.",
        propertyBlock(property),
      ].join("\n\n");
      const text = await askOpenAI([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ]);
      res.json({ data: { text } });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/price-predictor",
  validate(
    z.object({
      location: z.string().min(1),
      propertyType: z.string().min(1),
      bedrooms: z.coerce.number().optional(),
      areaSqft: z.coerce.number().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const { location, propertyType, bedrooms, areaSqft } = req.body;
      // Ground the estimate in real comparable listings from inventory instead of a blind guess
      const comparables = await prisma.property.findMany({
        where: {
          location: { contains: location, mode: "insensitive" },
          ...(propertyType ? { type: propertyType } : {}),
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      });
      const compBlock = comparables.length
        ? comparables.map((p) => `- ${p.title}: ${money(p.price, p.currency)}${p.areaSqft ? ` (${p.areaSqft} sqft)` : ""}`).join("\n")
        : "No comparable listings found in inventory for this location/type.";
      const prompt = [
        `Estimate a fair market price range (in INR) for a ${propertyType} in ${location}` +
          `${bedrooms ? `, ${bedrooms} BR` : ""}${areaSqft ? `, ~${areaSqft} sqft` : ""}.`,
        "Base your estimate primarily on these comparable listings from our inventory:",
        compBlock,
        "State the estimated range clearly, list the assumptions/adjustments you made, and flag if the comparable data is too thin to be confident.",
      ].join("\n\n");
      const text = await askOpenAI([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ]);
      res.json({ data: { text, comparablesUsed: comparables.length } });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/agreement-draft",
  validate(z.object({ propertyId: z.string().min(1), leadId: z.string().min(1) })),
  async (req, res, next) => {
    try {
      const property = await getProperty(req.body.propertyId);
      const lead = await getLead(req.body.leadId);
      const prompt = [
        "Draft a preliminary Agreement to Sell / Booking Agreement for an Indian real estate transaction, using the details below.",
        "Include standard sections: parties, property schedule, agreed price, token/advance amount (leave blank if not given), payment schedule (leave placeholders), possession, and a note that this draft must be reviewed by a lawyer before signing.",
        "Mark every placeholder clearly with [brackets] where information is not supplied.",
        `\nProperty:\n${propertyBlock(property)}`,
        `\nBuyer (client):\n${leadBlock(lead)}\nMobile: ${lead.mobile}`,
      ].join("\n\n");
      const text = await askOpenAI([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ]);
      res.json({ data: { text } });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/ask",
  validate(z.object({ query: z.string().min(1).max(2000) })),
  async (req, res, next) => {
    try {
      if (!req.body.query.trim()) throw badRequest("Query is required");
      const text = await askOpenAI([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: req.body.query },
      ]);
      res.json({ data: { text } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
