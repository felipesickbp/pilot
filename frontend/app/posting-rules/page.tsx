"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/shell";
import { Card, CardContent, CardHeader, Subhead, Badge, Button, Input, Select } from "../components/ui";

type AccountItem = {
  id: number;
  number: string;
  name: string;
  display: string;
};

type PostingRule = {
  rule_id: string;
  created_at: string;
  tenant_id: string;
  field: string;
  op: string;
  keyword: string;
  account_no: string;
  side: "auto" | "soll" | "haben";
};

function normalizeAccountNo(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{3,})/);
  return m ? m[1] : s;
}

function formatDate(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(dt);
}

export default function PostingRulesPage() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE || "/api", []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [tenantName, setTenantName] = useState("");
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [rules, setRules] = useState<PostingRule[]>([]);

  const [keyword, setKeyword] = useState("");
  const [accountInput, setAccountInput] = useState("");
  const [side, setSide] = useState<"auto" | "soll" | "haben">("auto");

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [accountsRes, rulesRes] = await Promise.all([
        fetch(`${apiBase}/bexio/accounts`, { method: "GET", credentials: "include" }),
        fetch(`${apiBase}/posting-rules`, { method: "GET", credentials: "include" }),
      ]);

      const accountsData = await accountsRes.json().catch(() => ({}));
      const rulesData = await rulesRes.json().catch(() => ({}));

      if (!accountsRes.ok) {
        throw new Error(accountsData?.detail || "Failed to load accounts.");
      }
      if (!rulesRes.ok) {
        throw new Error(rulesData?.detail || "Failed to load posting rules.");
      }

      setTenantName(String(rulesData?.tenant_name || accountsData?.tenant_name || ""));
      setAccounts(Array.isArray(accountsData?.items) ? accountsData.items : []);
      setRules(Array.isArray(rulesData?.items) ? rulesData.items : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load posting rules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addRule() {
    setError("");
    setToast("");

    const kw = keyword.trim();
    const accountNo = normalizeAccountNo(accountInput);
    if (!kw) {
      setError("Bitte ein Stichwort erfassen (z.B. media markt).");
      return;
    }
    if (!accountNo) {
      setError("Bitte ein Konto erfassen.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`${apiBase}/posting-rules`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: kw,
          account_no: accountNo,
          side,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || "Failed to create rule.");
      }

      setRules((prev) => [data as PostingRule, ...prev]);
      setKeyword("");
      setAccountInput("");
      setSide("auto");
      setToast("Regel gespeichert.");
    } catch (e: any) {
      setError(e?.message || "Failed to create rule.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRule(ruleId: string) {
    setDeletingId(ruleId);
    setError("");
    setToast("");
    try {
      const res = await fetch(`${apiBase}/posting-rules/${encodeURIComponent(ruleId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || "Failed to delete rule.");
      }
      setRules((prev) => prev.filter((x) => x.rule_id !== ruleId));
      setToast("Regel gelöscht.");
    } catch (e: any) {
      setError(e?.message || "Failed to delete rule.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <AppShell active="Posting Rules">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Buchungsregeln</h2>
              <Subhead>
                Regeln werden pro verbundenem Mandanten gespeichert und später im Spreadsheet angewendet.
              </Subhead>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="blue">{tenantName || "Mandant"}</Badge>
              <Badge variant="pink">{rules.length} Regeln</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error ? (
            <div className="rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-sm text-pink-700">{error}</div>
          ) : null}
          {toast ? (
            <div className="rounded-xl border border-[color:var(--bp-border)] bg-slate-50 px-4 py-3 text-sm text-slate-700">{toast}</div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-[color:var(--bp-border)] bg-white p-4">
              <div>
                <div className="text-sm font-semibold">Neue Regel</div>
                <div className="mt-1 text-xs text-slate-500">Beispiel: Text enthält "media markt" → Konto 6800</div>
              </div>

              <div className="grid gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Text enthält</label>
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="mt-1"
                    placeholder="z.B. media markt"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">Konto</label>
                  <Input
                    value={accountInput}
                    onChange={(e) => setAccountInput(e.target.value)}
                    className="mt-1"
                    placeholder="z.B. 6800 oder Verpflegungsspesen"
                    list="posting-rule-account-options"
                  />
                  <datalist id="posting-rule-account-options">
                    {accounts.map((a) => (
                      <option key={`${a.id}-${a.number}`} value={`${a.number} ${a.name}`}>{a.display}</option>
                    ))}
                  </datalist>
                  <div className="mt-1 text-xs text-slate-500">
                    Beim Speichern wird die Kontonummer übernommen.
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">Zielseite</label>
                  <Select value={side} onChange={(e) => setSide(e.target.value as any)} className="mt-1">
                    <option value="auto">Auto (fehlende Gegenbuchung je nach Richtung)</option>
                    <option value="soll">Immer Soll</option>
                    <option value="haben">Immer Haben</option>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={addRule} disabled={saving || loading}>
                  {saving ? "Speichern..." : "Regel hinzufügen"}
                </Button>
                <Button variant="outline" onClick={loadAll} disabled={loading}>
                  Aktualisieren
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold">Aktive Regeln</div>

              {loading ? <div className="text-sm text-slate-500">Lade Regeln...</div> : null}
              {!loading && !rules.length ? (
                <div className="rounded-xl border border-[color:var(--bp-border)] bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Keine Regeln vorhanden.
                </div>
              ) : null}

              {!loading && rules.map((r) => (
                <div key={r.rule_id} className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--bp-border)] bg-white px-3 py-2">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="blue">Text enthält</Badge>
                      <span className="rounded-lg border border-[color:var(--bp-border)] bg-slate-50 px-2 py-1">{r.keyword}</span>
                      <Badge variant="pink">Konto {r.account_no}</Badge>
                      <Badge variant="blue">{r.side}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{formatDate(r.created_at)}</div>
                  </div>
                  <Button variant="ghost" onClick={() => removeRule(r.rule_id)} disabled={deletingId === r.rule_id}>
                    {deletingId === r.rule_id ? "..." : "×"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
