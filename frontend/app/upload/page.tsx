"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../components/shell";
import { FlowStepper } from "../components/stepper";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Subhead,
  Input,
} from "../components/ui";
import { UploadCloud, Landmark, FileText, FileSpreadsheet, ClipboardPaste } from "lucide-react";
import {
  IMPORT_CONTEXT_KEY,
  PREVIEW_META_KEY,
  PREVIEW_ROWS_KEY,
  STORAGE_KEY,
  STORAGE_META_KEY,
  parseFileToContext,
} from "../importer";

type ImportMode = "bank" | "direct";
type DirectImportRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  fx: number;
  direction: "CRDT" | "DBIT";
  debitAccount: string;
  creditAccount: string;
  vatCode?: string;
  vatAccount?: string;
};

export default function UploadPage() {
  const router = useRouter();
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE || "/api", []);

  const [mode, setMode] = useState<ImportMode>("bank");
  const [bankAccount, setBankAccount] = useState("1020");
  const [vatMode, setVatMode] = useState<"with" | "without">("with");
  const [hasVat, setHasVat] = useState<boolean | null>(null);
  const [fileName, setFileName] = useState("");
  const [candidateCount, setCandidateCount] = useState(0);
  const [bestSummary, setBestSummary] = useState<string>("");
  const [error, setError] = useState("");
  const [clientName, setClientName] = useState("");
  const [paste, setPaste] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("CHF");
  const [directMessage, setDirectMessage] = useState("");

  React.useEffect(() => {
    const qp = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("mode") : "";
    const modeRaw = String(qp || "").toLowerCase();
    if (modeRaw === "direct") setMode("direct");
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${apiBase}/bexio/session`, {
          method: "GET",
          credentials: "include",
        });
        if (!r.ok) return;
        const data = (await r.json()) as { connected?: boolean; client_name?: string; has_vat?: boolean | null };
        if (!cancelled) {
          setClientName(data.connected ? String(data.client_name || "") : "");
          const vat = typeof data.has_vat === "boolean" ? data.has_vat : null;
          setHasVat(vat);
          if (vat === true) setVatMode("with");
          if (vat === false) setVatMode("without");
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const summary = useMemo(() => {
    if (!candidateCount) return null;
    return { candidateCount, bestSummary };
  }, [candidateCount, bestSummary]);

  function resetAll() {
    setFileName("");
    setCandidateCount(0);
    setBestSummary("");
    setError("");
    try {
      sessionStorage.removeItem(IMPORT_CONTEXT_KEY);
      sessionStorage.removeItem(PREVIEW_ROWS_KEY);
      sessionStorage.removeItem(PREVIEW_META_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_META_KEY);
    } catch {}
  }

  async function onPickFile(file: File | null) {
    setError("");
    setCandidateCount(0);
    setBestSummary("");
    if (!file) return;

    setFileName(file.name);

    try {
      const ctx = await parseFileToContext(file, bankAccount, vatMode);
      sessionStorage.setItem(IMPORT_CONTEXT_KEY, JSON.stringify(ctx));

      setCandidateCount(ctx.candidates.length);

      const best = ctx.candidates[0];
      setBestSummary(
        `${best.reason} · ${best.headers.length} columns · ${best.rows.length} preview rows`
      );
    } catch (e: any) {
      setError(e?.message || "Failed to parse file.");
    }
  }

  function goPreview() {
    if (!candidateCount) return;
    router.push("/preview");
  }

  function loadDirectToSpreadsheet() {
    setDirectMessage("");
    const rows = parseDirectImportRows(paste, defaultCurrency, bankAccount);
    if (!rows.length) {
      setDirectMessage("Keine Zeilen erkannt. Bitte TLV/TSV zuerst einfügen.");
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    sessionStorage.setItem(
      STORAGE_META_KEY,
      JSON.stringify({
        source: "direct",
        fileType: "direct",
        bankAccount,
        vatMode,
        createdAt: new Date().toISOString(),
      })
    );
    router.push("/spreadsheet");
  }

  return (
    <AppShell active="Upload">
      <div className="mb-6">
        <div className="text-3xl font-semibold">
          {mode === "bank" ? "Transaktionsdateien hochladen" : "Direktimport (TLV/TSV)"}
        </div>
        <Subhead>
          {mode === "bank"
            ? "CSV, Excel oder CAMT XML hochladen. Danach Kandidaten prüfen und in Preview mappen."
            : "TLV/TSV aus Excel einfügen und direkt in die Tabelle übernehmen."}
        </Subhead>
      </div>

      <div className="mb-6 rounded-2xl border border-[color:var(--bp-border)] bg-white p-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant={mode === "bank" ? "primary" : "outline"} onClick={() => setMode("bank")} type="button">
            Bank Statement
          </Button>
          <Button variant={mode === "direct" ? "primary" : "outline"} onClick={() => setMode("direct")} type="button">
            Direktimport
          </Button>
        </div>
      </div>

      <div className="mb-8">
        <FlowStepper active={mode === "bank" ? "Upload" : "Direktimport"} variant={mode === "bank" ? "bank" : "direct"} />
      </div>

      {mode === "bank" ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UploadCloud className="h-5 w-5 text-slate-500" />
              Upload & Kandidaten erkennen
            </div>
            <Subhead>Datei auswählen und das Bankkonto (Hauptbuch) für die Buchung festlegen.</Subhead>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Verbundener bexio-Mandant</div>
              <div className="h-10 rounded-xl border border-[color:var(--bp-border)] bg-slate-50 px-3 text-sm text-slate-700 flex items-center">
                {clientName || "Nicht verbunden"}
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Bankkonto (GL)</div>
              <Input
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="e.g. 1020"
              />
              <div className="text-xs text-slate-500">
                Das Bankkonto wird später je nach Geldfluss in Soll oder Haben gesetzt.
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">MWST-Status (automatisch aus bexio)</div>
              <div className="h-10 rounded-xl border border-[color:var(--bp-border)] bg-slate-50 px-3 text-sm text-slate-700 flex items-center justify-between">
                <span>
                  {hasVat === true ? "Mit MWST" : hasVat === false ? "Ohne MWST" : "Nicht eindeutig erkennbar (Standard: Mit MWST)"}
                </span>
                <Badge variant={hasVat === false ? "default" : "pink"}>{vatMode === "with" ? "MWST aktiv" : "MWST aus"}</Badge>
              </div>
            </div>

            <label className="rounded-2xl border border-dashed border-[color:var(--bp-border)] bg-white p-10 text-center cursor-pointer hover:bg-slate-50">
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.xml,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/xml,text/xml"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] || null)}
              />
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50">
                <Landmark className="h-5 w-5 text-slate-500" />
              </div>
              <div className="text-sm font-medium">
                {fileName ? `Ausgewählt: ${fileName}` : "Hier klicken, um CSV-, Excel- oder CAMT-XML-Datei zu wählen"}
              </div>
              <div className="mt-1 text-xs text-slate-500">Unterstützt: CSV, XLSX, XLS, XML.</div>
            </label>

            {error ? (
              <div className="rounded-xl border border-pink-200 bg-pink-50 p-3 text-sm text-pink-700">
                {error}
              </div>
            ) : null}

            {summary ? (
              <div className="rounded-xl border border-[color:var(--bp-border)] bg-slate-50 p-3 text-sm">
                <div className="font-semibold">Candidates detected</div>
                <div className="mt-1 text-slate-600">
                  Anzahl: <span className="font-medium">{summary.candidateCount}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{summary.bestSummary}</div>
                <div className="mt-2 text-xs text-slate-500">
                  Nächster Schritt: Preview (Kandidat wählen, Spalten zuordnen, Betragslogik festlegen).
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Button className="w-full" onClick={goPreview} disabled={!candidateCount}>
                Weiter zu Preview →
              </Button>
              <Button className="w-full" variant="outline" onClick={resetAll}>
                Zurücksetzen
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[color:var(--bp-border)] bg-slate-50/40">
          <CardHeader>
            <div className="text-sm font-semibold text-slate-600">Why this works across banks</div>
            <Subhead className="text-slate-500">
              Kein starres Bankformat: Bei abweichenden Spalten steuerst du das Mapping selbst.
            </Subhead>
          </CardHeader>
          <CardContent className="grid gap-3">
            <FormatRow
              icon={<FileText className="h-5 w-5" />}
              title="CSV Files"
              desc="Verarbeitet Metazeilen, verschobene Header und Exporte ohne Kopfzeile."
              highlight
            />
            <FormatRow
              icon={<FileSpreadsheet className="h-5 w-5" />}
              title="Excel-Dateien"
              desc="Liest Arbeitsblätter und schlägt mehrere mögliche Header-Zeilen vor."
              highlight
            />
            <FormatRow
              icon={<Landmark className="h-5 w-5" />}
              title="CAMT.053"
              desc="CAMT-XML wird weiterhin unterstützt."
              highlight
            />
            <FormatRow
              icon={<FileText className="h-5 w-5" />}
              title="Bereinigungsfreundlich"
              desc="Textbereinigung erfolgt bewusst erst im Schritt Bereinigung."
              highlight
            />
          </CardContent>
        </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardPaste className="h-5 w-5 text-slate-500" />
                TLV/TSV einfügen
              </div>
              <Subhead>Format: Datum, Text, Betrag, Währung, FX, Soll, Haben, MWST-Code, MWST-Konto</Subhead>
            </CardHeader>
            <CardContent className="grid gap-4">
              {directMessage ? (
                <div className="rounded-xl border border-[color:var(--bp-border)] bg-slate-50 p-3 text-sm text-slate-700">
                  {directMessage}
                </div>
              ) : null}

              <div className="grid gap-2">
                <div className="text-xs font-semibold text-slate-600">Verbundener bexio-Mandant</div>
                <div className="flex h-10 items-center rounded-xl border border-[color:var(--bp-border)] bg-slate-50 px-3 text-sm text-slate-700">
                  {clientName || "Nicht verbunden"}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <div className="text-xs font-semibold text-slate-600">Bankkonto (GL)</div>
                  <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="z. B. 1020" />
                </div>
                <div className="grid gap-2">
                  <div className="text-xs font-semibold text-slate-600">Fallback-Währung</div>
                  <select
                    value={defaultCurrency}
                    onChange={(e) => setDefaultCurrency(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[color:var(--bp-border)] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-fuchsia-200"
                  >
                    <option value="CHF">CHF</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder="Excel TLV/TSV hier einfügen (Ctrl+V)"
                className="min-h-[260px] w-full rounded-xl border border-[color:var(--bp-border)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-200"
              />

              <div className="grid grid-cols-2 gap-3">
                <Button className="w-full" onClick={loadDirectToSpreadsheet} type="button">
                  Weiter zu Tabelle →
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    setPaste("");
                    setDirectMessage("Eingabe geleert.");
                  }}
                  type="button"
                >
                  Leeren
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[color:var(--bp-border)] bg-slate-50/40">
            <CardHeader>
              <div className="text-sm font-semibold text-slate-600">Direktimport Hinweise</div>
              <Subhead className="text-slate-500">Kein separater Menüpunkt mehr: Direktimport läuft hier in Upload.</Subhead>
            </CardHeader>
            <CardContent className="grid gap-3">
              <FormatRow
                icon={<FileText className="h-5 w-5" />}
                title="TLV/TSV Reihenfolge"
                desc="Datum, Text, Betrag, Währung, FX, Soll, Haben, MWST-Code, MWST-Konto."
                highlight
              />
              <FormatRow
                icon={<Landmark className="h-5 w-5" />}
                title="Tenant-spezifische MWST"
                desc="MWST-Codes werden je bexio-Mandant aufgelöst (nicht global hartcodiert)."
                highlight
              />
              <FormatRow
                icon={<FileSpreadsheet className="h-5 w-5" />}
                title="Nächster Schritt"
                desc="Nach dem Einfügen direkt in Tabelle prüfen und an bexio senden."
                highlight
              />
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function cleanCell(raw: string): string {
  return (raw ?? "").trim().replace(/^"(.*)"$/, "$1");
}

function normalizeAmount(raw: string): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  // Accept Swiss thousands separators and spacing variants from Excel copy/paste.
  s = s.replace(/[\u00a0\u202f\s]/g, "");
  s = s.replace(/['’`´]/g, "");
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  if (s.includes(".") && s.includes(",")) s = s.replace(/,/g, "");
  return s;
}

function normalizeDate(raw: string): string {
  const s = String(raw ?? "").trim();
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    const rawYear = m[3];
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month}-${day}`;
  }
  return s;
}

function parseDirectImportRows(text: string, defaultCurrency: string, bankAccount: string): DirectImportRow[] {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\u00a0/g, " "))
    .filter((l) => l.length > 0 && l.trim().length > 0);

  return lines.map((line, idx) => {
    const cells = line.split("\t").map(cleanCell);
    const amount = Number(normalizeAmount(cells[2] ?? "0")) || 0;
    const direction: "CRDT" | "DBIT" = amount >= 0 ? "CRDT" : "DBIT";
    const debitAccount = String(cells[5] ?? "").trim();
    const creditAccount = String(cells[6] ?? "").trim();

    return {
      id: `DI${String(idx + 1).padStart(4, "0")}`,
      date: normalizeDate(cells[0] ?? ""),
      description: String(cells[1] ?? ""),
      amount: Math.abs(amount),
      currency: String(cells[3] ?? defaultCurrency).trim() || defaultCurrency,
      fx: Number(normalizeAmount(cells[4] ?? "1")) || 1,
      direction,
      debitAccount,
      creditAccount,
      vatCode: String(cells[7] ?? "").trim(),
      vatAccount: String(cells[8] ?? "").trim() || bankAccount,
    };
  });
}

function FormatRow({
  icon,
  title,
  desc,
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  highlight?: boolean;
}) {
  const base = "rounded-2xl border border-[color:var(--bp-border)] bg-white p-4";
  const focus = highlight ? "ring-1 ring-fuchsia-200 border-fuchsia-200" : "";

  return (
    <div className={[base, focus].join(" ")}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-slate-400">{icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">{title}</div>
            {highlight ? <Badge variant="blue">Enabled</Badge> : null}
          </div>
          <div className="text-sm text-slate-500">{desc}</div>
        </div>
      </div>
    </div>
  );
}
