import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { forbidden } from "../../lib/errors";

const router = Router();
router.use(requireAuth);

// Templates — read for internal staff, write for admins/managers. Partners have no
// legitimate reason to see internal message templates (same rationale used for vendor
// data in partners.routes.ts) — this was previously open to any authenticated user.
router.get("/templates", async (req, res, next) => {
  try {
    if (req.user!.role === Role.PARTNER_USER) throw forbidden();
    const templates = await prisma.whatsAppTemplate.findMany({ orderBy: { name: "asc" } });
    res.json({ data: templates });
  } catch (err) {
    next(err);
  }
});

const templateSchema = z.object({
  key: z.string().min(2).regex(/^[a-z0-9_-]+$/, "Use lowercase letters, numbers, - and _"),
  name: z.string().min(2),
  body: z.string().min(5),
  isActive: z.boolean().default(true),
});

router.post("/templates", requireRole(Role.SALES_MANAGER), validate(templateSchema), async (req, res, next) => {
  try {
    const template = await prisma.whatsAppTemplate.create({ data: req.body });
    res.status(201).json({ data: template });
  } catch (err) {
    next(err);
  }
});

router.put("/templates/:id", requireRole(Role.SALES_MANAGER), validate(templateSchema.partial()), async (req, res, next) => {
  try {
    const template = await prisma.whatsAppTemplate.update({ where: { id: req.params.id }, data: req.body });
    res.json({ data: template });
  } catch (err) {
    next(err);
  }
});

// Message log review (managers see all, staff see their own)
router.get("/logs", async (req, res, next) => {
  try {
    const { leadId, page = "1", pageSize = "25" } = req.query as Record<string, string>;
    const isManager = req.user!.role === Role.SUPER_ADMIN || req.user!.role === Role.SALES_MANAGER;
    const where = {
      ...(leadId ? { leadId } : {}),
      ...(isManager ? {} : { sentById: req.user!.id }),
    };
    const take = Math.min(Number(pageSize) || 25, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    const [total, data] = await Promise.all([
      prisma.whatsAppLog.count({ where }),
      prisma.whatsAppLog.findMany({
        where,
        include: {
          lead: { select: { id: true, fullName: true } },
          sentBy: { select: { name: true } },
          template: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);
    res.json({ data, total, page: Number(page), pageSize: take });
  } catch (err) {
    next(err);
  }
});

export default router;
