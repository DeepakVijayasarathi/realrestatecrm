"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, qs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Input, Modal, PageHeader, Pagination, Select, Spinner } from "@/components/ui";
import { BriefcaseIcon } from "@/components/icons";
import { Paginated, Vendor, VENDOR_STAGES, fmtDate, labelize } from "@/lib/types";

const emptyForm = { name: "", contactPerson: "", phone: "", whatsapp: "", email: "", city: "", propertyTypes: "", notes: "" };

export default function VendorsPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole("SALES_MANAGER", "SALES_EXECUTIVE", "PROPERTY_STAFF");
  const toast = useToast();
  const [result, setResult] = useState<Paginated<Vendor> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Paginated<Vendor>>(`/vendors${qs({ q, stage, page, pageSize: 20 })}`)
      .then((res) => { setResult(res); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load vendors"))
      .finally(() => setLoading(false));
  }, [q, stage, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/vendors", form);
      setShowForm(false);
      setForm({ ...emptyForm });
      toast(`Added vendor "${form.name}"`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={BriefcaseIcon}
        title="Vendor Network"
        subtitle="Property-sourcing pipeline — suppliers and owners you're buying/renting inventory from"
        actions={canManage && <Button onClick={() => setShowForm(true)}>+ Add vendor</Button>}
      />
      <ErrorBanner message={error} />

      <Card className="p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
          <Input placeholder="Search name / phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="col-span-2" />
          <Select value={stage} onChange={(e) => { setStage(e.target.value); setPage(1); }}>
            <option value="">All stages</option>
            {VENDOR_STAGES.map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
          </Select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <Spinner />
        ) : !result || result.data.length === 0 ? (
          <EmptyState message="No vendors match your filters." />
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {result.data.map((v) => (
                <Link key={v.id} href={`/vendors/${v.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800">{v.name}</div>
                    <div className="text-xs text-slate-500">
                      {v.contactPerson ?? "—"} · {v.whatsapp || v.phone || "No phone"}
                      {v.city && ` · ${v.city}`}
                      {v.propertyTypes && ` · ${v.propertyTypes}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <Badge value={v.stage} />
                    <span>Added {fmtDate(v.createdAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
            <Pagination page={result.page} pageSize={result.pageSize} total={result.total} onPage={setPage} />
          </>
        )}
      </Card>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add vendor">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name *">
              <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Contact person">
              <Input value={form.contactPerson} onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))} />
            </Field>
            <Field label="Phone">
              <Input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </Field>
            <Field label="WhatsApp">
              <Input type="tel" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="City">
              <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </Field>
            <Field label="Property types supplied">
              <Input placeholder="e.g. Plots, Villas" value={form.propertyTypes} onChange={(e) => setForm((f) => ({ ...f, propertyTypes: e.target.value }))} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
