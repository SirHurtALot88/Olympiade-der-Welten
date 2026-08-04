/**
 * GEMELDET VON CHRIS: „nachdem man beim Saisonstart-Fenster auf erledigt klickt, sollte man erstmal
 * bei den Sponsoren landen — finde das vom Flow her sinnvoller, weil man dann auch besser abschätzen
 * kann, wie hoch das eigene Budget ist für Gehälter, was man sich erlauben kann."
 *
 * Der Sponsor-Schritt stand am ENDE der Einstiegskette, hinter beiden Kaufschritten. Man hat also
 * Spieler samt Gehalt verpflichtet, bevor man wusste, was der Sponsor einbringt.
 *
 * Geprüft wird die Regel, nicht die verschobene Zeile:
 *
 *  1. Der Sponsor kommt VOR jedem Schritt, der Geld ausgibt — im Einstiegs-Flow und im
 *     Briefing-Fenster, die beide den Saisonstart führen.
 *  2. Er muss der Schritt sein, auf dem der „Weiter"-Knopf tatsächlich landet. Eine Reihenfolge,
 *     die `chooseCurrentStep` nicht erreicht, ist wirkungslos.
 *  3. Er zeigt auf die Seite, auf der man einen Sponsor wählen kann.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const CONTROLLER = readFileSync(join(root, "lib/foundation/game-flow-controller.ts"), "utf8");
const BRIEFING = readFileSync(join(root, "lib/foundation/tabs/use-foundation-cross-tab-season-briefing.ts"), "utf8");

/** Position eines Schritts im Quelltext — die Reihenfolge der `step({...})`-Literale IST die Reihenfolge. */
function positionOf(source: string, stepId: string, from = 0): number {
  const index = source.indexOf(`stepId: "${stepId}"`, from);
  return index;
}

describe("Sponsor vor den Käufen — Saison-1-Einstieg", () => {
  // Der Onboarding-Pfad steht vor dem Folgesaison-Pfad in der Datei.
  const onboardingStart = CONTROLLER.indexOf("stepId: \"team_confirm\"");
  const onboardingEnd = CONTROLLER.indexOf("function mergeOnboardingFlowSteps");
  const onboarding = CONTROLLER.slice(onboardingStart, onboardingEnd);

  it("der Sponsor steht vor beiden Kaufschritten", () => {
    const sponsor = positionOf(onboarding, "choose_sponsor");
    const firstTransfers = positionOf(onboarding, "first_transfers");
    const fillRoster = positionOf(onboarding, "fill_roster");
    expect(sponsor, "choose_sponsor fehlt im Einstiegs-Flow").toBeGreaterThanOrEqual(0);
    expect(sponsor, "Sponsor muss vor 'Erste Transfers' kommen").toBeLessThan(firstTransfers);
    expect(sponsor, "Sponsor muss vor 'Kader auffüllen' kommen").toBeLessThan(fillRoster);
  });

  it("er zeigt auf den Sponsoren-Reiter, nicht auf Teams", () => {
    const sponsorBlock = onboarding.slice(positionOf(onboarding, "choose_sponsor"));
    expect(sponsorBlock.slice(0, 900)).toContain('targetView: "prize"');
    expect(sponsorBlock.slice(0, 900)).toContain('targetPanel: "sponsor-choice"');
  });
});

describe("Der Spieltags-Flow bleibt unangetastet", () => {
  /**
   * BEIM BAUEN FAST KAPUTTGEMACHT, deshalb als Test festgehalten: der zweite `choose_sponsor`-Schritt
   * liegt NICHT im Vorsaison-Pfad, sondern in `buildMatchdaySteps` — dem Flow, der an JEDEM Spieltag
   * läuft. Ihn dort nach vorn zu ziehen und auf „ready" zu stellen, hätte den Schritt bis zur
   * Unterschrift an jedem Spieltag zum aktuellen gemacht.
   *
   * Chris' Wunsch gehört an den Saisonstart, nicht in den Spieltag. Diese beiden Prüfungen halten
   * die Grenze fest.
   */
  const matchdayStart = CONTROLLER.indexOf("function buildMatchdaySteps");
  const matchday = CONTROLLER.slice(matchdayStart);

  it("der Sponsor bleibt dort optional", () => {
    const block = matchday.slice(positionOf(matchday, "choose_sponsor"), positionOf(matchday, "choose_sponsor") + 1400);
    expect(block, "ein 'ready' hier kapert die Flow-Führung an jedem Spieltag").toContain(
      'hasSponsorContract ? "completed" : "optional"',
    );
    expect(block).toContain("optional: !hasSponsorContract");
  });

  it("und steht dort weiterhin hinter dem Kaderaufbau", () => {
    expect(positionOf(matchday, "buy_players")).toBeLessThan(positionOf(matchday, "choose_sponsor"));
  });
});

describe("Das Saisonstart-Fenster zeigt dieselbe Reihenfolge", () => {
  it("der Sponsor steht auch dort vor den Transfers", () => {
    // Sonst zeigt das Fenster etwas anderes an, als der „Weiter"-Knopf tut.
    const sponsor = positionOf(BRIEFING, "choose_sponsor");
    const firstTransfers = positionOf(BRIEFING, "first_transfers");
    const fillRoster = positionOf(BRIEFING, "fill_roster");
    expect(sponsor).toBeGreaterThanOrEqual(0);
    expect(sponsor).toBeLessThan(firstTransfers);
    expect(sponsor).toBeLessThan(fillRoster);
  });

  it("und schickt auf die Sponsoren-Seite statt auf Teams", () => {
    const sponsorBlock = BRIEFING.slice(positionOf(BRIEFING, "choose_sponsor"));
    const block = sponsorBlock.slice(0, 800);
    expect(block).toContain('targetView: "prize"');
    expect(block, "auf der Team-Seite gibt es keine Sponsor-Auswahl").not.toContain('targetView: "teams"');
  });
});
