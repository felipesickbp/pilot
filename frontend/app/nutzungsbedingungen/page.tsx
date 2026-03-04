export default function NutzungsbedingungenPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Nutzungsbedingungen</h1>
      <p className="mt-3 text-sm text-slate-600">
        Bedingungen für die Nutzung von bp-pilot zur Verarbeitung von Bank- und Buchhaltungsdaten.
      </p>

      <section className="mt-8 space-y-4 text-sm text-slate-700">
        <p>
          bp-pilot unterstützt bei Import, Bereinigung, Kontierung und Übertragung von Buchungsdaten. Die finale
          inhaltliche und steuerliche Prüfung verbleibt jederzeit beim nutzenden Unternehmen.
        </p>
        <p>
          Die bexio-Integration erfolgt über die offiziellen Schnittstellen. Es werden nur Daten verarbeitet, die für
          den jeweiligen Workflow technisch notwendig sind.
        </p>
        <p>
          Verfügbarkeit und Ergebnisse werden mit hoher Sorgfalt bereitgestellt. Eine vollständig unterbrechungsfreie
          oder fehlerfreie Nutzung kann jedoch nicht garantiert werden.
        </p>
        <p>
          Nutzerinnen und Nutzer sind verpflichtet, Zugangsdaten vertraulich zu behandeln und Buchungen vor der
          definitiven Verbuchung fachlich zu prüfen.
        </p>
        <p>
          Für Fragen zu diesen Bedingungen: <a className="text-blue-600" href="/impressum">siehe Impressum</a>.
        </p>
      </section>
    </main>
  );
}
