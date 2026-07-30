import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");
const PANEL = read("app/foundation/season-v2/FoundationSeasonFinalePanel.tsx");
const BODY = read("app/foundation/FoundationShellRouterBody.tsx");
const FLOW = read("lib/foundation/game-flow-controller.ts");
const SCOPE = read("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");

/**
 * „Ich habe jetzt die 10 Spieltage durch, was passiert nun? … was mich dann aber auf
 * diesen Debug-Screen bringt wo ich gar nicht hin will. Du musst also den Flow so anpassen
 * dass man ihn im UI als Mensch sauber durchführen kann."
 *
 * Die Mechanik war vollständig da — Endstand, Auszeichnungen, Board-Abrechnung, Preisgeld,
 * Entwicklung, Saisonwechsel. Sie lag nur im Cockpit, einem Werkzeugkasten mit
 * „salary_explosion" und „S3 Readiness" daneben. Der Flow schickte den Spieler dorthin.
 */
describe("Saisonabschluss: eine Bühne statt des Cockpits", () => {
  it("führt der Flow nicht mehr ins Cockpit", () => {
    const seasonBlock = FLOW.slice(FLOW.indexOf('stepId: "review_previous_season"'), FLOW.indexOf('stepId: "start_matchday_1"'));
    expect(seasonBlock).not.toContain('targetView: "cockpit"');
    // Beide Saisonende-Schritte zeigen auf dieselbe Ansicht.
    expect(seasonBlock.match(/targetPanel: "season-finale"/g)?.length).toBe(2);
    expect(seasonBlock.match(/targetView: "seasonV2"/g)?.length).toBe(2);
  });

  it("trägt das Panel den Sprunganker, auf den der Flow zeigt", () => {
    // Ohne `id` läuft `scrollToFoundationTarget` in ein null und bricht still ab — genau
    // die Klasse Fehler, die den Knopf vorher wirkungslos machte.
    expect(PANEL).toContain('id="season-finale"');
  });

  it("erscheint nur, wenn die Saison auch durch ist", () => {
    // Mitten in der Saison wäre ein Abschluss-Block Unsinn und würde die Tabelle verdecken.
    expect(BODY).toContain(
      'activeView === "seasonV2" && (gameState.gamePhase === "season_completed" || gameState.gamePhase === "season_review")',
    );
  });

  /**
   * DER KERN: keine zweite Wahrheit. Die Zahlen kommen aus derselben Funktion, die auch
   * das Cockpit speist, und die Aktionen sind dieselben Handler. Nachgebaut würde es
   * auseinanderlaufen, sobald jemand die eine Seite anfasst.
   */
  it("nutzt dieselbe Datenquelle wie der Cockpit-Rückblick", () => {
    expect(PANEL).toContain('import { buildSeasonReview } from "@/lib/season/season-review-service";');
    expect(PANEL).toContain("buildSeasonReview(gameState)");
  });

  it("nutzt dieselben Handler wie das Cockpit, statt eigene zu bauen", () => {
    // Erzeugt über dieselben Factories — Präzedenzfall ist die Arena, die das seit jeher tut.
    expect(SCOPE).toContain("createCockpitPreseasonHandlers({");
    expect(SCOPE).toContain("createCockpitSeasonTransitionHandlers({");
    expect(SCOPE).toContain("const { runCockpitCashApply } = matchdayArenaApplyHandlers;");
    // Und ans Panel durchgereicht.
    expect(BODY).toContain("onApplyPrize={() => void runCockpitCashApply(true)}");
    expect(BODY).toContain("onLoadNextSeasonPreview={() => void runPreSeasonWorkflowPreview()}");
    expect(BODY).toContain("void runPreSeasonNextSeasonSetup();");
  });

  /**
   * Die Auszeichnungen gab es die ganze Zeit (Champion, Player of the Season, MVS King,
   * PPs King, Best Transfer, Discipline Monster) — sie standen nur im Cockpit und damit
   * faktisch nirgends.
   */
  it("zeigt die Auszeichnungen, die es längst gab", () => {
    expect(PANEL).toContain("review.awards.map");
    expect(PANEL).toContain('data-testid="season-finale-awards"');
  });

  it("zeigt die Board-Ziele als Bilanz, nicht als Hindernis", () => {
    expect(PANEL).toContain("review.objectiveSettlement");
    expect(PANEL).toContain("erfüllt");
    expect(PANEL).toContain("verfehlt");
  });

  it("fragt vor dem Saisonstart nach, weil er schreibt", () => {
    // Snapshot, Entwicklung, Spielplan, Formkarten — nichts, was man aus Versehen auslöst.
    expect(BODY).toContain("window.confirm(\"Neue Saison starten?");
  });

  it("schaltet schreibende Knöpfe im Nur-Lesen-Modus ab", () => {
    expect(PANEL).toContain("disabled={busy || readOnly}");
    // `prizeApplied` hiess frueher so und beantwortete die falsche Frage (gibt es ein
    // Audit-Log?). Der Riegel haengt jetzt an der tatsaechlichen Zahlung — der
    // Nur-Lesen-Teil der Bedingung ist unveraendert.
    expect(PANEL.replace(/\s+/g, " ")).toContain('seasonEndPayoutStatus === "paid" || readOnly ? null');
  });
});
