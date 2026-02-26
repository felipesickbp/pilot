"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/shell";
import { FlowStepper } from "../components/stepper";
import { Badge, Button, Card, CardContent, CardHeader, Subhead } from "../components/ui";
import { Send, Trash2, Wand2 } from "lucide-react";
import { type NormalizedRow, safeText } from "../importer";

type Row = NormalizedRow;

type PostResultRow = {
  row: number;
  csv_row?: number;
  status: string;
  id?: number;
  reference_nr?: string;
  error?: string;
};

type AccountItem = {
  id: number;
  number: string;
  name: string;
  display: string;
};

type PostingRule = {
  rule_id: string;
  keyword: string;
  account_no: string;
  side: "auto" | "soll" | "haben";
};

const STORAGE_KEY = "bp_pilot_direct_import_rows_v1";
const STORAGE_META_KEY = "bp_pilot_direct_import_meta_v1";

function safeParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function normalizeAccountNo(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{3,})/);
  return m ? m[1] : s;
}

function ruleMatches(rule: PostingRule, row: Row): boolean {
  const kw = safeText(rule.keyword).toLowerCase();
  if (!kw) return false;
  return safeText(row.description).toLowerCase().includes(kw);
}

function targetFieldForRule(rule: PostingRule, row: Row): "sollAccount" | "habenAccount" {
  if (rule.side === "soll") return "sollAccount";
  if (rule.side === "haben") return "habenAccount";
  return row.direction === "DBIT" ? "sollAccount" : "habenAccount";
}

export default function SpreadsheetPage() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE || "/api", []);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileTypeBadge, setFileTypeBadge] = useState<string>("IMPORT");
  const [toast, setToast] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitSummary, setSubmitSummary] = useState<string>("");
  const [submitResults, setSubmitResults] = useState<PostResultRow[]>([]);

  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [rules, setRules] = useState<PostingRule[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [applyingRules, setApplyingRules] = useState(false);
  const [autoRulesDone, setAutoRulesDone] = useState(false);
  const [activeCell, setActiveCell] = useState<string>("");

  useEffect(() => {
    const stored = safeParse<any[]>(sessionStorage.getItem(STORAGE_KEY));
    const meta = safeParse<any>(sessionStorage.getItem(STORAGE_META_KEY));

    const selectedBankAccount = meta?.bankAccount ? String(meta.bankAccount) : "1020";
    if (meta?.fileType) setFileTypeBadge(String(meta.fileType).toUpperCase());

    if (stored?.length) {
      const normalized = stored.map((r, idx) => {
        const parsedAmount = Number(r?.amount ?? 0);
        const amount = Number.isFinite(parsedAmount) ? Math.abs(parsedAmount) : 0;
        const direction: "CRDT" | "DBIT" =
          r?.direction === "DBIT" || r?.direction === "CRDT"
            ? r.direction
            : amount < 0
              ? "DBIT"
              : "CRDT";

        let sollAccount = String(r?.sollAccount ?? r?.debitAccount ?? "").trim();
        let habenAccount = String(r?.habenAccount ?? r?.creditAccount ?? "").trim();

        if (direction === "CRDT" && !sollAccount) sollAccount = selectedBankAccount;
        if (direction === "DBIT" && !habenAccount) habenAccount = selectedBankAccount;

        return {
          id: String(r?.id || `DI${String(idx + 1).padStart(4, "0")}`),
          date: String(r?.date || ""),
          description: String(r?.description || ""),
          amount,
          currency: String(r?.currency || "CHF"),
          fx: Number(r?.fx ?? r?.exchangeRate ?? 1) || 1,
          direction,
          sollAccount,
          habenAccount,
          vatCode: String(r?.vatCode || ""),
          vatAccount: String(r?.vatAccount || ""),
          originalRow: r?.originalRow,
        } as Row;
      });

      setRows(normalized);
    } else {
      setRows([
        {
          id: "DI0001",
          date: "2026-01-19",
          description: "Ewheel Murcia",
          amount: 285.53,
          currency: "CHF",
          fx: 1,
          direction: "DBIT",
          sollAccount: "",
          habenAccount: meta?.bankAccount || "1020",
          vatCode: "",
          vatAccount: "",
        },
      ]);
      setToast("Keine importierten Zeilen in der Session gefunden. Bitte zuerst eine Datei via Upload importieren.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      setLoadingConfig(true);
      try {
        const [accountsRes, rulesRes] = await Promise.all([
          fetch(`${apiBase}/bexio/accounts`, { method: "GET", credentials: "include" }),
          fetch(`${apiBase}/posting-rules`, { method: "GET", credentials: "include" }),
        ]);

        const accountsData = await accountsRes.json().catch(() => ({}));
        const rulesData = await rulesRes.json().catch(() => ({}));

        if (!cancelled) {
          if (accountsRes.ok) {
            setAccounts(Array.isArray(accountsData?.items) ? accountsData.items : []);
          }
          if (rulesRes.ok) {
            setRules(Array.isArray(rulesData?.items) ? rulesData.items : []);
          }
          if (!accountsRes.ok && !rulesRes.ok) {
            setToast("Kontenplan / Regeln konnten nicht geladen werden. Konten können manuell ergänzt werden.");
          }
        }
      } catch {
        if (!cancelled) {
          setToast("Kontenplan / Regeln konnten nicht geladen werden. Konten können manuell ergänzt werden.");
        }
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    }

    loadConfig();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  function persistRows(next: Row[]) {
    setRows(next);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function applyRulesToRows(source: "auto" | "manual") {
    if (!rows.length || !rules.length) {
      if (source === "manual") setToast("Keine Buchungsregeln vorhanden.");
      return;
    }

    setApplyingRules(true);
    let changed = 0;

    const next = rows.map((r) => {
      let row = { ...r };
      for (const rule of rules) {
        if (!ruleMatches(rule, row)) continue;
        const target = targetFieldForRule(rule, row);
        if (!safeText((row as any)[target])) {
          (row as any)[target] = normalizeAccountNo(rule.account_no);
          changed += 1;
        }
      }
      return row;
    });

    persistRows(next);
    setApplyingRules(false);

    if (source === "manual") {
      setToast(changed ? `Buchungsregeln angewendet: ${changed} Feld(er) automatisch befüllt.` : "Keine passenden Regeln für offene Kontofelder gefunden.");
    } else if (changed) {
      setToast(`Automatisch ${changed} Kontofelder aus Buchungsregeln vorausgefüllt.`);
    }
  }

  useEffect(() => {
    if (autoRulesDone) return;
    if (loadingConfig) return;
    if (!rows.length) return;
    if (!rules.length) {
      setAutoRulesDone(true);
      return;
    }
    applyRulesToRows("auto");
    setAutoRulesDone(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingConfig, rules.length, rows.length, autoRulesDone]);

  const completedCount = useMemo(() => {
    return rows.filter((r) => r.sollAccount && r.habenAccount).length;
  }, [rows]);

  const pct = useMemo(() => {
    if (!rows.length) return 0;
    return Math.round((completedCount / rows.length) * 100);
  }, [completedCount, rows.length]);

  function updateRow(id: string, patch: Partial<Row>) {
    const next = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    persistRows(next);
  }

  function deleteRow(id: string) {
    const next = rows.filter((r) => r.id !== id);
    persistRows(next);
    setToast("Zeile gelöscht.");
  }

  function accountSuggestions(query: string) {
    const q = safeText(query).toLowerCase();
    if (!q) return [] as AccountItem[];
    return accounts
      .filter((a) => a.number.toLowerCase().includes(q) || safeText(a.name).toLowerCase().includes(q))
      .slice(0, 6);
  }

  function accountCell(row: Row, field: "sollAccount" | "habenAccount") {
    const value = String((row as any)[field] || "");
    const key = `${row.id}:${field}`;
    const items = activeCell === key ? accountSuggestions(value) : [];
    const missing = !value;

    return (
      <div className={`relative rounded-lg border px-2 py-1 ${missing ? "border-pink-200 bg-pink-50" : "border-[color:var(--bp-border)] bg-white"}`}>
        <input
          className="w-full bg-transparent outline-none"
          placeholder={field === "sollAccount" ? "Soll" : "Haben"}
          value={value}
          list="account-options-global"
          onFocus={() => setActiveCell(key)}
          onBlur={() => {
            const normalized = normalizeAccountNo(value);
            if (normalized !== value) updateRow(row.id, { [field]: normalized } as Partial<Row>);
            window.setTimeout(() => setActiveCell((prev) => (prev === key ? "" : prev)), 120);
          }}
          onChange={(e) => updateRow(row.id, { [field]: e.target.value } as Partial<Row>)}
        />
        {items.length ? (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 rounded-xl border border-[color:var(--bp-border)] bg-white p-1 shadow-lg">
            {items.map((a) => (
              <button
                key={`${key}-${a.id}`}
                type="button"
                className="block w-full rounded-lg px-2 py-1 text-left text-xs hover:bg-slate-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  updateRow(row.id, { [field]: a.number } as Partial<Row>);
                  setActiveCell("");
                }}
              >
                <span className="font-semibold">{a.number}</span> {a.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  async function submitToBexio() {
    setToast("");
    setSubmitSummary("");
    setSubmitResults([]);

    if (!rows.length) {
      setToast("Keine Zeilen zum Senden vorhanden.");
      return;
    }

    const postRows = rows
      .filter((r) => r.date || Number(r.amount) !== 0 || r.sollAccount || r.habenAccount)
      .map((r, idx) => ({
        row: idx + 1,
        doc: r.id,
        date: r.date,
        text: r.description,
        amount: Math.abs(Number(r.amount)),
        currency: r.currency || "CHF",
        fx: Number(r.fx || 1),
        debit: r.sollAccount,
        credit: r.habenAccount,
        vatCode: r.vatCode || "",
        vatAccount: r.vatAccount || "",
        reference_nr: "",
      }));

    if (!postRows.length) {
      setToast("Keine gültigen Zeilen zum Senden vorhanden.");
      return;
    }

    try {
      setSubmitting(true);
      const r = await fetch(`${apiBase}/bexio/direct-import/post`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: postRows,
          auto_reference_nr: true,
          batch_size: 25,
          sleep_between_batches: 2,
          max_retries: 5,
          dry_run: false,
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const detail = data?.detail || "Senden fehlgeschlagen.";
        throw new Error(String(detail));
      }

      const ok = Number(data?.ok_count || 0);
      const dry = Number(data?.dry_run_count || 0);
      const err = Number(data?.error_count || 0);
      setSubmitSummary(`Fertig. OK: ${ok}, Dry-run: ${dry}, Fehler: ${err}`);
      setSubmitResults(Array.isArray(data?.results) ? data.results : []);
    } catch (e: any) {
      setToast(e?.message || "Konnte nicht an Bexio senden.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell active="Upload">
      <div className="mb-6">
        <div className="text-3xl font-semibold">Transaktions-Tabelle</div>
        <Subhead>
          Kontierung prüfen, fehlende Daten ergänzen und danach an bexio senden.
        </Subhead>
      </div>

      <div className="mb-8">
        <FlowStepper active="Tabelle" />
      </div>

      {toast ? (
        <div className="mb-4 rounded-xl border border-[color:var(--bp-border)] bg-slate-50 p-3 text-sm text-slate-600">
          {toast}
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="text-xl font-semibold">✨ Transaktionsdaten</div>
          <Badge variant="blue">{fileTypeBadge}</Badge>
          {rules.length ? <Badge variant="pink">{rules.length} Buchungsregeln</Badge> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => applyRulesToRows("manual")} disabled={applyingRules || !rules.length}>
            <Wand2 className="h-4 w-4" /> {applyingRules ? "Wende an..." : "Buchungsregeln anwenden"}
          </Button>
          <Button onClick={submitToBexio} disabled={submitting}>
            <Send className="h-4 w-4" /> {submitting ? "Sende..." : "An Bexio senden"}
          </Button>
        </div>
      </div>

      <Card className="border-pink-200">
        <CardContent className="flex items-center justify-between py-6">
          <div>
            <div className="text-sm font-semibold">
              {completedCount} von {rows.length} Transaktionen vollständig kontiert
            </div>
            <div className="text-sm text-slate-500">
              Fehlende Soll/Haben-Konten können per Autocomplete und Buchungsregeln ergänzt werden.
            </div>
            {loadingConfig ? <div className="mt-1 text-xs text-slate-500">Kontenplan und Regeln werden geladen...</div> : null}
          </div>
          <div className="w-40">
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-blue-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 text-right text-xs text-slate-500">{pct}%</div>
          </div>
        </CardContent>
      </Card>

      <datalist id="account-options-global">
        {accounts.map((a) => (
          <option key={`global-${a.id}-${a.number}`} value={`${a.number} ${a.name}`}>
            {a.display}
          </option>
        ))}
      </datalist>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Transaktionsdaten</div>
            <Subhead>Datum, Konten und MWST sind direkt bearbeitbar. Einzelne Zeilen können gelöscht werden.</Subhead>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-xl border border-[color:var(--bp-border)] bg-white">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="w-[130px] p-3 text-left">Datum</th>
                    <th className="w-[38%] p-3 text-left">Beschreibung</th>
                    <th className="w-[140px] p-3 text-left">Betrag</th>
                    <th className="w-[140px] p-3 text-left">Soll</th>
                    <th className="w-[140px] p-3 text-left">Haben</th>
                    <th className="w-[120px] p-3 text-left">MWST</th>
                    <th className="w-[90px] p-3 text-left">Aktion</th>
                  </tr>
                </thead>

                <tbody className="text-slate-700">
                  {rows.map((r) => {
                    const vatMissing = !r.vatCode;

                    return (
                      <tr key={r.id} className="border-t border-[color:var(--bp-border)]">
                        <td className="p-3">
                          <div className="rounded-lg border border-[color:var(--bp-border)] bg-white px-2 py-1">
                            <input
                              type="date"
                              className="w-full bg-transparent outline-none"
                              value={r.date}
                              onChange={(e) => updateRow(r.id, { date: e.target.value })}
                            />
                          </div>
                        </td>

                        <td className="p-3">
                          <div className="rounded-lg border border-[color:var(--bp-border)] bg-white px-2 py-1 break-words">
                            {r.description}
                          </div>
                        </td>

                        <td className="p-3">
                          <div className="rounded-lg border border-[color:var(--bp-border)] bg-white px-2 py-1">
                            {Math.abs(Number(r.amount)).toFixed(2)}
                            <div className="mt-1">
                              <Badge variant={r.direction === "DBIT" ? "pink" : "blue"}>{r.direction || "—"}</Badge>
                            </div>
                          </div>
                        </td>

                        <td className="p-3">{accountCell(r, "sollAccount")}</td>

                        <td className="p-3">{accountCell(r, "habenAccount")}</td>

                        <td className="p-3">
                          <div className={`rounded-lg border px-2 py-1 ${vatMissing ? "border-pink-200 bg-pink-50" : "border-[color:var(--bp-border)] bg-white"}`}>
                            <input
                              className="w-full bg-transparent outline-none"
                              placeholder="e.g. VB81"
                              value={r.vatCode}
                              onChange={(e) => updateRow(r.id, { vatCode: e.target.value })}
                            />
                          </div>
                        </td>
                        <td className="p-3">
                          <Button
                            variant="outline"
                            onClick={() => deleteRow(r.id)}
                            title="Zeile löschen"
                            aria-label="Zeile löschen"
                            className="h-9 px-3"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Nächster Schritt: “An Bexio senden” ruft die Backend-API auf (validieren → mappen → buchen).
            </div>
            {submitSummary ? <div className="mt-3 text-sm font-medium text-slate-700">{submitSummary}</div> : null}
            {submitResults.length ? (
              <div className="mt-3 overflow-auto rounded-xl border border-[color:var(--bp-border)] bg-white">
                <table className="min-w-[700px] w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      {["Zeile", "CSV-Zeile", "Status", "ID", "Ref", "Fehler"].map((h) => (
                        <th key={h} className="p-2 text-left">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {submitResults.map((r, i) => (
                      <tr key={`${r.row}-${i}`} className="border-t border-[color:var(--bp-border)]">
                        <td className="p-2">{r.row}</td>
                        <td className="p-2">{r.csv_row ?? ""}</td>
                        <td className="p-2">{r.status}</td>
                        <td className="p-2">{r.id ?? ""}</td>
                        <td className="p-2">{r.reference_nr ?? ""}</td>
                        <td className="p-2 text-red-600">{r.error ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
