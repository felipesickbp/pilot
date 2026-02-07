import { AppShell } from "../components/shell";
import { FlowStepper } from "../components/stepper";
import { Badge, Button, Card, CardContent, CardHeader, Select, Subhead } from "../components/ui";

export default function PreviewPage() {
  return (
    <AppShell active="Upload Files">
      <div className="mb-6">
        <div className="text-3xl font-semibold">Upload Transaction Files</div>
        <Subhead>Process CSV, XLSX, PDF, and CAMT.053 files for Bexio integration</Subhead>
      </div>

      <div className="mb-8">
        <FlowStepper active="Preview" />
      </div>

      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--bp-border)] bg-white">◎</span>
        Data Preview & Column Mapping
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Column Mapping</div>
            <Subhead>Map your data columns to the required fields</Subhead>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Date Column</div>
              <Select defaultValue="date">
                <option value="date">Date (2025-01-15)</option>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Amount Column</div>
              <Select defaultValue="amount">
                <option value="amount">Amount (5000.00)</option>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Posting Text Columns</div>
              <Subhead>Select one or more columns to combine for posting text</Subhead>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" /> Date <span className="text-xs text-slate-500">(2025-01-15)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked /> Description{" "}
                <span className="text-xs text-slate-500">(SALARY PAYMENT COMPANY ABC)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" /> Reference <span className="text-xs text-slate-500">(SAL001)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" /> Amount <span className="text-xs text-slate-500">(5000.00)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" /> Balance <span className="text-xs text-slate-500">(15000.00)</span>
              </label>
            </div>

            <Button className="w-full">Continue to Text Cleanup →</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Data Preview</div>
            <Subhead>Preview of your uploaded data (5 rows total)</Subhead>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-xl border border-[color:var(--bp-border)] bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-left">Reference</th>
                    <th className="p-3 text-left">Amount</th>
                    <th className="p-3 text-left">Balance</th>
                    <th className="p-3 text-left">Type</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {[
                    ["2025-01-15", "SALARY PAYMENT COMPANY ABC", "SAL001", "5000.00", "15000.00", "CREDIT"],
                    ["2025-01-15", "OFFICE RENT MONTHLY PAYMENT", "RENT001", "-2500.00", "12500.00", "DEBIT"],
                    ["2025-01-16", "INVOICE PAYMENT CLIENT XYZ", "INV001", "1200.00", "13700.00", "CREDIT"],
                    ["2025-01-16", "UTILITIES ELECTRICITY BILL", "UTIL001", "-350.00", "13350.00", "DEBIT"],
                    ["2025-01-17", "CONSULTING SERVICES PAYMENT", "CONS001", "2800.00", "16150.00", "CREDIT"],
                  ].map((r) => (
                    <tr key={r[2]} className="border-t border-[color:var(--bp-border)]">
                      <td className="p-3">{r[0]}</td>
                      <td className="p-3">{r[1]}</td>
                      <td className="p-3">{r[2]}</td>
                      <td className="p-3">
                        <Badge variant="pink">{r[3]}</Badge>
                      </td>
                      <td className="p-3">{r[4]}</td>
                      <td className="p-3">{r[5]}</td>
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

