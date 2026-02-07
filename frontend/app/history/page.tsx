import { AppShell } from "../components/shell";
import { Card, CardContent, CardHeader, Subhead, Badge, Button } from "../components/ui";

const demoImports = [
  { id: "imp_001", date: "2026-02-07 14:12", rows: 48, status: "OK" },
  { id: "imp_002", date: "2026-02-06 18:30", rows: 12, status: "OK" },
];

export default function HistoryPage() {
  return (
    <AppShell active="History">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">History</h2>
              <Subhead>
                Demo-Seite: Später listet diese Seite Imports pro Mandant, inkl. Download & Delete.
              </Subhead>
            </div>
            <Badge variant="blue">Stub</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border border-[color:var(--bp-border)] overflow-hidden">
            <div className="grid grid-cols-12 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
              <div className="col-span-4">Zeit</div>
              <div className="col-span-3">Import ID</div>
              <div className="col-span-2">Zeilen</div>
              <div className="col-span-3 text-right">Aktionen</div>
            </div>

            {demoImports.map((x) => (
              <div
                key={x.id}
                className="grid grid-cols-12 items-center px-4 py-3 border-t border-[color:var(--bp-border)]"
              >
                <div className="col-span-4 text-sm text-slate-700">{x.date}</div>
                <div className="col-span-3 text-sm font-mono text-slate-700">{x.id}</div>
                <div className="col-span-2 text-sm text-slate-700">{x.rows}</div>
                <div className="col-span-3 flex gap-2 justify-end">
                  <Button variant="outline" disabled>Download</Button>
                  <Button variant="ghost" disabled>Löschen</Button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-slate-500">
            Hinweis: Das ist nur Demo-UI. Später kommt das aus der DB (Import-Records).
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
