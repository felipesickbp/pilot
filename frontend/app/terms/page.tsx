export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Terms & Agreements</h1>
      <p className="mt-3 text-sm text-slate-600">
        Nutzung von bp-pilot für die Verarbeitung von Finanz- und Bankdaten.
      </p>

      <section className="mt-8 space-y-4 text-sm text-slate-700">
        <p>
          Durch die Nutzung von bp-pilot stimmen Sie zu, dass sensible Bank- und Buchhaltungsdaten im Rahmen der
          bereitgestellten Funktionen verarbeitet werden.
        </p>
        <p>
          Burkhart &amp; Partners stellt die Plattform mit grösstmöglicher Sorgfalt bereit. Eine absolute Sicherheit
          oder fehlerfreie Verfügbarkeit kann jedoch nicht garantiert werden.
        </p>
        <p>
          Die Integration mit bexio erfolgt über die offizielle bexio API. Es werden nur jene Daten verarbeitet, die
          für den jeweiligen Workflow erforderlich sind.
        </p>
        <p>
          Die Anwendung wird auf Servern in der Schweiz betrieben. Daten verlassen nach heutigem Betriebsmodell die
          Schweiz nicht.
        </p>
        <p>
          Sie bleiben verantwortlich für die inhaltliche Prüfung der Buchungen, Kontierungen und steuerlichen
          Zuordnungen vor der definitiven Verbuchung.
        </p>
      </section>
    </main>
  );
}
