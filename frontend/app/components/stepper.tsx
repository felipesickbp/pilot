"use client";

import clsx from "clsx";
import { FileUp, Eye, Sparkles, Sheet, CheckCircle } from "lucide-react";

const steps = [
  { key: "Upload", icon: FileUp },
  { key: "Preview", icon: Eye },
  { key: "Cleanup", icon: Sparkles },
  { key: "Spreadsheet", icon: Sheet },
  { key: "Complete", icon: CheckCircle },
];

export function FlowStepper({ active }: { active: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--bp-border)] bg-white/60 p-6">
      <div className="flex items-center justify-between gap-3">
        {steps.map((s, i) => {
          const isActive = s.key === active;
          const Icon = s.icon;

          return (
            <div key={s.key} className="flex flex-1 items-center gap-3">
              <div
                className={clsx(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
                  isActive
                    ? "bg-gradient-to-r from-fuchsia-500 to-blue-500 text-white shadow-sm"
                    : "bg-slate-50 text-slate-700 border border-[color:var(--bp-border)]"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{s.key}</span>
              </div>

              {i < steps.length - 1 && (
                <div className="mx-2 hidden h-[2px] flex-1 bg-[color:var(--bp-border)] md:block" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
