/**
 * BATTLE-MODUS, TEIL 1: DIE PAARUNGEN. 16 Teams, 20 Spieltage.
 *
 * Geprueft wird hier genau das, was `lib/season/battle-mode-spielplan.ts` behauptet — Funktion fuer
 * Funktion, nicht nur am fertigen Spielstand:
 *   1. Die Platzhalter-Auswahl liefert 16 Teams und ist stabil.
 *   2. Die 15 Pflichtrunden sind eine echte Round-Robin: 120 verschiedene Paare, jedes Team an
 *      jedem Spieltag genau einmal, jedes Team gegen jedes andere genau einmal.
 *   3. Der Teamwert-Schnappschuss rechnet Kadermarktwert + Kasse, sortiert absteigend und teilt
 *      in Baender.
 *   4. Die 5 Zusatzrunden wiederholen keine Paarung UNTEREINANDER und bleiben im eigenen oder
 *      benachbarten Band — die Zusicherung „kein kleines Team fuenf Spieltage gegen die Spitze".
 *   5. Der zusammengesetzte Plan traegt 160 Fixtures, jedes Team in genau 20.
 *
 * ZUR OFFENEN FRAGE (siehe Kopf von battle-mode-spielplan.ts): „ein Gegner, den es in den 15
 * Pflichtrunden noch nicht hatte" ist rechnerisch unmoeglich — 15 volle Runden verbrauchen ALLE
 * 120 Paare. Der Test unten haelt diese Rechnung ausdruecklich fest, damit die Vorgabe nicht
 * spaeter als „vergessen" statt als „widerspruechlich" gelesen wird.
 */
import { describe, expect, it } from "vitest";

import {
  BATTLE_MODE_BAND_ANZAHL,
  BATTLE_MODE_ROUND_ROBIN_RUNDEN,
  BATTLE_MODE_SPIELTAG_ANZAHL,
  BATTLE_MODE_TEAM_ANZAHL,
  BATTLE_MODE_ZUSATZRUNDEN,
  baueAusgeglicheneZusatzrunden,
  baueBattleModeFixtures,
  baueBattleModeSpielplan,
  baueBattleModeTeamwertSchnappschuss,
  baueRoundRobinRunden,
  erneuereBattleModeZusatzrunden,
  paarSchluessel,
  waehleBattleModeTeamIds,
} from "@/lib/season/battle-mode-spielplan";
import { loadSourceTeams } from "@/lib/data/dataAdapter";

const QUELL_TEAMS = loadSourceTeams();
const BATTLE_TEAM_IDS = waehleBattleModeTeamIds(QUELL_TEAMS);
const MATCHDAY_IDS = Array.from({ length: BATTLE_MODE_SPIELTAG_ANZAHL }, (_, index) => `matchday-${index + 1}`);

function schnappschussAusKasse(teamIds: string[]) {
  return baueBattleModeTeamwertSchnappschuss({
    seasonId: "season-1",
    quelle: "new_game_seed",
    teams: teamIds.map((teamId, index) => ({ teamId, cash: 1000 - index * 13 })),
    rosters: [],
    players: [],
    teamIds,
    erstelltAm: "2026-01-01T00:00:00.000Z",
  });
}

describe("Battle-Modus: die Platzhalter-Teamauswahl", () => {
  it("nimmt genau 16 der 32 Teams", () => {
    expect(QUELL_TEAMS).toHaveLength(32);
    expect(BATTLE_TEAM_IDS).toHaveLength(BATTLE_MODE_TEAM_ANZAHL);
  });

  it("ist die alphabetisch erste Haelfte — bewusst stumpf, bis Chris seine 16 nennt", () => {
    expect(BATTLE_TEAM_IDS).toEqual([
      "A-A", "B-B", "B-P", "C-C", "C-S", "D-L", "D-P", "G-G",
      "H-R", "L-K", "L-R", "M-M", "M-S", "N-N", "N-W", "P-C",
    ]);
  });

  it("liefert bei gemischter Eingabereihenfolge dasselbe — der Spielplan darf nicht an der Ladefolge haengen", () => {
    const gemischt = [...QUELL_TEAMS].reverse();
    expect(waehleBattleModeTeamIds(gemischt)).toEqual(BATTLE_TEAM_IDS);
  });
});

describe("Battle-Modus: die 15 Pflichtrunden (Round Robin)", () => {
  const runden = baueRoundRobinRunden(BATTLE_TEAM_IDS);

  it("sind 15 Runden zu je 8 Paarungen", () => {
    expect(runden).toHaveLength(BATTLE_MODE_ROUND_ROBIN_RUNDEN);
    expect(runden.every((runde) => runde.length === BATTLE_MODE_TEAM_ANZAHL / 2)).toBe(true);
  });

  it("setzen an jedem Spieltag jedes Team genau einmal ein — kein Freilos, kein Doppeleinsatz", () => {
    for (const [index, runde] of runden.entries()) {
      const eingesetzt = runde.flat();
      expect(new Set(eingesetzt).size, `Runde ${index + 1}`).toBe(BATTLE_MODE_TEAM_ANZAHL);
    }
  });

  it("verbrauchen ALLE 120 moeglichen Paarungen, jede genau einmal", () => {
    const schluessel = runden.flat().map(([heim, auswaerts]) => paarSchluessel(heim, auswaerts));
    expect(schluessel).toHaveLength(120);
    expect(new Set(schluessel).size).toBe(120);
    // C(16,2) = 120. GENAU DARAUS folgt die offene Frage an Chris: nach diesen 15 Runden gibt es
    // keinen „noch nicht gespielten" Gegner mehr, den die 5 Zusatzrunden nehmen koennten.
    expect((BATTLE_MODE_TEAM_ANZAHL * (BATTLE_MODE_TEAM_ANZAHL - 1)) / 2).toBe(120);
  });

  it("geben keinem Team 15 Heimspiele — auch nicht dem stehenden Team des Kreisverfahrens", () => {
    const heimspiele = new Map<string, number>();
    for (const [heim] of runden.flat()) {
      heimspiele.set(heim, (heimspiele.get(heim) ?? 0) + 1);
    }
    for (const teamId of BATTLE_TEAM_IDS) {
      expect(heimspiele.get(teamId) ?? 0, teamId).toBeGreaterThan(0);
      expect(heimspiele.get(teamId) ?? 0, teamId).toBeLessThan(BATTLE_MODE_ROUND_ROBIN_RUNDEN);
    }
  });

  it("haengen NICHT an einem Seed — derselbe Teamliste, derselbe Plan", () => {
    expect(baueRoundRobinRunden(BATTLE_TEAM_IDS)).toEqual(runden);
  });

  it("verweigern eine ungerade Teamzahl, statt still ein Freilos zu erfinden", () => {
    expect(baueRoundRobinRunden(BATTLE_TEAM_IDS.slice(0, 15))).toEqual([]);
  });
});

describe("Battle-Modus: der Teamwert-Schnappschuss", () => {
  it("ist Kadermarktwert + Kasse", () => {
    const schnappschuss = baueBattleModeTeamwertSchnappschuss({
      seasonId: "season-1",
      quelle: "league_setup_ready",
      teams: [
        { teamId: "A-A", cash: 100 },
        { teamId: "B-B", cash: 50 },
      ],
      rosters: [
        { teamId: "A-A", playerId: "p1", currentValue: 999 },
        { teamId: "B-B", playerId: "p2", currentValue: 999 },
        { teamId: "B-B", playerId: "p3", currentValue: 999 },
      ],
      players: [
        { id: "p1", marketValue: 10 },
        { id: "p2", marketValue: 40 },
        { id: "p3", marketValue: 40 },
      ],
      erstelltAm: "2026-01-01T00:00:00.000Z",
    });
    // B-B: 80 Kader + 50 Kasse = 130 > A-A: 10 + 100 = 110. Der Marktwert des Spielers schlaegt
    // `currentValue` am Kadereintrag — sonst wuerde ein veralteter Mitschrieb den Rang bestimmen.
    expect(schnappschuss.eintraege.map((eintrag) => eintrag.teamId)).toEqual(["B-B", "A-A"]);
    expect(schnappschuss.eintraege[0]).toMatchObject({ kaderMarktwert: 80, cash: 50, teamwert: 130, rang: 1 });
    expect(schnappschuss.eintraege[1]).toMatchObject({ kaderMarktwert: 10, cash: 100, teamwert: 110, rang: 2 });
  });

  it("faellt auf `currentValue` zurueck, wenn der Spieler in der Spielerliste fehlt", () => {
    const schnappschuss = baueBattleModeTeamwertSchnappschuss({
      seasonId: "season-1",
      quelle: "transfer_buy_phase",
      teams: [{ teamId: "A-A", cash: 0 }],
      rosters: [{ teamId: "A-A", playerId: "unbekannt", currentValue: 7 }],
      players: [],
      erstelltAm: "2026-01-01T00:00:00.000Z",
    });
    expect(schnappschuss.eintraege[0]!.kaderMarktwert).toBe(7);
  });

  it("teilt 16 Teams in 4 Baender zu je 4 und behaelt die Quelle im Ergebnis", () => {
    const schnappschuss = schnappschussAusKasse(BATTLE_TEAM_IDS);
    expect(schnappschuss.quelle).toBe("new_game_seed");
    expect(schnappschuss.bandAnzahl).toBe(BATTLE_MODE_BAND_ANZAHL);
    const proBand = new Map<number, number>();
    for (const eintrag of schnappschuss.eintraege) {
      proBand.set(eintrag.band, (proBand.get(eintrag.band) ?? 0) + 1);
    }
    expect([...proBand.entries()].sort()).toEqual([[1, 4], [2, 4], [3, 4], [4, 4]]);
    expect(schnappschuss.eintraege.map((eintrag) => eintrag.rang)).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1),
    );
  });

  it("bricht Gleichstand nach teamId — sonst haengt der Spielplan an der Sortierstabilitaet", () => {
    const gleich = baueBattleModeTeamwertSchnappschuss({
      seasonId: "season-1",
      quelle: "new_game_seed",
      teams: [
        { teamId: "Z-Z", cash: 10 },
        { teamId: "A-A", cash: 10 },
      ],
      rosters: [],
      players: [],
      erstelltAm: "2026-01-01T00:00:00.000Z",
    });
    expect(gleich.eintraege.map((eintrag) => eintrag.teamId)).toEqual(["A-A", "Z-Z"]);
  });
});

describe("Battle-Modus: die 5 ausgeglichenen Zusatzrunden", () => {
  const schnappschuss = schnappschussAusKasse(BATTLE_TEAM_IDS);
  const bandById = new Map(schnappschuss.eintraege.map((eintrag) => [eintrag.teamId, eintrag.band] as const));
  const ergebnis = baueAusgeglicheneZusatzrunden({
    schnappschuss,
    rundenAnzahl: BATTLE_MODE_ZUSATZRUNDEN,
    seed: "test:season-1:battle-mode-fixtures",
    bereitsGepaarteSchluessel: [],
  });

  it("liefert 5 vollstaendige Runden ohne Warnung", () => {
    expect(ergebnis.warnings).toEqual([]);
    expect(ergebnis.runden).toHaveLength(BATTLE_MODE_ZUSATZRUNDEN);
    for (const runde of ergebnis.runden) {
      expect(new Set(runde.flat()).size).toBe(BATTLE_MODE_TEAM_ANZAHL);
    }
  });

  it("wiederholt UNTEREINANDER keine Paarung — 40 verschiedene Begegnungen", () => {
    const schluessel = ergebnis.runden.flat().map(([heim, auswaerts]) => paarSchluessel(heim, auswaerts));
    expect(schluessel).toHaveLength(40);
    expect(new Set(schluessel).size).toBe(40);
  });

  it("paart nur im eigenen oder benachbarten Band — nie Band 1 gegen Band 4", () => {
    for (const [heim, auswaerts] of ergebnis.runden.flat()) {
      const abstand = Math.abs(bandById.get(heim)! - bandById.get(auswaerts)!);
      expect(abstand, `${heim} vs ${auswaerts}`).toBeLessThanOrEqual(1);
    }
  });

  it("gibt keinem Team fuenf Gegner aus demselben Band — Chris' „Mix, nicht nur schwach gegen schwach\"", () => {
    const gegnerBaender = new Map<string, number[]>();
    for (const [heim, auswaerts] of ergebnis.runden.flat()) {
      gegnerBaender.set(heim, [...(gegnerBaender.get(heim) ?? []), bandById.get(auswaerts)!]);
      gegnerBaender.set(auswaerts, [...(gegnerBaender.get(auswaerts) ?? []), bandById.get(heim)!]);
    }
    // Jedes Team hat genau 5 Zusatzgegner ...
    for (const teamId of BATTLE_TEAM_IDS) {
      expect(gegnerBaender.get(teamId), teamId).toHaveLength(BATTLE_MODE_ZUSATZRUNDEN);
    }
    // ... und ueber die ganze Liga sind nicht alle 40 Begegnungen bandintern (sonst waere es
    // genau das starre Schema, das Chris nicht wollte).
    const bandintern = ergebnis.runden
      .flat()
      .filter(([heim, auswaerts]) => bandById.get(heim) === bandById.get(auswaerts)).length;
    expect(bandintern).toBeGreaterThan(0);
    expect(bandintern).toBeLessThan(40);
  });

  it("ist deterministisch am Seed — gleicher Seed gleicher Plan, anderer Seed anderer Plan", () => {
    const nochmal = baueAusgeglicheneZusatzrunden({
      schnappschuss,
      rundenAnzahl: BATTLE_MODE_ZUSATZRUNDEN,
      seed: "test:season-1:battle-mode-fixtures",
      bereitsGepaarteSchluessel: [],
    });
    expect(nochmal.runden).toEqual(ergebnis.runden);

    const anders = baueAusgeglicheneZusatzrunden({
      schnappschuss,
      rundenAnzahl: BATTLE_MODE_ZUSATZRUNDEN,
      seed: "ein-ganz-anderer-seed",
      bereitsGepaarteSchluessel: [],
    });
    expect(anders.runden).not.toEqual(ergebnis.runden);
  });

  it("respektiert vorgegebene Sperren — der Parameter ist nicht nur Zierde", () => {
    const gesperrt = paarSchluessel(BATTLE_TEAM_IDS[0]!, BATTLE_TEAM_IDS[1]!);
    const mitSperre = baueAusgeglicheneZusatzrunden({
      schnappschuss,
      rundenAnzahl: BATTLE_MODE_ZUSATZRUNDEN,
      seed: "test:season-1:battle-mode-fixtures",
      bereitsGepaarteSchluessel: [gesperrt],
    });
    const schluessel = mitSperre.runden.flat().map(([heim, auswaerts]) => paarSchluessel(heim, auswaerts));
    expect(schluessel).not.toContain(gesperrt);
  });

  it("haelt auch bei 200 verschiedenen Teamwert-Verteilungen durch, ohne das Band zu weiten", () => {
    let geweitet = 0;
    for (let lauf = 0; lauf < 200; lauf += 1) {
      const verteilung = baueBattleModeTeamwertSchnappschuss({
        seasonId: "season-1",
        quelle: "league_setup_ready",
        teams: BATTLE_TEAM_IDS.map((teamId, index) => ({ teamId, cash: 1000 - index * 7 - (lauf % 5) * index })),
        rosters: [],
        players: [],
        erstelltAm: "2026-01-01T00:00:00.000Z",
      });
      const lauf5 = baueAusgeglicheneZusatzrunden({
        schnappschuss: verteilung,
        rundenAnzahl: BATTLE_MODE_ZUSATZRUNDEN,
        seed: `stress-${lauf}`,
        bereitsGepaarteSchluessel: [],
      });
      expect(lauf5.runden, `Lauf ${lauf}`).toHaveLength(BATTLE_MODE_ZUSATZRUNDEN);
      const schluessel = lauf5.runden.flat().map(([heim, auswaerts]) => paarSchluessel(heim, auswaerts));
      expect(new Set(schluessel).size, `Lauf ${lauf}`).toBe(40);
      if (lauf5.warnings.some((warnung) => warnung.startsWith("battle_mode_zusatzrunde_band_geweitet"))) {
        geweitet += 1;
      }
    }
    // Gemessen: 0 von 200. Die Weitung ist die Reissleine, nicht der Normalfall.
    expect(geweitet).toBe(0);
  });

  it("meldet eine ungerade Teamzahl, statt ein Team stumm fallen zu lassen", () => {
    const ungerade = baueAusgeglicheneZusatzrunden({
      schnappschuss: schnappschussAusKasse(BATTLE_TEAM_IDS.slice(0, 15)),
      rundenAnzahl: 1,
      seed: "x",
    });
    expect(ungerade.runden).toEqual([]);
    expect(ungerade.warnings).toContain("battle_mode_zusatzrunden_ungerade_teamzahl");
  });
});

describe("Battle-Modus: der fertige Fixture-Plan", () => {
  const schnappschuss = schnappschussAusKasse(BATTLE_TEAM_IDS);
  const { fixtures, warnings } = baueBattleModeFixtures({
    teamIds: BATTLE_TEAM_IDS,
    matchdayIds: MATCHDAY_IDS,
    schnappschuss,
    seed: "test:season-1:battle-mode-fixtures",
  });

  it("traegt 20 Spieltage à 8 Begegnungen = 160 Fixtures, ohne Warnung", () => {
    expect(warnings).toEqual([]);
    expect(fixtures).toHaveLength(160);
    for (const matchdayId of MATCHDAY_IDS) {
      expect(fixtures.filter((fixture) => fixture.matchdayId === matchdayId), matchdayId).toHaveLength(8);
    }
  });

  it("setzt jedes Team in genau 20 Begegnungen ein — einmal je Spieltag", () => {
    const einsaetze = new Map<string, number>();
    for (const fixture of fixtures) {
      einsaetze.set(fixture.homeTeamId, (einsaetze.get(fixture.homeTeamId) ?? 0) + 1);
      einsaetze.set(fixture.awayTeamId, (einsaetze.get(fixture.awayTeamId) ?? 0) + 1);
    }
    expect(einsaetze.size).toBe(BATTLE_MODE_TEAM_ANZAHL);
    for (const teamId of BATTLE_TEAM_IDS) {
      expect(einsaetze.get(teamId), teamId).toBe(BATTLE_MODE_SPIELTAG_ANZAHL);
    }
  });

  it("laesst kein Team gegen sich selbst antreten und vergibt eindeutige Fixture-Ids", () => {
    expect(fixtures.every((fixture) => fixture.homeTeamId !== fixture.awayTeamId)).toBe(true);
    expect(new Set(fixtures.map((fixture) => fixture.id)).size).toBe(fixtures.length);
    expect(fixtures.every((fixture) => fixture.status === "scheduled")).toBe(true);
  });

  it("trifft in den Spieltagen 1..15 jedes Paar genau einmal, in 16..20 hoechstens ein zweites Mal", () => {
    const pflicht = fixtures.filter((fixture) => Number(fixture.matchdayId.split("-")[1]) <= 15);
    const zusatz = fixtures.filter((fixture) => Number(fixture.matchdayId.split("-")[1]) > 15);
    const pflichtPaare = pflicht.map((fixture) => paarSchluessel(fixture.homeTeamId, fixture.awayTeamId));
    const zusatzPaare = zusatz.map((fixture) => paarSchluessel(fixture.homeTeamId, fixture.awayTeamId));
    expect(new Set(pflichtPaare).size).toBe(120);
    expect(new Set(zusatzPaare).size).toBe(40);
    // Kein Paar trifft sich dreimal: 120 + 40 = 160, und jedes Zusatzpaar hat genau einen
    // Pflicht-Partner — mehr als zweimal kann sich damit niemand begegnen.
    const zaehler = new Map<string, number>();
    for (const schluessel of [...pflichtPaare, ...zusatzPaare]) {
      zaehler.set(schluessel, (zaehler.get(schluessel) ?? 0) + 1);
    }
    expect(Math.max(...zaehler.values())).toBe(2);
  });
});

describe("Battle-Modus: der Nach-Schnappschuss, sobald die Kader stehen", () => {
  const basisTeams = QUELL_TEAMS.filter((team) => BATTLE_TEAM_IDS.includes(team.teamId)).map((team) => ({
    teamId: team.teamId,
    cash: team.cash,
  }));
  const vorher = baueBattleModeSpielplan({
    seasonId: "season-1",
    matchdayIds: MATCHDAY_IDS,
    teams: basisTeams,
    rosters: [],
    players: [],
    teamIds: BATTLE_TEAM_IDS,
    quelle: "new_game_seed",
    seed: "save-x:season-1:battle-mode-fixtures",
    erstelltAm: "2026-01-01T00:00:00.000Z",
  });

  const gameState = {
    playMode: "battle" as const,
    season: { id: "season-1", matchdayIds: MATCHDAY_IDS },
    seasonState: { schedule: vorher.fixtures },
    teams: basisTeams,
    // Ein Kader, der die Rangfolge umdreht: das alphabetisch letzte Team bekommt den teuersten
    // Spieler. Nur so laesst sich zeigen, dass der Nachlauf WIRKLICH neu bewertet.
    rosters: BATTLE_TEAM_IDS.map((teamId, index) => ({
      teamId,
      playerId: `p-${index}`,
      currentValue: 0,
    })),
    players: BATTLE_TEAM_IDS.map((_, index) => ({ id: `p-${index}`, marketValue: index * 1_000_000 })),
  };

  const nachher = erneuereBattleModeZusatzrunden(gameState, { saveId: "save-x", erstelltAm: "2026-02-01T00:00:00.000Z" });

  it("laesst die Spieltage 1..15 buchstabengleich — die Pflichtrunde haengt nicht an der Staerke", () => {
    const pflicht = (fixtures: typeof vorher.fixtures) =>
      fixtures.filter((fixture) => Number(fixture.matchdayId.split("-")[1]) <= 15);
    expect(pflicht(nachher.seasonState.schedule)).toEqual(pflicht(vorher.fixtures));
  });

  it("zieht die Spieltage 16..20 neu, weil sich die Rangfolge geaendert hat", () => {
    const zusatz = (fixtures: typeof vorher.fixtures) =>
      fixtures.filter((fixture) => Number(fixture.matchdayId.split("-")[1]) > 15);
    expect(zusatz(nachher.seasonState.schedule)).not.toEqual(zusatz(vorher.fixtures));
    expect(nachher.seasonState.schedule).toHaveLength(160);
  });

  it("ist im Management-Modus ein echtes No-op — DIESELBE Referenz, nicht nur derselbe Inhalt", () => {
    const management = { ...gameState, playMode: undefined };
    expect(erneuereBattleModeZusatzrunden(management, { saveId: "save-x" })).toBe(management);
  });
});
