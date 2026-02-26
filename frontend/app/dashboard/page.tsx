"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/shell";
import { Card, CardContent, CardHeader, Subhead, Button, Badge } from "../components/ui";
import { Users, FileText, ListChecks, Settings } from "lucide-react";

type SessionResponse = {
  connected?: boolean;
  client_name?: string;
  tenant_id?: string;
};

type HistoryItem = {
  import_id: string;
  created_at: string;
  row_count: number;
};

type HistoryResponse = {
  items?: HistoryItem[];
};

function formatDate(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(dt);
}

export default function DashboardPage() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE || "/api", []);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [clientName, setClientName] = useState("");
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const sessionRes = await fetch(`${apiBase}/bexio/session`, {
          method: "GET",
          credentials: "include",
        });
        const sessionData = (await sessionRes.json().catch(() => ({}))) as SessionResponse;

        if (cancelled) return;

        const isConnected = !!sessionData.connected;
        setConnected(isConnected);
        setClientName(String(sessionData.client_name || ""));

        if (!isConnected) {
          setItems([]);
          return;
        }

        const historyRes = await fetch(`${apiBase}/imports/history?limit=200`, {
          method: "GET",
          credentials: "include",
        });

        if (!historyRes.ok) {
          setItems([]);
          return;
        }

        const historyData = (await historyRes.json().catch(() => ({}))) as HistoryResponse;
        if (!cancelled) {
          setItems(Array.isArray(historyData.items) ? historyData.items : []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const processedFiles = items.length;
  const totalTransactions = items.reduce((acc, x) => acc + Number(x.row_count || 0), 0);
  const recent = items.slice(0, 3);

  return (
    <AppShell active="Dashboard">
      <div className="grid gap-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <Stat
            title="Total Clients"
            value={connected ? "1" : "0"}
            note={connected ? clientName || "Connected bexio client" : "No active bexio connection"}
            icon={<Users className="h-5 w-5" />}
          />
          <Stat
            title="Processed Files"
            value={String(processedFiles)}
            note="Imported files stored in history"
            icon={<FileText className="h-5 w-5" />}
          />
          <Stat
            title="Total Transactions"
            value={String(totalTransactions)}
            note="Rows imported via direct posting flow"
            icon={<ListChecks className="h-5 w-5" />}
          />
          <Stat
            title="Processing Rules"
            value="Active"
            note="Cleanup + account/VAT mapping enabled"
            icon={<Settings className="h-5 w-5" />}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="text-sm font-semibold">Latest Imports</div>
              <Subhead>Brief overview. Open History for full details.</Subhead>
            </CardHeader>
            <CardContent>
              {loading ? <div className="text-sm text-slate-500">Loading dashboard metrics...</div> : null}
              {!loading && !connected ? (
                <div className="text-sm text-slate-500">Connect bexio to load import metrics.</div>
              ) : null}
              {!loading && connected && !recent.length ? (
                <div className="text-sm text-slate-500">No imports yet.</div>
              ) : null}

              {!loading && connected && recent.length ? (
                <div className="grid gap-2">
                  {recent.map((item) => (
                    <div
                      key={item.import_id}
                      className="rounded-xl border border-[color:var(--bp-border)] bg-white px-3 py-2"
                    >
                      <div className="text-sm font-medium">{formatDate(item.created_at)}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <Badge variant="blue">{item.row_count} rows</Badge>
                        <span className="font-mono">{item.import_id.slice(0, 8)}...</span>
                      </div>
                    </div>
                  ))}
                  <a href="/history" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                    Open full history →
                  </a>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm font-semibold">Quick Actions</div>
              <Subhead>Common tasks and workflows</Subhead>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Action title="Upload New File" desc="Process CSV, XLSX, or CAMT.053 files" href="/upload" />
              <Action title="Manage Posting Rules" desc="Configure automatic account assignments" href="/posting-rules" />
              <Action title="Direct Import" desc="Paste TSV and send to Bexio" href="/direct-import" />
              <div className="pt-2">
                <a href="/upload" className="block">
                  <Button className="w-full">Open Upload Flow</Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ title, value, note, icon }: { title: string; value: string; note: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-slate-400">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
        <div className="text-sm text-slate-500">{note}</div>
      </CardContent>
    </Card>
  );
}

function Action({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <a href={href} className="rounded-2xl border border-[color:var(--bp-border)] bg-white p-4 hover:bg-slate-50">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-sm text-slate-500">{desc}</div>
    </a>
  );
}
