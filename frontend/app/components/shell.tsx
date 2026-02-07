"use client";

import Link from "next/link";
import clsx from "clsx";
import { Settings } from "lucide-react";
import React from "react";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload Files" },
  { href: "/posting-rules", label: "Posting Rules" },
  { href: "/clients", label: "Direct Import" },
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
              {/* simple logo block */}
              <span className="text-sm font-bold">BP</span>
            </div>
            <div>
              <div className="text-sm font-semibold">BexioFlow</div>
              <div className="text-xs text-slate-500">Transaction Processing</div>
            </div>
          </div>

          <button className="rounded-xl p-2 hover:bg-slate-100" aria-label="Settings">
            <Settings className="h-5 w-5 text-slate-600" />
          </button>
        </div>
      </header>

      {/* page wrapper */}
      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* hero */}
        <div className="mb-6">
          <h1 className="text-4xl font-semibold tracking-tight">
            Bexio Transaction Processing
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Upload, process, and manage financial transactions for seamless Bexio integration
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
