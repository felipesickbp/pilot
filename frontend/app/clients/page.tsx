import { AppShell } from "../components/shell";
import { Card, CardContent, CardHeader, Subhead, Badge, Button, Input, Select } from "../components/ui";

export default function DirectImportPage() {
  return (
    <AppShell active="Direct Import">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Direct Import</h2>
              <Subhead>
                Zwischenstand (Demo): Hier kommt dein „Copy/Paste → ins Grid laden“ Workflow hin (wie im Streamlit Prototyp).
              </Subhead>
            </div>
            <Badge variant="blue">Stub</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border border-[color:var(--bp-border)] bg-white p-4">
            <div className="text-sm font-medium">Geplantes MVP</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600 space-y-1">
              <li>Excel/TSV Textbox (Paste)</li>
              <li>„Load to Grid“ Button</li>
              <li>Optional: Template/Spaltenhilfe + Validierung</li>
            </ul>
          </div>

          <div className="grid gap-3 max-w-xl">
            <label className="text-sm font-medium text-slate-700">Paste (Excel/TSV)</label>
            <Input placeholder="(Demo) Paste wird später eine große Textarea" disabled />
            <div className="grid grid-cols-2 gap-3">
              <Button disabled>Load to Spreadsheet (coming)</Button>
              <Button variant="outline" disabled>Template herunterladen (coming)</Button>
            </div>
            <div className="text-xs text-slate-500">
              Hinweis: Mandant wechseln kommt später in Header/Settings (nicht hier).
            </div>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
