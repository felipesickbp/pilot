"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../components/shell";
import { FlowStepper } from "../components/stepper";
import { Badge, Button, Card, CardContent, CardHeader, Select, Subhead } from "../components/ui";
import {
  IMPORT_CONTEXT_KEY,
  PREVIEW_META_KEY,
  PREVIEW_ROWS_KEY,
  type ImportContext,
  type ParsedTableCandidate,
  type PreviewMapping,
  buildMappingForTemplate,
  buildPresetMapping,
  normalizeRows,
  safeText,
} from "../importer";

export default function PreviewPage() {
  const router = useRouter();

  const [ctx, setCtx] = useState<ImportContext | null>(null);
  const [mapping, setMapping] = useState<PreviewMapping | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(IMPORT_CONTEXT_KEY);
      if (!raw) {
        setError("No uploaded file context found. Please go back to Upload.");
        return;
      }

      const parsed = JSON.parse(raw) as ImportContext;
      setCtx(parsed);

      const first = parsed.candidates?.[0];
      if (!first) {
        setError("No table candidates found.");
        return;
      }

      setMapping(buildPresetMapping(parsed, first));
    } catch {
      setError("Failed to load preview context.");
    }
  }, []);

  const candidate = useMemo<ParsedTableCandidate | null>(() => {
    if (!ctx || !mapping) return null;
    return ctx.candidates.find((c) => c.id === mapping.candidateId) || ctx.candidates[0] || null;
  }, [ctx, mapping]);

  const normalizedRows = useMemo(() => {
    if (!ctx || !mapping || !candidate) return [];
    return normalizeRows(ctx, candidate, mapping);
  }, [ctx, mapping, candidate]);

  function patchMapping<K extends keyof PreviewMapping>(key: K, value: PreviewMapping[K]) {
    if (!mapping) return;
    setMapping({ ...mapping, [key]: value });
  }

  function toggleTextColumn(col: string) {
    if (!mapping) return;
    const exists = mapping.textColumns.includes(col);
    patchMapping(
      "textColumns",
      exists ? mapping.textColumns.filter((x) => x !== col) : [...mapping.textColumns, col]
    );
  }

  function applyTemplate(template: PreviewMapping["bankTemplate"]) {
    if (!ctx || !candidate) return;
    const next = buildMappingForTemplate(ctx, candidate, template);
    setMapping(next);
  }

  function onCandidateChange(nextCandidateId: string) {
    if (!ctx) return;
    const nextCandidate = ctx.candidates.find((c) => c.id === nextCandidateId);
    if (!nextCandidate) return;

    const template = mapping?.bankTemplate || buildPresetMapping(ctx, nextCandidate).bankTemplate;
    const next = buildMappingForTemplate(ctx, nextCandidate, template);
    setMapping(next);
  }

  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!mapping) return { errors, warnings };

    if (!mapping.dateColumn) errors.push("Select a date column.");
    if (!mapping.textColumns.length) errors.push("Select at least one posting text column.");

    if (mapping.amountMode === "single") {
      if (!mapping.amountColumn) errors.push("Select an amount column.");
    } else {
      if (!mapping.debitColumn && !mapping.creditColumn && !mapping.fallbackAmountColumn) {
        errors.push("For split mode, map debit and/or credit, or provide a fallback amount column.");
      }
    }

    if (!normalizedRows.length) {
      errors.push("Mapping currently produces no rows.");
      return { errors, warnings };
    }

    const dateCount = normalizedRows.filter((r) => !!safeText(r.date)).length;
    const amountCount = normalizedRows.filter((r) => Number(r.amount) !== 0).length;
    const descCount = normalizedRows.filter(
      (r) => !!safeText(r.description) && !/^Row \d+$/i.test(safeText(r.description))
    ).length;

    if (dateCount === 0) errors.push("No parsed dates found in normalized rows.");
    if (amountCount === 0) errors.push("No non-zero amounts found in normalized rows.");
    if (descCount === 0) errors.push("No usable descriptions found in normalized rows.");

    const dateRate = dateCount / normalizedRows.length;
    const amountRate = amountCount / normalizedRows.length;
    if (dateRate < 0.7) warnings.push(`Only ${Math.round(dateRate * 100)}% rows have a parsed date.`);
    if (amountRate < 0.7) warnings.push(`Only ${Math.round(amountRate * 100)}% rows have a non-zero amount.`);

    const ambiguousCount = normalizedRows.filter((r) => r.amountDiagnostics?.ambiguousBothSides).length;
    const fallbackCount = normalizedRows.filter((r) => r.amountDiagnostics?.usedFallback).length;
    const inheritedCount = normalizedRows.filter((r) => r.amountDiagnostics?.summaryInheritedSign).length;
    if (ambiguousCount > 0) {
      warnings.push(
        `${ambiguousCount} row(s) had both debit and credit values; amount was derived by netting credit - debit.`
      );
    }
    if (fallbackCount > 0) {
      warnings.push(`${fallbackCount} row(s) used fallback amount column.`);
    }
    if (inheritedCount > 0) {
      warnings.push(
        `${inheritedCount} UBS fallback row(s) inherited sign from prior summary booking.`
      );
    }

    return { errors, warnings };
  }, [mapping, normalizedRows]);

  const canContinue = validation.errors.length === 0 && normalizedRows.length > 0;

  function goCleanup() {
    if (!ctx || !mapping || !normalizedRows.length) return;

    sessionStorage.setItem(PREVIEW_ROWS_KEY, JSON.stringify(normalizedRows));
    sessionStorage.setItem(
      PREVIEW_META_KEY,
      JSON.stringify({
        fileName: ctx.fileName,
        fileType: ctx.fileType,
        bankAccount: ctx.bankAccount,
        vatMode: ctx.vatMode,
        createdAt: new Date().toISOString(),
        mapping,
      })
    );

    router.push("/cleanup");
  }

  if (error) {
    return (
      <AppShell active="Upload Files">
        <div className="mb-8">
          <FlowStepper active="Preview" />
        </div>
        <div className="rounded-xl border border-pink-200 bg-pink-50 p-4 text-sm text-pink-700">
          {error}
        </div>
        <div className="mt-4">
          <Button onClick={() => router.push("/upload")}>← Back to Upload</Button>
        </div>
      </AppShell>
    );
  }

  // Safe initial render for Next build / prerender
  if (!ctx || !mapping || !candidate) {
    return (
      <AppShell active="Upload Files">
        <div className="mb-6">
          <div className="text-3xl font-semibold">Preview & Column Mapping</div>
          <Subhead>Loading preview context…</Subhead>
        </div>

        <div className="mb-8">
          <FlowStepper active="Preview" />
        </div>

        <div className="rounded-xl border border-[color:var(--bp-border)] bg-white p-6 text-sm text-slate-500">
          Waiting for uploaded file context. If this persists, go back to Upload.
        </div>

        <div className="mt-4">
          <Button onClick={() => router.push("/upload")}>← Back to Upload</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="Upload Files">
      <div className="mb-6">
        <div className="text-3xl font-semibold">Preview & Column Mapping</div>
        <Subhead>
          Choose the right candidate, then map date, text, amount, and currency before Cleanup.
        </Subhead>
      </div>

      <div className="mb-8">
        <FlowStepper active="Preview" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Mapping Wizard</div>
            <Subhead>Flexible mapping for different bank formats.</Subhead>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Table Candidate</div>
              <Select value={mapping.candidateId} onChange={(e) => onCandidateChange(e.target.value)}>
                {ctx.candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <div className="text-xs text-slate-500">{candidate.reason}</div>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Bank Template</div>
              <Select
                value={mapping.bankTemplate}
                onChange={(e) =>
                  applyTemplate(e.target.value as PreviewMapping["bankTemplate"])
                }
              >
                <option value="generic">Generic</option>
                <option value="ubs">UBS / split + Einzelbetrag fallback</option>
                <option value="clientis">Clientis / headerless export</option>
                <option value="acrevis">Acrevis</option>
                <option value="split_generic">Generic split debit/credit</option>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Date Column</div>
              <Select
                value={mapping.dateColumn}
                onChange={(e) => patchMapping("dateColumn", e.target.value)}
              >
                <option value="">— select —</option>
                {candidate.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Currency Column (optional)</div>
              <Select
                value={mapping.currencyColumn}
                onChange={(e) => patchMapping("currencyColumn", e.target.value)}
              >
                <option value="">— none (default CHF) —</option>
                {candidate.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Posting Text Columns</div>
              <div className="max-h-40 overflow-auto rounded-xl border border-[color:var(--bp-border)] p-3">
                {candidate.headers.map((h) => (
                  <label key={h} className="mb-2 flex items-center gap-2 text-sm last:mb-0">
                    <input
                      type="checkbox"
                      checked={mapping.textColumns.includes(h)}
                      onChange={() => toggleTextColumn(h)}
                    />
                    <span>{h}</span>
                    <span className="text-xs text-slate-500">
                      ({safeText(candidate.rows?.[0]?.[h] || "") || "—"})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Amount Structure</div>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="amount_mode"
                    checked={mapping.amountMode === "single"}
                    onChange={() => patchMapping("amountMode", "single")}
                  />
                  Single signed amount column
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="amount_mode"
                    checked={mapping.amountMode === "split"}
                    onChange={() => patchMapping("amountMode", "split")}
                  />
                  Split columns (Belastung / Gutschrift)
                </label>
              </div>
            </div>

            {mapping.amountMode === "single" ? (
              <>
                <div className="grid gap-2">
                  <div className="text-xs font-semibold text-slate-600">Amount Column</div>
                  <Select
                    value={mapping.amountColumn}
                    onChange={(e) => patchMapping("amountColumn", e.target.value)}
                  >
                    <option value="">— select —</option>
                    {candidate.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid gap-2">
                  <div className="text-xs font-semibold text-slate-600">Sign Handling</div>
                  <Select
                    value={mapping.signMode}
                    onChange={(e) =>
                      patchMapping(
                        "signMode",
                        e.target.value as PreviewMapping["signMode"]
                      )
                    }
                  >
                    <option value="as_is">Use sign as-is</option>
                    <option value="debit_positive">Positive values are outflows</option>
                    <option value="invert">Invert all signs</option>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-2">
                  <div className="text-xs font-semibold text-slate-600">Belastung (outflow)</div>
                  <Select
                    value={mapping.debitColumn}
                    onChange={(e) => patchMapping("debitColumn", e.target.value)}
                  >
                    <option value="">— select —</option>
                    {candidate.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid gap-2">
                  <div className="text-xs font-semibold text-slate-600">Gutschrift (inflow)</div>
                  <Select
                    value={mapping.creditColumn}
                    onChange={(e) => patchMapping("creditColumn", e.target.value)}
                  >
                    <option value="">— select —</option>
                    {candidate.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid gap-2">
                  <div className="text-xs font-semibold text-slate-600">
                    Fallback Amount (optional)
                  </div>
                  <Select
                    value={mapping.fallbackAmountColumn}
                    onChange={(e) => patchMapping("fallbackAmountColumn", e.target.value)}
                  >
                    <option value="">— none —</option>
                    {candidate.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                  <div className="text-xs text-slate-500">
                    Useful for UBS Sammelbuchungen where child rows use Einzelbetrag.
                  </div>
                </div>
              </>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mapping.dropSummaryRows}
                onChange={(e) => patchMapping("dropSummaryRows", e.target.checked)}
              />
              Drop summary booking rows (e.g. Sammelauftrag parent row)
            </label>

            {validation.errors.length > 0 ? (
              <div className="rounded-xl border border-pink-200 bg-pink-50 p-3 text-xs text-pink-700">
                {validation.errors.map((e, i) => (
                  <div key={`${e}-${i}`}>• {e}</div>
                ))}
              </div>
            ) : null}

            {validation.warnings.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {validation.warnings.map((w, i) => (
                  <div key={`${w}-${i}`}>• {w}</div>
                ))}
              </div>
            ) : null}

            <Button className="w-full" onClick={goCleanup} disabled={!canContinue}>
              Continue to Cleanup →
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Normalized Preview</div>
            <Subhead>
              {normalizedRows.length} rows after mapping. This is what goes into Cleanup.
            </Subhead>
          </CardHeader>

          <CardContent>
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <Badge variant="blue">{ctx.fileType.toUpperCase()}</Badge>
              <Badge variant="pink">{mapping.bankTemplate}</Badge>
              <Badge variant="blue">{mapping.amountMode}</Badge>
            </div>

            <div className="overflow-auto rounded-xl border border-[color:var(--bp-border)] bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-left">Amount</th>
                    <th className="p-3 text-left">Currency</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Amount Rule</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {normalizedRows.slice(0, 25).map((r) => (
                    <tr key={r.id} className="border-t border-[color:var(--bp-border)]">
                      <td className="p-3">{r.date || "—"}</td>
                      <td className="p-3">{r.description || "—"}</td>
                      <td className="p-3">
                        <Badge variant="pink">{r.amount.toFixed(2)}</Badge>
                      </td>
                      <td className="p-3">{r.currency || "CHF"}</td>
                      <td className="p-3">
                        {r.direction === "CRDT" ? (
                          <Badge variant="blue">CRDT</Badge>
                        ) : (
                          <Badge variant="pink">DBIT</Badge>
                        )}
                      </td>
                      <td className="p-3 text-xs">
                        <div className="flex flex-wrap gap-1">
                          {r.amountDiagnostics?.ambiguousBothSides ? (
                            <Badge variant="pink">ambiguous split</Badge>
                          ) : null}
                          {r.amountDiagnostics?.usedDebit ? <Badge variant="blue">debit</Badge> : null}
                          {r.amountDiagnostics?.usedCredit ? <Badge variant="blue">credit</Badge> : null}
                          {r.amountDiagnostics?.usedFallback ? <Badge variant="blue">fallback</Badge> : null}
                          {r.amountDiagnostics?.summaryInheritedSign ? (
                            <Badge variant="pink">summary sign</Badge>
                          ) : null}
                          {!r.amountDiagnostics?.usedDebit &&
                          !r.amountDiagnostics?.usedCredit &&
                          !r.amountDiagnostics?.usedFallback ? (
                            <span className="text-slate-400">direct/single</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!normalizedRows.length ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        No rows produced yet. Adjust the mapping on the left.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
