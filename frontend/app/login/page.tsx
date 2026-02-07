import { Card, CardContent, CardHeader, Button, Input, Subhead } from "../components/ui";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="text-sm font-semibold">BP Pilot</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Einloggen</h1>
          <Subhead>
            Zwischenstand (Demo): UI steht – Bexio Connect kommt als nächster Schritt.
          </Subhead>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">E-Mail</label>
            <Input placeholder="name@firma.ch" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Passwort</label>
            <Input placeholder="••••••••" type="password" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button disabled>Anmelden</Button>
            <Button variant="outline" disabled>
              Connect Bexio
            </Button>
          </div>

          <div className="text-xs text-slate-500">
            Buttons sind absichtlich deaktiviert (Demo).
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
