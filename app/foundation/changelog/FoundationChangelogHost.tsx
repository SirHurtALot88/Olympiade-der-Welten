"use client";

import { useMemo } from "react";

import changelogDatei from "@/data/changelog/CHANGELOG.json";
import { NlCard, NlEmptyState } from "@/components/foundation/new-look";
import {
  gruppiereChangelogNachDatum,
  gruppiereChangelogNachVersion,
  parseChangelogDatei,
  sortiereChangelog,
  type ChangelogEintrag,
} from "@/lib/changelog/changelog";

/**
 * Der Changelog-Reiter — unterster Reiter im Spiel, reine Nur-Lese-Ansicht.
 *
 * Er liest ausschliesslich die GENERIERTE Datei (`data/changelog/CHANGELOG.json`,
 * `npm run changelog:bauen`) und zeigt sie neueste zuerst, nach Tag gruppiert. Kein
 * Entwicklerjargon in der Oberflaeche: keine Dateinamen, keine Commit-Hashes — nur die
 * PR-Nummer bleibt als dezenter Beleg stehen (siehe docs/BUGFIXING_AGENT.md, "Der Changelog").
 *
 * Der Import laeuft trotzdem durch `parseChangelogDatei`: ein einzelner kaputter Eintrag in der
 * Datei faellt heraus, statt den Reiter zu reissen.
 */

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
 * Ueberschrift der aeusseren Versionsgruppe. `null` heisst: fuer diese Eintraege ist die Version
 * nicht bekannt (aeltere Eintraege, bevor das Feld eingefuehrt wurde) — eine ehrliche Sammel-
 * ueberschrift statt eine geratene Versionsnummer.
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
  const versionsGruppen = useMemo(
    () => gruppiereChangelogNachVersion(sortiereChangelog(parseChangelogDatei(changelogDatei))),
    [],
  );

  return (
    <div className="nl-changelog" data-testid="foundation-changelog" data-new-look="true">
      <NlCard eyebrow="Changelog" title="Was sich geändert hat">
        <p className="nl-changelog-intro">
          Gefixte Fehler und Neuerungen, neueste zuerst. Die PR-Nummer ist der Beleg für alle, die
          nachsehen wollen.
        </p>
      </NlCard>

      {versionsGruppen.length === 0 ? (
        <NlCard>
          <NlEmptyState title="Noch keine Einträge." />
        </NlCard>
      ) : (
        versionsGruppen.map((versionsGruppe) => (
          <section
            key={versionsGruppe.version ?? "ohne-version"}
            className="nl-changelog-version"
            data-testid={`foundation-changelog-version-${versionsGruppe.version ?? "ohne-version"}`}
          >
            <h3 className="nl-changelog-version-heading">{formatVersionsTitel(versionsGruppe.version)}</h3>
            {gruppiereChangelogNachDatum(versionsGruppe.eintraege).map((gruppe) => (
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
        ))
      )}
    </div>
  );
}
