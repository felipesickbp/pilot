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
import { UploadCloud, Landmark, FileText, FileSpreadsheet } from "lucide-react";
import {
  IMPORT_CONTEXT_KEY,
  PREVIEW_META_KEY,
  PREVIEW_ROWS_KEY,
  STORAGE_KEY,
  STORAGE_META_KEY,
  parseFileToContext,
} from "../importer";

export default function UploadPage() {
  const router = useRouter();
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE || "/api", []);

  const [bankAccount, setBankAccount] = useState("1020");
  const [vatMode, setVatMode] = useState<"with" | "without">("with");
  const [fileName, setFileName] = useState("");
  const [candidateCount, setCandidateCount] = useState(0);
  const [bestSummary, setBestSummary] = useState<string>("");
  const [error, setError] = useState("");
  const [clientName, setClientName] = useState("");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${apiBase}/bexio/session`, {
          method: "GET",
          credentials: "include",
        });
        if (!r.ok) return;
        const data = (await r.json()) as { connected?: boolean; client_name?: string };
        if (!cancelled) {
          setClientName(data.connected ? String(data.client_name || "") : "");
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

  return (
    <AppShell active="Upload">
      <div className="mb-6">
        <div className="text-3xl font-semibold">Transaktionsdateien hochladen</div>
        <Subhead>
          CSV, Excel oder CAMT XML hochladen. Danach Kandidaten prüfen und in Preview mappen.
        </Subhead>
      </div>

      <div className="mb-8">
        <FlowStepper active="Upload" />
      </div>

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
              <div className="text-xs font-semibold text-slate-600">MWST-Status (Demo)</div>
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="vat"
                    checked={vatMode === "with"}
                    onChange={() => setVatMode("with")}
                  />
                  Mit MWST <Badge variant="pink">MWST</Badge>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="vat"
                    checked={vatMode === "without"}
                    onChange={() => setVatMode("without")}
                  />
                  Ohne MWST
                </label>
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
    </AppShell>
  );
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
