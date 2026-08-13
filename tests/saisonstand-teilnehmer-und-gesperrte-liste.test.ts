/**
 * ZWEI MELDUNGEN, EIN MUSTER: EINE GRÖSSE MESSEN UND EINE ANDERE BEHAUPTEN.
 *
 * (1) TEILNEHMERZAHL IM SAISONSTAND — Chris: „hier sind in klammern bei den diszis teils 0
 *     spieler ausgewiesen bitte prüfen und korrigieren".
 *
 *     Am Live-Spielstand nachgemessen (Save `…-0kalpx`, 352 Kombinationen aus Team × angetretener
 *     Disziplin): 22 davon (6 %) trugen eine ZU KLEINE Zahl. Pirate Crew etwa Wettessen „(4)" bei
 *     sechs Antritten, Football „(1)" bei zwei. Gezählt wurden nur Spieler mit PPs > 0 — der
 *     Tooltip daneben behauptete aber, so viele Spieler seien „hier im Einsatz" gewesen. Wer
 *     angetreten ist und nichts geholt hat, fiel heraus.
 *
 *     KORREKTUR ZU MEINER ERSTEN VERMUTUNG: es gab KEINEN Fall, in dem eine bereits bestrittene
 *     Disziplin auf (0) stand. Die (0)-Zeilen im Screenshot sind Disziplinen, die die Liga noch
 *     nicht gespielt hat — die einzige echte Ausnahme war Basketball, dessen Buchung
 *     fehlgeschlagen war (eigener Fix).
 *
 * (2) GESPERRTE EINSATZLISTE — Chris: „ich habe alle spieler eingesetzt die ich einsetzen konnte
 *     daran dürfte es nicht haken hier an der stelle darf dann kein blocker entstehen".
 *
 *     Auf dem Schirm stand blank `lineup_draft_is_locked` in Rot, direkt über dem gelben Hinweis
 *     „Du kannst so speichern und in die Arena". Ein Rohcode, und dazu als Fehler eingestuft,
 *     obwohl es ein Zustand ist: der Spieltag läuft, die Liste ist abgegeben.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { uebersetzeLineupFehler } from "@/lib/lineups/lineup-fehlertexte";
import { buildSeasonStandingsTopPlayersByTeam } from "@/lib/foundation/season-standings-top-players";

const TEAM = "P-C";

const zustand = {
  players: [
    { id: "p-1", name: "Sloth" },
    { id: "p-2", name: "Nightwish" },
    { id: "p-3", name: "Akatsuki" },
  ],
  rosters: [
    { teamId: TEAM, playerId: "p-1" },
    { teamId: TEAM, playerId: "p-2" },
    { teamId: TEAM, playerId: "p-3" },
  ],
} as never;

/** Nur p-1 hat in Football PPs geholt — p-2 und p-3 sind angetreten und gingen leer aus. */
const ledger = {
  playerSummariesByPlayerId: new Map([["p-1", { pointsByDiscipline: { football: 4.5 } }]]),
};

const antritte = [
  { teamId: TEAM, playerId: "p-1", disciplineId: "football" },
  { teamId: TEAM, playerId: "p-2", disciplineId: "football" },
  { teamId: TEAM, playerId: "p-3", disciplineId: "football" },
];

function bauen(mitAntritten: boolean) {
  return buildSeasonStandingsTopPlayersByTeam({
    gameState: zustand,
    playerRatingsById: null,
    seasonPointsLedger: ledger,
    appearances: mitAntritten ? antritte : null,
  });
}

describe("Saisonstand · die Klammer zählt Antritte, nicht Punkte", () => {
  it("zählt jeden, der angetreten ist — auch ohne einen einzigen PP", () => {
    expect(bauen(true).get(TEAM)?.football).toHaveLength(3);
  });

  it("hätte vorher nur den mit Punkten gezählt", () => {
    // Die Gegenprobe zum Befund: ohne die Antritte bleibt genau der alte, zu kleine Wert.
    expect(bauen(false).get(TEAM)?.football).toHaveLength(1);
  });

  it("behält die PPs als Wert und setzt sie sonst auf 0", () => {
    const eintraege = bauen(true).get(TEAM)?.football ?? [];
    expect(eintraege.find((e) => e.playerId === "p-1")?.value).toBe(4.5);
    // 0 ist hier eine Auskunft („war dabei, hat nichts geholt"), keine Lücke.
    expect(eintraege.find((e) => e.playerId === "p-2")?.value).toBe(0);
  });

  it("führt niemanden doppelt, der über beide Quellen kommt", () => {
    const ids = (bauen(true).get(TEAM)?.football ?? []).map((e) => e.playerId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sortiert die Punktesammler weiterhin nach vorn", () => {
    expect(bauen(true).get(TEAM)?.football?.[0]?.playerId).toBe("p-1");
  });

  it("erfindet keine Disziplin, in der niemand angetreten ist", () => {
    // Ohne Antritt und ohne PPs bleibt die Spalte leer — die Klammer zeigt dann ehrlich (0).
    expect(bauen(true).get(TEAM)?.tennis).toBeUndefined();
  });
});

describe("Einsatzliste · gesperrt ist kein Fehler", () => {
  const datei = readFileSync(join(process.cwd(), "app/foundation/legacy-lineup-lab/LineupNewLook.tsx"), "utf8");

  it("übersetzt den Sperr-Code in einen Satz", () => {
    // Der Wortlaut gehoert `lib/lineups/lineup-fehlertexte.ts` (kam parallel ueber #514) — hier
    // wird nur gepinnt, dass ueberhaupt uebersetzt wird. Zwei Tabellen fuer dieselben Codes waeren
    // wieder zwei Quellen; meine eigene Fassung im allgemeinen Blocker-Woerterbuch ist deshalb
    // beim Zusammenfuehren wieder herausgeflogen.
    const text = uebersetzeLineupFehler("lineup_draft_is_locked");
    expect(text).not.toContain("_");
    expect(text.length).toBeGreaterThan(20);
  });

  it("lässt keinen Rohcode mehr durch die Fehlerzeile", () => {
    // Vorher: `errors.join(" · ")` — der technische Bezeichner landete unübersetzt auf dem Schirm.
    expect(datei).not.toContain('{errors.join(" · ")}');
    expect(datei).toContain("uebersetzeLineupFehlerListe(blockingErrors)");
  });

  it("nimmt den gesperrten Zustand aus der roten Fehlerzeile heraus", () => {
    expect(datei).toContain('errors.filter((code) => code !== "lineup_draft_is_locked")');
    expect(datei).toContain('data-testid="nl-lineup-locked-notice"');
  });

  it("übersetzt auch die übrigen Codes der Einsatzliste", () => {
    for (const code of [
      "lineup_not_operationally_ready",
      "form_cards_season_is_not_active",
      "form_card_plan_matchday_missing",
      "form_card_plan_discipline_side_missing",
    ]) {
      expect(uebersetzeLineupFehler(code), `${code} ohne Übersetzung`).not.toBe(code);
    }
  });
});
