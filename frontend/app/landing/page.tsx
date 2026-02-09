// /opt/bp-pilot/app/frontend/app/landing/page.tsx
import "./landing.css";

type Bullet = { title: string; text: string };

function Header() {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <a className="brand" href="#top" aria-label="bp-pilot home">
          <span className="brand-mark" />
          <span className="brand-text">
            <span className="brand-name">bp-pilot</span>
            <span className="brand-sub">finance ops</span>
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
          <a href="#pricing" className="navlink">
            Preise
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
            Finanzprozesse, die
            <span className="h1-accent">reibungslos laufen.</span>
          </h1>

          <p className="lead">
            Ein Workflow für Upload → Preview → Spreadsheet. Automatisiere Dokumente, extrahiere Daten und bring Struktur
            in deine Abschlussarbeit.
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
              {["1. Upload", "2. Preview", "3. Spreadsheet"].map((label) => (
                <div key={label} className="device-card">
                  <div className="device-label">{label}</div>
                  <div className="device-blank" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LogoRow() {
  const logos = ["Kunden A", "Kunden B", "Kunden C", "Kunden D", "Kunden E", "Kunden F"];
  return (
    <section className="logos">
      <div className="container">
        <p className="muted center">Teams nutzen bp-pilot, um schneller und konsistenter zu arbeiten.</p>
        <div className="logos-grid" aria-label="logos">
          {logos.map((l) => (
            <div key={l} className="logo-pill" title={l} />
          ))}
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
}) {
  const { kicker, title, description, bullets, primary, secondary, reverse } = props;

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
          <div className="visual" />
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
            Starte mit einem Dokument und lande in einer strukturierten Tabelle. Ideal für Treuhand, Buchhaltung und
            interne Finance-Teams.
          </p>
          <div className="cta-actions">
            <a className="btn btn-primary" href="https://app.bp-pilot.ch/upload">
              Upload starten
            </a>
            <a className="btn btn-outline" href="#pricing">
              Preise
            </a>
          </div>
        </div>

        <div className="cta-card">
          <div className="cta-blank" />
          <div className="cta-mini">
            <div className="cta-chip" />
            <div className="cta-chip" />
          </div>
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
            <span className="brand-mark" />
            <strong>bp-pilot</strong>
          </div>
          <p className="muted">Dokumente → Daten → Abschluss. In einem klaren Workflow.</p>
        </div>

        <div>
          <div className="footer-head">Produkt</div>
          <a className="footer-link" href="#product">
            Übersicht
          </a>
          <a className="footer-link" href="#solutions">
            Use Cases
          </a>
          <a className="footer-link" href="#pricing">
            Preise
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
          <a className="footer-link" href="#">
            Impressum
          </a>
          <a className="footer-link" href="#">
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
          <h2 className="h2 center">Schweizer Präzision für moderne Finance-Teams</h2>
          <p className="muted center">Minimaler Aufwand, maximale Übersicht. Vom Beleg zur Tabelle in Minuten.</p>
        </div>

        <FeatureBlock
          kicker="UPLOAD"
          title="Schnell Dokumente erfassen"
          description="Drag & drop, klare Struktur und ein sauberer Audit-Trail."
          bullets={[
            { title: "Mehrere Dateien", text: "Arbeite mit Stapeln statt Einzeluploads." },
            { title: "Saubere Ordnung", text: "Pro Mandant, Projekt oder Periode organisieren." },
          ]}
          primary={{ label: "Upload öffnen", href: "https://app.bp-pilot.ch/upload" }}
          secondary={{ label: "Preview ansehen", href: "https://app.bp-pilot.ch/preview" }}
        />

        <FeatureBlock
          kicker="PREVIEW"
          title="Extrahieren, prüfen, korrigieren"
          description="Bevor etwas ins Spreadsheet geht: schnelle Plausibilisierung."
          bullets={[
            { title: "Felder & Werte", text: "Datum, Total, Lieferant, Währung — alles im Blick." },
            { title: "Kontrollschritte", text: "Einfacher Workflow für QA und Freigaben." },
          ]}
          primary={{ label: "Preview öffnen", href: "https://app.bp-pilot.ch/preview" }}
          secondary={{ label: "In Tabelle", href: "https://app.bp-pilot.ch/spreadsheet" }}
          reverse
        />

        <FeatureBlock
          kicker="SPREADSHEET"
          title="Tabelle statt Chaos"
          description="Exportierbare Struktur für Buchhaltung, Reporting und Abschluss."
          bullets={[
            { title: "Einheitliche Spalten", text: "Konsistente Daten für Monatsabschluss und Reviews." },
            { title: "Export-ready", text: "CSV/XLSX-Anbindung später — UI ist vorbereitet." },
          ]}
          primary={{ label: "Spreadsheet öffnen", href: "https://app.bp-pilot.ch/spreadsheet" }}
          secondary={{ label: "Login", href: "https://app.bp-pilot.ch/login" }}
        />

        <div id="pricing" className="container section-head" style={{ paddingTop: 24 }}>
          <h2 className="h2 center">Preise</h2>
          <p className="muted center">
            Platzhalter — sobald du willst, bauen wir eine Pricing Table (amnis-style) + FAQ + CTA.
          </p>
        </div>

        <CtaBand />
      </main>

      <Footer />
    </div>
  );
}
