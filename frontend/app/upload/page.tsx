import { AppShell } from "../components/shell";
import { FlowStepper } from "../components/stepper";
import { Badge, Button, Card, CardContent, CardHeader, Select, Subhead } from "../components/ui";
import { UploadCloud, FileSpreadsheet, FileText, Landmark } from "lucide-react";

export default function UploadPage() {
  return (
    <AppShell active="Upload Files">
      <div className="mb-6">
        <div className="text-3xl font-semibold">Upload Transaction Files</div>
        <Subhead>Process CSV, XLSX, PDF, and CAMT.053 files for Bexio integration</Subhead>
      </div>

      <div className="mb-8">
        <FlowStepper active="Upload" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UploadCloud className="h-5 w-5 text-slate-500" />
              File Upload
            </div>
            <Subhead>Select a transaction file and configure processing options</Subhead>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Bexio Client</div>
              <Select defaultValue="muster">
                <option value="muster">Muster Klient</option>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">VAT Status Confirmation</div>
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="vat" defaultChecked /> With VAT <Badge variant="pink">VAT</Badge>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="vat" /> Without VAT
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-[color:var(--bp-border)] bg-white p-10 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50">
                <FileText className="h-5 w-5 text-slate-500" />
              </div>
              <div className="text-sm font-medium">Click to select a file or drag and drop</div>
              <div className="mt-1 text-xs text-slate-500">
                Supports CSV, XLSX, PDF, and CAMT.053 formats
              </div>
            </div>

            <Button className="w-full">Process File</Button>
          </CardContent>
        </Card>

        <Card className="border-pink-200">
          <CardHeader>
            <div className="text-sm font-semibold">Supported File Formats</div>
            <Subhead>Information about supported transaction file formats</Subhead>
          </CardHeader>
          <CardContent className="grid gap-3">
            <FormatRow icon={<FileText className="h-5 w-5" />} title="CSV Files" desc="Comma-separated values with standard transaction columns" />
            <FormatRow icon={<FileSpreadsheet className="h-5 w-5" />} title="Excel Files" desc="XLSX and XLS spreadsheets with transaction data" />
            <FormatRow icon={<FileText className="h-5 w-5" />} title="PDF Files" desc="Bank statements and transaction reports in PDF format" />
            <FormatRow icon={<Landmark className="h-5 w-5" />} title="CAMT.053" desc="ISO 20022 bank statement format for automated processing" />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function FormatRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--bp-border)] bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-slate-400">{icon}</div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-sm text-slate-500">{desc}</div>
        </div>
      </div>
    </div>
  );
}
