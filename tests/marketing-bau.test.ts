import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { stempleFinanzenJeSpieltagBeimAnlegen, summeSpieltagBuchungen } from "@/lib/finance/finanzen-je-spieltag";
import { bucheSpieltagFinanzen } from "@/lib/finance/finanzen-je-spieltag-buchung";
import { buildKontoauszuege } from "@/lib/finance/kontoauszug";
import { resolveSeasonGuvByTeam } from "@/lib/finance/season-guv-resolver";
import { FANPROFILE, TRAIT_TABELLE } from "@/lib/marketing/marketing-daten";
import {
  MARKETING_KONFIG,
  berechneMarketing,
  berechneTeamAnteil,
  driftFanfarbe,
  moralZuschlagAus,
  teammarkeAusRang,
  tonDerFans,
  type FanProfil,
} from "@/lib/marketing/marketing-modell";
import {
  gueltigerMarketingStempel,
  marketingAktiv,
  marketingRegelFuerNeueSaison,
  stempleMarketingBeimAnlegen,
  stempleMarketingNachLaden,
} from "@/lib/marketing/marketing-regel";
import { leereMarketingCache, marketingCacheSchluessel, marketingSaisonbetrag, marketingStempelFuerSaisonwechsel, marketingTeamUebersicht } from "@/lib/marketing/marketing-team";
import { moralOhneWerbung, assessPlayerMorale } from "@/lib/morale/player-morale-service";
import { baueMarktMarketability } from "@/lib/marketing/marketing-markt";
import { CANONICAL_NEGATIVE_TRAITS, CANONICAL_POSITIVE_TRAITS } from "@/lib/training/class-progression-config";
import teamsRoh from "@/data/source/teams.json";

/**
 * MARKETING (22.11., docs/design/marketing-22-11.md, Bau: docs/design/marketing-bau-22-11.md): Formel des Team-Anteils mit Grenzen und
 * Netz, Buchung je Spieltag = gezeigt, Stempel und Schalter, Nebel der Marktspalte, Mehrspieler (je Team getrennt), Mensch = KI.
 */

const HELL_RAISERS: FanProfil = {
  teamId: "H-R",
  name: "Hell Raisers",
  ton: tonDerFans(1),
  zielgruppe: "x",
  mag: FANPROFILE["H-R"]!.mag,
  meidet: FANPROFILE["H-R"]!.meidet,
  fanfarbe: [7, 8, 5, 0],
};

const TEAM_A = "A-A";
const TEAM_B = "B-B";

function bestuecke(gameState: GameState, jeTeam = 8): GameState {
  const used = new Set(gameState.rosters.map((r) => r.playerId));
  const frei = gameState.players.filter((p) => !used.has(p.id));
  let zaehler = 0;
  const rosters = [...gameState.rosters];
  for (const team of gameState.teams) {
    for (let i = 0; i < jeTeam; i += 1) {
      const player = frei[zaehler++]!;
      rosters.push({
        id: `mkt-roster-${team.teamId}-${i}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: 5 + (i % 4),
        upkeep: 5 + (i % 4),
        purchasePrice: 10,
        currentValue: 10,
        roleTag: "bench",
        joinedSeasonId: gameState.season.id,
      });
    }
  }
  return { ...gameState, rosters };
}

function fixture(): { ohne: GameState; mit: GameState } {
  const basis = stempleFinanzenJeSpieltagBeimAnlegen(bestuecke(createFreshSeasonOneGameState()));
  return { ohne: basis, mit: stempleMarketingBeimAnlegen(basis) };
}

function buchAlle(gameState: GameState, bis?: number): GameState {
  let gs = gameState;
  for (const id of gameState.season.matchdayIds.slice(0, bis)) gs = bucheSpieltagFinanzen(gs, id);
  return gs;
}

function mitEnv<T>(wert: string | undefined, f: () => T): T {
  const vorher = process.env.OLY_MARKETING;
  try {
    if (wert == null) delete process.env.OLY_MARKETING;
    else process.env.OLY_MARKETING = wert;
    return f();
  } finally {
    if (vorher == null) delete process.env.OLY_MARKETING;
    else process.env.OLY_MARKETING = vorher;
  }
}

describe("Stammdaten: nur echte Rassen, Klassen und Traits", () => {
  it("32 Fanprofile, jeder Trait der Listen steht in der Trait-Tabelle, kein Trait auf beiden Seiten", () => {
    expect(Object.keys(FANPROFILE)).toHaveLength(32);
    const echteTeams = new Set((teamsRoh as Array<{ teamId: string }>).map((t) => t.teamId));
    for (const [id, p] of Object.entries(FANPROFILE)) {
      expect(echteTeams.has(id), id).toBe(true);
      for (const t of [...p.mag.traits, ...p.meidet.traits]) expect(TRAIT_TABELLE[t.toLowerCase()], `${id} ${t}`).toBeTruthy();
      expect(p.mag.traits.filter((t) => p.meidet.traits.includes(t)), id).toEqual([]);
      expect(p.farbeStart.reduce((a, b) => a + b, 0), id).toBe(20);
    }
  });

  it("die Trait-Tabelle deckt alle 36 kanonischen Traits ab", () => {
    for (const t of [...CANONICAL_POSITIVE_TRAITS, ...CANONICAL_NEGATIVE_TRAITS]) expect(TRAIT_TABELLE[t.toLowerCase()], t).toBeTruthy();
  });
});

describe("Team-Anteil: Formel, Grenzen, Sicherheitsnetz", () => {
  const erfolgVerfehlt = { erfolgPunkte: -3, erfolgGrund: "Saisonziel verfehlt" };

  it("Bloodseeker (Gesicht, Saisonziel verfehlt): 40 + 8 - 3 = 45 %, das Netz (25 % des Gehalts) greift", () => {
    const a = berechneTeamAnteil({ traits: ["FiredUp", "Fearless", "Cruel", "Scandalous", "Obsessive"], moralOhne: 61, restlaufzeit: 2, klausel: 0, istGesicht: true }, erfolgVerfehlt);
    expect(a.prozent).toBe(45);
    const e = berechneMarketing(
      { race: "Human", className: "Rogue", alignment: "C-B", traits: ["FiredUp", "Fearless", "Cruel", "Scandalous", "Obsessive"], leistungPerz: 83, gehalt: 13.39, moralOhne: 61, restlaufzeit: 2, istGesicht: true },
      { profil: HELL_RAISERS, liga: 1, ...erfolgVerfehlt },
    );
    expect(e.netzGreift).toBe(true);
    expect(e.ansTeam).toBeCloseTo(0.25 * 13.39, 6);
    expect(e.ansTeam + e.anIhn).toBeCloseTo(e.werbegeld, 9);
  });

  it("Vixen (Diva, letzte Saison, Klausel fuer sie): rechnerisch unter 15, die Untergrenze haelt bei 15 %", () => {
    const a = berechneTeamAnteil({ traits: ["Eloquent", "Sexy", "FiredUp", "Diva", "Vindictive", "Obsessive"], moralOhne: 55, restlaufzeit: 1, klausel: -1, istGesicht: false }, erfolgVerfehlt);
    expect(a.roh).toBeLessThan(15);
    expect(a.prozent).toBe(15);
  });

  it("Kadis (Loyal, Caring, Gesicht, Farb-Meister): die Obergrenze haelt bei 65 %", () => {
    const a = berechneTeamAnteil({ traits: ["Loyal", "Diligent", "Caring"], moralOhne: 78, restlaufzeit: 3, klausel: 0, istGesicht: true }, { erfolgPunkte: 6, erfolgGrund: "Farb-Meister" });
    expect(a.roh).toBeGreaterThan(65);
    expect(a.prozent).toBe(65);
  });

  it("der Anteil bleibt immer in 15..65 und das Team bekommt nie mehr als 25 % des Gehalts", () => {
    const traitNamen = Object.values(TRAIT_TABELLE).map((t) => t.name);
    let n = 0;
    for (let i = 0; i < traitNamen.length; i += 1) {
      const traits = [traitNamen[i]!, traitNamen[(i * 7 + 3) % traitNamen.length]!, traitNamen[(i * 11 + 5) % traitNamen.length]!];
      for (const klausel of [-1, 0, 1] as const) {
        for (const rest of [1, 2, 4]) {
          const e = berechneMarketing(
            { race: "Demon", className: "Berserker", alignment: "C-B", traits, leistungPerz: 40 + i, gehalt: 2 + (i % 5) * 3, moralOhne: 20 + i * 2, restlaufzeit: rest, klausel, istGesicht: i % 2 === 0 },
            { profil: HELL_RAISERS, liga: i % 2 === 0 ? 1 : 2, erfolgPunkte: 6, erfolgGrund: "x" },
          );
          expect(e.teamAnteilProzent).toBeGreaterThanOrEqual(15);
          expect(e.teamAnteilProzent).toBeLessThanOrEqual(65);
          expect(e.ansTeam).toBeLessThanOrEqual(0.25 * (2 + (i % 5) * 3) + 1e-9);
          expect(e.anIhn).toBeGreaterThanOrEqual(-1e-9);
          n += 1;
        }
      }
    }
    expect(n).toBeGreaterThan(100);
  });

  it("Egomaniac will mehr fuer sich als Loyal (gleiche Lage, nur der Trait unterscheidet sich)", () => {
    const basis = { moralOhne: 60, restlaufzeit: 2, klausel: 0 as const, istGesicht: false };
    const ego = berechneTeamAnteil({ ...basis, traits: ["Egomaniac"] }, erfolgVerfehlt).prozent;
    const loyal = berechneTeamAnteil({ ...basis, traits: ["Loyal"] }, erfolgVerfehlt).prozent;
    expect(loyal).toBeGreaterThan(ego);
  });

  it("Werbegeld: Unter Marketability 30 gibt es nichts, Mauler bei Hell Raisers liegt im Konzeptbereich", () => {
    const schwach = berechneMarketing(
      { race: "Human", className: "Tactician", alignment: "N-N", traits: ["Timid", "Lazy"], leistungPerz: 5, gehalt: 3 },
      { profil: HELL_RAISERS, liga: 1, erfolgPunkte: 0, erfolgGrund: "x" },
    );
    expect(schwach.werbegeld).toBe(0);
    const mauler = berechneMarketing(
      { race: "Demon", className: "Templar", alignment: "C-B", traits: ["Scandalous", "Egomaniac", "Cruel", "FiredUp"], leistungPerz: 90, gehalt: 20.5 },
      { profil: HELL_RAISERS, liga: 1, erfolgPunkte: 0, erfolgGrund: "x" },
    );
    expect(mauler.marketability).toBeGreaterThan(85);
    expect(mauler.werbegeld).toBeGreaterThan(6);
    expect(mauler.werbegeld).toBeLessThanOrEqual(MARKETING_KONFIG.werbeMax[1]);
  });

  it("Verletzte zaehlen zur Haelfte", () => {
    const e = { race: "Demon", className: "Templar", alignment: "C-B", traits: ["Scandalous", "Cruel"], leistungPerz: 80, gehalt: 10 };
    const t = { profil: HELL_RAISERS, liga: 1 as const, erfolgPunkte: 0, erfolgGrund: "x" };
    expect(berechneMarketing({ ...e, verletzt: true }, t).werbegeld).toBeCloseTo(berechneMarketing(e, t).werbegeld * 0.5, 9);
  });
});

describe("Moral aus dem Spieler-Anteil", () => {
  it("Stufen 0,5 / 1,5 / 3 / 5 C geben +2 / +4 / +6 / +8", () => {
    expect([0.4, 0.5, 1.4, 1.5, 2.9, 3, 4.9, 5, 9].map((c) => moralZuschlagAus(c, []))).toEqual([0, 2, 2, 4, 4, 6, 6, 8, 8]);
  });
  it("Diva zaehlt anderthalbfach, Altruistic halb", () => {
    expect(moralZuschlagAus(5, ["Diva"])).toBe(12);
    expect(moralZuschlagAus(5, ["Altruistic"])).toBe(4);
  });
  it("Fanfarbe: driftet langsam, haelt Summe 20 und bleibt am Anker (+-6)", () => {
    const start: [number, number, number, number] = [7, 8, 5, 0];
    let farbe = start;
    for (let i = 0; i < 12; i += 1) farbe = driftFanfarbe(farbe, start, [0, 0, 1, 0], [0, 0, 1, 0], 0.2);
    expect(farbe.reduce((a, b) => a + b, 0)).toBeCloseTo(20, 1);
    farbe.forEach((x, i) => {
      expect(x).toBeGreaterThanOrEqual(Math.max(0, start[i]! - 6) - 1e-9);
      expect(x).toBeLessThanOrEqual(start[i]! + 6 + 1e-9);
    });
    expect(farbe[2]!).toBeGreaterThan(start[2]!);
    const einmal = driftFanfarbe(start, start, [0, 0, 1, 0], [0, 0, 1, 0], 0.1);
    expect(einmal[2]! - start[2]!).toBeLessThan(2.5);
  });
});

describe("Stempel und Schalter", () => {
  it("neues Spiel bekommt den Stempel, bestehender Spielstand rechnet seine Saison ohne zu Ende, Stempeln ist idempotent", () => {
    const { ohne, mit } = fixture();
    expect(gueltigerMarketingStempel(mit)?.regel).toBe("an");
    expect(marketingAktiv(mit)).toBe(true);
    expect(marketingAktiv(ohne)).toBe(false);
    expect(stempleMarketingBeimAnlegen(mit)).toBe(mit);
    const geladen = stempleMarketingNachLaden(ohne);
    expect(gueltigerMarketingStempel(geladen)?.regel).toBe("aus");
    expect(marketingAktiv(geladen)).toBe(false);
    expect(stempleMarketingNachLaden(geladen)).toBe(geladen);
  });

  it("ein fremder Stempel zaehlt nicht; ohne Finanzen je Spieltag gilt Marketing nicht", () => {
    const { mit } = fixture();
    const fremd: GameState = { ...mit, seasonState: { ...mit.seasonState, marketingRegel: { seasonId: "season-99", regel: "an" } } };
    expect(marketingAktiv(fremd)).toBe(false);
    const ohneFjs: GameState = { ...mit, seasonState: { ...mit.seasonState, finanzenJeSpieltag: null } };
    expect(marketingAktiv(ohneFjs)).toBe(false);
  });

  it("OLY_MARKETING=aus: neue Saisons bekommen 'aus', gestempelte Saisons rechnen weiter; aus-sofort ist die Notbremse", () => {
    const { mit } = fixture();
    mitEnv("aus", () => {
      expect(marketingRegelFuerNeueSaison("season-2", ["A-A"]).regel).toBe("aus");
      expect(marketingAktiv(mit)).toBe(true);
    });
    mitEnv("aus-sofort", () => expect(marketingAktiv(mit)).toBe(false));
    mitEnv("an", () => expect(marketingRegelFuerNeueSaison("season-2", ["A-A"]).regel).toBe("an"));
    mitEnv(undefined, () => expect(marketingRegelFuerNeueSaison("season-2", ["A-A"]).regel).toBe("an"));
  });

  it("die Variable ist nur Server: kein NEXT_PUBLIC-Verweis im Regel-Modul und in compose", async () => {
    const { readFileSync } = await import("node:fs");
    const regel = readFileSync("lib/marketing/marketing-regel.ts", "utf8");
    expect(regel).not.toMatch(/NEXT_PUBLIC_OLY_MARKETING/);
    const compose = readFileSync("deploy/hetzner/docker-compose.yml", "utf8");
    expect(compose).toMatch(/OLY_MARKETING: \$\{OLY_MARKETING:-\}/);
    expect(compose).not.toMatch(/NEXT_PUBLIC_OLY_MARKETING/);
    expect(readFileSync("deploy/hetzner/.env.example", "utf8")).toMatch(/^OLY_MARKETING=$/m);
  });
});

describe("Buchung je Spieltag = gezeigt", () => {
  it("ohne Marketing bucht nichts (keine Zeilenfelder), mit Marketing steht 'marketing' im Ledger und im Kassenstand", () => {
    const { ohne, mit } = fixture();
    const vollOhne = buchAlle(ohne);
    expect(vollOhne.seasonState.spieltagFinanzen!.every((z) => z.marketing === undefined)).toBe(true);
    const vollMit = buchAlle(mit);
    const zeile = vollMit.seasonState.spieltagFinanzen!.find((z) => z.teamId === TEAM_A)!;
    expect(zeile.marketing).toBeGreaterThan(0);
    for (const team of mit.teams) {
      const unterschied = vollMit.teams.find((t) => t.teamId === team.teamId)!.cash - vollOhne.teams.find((t) => t.teamId === team.teamId)!.cash;
      expect(unterschied).toBeCloseTo(summeSpieltagBuchungen(vollMit, team.teamId).marketing, 6);
    }
  });

  it("die Saisonsumme der Buchung entspricht der gezeigten Saisonzahl (Teammarke + Team-Anteile), Rundung hoechstens 0,05", () => {
    const { mit } = fixture();
    const voll = buchAlle(mit);
    const n = mit.season.matchdayIds.length;
    for (const team of [TEAM_A, TEAM_B]) {
      const gebucht = summeSpieltagBuchungen(voll, team).marketing;
      const gezeigt = marketingTeamUebersicht(mit, team).ansKasse;
      expect(Math.abs(gebucht - gezeigt)).toBeLessThanOrEqual(0.05 * 2 + 1e-9);
      // Ein Spieltag ist ein N-tel des Jahresbetrags.
      const eins = bucheSpieltagFinanzen(mit, mit.season.matchdayIds[0]!).seasonState.spieltagFinanzen!.find((z) => z.teamId === team)!;
      expect(Math.abs((eins.marketing ?? 0) - gezeigt / n)).toBeLessThanOrEqual(0.05 + 1e-9);
    }
  });

  it("die GuV zeigt den Posten 'Marketing' mit der Saisonzahl, am Saisonende genau die gebuchte Summe", () => {
    const { mit } = fixture();
    const vorher = resolveSeasonGuvByTeam(mit).get(TEAM_A)!;
    const posten = vorher.posten.find((p) => p.key === "marketing")!;
    expect(posten.label).toBe("Marketing");
    expect(posten.counted).toBe(true);
    expect(posten.amount).toBeCloseTo(marketingTeamUebersicht(mit, TEAM_A).ansKasse, 1);
    const voll = buchAlle(mit);
    const nachher = resolveSeasonGuvByTeam(voll).get(TEAM_A)!.posten.find((p) => p.key === "marketing")!;
    expect(nachher.amount).toBeCloseTo(summeSpieltagBuchungen(voll, TEAM_A).marketing, 1);
    expect(marketingSaisonbetrag(voll, TEAM_A)).toBeCloseTo(summeSpieltagBuchungen(voll, TEAM_A).marketing, 1);
  });

  it("der Kontoauszug fuehrt eine Zeile 'Marketing' je gespieltem Spieltag", () => {
    const { mit } = fixture();
    const nach = buchAlle(mit, 3);
    const zeilen = buildKontoauszuege(nach).get(TEAM_A)!.zeilen.filter((z) => z.art === "marketing_spieltag");
    expect(zeilen).toHaveLength(3);
    expect(zeilen.reduce((s, z) => s + z.betrag, 0)).toBeCloseTo(summeSpieltagBuchungen(nach, TEAM_A).marketing, 6);
  });

  it("Mensch = KI: die Buchung verzweigt nirgends nach Besitzer", () => {
    const { mit } = fixture();
    const gemischt: GameState = {
      ...mit,
      seasonState: {
        ...mit.seasonState,
        teamControlSettings: {
          [mit.teams[1]!.teamId]: { teamId: mit.teams[1]!.teamId, controlMode: "manual" } as never,
          [mit.teams[2]!.teamId]: { teamId: mit.teams[2]!.teamId, controlMode: "ai" } as never,
        },
      },
    };
    const a = bucheSpieltagFinanzen(mit, mit.season.matchdayIds[0]!).seasonState.spieltagFinanzen!;
    const b = bucheSpieltagFinanzen(gemischt, gemischt.season.matchdayIds[0]!).seasonState.spieltagFinanzen!;
    expect(b.map((z) => [z.teamId, z.marketing, z.cashDelta])).toEqual(a.map((z) => [z.teamId, z.marketing, z.cashDelta]));
  });
});

describe("Moral: Werbevertraege als Grund", () => {
  it("der Spieler-Anteil hebt die Moral um den Zuschlag und steht als Grund 'Werbeverträge'; ohne Regel kein Grund", () => {
    const { ohne, mit } = fixture();
    const u = marketingTeamUebersicht(mit, TEAM_A);
    const z = [...u.zeilen].sort((a, b) => b.ergebnis.moralZuschlag - a.ergebnis.moralZuschlag)[0]!;
    // Die Fixture hat nicht zwingend einen Spieler mit Zuschlag; dann prueft der Test nur den Leerfall.
    const mitM = assessPlayerMorale({ gameState: mit, playerId: z.playerId, teamId: TEAM_A })!;
    const ohneM = assessPlayerMorale({ gameState: ohne, playerId: z.playerId, teamId: TEAM_A })!;
    const grund = mitM.reasons.find((r) => r.reasonId === "marketing_werbevertraege");
    if (z.ergebnis.moralZuschlag > 0) {
      expect(grund?.valueDelta).toBe(z.ergebnis.moralZuschlag);
      expect(mitM.morale).toBeGreaterThan(ohneM.morale);
      // "Kein Kreis": die Moral OHNE Werbung ist die Moral der Regel-aus-Welt.
      expect(moralOhneWerbung(mit, z.playerId, TEAM_A)).toBe(ohneM.morale);
    } else {
      expect(grund).toBeUndefined();
    }
    expect(ohneM.reasons.some((r) => r.reasonId === "marketing_werbevertraege")).toBe(false);
  });
});

describe("Mehrspieler: je Team getrennt", () => {
  it("dieselbe Spielerin hat je Team eine andere Marketability (Fanprofil), die Team-Uebersicht liest nur den eigenen Kader", () => {
    const { mit } = fixture();
    const a = marketingTeamUebersicht(mit, TEAM_A);
    const b = marketingTeamUebersicht(mit, TEAM_B);
    expect(a.zeilen.every((z) => mit.rosters.some((r) => r.teamId === TEAM_A && r.playerId === z.playerId))).toBe(true);
    expect(b.zeilen.every((z) => mit.rosters.some((r) => r.teamId === TEAM_B && r.playerId === z.playerId))).toBe(true);
    expect(a.profil.teamId).toBe(TEAM_A);
    expect(b.profil.teamId).toBe(TEAM_B);
    expect(a.zeilen.map((z) => z.playerId).some((id) => b.zeilen.some((z) => z.playerId === id))).toBe(false);
  });
});

describe("Marktspalte: Nebel", () => {
  const spieler = { race: "Demon", className: "Templar", alignment: "C-B", traits: ["Scandalous", "Egomaniac", "Cruel"], leistungPerz: 90 };
  const profil = HELL_RAISERS;

  it("ungescoutet nur die 10er-Stufe, beobachtet die 5er-Stufe, gescoutet exakt; nie ein Zwischenwert", () => {
    const { mit } = fixture();
    const exakt = baueMarktMarketability(mit, TEAM_A, { ...spieler, id: "x" }, 5, profil);
    expect(exakt.exakt).toBe(true);
    const wahr = Number(exakt.text);
    const grob = baueMarktMarketability(mit, TEAM_A, { ...spieler, id: "x" }, 0, profil);
    const fein = baueMarktMarketability(mit, TEAM_A, { ...spieler, id: "x" }, 2, profil);
    expect(grob.text).toMatch(/^\d+–\d+$/);
    expect(grob.bis - grob.von).toBe(9);
    expect(fein.bis - fein.von).toBe(4);
    expect(grob.von).toBeLessThanOrEqual(wahr);
    expect(grob.bis).toBeGreaterThanOrEqual(wahr);
    expect(fein.von % 5).toBe(0);
    expect(grob.von % 10).toBe(0);
  });

  it("Leck-Test: das Ergebnis traegt bei verdecktem Stand keinen exakten Wert und keine Teilformel", () => {
    const { mit } = fixture();
    const grob = baueMarktMarketability(mit, TEAM_A, { ...spieler, id: "x" }, 0, profil);
    const json = JSON.stringify(grob);
    expect(Object.keys(grob).sort()).toEqual(["bis", "exakt", "schluessel", "stufe", "text", "von"]);
    expect(json).not.toMatch(/werbegeld|teamAnteil|reichweite|passung|kante/i);
    // Der Sortierschluessel ist die Mitte der Stufe, fuer alle Spieler derselben Stufe gleich.
    expect(grob.schluessel).toBe((grob.von + grob.bis) / 2);
    const anderer = baueMarktMarketability(mit, TEAM_A, { ...spieler, traits: ["Scandalous", "Cruel", "Cheater"], id: "y" }, 0, profil);
    if (anderer.von === grob.von) expect(anderer.schluessel).toBe(grob.schluessel);
  });

  it("Nebel aus (Stufe 5): exakt", () => {
    const { mit } = fixture();
    const r = baueMarktMarketability(mit, TEAM_B, { ...spieler, id: "z" }, 5, undefined);
    expect(r.exakt).toBe(true);
    expect(r.von).toBe(r.bis);
  });
});

describe("Saisonwechsel: die Fanfarbe driftet, der Verlauf waechst", () => {
  function mitSnapshot(gs: GameState, rangDesTeams: number): GameState {
    const standings = gs.teams.map((t, i) => ({
      teamId: t.teamId,
      teamCode: t.teamId,
      teamName: t.name,
      rank: t.teamId === TEAM_A ? rangDesTeams : i + 2 + (i >= rangDesTeams - 1 ? 1 : 0),
      points: 10,
      disciplinePoints: 10,
      // Das Team sammelt seine Punkte nur in MEN: Erfolgs-Anteil 100 % MEN.
      disciplinePointsByArea: t.teamId === TEAM_A ? { pow: 0, spe: 0, men: 40, soc: 0 } : { pow: 5, spe: 5, men: 5, soc: 5 },
      cashEnd: 0,
    }));
    return { ...gs, seasonState: { ...gs.seasonState, seasonSnapshots: [{ seasonId: gs.season.id, finalStandings: standings } as never] } };
  }

  it("Kader und Erfolg ziehen die Farbe, ein Schritt bewegt sie hoechstens um 20 % des Abstands; Summe 20; Verlauf traegt den Start", () => {
    const { mit } = fixture();
    const alt = mit.seasonState.marketingRegel!.fanfarbe![TEAM_A]!;
    const gs = mitSnapshot(mit, 1);
    const neu = marketingStempelFuerSaisonwechsel(gs, gs.season.id, "season-2");
    expect(neu.seasonId).toBe("season-2");
    expect(neu.regel).toBe("an");
    const farbe = neu.fanfarbe![TEAM_A]!;
    expect(farbe.reduce((a, b) => a + b, 0)).toBeCloseTo(20, 1);
    expect(farbe[2]!).toBeGreaterThan(alt[2]!);
    expect(farbe[2]! - alt[2]!).toBeLessThanOrEqual(0.2 * (20 - alt[2]!) + 1e-9);
    const verlauf = neu.verlauf![TEAM_A]!;
    expect(verlauf).toHaveLength(2);
    expect(verlauf[0]!.farbe).toEqual(alt);
    expect(verlauf[1]!.grund).toMatch(/Titel|Farb-Meister/);
    // Zweiter Wechsel: der Verlauf waechst weiter.
    const naechste: GameState = { ...gs, season: { ...gs.season, id: "season-2" }, seasonState: { ...gs.seasonState, seasonId: "season-2", marketingRegel: neu } };
    const dritte = marketingStempelFuerSaisonwechsel(mitSnapshot({ ...naechste }, 12), "season-2", "season-3");
    expect(dritte.verlauf![TEAM_A]).toHaveLength(3);
  });

  it("lief die Vorsaison ohne Marketing, startet die Farbe frisch bei den Stammdaten (und der Schalter aus gibt 'aus')", () => {
    const { ohne } = fixture();
    const gs = mitSnapshot(stempleMarketingNachLaden(ohne), 3);
    const neu = marketingStempelFuerSaisonwechsel(gs, gs.season.id, "season-2");
    expect(neu.regel).toBe("an");
    expect(neu.fanfarbe![TEAM_A]).toEqual(FANPROFILE[TEAM_A]!.farbeStart);
    mitEnv("aus", () => expect(marketingStempelFuerSaisonwechsel(gs, gs.season.id, "season-2").regel).toBe("aus"));
  });
});

describe("Schere: Teammarke nach Finanzwert und Deckel der Team-Anteile", () => {
  it("Teammarke ist umgekehrt gestaffelt (reich weniger, arm mehr), Liga 2 mehr als Liga 1, Ligamittel L1 3,0 / L2 5,0 C", () => {
    expect(teammarkeAusRang(1, 1, 16)).toBeLessThan(teammarkeAusRang(1, 16, 16));
    expect(teammarkeAusRang(2, 1, 16)).toBeLessThan(teammarkeAusRang(2, 16, 16));
    for (const liga of [1, 2] as const) {
      const werte = Array.from({ length: 16 }, (_, i) => teammarkeAusRang(liga, i + 1, 16));
      expect(Math.min(...werte)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...werte)).toBeLessThanOrEqual(9);
    }
    const mittel = (l: number[]) => l.reduce((a, b) => a + b, 0) / l.length;
    expect(mittel(Array.from({ length: 16 }, (_, i) => teammarkeAusRang(1, i + 1, 16)))).toBeCloseTo(3.0, 0);
    expect(mittel(Array.from({ length: 16 }, (_, i) => teammarkeAusRang(2, i + 1, 16)))).toBeCloseTo(5.0, 0);
    // Ein Kreis mit 32 Teams (ohne Liga-Split) wird auf dieselbe Spanne normiert.
    expect(teammarkeAusRang(1, 32, 32)).toBeCloseTo(teammarkeAusRang(1, 16, 16), 5);
  });

  it("der Deckel kuerzt die Team-Anteile auf die Summe und gibt den Rest als Spieler-Anteil (Moral) weiter", () => {
    const { mit } = fixture();
    const vorher = marketingTeamUebersicht(mit, TEAM_A);
    const konfig = MARKETING_KONFIG as unknown as { teamAnteileDeckel: number };
    const alt = konfig.teamAnteileDeckel;
    try {
      konfig.teamAnteileDeckel = Math.max(0.1, vorher.teamAnteile / 2);
      leereMarketingCache();
      const nachher = marketingTeamUebersicht({ ...mit }, TEAM_A);
      expect(nachher.deckelGreift).toBe(true);
      expect(nachher.teamAnteile).toBeCloseTo(konfig.teamAnteileDeckel, 6);
      expect(nachher.werbegeld).toBeCloseTo(vorher.werbegeld, 9);
      expect(nachher.spielerAnteile).toBeCloseTo(vorher.spielerAnteile + (vorher.teamAnteile - nachher.teamAnteile), 6);
      for (const z of nachher.zeilen) expect(z.ergebnis.ansTeam + z.ergebnis.anIhn).toBeCloseTo(z.ergebnis.werbegeld, 9);
    } finally {
      konfig.teamAnteileDeckel = alt;
      leereMarketingCache();
    }
  });
});

describe("Dauer-Cache: einmal je Saison und Kaderstand", () => {
  it("ein neues GameState-Objekt mit gleichem Kader trifft den Cache (gleiches Objekt), ein Kaderwechsel rechnet neu", () => {
    const { mit } = fixture();
    leereMarketingCache();
    const a = marketingTeamUebersicht(mit, TEAM_A);
    const b = marketingTeamUebersicht({ ...mit, teams: [...mit.teams] }, TEAM_A);
    expect(b).toBe(a);
    // Gebuchte Spieltage veraendern den Schluessel nicht.
    const gebucht = bucheSpieltagFinanzen(mit, mit.season.matchdayIds[0]!);
    expect(marketingCacheSchluessel(gebucht, TEAM_A)).toBe(marketingCacheSchluessel(mit, TEAM_A));
    expect(marketingTeamUebersicht(gebucht, TEAM_A)).toBe(a);
    // Verkauf eines Spielers: neuer Schluessel, neue Rechnung.
    const ohneEinen: GameState = { ...mit, rosters: mit.rosters.filter((r) => !(r.teamId === TEAM_A && r.playerId === a.zeilen[0]!.playerId)) };
    expect(marketingCacheSchluessel(ohneEinen, TEAM_A)).not.toBe(marketingCacheSchluessel(mit, TEAM_A));
    expect(marketingTeamUebersicht(ohneEinen, TEAM_A)).not.toBe(a);
    // Klausel-Aenderung ebenso.
    const klausel: GameState = { ...mit, rosters: mit.rosters.map((r) => (r.teamId === TEAM_A && r.playerId === a.zeilen[0]!.playerId ? { ...r, marketingKlausel: 1 as const } : r)) };
    expect(marketingCacheSchluessel(klausel, TEAM_A)).not.toBe(marketingCacheSchluessel(mit, TEAM_A));
  });
});
