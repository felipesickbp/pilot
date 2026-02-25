import { AppShell } from "../components/shell";
import { Card, CardContent, CardHeader, Subhead, Button } from "../components/ui";
import { Users, FileText, ListChecks, Settings } from "lucide-react";

export default function DashboardPage() {
  return (
    <AppShell active="Dashboard">
      <div className="grid gap-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <Stat title="Total Clients" value="0" note="Active Bexio connections" icon={<Users className="h-5 w-5" />} />
          <Stat title="Processed Files" value="0" note="Files uploaded and processed" icon={<FileText className="h-5 w-5" />} />
          <Stat title="Total Transactions" value="0" note="Ready for Bexio import" icon={<ListChecks className="h-5 w-5" />} />
          <Stat title="Processing Rules" value="Active" note="Automated account assignment" icon={<Settings className="h-5 w-5" />} />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="text-sm font-semibold">Recent Files</div>
              <Subhead>Latest uploaded transaction files</Subhead>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-500">No files uploaded yet</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm font-semibold">Quick Actions</div>
              <Subhead>Common tasks and workflows</Subhead>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Action title="Upload New File" desc="Process CSV, XLSX, or CAMT.053 files" href="/upload" />
              <Action title="Manage Posting Rules" desc="Configure automatic account assignments" href="/posting-rules" />
              <Action title="Direct Import" desc="Paste TSV and send to Bexio" href="/direct-import" />
              <div className="pt-2">
                <Button className="w-full">Open Upload Flow</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ title, value, note, icon }: { title: string; value: string; note: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-slate-400">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
        <div className="text-sm text-slate-500">{note}</div>
      </CardContent>
    </Card>
  );
}

function Action({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <a href={href} className="rounded-2xl border border-[color:var(--bp-border)] bg-white p-4 hover:bg-slate-50">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-sm text-slate-500">{desc}</div>
    </a>
  );
}
