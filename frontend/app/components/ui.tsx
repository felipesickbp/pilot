"use client";

import React from "react";
import clsx from "clsx";

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={clsx(
        "rounded-2xl border bg-white/90 backdrop-blur",
        "border-[color:var(--bp-border)] shadow-sm",
        props.className
      )}
    />
  );
}

export function CardHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={clsx("p-6 pb-3", props.className)} />;
}

export function CardContent(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={clsx("p-6 pt-3", props.className)} />;
}

export function H1(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      {...props}
      className={clsx("text-4xl font-semibold tracking-tight", props.className)}
    />
  );
}

export function Subhead(props: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      {...props}
      className={clsx("text-sm text-slate-500", props.className)}
    />
  );
}

export function Badge({
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "pink" | "blue" }) {
  const styles =
    variant === "pink"
      ? "bg-pink-50 text-pink-600 border-pink-200"
      : variant === "blue"
      ? "bg-sky-50 text-sky-600 border-sky-200"
      : "bg-slate-50 text-slate-600 border-slate-200";

  return (
    <span
      {...props}
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        styles,
        props.className
      )}
    />
  );
}

export function Button({
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition";

  const styles =
    variant === "primary"
      ? "text-white shadow-sm bg-gradient-to-r from-fuchsia-500 to-blue-500 hover:opacity-95"
      : variant === "outline"
      ? "border border-[color:var(--bp-border)] bg-white hover:bg-slate-50"
      : "bg-transparent hover:bg-slate-100";

  return <button {...props} className={clsx(base, styles, props.className)} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none",
        "border-[color:var(--bp-border)] focus:ring-2 focus:ring-fuchsia-200",
        props.className
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        "h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none",
        "border-[color:var(--bp-border)] focus:ring-2 focus:ring-fuchsia-200",
        props.className
      )}
    />
  );
}
