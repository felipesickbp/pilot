export default function ImpressumPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Impressum</h1>
      <p className="mt-3 text-sm text-slate-600">Anbieterinformationen für bp-pilot.</p>

      <section className="mt-8 space-y-4 text-sm text-slate-700">
        <p>
          <strong>bp-pilot</strong>
          <br />
          Burkhart &amp; Partners
          <br />
          Schweiz
        </p>
        <p>
          E-Mail: info@bp-pilot.ch
          <br />
          Website: https://bp-pilot.ch
        </p>
        <p>
          Verantwortlich für den Inhalt dieser Website ist der oben genannte Anbieter. Für externe Links wird trotz
          sorgfältiger Prüfung keine Haftung übernommen.
        </p>
      </section>
    </main>
  );
}
