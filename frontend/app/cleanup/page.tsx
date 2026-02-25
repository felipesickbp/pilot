"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../components/shell";
import { FlowStepper } from "../components/stepper";
import { Badge, Button, Card, CardContent, CardHeader, Subhead } from "../components/ui";
import {
  PREVIEW_META_KEY,
  PREVIEW_ROWS_KEY,
  STORAGE_KEY,
  STORAGE_META_KEY,
  type NormalizedRow,
  cleanDescription,
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

  const cleanedRows = useMemo(() => {
    return rows.map((r) => ({
      ...r,
      description: cleanDescription(r.description, {
        stripBookingWords,
        stripIbanRefs,
        stripAddressBits,
        titleCase,
      }),
    }));
  }, [rows, stripBookingWords, stripIbanRefs, stripAddressBits, titleCase]);

  function goSpreadsheet() {
    if (!cleanedRows.length) return;

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cleanedRows));
    sessionStorage.setItem(
      STORAGE_META_KEY,
      JSON.stringify({
        ...(meta || {}),
        cleanup: {
          stripBookingWords,
          stripIbanRefs,
          stripAddressBits,
          titleCase,
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
          Clean descriptions before Spreadsheet: remove booking noise, IBANs, references, addresses, and all-caps.
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
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {cleanedRows.slice(0, 20).map((r, idx) => (
                      <tr key={r.id} className="border-t border-[color:var(--bp-border)] align-top">
                        <td className="p-3 text-xs text-slate-500">{rows[idx]?.description || "—"}</td>
                        <td className="p-3">{r.description}</td>
                        <td className="p-3">
                          <Badge variant="pink">{r.amount.toFixed(2)}</Badge>
                        </td>
                      </tr>
                    ))}
                    {!cleanedRows.length ? (
                      <tr>
                        <td colSpan={3} className="p-6 text-center text-slate-500">
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
    </AppShell>
  );
}
