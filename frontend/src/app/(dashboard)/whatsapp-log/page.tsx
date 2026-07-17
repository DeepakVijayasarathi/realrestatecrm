"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, EmptyState, ErrorBanner, PageHeader, Pagination, Spinner } from "@/components/ui";
import { DownloadIcon, MessageCircleIcon } from "@/components/icons";
import { fmtDate } from "@/lib/types";

interface WhatsAppLogEntry {
  id: string;
  toNumber: string;
  body: string;
  status: string;
  error?: string | null;
  providerMessageId?: string | null;
  createdAt: string;
  lead: { id: string; fullName: string };
  sentBy: { name: string };
  template?: { name: string } | null;
}

export default function WhatsAppLogPage() {
  const { hasRole } = useAuth();
  const [result, setResult] = useState<{ data: WhatsAppLogEntry[]; total: number; page: number; pageSize: number } | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{ data: WhatsAppLogEntry[]; total: number; page: number; pageSize: number }>(`/whatsapp/logs?page=${page}&pageSize=25`)
      .then((res) => { setResult(res); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load WhatsApp log"))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(load, [load]);

  async function exportCsv() {
    try {
      await downloadFile("/whatsapp/logs/export", `whatsapp-log-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={MessageCircleIcon}
        title="WhatsApp Log"
        subtitle="Every message sent from the CRM — property shares, automated stage messages, and partner referrals. Managers see everyone's sends; staff see their own."
        actions={hasRole() && (
          <Button variant="secondary" onClick={exportCsv}><DownloadIcon className="mr-1.5 inline h-3.5 w-3.5" />Export CSV</Button>
        )}
      />
      <ErrorBanner message={error} />

      <Card>
        {loading ? (
          <Spinner />
        ) : !result || result.data.length === 0 ? (
          <EmptyState message="No WhatsApp messages sent yet." />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">Sent by</th>
                    <th className="px-4 py-3">Template</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDate(log.createdAt, true)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/leads/${log.lead.id}`} className="font-medium text-brand-700 hover:underline">{log.lead.fullName}</Link>
                        <div className="text-xs text-slate-400">{log.toNumber}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{log.sentBy.name}</td>
                      <td className="px-4 py-3 text-slate-600">{log.template?.name ?? "—"}</td>
                      <td className="max-w-sm px-4 py-3 text-xs text-slate-500">
                        <p className="line-clamp-2 whitespace-pre-wrap">{log.body}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge value={log.status} />
                        {log.error && <div className="mt-1 max-w-[180px] text-xs text-red-600">{log.error}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list — the wide table above is unusable below md. */}
            <div className="divide-y divide-slate-100 md:hidden">
              {result.data.map((log) => (
                <div key={log.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/leads/${log.lead.id}`} className="font-medium text-brand-700 hover:underline">{log.lead.fullName}</Link>
                      <div className="text-xs text-slate-400">{log.toNumber}</div>
                    </div>
                    <Badge value={log.status} />
                  </div>
                  <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-xs text-slate-500">{log.body}</p>
                  {log.error && <p className="mt-1 text-xs text-red-600">{log.error}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{fmtDate(log.createdAt, true)}</span>
                    <span>{log.sentBy.name}</span>
                    {log.template && <span>{log.template.name}</span>}
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={result.page} pageSize={result.pageSize} total={result.total} onPage={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
