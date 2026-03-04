export default function DatenschutzPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Datenschutz</h1>
      <p className="mt-3 text-sm text-slate-600">
        Informationen zur Verarbeitung personenbezogener und buchhaltungsrelevanter Daten in bp-pilot.
      </p>

      <section className="mt-8 space-y-4 text-sm text-slate-700">
        <p>
          bp-pilot verarbeitet Daten zur Bereitstellung der Anwendung, insbesondere zur Authentifizierung, zum Import
          von Transaktionen, zur Kontierung und zur Übergabe in bexio.
        </p>
        <p>
          Es werden primär jene Daten verarbeitet, die Sie aktiv hochladen oder eingeben. Die Verarbeitung erfolgt
          zweckgebunden zur Erbringung der jeweiligen Funktion.
        </p>
        <p>
          Zugriff auf bexio-Daten erfolgt nur im Rahmen der von Ihnen erteilten Berechtigungen. Tokens und Sessions
          werden technisch geschützt gespeichert und nur für API-Aufrufe verwendet.
        </p>
        <p>
          Sie können jederzeit Auskunft über gespeicherte Daten anfordern oder Löschung/Anpassung beantragen, sofern
          keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
        </p>
        <p>
          Kontakt für Datenschutzanliegen: <a className="text-blue-600" href="/impressum">siehe Impressum</a>.
        </p>
      </section>
    </main>
  );
}
