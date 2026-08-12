import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { GamePhase } from "@/lib/data/olyDataTypes";
import { isSeasonEndPhase } from "@/lib/season/season-transition-chain";

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
    /*
     * NACHGEZOGEN (P1/Topf a, Begruendung im Test statt im PR-Text):
     * Die alte Zusicherung nannte die zwei Phasen `season_completed || season_review` woertlich
     * im Quelltext. Diese Aussage gilt NACHWEISLICH nicht mehr: das Gate wurde bewusst
     * VERBREITERT auf `isSeasonEndPhase(...)` (FoundationShellRouterBody.tsx, Kommentar an der
     * Stelle: „Sichtbar in JEDER Saisonende-Phase, nicht nur in den ersten beiden. Vorher stand
     * hier `season_completed || season_review` — die Liste verschwand also genau dann, wenn der
     * Spieler ueber den Rueckblick hinaus war"). Die alte Fassung war der Fehler, nicht die neue.
     *
     * Und der Vertrag wird jetzt am WERT geprueft, nicht an einer Zeichenkette: welche Phasen
     * das Panel zeigen, entscheidet `isSeasonEndPhase` — eine abgeleitete Menge aus der
     * Saisonende-Kette. Eine zweite handgezaehlte Liste an dieser Stelle waere genau die
     * Doppelquelle, die den Bildschirm zuletzt hat verschwinden lassen.
     */
    const saisonende: GamePhase[] = [
      "season_completed",
      "season_review",
      "season_rewards",
      "player_development",
      "season_end_management",
      "transfer_sell_phase",
      "transfer_buy_phase",
      "lineup_setup",
      "next_season_ready",
    ];
    for (const phase of saisonende) {
      expect(isSeasonEndPhase(phase), `${phase} gehoert zum Saisonende`).toBe(true);
    }
    // Mitten in der Saison waere ein Abschluss-Block Unsinn und wuerde die Tabelle verdecken.
    expect(isSeasonEndPhase("season_active")).toBe(false);
    expect(isSeasonEndPhase("preseason_management")).toBe(false);
    expect(isSeasonEndPhase(null)).toBe(false);
    expect(isSeasonEndPhase(undefined)).toBe(false);

    // Und das Panel haengt wirklich an DIESER Frage (eine Quelle, keine zweite Liste).
    expect(BODY).toContain('activeView === "seasonV2" && isSeasonEndPhase(gameState.gamePhase)');
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
