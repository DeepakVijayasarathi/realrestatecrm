"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, EmptyState, ErrorBanner, PageHeader, Spinner } from "@/components/ui";
import { FileTextIcon } from "@/components/icons";
import { fmtDate } from "@/lib/types";

interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
  user?: { name: string; email: string } | null;
}

export default function AuditLogPage() {
  const { hasRole } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasRole()) return;
    api.get<{ data: AuditLogEntry[] }>("/users/audit-logs").then((r) => setLogs(r.data)).catch((e) => setError(e.message));
  }, [hasRole]);

  if (!hasRole()) return <p className="text-sm text-slate-500">Only the super admin can view the audit log.</p>;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FileTextIcon}
        title="Audit Log"
        subtitle="Who did what — logins, exports, deletions, and settings changes. Most recent 200 events."
      />
      <ErrorBanner message={error} />

      <Card>
        {!logs ? (
          <Spinner />
        ) : logs.length === 0 ? (
          <EmptyState message="No audit events recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Who</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDate(log.createdAt, true)}</td>
                    <td className="px-4 py-3 text-slate-700">{log.user?.name ?? "System"}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{log.action.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.entity}
                      {log.entityId && <span className="text-xs text-slate-400"> · {log.entityId}</span>}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-400">
                      {log.meta ? JSON.stringify(log.meta) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
