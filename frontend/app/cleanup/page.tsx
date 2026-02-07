import { AppShell } from "../components/shell";
import { FlowStepper } from "../components/stepper";
import { Badge, Button, Card, CardContent, CardHeader, Subhead } from "../components/ui";

export default function CleanupPage() {
  return (
    <AppShell active="Upload Files">
      <div className="mb-6">
        <div className="text-3xl font-semibold">Upload Transaction Files</div>
        <Subhead>Process CSV, XLSX, PDF, and CAMT.053 files for Bexio integration</Subhead>
      </div>

      <div className="mb-8">
        <FlowStepper active="Cleanup" />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold">✨ Text Cleanup</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Clear All</Button>
          <Button variant="outline">Select All Suggestions</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="border-pink-200">
          <CardHeader>
            <div className="text-sm font-semibold">Cleanup Suggestions</div>
            <Subhead>Detected repetitive patterns that can be removed</Subhead>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-[color:var(--bp-border)] bg-white p-4">
              <div className="flex items-center gap-3">
                <input type="checkbox" defaultChecked />
                <div className="text-sm font-semibold">"payment"</div>
                <Badge variant="blue">4 occurrences</Badge>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                Found in:
                <div className="mt-2 space-y-1">
                  <div>“SALARY PAYMENT COMPANY ABC”</div>
                  <div>“OFFICE RENT MONTHLY PAYMENT”</div>
                  <div>“INVOICE PAYMENT CLIENT XYZ”</div>
                  <div>“CONSULTING SERVICES PAYMENT”</div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Button className="w-full">Continue to Spreadsheet →</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Cleanup Preview</div>
            <Subhead>Preview of cleaned posting text (1 patterns selected)</Subhead>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-xl border border-[color:var(--bp-border)] bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3 text-left">Original</th>
                    <th className="p-3 text-left">Cleaned</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {[
                    ["SALARY PAYMENT COMPANY ABC", "SALARY COMPANY ABC"],
                    ["OFFICE RENT MONTHLY PAYMENT", "OFFICE RENT MONTHLY"],
                    ["INVOICE PAYMENT CLIENT XYZ", "INVOICE CLIENT XYZ"],
                    ["UTILITIES ELECTRICITY BILL", "UTILITIES ELECTRICITY BILL"],
                    ["CONSULTING SERVICES PAYMENT", "CONSULTING SERVICES"],
                  ].map((r) => (
                    <tr key={r[0]} className="border-t border-[color:var(--bp-border)]">
                      <td className="p-3">{r[0]}</td>
                      <td className="p-3">
                        <span className="text-fuchsia-600">{r[1]}</span>{" "}
                        {r[0] !== r[1] && <Badge variant="pink">Modified</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
