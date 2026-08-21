/**
 * GEMELDET VON CHRIS: „zum zeitpunkt der verlängerung müsste wenn da vertrag läuft aus die
 * vertragslänge von allen doch schon um 1 reduziert sein oder nicht?"
 *
 * Ja — und genau das passierte nicht. Der Schritt, der die Vertraege altert
 * (`applySeasonEndContractTick`), war vollstaendig gebaut: Dienst da, Route da
 * (`stepId: "contract_renewal"`), im Cockpit als Karte „Verlaengern" sichtbar. Nur konnte ihn
 * NIEMAND ausloesen — die Karte ist reine Anzeige ohne Knopf, und im Client gibt es genau zwei
 * Aufrufe der Workflow-Route: die Vorschau und „Neue Saison starten".
 *
 * Der Tick lief dadurch nur als Nebenwirkung IM Saisonstart — also erst, wenn die
 * Verlaengerungsphase vorbei war. Am gemeldeten Spielstand: 285 auslaufende Vertraege, kein
 * einziger auf Laufzeit 0, `hasSeasonEndContractTickApplied` false. „Laeuft aus" stand ueberall,
 * entschieden werden konnte nichts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const UEBERGANG = readFileSync(join(process.cwd(), "lib/season/season-transition-service.ts"), "utf8");
const NACHZIEHER = readFileSync(join(process.cwd(), "lib/contracts/vertragsalterung-nachziehen.ts"), "utf8");
const ROUTE = readFileSync(join(process.cwd(), "app/api/contracts/renewal/route.ts"), "utf8");
const DIENST = readFileSync(join(process.cwd(), "lib/contracts/contract-renewal-service.ts"), "utf8");

describe("Die Alterung läuft beim Betreten der Saisonende-Phase", () => {
  it("fährt den Tick im Schritt, der auf season_end_management schaltet", () => {
    // `player_development` ist der Hop, dessen Folgephase `season_end_management` ist — die Phase,
    // in der verlängert und verkauft wird.
    expect(UEBERGANG).toContain("computeSeasonEndContractTick(progressionSave)");
    const block = UEBERGANG.slice(
      UEBERGANG.indexOf("DIE VERTRAEGE ALTERN, BEVOR UEBER SIE ENTSCHIEDEN WIRD"),
      UEBERGANG.indexOf("const transition: SeasonTransitionState"),
    );
    expect(block).toContain('currentStep === "player_development"');
  });

  it("altert NACH dem Marktwert-Freeze, nicht davor", () => {
    // Der Freeze hält den Stand vor der Marktöffnung fest; der Tick bucht Abgangs-Cash. Erst
    // einfrieren, dann buchen hält die Reihenfolge, die der Saisonstart ohnehin voraussetzt.
    expect(UEBERGANG.indexOf("patchSeasonSnapshotMarketValueAfterProgression")).toBeLessThan(
      UEBERGANG.indexOf("computeSeasonEndContractTick(progressionSave)"),
    );
  });

  it("blockiert den Saisonübergang nicht, wenn die Alterung scheitert", () => {
    // Ein blockierter Übergang sperrt Verlängerungen und Verkäufe gleich mit aus — dieselbe
    // Entscheidung wie bei der Spielerentwicklung eine Zeile darüber.
    const block = UEBERGANG.slice(
      UEBERGANG.indexOf("DIE VERTRAEGE ALTERN, BEVOR UEBER SIE ENTSCHIEDEN WIRD"),
      UEBERGANG.indexOf("const transition: SeasonTransitionState"),
    );
    expect(block).toContain("catch (error)");
    expect(block).toContain("season_end_contract_tick_failed");
  });
});

describe("Spielstände, die schon in der Phase stehen, holen die Alterung nach", () => {
  it("die Vertragsroute zieht sie nach, bevor irgendetwas gerechnet wird", () => {
    expect(ROUTE).toContain("zieheVertragsalterungNach({ save: gefundenerSave, persistence })");
    // Vor dem Phasen-Gate und vor der Vorschau — sonst rechnet beides auf dem alten Stand.
    // Verglichen werden die AUFRUFE, nicht die Importzeilen weiter oben.
    expect(ROUTE.indexOf("zieheVertragsalterungNach({")).toBeLessThan(
      ROUTE.indexOf("evaluateGamePhaseAction(save.gameState"),
    );
    expect(ROUTE.indexOf("zieheVertragsalterungNach({")).toBeLessThan(
      ROUTE.indexOf("previewContractRenewalAction({"),
    );
  });

  it("tut außerhalb des Saisonende-Fensters nichts", () => {
    // Mitten in der Saison dürfen Verträge nicht altern.
    expect(NACHZIEHER).toContain("if (!isSeasonEndPhase(save.gameState.gamePhase))");
  });

  it("tut nichts, wenn die Alterung für die Saison schon gelaufen ist", () => {
    expect(NACHZIEHER).toContain("if (hasSeasonEndContractTickApplied(save.gameState))");
  });

  it("blockiert die Anfrage nicht, wenn die Reparatur scheitert", () => {
    expect(NACHZIEHER).toContain("season_end_contract_tick_nachziehen_fehlgeschlagen");
  });
});

/**
 * DIE AUSNAHME, DIE WEG MUSSTE.
 *
 * Mit der Freigabe der Verlängerung in der letzten Vertragssaison kam ein Schutz für „frisch
 * unterschriebene" Verträge: sie sollten beim Tick kein Jahr verlieren. Seit die Alterung beim
 * Betreten der Phase läuft, liegt jede Verlängerung dahinter — es gibt nichts zu schützen.
 *
 * Stehen bleiben durfte der Schutz trotzdem nicht: am gemeldeten Spielstand trug Xelara zwei
 * Verlängerungs-Ereignisse aus der kaputten Zwischenzeit und wurde deshalb von der Alterung
 * ausgenommen. Sie blieb als EINZIGE ihres Teams auf Laufzeit 1 „auslaufend" stehen, während die
 * anderen drei sauber alterten — genau der Zustand, aus dem Chris nicht herauskam.
 */
describe("Die Alterung nimmt niemanden aus", () => {
  it("kennt keine Ausnahme für frisch unterschriebene Verträge", () => {
    expect(DIENST).not.toContain("frischUnterschrieben");
  });

  it("erklärt im Quelltext, warum es die Ausnahme nicht mehr gibt", () => {
    // Ohne die Begründung baut sie der nächste Durchgang wieder ein.
    expect(DIENST).toContain('HIER STAND EIN SCHUTZ FUER „FRISCH UNTERSCHRIEBENE" VERTRAEGE');
  });
});
