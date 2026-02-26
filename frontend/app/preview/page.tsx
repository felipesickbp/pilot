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
  const [useAutoTextColumns, setUseAutoTextColumns] = useState(true);
  const [showRawPreview, setShowRawPreview] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(IMPORT_CONTEXT_KEY);
      if (!raw) {
        setError("Kein Upload-Kontext gefunden. Bitte zurück zu Upload.");
        return;
      }

      const parsed = JSON.parse(raw) as ImportContext;
      setCtx(parsed);

      const first = parsed.candidates?.[0];
      if (!first) {
        setError("Keine Tabellen-Kandidaten gefunden.");
        return;
      }

      setMapping(buildPresetMapping(parsed, first));
      setUseAutoTextColumns(true);
    } catch {
      setError("Preview-Kontext konnte nicht geladen werden.");
    }
  }, []);

  const candidate = useMemo<ParsedTableCandidate | null>(() => {
    if (!ctx || !mapping) return null;
    return ctx.candidates.find((c) => c.id === mapping.candidateId) || ctx.candidates[0] || null;
  }, [ctx, mapping]);

  const autoTextColumns = useMemo(() => {
    if (!ctx || !mapping || !candidate) return [] as string[];
    const preset = buildMappingForTemplate(ctx, candidate, mapping.bankTemplate);
    return preset.textColumns;
  }, [ctx, mapping, candidate]);

  const effectiveMapping = useMemo(() => {
    if (!mapping) return null;
    return {
      ...mapping,
      textColumns: useAutoTextColumns ? autoTextColumns : mapping.textColumns,
    };
  }, [mapping, useAutoTextColumns, autoTextColumns]);

  const normalizedRows = useMemo(() => {
    if (!ctx || !effectiveMapping || !candidate) return [];
    return normalizeRows(ctx, candidate, effectiveMapping);
  }, [ctx, effectiveMapping, candidate]);

  const rawColumns = useMemo(() => {
    if (!candidate || !effectiveMapping) return [] as string[];
    const preferred = [
      effectiveMapping.dateColumn,
      effectiveMapping.amountColumn,
      effectiveMapping.debitColumn,
      effectiveMapping.creditColumn,
      effectiveMapping.fallbackAmountColumn,
      effectiveMapping.currencyColumn,
      ...effectiveMapping.textColumns,
    ].filter(Boolean);

    const unique: string[] = [];
    for (const col of preferred) {
      if (candidate.headers.includes(col) && !unique.includes(col)) unique.push(col);
    }
    for (const col of candidate.headers) {
      if (unique.length >= 10) break;
      if (!unique.includes(col)) unique.push(col);
    }
    return unique;
  }, [candidate, effectiveMapping]);

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

  function applyPreset(template: PreviewMapping["bankTemplate"]) {
    if (!ctx || !candidate) return;
    const next = buildMappingForTemplate(ctx, candidate, template);
    setMapping(next);
    setUseAutoTextColumns(true);
  }

  function onCandidateChange(nextCandidateId: string) {
    if (!ctx) return;
    const nextCandidate = ctx.candidates.find((c) => c.id === nextCandidateId);
    if (!nextCandidate) return;

    const template = mapping?.bankTemplate || buildPresetMapping(ctx, nextCandidate).bankTemplate;
    const next = buildMappingForTemplate(ctx, nextCandidate, template);
    setMapping(next);
    setUseAutoTextColumns(true);
  }

  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!effectiveMapping) return { errors, warnings };

    if (!effectiveMapping.dateColumn) errors.push("Bitte eine Datums-Spalte auswählen.");
    if (!effectiveMapping.textColumns.length) {
      errors.push("Bitte mindestens eine Text-Spalte auswählen (oder automatische Erkennung aktivieren).");
    }

    if (effectiveMapping.amountMode === "single") {
      if (!effectiveMapping.amountColumn) errors.push("Bitte eine Betrags-Spalte auswählen.");
    } else {
      if (!effectiveMapping.debitColumn && !effectiveMapping.creditColumn && !effectiveMapping.fallbackAmountColumn) {
        errors.push("Für Soll/Haben-Modus bitte Belastung/Gutschrift oder eine Fallback-Betragsspalte mappen.");
      }
    }

    if (!normalizedRows.length) {
      errors.push("Das aktuelle Mapping erzeugt keine Zeilen.");
      return { errors, warnings };
    }

    const dateCount = normalizedRows.filter((r) => !!safeText(r.date)).length;
    const amountCount = normalizedRows.filter((r) => Number(r.amount) > 0).length;
    const descCount = normalizedRows.filter(
      (r) => !!safeText(r.description) && !/^Row \d+$/i.test(safeText(r.description))
    ).length;

    if (dateCount === 0) errors.push("Keine erkennbaren Datumswerte in den normalisierten Zeilen.");
    if (amountCount === 0) errors.push("Keine Beträge ungleich 0 in den normalisierten Zeilen.");
    if (descCount === 0) errors.push("Keine verwendbaren Buchungstexte in den normalisierten Zeilen.");

    const dateRate = dateCount / normalizedRows.length;
    const amountRate = amountCount / normalizedRows.length;
    if (dateRate < 0.7) warnings.push(`Nur ${Math.round(dateRate * 100)}% der Zeilen haben ein erkanntes Datum.`);
    if (amountRate < 0.7) warnings.push(`Nur ${Math.round(amountRate * 100)}% der Zeilen haben einen Betrag ungleich 0.`);

    const ambiguousCount = normalizedRows.filter((r) => r.amountDiagnostics?.ambiguousBothSides).length;
    const fallbackCount = normalizedRows.filter((r) => r.amountDiagnostics?.usedFallback).length;
    const inheritedCount = normalizedRows.filter((r) => r.amountDiagnostics?.summaryInheritedSign).length;
    if (ambiguousCount > 0) {
      warnings.push(
        `${ambiguousCount} Zeile(n) hatten Belastung und Gutschrift gleichzeitig; Betrag wurde als Gutschrift minus Belastung berechnet.`
      );
    }
    if (fallbackCount > 0) {
      warnings.push(`${fallbackCount} Zeile(n) verwenden die Fallback-Betragsspalte.`);
    }
    if (inheritedCount > 0) {
      warnings.push(
        `${inheritedCount} Zeile(n) haben das Vorzeichen aus einer Sammelbuchung übernommen.`
      );
    }

    return { errors, warnings };
  }, [effectiveMapping, normalizedRows]);

  const canContinue = validation.errors.length === 0 && normalizedRows.length > 0;

  const templateLabel =
    (mapping?.bankTemplate || "generic") === "generic"
      ? "Generisch"
      : (mapping?.bankTemplate || "generic") === "split_generic"
        ? "Generisch Split"
        : (mapping?.bankTemplate || "generic") === "clientis"
          ? "Clientis"
          : (mapping?.bankTemplate || "generic") === "ubs"
            ? "UBS"
            : "Acrevis";

  const amountModeLabel = (mapping?.amountMode || "single") === "split" ? "Belastung/Gutschrift" : "Einzelspalte";

  function goCleanup() {
    if (!ctx || !effectiveMapping || !normalizedRows.length) return;

    sessionStorage.setItem(PREVIEW_ROWS_KEY, JSON.stringify(normalizedRows));
    sessionStorage.setItem(
      PREVIEW_META_KEY,
      JSON.stringify({
        fileName: ctx.fileName,
        fileType: ctx.fileType,
        bankAccount: ctx.bankAccount,
        vatMode: ctx.vatMode,
        createdAt: new Date().toISOString(),
        mapping: effectiveMapping,
      })
    );

    router.push("/cleanup");
  }

  if (error) {
    return (
      <AppShell active="Upload">
        <div className="mb-8">
          <FlowStepper active="Preview" />
        </div>
        <div className="rounded-xl border border-pink-200 bg-pink-50 p-4 text-sm text-pink-700">
          {error}
        </div>
        <div className="mt-4">
          <Button onClick={() => router.push("/upload")}>← Zurück zu Upload</Button>
        </div>
      </AppShell>
    );
  }

  if (!ctx || !mapping || !candidate || !effectiveMapping) {
    return (
      <AppShell active="Upload">
        <div className="mb-6">
          <div className="text-3xl font-semibold">Preview & Spalten-Mapping</div>
          <Subhead>Preview-Daten werden geladen…</Subhead>
        </div>

        <div className="mb-8">
          <FlowStepper active="Preview" />
        </div>

        <div className="rounded-xl border border-[color:var(--bp-border)] bg-white p-6 text-sm text-slate-500">
          Warte auf Upload-Kontext. Wenn das bestehen bleibt, gehe zurück zu Upload.
        </div>

        <div className="mt-4">
          <Button onClick={() => router.push("/upload")}>← Zurück zu Upload</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="Upload">
      <div className="mb-6">
        <div className="text-3xl font-semibold">Preview & Spalten-Mapping</div>
        <Subhead>
          Fokus zuerst auf die Betragslogik. Danach Datum und Text prüfen.
        </Subhead>
      </div>

      <div className="mb-8">
        <FlowStepper active="Preview" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Mapping-Assistent</div>
            <Subhead>Spalten-Mapping für unterschiedliche Bankformate.</Subhead>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Tabellen-Kandidat</div>
              <Select value={mapping.candidateId} onChange={(e) => onCandidateChange(e.target.value)}>
                {ctx.candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <div className="text-xs text-slate-500">{candidate.reason}</div>
            </div>

            <div className="grid gap-2 rounded-xl border border-[color:var(--bp-border)] p-3">
              <div className="text-xs font-semibold text-slate-600">Betragsstruktur</div>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="amount_mode"
                    checked={mapping.amountMode === "single"}
                    onChange={() => patchMapping("amountMode", "single")}
                  />
                  Einzelne Betragsspalte (mit Vorzeichen)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="amount_mode"
                    checked={mapping.amountMode === "split"}
                    onChange={() => patchMapping("amountMode", "split")}
                  />
                  Getrennte Spalten (Belastung / Gutschrift)
                </label>
              </div>

              {mapping.amountMode === "single" ? (
                <>
                  <div className="grid gap-2">
                    <div className="text-xs font-semibold text-slate-600">Betragsspalte</div>
                    <Select
                      value={mapping.amountColumn}
                      onChange={(e) => patchMapping("amountColumn", e.target.value)}
                    >
                      <option value="">— auswählen —</option>
                      {candidate.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <div className="text-xs font-semibold text-slate-600">Vorzeichen-Regel</div>
                    <Select
                      value={mapping.signMode}
                      onChange={(e) =>
                        patchMapping("signMode", e.target.value as PreviewMapping["signMode"])
                      }
                    >
                      <option value="as_is">Vorzeichen aus Datei verwenden</option>
                      <option value="debit_positive">Positive Werte = Belastung (Abfluss)</option>
                      <option value="invert">Alle Vorzeichen umkehren</option>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-2">
                    <div className="text-xs font-semibold text-slate-600">Belastungsspalte (Abfluss)</div>
                    <Select
                      value={mapping.debitColumn}
                      onChange={(e) => patchMapping("debitColumn", e.target.value)}
                    >
                      <option value="">— auswählen —</option>
                      {candidate.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <div className="text-xs font-semibold text-slate-600">Gutschriftsspalte (Zufluss)</div>
                    <Select
                      value={mapping.creditColumn}
                      onChange={(e) => patchMapping("creditColumn", e.target.value)}
                    >
                      <option value="">— auswählen —</option>
                      {candidate.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <div className="text-xs font-semibold text-slate-600">Fallback-Betrag (optional)</div>
                    <Select
                      value={mapping.fallbackAmountColumn}
                      onChange={(e) => patchMapping("fallbackAmountColumn", e.target.value)}
                    >
                      <option value="">— keiner —</option>
                      {candidate.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Select>
                  </div>
                </>
              )}
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Datums-Spalte</div>
              <Select
                value={mapping.dateColumn}
                onChange={(e) => patchMapping("dateColumn", e.target.value)}
              >
                <option value="">— auswählen —</option>
                {candidate.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Währungs-Spalte (optional)</div>
              <Select
                value={mapping.currencyColumn}
                onChange={(e) => patchMapping("currencyColumn", e.target.value)}
              >
                <option value="">— keine (Standard CHF) —</option>
                {candidate.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-600">Buchungstext-Spalten</div>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={useAutoTextColumns}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setUseAutoTextColumns(next);
                      if (!next && autoTextColumns.length) {
                        patchMapping("textColumns", autoTextColumns);
                      }
                    }}
                  />
                  Automatisch
                </label>
              </div>

              {useAutoTextColumns ? (
                <div className="rounded-xl border border-[color:var(--bp-border)] bg-slate-50 p-3">
                  <div className="flex flex-wrap gap-2">
                    {(autoTextColumns.length ? autoTextColumns : ["Keine Textspalten erkannt"]).map((h) => (
                      <Badge key={h} variant="blue">
                        {h}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Diese Spalten wurden automatisch erkannt. Deaktivieren, um manuell zu wählen.
                  </div>
                </div>
              ) : (
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
              )}
            </div>

            <div className="grid gap-2 rounded-xl border border-[color:var(--bp-border)] p-3">
              <div className="text-xs font-semibold text-slate-600">Optionales Mapping-Preset</div>
              <Select
                value={mapping.bankTemplate}
                onChange={(e) => applyPreset(e.target.value as PreviewMapping["bankTemplate"])}
              >
                <option value="generic">Generisch</option>
                <option value="split_generic">Generisch mit Belastung/Gutschrift</option>
                <option value="ubs">UBS / split + Einzelbetrag-Fallback</option>
                <option value="clientis">Clientis / Export ohne Header</option>
                <option value="acrevis">Acrevis</option>
              </Select>
              <div className="text-xs text-slate-500">
                Nur verwenden, wenn das automatische Mapping nicht passt.
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mapping.dropSummaryRows}
                onChange={(e) => patchMapping("dropSummaryRows", e.target.checked)}
              />
              Sammelbuchungen ausblenden (z. B. Elternzeile von Sammelauftrag)
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
              Weiter zu Bereinigung →
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Normalized Preview</div>
            <Subhead>
              {normalizedRows.length} Zeilen nach Mapping. Beträge sind als absolute Werte normalisiert.
            </Subhead>
          </CardHeader>

          <CardContent>
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <Badge variant="blue">{ctx.fileType.toUpperCase()}</Badge>
              <Badge variant="pink">{templateLabel}</Badge>
              <Badge variant="blue">{amountModeLabel}</Badge>
            </div>

            <div className="overflow-auto rounded-xl border border-[color:var(--bp-border)] bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3 text-left">Datum</th>
                    <th className="p-3 text-left">Buchungstext</th>
                    <th className="p-3 text-left">Betrag</th>
                    <th className="p-3 text-left">Währung</th>
                    <th className="p-3 text-left">Richtung</th>
                    <th className="p-3 text-left">Betragsquelle</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {normalizedRows.slice(0, 25).map((r) => (
                    <tr key={r.id} className="border-t border-[color:var(--bp-border)]">
                      <td className="p-3">{r.date || "—"}</td>
                      <td className="p-3">{r.description || "—"}</td>
                      <td className="p-3">
                        <Badge variant="pink">{Math.abs(r.amount).toFixed(2)}</Badge>
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
                            <Badge variant="pink">Belastung+Gutschrift</Badge>
                          ) : null}
                          {r.amountDiagnostics?.usedDebit ? <Badge variant="blue">Belastung</Badge> : null}
                          {r.amountDiagnostics?.usedCredit ? <Badge variant="blue">Gutschrift</Badge> : null}
                          {r.amountDiagnostics?.usedFallback ? <Badge variant="blue">Fallback</Badge> : null}
                          {r.amountDiagnostics?.summaryInheritedSign ? (
                            <Badge variant="pink">Sammel-Vorzeichen</Badge>
                          ) : null}
                          {!r.amountDiagnostics?.usedDebit &&
                          !r.amountDiagnostics?.usedCredit &&
                          !r.amountDiagnostics?.usedFallback ? (
                            <span className="text-slate-400">Direkt/Einzelspalte</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!normalizedRows.length ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        Noch keine Zeilen. Bitte links das Mapping anpassen.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Rohdaten-Vorschau</div>
                  <Subhead>Zeigt die Originalzeilen mit Fokus auf relevante Spalten.</Subhead>
                </div>
                <Button variant="outline" onClick={() => setShowRawPreview((v) => !v)}>
                  {showRawPreview ? "Ausblenden" : "Einblenden"}
                </Button>
              </div>

              {showRawPreview ? (
                <div className="mt-3 overflow-auto rounded-xl border border-[color:var(--bp-border)] bg-white">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        {rawColumns.map((h) => (
                          <th key={h} className="p-2 text-left font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-slate-700">
                      {candidate.rows.slice(0, 12).map((row, idx) => (
                        <tr key={`raw-${idx}`} className="border-t border-[color:var(--bp-border)]">
                          {rawColumns.map((h) => (
                            <td key={`${idx}-${h}`} className="p-2 whitespace-nowrap">
                              {safeText(row[h] || "") || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {!candidate.rows.length ? (
                        <tr>
                          <td colSpan={rawColumns.length || 1} className="p-4 text-center text-slate-500">
                            Keine Rohzeilen verfügbar.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-[color:var(--bp-border)] bg-slate-50 p-3 text-xs text-slate-600">
                  Rohdaten sind standardmässig ausgeblendet, damit das Mapping übersichtlich bleibt.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
