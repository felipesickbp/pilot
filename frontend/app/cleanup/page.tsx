"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../components/shell";
import { FlowStepper } from "../components/stepper";
import { Badge, Button, Card, CardContent, CardHeader, Input, Subhead } from "../components/ui";
import {
  PREVIEW_META_KEY,
  PREVIEW_ROWS_KEY,
  STORAGE_KEY,
  STORAGE_META_KEY,
  type CleanupRuleKey,
  type CleanupRuleOptions,
  type NormalizedRow,
  cleanDescriptionWithDiagnostics,
  safeText,
} from "../importer";

export default function CleanupPage() {
  const router = useRouter();

  const [rows, setRows] = useState<NormalizedRow[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [error, setError] = useState("");

  const [stripBookingWords, setStripBookingWords] = useState(true);
  const [stripIbanRefs, setStripIbanRefs] = useState(true);
  const [stripAddressBits, setStripAddressBits] = useState(true);
  const [titleCase, setTitleCase] = useState(true);
  const [customRemovals, setCustomRemovals] = useState<string[]>([]);
  const [customDraft, setCustomDraft] = useState("");
  const [rowRuleOverrides, setRowRuleOverrides] = useState<Record<string, Partial<CleanupRuleOptions>>>({});
  const [rowRollback, setRowRollback] = useState<Record<string, boolean>>({});
  const [manualEdits, setManualEdits] = useState<Record<string, string>>({});
  const [editingRowId, setEditingRowId] = useState<string>("");
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => {
    try {
      const rawRows = sessionStorage.getItem(PREVIEW_ROWS_KEY);
      const rawMeta = sessionStorage.getItem(PREVIEW_META_KEY);

      if (!rawRows || !rawMeta) {
        setError("No preview data found. Please go back to Preview.");
        return;
      }

      setRows(JSON.parse(rawRows));
      setMeta(JSON.parse(rawMeta));
    } catch {
      setError("Failed to load cleanup data.");
    }
  }, []);

  const globalRules = useMemo<CleanupRuleOptions>(
    () => ({
      stripBookingWords,
      stripIbanRefs,
      stripAddressBits,
      titleCase,
    }),
    [stripBookingWords, stripIbanRefs, stripAddressBits, titleCase]
  );

  const cleanedRows = useMemo(() => {
    return rows.map((r) => {
      const rollback = !!rowRollback[r.id];
      const overrides = rowRuleOverrides[r.id] || {};
      const effectiveRules: CleanupRuleOptions = rollback
        ? {
            stripBookingWords: false,
            stripIbanRefs: false,
            stripAddressBits: false,
            titleCase: false,
          }
        : { ...globalRules, ...overrides };

      const cleaned = cleanDescriptionWithDiagnostics(r.description, effectiveRules, customRemovals);
      const manual = safeText(manualEdits[r.id] || "");
      const finalDescription = rollback ? r.description : manual || cleaned.text;

      return {
        ...r,
        description: finalDescription,
        cleanup: {
          rollback,
          effectiveRules,
          changedRules: rollback ? [] : cleaned.changedRules,
          manualEdit: !!manual,
        },
      };
    });
  }, [rows, globalRules, rowRuleOverrides, rowRollback, customRemovals, manualEdits]);

  function toggleRowRollback(id: string) {
    setRowRollback((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleRowRule(id: string, key: CleanupRuleKey) {
    setRowRuleOverrides((prev) => {
      const current = prev[id] || {};
      const effectiveNow = current[key] ?? globalRules[key];
      const nextEffective = !effectiveNow;
      const next = { ...current } as Partial<CleanupRuleOptions>;

      if (nextEffective === globalRules[key]) {
        delete next[key];
      } else {
        next[key] = nextEffective;
      }

      if (!Object.keys(next).length) {
        const { [id]: _drop, ...rest } = prev;
        return rest;
      }

      return { ...prev, [id]: next };
    });
  }

  function addCustomRemoval() {
    const value = safeText(customDraft);
    if (!value) return;
    if (customRemovals.includes(value)) {
      setCustomDraft("");
      return;
    }
    setCustomRemovals((prev) => [...prev, value]);
    setCustomDraft("");
  }

  function removeCustomRemoval(value: string) {
    setCustomRemovals((prev) => prev.filter((x) => x !== value));
  }

  function openEditor(rowId: string, value: string) {
    setEditingRowId(rowId);
    setEditDraft(value || "");
  }

  function saveEditor() {
    if (!editingRowId) return;
    const value = safeText(editDraft);
    setManualEdits((prev) => {
      const next = { ...prev };
      if (value) next[editingRowId] = value;
      else delete next[editingRowId];
      return next;
    });
    setEditingRowId("");
    setEditDraft("");
  }

  function goSpreadsheet() {
    if (!cleanedRows.length) return;
    const finalRows = cleanedRows.map(({ cleanup, ...row }) => row);

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(finalRows));
    sessionStorage.setItem(
      STORAGE_META_KEY,
      JSON.stringify({
        ...(meta || {}),
        cleanup: {
          globalRules,
          customRemovals,
          rowRuleOverrides,
          rowRollback,
          manualEdits,
          changedRows: cleanedRows
            .filter((r) => r.cleanup.changedRules.length > 0 || r.cleanup.rollback || r.cleanup.manualEdit)
            .map((r) => ({
              id: r.id,
              rollback: r.cleanup.rollback,
              manualEdit: r.cleanup.manualEdit,
              changedRules: r.cleanup.changedRules,
            })),
        },
        createdAt: new Date().toISOString(),
      })
    );

    router.push("/spreadsheet");
  }

  return (
    <AppShell active="Upload Files">
      <div className="mb-6">
        <div className="text-3xl font-semibold">Cleanup</div>
        <Subhead>
          Clean descriptions before Spreadsheet, then manually adjust individual rows when needed.
        </Subhead>
      </div>

      <div className="mb-8">
        <FlowStepper active="Cleanup" />
      </div>

      {error ? (
        <>
          <div className="rounded-xl border border-pink-200 bg-pink-50 p-4 text-sm text-pink-700">
            {error}
          </div>
          <div className="mt-4">
            <Button onClick={() => router.push("/preview")}>← Back to Preview</Button>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader>
              <div className="text-sm font-semibold">Cleanup Rules</div>
              <Subhead>Apply cleanup to all normalized descriptions.</Subhead>
            </CardHeader>

            <CardContent className="grid gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={stripBookingWords}
                  onChange={(e) => setStripBookingWords(e.target.checked)}
                />
                Remove booking words (Gutschrift, Lastschrift, Kontoübertrag, etc.)
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={stripIbanRefs}
                  onChange={(e) => setStripIbanRefs(e.target.checked)}
                />
                Remove IBANs, references, QR refs, transaction numbers
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={stripAddressBits}
                  onChange={(e) => setStripAddressBits(e.target.checked)}
                />
                Remove address-like segments and cost labels
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={titleCase}
                  onChange={(e) => setTitleCase(e.target.checked)}
                />
                Convert ALL CAPS text to normal title case
              </label>

              <div className="grid gap-2 rounded-xl border border-[color:var(--bp-border)] p-3">
                <div className="text-xs font-semibold text-slate-600">Add cleanup rule (global)</div>
                <div className="flex gap-2">
                  <Input
                    value={customDraft}
                    onChange={(e) => setCustomDraft(e.target.value)}
                    placeholder='Text to remove everywhere, e.g. ": "'
                  />
                  <Button variant="outline" onClick={addCustomRemoval}>
                    Add
                  </Button>
                </div>
                {customRemovals.length ? (
                  <div className="flex flex-wrap gap-2">
                    {customRemovals.map((r) => (
                      <button
                        key={r}
                        type="button"
                        className="rounded-full border border-[color:var(--bp-border)] bg-white px-2 py-1 text-xs"
                        onClick={() => removeCustomRemoval(r)}
                        title="Click to remove rule"
                      >
                        {r} ×
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">No custom rules yet.</div>
                )}
              </div>

              <Button className="w-full" onClick={goSpreadsheet} disabled={!cleanedRows.length}>
                Continue to Spreadsheet →
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm font-semibold">Before / After</div>
              <Subhead>Preview of cleaned transaction descriptions</Subhead>
            </CardHeader>

            <CardContent>
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                <Badge variant="blue">{rows.length} rows</Badge>
                <Badge variant="pink">Cleanup preview</Badge>
              </div>

              <div className="overflow-auto rounded-xl border border-[color:var(--bp-border)] bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3 text-left">Original</th>
                      <th className="p-3 text-left">Cleaned</th>
                      <th className="p-3 text-left">Amount</th>
                      <th className="p-3 text-left">Row Controls</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {cleanedRows.slice(0, 20).map((r, idx) => (
                      <tr key={r.id} className="border-t border-[color:var(--bp-border)] align-top">
                        <td className="p-3 text-xs text-slate-500">{rows[idx]?.description || "—"}</td>
                        <td className="p-3">{r.description}</td>
                        <td className="p-3">
                          <Badge variant="pink">{Math.abs(r.amount).toFixed(2)}</Badge>
                        </td>
                        <td className="p-3 text-xs">
                          <div className="grid gap-2">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={r.cleanup.rollback}
                                onChange={() => toggleRowRollback(r.id)}
                              />
                              Use original text
                            </label>
                            <Button
                              variant="outline"
                              onClick={() => openEditor(r.id, r.description)}
                              className="h-8 px-3 py-1"
                            >
                              Edit text
                            </Button>
                            <div className="grid grid-cols-2 gap-1">
                              <label className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={r.cleanup.effectiveRules.stripBookingWords}
                                  onChange={() => toggleRowRule(r.id, "stripBookingWords")}
                                  disabled={r.cleanup.rollback}
                                />
                                Booking
                              </label>
                              <label className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={r.cleanup.effectiveRules.stripIbanRefs}
                                  onChange={() => toggleRowRule(r.id, "stripIbanRefs")}
                                  disabled={r.cleanup.rollback}
                                />
                                IBAN/Refs
                              </label>
                              <label className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={r.cleanup.effectiveRules.stripAddressBits}
                                  onChange={() => toggleRowRule(r.id, "stripAddressBits")}
                                  disabled={r.cleanup.rollback}
                                />
                                Address
                              </label>
                              <label className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={r.cleanup.effectiveRules.titleCase}
                                  onChange={() => toggleRowRule(r.id, "titleCase")}
                                  disabled={r.cleanup.rollback}
                                />
                                Title Case
                              </label>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {r.cleanup.rollback ? <Badge variant="pink">rollback</Badge> : null}
                              {r.cleanup.manualEdit ? <Badge variant="pink">manual edit</Badge> : null}
                              {r.cleanup.changedRules.map((rule) => (
                                <Badge key={`${r.id}-${rule}`} variant="blue">
                                  {rule}
                                </Badge>
                              ))}
                              {!r.cleanup.rollback && !r.cleanup.manualEdit && !r.cleanup.changedRules.length ? (
                                <span className="text-slate-400">no changes</span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!cleanedRows.length ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-slate-500">
                          No rows available.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {editingRowId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="text-sm font-semibold">Edit Cleaned Text</div>
              <Subhead>Override cleanup output for this row.</Subhead>
            </CardHeader>
            <CardContent className="grid gap-3">
              <textarea
                className="min-h-[140px] w-full rounded-xl border border-[color:var(--bp-border)] p-3 text-sm outline-none focus:ring-2 focus:ring-fuchsia-200"
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingRowId("")}>Cancel</Button>
                <Button variant="outline" onClick={() => {
                  setManualEdits((prev) => {
                    const next = { ...prev };
                    delete next[editingRowId];
                    return next;
                  });
                  setEditingRowId("");
                  setEditDraft("");
                }}>
                  Clear override
                </Button>
                <Button onClick={saveEditor}>Save text</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
}
