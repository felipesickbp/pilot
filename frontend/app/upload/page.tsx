"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../components/shell";
import { FlowStepper } from "../components/stepper";
import { Badge, Button, Card, CardContent, CardHeader, Select, Subhead, Input } from "../components/ui";
import { UploadCloud, Landmark, FileText, FileSpreadsheet } from "lucide-react";

type CamtRow = {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  currency: string;
  fx: number;
  direction: "CRDT" | "DBIT";
  debitAccount: string;
  creditAccount: string;
  vatCode: string;
};

const STORAGE_KEY = "bp_pilot_direct_import_rows_v1";
const STORAGE_META_KEY = "bp_pilot_direct_import_meta_v1";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoFromMaybeDdMmYyyy(s: string): string {
  // accepts "2026-02-04" -> return same
  // accepts "04.02.2026" -> return "2026-02-04"
  const t = (s || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return t; // fallback
}

function safeText(x: string | null | undefined) {
  return (x || "").replace(/\s+/g, " ").trim();
}

function textFromNode(root: Element, selectors: string[]): string {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    if (el && el.textContent) {
      const v = safeText(el.textContent);
      if (v) return v;
    }
  }
  return "";
}

function parseCamtXml(xml: string, bankAccount: string): CamtRow[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Invalid XML (parsererror).");
  }

  // CAMT usually has multiple <Ntry>. We take the core:
  // - BookgDt or ValDt for date
  // - Amt + @Ccy
  // - CdtDbtInd for direction
  // - Description: best-effort from known nodes

  const entries = Array.from(doc.getElementsByTagName("Ntry"));
  const rows: CamtRow[] = [];

  for (let i = 0; i < entries.length; i++) {
    const ntry = entries[i];

    const amtEl = ntry.getElementsByTagName("Amt")[0];
    const amount = amtEl?.textContent ? Number(String(amtEl.textContent).replace(",", ".")) : NaN;
    const currency = amtEl?.getAttribute("Ccy") || "CHF";

    const dirEl = ntry.getElementsByTagName("CdtDbtInd")[0];
    const directionRaw = safeText(dirEl?.textContent || "");
    const direction: "CRDT" | "DBIT" = directionRaw === "DBIT" ? "DBIT" : "CRDT";

    // Date: prefer BookgDt/Dt, then ValDt/Dt
    const bookDate = textFromNode(ntry, ["BookgDt > Dt", "BookgDt Dt", "BookgDt/Dt"]);
    const valDate = textFromNode(ntry, ["ValDt > Dt", "ValDt Dt", "ValDt/Dt"]);
    const date = isoFromMaybeDdMmYyyy(bookDate || valDate || "");

    // Description: try best-effort in typical paths
    // - NtryDtls/TxDtls/RmtInf/Ustrd
    // - NtryDtls/TxDtls/AddtlTxInf
    // - AddtlNtryInf
    // - NtryInf
    const tx = ntry.querySelector("NtryDtls TxDtls") as Element | null;
    let description = "";
    if (tx) {
      description =
        textFromNode(tx, [
          "RmtInf > Ustrd",
          "RmtInf Ustrd",
          "RmtInf/Ustrd",
          "AddtlTxInf",
          "RltdPties > Dbtr > Nm",
          "RltdPties > Cdtr > Nm",
          "RltdPties Dbtr Nm",
          "RltdPties Cdtr Nm",
        ]) || "";
    }
    if (!description) {
      description = textFromNode(ntry, ["AddtlNtryInf", "NtryInf"]) || "CAMT entry";
    }

    if (!date || !currency || !Number.isFinite(amount)) {
      // If the CAMT variant is different, you can still keep the row but mark it
      // For now, skip invalid ones to keep demo clean
      continue;
    }

    // Prefill debit/credit with bankAccount depending on direction
    // CRDT (money in): Debit bank, Credit unknown
    // DBIT (money out): Credit bank, Debit unknown
    const debitAccount = direction === "CRDT" ? bankAccount : "";
    const creditAccount = direction === "DBIT" ? bankAccount : "";

    rows.push({
      id: `DI${String(i + 1).padStart(4, "0")}`,
      date,
      description,
      amount,
      currency,
      fx: 1,
      direction,
      debitAccount,
      creditAccount,
      vatCode: "",
    });
  }

  return rows;
}

export default function UploadPage() {
  const router = useRouter();

  const [bankAccount, setBankAccount] = useState("1020");
  const [vatMode, setVatMode] = useState<"with" | "without">("with");
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<CamtRow[] | null>(null);
  const [error, setError] = useState<string>("");

  const summary = useMemo(() => {
    if (!rows) return null;
    const credits = rows.filter((r) => r.direction === "CRDT").length;
    const debits = rows.filter((r) => r.direction === "DBIT").length;
    return { total: rows.length, credits, debits };
  }, [rows]);

  function resetAll() {
    setFileName("");
    setRows(null);
    setError("");
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_META_KEY);
    } catch {}
  }

  async function onPickFile(file: File | null) {
    setError("");
    setRows(null);
    if (!file) return;
    setFileName(file.name);

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xml")) {
      setError("Demo currently supports CAMT.053 XML only. Please upload an .xml file.");
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseCamtXml(text, bankAccount);

      if (!parsed.length) {
        setError("No CAMT entries detected. (This can happen if the bank uses a different CAMT structure.)");
        return;
      }

      setRows(parsed);

      // Store for spreadsheet page
      const meta = {
        source: "camt053",
        fileName: file.name,
        bankAccount,
        vatMode,
        createdAt: new Date().toISOString(),
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      sessionStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta));
    } catch (e: any) {
      setError(e?.message || "Failed to parse CAMT XML.");
    }
  }

  function goSpreadsheet() {
    if (!rows?.length) return;
    router.push("/spreadsheet");
  }

  return (
    <AppShell active="Upload Files">
      <div className="mb-6">
        <div className="text-3xl font-semibold">Upload Transaction Files</div>
        <Subhead>Demo currently supports CAMT.053 (XML) only — we parse in the browser.</Subhead>
      </div>

      <div className="mb-8">
        <FlowStepper active="Upload" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UploadCloud className="h-5 w-5 text-slate-500" />
              CAMT Upload
            </div>
            <Subhead>Select a CAMT.053 XML file and the bank account (GL) used for posting.</Subhead>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Bexio Client (demo)</div>
              <Select defaultValue="muster" disabled>
                <option value="muster">Muster Klient</option>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Bankkonto (GL)</div>
              <Input
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="e.g. 1020"
              />
              <div className="text-xs text-slate-500">
                Used to auto-fill Debit/Credit depending on inflow/outflow.
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">VAT Status (demo)</div>
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="vat"
                    checked={vatMode === "with"}
                    onChange={() => setVatMode("with")}
                  />
                  With VAT <Badge variant="pink">VAT</Badge>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="vat"
                    checked={vatMode === "without"}
                    onChange={() => setVatMode("without")}
                  />
                  Without VAT
                </label>
              </div>
            </div>

            <label className="rounded-2xl border border-dashed border-[color:var(--bp-border)] bg-white p-10 text-center cursor-pointer hover:bg-slate-50">
              <input
                type="file"
                accept=".xml,application/xml,text/xml"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] || null)}
              />
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50">
                <Landmark className="h-5 w-5 text-slate-500" />
              </div>
              <div className="text-sm font-medium">
                {fileName ? `Selected: ${fileName}` : "Click to select a CAMT.053 XML file"}
              </div>
              <div className="mt-1 text-xs text-slate-500">Only .xml for now.</div>
            </label>

            {error ? (
              <div className="rounded-xl border border-pink-200 bg-pink-50 p-3 text-sm text-pink-700">
                {error}
              </div>
            ) : null}

            {summary ? (
              <div className="rounded-xl border border-[color:var(--bp-border)] bg-slate-50 p-3 text-sm">
                <div className="font-semibold">Detected statement entries</div>
                <div className="mt-1 text-slate-600">
                  Total: <span className="font-medium">{summary.total}</span> · Credits (in):{" "}
                  <span className="font-medium">{summary.credits}</span> · Debits (out):{" "}
                  <span className="font-medium">{summary.debits}</span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Next step: Spreadsheet (auto-fills bank account on the correct side).
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Button className="w-full" onClick={goSpreadsheet} disabled={!rows?.length}>
                Continue to Spreadsheet →
              </Button>
              <Button className="w-full" variant="outline" onClick={resetAll}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Less prominent formats card */}
        <Card className="border border-[color:var(--bp-border)] bg-slate-50/40">
          <CardHeader>
            <div className="text-sm font-semibold text-slate-600">Supported File Formats</div>
            <Subhead className="text-slate-500">
              Demo currently supports <span className="font-medium">CAMT.053 (XML)</span> only.
            </Subhead>
          </CardHeader>
          <CardContent className="grid gap-3">
            <FormatRow
              icon={<FileText className="h-5 w-5" />}
              title="CSV Files"
              desc="Comma-separated values with standard transaction columns"
              disabled
            />
            <FormatRow
              icon={<FileSpreadsheet className="h-5 w-5" />}
              title="Excel Files"
              desc="XLSX and XLS spreadsheets with transaction data"
              disabled
            />
            <FormatRow
              icon={<FileText className="h-5 w-5" />}
              title="PDF Files"
              desc="Bank statements and transaction reports in PDF format"
              disabled
            />
            <FormatRow
              icon={<Landmark className="h-5 w-5" />}
              title="CAMT.053"
              desc="ISO 20022 bank statement format for automated processing (demo: XML parsing in browser)"
              highlight
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function FormatRow({
  icon,
  title,
  desc,
  disabled,
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  disabled?: boolean;
  highlight?: boolean;
}) {
  const base = "rounded-2xl border border-[color:var(--bp-border)] bg-white p-4";
  const dim = disabled ? "opacity-45 grayscale" : "";
  const focus = highlight ? "ring-1 ring-fuchsia-200 border-fuchsia-200" : "";

  return (
    <div className={[base, dim, focus].join(" ")}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-slate-400">{icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">{title}</div>
            {highlight ? <Badge variant="blue">Enabled</Badge> : null}
            {disabled ? <span className="text-xs text-slate-500">Soon</span> : null}
          </div>
          <div className="text-sm text-slate-500">{desc}</div>
        </div>
      </div>
    </div>
  );
}
