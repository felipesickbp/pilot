"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../components/shell";
import { Card, CardContent, CardHeader, Subhead, Badge, Button } from "../components/ui";

type TxRow = {
  doc: string;
  date: string; // stored as ISO YYYY-MM-DD if input dd.mm.yyyy
  description: string;
  amount: string;
  currency: string;
  exchangeRate: string;
  debitAccount: string;
  creditAccount: string;
  vatCode?: string;
  vatAccount?: string;
};

const STORAGE_KEY = "bp_pilot_direct_import_rows_v1";

function cleanCell(x: string) {
  return (x ?? "").trim().replace(/^"(.*)"$/, "$1");
}

function normalizeAmount(raw: string) {
  // Accept "1'234.50", "1,234.50", "1234,50" etc.
  let s = (raw ?? "").trim();
  if (!s) return "";

  s = s.replace(/'/g, "");

  // If comma used as decimal separator (and no dot), convert comma → dot
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  // Remove thousand separators like "1,234.56" → "1234.56"
  if (s.includes(".") && s.includes(",")) s = s.replace(/,/g, "");

  return s;
}

function normalizeDate(raw: string) {
  const s = (raw ?? "").trim();
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`; // ISO
  return s;
}

function parseTSVPreserveTrailingEmptyCells(line: string) {
  // IMPORTANT: if a line ends with \t\t, JS split("\t") keeps trailing empties,
  // but only if the string actually contains them. The user paste often does.
  // We also avoid trimming the whole line (trimEnd would remove tabs).
  return line.split("\t").map(cleanCell);
}

function parsePasteToRows(text: string, defaultCurrency: string): TxRow[] {
  // normalize newlines; DO NOT trimEnd the whole line (would remove trailing tabs)
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\u00a0/g, " ")) // replace nbsp
    .filter((l) => l.length > 0 && l.trim().length > 0);

  if (lines.length === 0) return [];

  return lines.map((line, idx) => {
    const cells = parseTSVPreserveTrailingEmptyCells(line);

    // Your TSV schema:
    // 0 date (dd.mm.yyyy)
    // 1 description
    // 2 amount
    // 3 currency
    // 4 fx
    // 5 debit
    // 6 credit
    // 7 vatCode (optional)
    // 8 vatAccount (optional)
    const date = normalizeDate(cells[0] ?? "");
    const description = cells[1] ?? "";
    const amount = normalizeAmount(cells[2] ?? "");
    const currency = (cells[3] ?? defaultCurrency).trim() || defaultCurrency;
    const exchangeRate = normalizeAmount(cells[4] ?? "1") || "1";
    const debitAccount = (cells[5] ?? "").trim();
    const creditAccount = (cells[6] ?? "").trim();
    const vatCode = (cells[7] ?? "").trim();
    const vatAccount = (cells[8] ?? "").trim();

    return {
      doc: `DI${String(idx + 1).padStart(4, "0")}`,
      date,
      description,
      amount,
      currency,
      exchangeRate,
      debitAccount,
      creditAccount,
      vatCode,
      vatAccount,
    };
  });
}

export default function DirectImportPage() {
  const router = useRouter();

  const [paste, setPaste] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("CHF");
  const [message, setMessage] = useState("");

  function loadToSpreadsheet() {
    setMessage("");

    const rows = parsePasteToRows(paste, defaultCurrency);

    if (rows.length === 0) {
      setMessage("Nothing to load. Paste TSV first.");
      return;
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    router.push("/spreadsheet");
  }

  return (
    <AppShell active="Direct Import">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Direct Import</h2>
              <Subhead>
                Paste TSV (Excel) → parse into columns → open Spreadsheet for review/edit.
              </Subhead>
            </div>
            <Badge variant="blue">Demo</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {message ? (
            <div className="rounded-xl border border-[color:var(--bp-border)] bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {message}
            </div>
          ) : null}

          <div className="rounded-xl border border-[color:var(--bp-border)] bg-white p-4">
            <div className="text-sm font-medium">TSV format</div>
            <div className="mt-2 text-sm text-slate-600">
              Paste Excel rows in this order: <span className="font-mono">date, text, amount, currency, fx, debit, credit, vatCode, vatAccount</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setPaste("");
                  setMessage("Cleared.");
                }}
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="grid gap-3 max-w-4xl">
            <label className="text-sm font-medium text-slate-700">Paste (Excel → TSV)</label>

            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="Paste from Excel here (Ctrl+V). TSV recommended."
              className="min-h-[240px] w-full rounded-xl border border-[color:var(--bp-border)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[color:var(--bp-border)] bg-white p-3">
                <div className="text-xs font-medium text-slate-600">Default currency</div>
                <select
                  value={defaultCurrency}
                  onChange={(e) => setDefaultCurrency(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-[color:var(--bp-border)] bg-white px-3 py-2 text-sm"
                >
                  <option value="CHF">CHF</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
                <div className="mt-2 text-xs text-slate-500">
                  Used when pasted data has no currency column.
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={loadToSpreadsheet} type="button" className="w-full">
                  Load to Spreadsheet →
                </Button>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Tip: VAT Code/Account will only show for rows that actually have column 8/9 filled (e.g. VB81).
            </div>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
