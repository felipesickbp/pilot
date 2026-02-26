"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, Button, Input, Subhead } from "../components/ui";

type AuthSession = {
  authenticated: boolean;
  email: string;
};

export default function LoginPage() {
  const router = useRouter();
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE || "/api", []);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [step, setStep] = useState<"credentials" | "verify">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${apiBase}/auth/session`, {
          method: "GET",
          credentials: "include",
        });
        if (!r.ok) return;
        const data = (await r.json()) as AuthSession;
        if (!cancelled && data.authenticated) {
          router.replace("/dashboard");
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, router]);

  async function submitCredentials() {
    setError("");
    setHint("");
    setLoading(true);
    try {
      const endpoint = mode === "register" ? "/auth/register" : "/auth/login";
      const payload: any = { email, password };
      if (mode === "register") payload.accept_terms = acceptTerms;

      const r = await fetch(`${apiBase}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.detail || "Authentication failed.");
      }

      setChallengeId(String(data.challenge_id || ""));
      setStep("verify");
      setHint("Verification code sent to your email.");
    } catch (e: any) {
      setError(e?.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode() {
    setError("");
    setHint("");
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/auth/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId, code }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.detail || "Verification failed.");
      }

      router.replace("/dashboard");
    } catch (e: any) {
      setError(e?.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="text-sm font-semibold">BP Pilot</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {step === "verify" ? "E-Mail verifizieren" : mode === "register" ? "Konto erstellen" : "Einloggen"}
          </h1>
          <Subhead>
            {step === "verify"
              ? "Bitte den 6-stelligen Code aus der E-Mail eingeben."
              : "Sicherer Login mit E-Mail, Passwort und 2-Faktor-Code."}
          </Subhead>
        </CardHeader>

        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-pink-200 bg-pink-50 px-3 py-2 text-sm text-pink-700">{error}</div>
          ) : null}
          {hint ? (
            <div className="rounded-xl border border-[color:var(--bp-border)] bg-slate-50 px-3 py-2 text-sm text-slate-600">{hint}</div>
          ) : null}

          {step === "credentials" ? (
            <>
              <div className="flex rounded-xl border border-[color:var(--bp-border)] bg-slate-50 p-1">
                <button
                  type="button"
                  className={`flex-1 rounded-lg px-3 py-2 text-sm ${mode === "login" ? "bg-white" : ""}`}
                  onClick={() => setMode("login")}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-lg px-3 py-2 text-sm ${mode === "register" ? "bg-white" : ""}`}
                  onClick={() => setMode("register")}
                >
                  Registrierung
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">E-Mail</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@firma.ch" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Passwort</label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mind. 10 Zeichen" type="password" />
              </div>

              {mode === "register" ? (
                <label className="flex items-start gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                  />
                  <span>
                    Ich stimme den <a className="text-blue-600" href="https://bp-pilot.ch/terms" target="_blank" rel="noreferrer">Terms & Agreements</a> zu.
                  </span>
                </label>
              ) : null}

              <Button className="w-full" onClick={submitCredentials} disabled={loading}>
                {loading ? "Senden..." : mode === "register" ? "Code senden" : "Login-Code senden"}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">6-stelliger Code</label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => setStep("credentials")} disabled={loading}>
                  Zurück
                </Button>
                <Button onClick={submitCode} disabled={loading}>
                  {loading ? "Prüfen..." : "Verifizieren"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
