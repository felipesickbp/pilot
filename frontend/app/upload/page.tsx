"use client";

import React, { useMemo, useState } from "react";
import { AppShell } from "../components/shell";
import { FlowStepper } from "../components/stepper";
import { Badge, Button, Card, CardContent, CardHeader, Select, Subhead, Input } from "../components/ui";
import { UploadCloud, FileSpreadsheet } from "lucide-react";

type Candidate = {
  id: string;
  encoding: string;
  delimiter: string;
  header_row: number;
  data_start_row: number;
  headers_normalized: string[];
  header_signature: string;
  preview_rows: Record<string, any>[];
  reason?: string;
  confidence?: number;
};

type PreviewParseResponse = {
  rows_ok: number;
  rows_error: number;
  errors: any[];
  transactions?: any[];
  postings_draft?: any[];
  meta?: any;
};

function asText(x: any) {
  if (x == null) return "";
  return String(x);
}

export default function UploadPage() {
  const [bankAccount, setBankAccount] = useState("1020");
  const [vatEnabled, setVatEnabled] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");

  const [loading, setLoading] = useState(false);
  const [statusLine, setStatusLine] = useState<string>("");

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateId, setCandidateId] = useState<string>("");

  // Mapping fields
  const [dateCol, setDateCol] = useState<string>("");
  const [textCol, setTextCol] = useState<string>("");

  const [amountMode, setAmountMode] = useState<"signed" | "debit_credit">("debit_credit");
  const [signedAmountCol, setSignedAmountCol] = useState<string>("");
  const [debitCol, setDebitCol] = useState<string>("");
  const [creditCol, setCreditCol] = useState<string>("");

  const [balanceCol, setBalanceCol] = useState<string>("");

  const [backendError, setBackendError] = useState<string>("");
  const [preview, setPreview] = useState<PreviewParseResponse | null>(null);

  const selectedCandidate = useMemo(() => {
    return candidates.find((c) => c.id === candidateId) || null;
  }, [candidates, candidateId]);

  const headers = useMemo(() => {
    return selectedCandidate?.headers_normalized || [];
  }, [selectedCandidate]);

  const canPreviewParse = useMemo(() => {
    if (!file) return false;
    if (!selectedCandidate) return false;
    if (!dateCol) return false;
    if (!textCol) return false;
    if (amountMode === "signed") return !!signedAmountCol;
    return !!debitCol && !!creditCol;
  }, [file, selectedCandidate, dateCol, textCol, amountMode, signedAmountCol, debitCol, creditCol]);

  function resetAll() {
    setFile(null);
    setFileName("");
    setCandidates([]);
    setCandidateId("");
    setDateCol("");
    setTextCol("");
    setAmountMode("debit_credit");
    setSignedAmountCol("");
    setDebitCol("");
    setCreditCol("");
    setBalanceCol("");
    setBackendError("");
    setPreview(null);
    setStatusLine("");
  }

  async function onPickFile(f: File | null) {
    resetAll();
    if (!f) return;
    setFile(f);
    setFileName(f.name);

    setLoading(true);
    setStatusLine("Working… (upload / analyze candidates)");
    setBackendError("");

    try {
      const fd = new FormData();
      fd.append("file", f);

      const res = await fetch("/api/imports/analyze-candidates", {
        method: "POST",
        body: fd,
      });

      const text = await res.text();
      if (!res.ok) {
        setBackendError(`analyze-candidates failed (${res.status}): ${text.slice(0, 2000)}`);
        setLoading(false);
        setStatusLine("");
        return;
      }

      const data = JSON.parse(text);
      const cand: Candidate[] = data?.candidates || data || [];
      setCandidates(cand);

      if (cand.length) {
        setCandidateId(cand[0].id);

        const h = cand[0].headers_normalized || [];
        const pick = (names: string[]) => h.find((x) => names.includes(x)) || "";

        setDateCol(pick(["datum", "date", "buchungsdatum", "booking_date", "valuta"]) || "");
        setTextCol(pick(["avisierungstext", "text", "beschreibung", "description", "verwendungszweck"]) || "");

        // Debit/Credit defaults (Swiss exports)
        const d = pick(["lastschrift_in_chf", "debit", "belastung", "soll", "lastschrift"]);
        const c = pick(["gutschrift_in_chf", "credit", "gutschrift", "haben"]);
        setDebitCol(d);
        setCreditCol(c);

        // Signed fallback
        setSignedAmountCol(pick(["amount", "betrag", "betrag_in_chf", "signed_amount", "credit_debit_amount"]));

        setBalanceCol(pick(["saldo_in_chf", "balance", "saldo"]));
      }
    } catch (e: any) {
      setBackendError(e?.message || "Failed to analyze candidates.");
    } finally {
      setLoading(false);
      setStatusLine("");
    }
  }

  function buildTemplateJson(): string {
    if (!selectedCandidate) throw new Error("No candidate selected");

    const nowIso = new Date().toISOString();

    const input = {
      kind: "csv",
      csv: {
        delimiter: selectedCandidate.delimiter,
        encoding: selectedCandidate.encoding,
        decimal_separator: "auto",
        thousands_separator: "auto",
        trim_cells: true,
        drop_empty_trailing_columns: true,
      },
      table: {
        header_row: selectedCandidate.header_row,
        data_start_row: selectedCandidate.data_start_row,
      },
    };

    // IMPORTANT: align exactly with backend MappingTemplateV1
    const mappingFields: any = {
      booking_date: { kind: "column", select: { by_header_normalized: dateCol } },
      text: {
        kind: "compose",
        sources: [{ kind: "column", select: { by_header_normalized: textCol } }],
      },
      amount:
        amountMode === "signed"
          ? {
              kind: "signed_column",
              column: { kind: "column", select: { by_header_normalized: signedAmountCol } },
            }
          : {
              kind: "debit_credit_columns",
              debit: { kind: "column", select: { by_header_normalized: debitCol } },
              credit: { kind: "column", select: { by_header_normalized: creditCol } },
            },
    };

    if (balanceCol) {
      mappingFields.balance = { kind: "column", select: { by_header_normalized: balanceCol } };
    }

    const template = {
      schema_version: "mapping_template_v1",
      template_id: `wizard-${selectedCandidate.header_signature}`,
      name: `Wizard template (${fileName || "upload"})`,
      created_at: nowIso,
      updated_at: nowIso,
      is_active: true,
      fingerprint: {
        method: "header_signature_v1",
        header_signature: selectedCandidate.header_signature,
        columns_normalized: selectedCandidate.headers_normalized,
        column_count: selectedCandidate.headers_normalized.length,
      },
      input,
      mapping: { fields: mappingFields },
      validation: {
        date_formats: ["yyyy-mm-dd", "dd.mm.yyyy", "dd.mm.yy"],
        max_parse_errors_before_fail: 0,
      },
      preprocessing: {
        explode_compound_rows: true,
      },
    };

    return JSON.stringify(template);
  }

  async function onPreviewParse() {
    if (!file || !selectedCandidate) return;
    setLoading(true);
    setStatusLine("Working… (preview parse)");
    setBackendError("");
    setPreview(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("template_json", buildTemplateJson());
      fd.append("bank_account_gl", bankAccount);
      fd.append("vat_enabled", String(vatEnabled));

      const res = await fetch("/api/imports/preview-parse", {
        method: "POST",
        body: fd,
      });

      const text = await res.text();
      if (!res.ok) {
        setBackendError(`preview-parse failed (${res.status}): ${text.slice(0, 4000)}`);
        setLoading(false);
        setStatusLine("");
        return;
      }

      const data: PreviewParseResponse = JSON.parse(text);
      setPreview(data);
    } catch (e: any) {
      setBackendError(e?.message || "Failed to preview-parse.");
    } finally {
      setLoading(false);
      setStatusLine("");
    }
  }

  return (
    <AppShell active="Upload Files">
      <div className="mb-6">
        <div className="text-3xl font-semibold">Upload Transaction Files</div>
        <Subhead>Upload CSV or Excel (XLSX). We detect table candidates and let you map columns.</Subhead>
      </div>

      <div className="mb-8">
        <FlowStepper active="Upload" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UploadCloud className="h-5 w-5 text-slate-500" />
              Upload & Mapping Wizard
            </div>
            <Subhead>Pick a file, select the correct table candidate, then map key columns.</Subhead>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Bankkonto (GL)</div>
              <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
              <div className="text-xs text-slate-500">Used for draft debit/credit (optional).</div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={vatEnabled} onChange={(e) => setVatEnabled(e.target.checked)} />
              VAT enabled <span className="text-xs text-slate-500">(Output VAT fields later)</span>
            </label>

            <label className="rounded-2xl border border-dashed border-[color:var(--bp-border)] bg-white p-8 text-center cursor-pointer hover:bg-slate-50">
              <input
                type="file"
                accept=".csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] || null)}
              />
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50">
                <FileSpreadsheet className="h-5 w-5 text-slate-500" />
              </div>
              <div className="text-sm font-medium">{fileName ? `Selected: ${fileName}` : "Click to select CSV / XLSX"}</div>
              <div className="mt-1 text-xs text-slate-500">We detect candidates and map columns to a template.</div>
            </label>

            {statusLine ? (
              <div className="rounded-xl border border-[color:var(--bp-border)] bg-slate-50 p-3 text-sm">{statusLine}</div>
            ) : null}

            {backendError ? (
              <div className="rounded-xl border border-pink-200 bg-pink-50 p-3 text-xs text-pink-700 whitespace-pre-wrap">
                {backendError}
              </div>
            ) : null}

            {candidates.length ? (
              <>
                <div className="grid gap-2">
                  <div className="text-xs font-semibold text-slate-600">Table Candidate</div>
                  <Select value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
                    {candidates.map((c, idx) => (
                      <option key={c.id} value={c.id}>
                        #{idx + 1} · header_row {c.header_row} · conf {Math.round((c.confidence || 1) * 100)}%
                      </option>
                    ))}
                  </Select>
                  <div className="text-xs text-slate-500">
                    Pick a candidate where headers look like words (e.g. <code>datum</code>, <code>avisierungstext</code>), not values like <code>03_09_2025</code>.
                  </div>
                  {selectedCandidate?.reason ? <div className="text-xs text-slate-500">Reason: {selectedCandidate.reason}</div> : null}
                </div>

                <div className="grid gap-2 pt-2">
                  <div className="text-xs font-semibold text-slate-600">Column Mapping</div>
                  <Subhead>Map key fields (date, text, amount). This creates a template.</Subhead>

                  <div className="grid gap-2">
                    <div className="text-xs font-semibold text-slate-600">Date column</div>
                    <Select value={dateCol} onChange={(e) => setDateCol(e.target.value)}>
                      <option value="">— select —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <div className="text-xs font-semibold text-slate-600">Text column</div>
                    <Select value={textCol} onChange={(e) => setTextCol(e.target.value)}>
                      <option value="">— select —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <div className="text-xs font-semibold text-slate-600">Amount mode</div>
                    <div className="flex items-center gap-4 text-sm">
                      <label className="flex items-center gap-2">
                        <input checked={amountMode === "debit_credit"} type="radio" onChange={() => setAmountMode("debit_credit")} />
                        Debit + Credit columns
                      </label>
                      <label className="flex items-center gap-2">
                        <input checked={amountMode === "signed"} type="radio" onChange={() => setAmountMode("signed")} />
                        Signed amount column (+/-)
                      </label>
                    </div>
                  </div>

                  {amountMode === "signed" ? (
                    <div className="grid gap-2">
                      <div className="text-xs font-semibold text-slate-600">Signed amount column</div>
                      <Select value={signedAmountCol} onChange={(e) => setSignedAmountCol(e.target.value)}>
                        <option value="">— select —</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      <div className="grid gap-2">
                        <div className="text-xs font-semibold text-slate-600">Debit column (outflow)</div>
                        <Select value={debitCol} onChange={(e) => setDebitCol(e.target.value)}>
                          <option value="">— select —</option>
                          {headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <div className="text-xs font-semibold text-slate-600">Credit column (inflow)</div>
                        <Select value={creditCol} onChange={(e) => setCreditCol(e.target.value)}>
                          <option value="">— select —</option>
                          {headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <div className="text-xs font-semibold text-slate-600">Balance (optional)</div>
                    <Select value={balanceCol} onChange={(e) => setBalanceCol(e.target.value)}>
                      <option value="">— none —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button className="w-full" onClick={onPreviewParse} disabled={!canPreviewParse || loading}>
                      Preview Parse →
                    </Button>
                    <Button className="w-full" variant="outline" onClick={resetAll} disabled={loading}>
                      Reset
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Candidate Preview</div>
            <Subhead>What the backend thinks is the main transaction table.</Subhead>
          </CardHeader>

          <CardContent className="grid gap-4">
            {selectedCandidate ? (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="blue">encoding: {selectedCandidate.encoding}</Badge>
                  <Badge variant="blue">delimiter: {selectedCandidate.delimiter}</Badge>
                  <Badge variant="pink">header_row: {selectedCandidate.header_row}</Badge>
                  <Badge variant="pink">data_start: {selectedCandidate.data_start_row}</Badge>
                </div>

                <div className="overflow-auto rounded-xl border border-[color:var(--bp-border)] bg-white">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        {selectedCandidate.headers_normalized.slice(0, 10).map((h) => (
                          <th key={h} className="p-2 text-left whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-slate-700">
                      {(selectedCandidate.preview_rows || []).slice(0, 12).map((r, i) => (
                        <tr key={i} className="border-t border-[color:var(--bp-border)]">
                          {selectedCandidate.headers_normalized.slice(0, 10).map((h) => (
                            <td key={h} className="p-2 align-top whitespace-pre-wrap">
                              {asText(r?.[h])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">Upload a file to see candidates.</div>
            )}

            {preview ? (
              <div className="rounded-xl border border-[color:var(--bp-border)] bg-slate-50 p-3 text-sm">
                <div className="font-semibold">Preview Parse Result</div>
                <div className="mt-1 text-slate-700">
                  rows_ok: <span className="font-medium">{preview.rows_ok}</span> · rows_error:{" "}
                  <span className="font-medium">{preview.rows_error}</span>
                </div>
                {preview.rows_error ? (
                  <div className="mt-2 text-xs text-slate-600">
                    First error:
                    <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(preview.errors?.[0], null, 2)}</pre>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-slate-600">Looks good — next step can be cleanup/spreadsheet.</div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
