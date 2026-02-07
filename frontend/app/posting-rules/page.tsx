import { AppShell } from "../components/shell";
import { Card, CardContent, CardHeader, Subhead, Badge, Button } from "../components/ui";

export default function PostingRulesPage() {
  return (
    <AppShell active="Posting Rules">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Buchungsregeln</h2>
              <Subhead>
                Demo-Seite: Hier entsteht später die Regel-UI (enthält/gleich/etc.) + Vorschau + „für alle anwenden“.
              </Subhead>
            </div>
            <Badge variant="blue">Stub</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border border-[color:var(--bp-border)] bg-white p-4">
            <div className="text-sm font-medium">Was kommt hier später?</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600 space-y-1">
              <li>Regel erstellen (Feld, Operator, Wert, Konto, MWST)</li>
              <li>Vorschau: „Welche Transaktionen passen?“</li>
              <li>Regeln speichern & auf Imports anwenden</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" disabled>
              Regel hinzufügen (coming)
            </Button>
            <Button disabled>Regeln anwenden (coming)</Button>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
