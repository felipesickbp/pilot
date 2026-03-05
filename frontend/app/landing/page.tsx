"use client";
// /opt/bp-pilot/app/frontend/app/landing/page.tsx
import { useEffect, useRef, useState } from "react";
import "./landing.css";
import { LogoMark } from "../components/logo-mark";
import type { ReactNode } from "react";
import { Badge } from "../components/ui";
import { FileSpreadsheet, FileText, Landmark } from "lucide-react";

type Bullet = { title: string; text: string };
type FormatItem = { icon: ReactNode; title: string; desc: string };

const PREVIEWS = {
  upload: "/landing/step-upload.png",
  preview: "/landing/step-preview.png",
  spreadsheet: "/landing/step-spreadsheet.png",
};

const FORMAT_ITEMS: FormatItem[] = [
  {
    icon: <FileText className="h-5 w-5" />,
    title: "CSV Files",
    desc: "Verarbeitet Metazeilen, verschobene Header und Exporte ohne Kopfzeile.",
  },
  {
    icon: <FileSpreadsheet className="h-5 w-5" />,
    title: "Excel-Dateien",
    desc: "Liest Arbeitsblätter und schlägt mehrere mögliche Header-Zeilen vor.",
  },
  {
    icon: <Landmark className="h-5 w-5" />,
    title: "CAMT.053",
    desc: "CAMT-XML wird weiterhin unterstützt.",
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: "Bereinigungsfreundlich",
    desc: "Textbereinigung erfolgt bewusst erst im Schritt Bereinigung.",
  },
];
const REVOLVER_CARD_HEIGHT = 132;
const REVOLVER_GAP = 16;
const REVOLVER_PITCH = REVOLVER_CARD_HEIGHT + REVOLVER_GAP;
const REVOLVER_VIEWPORT_HEIGHT = 260;
const REVOLVER_CENTER_OFFSET = Math.round((REVOLVER_VIEWPORT_HEIGHT - REVOLVER_CARD_HEIGHT) / 2) + 92;

function Header() {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <a className="brand" href="#top" aria-label="bp-pilot home">
          <span className="brand-mark">
            <LogoMark size={36} />
          </span>
          <span className="brand-text">
            <span className="brand-name">bp-pilot</span>
            <span className="brand-sub">Kontierung mit KI-Unterstützung</span>
          </span>
        </a>

        <div className="topbar-cta">
          <a className="btn btn-outline" href="https://app.bp-pilot.ch/login">
            Login
          </a>
          <a className="btn btn-primary" href="https://app.bp-pilot.ch/upload">
            Kostenlos starten
          </a>
        </div>
      </div>
    </header>
  );
}

function Shot({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(15, 23, 42, 0.08)",
        background: "rgba(255,255,255,0.6)",
      }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    </div>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-bg" aria-hidden="true" />
      <div className="hero-lines" aria-hidden="true" />
      <div className="hero-orbit hero-orbit-a" aria-hidden="true" />
      <div className="hero-orbit hero-orbit-b" aria-hidden="true" />

      <div className="container hero-inner">
        <div className="hero-center">
          <span className="badge">
            <strong>4.8 Bewertungen</strong>
            <span className="dot" />
            <span>für moderne Buchhaltungs-Teams</span>
          </span>

          <h1 className="h1">
            Schnellere Kontierung.
            <span className="h1-accent">Saubere Buchungen direkt in bexio.</span>
          </h1>

          <p className="lead">Import, Zuordnung und Buchungsregeln in einem klaren Ablauf.</p>

          <div className="hero-kpi-row">
            <div className="hero-kpi"><strong>Weniger Klicks</strong><span>pro Buchung</span></div>
            <div className="hero-kpi"><strong>Mehr Konsistenz</strong><span>dank Regeln</span></div>
            <div className="hero-kpi"><strong>Direkt in bexio</strong><span>ohne Umwege</span></div>
          </div>

          <div className="hero-actions">
            <a className="btn btn-primary" href="https://app.bp-pilot.ch/upload">
              Jetzt ausprobieren
            </a>
            <a className="btn btn-outline" href="#product">
              Produkt entdecken
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function LogoRow() {
  return null;
}

function FormatRow({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="format-row rounded-2xl border border-[color:var(--bp-border)] bg-white p-4 ring-1 ring-fuchsia-200">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-slate-400">{icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">{title}</div>
            <Badge variant="blue">Enabled</Badge>
          </div>
          <div className="text-sm text-slate-500">{desc}</div>
        </div>
      </div>
    </div>
  );
}

function FormatsFeature() {
  type PinState = "before" | "pinned" | "after";
  const [progress, setProgress] = useState(0);
  const [pinState, setPinState] = useState<PinState>("before");
  const [stageHeight, setStageHeight] = useState(0);
  const scrollShellRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const getPinTop = () => {
      const raw = window.getComputedStyle(document.documentElement).getPropertyValue("--formats-pin-top");
      const parsed = Number.parseFloat(raw);
      return Number.isFinite(parsed) ? parsed : 72;
    };

    const updateProgress = () => {
      rafRef.current = null;
      const shell = scrollShellRef.current;
      if (!shell) return;

      const rect = shell.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const pinTop = getPinTop();
      const nextStageHeight = Math.max(320, viewport - pinTop);
      const travel = Math.max(rect.height - nextStageHeight, 1);
      const raw = (pinTop - rect.top) / travel;
      const next = Math.max(0, Math.min(1, raw));
      setProgress((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
      setStageHeight((prev) => (Math.abs(prev - nextStageHeight) < 0.5 ? prev : nextStageHeight));
      const nextPinState: PinState = raw <= 0 ? "before" : raw >= 1 ? "after" : "pinned";
      setPinState((prev) => (prev === nextPinState ? prev : nextPinState));
    };

    const requestUpdate = () => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(updateProgress);
    };

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const currentIndex = progress * (FORMAT_ITEMS.length - 1);
  const trackY = REVOLVER_CENTER_OFFSET - currentIndex * REVOLVER_PITCH;

  return (
    <section className="feature formats-feature" id="upload">
      <div className="formats-scroll-shell" ref={scrollShellRef}>
        <div className="formats-stage-shell" style={stageHeight ? { height: `${stageHeight}px` } : undefined} />
        <div
          className={`formats-stage formats-stage--${pinState}`}
          style={stageHeight ? { height: `${stageHeight}px` } : undefined}
        >
          <div className="container feature-inner formats-feature-inner">
            <div className="feature-copy">
              <div className="kicker">UPLOAD</div>
              <h3 className="h2">Alle gängigen Formate direkt einlesen</h3>
              <p className="muted">CSV, Excel oder CAMT: bp-pilot startet ohne starre Templates.</p>
              <div className="bullets">
                <div className="bullet">
                  <div className="bullet-icon" aria-hidden="true" />
                  <div>
                    <div className="bullet-title">Weniger Vorarbeit</div>
                    <div className="muted">Auch uneinheitliche Exporte sind direkt nutzbar.</div>
                  </div>
                </div>
                <div className="bullet">
                  <div className="bullet-icon" aria-hidden="true" />
                  <div>
                    <div className="bullet-title">Schneller zum Mapping</div>
                    <div className="muted">Erkannte Formate landen direkt im passenden Schritt.</div>
                  </div>
                </div>
              </div>
              <div className="feature-actions">
                <a className="btn btn-primary" href="https://app.bp-pilot.ch/upload">
                  Kostenlos starten
                </a>
              </div>
            </div>

            <div className="feature-visual formats-visual-shell">
              <div className="visual capability-visual formats-sticky">
                <div className="formats-revolver">
                  <div className="formats-track" style={{ transform: `translateY(${trackY}px)` }} aria-live="polite">
                    {FORMAT_ITEMS.map((item, idx) => {
                      const delta = idx - currentIndex;
                      const distance = Math.min(Math.abs(delta), 3);
                      const opacity = Math.max(0.1, 1 - distance * 0.42);
                      const scale = Math.max(0.78, 1 - distance * 0.08);
                      const xShift = delta * 14;
                      return (
                        <div
                          key={item.title}
                          className="formats-slide"
                          style={{ opacity, transform: `translateX(${xShift}px) scale(${scale})` }}
                        >
                          <FormatRow icon={item.icon} title={item.title} desc={item.desc} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureBlock(props: {
  kicker: string;
  title: string;
  description: string;
  bullets: Bullet[];
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
  reverse?: boolean;
  visual?: ReactNode;
}) {
  const { kicker, title, description, bullets, primary, secondary, reverse, visual } = props;

  return (
    <section className="feature" id={kicker.toLowerCase()}>
      <div className={`container feature-inner ${reverse ? "reverse" : ""}`}>
        <div className="feature-copy">
          <div className="kicker">{kicker}</div>
          <h3 className="h2">{title}</h3>
          <p className="muted">{description}</p>

          <div className="bullets">
            {bullets.map((b) => (
              <div key={b.title} className="bullet">
                <div className="bullet-icon" aria-hidden="true" />
                <div>
                  <div className="bullet-title">{b.title}</div>
                  <div className="muted">{b.text}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="feature-actions">
            {primary && (
              <a className="btn btn-primary" href={primary.href}>
                {primary.label}
              </a>
            )}
            {secondary && (
              <a className="btn btn-outline" href={secondary.href}>
                {secondary.label}
              </a>
            )}
          </div>
        </div>

        <div className="card feature-visual">
          <div className="visual capability-visual">{visual || <div style={{ width: "100%", height: "100%" }} />}</div>
        </div>
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="cta">
      <div className="container cta-inner">
        <div className="cta-copy">
          <h3 className="h2">Alles im Blick – jederzeit.</h3>
          <p>Von unstrukturierten Bankdaten zu einer klaren, buchbaren Tabelle.</p>
          <div className="cta-actions">
            <a className="btn btn-primary" href="https://app.bp-pilot.ch/upload">
              Kostenlos starten
            </a>
            <a className="btn btn-outline" href="https://app.bp-pilot.ch/login">
              Login
            </a>
          </div>
        </div>

        <div className="cta-card">
          <div className="cta-point">Automatische Erkennung von Spalten und Betragslogik</div>
          <div className="cta-point">Buchungsregeln pro Mandant wiederverwenden</div>
          <div className="cta-point">Direkte Vorbereitung für den Bexio-Import</div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <div className="footer-brand">
            <span className="brand-mark">
              <LogoMark size={32} />
            </span>
            <strong>bp-pilot</strong>
          </div>
          <p className="muted">Assistiert bei der aufwändigen Kontierung und verbindet den Workflow direkt mit bexio.</p>
        </div>

        <div>
          <div className="footer-head">Produkt</div>
          <a className="footer-link" href="#product">
            Übersicht
          </a>
          <a className="footer-link" href="#solutions">
            Use Cases
          </a>
        </div>

        <div>
          <div className="footer-head">Use Cases</div>
          <a className="footer-link" href="https://burkhart-partners.ch/" target="_blank" rel="noreferrer">
            Treuhand
          </a>
          <a className="footer-link" href="#solutions">
            KMU Finance
          </a>
        </div>

        <div>
          <div className="footer-head">Rechtliches</div>
          <a className="footer-link" href="/nutzungsbedingungen">
            Nutzungsbedingungen
          </a>
          <a className="footer-link" href="/impressum">
            Impressum
          </a>
          <a className="footer-link" href="/datenschutz">
            Datenschutz
          </a>
        </div>
      </div>

      <div className="footer-bottom">© {new Date().getFullYear()} bp-pilot. All rights reserved.</div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="page">
      <Header />

      <main>
        <Hero />
        <LogoRow />

        <div id="product" className="container section-head">
          <h2 className="h2 center">Von Bankdaten zu buchbaren Sätzen</h2>
          <p className="muted center">Import. Zuordnung. Kontierung.</p>
        </div>

        <FormatsFeature />

        <FeatureBlock
          kicker="PREVIEW"
          title="Transaktionen prüfen und bereinigen"
          description="Buchungstexte normalisieren und Qualität sichern. Regeln einmal definieren und wiederverwenden."
          bullets={[
            { title: "TLV/TSV Reihenfolge", text: "Direktimport mit Datum, Text, Betrag, Währung, FX, Soll, Haben, MWST-Code, MWST-Konto." },
            { title: "Tenant-spezifische MWST", text: "MWST-Codes werden je bexio-Mandant aufgelöst (nicht global hartcodiert)." },
          ]}
          primary={{ label: "Kostenlos starten", href: "https://app.bp-pilot.ch/upload" }}
          reverse
          visual={<Shot src={PREVIEWS.preview} alt="Preview & Mapping Screenshot" />}
        />

        <FeatureBlock
          kicker="SPREADSHEET"
          title="Buchungsregeln anwenden und kontieren"
          description="Konten zuordnen und Buchungen regelbasiert beschleunigen. Kontierte Zeilen direkt nach bexio übergeben."
          bullets={[
            { title: "Regelvorschau", text: "Treffer und Nicht-Treffer werden vor dem Export transparent dargestellt." },
            { title: "Direktimport", text: "TLV direkt einfügen, prüfen und ohne Medienbruch in die Tabelle übernehmen." },
          ]}
          primary={{ label: "Kostenlos starten", href: "https://app.bp-pilot.ch/upload" }}
          visual={<Shot src={PREVIEWS.spreadsheet} alt="Spreadsheet Screenshot" />}
        />

        <CtaBand />
      </main>

      <Footer />
    </div>
  );
}
