"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/shell";
import { Card, CardContent, CardHeader, Subhead, Badge, Button } from "../components/ui";

type HistoryItem = {
  import_id: string;
  created_at: string;
  tenant_id: string;
  tenant_name?: string;
  row_count: number;
};

type HistoryItemDetail = HistoryItem & {
  payload_json: Record<string, unknown>[];
  results_json: Record<string, unknown>[];
};

type HistoryResponse = {
  tenant_id: string;
  tenant_name: string;
  items: HistoryItem[];
};

function formatDate(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(dt);
}

export default function HistoryPage() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE || "/api", []);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [tenantName, setTenantName] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedDetails, setSelectedDetails] = useState<Record<string, HistoryItemDetail>>({});
  const [loadingDetailsId, setLoadingDetailsId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [downloadingId, setDownloadingId] = useState("");

  async function loadHistory() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/imports/history?limit=200`, {
        method: "GET",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as Partial<HistoryResponse> & { detail?: string };
      if (!res.ok) {
        throw new Error(data.detail || "Failed to load history.");
      }
      const loadedItems = Array.isArray(data.items) ? data.items : [];
      setItems(loadedItems);
      setTenantName(data.tenant_name || "");
      setTenantId(data.tenant_id || "");
      if (loadedItems.length > 0) {
        setSelectedId((prev) => prev || loadedItems[0].import_id);
      } else {
        setSelectedId("");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function downloadCsv(importId: string) {
    setDownloadingId(importId);
    try {
      const res = await fetch(`${apiBase}/imports/history/${encodeURIComponent(importId)}/csv`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.detail || "Download failed.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `import_${importId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || "Download failed.");
    } finally {
      setDownloadingId("");
    }
  }

  async function loadDetail(importId: string) {
    if (!importId || selectedDetails[importId]) return;
    setLoadingDetailsId(importId);
    setError("");
    try {
      const res = await fetch(`${apiBase}/imports/history/${encodeURIComponent(importId)}`, {
        method: "GET",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as Partial<HistoryItemDetail> & {
        detail?: string;
      };
      if (!res.ok) {
        throw new Error(data.detail || "Failed to load history item.");
      }
      if (!data.import_id) {
        throw new Error("History item response is invalid.");
      }
      setSelectedDetails((prev) => ({
        ...prev,
        [importId]: {
          import_id: data.import_id,
          created_at: String(data.created_at || ""),
          tenant_id: String(data.tenant_id || ""),
          tenant_name: String(data.tenant_name || ""),
          row_count: Number(data.row_count || 0),
          payload_json: Array.isArray(data.payload_json) ? data.payload_json : [],
          results_json: Array.isArray(data.results_json) ? data.results_json : [],
        },
      }));
    } catch (e: any) {
      setError(e?.message || "Failed to load history item.");
    } finally {
      setLoadingDetailsId("");
    }
  }

  async function deleteItem(importId: string) {
    const confirmed = window.confirm(`Delete import ${importId}? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(importId);
    setError("");
    try {
      const res = await fetch(`${apiBase}/imports/history/${encodeURIComponent(importId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || "Delete failed.");
      }
      setItems((prev) => {
        const nextItems = prev.filter((x) => x.import_id !== importId);
        if (selectedId === importId) {
          setSelectedId(nextItems[0]?.import_id || "");
        }
        return nextItems;
      });
      setSelectedDetails((prev) => {
        const next = { ...prev };
        delete next[importId];
        return next;
      });
    } catch (e: any) {
      setError(e?.message || "Delete failed.");
    } finally {
      setDeletingId("");
    }
  }

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selected = selectedId ? selectedDetails[selectedId] : undefined;
  const statusSummary = useMemo(() => {
    if (!selected) return { ok: 0, err: 0, dry: 0 };
    let ok = 0;
    let err = 0;
    let dry = 0;
    for (const row of selected.results_json) {
      const status = String(row?.status || "").toUpperCase();
      if (status === "OK") ok += 1;
      else if (status === "ERROR") err += 1;
      else if (status === "DRY_RUN") dry += 1;
    }
    return { ok, err, dry };
  }, [selected]);

  return (
    <AppShell active="Historie">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Import History</h2>
                <Subhead>
                  Persisted import runs for the connected tenant
                  {tenantName ? `: ${tenantName}` : ""}.
                </Subhead>
              </div>
              <div className="flex gap-2">
                <Badge variant="blue">{items.length} Imports</Badge>
                <Button variant="outline" onClick={loadHistory} disabled={loading}>
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {error ? (
              <div className="rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-sm text-pink-700">
                {error}
              </div>
            ) : null}

            <div className="rounded-xl border border-[color:var(--bp-border)]">
              {loading ? (
                <div className="px-4 py-6 text-sm text-slate-500">Loading history...</div>
              ) : null}

              {!loading && !items.length ? (
                <div className="px-4 py-6 text-sm text-slate-500">
                  No history items found for this tenant yet.
                </div>
              ) : null}

              {!loading &&
                items.map((x) => (
                <div
                  key={x.import_id}
                  className={`grid grid-cols-1 gap-3 border-b border-[color:var(--bp-border)] p-4 md:grid-cols-12 md:items-center ${
                    selectedId === x.import_id ? "bg-sky-50/40" : "bg-white"
                  }`}
                >
                  <div className="md:col-span-4">
                    <div className="text-sm text-slate-700">{formatDate(x.created_at)}</div>
                    <div className="text-xs text-slate-500">{x.row_count} rows</div>
                  </div>
                  <div className="md:col-span-5 text-sm font-mono text-slate-700 break-all">{x.import_id}</div>
                  <div className="md:col-span-3 flex flex-wrap gap-2 md:justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedId(x.import_id)}
                      disabled={deletingId === x.import_id}
                    >
                      Details
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => downloadCsv(x.import_id)}
                      disabled={downloadingId === x.import_id || deletingId === x.import_id}
                    >
                      {downloadingId === x.import_id ? "Downloading..." : "Download CSV"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => deleteItem(x.import_id)}
                      disabled={deletingId === x.import_id || downloadingId === x.import_id}
                    >
                      {deletingId === x.import_id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader>
            <h3 className="text-lg font-semibold">Selected Import</h3>
            <Subhead>Inspect stored payload and posting results for one history item.</Subhead>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedId ? (
              <div className="rounded-xl border border-[color:var(--bp-border)] bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Pick an import from the left to inspect it.
              </div>
            ) : null}

            {selectedId && loadingDetailsId === selectedId ? (
              <div className="rounded-xl border border-[color:var(--bp-border)] bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Loading details...
              </div>
            ) : null}

            {selected ? (
              <>
                <div className="rounded-xl border border-[color:var(--bp-border)] bg-white p-4">
                  <div className="text-xs text-slate-500">Import ID</div>
                  <div className="mt-1 break-all font-mono text-sm">{selected.import_id}</div>
                  <div className="mt-3 text-xs text-slate-500">Created</div>
                  <div className="mt-1 text-sm">{formatDate(selected.created_at)}</div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-slate-500">Tenant</div>
                      <div className="text-sm">{selected.tenant_name || tenantName || "-"}</div>
                      <div className="text-xs font-mono text-slate-500">{tenantId || selected.tenant_id}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Rows</div>
                      <div className="text-sm">{selected.row_count}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[color:var(--bp-border)] bg-white p-4">
                  <div className="mb-3 text-sm font-semibold">Result Summary</div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="blue">OK {statusSummary.ok}</Badge>
                    <Badge variant="pink">Errors {statusSummary.err}</Badge>
                    <Badge>Dry-run {statusSummary.dry}</Badge>
                    <Badge>Stored Rows {selected.payload_json.length}</Badge>
                  </div>
                </div>

                <div className="rounded-xl border border-[color:var(--bp-border)] bg-white p-4">
                  <div className="mb-2 text-sm font-semibold">Stored Data Preview</div>
                  <div className="text-xs text-slate-500">First payload rows and result rows are shown below.</div>
                  <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                    {JSON.stringify(
                      {
                        payload_preview: selected.payload_json.slice(0, 3),
                        results_preview: selected.results_json.slice(0, 5),
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
