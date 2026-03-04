"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../components/shell";
import { Card, CardContent, CardHeader, Subhead } from "../components/ui";

export default function DirectImportRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/upload?mode=direct");
  }, [router]);

  return (
    <AppShell active="Upload">
      <Card>
        <CardHeader>
          <div className="text-lg font-semibold">Direktimport wurde verschoben</div>
          <Subhead>Direktimport ist jetzt Teil der Upload-Seite.</Subhead>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">Weiterleitung zu Upload ...</CardContent>
      </Card>
    </AppShell>
  );
}
