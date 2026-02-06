import Link from "next/link";

const steps = [
  { href: "/login", label: "Login" },
  { href: "/upload", label: "Upload" },
  { href: "/preview", label: "Preview" },
  { href: "/cleanup", label: "Cleanup" },
  { href: "/spreadsheet", label: "Spreadsheet" },
  { href: "/complete", label: "Complete" },
];

export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Accounting Copilot</h1>
      <p style={{ opacity: 0.7 }}>Live UI skeleton (Next.js) – deploys on every Git push.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        {steps.map(s => (
          <Link key={s.href} href={s.href} style={{
            border: "1px solid #ddd", borderRadius: 12, padding: "10px 14px",
            textDecoration: "none", color: "#111"
          }}>
            {s.label}
          </Link>
        ))}
      </div>
    </main>
  );
}
