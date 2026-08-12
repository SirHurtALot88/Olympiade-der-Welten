import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildSeasonFormCardBonusByTeamId } from "@/lib/foundation/season-form-card-bonus";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * VIER SPALTEN DES SAISONSTANDS WAREN TOT, UND ZWAR AUS ZWEI GRUENDEN.
 *
 * Gemessen am Abnahme-Spielstand (frisches Spiel, Saison 1 komplett gespielt, Saison 2 bis
 * Spieltag 4) im Browser gegen dieselben Zahlen aus der SQLite:
 *
 *  - „Formkarten" und „Rest": in allen 32 Zeilen „—", Titel „Keine Formkarten in dieser
 *    Saison". Serverseitig lagen 680 Karten, alle 32 Teams mit positivem Tank; im
 *    Client-Payload waren sie vollstaendig da (680 `cardValue` nachgezaehlt).
 *  - „Gebaeude": in allen 32 Zeilen „—", obwohl 24 von 32 Teams einen Unterhalt zwischen
 *    1,4 und 4,8 tragen.
 *  - „Transfers": in allen 32 Zeilen „—".
 *
 * URSACHE 1 — die Werte entstanden nur auf einem Pfad, der nie gerendert wird. Der
 * `FoundationSeasonV2Host` (und mit ihm `useSeasonV2PanelModel`) wird importiert, aber nirgends
 * gerendert: `<FoundationShellRouterSeasonV2` kommt in keiner Datei vor. Gerendert wird
 * `use-foundation-shell-router-body-scope` → `FoundationShellRouterBody` →
 * `FoundationSeasonV2Panel` → `SeasonStandingsV2Client`. Alle vier Props sind am Client
 * OPTIONAL, deshalb gab es keinen Typfehler, und beide Renderer schreiben bei fehlendem Wert
 * bewusst „—" — der Ausfall sah aus wie eine Aussage.
 *
 * Dieselbe Fehlerklasse hatte `teamTopPlayersByColumn` schon einmal, siehe
 * `tests/season-standings-discipline-participants.test.ts`.
 *
 * URSACHE 2 — der Transfersaldo war zwar berechnet, aber ueber ALLE Saisons. Er stand damit als
 * einzige Alle-Zeiten-Zahl in einer Zeile aus lauter Saisonwerten.
 */
describe("Saisonstand: die Finanz- und Formkarten-Spalten haengen am gerenderten Pfad", () => {
  const scope = read("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
  const body = read("app/foundation/FoundationShellRouterBody.tsx");

  /**
   * WARUM HIER QUELLTEXT GEPRUEFT WIRD: der Fehler war ein fehlender Prop zwischen zwei
   * Komponenten, nicht eine falsche Zahl. Eine Wertpruefung kann ihn nicht sehen — die
   * Rechenfunktionen waren die ganze Zeit richtig (der Wert-Teil steht weiter unten). Der
   * Test haelt genau das fest, was gefehlt hat: die Verdrahtung.
   */
  it("baut die Formkarten-Bilanz auf dem gerenderten Pfad und reicht sie an den Saisonstand durch", () => {
    expect(scope).toContain("buildSeasonFormCardBonusByTeamId");
    expect(scope).toContain("seasonV2FormCardBonusByTeamId");
    expect(body).toContain("teamFormCardBonusByTeamId={seasonV2FormCardBonusByTeamId}");
  });

  it("setzt Gebaeude, Transfersaldo und die GuV-Posten in die gerenderte Saisonstand-Zeile", () => {
    const zeile = scope.slice(scope.indexOf("const seasonV2StandingsRows"));
    expect(zeile).toContain("buildingCost: computeTeamBuildingCost(gameState, row.teamId)");
    expect(zeile).toContain("transferNet: row.transferNet ?? row.transfersSeasonValue ?? null");
    expect(zeile).toContain("guvPosten: row.guvPosten ?? null");
  });
});

/**
 * Der Wert-Teil: derselbe Spielstand, einmal mit Karten der laufenden und einmal mit Karten
 * einer anderen Saison. Die Rechnung war nie kaputt — dieser Test haelt sie fest, damit der
 * Verdrahtungstest oben nicht die einzige Absicherung bleibt.
 */
describe("Formkarten-Tank je Team", () => {
  const basis = {
    seasonState: {
      lineupDrafts: [
        {
          seasonId: "season-2",
          modifiers: { d1: { primaryFormCardId: "karte-plus-gespielt" } },
        },
      ],
      formCards: [
        { id: "karte-plus-gespielt", seasonId: "season-2", teamId: "T1", cardValue: 8 },
        { id: "karte-plus-offen", seasonId: "season-2", teamId: "T1", cardValue: 4 },
        { id: "karte-minus-offen", seasonId: "season-2", teamId: "T1", cardValue: -4 },
        { id: "karte-niete", seasonId: "season-2", teamId: "T1", cardValue: 0 },
        { id: "karte-andere-saison", seasonId: "season-1", teamId: "T1", cardValue: 99 },
      ],
    },
  } as never;

  it("zaehlt den vollen Tank der Saison und den ungespielten Rest", () => {
    const eintrag = buildSeasonFormCardBonusByTeamId(basis, "season-2").get("T1");
    expect(eintrag).toBeDefined();
    // Tank = alle positiven Nennwerte der Saison (8 + 4), NICHT die gespielten allein.
    expect(eintrag!.poolPositive).toBe(12);
    // Rest = nur die ungespielte Pluskarte.
    expect(eintrag!.remainingPositive).toBe(4);
    // Nieten (Wert 0) zaehlen nicht mit — Chris: „0er formkarten darf es geben das sind nieten".
    expect(eintrag!.poolCards).toBe(3);
    // Die Karte der Vorsaison faerbt nicht ein.
    expect(eintrag!.poolPositive).not.toBe(111);
  });

  it("liefert fuer eine Saison ohne Karten eine leere Bilanz — dort ist der Strich richtig", () => {
    expect(buildSeasonFormCardBonusByTeamId(basis, "season-9").size).toBe(0);
  });
});

/**
 * Der Transfersaldo einer Saisonzeile darf nur die Transfers DIESER Saison summieren.
 *
 * Gemessen am Abnahme-Spielstand: Wrecking Legionnaires zeigte −251,47 (alle Saisons), der
 * Saldo der laufenden Saison 2 ist −43,48. Der Loewenanteil stammte aus dem Liga-Draft der
 * Saison 1, der jeden Grundstock-Spieler als Kauf schreibt.
 */
describe("Transfersaldo im Saisonstand", () => {
  function spielstand() {
    return {
      season: { id: "season-2", matchdayIds: [] },
      gamePhase: "season_active",
      teams: [
        { teamId: "T1", shortCode: "T1", name: "Team Eins", budget: 100, cash: 100, identityId: "i1", humanControlled: false, rosterLimit: 14 },
      ],
      players: [],
      rosters: [],
      disciplines: [],
      transferHistory: [
        // Saison 1: der Liga-Draft — gross, und genau der Betrag, der die Spalte verfaelscht hat.
        { id: "t1", playerId: "p1", seasonId: "season-1", transferType: "buy", toTeamId: "T1", fromTeamId: null, fee: 200 },
        { id: "t2", playerId: "p2", seasonId: "season-1", transferType: "sell", toTeamId: null, fromTeamId: "T1", fee: 50 },
        // Saison 2: das, was die Zeile zeigen soll.
        { id: "t3", playerId: "p3", seasonId: "season-2", transferType: "buy", toTeamId: "T1", fromTeamId: null, fee: 30 },
        { id: "t4", playerId: "p4", seasonId: "season-2", transferType: "sell", toTeamId: null, fromTeamId: "T1", fee: 12 },
      ],
      seasonState: { standings: {}, seasonSnapshots: [] },
    } as never;
  }

  it("summiert nur die Transfers der angezeigten Saison", () => {
    const zeilen = buildTeamSeasonOverviewRows({ gameState: spielstand(), seasonId: "season-2" });
    const zeile = zeilen.find((eintrag) => eintrag.teamId === "T1");
    expect(zeile).toBeDefined();
    // 12 verkauft − 30 gekauft = −18. Der Alle-Zeiten-Saldo waere −168 gewesen.
    expect(zeile!.transferNet).toBe(-18);
    expect(zeile!.transferNet).not.toBe(-168);
  });

  it("zeigt fuer die Vorsaison deren eigenen Saldo, nicht den der laufenden", () => {
    const zeilen = buildTeamSeasonOverviewRows({ gameState: spielstand(), seasonId: "season-1" });
    const zeile = zeilen.find((eintrag) => eintrag.teamId === "T1");
    // 50 verkauft − 200 gekauft = −150.
    expect(zeile!.transferNet).toBe(-150);
  });
});
