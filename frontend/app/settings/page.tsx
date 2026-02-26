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

  async function onChangePassword() {
    setError("");
    setSuccess("");
    if (!currentPassword || !newPassword) {
      setError("Please fill out current and new password.");
      return;
    }
    if (newPassword.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password confirmation does not match.");
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
      if (!r.ok) throw new Error(data?.detail || "Could not change password.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password changed successfully.");
    } catch (e: any) {
      setError(e?.message || "Could not change password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell active="">
      <div className="mb-6">
        <div className="text-3xl font-semibold">Settings</div>
        <Subhead>Manage account security for your Pilot workspace.</Subhead>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <div className="text-sm font-semibold">Account</div>
          <Subhead>{email ? `Signed in as ${email}` : "Signed-in user"}</Subhead>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-pink-200 bg-pink-50 px-3 py-2 text-sm text-pink-700">{error}</div>
          ) : null}
          {success ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Current password</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">New password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 10 characters"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Confirm new password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
            />
          </div>

          <Button className="w-full" onClick={onChangePassword} disabled={loading || !csrfToken}>
            {loading ? "Updating..." : "Change password"}
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
