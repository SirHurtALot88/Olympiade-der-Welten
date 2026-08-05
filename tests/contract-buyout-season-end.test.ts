/**
 * GEMELDET AUS DEM SPIEL (MD10, Saisonende, Verträge-Tabelle):
 * „hier stehen immernoch werte bei buyout trotz auslaufender verträge! der buyout müsste zu dem
 * zeitpunkt dann bei allen schon um 1 vertragsjahr geringer sein"
 *
 * Stimmt — und nicht nur am Saisonende. Ein Verkauf, und damit der Buyout, ist überhaupt nur
 * möglich, wenn das Verkaufsfenster offen ist (`isLocalTransferSellWindowOpen` in
 * `transfermarkt-local-service`; sonst lehnt der Server mit `sell_only_at_season_end` ab). Zu
 * diesem Zeitpunkt ist das laufende Vertragsjahr aber gespielt und bezahlt — es gehört nicht mehr
 * in die Ablöse.
 *
 * Die Verträge-Tabelle rechnete mit `seasonsElapsed: 0`, also der vollen Restlaufzeit INKLUSIVE
 * des laufenden Jahres. Ein auslaufender Vertrag zeigte damit noch ein volles Jahresgehalt als
 * Buyout, obwohl der Spieler ohnehin geht.
 *
 * Dieselbe Rechnung macht die Spalte „VK" der Spielerliste seit jeher
 * (`transfermarkt-expected-sell-value.ts`, dort ausführlich begründet) — zwei Tabellen zeigten
 * also verschiedene Buyouts für denselben Spieler.
 *
 * `calculateOpenBuyoutCost` ist eine reine Funktion und wird hier ECHT gerechnet, nicht am
 * Quelltext geprüft. Der Aufrufparameter in der Verträge-Tabelle wird zusätzlich festgenagelt,
 * weil genau dort die 0 stand.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { ContractYearSalary } from "@/lib/data/olyDataTypes";
import { calculateOpenBuyoutCost } from "@/lib/market/contract-negotiation-preview";

const year = (salary: number, index: number): ContractYearSalary =>
  ({ seasonId: `season-${index + 1}`, seasonLabel: `S${index + 1}`, salary }) as ContractYearSalary;

describe("Buyout — das laufende Vertragsjahr zählt nicht mehr mit", () => {
  /** DER GEMELDETE FALL: „LÄUFT AUS" heisst Restlaufzeit 1 — danach ist Schluss, also kein Buyout. */
  it("ein auslaufender Vertrag hat keinen Buyout mehr", () => {
    expect(calculateOpenBuyoutCost([year(5.2, 0)], 1)).toBe(0);
  });

  /** „um 1 Vertragsjahr geringer": aus 4 × 3,4 werden 3 × 3,4. */
  it("ein laufender Vertrag kostet ein Jahr weniger", () => {
    const schedule = [year(3.4, 0), year(3.4, 1), year(3.4, 2), year(3.4, 3)];
    expect(calculateOpenBuyoutCost(schedule, 0)).toBe(13.6);
    expect(calculateOpenBuyoutCost(schedule, 1)).toBe(10.2);
  });

  /** Bei ungleichen Jahresgehältern (front-/back-loaded) fällt genau das ERSTE Jahr weg. */
  it("es faellt das erste Jahr weg, nicht ein Durchschnitt", () => {
    const frontLoaded = [year(10, 0), year(2, 1), year(2, 2)];
    expect(calculateOpenBuyoutCost(frontLoaded, 1)).toBe(4);
    const backLoaded = [year(2, 0), year(2, 1), year(10, 2)];
    expect(calculateOpenBuyoutCost(backLoaded, 1)).toBe(12);
  });

  it("ein leerer Plan bleibt ohne Aussage", () => {
    expect(calculateOpenBuyoutCost([], 1)).toBeNull();
  });
});

/**
 * NACHTRAG — die erste Antwort auf den Befund oben war nur die halbe.
 *
 * Sie setzte in der Verträge-Tabelle eine feste `1` und schrieb ausdrücklich hin, dass der echte
 * Verkaufs-Flow „unberührt" bleibt. Damit rechneten Tabelle und Verkaufsdialog für denselben
 * Spieler verschieden — gemeldet als „da schau, das passt nicht" (Tabelle 0,0 Mio, Dialog 8,8 Mio)
 * und „Buyout kosten — obwohl der Vertrag ausläuft — das darf nicht sein".
 *
 * Am Spielstand gemessen (`fresh-season-1-1785859604037`): 288 von 288 Kaderzeilen bekamen zwei
 * verschiedene Antworten, in Summe 2.334 Mio Unterschied. Jetzt entscheidet
 * `resolveElapsedContractSeasonsForBuyout` — für Tabelle, VK-Spalte, Dialog und Ausführung
 * dieselbe Regel, dieselbe Zahl.
 */
describe("Buyout — Tabelle und Verkaufsdialog fragen dieselbe Regel", () => {
  const SOURCE = readFileSync(join(process.cwd(), "lib/market/contract-negotiation-preview.ts"), "utf8");

  it("die Roster-Zeilen setzen das abgelaufene Jahr nicht mehr von Hand", () => {
    expect(SOURCE).not.toContain("buyoutCost: calculateOpenBuyoutCost(yearlySalarySchedule, 1),");
    expect(SOURCE).not.toContain("buyoutCost: calculateOpenBuyoutCost(yearlySalarySchedule, 0),");
    expect(SOURCE).toContain("resolveElapsedContractSeasonsForBuyout({ gameState: input.gameState, teamId: input.teamId })");
  });

  it("die VK-Spalte der Spielerliste hat ihre Sonderrechnung abgegeben", () => {
    const spalte = readFileSync(join(process.cwd(), "lib/market/transfermarkt-expected-sell-value.ts"), "utf8");
    // Nur der Aufruf zählt, nicht die Erklärung darüber — deshalb ohne Kommentarzeilen geprüft.
    const code = spalte
      .split("\n")
      .filter((zeile) => !/^\s*(\/\/|\*|\/\*)/.test(zeile))
      .join("\n");
    expect(code).not.toContain("seasonsElapsed");
  });

  /**
   * Der Parameter bleibt überschreibbar (Fixtures, der nicht verdrahtete Prisma-Pfad) — nur setzt
   * ihn keine Ansicht mehr auf Verdacht.
   */
  it("der Default der reinen Funktion bleibt bei der vollen Restlaufzeit", () => {
    expect(SOURCE).toContain("export function calculateOpenBuyoutCost(yearlySalarySchedule: ContractYearSalary[], seasonsElapsed = 0)");
  });
});
