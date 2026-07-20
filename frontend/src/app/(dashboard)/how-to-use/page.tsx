"use client";

import { useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import {
  BotIcon, BriefcaseIcon, BuildingIcon, HelpCircleIcon, KanbanIcon,
  MessageCircleIcon, SettingsIcon, TrendingUpIcon, UsersIcon,
} from "@/components/icons";

interface Section {
  icon: typeof HelpCircleIcon;
  title: string;
  steps: string[];
}

const SECTIONS: Section[] = [
  {
    icon: UsersIcon,
    title: "Leads (CRM Pipeline)",
    steps: [
      "Click \"+ New lead\" on the CRM Pipeline page, or import many at once with \"Import CSV\" (download \"Sample CSV\" first to see the exact column format).",
      "Every lead moves through stages left to right: New → Initial Contact → … → Registration (won) or Lost/Closed. Change a lead's stage from the dropdown on its detail page, or drag its card on the Pipeline Board.",
      "Stages marked ✉ in the dropdown automatically send the client a WhatsApp message when you move a lead there — you don't need to send anything manually for those.",
      "\"Site Visit Scheduled\" and the \"Schedule visit\" button both ask you to pick the actual date/time first, so the automated confirmation message says the right time.",
      "Use \"Find matches\" to see properties in your inventory that fit the lead's requirements, tick the ones you want, then either \"Save shortlist\" or \"Send N via WhatsApp\".",
      "Set a follow-up reminder date on the left side of the lead page — you'll get a notification when it's due.",
    ],
  },
  {
    icon: MessageCircleIcon,
    title: "WhatsApp — sending & replies",
    steps: [
      "Click \"Send WhatsApp\" on a lead's page to open the send box — pick a template or write your own message, choose the reply language, then Send.",
      "The \"WhatsApp\" tab on a lead's page shows the full conversation, chat-style — your messages on the right, the client's replies on the left, with sent/delivered/read ticks.",
      "You can type directly into the box at the bottom of that conversation to reply immediately, without opening the separate Send box.",
      "The \"WhatsApp Log\" page (left sidebar) shows every message sent across all leads, with filters and a CSV export for managers.",
      "The instant a lead replies, an automatic acknowledgement goes out (\"Thanks for reaching out, our team will get back to you shortly\") and the assigned exec plus every Super Admin get notified. Edit that message under Settings → Templates → Client templates, key lead_auto_reply.",
      "Client replies currently only appear if your WhatsApp provider (AiSensy/SmartPing) has webhooks enabled on your account — ask your admin if you're not seeing replies show up.",
    ],
  },
  {
    icon: BuildingIcon,
    title: "Properties",
    steps: [
      "Click \"+ Add property\" to list a new one, or \"Import CSV\" for bulk uploads.",
      "Change a property's availability (Available/Booked/Sold/Rented) right from the dropdown on its card in the list — no need to open Edit for just that.",
      "Open a property and click \"Share via WhatsApp\" to send it to any lead directly, without going to that lead's own page first.",
      "Upload multiple photos and a video/YouTube link on the property's Edit page — the first photo becomes the cover image shown everywhere.",
    ],
  },
  {
    icon: BriefcaseIcon,
    title: "Partner Network",
    steps: [
      "Use \"Share to partner\" on a lead's page when you want to hand it to an external referral company instead of servicing it yourself — this properly records who it was shared with (don't use the stage dropdown for this).",
      "Partner-company staff logging in themselves only see leads shared with their own company, and can update the referral status (Accepted/In Progress/Converted/etc.) as it moves along.",
      "The WhatsApp message sent to the partner when you check \"Send WhatsApp\" is editable — set it up under Settings → Templates → Partner templates, with the key partner_referral. Until one is created there, a built-in default message is used.",
    ],
  },
  {
    icon: BotIcon,
    title: "AI Operating Agent",
    steps: [
      "Pick a quick action (Sales Pitch, Investment Proposal, Price Predictor, Sale Agreement Draft) and fill in the property/client, or just type a free-form question at the bottom.",
      "Every response has a Copy button, and sales-pitch results tied to a specific client have a one-click \"Send to {name}\" button that sends it straight to that lead on WhatsApp.",
      "Choose a reply language from the dropdown at the top if you want the response in Tamil/Hindi/Telugu/Kannada/Malayalam instead of English.",
      "The \"Usage & Cost\" tab (managers only) shows how much AI usage is costing, broken down by feature and staff member.",
    ],
  },
  {
    icon: KanbanIcon,
    title: "Pipeline Board & Reports",
    steps: [
      "The Pipeline Board is a drag-and-drop view of every lead's stage — useful for a quick visual overview instead of the list view.",
      "Reports (managers only) covers lead sources, staff/partner performance, monthly trends, which properties get the most interest, and repeat-inquirer behavior.",
    ],
  },
  {
    icon: SettingsIcon,
    title: "Settings (managers/admins only)",
    steps: [
      "\"Templates & Currencies\" is where WhatsApp message templates live — client and partner templates are grouped separately since each uses a different set of placeholders.",
      "\"Branding\" lets you change the app name, tagline, logo, and accent color shown throughout the app and on public pages.",
      "\"Integrations\" (Super Admin only) holds the actual WhatsApp/AI/Meta API credentials — secrets are masked on screen for safety.",
    ],
  },
  {
    icon: TrendingUpIcon,
    title: "Tips",
    steps: [
      "Badges with a title like \"Delivery: SENT\" or \"Referral: ACCEPTED\" tell you what that status is actually about — hover if you're ever unsure which of several statuses on a page you're looking at.",
      "On mobile, list pages switch from tables to a stacked card view automatically — everything you can do on desktop is still there, just laid out differently.",
      "If something you expect to be automatic doesn't happen (like an automated WhatsApp on a stage change), check that a WhatsApp template actually exists for that stage in Settings — it can't send a message that doesn't have one.",
    ],
  },
];

export default function HowToUsePage() {
  const [open, setOpen] = useState<string | null>(SECTIONS[0].title);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={HelpCircleIcon}
        title="How to Use"
        subtitle="A quick walkthrough of every part of the CRM"
      />
      <div className="space-y-3">
        {SECTIONS.map((section) => {
          const isOpen = open === section.title;
          return (
            <Card key={section.title} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : section.title)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 ring-1 ring-inset ring-brand-100">
                  <section.icon className="h-4.5 w-4.5 text-brand-600" />
                </div>
                <span className="flex-1 text-sm font-semibold text-slate-800">{section.title}</span>
                <span className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
              </button>
              {isOpen && (
                <ol className="space-y-2.5 border-t border-slate-100 px-4 py-4 pl-[3.75rem]">
                  {section.steps.map((step, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-slate-600">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
