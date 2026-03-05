"use client";
// /opt/bp-pilot/app/frontend/app/landing/page.tsx
import { useEffect, useRef, useState } from "react";
import "./landing.css";
import { LogoMark } from "../components/logo-mark";
import type { ReactNode } from "react";
import { Badge } from "../components/ui";
import { CheckCircle2, Cog, Eye, FileSpreadsheet, FileText, Landmark, Link2, Sheet, Sparkles, Upload } from "lucide-react";

type FormatItem = { icon: ReactNode; title: string; desc: string };

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
const REVOLVER_VIEWPORT_HEIGHT = 320;
const REVOLVER_CENTER_OFFSET = Math.round((REVOLVER_VIEWPORT_HEIGHT - REVOLVER_CARD_HEIGHT) / 2) + 92;
const FLOW_CHIP_WIDTH = 170;
const FLOW_CHIP_GAP = 16;
const FLOW_CHIP_PITCH = FLOW_CHIP_WIDTH + FLOW_CHIP_GAP;
const FLOW_VIEWPORT_WIDTH = 520;
const FLOW_CENTER_OFFSET = Math.round((FLOW_VIEWPORT_WIDTH - FLOW_CHIP_WIDTH) / 2);
const RULE_CARD_WIDTH = 238;
const RULE_CARD_GAP = 20;
const RULE_CARD_PITCH = RULE_CARD_WIDTH + RULE_CARD_GAP;
const RULE_VIEWPORT_WIDTH = 560;
const RULE_CENTER_OFFSET = Math.round((RULE_VIEWPORT_WIDTH - RULE_CARD_WIDTH) / 2);

const FLOW_ITEMS = [
  { label: "Upload", icon: <Upload className="h-4 w-4" />, tone: "upload" },
  { label: "Preview", icon: <Eye className="h-4 w-4" />, tone: "preview" },
  { label: "Bereinigung", icon: <Sparkles className="h-4 w-4" />, tone: "cleanup" },
  { label: "Tabelle", icon: <Sheet className="h-4 w-4" />, tone: "table" },
];

const RULE_ITEMS = [
  {
    title: "Buchungsregeln",
    desc: "Wiederkehrende Buchungen automatisch vorkontieren.",
    icon: <Cog className="h-5 w-5" />,
    tone: "rule",
  },
  {
    title: "API-Ready Export",
    desc: "Bereinigte Datensätze ohne Umweg direkt an bexio übergeben.",
    icon: <Link2 className="h-5 w-5" />,
    tone: "api",
  },
  {
    title: "Kontrolliert abschliessen",
    desc: "Vor dem Sync klar sehen, was automatisch und was manuell lief.",
    icon: <CheckCircle2 className="h-5 w-5" />,
    tone: "check",
  },
];

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
            Aus Bankdaten werden
            <span className="h1-accent">buchbare Sätze in Minuten.</span>
          </h1>

          <p className="lead">Import, Zuordnung und Buchungsregeln in einem klaren Ablauf.</p>

          <div className="hero-quick-badges">
            <span>Weniger Klicks pro Buchung</span>
            <span>Mehr Konsistenz dank Regeln</span>
            <span>Direkt in bexio ohne Umwege</span>
          </div>

          <div className="hero-actions">
            <a className="btn btn-primary" href="https://app.bp-pilot.ch/upload">
              Jetzt ausprobieren
            </a>
            <a className="btn btn-outline" href="#upload">
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
    <div className="format-row rounded-2xl border border-[color:var(--bp-border)] bg-white p-4">
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

function FlowFeature() {
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

  const currentIndex = progress * (FLOW_ITEMS.length - 1);
  const trackX = FLOW_CENTER_OFFSET - currentIndex * FLOW_CHIP_PITCH;

  return (
    <section className="feature flow-feature" id="preview">
      <div className="flow-scroll-shell" ref={scrollShellRef}>
        <div className="flow-stage-shell" style={stageHeight ? { height: `${stageHeight}px` } : undefined} />
        <div className={`flow-stage flow-stage--${pinState}`} style={stageHeight ? { height: `${stageHeight}px` } : undefined}>
          <div className="container feature-inner flow-feature-inner reverse">
            <div className="feature-copy">
              <div className="kicker">PREVIEW</div>
              <h3 className="h2">Transaktionen prüfen und bereinigen</h3>
              <p className="muted">Boilertext sauber machen, Regeln definieren und den Import stabil vorbereiten.</p>
              <div className="bullets">
                <div className="bullet">
                  <div className="bullet-icon" aria-hidden="true" />
                  <div>
                    <div className="bullet-title">Buchungsregeln statt Wiederholarbeit</div>
                    <div className="muted">Häufige Muster einmal definieren und bei jedem Import wiederverwenden.</div>
                  </div>
                </div>
                <div className="bullet">
                  <div className="bullet-icon" aria-hidden="true" />
                  <div>
                    <div className="bullet-title">Import-bereite Texte</div>
                    <div className="muted">Unklare Verwendungszwecke werden normalisiert, bevor sie in die Tabelle gehen.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="feature-visual flow-visual-shell">
              <div className="visual capability-visual flow-sticky">
                <div className="flow-window">
                  <div className="flow-track" style={{ transform: `translateX(${trackX}px)` }} aria-live="polite">
                    {FLOW_ITEMS.map((item, idx) => {
                      const distance = Math.abs(idx - currentIndex);
                      const opacity = Math.max(0.2, 1 - distance * 0.34);
                      const scale = Math.max(0.86, 1 - distance * 0.06);
                      return (
                        <div key={item.label} className="flow-slide" style={{ opacity, transform: `scale(${scale})` }}>
                          <div className={`flow-pill flow-pill-${item.tone}`}>
                            {item.icon}
                            <span>{item.label}</span>
                          </div>
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

function RulesApiFeature() {
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

  const currentIndex = progress * (RULE_ITEMS.length - 1);
  const trackX = RULE_CENTER_OFFSET - currentIndex * RULE_CARD_PITCH;

  return (
    <section className="feature rules-feature" id="spreadsheet">
      <div className="rules-scroll-shell" ref={scrollShellRef}>
        <div className="rules-stage-shell" style={stageHeight ? { height: `${stageHeight}px` } : undefined} />
        <div
          className={`rules-stage rules-stage--${pinState}`}
          style={stageHeight ? { height: `${stageHeight}px` } : undefined}
        >
          <div className="container feature-inner rules-feature-inner">
            <div className="feature-copy">
              <div className="kicker">AUTOMATISIERUNG</div>
              <h3 className="h2">Buchungsregeln und API-Übergabe ohne Medienbruch</h3>
              <p className="muted">Aus Importdaten werden in einem Lauf kontierbare Datensätze mit konsistenten Regeln.</p>

              <div className="bullets">
                <div className="bullet">
                  <div className="bullet-icon" aria-hidden="true" />
                  <div>
                    <div className="bullet-title">Weniger manuelle Nacharbeit</div>
                    <div className="muted">Regeln greifen automatisch auf ähnliche Buchungen und reduzieren Korrekturschleifen.</div>
                  </div>
                </div>
                <div className="bullet">
                  <div className="bullet-icon" aria-hidden="true" />
                  <div>
                    <div className="bullet-title">Direkter, sauberer Sync</div>
                    <div className="muted">Bereinigte und vorbereitete Datensätze können direkt per API an bexio gehen.</div>
                  </div>
                </div>
              </div>

              <div className="feature-actions">
                <a className="btn btn-primary" href="https://app.bp-pilot.ch/upload">
                  Kostenlos starten
                </a>
              </div>
            </div>

            <div className="feature-visual rules-visual-shell">
              <div className="visual capability-visual rules-sticky">
                <div className="rules-window">
                  <div className="rules-track" style={{ transform: `translateX(${trackX}px)` }} aria-live="polite">
                    {RULE_ITEMS.map((item, idx) => {
                      const distance = Math.abs(idx - currentIndex);
                      const opacity = Math.max(0.25, 1 - distance * 0.35);
                      const scale = Math.max(0.88, 1 - distance * 0.06);
                      return (
                        <div key={item.title} className="rules-slide" style={{ opacity, transform: `scale(${scale})` }}>
                          <div className={`rules-card rules-card-${item.tone}`}>
                            <div className="rules-card-icon">{item.icon}</div>
                            <div className="rules-card-title">{item.title}</div>
                            <div className="rules-card-desc">{item.desc}</div>
                          </div>
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
          <a className="footer-link" href="#upload">
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

        <FormatsFeature />

        <FlowFeature />

        <RulesApiFeature />

        <CtaBand />
      </main>

      <Footer />
    </div>
  );
}
