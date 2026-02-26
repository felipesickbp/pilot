"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/shell";
import { Button, Card, CardContent, CardHeader, Input, Subhead } from "../components/ui";

type AuthSession = {
  authenticated: boolean;
  email: string;
};

export default function SettingsPage() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE || "/api", []);
  const [csrfToken, setCsrfToken] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const csrf = await fetch(`${apiBase}/auth/csrf`, { method: "GET", credentials: "include" });
        const csrfData = await csrf.json().catch(() => ({}));
        if (!cancelled) setCsrfToken(String(csrfData?.csrf_token || ""));
        const sessionResp = await fetch(`${apiBase}/auth/session`, { method: "GET", credentials: "include" });
        const sessionData = (await sessionResp.json().catch(() => ({}))) as AuthSession;
        if (!cancelled) setEmail(String(sessionData?.email || ""));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    try {
      const stored = String(localStorage.getItem("bp_theme") || "light");
      const next = stored === "dark" ? "dark" : "light";
      setTheme(next);
      document.documentElement.setAttribute("data-theme", next);
    } catch {}
  }, []);

  function onThemeChange(next: "light" | "dark") {
    setTheme(next);
    try {
      localStorage.setItem("bp_theme", next);
    } catch {}
    document.documentElement.setAttribute("data-theme", next);
  }

  async function onChangePassword() {
    setError("");
    setSuccess("");
    if (!currentPassword || !newPassword) {
      setError("Bitte aktuelles und neues Passwort ausfüllen.");
      return;
    }
    if (newPassword.length < 10) {
      setError("Passwort muss mindestens 10 Zeichen lang sein.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Die Passwort-Bestätigung stimmt nicht überein.");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/auth/password/change`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "Passwort konnte nicht geändert werden.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Passwort erfolgreich geändert.");
    } catch (e: any) {
      setError(e?.message || "Passwort konnte nicht geändert werden.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell active="">
      <div className="mb-6">
        <div className="text-3xl font-semibold">Einstellungen</div>
        <Subhead>Sicherheits- und Darstellungsoptionen für deinen Pilot-Workspace.</Subhead>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <div className="text-sm font-semibold">Konto</div>
          <Subhead>{email ? `Angemeldet als ${email}` : "Angemeldeter Benutzer"}</Subhead>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-pink-200 bg-pink-50 px-3 py-2 text-sm text-pink-700">{error}</div>
          ) : null}
          {success ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
          ) : null}

          <div className="rounded-xl border border-[color:var(--bp-border)] p-3">
            <div className="text-sm font-semibold">Darstellung</div>
            <div className="mt-2 flex gap-2">
              <Button variant={theme === "light" ? "primary" : "outline"} onClick={() => onThemeChange("light")}>
                Hell
              </Button>
              <Button variant={theme === "dark" ? "primary" : "outline"} onClick={() => onThemeChange("dark")}>
                Dunkel
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Aktuelles Passwort</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Aktuelles Passwort"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Neues Passwort</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mindestens 10 Zeichen"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Neues Passwort bestätigen</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Neues Passwort wiederholen"
            />
          </div>

          <Button className="w-full" onClick={onChangePassword} disabled={loading || !csrfToken}>
            {loading ? "Aktualisiere..." : "Passwort ändern"}
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
