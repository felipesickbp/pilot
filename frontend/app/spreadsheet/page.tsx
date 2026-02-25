"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/shell";
import { FlowStepper } from "../components/stepper";
import { Badge, Button, Card, CardContent, CardHeader, Subhead, Input } from "../components/ui";
import { Copy, ClipboardPaste, Plus, Save } from "lucide-react";
import { type NormalizedRow } from "../importer";

type Row = NormalizedRow;

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

export default function SpreadsheetPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [bankAccount, setBankAccount] = useState<string>("1020");
  const [fileTypeBadge, setFileTypeBadge] = useState<string>("IMPORT");
  const [toast, setToast] = useState<string>("");

  useEffect(() => {
    const stored = safeParse<any[]>(sessionStorage.getItem(STORAGE_KEY));
    const meta = safeParse<any>(sessionStorage.getItem(STORAGE_META_KEY));

    const selectedBankAccount = meta?.bankAccount ? String(meta.bankAccount) : bankAccount;
    if (meta?.bankAccount) setBankAccount(selectedBankAccount);
    if (meta?.fileType) setFileTypeBadge(String(meta.fileType).toUpperCase());

    if (stored?.length) {
      // Backward compatibility: support old debit/credit keys and normalize to soll/haben.
      const normalized = stored.map((r, idx) => {
        const parsedAmount = Number(r?.amount ?? 0);
        const amount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
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
          fx: Number(r?.fx ?? 1) || 1,
          direction,
          sollAccount,
          habenAccount,
          vatCode: String(r?.vatCode || ""),
          originalRow: r?.originalRow,
        } as Row;
      });

      setRows(normalized);
    } else {
      // Demo fallback
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
        },
      ]);
      setToast("No imported rows found in session. Go to Upload and import a bank export file.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update stored bankAccount if user changes it here
  useEffect(() => {
    const meta = safeParse<any>(sessionStorage.getItem(STORAGE_META_KEY)) || {};
    meta.bankAccount = bankAccount;
    sessionStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta));
  }, [bankAccount]);

  const completedCount = useMemo(() => {
    return rows.filter((r) => r.sollAccount && r.habenAccount).length;
  }, [rows]);

  const pct = useMemo(() => {
    if (!rows.length) return 0;
    return Math.round((completedCount / rows.length) * 100);
  }, [completedCount, rows.length]);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function applyBankAccountToAll() {
    // Applies the chosen bankAccount to the correct side depending on direction
    setRows((prev) => {
      const next = prev.map((r) => {
        if (r.direction === "CRDT") return { ...r, sollAccount: bankAccount };
        if (r.direction === "DBIT") return { ...r, habenAccount: bankAccount };
        return r;
      });
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setToast("Applied bank account to all rows (direction-aware).");
      return next;
    });
  }

  return (
    <AppShell active="Upload Files">
      <div className="mb-6">
        <div className="text-3xl font-semibold">Transaction Spreadsheet</div>
        <Subhead>
          Bank account is auto-filled direction-aware (CRDT/DBIT). Fill missing counterpart accounts and VAT.
        </Subhead>
      </div>

      <div className="mb-8">
        <FlowStepper active="Spreadsheet" />
      </div>

      {toast ? (
        <div className="mb-4 rounded-xl border border-[color:var(--bp-border)] bg-slate-50 p-3 text-sm text-slate-600">
          {toast}
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="text-xl font-semibold">✨ Transaction Data</div>
          <Badge variant="blue">{fileTypeBadge}</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--bp-border)] bg-white px-3 py-2">
            <div className="text-xs font-semibold text-slate-600">Bankkonto</div>
            <Input
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              className="w-24"
              placeholder="1020"
            />
            <Button variant="outline" onClick={applyBankAccountToAll}>
              Apply
            </Button>
          </div>

          <Button variant="outline">
            <Copy className="h-4 w-4" /> Copy
          </Button>
          <Button variant="outline">
            <ClipboardPaste className="h-4 w-4" /> Paste
          </Button>
          <Button variant="outline">
            <Plus className="h-4 w-4" /> Add Rule
          </Button>
          <Button>
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </div>

      <Card className="border-pink-200">
        <CardContent className="flex items-center justify-between py-6">
          <div>
            <div className="text-sm font-semibold">
              {completedCount} of {rows.length} transactions completed
            </div>
            <div className="text-sm text-slate-500">
              Soll/Haben is partly auto-filled (bank side). Fill counterpart account(s) and VAT where needed.
            </div>
          </div>
          <div className="w-40">
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-blue-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 text-right text-xs text-slate-500">{pct}%</div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Transaction Data</div>
            <Subhead>Edit transactions directly. Direction column is shown for CAMT clarity.</Subhead>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-xl border border-[color:var(--bp-border)] bg-white">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    {["Doc", "Date", "Description", "Amount", "Currency", "FX", "Dir", "Soll", "Haben", "VAT"].map((h) => (
                      <th key={h} className="p-3 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="text-slate-700">
                  {rows.map((r) => {
                    const sollMissing = !r.sollAccount;
                    const habenMissing = !r.habenAccount;
                    const vatMissing = !r.vatCode;

                    return (
                      <tr key={r.id} className="border-t border-[color:var(--bp-border)]">
                        <td className="p-3">
                          <div className="rounded-lg border border-[color:var(--bp-border)] bg-sky-50 px-2 py-1">{r.id}</div>
                        </td>

                        <td className="p-3">
                          <div className="rounded-lg border border-[color:var(--bp-border)] bg-sky-50 px-2 py-1">{r.date}</div>
                        </td>

                        <td className="p-3">
                          <div className="rounded-lg border border-[color:var(--bp-border)] bg-sky-50 px-2 py-1">
                            {r.description}
                          </div>
                        </td>

                        <td className="p-3">
                          <div className="rounded-lg border border-[color:var(--bp-border)] bg-sky-50 px-2 py-1">
                            {Number(r.amount).toFixed(2)}
                          </div>
                        </td>

                        <td className="p-3">
                          <div className="rounded-lg border border-[color:var(--bp-border)] bg-sky-50 px-2 py-1">{r.currency}</div>
                        </td>

                        <td className="p-3">
                          <div className="rounded-lg border border-[color:var(--bp-border)] bg-sky-50 px-2 py-1">{r.fx}</div>
                        </td>

                        <td className="p-3">
                          <Badge variant={r.direction === "DBIT" ? "pink" : "blue"}>{r.direction || "—"}</Badge>
                        </td>

                        <td className="p-3">
                          <div className={`rounded-lg border px-2 py-1 ${sollMissing ? "border-pink-200 bg-pink-50" : "border-[color:var(--bp-border)] bg-white"}`}>
                            <input
                              className="w-full bg-transparent outline-none"
                              placeholder="Soll"
                              value={r.sollAccount}
                              onChange={(e) => updateRow(r.id, { sollAccount: e.target.value })}
                            />
                          </div>
                        </td>

                        <td className="p-3">
                          <div className={`rounded-lg border px-2 py-1 ${habenMissing ? "border-pink-200 bg-pink-50" : "border-[color:var(--bp-border)] bg-white"}`}>
                            <input
                              className="w-full bg-transparent outline-none"
                              placeholder="Haben"
                              value={r.habenAccount}
                              onChange={(e) => updateRow(r.id, { habenAccount: e.target.value })}
                            />
                          </div>
                        </td>

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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Next: “Submit to Bexio” will call backend API (validate → map accounts/VAT → post).
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
