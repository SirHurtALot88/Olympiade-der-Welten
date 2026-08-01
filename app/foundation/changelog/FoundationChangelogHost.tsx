"use client";

import { useMemo } from "react";

import changelogDatei from "@/data/changelog/CHANGELOG.json";
import { NlCard, NlEmptyState } from "@/components/foundation/new-look";
import {
  CHANGELOG_GEWICHT_BESCHRIFTUNG,
  gruppiereChangelogNachDatum,
  gruppiereChangelogNachGewicht,
  parseChangelogDatei,
  sortiereChangelog,
  type ChangelogEintrag,
} from "@/lib/changelog/changelog";

/**
 * Der Changelog-Reiter — unterster Reiter im Spiel, reine Nur-Lese-Ansicht.
 *
 * Er liest ausschliesslich die GENERIERTE Datei (`data/changelog/CHANGELOG.json`,
 * `npm run changelog:bauen`). Gegliedert wird ZUERST nach Gewichtung (Grosses oben — wer den
 * Reiter oeffnet, soll einen Sponsoren-Umbau oder einen behobenen Spielblocker sehen, ohne zu
 * suchen), INNERHALB eines Abschnitts nach Tag, neueste zuerst — die Tagesgruppierung bleibt
 * als Baustein bestehen, nur eine Ebene tiefer. Kein Entwicklerjargon in der Oberflaeche:
 * keine Dateinamen, keine Commit-Hashes — nur die PR-Nummer bleibt als dezenter Beleg stehen
 * (siehe docs/BUGFIXING_AGENT.md, "Der Changelog").
 *
 * Der Import laeuft trotzdem durch `parseChangelogDatei`: ein einzelner kaputter Eintrag in der
 * Datei faellt heraus, statt den Reiter zu reissen. Eintraege ohne Gewichtung fallen NICHT
 * heraus — sie stehen im letzten Abschnitt "Ohne Einstufung", damit die Luecke sichtbar bleibt.
 */

/** Beschriftung fuer Eintraege, deren Quelle keine Gewichtung hergab — sichtbar statt geraten. */
const OHNE_EINSTUFUNG = {
  titel: "Ohne Einstufung",
  erklaerung: "Änderungen, die noch keiner Stufe zugeordnet sind.",
} as const;

/** "2026-07-30" → "30. Juli 2026". Von Hand zerlegt statt `new Date(iso)`, damit keine Zeitzone den Tag verschiebt. */
function formatChangelogDatum(datum: string): string {
  const teile = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum);
  if (!teile) return datum;
  return new Date(Number(teile[1]), Number(teile[2]) - 1, Number(teile[3])).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ChangelogEintragZeile({ eintrag }: { eintrag: ChangelogEintrag }) {
  return (
    <li className="nl-changelog-item">
      <div className="nl-changelog-item-head">
        {eintrag.seite ? <span className="nl-changelog-seite">{eintrag.seite}</span> : null}
        {eintrag.pr ? <span className="nl-changelog-pr">PR {eintrag.pr}</span> : null}
      </div>
      <p className="nl-changelog-text">{eintrag.text}</p>
    </li>
  );
}

export default function FoundationChangelogHost() {
  // Die Datei ist zur Build-Zeit eingebacken — einmal parsen und gruppieren reicht.
  // Erst nach Gewichtung, darin nach Tag: beide Bausteine bleiben getrennt wiederverwendbar.
  const abschnitte = useMemo(() => {
    const eintraege = sortiereChangelog(parseChangelogDatei(changelogDatei));
    return gruppiereChangelogNachGewicht(eintraege).map((gruppe) => ({
      gewicht: gruppe.gewicht,
      beschriftung: gruppe.gewicht ? CHANGELOG_GEWICHT_BESCHRIFTUNG[gruppe.gewicht] : OHNE_EINSTUFUNG,
      tage: gruppiereChangelogNachDatum(gruppe.eintraege),
    }));
  }, []);

  return (
    <div className="nl-changelog" data-testid="foundation-changelog" data-new-look="true">
      <NlCard eyebrow="Changelog" title="Was sich geändert hat">
        <p className="nl-changelog-intro">
          Gefixte Fehler und Neuerungen — das Große zuerst, darin neueste zuerst. Die PR-Nummer ist
          der Beleg für alle, die nachsehen wollen.
        </p>
      </NlCard>

      {abschnitte.length === 0 ? (
        <NlCard>
          <NlEmptyState title="Noch keine Einträge." />
        </NlCard>
      ) : (
        abschnitte.map((abschnitt) => (
          <section
            key={abschnitt.gewicht ?? "ohne"}
            className="nl-changelog-abschnitt"
            data-gewicht={abschnitt.gewicht ?? "ohne"}
          >
            <header className="nl-changelog-abschnitt-kopf">
              <h2 className="nl-changelog-abschnitt-titel">{abschnitt.beschriftung.titel}</h2>
              <p className="nl-changelog-abschnitt-erklaerung">{abschnitt.beschriftung.erklaerung}</p>
            </header>
            {abschnitt.tage.map((gruppe) => (
              <NlCard key={gruppe.datum} className="nl-changelog-day" title={formatChangelogDatum(gruppe.datum)}>
                <ul className="nl-changelog-list">
                  {gruppe.eintraege.map((eintrag, index) => (
                    <ChangelogEintragZeile key={`${gruppe.datum}-${index}`} eintrag={eintrag} />
                  ))}
                </ul>
              </NlCard>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
