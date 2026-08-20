/**
 * DIE SPONSORENLISTE RECHNET MIT DEM GELD, DAS WIRKLICH VOM KONTO GEHT — UND IHRE APRON-MARKE
 * FRAGT DIE APRON SELBST.
 *
 * GEMELDET VON CHRIS (`cankgm`, „Welt · Sponsoren", Spielstand `hwz8fk`, Saison 2, MD1):
 * „M-M hat einen legendären Sponsor der 85 mio auf ihrem Level bringt oder 90 mio auf platz 1!
 * Wieso gehen sie all out, nehmen einen Kredit und gehen auf über 120 mio Gehalt hoch?"
 *
 * DREI GEHALTSSUMMEN, EINE SEITE. `lib/sponsor/sponsor-team-salary-display.ts` führt:
 *
 *   getTeamDisplaySalaryTotal      geglättet  (`contract.expectedSalary`)  M-M: 98,9
 *   getTeamActualSalaryTotal       echt       (`contract.salary`)          M-M: 123,5
 *   getTeamNegotiatedSalaryTotal   verhandelt                              M-M: 115,1
 *
 * Chris' „über 120" ist damit exakt richtig — er hatte die echte Summe im Kopf, die Liste zeigte
 * die geglättete. Abgebucht wird am Saisonende `contract.salary` (`sponsor-settlement-service.ts`),
 * die Deckungsfrage („trägt der Sponsor die Mannschaft?") ist also eine Cashflow-Frage und nimmt
 * die echte Summe. Dieselbe Folgerung hat die Kredite-Seite längst gezogen.
 *
 * SCHLIMMER ALS EINE BESCHRIFTUNG war die Apron-Marke daneben: sie verglich die GEGLÄTTETE Summe
 * mit den Linien, während die Abgabe selbst gegen die ECHTE rechnet (`getTeamApronSalaryBase`).
 * Über alle sieben Live-Spielstände nachgezählt trugen **61 von 224 Teamzeilen die falsche Zone**,
 * und zwar in beide Richtungen:
 *
 *   hwz8fk  13/32   C-S „über 2. Linie" (79,4) — echt 61,6, also nur über der ersten
 *                   B-B „unter"          (58,3) — echt 61,3, zahlt also
 *   1hf25q  12/32   C-S „über 2. Linie" (81,6) — echt 63,6, unter BEIDEN Linien
 *   swnjlk   6/32 · h0z7cl 9/32 · 0kalpx 5/32 · n90y4m 3/32 · 89rv3s 13/32
 *
 * Wer die eine Zahl gegen den Apron las und die andere in der Anzeige, kam zwangsläufig auf einen
 * Widerspruch. Genau so ist diese Meldung entstanden.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { getTeamApronSalaryBase } from "@/lib/season/apron-service";
import {
  getTeamActualSalaryTotal,
  getTeamDisplaySalaryTotal,
} from "@/lib/sponsor/sponsor-team-salary-display";
import type { GameState } from "@/lib/data/olyDataTypes";

const SEITE = readFileSync(
  join(process.cwd(), "app/foundation/sponsors-v2/FoundationSponsorsNewLook.tsx"),
  "utf8",
);

/**
 * Ein Team, dessen geglättete und echte Gehaltssumme AUSEINANDERLIEGEN — sonst prüft der Test
 * nichts.
 *
 * Die geglättete Summe kommt aus `contract.expectedSalary`, das ohne Attribute auf
 * `player.salaryDemand` zurückfällt (player-economy-contract.ts:473); die echte aus
 * `contract.salary`, also der Vertragszahlung dieser Saison am Kadereintrag. Fünf Spieler mit
 * `salaryDemand: 20` und `salary: 30` ergeben damit 100 gegen 150 — dasselbe Auseinanderlaufen
 * wie am Live-Spielstand, nur in klein.
 */
function spielstand(): GameState {
  const spieler = Array.from({ length: 5 }, (_, index) => ({
    id: `p-${index}`,
    name: `Spieler ${index}`,
    marketValue: 30,
    salaryDemand: 20,
  }));
  return {
    teams: [{ teamId: "M-M", shortCode: "M-M", name: "Mayhem", cash: 1.2 }],
    players: spieler,
    rosters: spieler.map((player) => ({
      id: `r-${player.id}`,
      teamId: "M-M",
      playerId: player.id,
      salary: 30,
      contractLength: 3,
      purchasePrice: 30,
      currentValue: 30,
    })),
    seasonState: {},
  } as unknown as GameState;
}

describe("Die drei Gehaltssummen sind wirklich drei verschiedene Zahlen", () => {
  it("geglättet und echt liegen im Aufbau auseinander — sonst misst dieser Test nichts", () => {
    const gs = spielstand();
    expect(getTeamDisplaySalaryTotal(gs, "M-M")).toBe(100);
    expect(getTeamActualSalaryTotal(gs, "M-M")).toBe(150);
  });

  it("die Apron bemisst die ECHTE Summe, nicht die geglättete", () => {
    // Die Zusage aus `getTeamApronSalaryBase`: eine Grundlage für jede Apron-Frage im Baum.
    const gs = spielstand();
    expect(getTeamApronSalaryBase(gs, "M-M")).toBe(getTeamActualSalaryTotal(gs, "M-M"));
    expect(getTeamApronSalaryBase(gs, "M-M")).not.toBe(getTeamDisplaySalaryTotal(gs, "M-M"));
  });
});

describe("Die Sponsorenliste nimmt dieselben Zahlen wie die Apron und die Abbuchung", () => {
  it("die Kostenbasis der Deckungsspalte ist die ECHTE Gehaltssumme", () => {
    // Cashflow-Frage → `contract.salary`. Die geglättete Summe darf hier nicht mehr stehen.
    expect(SEITE).toContain("const salaryTotal = getTeamActualSalaryTotal(gameState, team.teamId);");
    expect(SEITE).not.toContain("getTeamDisplaySalaryTotal(gameState, team.teamId)");
  });

  it("die Apron-Marke holt ihre Grundlage bei der Apron, statt sie nachzubauen", () => {
    // Der Kern des Befunds: nicht „irgendeine richtige Zahl", sondern DIE Zahl, gegen die die
    // Abgabe rechnet. Nur so kann die Marke nicht wieder von der Abgabe wegdriften.
    expect(SEITE).toContain("getTeamApronSalaryBase(gameState, team.teamId)");
    const marke = SEITE.slice(SEITE.indexOf("const apronStatus"), SEITE.indexOf("return {", SEITE.indexOf("const apronStatus")));
    expect(marke).toContain("apronSalaryBase");
    expect(marke).not.toContain("salaryTotal");
  });

  it("die Gehaltszahl in der Erklärung sagt, WELCHE sie ist", () => {
    // Ohne den Zusatz stehen zwei richtige Zahlen unbeschriftet nebeneinander, und man liest die
    // eine gegen die andere — der Weg, auf dem diese Meldung entstanden ist.
    expect(SEITE).toContain("(real gezahlt in dieser Saison)");
  });
});

describe("Die veraltete Auskunft über die Apron-Grundlage ist entschärft", () => {
  it("der Kopf von `getTeamNegotiatedSalaryTotal` behauptet nicht mehr, er sei die Apron-Basis", () => {
    /**
     * Dieser Absatz stand nach der zweiten Umstellung unverändert weiter und hat bei der
     * Untersuchung dieser Meldung genau die falsche Annahme erzeugt, gegen die der Test oben
     * steht. Ein Kommentar, der einmal wahr war, ist keine Quelle.
     */
    const quelle = readFileSync(join(process.cwd(), "lib/sponsor/sponsor-team-salary-display.ts"), "utf8");
    const kopf = quelle.slice(0, quelle.indexOf("export function getTeamNegotiatedSalaryTotal"));
    const letzterAbsatz = kopf.slice(kopf.lastIndexOf("DIE VERHANDELTE Gehaltssumme"));
    expect(letzterAbsatz).toContain("GESCHICHTE UND NICHT DER STAND");
    expect(letzterAbsatz).toContain("getTeamApronSalaryBase");
  });
});
