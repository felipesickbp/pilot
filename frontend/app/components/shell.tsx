"use client";

import Link from "next/link";
import clsx from "clsx";
import React, { useEffect, useMemo, useState } from "react";
import { Settings } from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload Files" },
  { href: "/posting-rules", label: "Posting Rules" },
  { href: "/direct-import", label: "Direct Import" },
  { href: "/history", label: "History" },
];

export function AppShell({
  active,
  children,
}: {
  active?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {/* top bar */}
      <header className="border-b border-[color:var(--bp-border)] bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-blue-500 text-white">
              <span className="text-sm font-bold">BP</span>
            </div>
            <div>
              <div className="text-sm font-semibold">Pilot</div>
              <div className="text-xs text-slate-500">Intelligent Accounting Workflow</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--bp-border)] bg-white text-slate-600 hover:bg-slate-50"
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <BexioConnectButton />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* page wrapper */}
      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* hero */}
        <div className="mb-6">
          <h1 className="text-4xl font-semibold tracking-tight">
            Pilot Workspace
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Upload, classify, and import transactions with intelligent rules for Bexio
          </p>
        </div>

        {/* pill nav */}
        <nav className="mb-10">
          <div className="flex w-full items-center justify-between rounded-2xl bg-[color:var(--bp-pill)] p-1">
            {nav.map((item) => {
              const isActive = active === item.label;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex-1 rounded-xl px-4 py-2 text-center text-sm font-medium",
                    isActive
                      ? "bg-white shadow-sm"
                      : "text-slate-700 hover:bg-white/60"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {children}
      </main>
    </div>
  );
}

type BexioSession = {
  connected: boolean;
  client_name: string;
};

function BexioConnectButton() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE || "/api", []);
  const [session, setSession] = useState<BexioSession>({ connected: false, client_name: "" });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${apiBase}/bexio/session`, {
          method: "GET",
          credentials: "include",
        });
        if (!r.ok) return;
        const data = (await r.json()) as BexioSession;
        if (!cancelled) {
          setSession({
            connected: !!data.connected,
            client_name: data.client_name || "",
          });
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  async function onConnect() {
    try {
      setConnecting(true);
      const reconnect = session.connected ? "true" : "false";
      const r = await fetch(`${apiBase}/bexio/connect?reconnect=${reconnect}`, {
        method: "GET",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to start bexio login.");
      const data = (await r.json()) as { auth_url?: string };
      if (!data.auth_url) throw new Error("Missing auth URL.");
      window.location.href = data.auth_url;
    } catch (e) {
      setConnecting(false);
      console.error(e);
      alert("Could not start bexio login.");
    }
  }

  const label = connecting
    ? "Connecting..."
    : session.connected && session.client_name
      ? session.client_name
      : "Connect to bexio";

  return (
    <button
      type="button"
      onClick={onConnect}
      disabled={connecting || loading}
      className="max-w-[320px] truncate rounded-xl border border-[color:var(--bp-border)] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      title={label}
      aria-label={session.connected ? "Reconnect bexio" : "Connect to bexio"}
    >
      {loading ? "Connect to bexio" : label}
    </button>
  );
}

function LogoutButton() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE || "/api", []);
  const [csrfToken, setCsrfToken] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${apiBase}/auth/csrf`, {
          method: "GET",
          credentials: "include",
        });
        const data = await r.json().catch(() => ({}));
        if (!cancelled) setCsrfToken(String(data?.csrf_token || ""));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  async function onLogout() {
    if (!csrfToken || loggingOut) return;
    try {
      setLoggingOut(true);
      await fetch(`${apiBase}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
      });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={!csrfToken || loggingOut}
      className="rounded-xl border border-[color:var(--bp-border)] bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      title="Logout"
      aria-label="Logout"
    >
      {loggingOut ? "Logging out..." : "Logout"}
    </button>
  );
}
