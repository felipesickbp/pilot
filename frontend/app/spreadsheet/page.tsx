import { AppShell } from "../components/shell";
import { FlowStepper } from "../components/stepper";
import { Badge, Button, Card, CardContent, CardHeader, Subhead } from "../components/ui";
import { Copy, ClipboardPaste, Plus, Save } from "lucide-react";

export default function SpreadsheetPage() {
  return (
    <AppShell active="Upload Files">
      <div className="mb-6">
        <div className="text-3xl font-semibold">Upload Transaction Files</div>
        <Subhead>Process CSV, XLSX, PDF, and CAMT.053 files for Bexio integration</Subhead>
      </div>

      <div className="mb-8">
        <FlowStepper active="Spreadsheet" />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-xl font-semibold">✨ Transaction Spreadsheet</div>
          <Badge variant="blue">With VAT</Badge>
        </div>

        <div className="flex gap-2">
          <Button variant="outline"><Copy className="h-4 w-4" /> Copy</Button>
          <Button variant="outline"><ClipboardPaste className="h-4 w-4" /> Paste</Button>
          <Button variant="outline"><Plus className="h-4 w-4" /> Add Rule</Button>
          <Button><Save className="h-4 w-4" /> Save</Button>
        </div>
      </div>

      <Card className="border-pink-200">
        <CardContent className="flex items-center justify-between py-6">
          <div>
            <div className="text-sm font-semibold">0 of 5 transactions completed</div>
            <div className="text-sm text-slate-500">Fill in the missing account information to complete processing</div>
          </div>
          <div className="w-40">
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 w-[0%] rounded-full bg-gradient-to-r from-fuchsia-500 to-blue-500" />
            </div>
            <div className="mt-2 text-right text-xs text-slate-500">0%</div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Transaction Data</div>
            <Subhead>Edit transactions directly in the spreadsheet. Pre-filled data is highlighted.</Subhead>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-xl border border-[color:var(--bp-border)] bg-white">
              <table className="min-w-[1000px] w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    {["Document #", "Date", "Posting Text", "Amount", "Currency", "Exchange Rate", "Debit Account", "Credit Account", "VAT Code"].map((h) => (
                      <th key={h} className="p-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {[
                    ["DOC001", "2025-01-15", "SALARY COMPANY ABC", "5000.00", "CHF", "1.0"],
                    ["DOC002", "2025-01-15", "OFFICE RENT MONTHLY", "-2500.00", "CHF", "1.0"],
                    ["DOC003", "2025-01-16", "INVOICE CLIENT XYZ", "1200.00", "CHF", "1.0"],
                    ["DOC004", "2025-01-16", "UTILITIES ELECTRICITY BILL", "-350.00", "CHF", "1.0"],
                    ["DOC005", "2025-01-17", "CONSULTING SERVICES", "2800.00", "CHF", "1.0"],
                  ].map((r) => (
                    <tr key={r[0]} className="border-t border-[color:var(--bp-border)]">
                      <td className="p-3">
                        <div className="rounded-lg border border-[color:var(--bp-border)] bg-sky-50 px-2 py-1">{r[0]}</div>
                      </td>
                      <td className="p-3">
                        <div className="rounded-lg border border-[color:var(--bp-border)] bg-sky-50 px-2 py-1">{r[1]}</div>
                      </td>
                      <td className="p-3">
                        <div className="rounded-lg border border-[color:var(--bp-border)] bg-sky-50 px-2 py-1">{r[2]}</div>
                      </td>
                      <td className="p-3">
                        <div className="rounded-lg border border-[color:var(--bp-border)] bg-sky-50 px-2 py-1">{r[3]}</div>
                      </td>
                      <td className="p-3">
                        <div className="rounded-lg border border-[color:var(--bp-border)] bg-sky-50 px-2 py-1">{r[4]}</div>
                      </td>
                      <td className="p-3">
                        <div className="rounded-lg border border-[color:var(--bp-border)] bg-sky-50 px-2 py-1">{r[5]}</div>
                      </td>
                      {/* missing fields highlighted (pink) */}
                      <td className="p-3"><div className="rounded-lg border border-pink-200 bg-pink-50 px-2 py-1">…</div></td>
                      <td className="p-3"><div className="rounded-lg border border-pink-200 bg-pink-50 px-2 py-1">…</div></td>
                      <td className="p-3"><div className="rounded-lg border border-pink-200 bg-pink-50 px-2 py-1">…</div></td>
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

