"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());

  useEffect(() => {
    try {
      const stored = String(localStorage.getItem("bp_theme") || "light");
      const theme = stored === "dark" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", theme);
    } catch {}
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
