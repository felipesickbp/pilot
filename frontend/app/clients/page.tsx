import { AppShell } from "../components/shell";
import { Card, CardContent, CardHeader, Subhead, Badge, Button, Select } from "../components/ui";

export default function ClientsPage() {
  return (
    <AppShell active="Clients">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Mandanten</h2>
              <Subhead>
                Demo-Seite: Hier wird später Mandant wählen/wechseln + Anzeige oben rechts umgesetzt.
              </Subhead>
            </div>
            <Badge variant="blue">Stub</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-2 max-w-md">
            <label className="text-sm font-medium text-slate-700">Aktiver Mandant</label>
            <Select defaultValue="demo">
              <option value="demo">Demo Mandant (Placeholder)</option>
            </Select>
            <div className="text-xs text-slate-500">
              Später kommt das aus Login/Backend (bexio company_profile).
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" disabled>Mandant wechseln (coming)</Button>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
