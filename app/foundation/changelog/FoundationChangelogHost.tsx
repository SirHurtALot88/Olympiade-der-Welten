"use client";

import { useMemo } from "react";

import changelogDatei from "@/data/changelog/CHANGELOG.json";
import { NlCard, NlEmptyState } from "@/components/foundation/new-look";
import {
  CHANGELOG_GEWICHT_BESCHRIFTUNG,
  fasseChangelogZusammen,
  gruppiereChangelogNachDatum,
  gruppiereChangelogNachGewicht,
  gruppiereChangelogNachVersion,
  parseChangelogDatei,
  sortiereChangelog,
  type ChangelogEintrag,
} from "@/lib/changelog/changelog";

/**
 * Der Changelog-Reiter — unterster Reiter im Spiel, reine Nur-Lese-Ansicht.
 *
 * Er liest ausschliesslich die GENERIERTE Datei (`data/changelog/CHANGELOG.json`,
 * `npm run changelog:bauen`). Gegliedert wird in drei Ebenen, von aussen nach innen:
 *   1. Gewichtung (Grosses oben — wer den Reiter oeffnet, soll einen Sponsoren-Umbau oder einen
 *      behobenen Spielblocker sehen, ohne zu suchen).
 *   2. Version, sofern eine bekannt ist — sonst eine ehrliche Sammelueberschrift statt eine
 *      geratene Versionsnummer.
 *   3. Tag, neueste zuerst.
 * Kein Entwicklerjargon in der Oberflaeche: keine Dateinamen, keine Commit-Hashes — nur die
 * PR-Nummer bleibt als dezenter Beleg stehen (siehe docs/BUGFIXING_AGENT.md, "Der Changelog").
 *
 * Der Import laeuft trotzdem durch `parseChangelogDatei`: ein einzelner kaputter Eintrag in der
 * Datei faellt heraus, statt den Reiter zu reissen. Eintraege ohne Gewichtung oder ohne Version
 * fallen NICHT heraus — sie stehen unter einer eigenen, ehrlichen Sammelueberschrift, damit die
 * Luecke sichtbar bleibt statt zu verschwinden.
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

/**
 * Ueberschrift der Versionsgruppe innerhalb eines Gewichtungs-Abschnitts. `null` heisst: fuer
 * diese Eintraege ist die Version nicht bekannt (aeltere Eintraege, bevor das Feld eingefuehrt
 * wurde) — eine ehrliche Sammelueberschrift statt eine geratene Versionsnummer.
 */
function formatVersionsTitel(version: string | null): string {
  return version ? `Version ${version}` : "Ohne Versionsangabe";
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
  const eintraege = useMemo(() => sortiereChangelog(parseChangelogDatei(changelogDatei)), []);

  // Erst nach Gewichtung, darin nach Version, darin nach Tag: alle drei Bausteine bleiben
  // getrennt wiederverwendbar (siehe lib/changelog/changelog.ts).
  const abschnitte = useMemo(
    () =>
      gruppiereChangelogNachGewicht(eintraege).map((gruppe) => ({
        gewicht: gruppe.gewicht,
        beschriftung: gruppe.gewicht ? CHANGELOG_GEWICHT_BESCHRIFTUNG[gruppe.gewicht] : OHNE_EINSTUFUNG,
        versionen: gruppiereChangelogNachVersion(gruppe.eintraege).map((versionsGruppe) => ({
          version: versionsGruppe.version,
          tage: gruppiereChangelogNachDatum(versionsGruppe.eintraege),
        })),
      })),
    [eintraege],
  );

  // Aus der flachen Liste, nicht aus `abschnitte` — die Kennzahlen sollen die Gliederung ueberleben.
  const zusammenfassung = useMemo(() => fasseChangelogZusammen(eintraege), [eintraege]);

  return (
    <div className="nl-changelog" data-testid="foundation-changelog" data-new-look="true">
      <NlCard eyebrow="Changelog" title="Was sich geändert hat">
        <div className="nl-changelog-kopf">
          <p className="nl-changelog-intro">
            Gefixte Fehler und Neuerungen — das Große zuerst, darin neueste zuerst. Die PR-Nummer ist
            der Beleg für alle, die nachsehen wollen.
          </p>
          {zusammenfassung.eintraege > 0 ? (
            <dl className="nl-changelog-kennzahlen">
              <div className="nl-changelog-kennzahl">
                <dt>Einträge</dt>
                <dd>{zusammenfassung.eintraege}</dd>
              </div>
              <div className="nl-changelog-kennzahl">
                <dt>Tage</dt>
                <dd>{zusammenfassung.tage}</dd>
              </div>
              <div className="nl-changelog-kennzahl">
                <dt>Zuletzt</dt>
                <dd>
                  {zusammenfassung.letztesDatum
                    ? formatChangelogDatum(zusammenfassung.letztesDatum)
                    : "—"}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
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
            {abschnitt.versionen.map((versionsGruppe) => (
              <section
                key={versionsGruppe.version ?? "ohne-version"}
                className="nl-changelog-version"
                data-testid={`foundation-changelog-version-${versionsGruppe.version ?? "ohne-version"}`}
              >
                {/* Nur zeigen, wenn es innerhalb dieses Abschnitts ueberhaupt eine Versionsangabe
                    gibt — sonst waere "Ohne Versionsangabe" die einzige, unnoetige Zwischenzeile. */}
                {abschnitt.versionen.length > 1 || versionsGruppe.version ? (
                  <h3 className="nl-changelog-version-heading">{formatVersionsTitel(versionsGruppe.version)}</h3>
                ) : null}
                {versionsGruppe.tage.map((gruppe) => (
                  <NlCard
                    key={`${versionsGruppe.version ?? "ohne-version"}-${gruppe.datum}`}
                    className="nl-changelog-day"
                    title={formatChangelogDatum(gruppe.datum)}
                  >
                    <ul className="nl-changelog-list">
                      {gruppe.eintraege.map((eintrag, index) => (
                        <ChangelogEintragZeile key={`${gruppe.datum}-${index}`} eintrag={eintrag} />
                      ))}
                    </ul>
                  </NlCard>
                ))}
              </section>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
