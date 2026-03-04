"use client";
// /opt/bp-pilot/app/frontend/app/landing/page.tsx
import "./landing.css";
import { LogoMark } from "../components/logo-mark";

type Bullet = { title: string; text: string };

const PREVIEWS = {
  upload: "/landing/step-upload.png",
  preview: "/landing/step-preview.png",
  spreadsheet: "/landing/step-spreadsheet.png",
};

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

          <p className="lead">
            bp-pilot verbindet Import, Mapping und Buchungsregeln in einem klaren Workflow.
          </p>

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

          <div className="device">
            <div className="device-grid">
              {[
                { label: "1. Upload", src: PREVIEWS.upload, alt: "Upload Preview" },
                { label: "2. Preview", src: PREVIEWS.preview, alt: "Preview Preview" },
                { label: "3. Spreadsheet", src: PREVIEWS.spreadsheet, alt: "Spreadsheet Preview" },
              ].map((x) => (
                <div key={x.label} className="device-card">
                  <div className="device-label">{x.label}</div>
                  <div
                    className="device-blank"
                    style={{
                      padding: 10,
                      height: 170, // feel free to tweak
                    }}
                  >
                    <Shot src={x.src} alt={x.alt} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 10 }} className="muted center">
            *Previews aus dem Live-Produkt (app.bp-pilot.ch)
          </div>
        </div>
      </div>
    </section>
  );
}

function LogoRow() {
  return null;
}

function FeatureBlock(props: {
  kicker: string;
  title: string;
  description: string;
  bullets: Bullet[];
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
  reverse?: boolean;
  imageSrc?: string;
  imageAlt?: string;
}) {
  const { kicker, title, description, bullets, primary, secondary, reverse, imageSrc, imageAlt } = props;

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
          <div
            className="visual"
            style={{
              padding: 12,
              height: 340, // feel free to tweak
            }}
          >
            {imageSrc ? (
              <Shot src={imageSrc} alt={imageAlt || `${kicker} Preview`} />
            ) : (
              <div style={{ width: "100%", height: "100%" }} />
            )}
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

        <FeatureBlock
          kicker="UPLOAD"
          title="Dateien hochladen und strukturiert starten"
          description="Bankdaten importieren und sofort mit strukturierten Zeilen arbeiten. CSV, XLSX oder CAMT einlesen und sauber strukturieren."
          bullets={[
            { title: "Bank-unabhängig", text: "Variierende Spalten werden robust erkannt." },
            { title: "Mandantenkontext", text: "Verarbeitung im verbundenen bexio-Mandanten." },
          ]}
          primary={{ label: "Kostenlos starten", href: "https://app.bp-pilot.ch/upload" }}
          imageSrc={PREVIEWS.upload}
          imageAlt="Upload Wizard Screenshot"
        />

        <FeatureBlock
          kicker="PREVIEW"
          title="Transaktionen prüfen und bereinigen"
          description="Buchungstexte normalisieren und Kontierungsqualität sichern. Buchungsregeln einmal definieren und wiederkehrend anwenden."
          bullets={[
            { title: "Klare Betragslogik", text: "Soll/Haben-ready für den Import." },
            { title: "Cleanup-Regeln", text: "Wiederkehrende Muster automatisch entfernen." },
          ]}
          primary={{ label: "Kostenlos starten", href: "https://app.bp-pilot.ch/upload" }}
          reverse
          imageSrc={PREVIEWS.preview}
          imageAlt="Preview & Mapping Screenshot"
        />

        <FeatureBlock
          kicker="SPREADSHEET"
          title="Buchungsregeln anwenden und kontieren"
          description="Konten zuordnen und Buchungen regelbasiert beschleunigen. Kontierte Zeilen direkt in den bexio-Mandanten übergeben."
          bullets={[
            { title: "Schnellere Kontierung", text: "Kontonummer oder Name suchen und übernehmen." },
            { title: "Weniger Handarbeit", text: "Soll/Haben per Regel vorbefüllen." },
          ]}
          primary={{ label: "Kostenlos starten", href: "https://app.bp-pilot.ch/upload" }}
          imageSrc={PREVIEWS.spreadsheet}
          imageAlt="Spreadsheet Screenshot"
        />

        <CtaBand />
      </main>

      <Footer />
    </div>
  );
}
