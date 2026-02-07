"use client";

import { useMemo, useState } from "react";
import { AppShell } from "../components/shell";
import { Card, CardContent, CardHeader, Subhead, Badge, Button, Input, Select } from "../components/ui";

type Rule = {
  id: string;
  group: "Transaktion" | "Beleg" | "Mandant";
  field: "Text" | "Betrag" | "Waehrung" | "Datum";
  op: "enthaelt" | "=" | "!=";
  value: string;
  konto: string;
  steuersatz: string;
};

function uid() {
  return `r_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function ChipRow({ rule, onRemove }: { rule: Rule; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--bp-border)] bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center overflow-hidden rounded-lg border border-[color:var(--bp-border)] bg-slate-50">
          <span className="bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-900">{rule.group}</span>
          <span className="px-2 py-1 text-xs font-semibold text-slate-800">{rule.field}</span>
        </div>

        <span className="rounded-lg border border-[color:var(--bp-border)] bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800">
          {rule.op === "enthaelt" ? "enthält" : rule.op}
        </span>

        <span className="rounded-lg border border-[color:var(--bp-border)] bg-slate-50 px-2 py-1 text-xs text-slate-800">
          {rule.value || <span className="text-slate-400">(leer)</span>}
        </span>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="h-8 w-8 rounded-lg border border-[color:var(--bp-border)] bg-slate-50 text-slate-700 hover:bg-slate-100"
        aria-label="Remove rule"
        title="Remove rule"
      >
        ×
      </button>
    </div>
  );
}

export default function PostingRulesPage() {
  const kontoOptions = useMemo(
    () => [
      "1020 Bank CHF",
      "1100 Debitoren",
      "2000 Kreditoren",
      "3200 Erloese Dienstleistungen",
      "4000 Warenaufwand",
      "6500 Bueromaterial",
      "6800 Informatik / Software",
    ],
    []
  );

  const steuerOptions = useMemo(() => ["7.7% (Norm)", "2.5% (Red.)", "0% (Export)", "ohne MWST"], []);

  // Builder state
  const [group, setGroup] = useState<Rule["group"]>("Transaktion");
  const [field, setField] = useState<Rule["field"]>("Text");
  const [op, setOp] = useState<Rule["op"]>("=");
  const [value, setValue] = useState("Media Markt Schweiz AG Volketswil");

  const [konto, setKonto] = useState("");
  const [steuersatz, setSteuersatz] = useState("");
  const [touchedKonto, setTouchedKonto] = useState(false);
  const kontoInvalid = touchedKonto && !konto;

  const [rules, setRules] = useState<Rule[]>([
    { id: uid(), group: "Transaktion", field: "Text", op: "=", value: "Media Markt Schweiz AG Volketswil", konto: "", steuersatz: "" },
  ]);

  const [toast, setToast] = useState("");

  function addRule() {
    setTouchedKonto(true);
    if (!konto) {
      setToast("Bitte zuerst ein Konto wählen (Konto*).");
      return;
    }
    const r: Rule = { id: uid(), group, field, op, value: value.trim(), konto, steuersatz };
    setRules((prev) => [r, ...prev]);
    setToast("Regel hinzugefügt (Demo).");
  }

  function applyRules() {
    setToast(`Regeln angewendet (Demo): ${rules.length} Regel(n).`);
  }

  return (
    <AppShell active="Posting Rules">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Buchungsregeln</h2>
              <Subhead>
                Interaktive Demo: Regel hinzufügen → erscheint als Chip-Zeile (wie im Screenshot). Konto/Steuersatz sind Teil der Regel.
              </Subhead>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="blue">Demo</Badge>
              <Badge variant="pink">UI</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {toast ? (
            <div className="rounded-xl border border-[color:var(--bp-border)] bg-slate-50 px-4 py-3 text-sm text-slate-700">{toast}</div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* LEFT: Builder */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-[color:var(--bp-border)] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Regel erstellen</div>
                    <div className="mt-1 text-xs text-slate-500">Beispiel: Transaktion → Text = “Media Markt …”</div>
                  </div>
                  <Button variant="outline" onClick={() => setToast("")} type="button">
                    Clear Hint
                  </Button>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div>
                      <label className="text-xs font-medium text-slate-600">Bereich</label>
                      <Select value={group} onChange={(e: any) => setGroup(e.target.value)} className="mt-1 w-full">
                        <option value="Transaktion">Transaktion</option>
                        <option value="Beleg">Beleg</option>
                        <option value="Mandant">Mandant</option>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">Feld</label>
                      <Select value={field} onChange={(e: any) => setField(e.target.value)} className="mt-1 w-full">
                        <option value="Text">Text</option>
                        <option value="Betrag">Betrag</option>
                        <option value="Waehrung">Währung</option>
                        <option value="Datum">Datum</option>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">Operator</label>
                      <Select value={op} onChange={(e: any) => setOp(e.target.value)} className="mt-1 w-full">
                        <option value="=">=</option>
                        <option value="!=">≠</option>
                        <option value="enthaelt">enthält</option>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">Wert</label>
                      <Input value={value} onChange={(e: any) => setValue(e.target.value)} className="mt-1 w-full" placeholder="z.B. Media Markt…" />
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="text-sm font-semibold">Buchung</div>

                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600">Konto*</label>
                        <Input
                          value={konto}
                          onChange={(e: any) => setKonto(e.target.value)}
                          onBlur={() => setTouchedKonto(true)}
                          className={`mt-1 w-full ${kontoInvalid ? "border-red-500 ring-1 ring-red-200" : ""}`}
                          placeholder="z.B. 6800 Informatik / Software"
                          list="kontoOptions"
                        />
                        <datalist id="kontoOptions">
                          {kontoOptions.map((k) => (
                            <option key={k} value={k} />
                          ))}
                        </datalist>
                        {kontoInvalid ? <div className="mt-1 text-xs text-red-600">Pflichtfeld</div> : null}
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-600">Steuersatz</label>
                        <Select value={steuersatz} onChange={(e: any) => setSteuersatz(e.target.value)} className="mt-1 w-full" disabled={!konto}>
                          <option value="">{!konto ? "(erst Konto wählen)" : "(optional)"}</option>
                          {steuerOptions.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                        {!konto ? <div className="mt-1 text-xs text-slate-400">Steuersatz ist disabled bis Konto gesetzt ist.</div> : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button onClick={addRule} type="button">
                      Regel hinzufügen
                    </Button>
                    <Button variant="outline" onClick={applyRules} type="button" disabled={rules.length === 0}>
                      Regeln anwenden
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Preview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Vorschau</div>
                  <div className="text-xs text-slate-500">Regeln erscheinen als Chip-Zeilen (mit X zum Entfernen).</div>
                </div>
                <Badge variant="blue">{rules.length} Regel(n)</Badge>
              </div>

              <div className="space-y-2">
                {rules.length === 0 ? (
                  <div className="rounded-xl border border-[color:var(--bp-border)] bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Noch keine Regeln. Links “Regel hinzufügen” klicken.
                  </div>
                ) : (
                  rules.map((r) => (
                    <ChipRow
                      key={r.id}
                      rule={r}
                      onRemove={() => {
                        setRules((prev) => prev.filter((x) => x.id !== r.id));
                        setToast("Regel entfernt (Demo).");
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
