/**
 * GEMELDET: „ne nimm die Warnung raus für Sponsoren die werden in s2 sauber dann gepickt."
 *
 * BEFUND, am Klon von Chris' Spielstand gemessen: der Saisonwechsel meldete
 * `blockingReasons: ["manual_sponsor_choice_pending"]` — und lief trotzdem durch
 * (`applied: true`, der Klon landete sauber in Saison 2). Die Meldung stand also ohne Folge
 * daneben und erschien seit #437 zusaetzlich als roter Kasten auf der Saisonfinale-Seite.
 *
 * URSACHE, mit Zeile: der Schritt `sponsor_choice` in `preseason-workflow-service.ts` haengt an
 * `requiresManualChoice` (`sponsor-offer-service.ts:1028` — manuell gefuehrt UND noch kein
 * Vertrag). Gemeint ist der Vertrag fuer die KOMMENDE Saison, und den hat am Saisonende niemand:
 * die Angebote werden an genau dieser Stelle erst erzeugt (`regenerateSponsorOffersForSeason`),
 * gewaehlt wird in der neuen Saison. Der Schritt meldete damit dauerhaft eine Blockade fuer etwas,
 * das planmaessig spaeter passiert.
 *
 * NICHT angefasst: die echte Sponsor-PFLICHT im Abschluss-Gate
 * (`season-completion-service.ts:234`). Die verlangt einen Vertrag fuer die LAUFENDE Saison, und
 * daran haengt echtes Geld — die Vorschau zieht Gehalt nur mit Vertrag ab, das reale Settlement
 * ebenso. Sie setzt denselben Code weiter, deshalb bleiben Uebersetzung und Weg zur Sponsorenseite
 * im Panel erhalten.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const WORKFLOW = read("lib/season/preseason-workflow-service.ts");
const COMPLETION = read("lib/season/season-completion-service.ts");
const PANEL = read("app/foundation/season-v2/FoundationSeasonFinalePanel.tsx");

/** Der Rumpf des Schritts `sponsor_choice` — nur dort darf sich etwas geaendert haben. */
const SPONSOR_SCHRITT = (() => {
  const start = WORKFLOW.indexOf('stepId: "sponsor_choice"');
  expect(start).toBeGreaterThan(-1);
  const ende = WORKFLOW.indexOf("stepId:", start + 30);
  return WORKFLOW.slice(start, ende > start ? ende : start + 3000);
})();

describe("Sponsorenwahl blockiert den Saisonwechsel nicht mehr", () => {
  it("der Schritt meldet keinen Blocker mehr", () => {
    // Genau die Zeile, die den roten Kasten erzeugt hat.
    expect(SPONSOR_SCHRITT).toContain("blockingReasons: []");
    expect(SPONSOR_SCHRITT).not.toContain('blockingReasons: manualSponsorChoicesPending > 0');
  });

  it("und auch keine Warnung mehr ueber eine offene Wahl", () => {
    // „nimm die Warnung raus" — die Angebote sind da, die Wahl kommt in der neuen Saison.
    expect(SPONSOR_SCHRITT).toContain('warnings: ["sponsor_offers_regenerated_after_transfer_window"]');
    expect(SPONSOR_SCHRITT).not.toContain("`manual_sponsor_choice_pending:${manualSponsorChoicesPending}`");
  });

  it("der Schritt steht nicht mehr auf 'blocked'", () => {
    // Ein blockierter Schritt in der Kette sperrt die Weiterschaltung im Assistenten.
    expect(SPONSOR_SCHRITT).not.toContain('? "blocked"');
  });

  it("er gibt sein Bestaetigungs-Token bedingungslos heraus", () => {
    // Vorher `null`, solange eine Wahl offen war — der Schritt liess sich also nicht abschliessen.
    expect(SPONSOR_SCHRITT).toContain('confirmToken: "SPONSOR_CHOICE_READY"');
  });

  it("die echte Sponsor-Pflicht am Saisonabschluss bleibt bestehen", () => {
    // Dort haengt echtes Geld dran: ohne Vertrag rechnet die Vorschau Gehalt ab, das Settlement
    // nicht. Diese Pflicht darf der Fix nicht mit wegnehmen.
    expect(COMPLETION).toContain('key: "sponsor_choice_gate"');
    expect(COMPLETION).toContain('blockingReasons: manualTeamsWithoutSponsor.length > 0 ? ["manual_sponsor_choice_pending"] : []');
  });

  it("das Panel uebersetzt den Code weiterhin — der Abschluss-Gate kann ihn noch senden", () => {
    // Sonst stuende bei einem echten Blocker wieder ein roher Servercode auf dem Bildschirm.
    expect(PANEL).toContain("manual_sponsor_choice_pending");
    expect(PANEL).toContain("Es fehlt noch eine Sponsorenwahl.");
  });
});
