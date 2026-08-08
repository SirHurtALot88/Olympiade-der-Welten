"use client";

import { useCallback, useMemo, useRef, useState } from "react";

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
 * W6 (Audit „welt", Befund 2): 137+ Einträge auf einer 18.000-px-Seite ohne Filter, Suche oder
 * Sprungmarken — eine einzige Scroll-Wand. Fix hier: nur die NEUESTE Version steht initial offen,
 * ältere liegen hinter einem "Anzeigen"-Schalter je Versionsabschnitt; eine Sprungleiste im Kopf
 * springt zu jeder Version und klappt sie dabei auf.
 *
 * Befund 1 (45–60s Ladezeit) ist NICHT hier behoben — nachgemessen (siehe PR-Beschreibung): die
 * Komponente selbst lädt keine Daten nach (die JSON-Datei ist zur Build-Zeit eingebacken, reines
 * `useMemo`-Parsen/Gruppieren, keine Netzwerk-Anfrage) und rendert warm in ~3–5s. Die 45–60s waren
 * die einmalige Dev-Server-Kompilierung der riesigen gemeinsamen Modulkette dieser Seite (u. a.
 * `use-foundation-shell-router-body-scope.tsx`, >12.000 Zeilen) — kein Datenweg-Bug dieser
 * Komponente, sondern ein Dev-Mode-Artefakt, das im gebauten Produktiv-Build nicht auftritt.
 */

/** `version` → stabiler React-/Anker-Schlüssel; `null` wird zu "ohne-version". */
function versionsSchluessel(version: string | null): string {
  return version ?? "ohne-version";
}

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

  // EINE Quelle fuer "welche Versionen gibt es, in welcher Reihenfolge, wie voll": direkt aus der
  // flachen Liste (nicht aus `abschnitte`), damit die globale Reihenfolge stimmt, auch wenn
  // verschiedene Gewicht-Abschnitte unterschiedliche Versionen enthalten. Speist sowohl die
  // Sprungleiste als auch die "welche Version ist die neueste"-Entscheidung unten.
  const versionsUebersicht = useMemo(
    () =>
      gruppiereChangelogNachVersion(eintraege).map((gruppe) => ({
        schluessel: versionsSchluessel(gruppe.version),
        version: gruppe.version,
        anzahl: gruppe.eintraege.length,
      })),
    [eintraege],
  );
  const neuesteVersionSchluessel = versionsUebersicht[0]?.schluessel ?? "ohne-version";

  // Nur die neueste Version startet offen; alle anderen liegen hinter "Anzeigen" (Befund 2).
  const [ausgeklappt, setAusgeklappt] = useState<Set<string>>(() => new Set([neuesteVersionSchluessel]));
  // Erstes DOM-Element je Version — Ziel der Sprungleiste. `!has(...)`-Wache haelt bei mehrfach
  // vorkommenden Versionen (dieselbe Version in mehreren Gewicht-Abschnitten) das OBERSTE Vorkommen.
  const versionsAnkerRef = useRef<Map<string, HTMLElement>>(new Map());
  const registriereVersionsAnker = useCallback(
    (schluessel: string) => (element: HTMLElement | null) => {
      if (element && !versionsAnkerRef.current.has(schluessel)) {
        versionsAnkerRef.current.set(schluessel, element);
      }
    },
    [],
  );

  const toggleVersion = useCallback((schluessel: string) => {
    setAusgeklappt((bisher) => {
      const naechste = new Set(bisher);
      if (naechste.has(schluessel)) naechste.delete(schluessel);
      else naechste.add(schluessel);
      return naechste;
    });
  }, []);

  const springeZuVersion = useCallback((schluessel: string) => {
    setAusgeklappt((bisher) => (bisher.has(schluessel) ? bisher : new Set(bisher).add(schluessel)));
    // Erst NACH dem Ausklappen scrollen (naechster Frame), sonst zielt scrollIntoView auf die
    // Position VOR dem Aufklappen der ggf. neu eingeblendeten Tage-Karten.
    requestAnimationFrame(() => {
      versionsAnkerRef.current.get(schluessel)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

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
          {/* Sprungleiste (Befund 2): springt zur Version UND klappt sie dabei auf. */}
          {versionsUebersicht.length > 1 ? (
            <nav className="nl-changelog-sprungleiste" aria-label="Zu einer Version springen">
              {versionsUebersicht.map((eintrag) => (
                <button
                  key={eintrag.schluessel}
                  type="button"
                  className={`nl-changelog-sprung-chip${ausgeklappt.has(eintrag.schluessel) ? " is-offen" : ""}`}
                  onClick={() => springeZuVersion(eintrag.schluessel)}
                  data-testid={`nl-changelog-sprung-${eintrag.schluessel}`}
                >
                  {formatVersionsTitel(eintrag.version)}
                  <span className="nl-changelog-sprung-anzahl nl-tnum">{eintrag.anzahl}</span>
                </button>
              ))}
            </nav>
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
            {abschnitt.versionen.map((versionsGruppe) => {
              const schluessel = versionsSchluessel(versionsGruppe.version);
              // Nur zeigen, wenn es innerhalb dieses Abschnitts ueberhaupt eine Versionsangabe gibt —
              // sonst waere "Ohne Versionsangabe" die einzige, unnoetige Zwischenzeile.
              const zeigtKopf = abschnitt.versionen.length > 1 || Boolean(versionsGruppe.version);
              // Ohne sichtbaren Kopf gibt es auch keinen Schalter, der wieder aufklappen koennte —
              // dann bleibt der Abschnitt immer offen statt sich unwiderruflich einzuklappen.
              const offen = zeigtKopf ? ausgeklappt.has(schluessel) : true;
              const anzahlEintraege = versionsGruppe.tage.reduce((summe, tag) => summe + tag.eintraege.length, 0);
              return (
                <section
                  key={schluessel}
                  ref={registriereVersionsAnker(schluessel)}
                  className={`nl-changelog-version${offen ? "" : " is-eingeklappt"}`}
                  data-testid={`foundation-changelog-version-${schluessel}`}
                >
                  {zeigtKopf ? (
                    <div className="nl-changelog-version-kopf">
                      <h3 className="nl-changelog-version-heading">{formatVersionsTitel(versionsGruppe.version)}</h3>
                      {/* Nur die neueste Version steht initial offen (Befund 2) — der Schalter bleibt
                          aber IMMER da, auch fuer die neueste, damit sich jeder Abschnitt gleich
                          verhaelt und sich bei Bedarf wieder einklappen laesst. */}
                      <button
                        type="button"
                        className="nl-changelog-version-toggle"
                        onClick={() => toggleVersion(schluessel)}
                        aria-expanded={offen}
                        data-testid={`nl-changelog-toggle-${schluessel}`}
                      >
                        {offen ? "Einklappen" : `Anzeigen (${anzahlEintraege})`}
                      </button>
                    </div>
                  ) : null}
                  {offen ? (
                    versionsGruppe.tage.map((gruppe) => (
                      <NlCard key={`${schluessel}-${gruppe.datum}`} className="nl-changelog-day" title={formatChangelogDatum(gruppe.datum)}>
                        <ul className="nl-changelog-list">
                          {gruppe.eintraege.map((eintrag, index) => (
                            <ChangelogEintragZeile key={`${gruppe.datum}-${index}`} eintrag={eintrag} />
                          ))}
                        </ul>
                      </NlCard>
                    ))
                  ) : (
                    <p className="nl-changelog-version-collapsed-hint muted">
                      {anzahlEintraege} Eintrag{anzahlEintraege === 1 ? "" : "e"} eingeklappt — „Anzeigen" holt sie zurück.
                    </p>
                  )}
                </section>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
