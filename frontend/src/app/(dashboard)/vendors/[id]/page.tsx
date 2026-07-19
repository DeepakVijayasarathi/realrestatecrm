"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, ErrorBanner, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { SendIcon } from "@/components/icons";
import { Vendor, VENDOR_AUTO_MESSAGE_STAGES, VENDOR_STAGES, VendorStage, fmtDate, labelize } from "@/lib/types";

interface VendorDetail extends Vendor {
  logs: {
    id: string; body: string; status: string; toNumber: string; createdAt: string;
    sentBy: { name: string }; template?: { name: string } | null;
  }[];
}

interface Template { id: string; key: string; name: string; body: string; isActive: boolean }

// Fields the REQUIREMENT_SENT template needs that nothing on the Vendor record holds —
// the specific client requirement varies every time, so it's asked for at send time.
const REQUIREMENT_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "location", label: "Location", placeholder: "e.g. Anna Nagar, Chennai" },
  { key: "property_type", label: "Property type", placeholder: "e.g. 3BHK Apartment" },
  { key: "budget", label: "Budget", placeholder: "e.g. ₹80 Lakhs" },
  { key: "size", label: "Size", placeholder: "e.g. 1500 sqft" },
];

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasRole } = useAuth();
  const canManage = hasRole("SALES_MANAGER", "SALES_EXECUTIVE", "PROPERTY_STAFF");
  const toast = useToast();
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);

  // Stage-change flow — a plain select fires most transitions immediately, but two
  // stages need extra info first (the client requirement, or the visit date/time), so
  // those open this modal instead of changing right away.
  const [pendingStage, setPendingStage] = useState<VendorStage | null>(null);
  const [requirementVars, setRequirementVars] = useState<Record<string, string>>({});
  const [siteVisitAt, setSiteVisitAt] = useState("");
  const [changingStage, setChangingStage] = useState(false);

  // Manual Send WhatsApp
  const [showSend, setShowSend] = useState(false);
  const [sendMode, setSendMode] = useState<"template" | "custom">("template");
  const [templateKey, setTemplateKey] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const load = () => {
    api.get<{ data: VendorDetail }>(`/vendors/${id}`).then((r) => setVendor(r.data)).catch((e) => setError(e.message));
  };

  useEffect(load, [id]);
  useEffect(() => {
    api.get<{ data: Template[] }>("/whatsapp/templates?audience=VENDOR").then((r) => setTemplates(r.data.filter((t) => t.isActive))).catch(() => {});
  }, []);

  function requestStageChange(stage: VendorStage) {
    if (stage === "REQUIREMENT_SENT" || stage === "SITE_VISIT_SCHEDULED") {
      setPendingStage(stage);
      setRequirementVars({});
      setSiteVisitAt("");
    } else {
      changeStage(stage);
    }
  }

  async function changeStage(stage: VendorStage, extra?: { templateVars?: Record<string, string>; siteVisitAt?: string }) {
    setChangingStage(true);
    setError(null);
    try {
      await api.post(`/vendors/${id}/change-stage`, { stage, ...extra });
      toast(`Stage updated to ${labelize(stage)}${VENDOR_AUTO_MESSAGE_STAGES.has(stage) ? " — WhatsApp sent" : ""}`);
      setPendingStage(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stage update failed");
    } finally {
      setChangingStage(false);
    }
  }

  async function sendWhatsApp() {
    setSending(true);
    setSendError(null);
    try {
      await api.post(`/vendors/${id}/send-whatsapp`, {
        templateKey: sendMode === "template" ? (templateKey || undefined) : undefined,
        customMessage: sendMode === "custom" ? customMessage.trim() || undefined : undefined,
      });
      toast("WhatsApp message sent");
      setShowSend(false);
      setCustomMessage("");
      load();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  if (error && !vendor) return <p className="text-sm text-red-600">{error}</p>;
  if (!vendor) return <Spinner />;

  return (
    <div className="space-y-4">
      <Link href="/vendors" className="inline-block text-sm text-slate-500 hover:text-brand-600 hover:underline">← Back to vendors</Link>
      <ErrorBanner message={error} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{vendor.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge value={vendor.stage} />
            {vendor.siteVisitAt && <span className="text-xs text-amber-600">Site visit {fmtDate(vendor.siteVisitAt, true)}</span>}
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Select
              className="w-auto"
              title="Stages marked ✉ send an automated WhatsApp to the vendor"
              value={vendor.stage}
              onChange={(e) => requestStageChange(e.target.value as VendorStage)}
              disabled={changingStage}
            >
              {VENDOR_STAGES.map((s) => (
                <option key={s} value={s}>
                  {labelize(s)}{VENDOR_AUTO_MESSAGE_STAGES.has(s) ? " ✉" : ""}
                </option>
              ))}
            </Select>
            <Button onClick={() => setShowSend(true)}>
              <SendIcon className="mr-1.5 inline h-3.5 w-3.5" />Send WhatsApp
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Vendor details</h3>
          <dl className="space-y-2 text-sm">
            {([
              ["Contact person", vendor.contactPerson || "—"],
              ["Phone", vendor.phone || "—"],
              ["WhatsApp", vendor.whatsapp || vendor.phone || "—"],
              ["Email", vendor.email || "—"],
              ["City", vendor.city || "—"],
              ["Supplies", vendor.propertyTypes || "—"],
              ["Added by", vendor.createdBy?.name ?? "—"],
              ["Added", fmtDate(vendor.createdAt, true)],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right font-medium text-slate-700">{v}</dd>
              </div>
            ))}
          </dl>
          {vendor.notes && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{vendor.notes}</p>}
        </Card>

        <Card className="lg:col-span-2">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold">WhatsApp history ({vendor.logs.length})</h3>
          </div>
          <div className="max-h-96 space-y-3 overflow-y-auto p-4">
            {vendor.logs.map((l) => (
              <div key={l.id} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    To {l.toNumber} · by {l.sentBy.name} · {fmtDate(l.createdAt, true)}
                    {l.template && ` · template: ${l.template.name}`}
                  </span>
                  <Badge value={l.status} />
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{l.body}</p>
              </div>
            ))}
            {vendor.logs.length === 0 && <p className="text-sm text-slate-400">No WhatsApp messages yet.</p>}
          </div>
        </Card>
      </div>

      {/* Stage-change modal — only used for the two transitions that need extra input */}
      <Modal
        open={!!pendingStage}
        onClose={() => setPendingStage(null)}
        title={pendingStage === "REQUIREMENT_SENT" ? "Send property requirement" : "Schedule site visit"}
      >
        <div className="space-y-4">
          {pendingStage === "REQUIREMENT_SENT" && REQUIREMENT_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <Input
                placeholder={f.placeholder}
                value={requirementVars[f.key] ?? ""}
                onChange={(e) => setRequirementVars((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </Field>
          ))}
          {pendingStage === "SITE_VISIT_SCHEDULED" && (
            <Field label="Visit date & time *">
              <Input type="datetime-local" value={siteVisitAt} onChange={(e) => setSiteVisitAt(e.target.value)} />
            </Field>
          )}
          <p className="text-xs text-slate-500">This sends the matching WhatsApp template to the vendor immediately.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPendingStage(null)}>Cancel</Button>
            <Button
              disabled={changingStage || (pendingStage === "SITE_VISIT_SCHEDULED" && !siteVisitAt)}
              onClick={() => pendingStage && changeStage(pendingStage, { templateVars: requirementVars, siteVisitAt: siteVisitAt || undefined })}
            >
              {changingStage ? "Sending…" : "Confirm & send"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Manual Send WhatsApp modal */}
      <Modal open={showSend} onClose={() => setShowSend(false)} title="Send WhatsApp">
        <div className="space-y-4">
          <p className="text-xs text-slate-500">To <span className="font-medium text-slate-700">{vendor.whatsapp || vendor.phone}</span></p>
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-sm">
            <button
              type="button"
              className={`flex-1 rounded-md py-1.5 font-medium transition ${sendMode === "template" ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-700"}`}
              onClick={() => setSendMode("template")}
            >
              Use a template
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md py-1.5 font-medium transition ${sendMode === "custom" ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-700"}`}
              onClick={() => setSendMode("custom")}
            >
              Write custom message
            </button>
          </div>
          {sendMode === "template" ? (
            <Field label="Template">
              <Select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
                <option value="">Select a template…</option>
                {templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
              </Select>
            </Field>
          ) : (
            <Field label="Message">
              <Textarea rows={4} placeholder="Type your message…" value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} />
            </Field>
          )}
          <ErrorBanner message={sendError} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowSend(false)}>Cancel</Button>
            <Button onClick={sendWhatsApp} disabled={sending || (sendMode === "template" ? !templateKey : !customMessage.trim())}>
              {sending ? "Sending…" : <><SendIcon className="mr-1.5 inline h-3.5 w-3.5" />Send</>}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
