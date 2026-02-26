// /opt/bp-pilot/app/frontend/app/landing/page.tsx
import "./landing.css";

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
        <a className="brand" href="#top" aria-label="Pilot home">
          <span className="brand-mark">BP</span>
          <span className="brand-text">
            <span className="brand-name">Pilot</span>
            <span className="brand-sub">Intelligent Finance Workflow</span>
          </span>
        </a>

        <nav className="nav">
          <a href="#product" className="navlink">
            Produkt
          </a>
          <a href="#solutions" className="navlink">
            Lösungen
          </a>
          <a href="#resources" className="navlink">
            Ressourcen
          </a>
        </nav>

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

      <div className="container hero-inner">
        <div className="hero-center">
          <span className="badge">
            <strong>4.8 Rating</strong>
            <span className="dot" />
            <span>für moderne Buchhaltungs-Teams</span>
          </span>

          <h1 className="h1">
            Bankauszüge intelligent verarbeiten.
            <span className="h1-accent">Buchhaltung schneller abschliessen.</span>
          </h1>

          <p className="lead">
            Pilot verbindet Import, Bereinigung, Buchungsregeln und Kontierung in einem Ablauf. Weniger manuelle
            Klicks, weniger Fehler, mehr Tempo für Treuhand und Finance-Teams.
          </p>

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
  return (
    <section className="logos">
      <div className="container">
        <p className="muted center">
          Für Schweizer Treuhand und Buchhaltungs-Teams: strukturierte Transaktionsdaten statt Copy-Paste-Chaos.
        </p>
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
        <div>
          <h3 className="h2 invert">Alles im Blick – jederzeit.</h3>
          <p className="muted invert">
            Von unstrukturierten Bankdaten zu einer klaren, buchbaren Tabelle mit wiederverwendbaren Buchungsregeln.
          </p>
          <div className="cta-actions">
            <a className="btn btn-primary" href="https://app.bp-pilot.ch/upload">
              Upload starten
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
            <span className="brand-mark">BP</span>
            <strong>Pilot</strong>
          </div>
          <p className="muted">Intelligente Bankdaten-Verarbeitung für schnellere Buchhaltungsprozesse.</p>
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
          <div className="footer-head">Ressourcen</div>
          <a className="footer-link" href="#resources">
            Docs
          </a>
          <a className="footer-link" href="#resources">
            Changelog
          </a>
        </div>

        <div>
          <div className="footer-head">Rechtliches</div>
          <a className="footer-link" href="/terms">
            Terms & Agreements
          </a>
          <a className="footer-link" href="#">
            Impressum
          </a>
          <a className="footer-link" href="#">
            Datenschutz
          </a>
        </div>
      </div>

      <div className="footer-bottom">© {new Date().getFullYear()} Pilot. All rights reserved.</div>
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
          <h2 className="h2 center">Schweizer Präzision für moderne Finance-Teams</h2>
          <p className="muted center">Minimaler Aufwand, maximale Übersicht. Vom Beleg zur Tabelle in Minuten.</p>
        </div>

        <FeatureBlock
          kicker="UPLOAD"
          title="Dateien hochladen und strukturiert starten"
          description="CSV, XLSX oder CAMT importieren und direkt mit einer robusten Datengrundlage weiterarbeiten."
          bullets={[
            { title: "Bank-unabhängig", text: "Variierende Spalten und Bezeichnungen werden zuverlässig erkannt." },
            { title: "Mandantenkontext", text: "Verarbeitung direkt im verbundenen Bexio-Mandanten." },
          ]}
          primary={{ label: "Upload öffnen", href: "https://app.bp-pilot.ch/upload" }}
          secondary={{ label: "Preview ansehen", href: "https://app.bp-pilot.ch/preview" }}
          imageSrc={PREVIEWS.upload}
          imageAlt="Upload Wizard Screenshot"
        />

        <FeatureBlock
          kicker="PREVIEW"
          title="Transaktionen prüfen und bereinigen"
          description="Buchungstexte normalisieren, Betragsstruktur kontrollieren und Datenqualität sichern."
          bullets={[
            { title: "Klare Betragslogik", text: "Soll/Haben-ready mit absoluten Werten für den Import." },
            { title: "Cleanup-Regeln", text: "Wiederkehrende Textmuster automatisch entfernen." },
          ]}
          primary={{ label: "Preview öffnen", href: "https://app.bp-pilot.ch/preview" }}
          secondary={{ label: "In Tabelle", href: "https://app.bp-pilot.ch/spreadsheet" }}
          reverse
          imageSrc={PREVIEWS.preview}
          imageAlt="Preview & Mapping Screenshot"
        />

        <FeatureBlock
          kicker="SPREADSHEET"
          title="Buchungsregeln anwenden und kontieren"
          description="Vorschläge für Konten und automatische Zuordnung auf Basis bestehender Regeln."
          bullets={[
            { title: "Schnellere Kontierung", text: "Kontonummer oder Kontoname suchen und direkt übernehmen." },
            { title: "Weniger Handarbeit", text: "Buchungsregeln füllen Soll/Haben automatisiert vor." },
          ]}
          primary={{ label: "Spreadsheet öffnen", href: "https://app.bp-pilot.ch/spreadsheet" }}
          secondary={{ label: "Login", href: "https://app.bp-pilot.ch/login" }}
          imageSrc={PREVIEWS.spreadsheet}
          imageAlt="Spreadsheet Screenshot"
        />

        <CtaBand />
      </main>

      <Footer />
    </div>
  );
}
