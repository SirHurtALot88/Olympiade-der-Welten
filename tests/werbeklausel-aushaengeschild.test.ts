import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { stempleFinanzenJeSpieltagBeimAnlegen } from "@/lib/finance/finanzen-je-spieltag";
import { FANPROFILE } from "@/lib/marketing/marketing-daten";
import { klauselFuerVertrag, klauselZeilen, kiKlauselFuerTeam } from "@/lib/marketing/marketing-klausel";
import {
  MARKETING_KONFIG,
  berechneMarketing,
  gehaltMitKlausel,
  klauselErlaubt,
  klauselGehaltFaktor,
  tonDerFans,
  wirksameKlausel,
  type FanProfil,
} from "@/lib/marketing/marketing-modell";
import { pruefeAushaengeschildWahl, waehleAushaengeschild } from "@/lib/marketing/marketing-aushaengeschild";
import { aushaengeschildFuer, besteSechs, gesichtKandidaten, kiAushaengeschild } from "@/lib/marketing/marketing-kontext";
import { stempleMarketingBeimAnlegen, stempleMarketingNachLaden, werbeklauselAktiv, marketingAktiv } from "@/lib/marketing/marketing-regel";
import { marketingStempelFuerSaisonwechsel, marketingTeamUebersicht } from "@/lib/marketing/marketing-team";
import { isBereichDelegiert } from "@/lib/foundation/team-delegation";

/**
 * WERBEKLAUSEL + AUSHAENGESCHILD (23.11., docs/design/werbeklausel-aushaengeschild-23-11.md): Stufen mit Gehalt und Netz, Trait-Ablehnungen,
 * KI-Wahl nach Zusatzertrag, Sperre, Vorlieben wachsen, Mehrspieler-Rechte, Stempel (neues Spiel vs. laufender Spielstand).
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
const EINGABE = { race: "Demon", className: "Berserker", alignment: "C-B", traits: ["FiredUp"], leistungPerz: 80, gehalt: 9, moralOhne: 60, restlaufzeit: 2 } as const;
const TEAM = { profil: HELL_RAISERS, liga: 1 as const, erfolgPunkte: 0, erfolgGrund: "x" };

const TEAM_A = "A-A";

function bestuecke(gameState: GameState, jeTeam = 8): GameState {
  const used = new Set(gameState.rosters.map((r) => r.playerId));
  const frei = gameState.players.filter((p) => !used.has(p.id));
  let zaehler = 0;
  const rosters = [...gameState.rosters];
  for (const team of gameState.teams) {
    for (let i = 0; i < jeTeam; i += 1) {
      const player = frei[zaehler++]!;
      rosters.push({
        id: `wk-roster-${team.teamId}-${i}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: 5 + (i % 4),
        upkeep: 5 + (i % 4),
        purchasePrice: 10,
        currentValue: 10,
        joinedSeasonId: gameState.season.id,
      });
    }
  }
  return { ...gameState, rosters };
}

function neuesSpiel(): GameState {
  return stempleMarketingBeimAnlegen(stempleFinanzenJeSpieltagBeimAnlegen(bestuecke(createFreshSeasonOneGameState())));
}

describe("Werbeklausel: Stufen, Gehalt, Netz", () => {
  it("Gehalt: -2,5 % / Standard / +2,5 %, Loyal ohne Aufschlag", () => {
    expect(klauselGehaltFaktor(-1, [])).toBeCloseTo(0.975, 9);
    expect(klauselGehaltFaktor(0, [])).toBe(1);
    expect(klauselGehaltFaktor(1, [])).toBeCloseTo(1.025, 9);
    expect(klauselGehaltFaktor(1, ["Loyal"])).toBe(1);
    expect(gehaltMitKlausel(10, -1, [])).toBe(9.75);
    expect(gehaltMitKlausel(10, 1, [])).toBe(10.25);
  });

  it("Egomaniac und Diva lehnen Team bekommt mehr ab (auch ein erzwungener Wert zaehlt als Standard)", () => {
    for (const t of ["Egomaniac", "Diva"]) {
      expect(klauselErlaubt(1, [t])).toBe(false);
      expect(klauselErlaubt(-1, [t])).toBe(true);
      expect(wirksameKlausel(1, [t])).toBe(0);
      expect(gehaltMitKlausel(10, 1, [t])).toBe(10);
    }
    expect(klauselErlaubt(1, ["Loyal"])).toBe(true);
  });

  it("Sicherheitsnetz je Stufe: 22 / 25 / 28 % des Gehalts, Punkte -10 / 0 / +10 im Team-Anteil", () => {
    const e = (klausel: -1 | 0 | 1) => berechneMarketing({ ...EINGABE, gehalt: 0.6, klausel, traits: [...EINGABE.traits] }, TEAM);
    const [m, s, p] = [e(-1), e(0), e(1)];
    // Gehalt so klein, dass das Netz in allen drei Stufen bindet
    expect([m.netzGreift, s.netzGreift, p.netzGreift]).toEqual([true, true, true]);
    expect(m.ansTeam).toBeCloseTo(0.22 * 0.6, 9);
    expect(s.ansTeam).toBeCloseTo(0.25 * 0.6, 9);
    expect(p.ansTeam).toBeCloseTo(0.28 * 0.6, 9);
    const punkte = (r: ReturnType<typeof e>) => r.bausteine.find((b) => b.id === "klausel")!.punkte;
    expect([punkte(m), punkte(s), punkte(p)]).toEqual([-10, 0, 10]);
    expect(MARKETING_KONFIG.klauselNetz).toEqual({ "-1": 0.22, "0": 0.25, "1": 0.28 });
  });

  it("ein Egomaniac mit Klausel +1 im Vertrag wird wie Standard gerechnet", () => {
    const eg = { ...EINGABE, traits: ["Egomaniac"], gehalt: 9 };
    expect(berechneMarketing({ ...eg, klausel: 1 }, TEAM).teamAnteilProzent).toBe(berechneMarketing({ ...eg, klausel: 0 }, TEAM).teamAnteilProzent);
  });

  it("Vorschau = Buchung: die Zeile der Verhandlung rechnet mit derselben Funktion wie der gespeicherte Vertrag", () => {
    const gs = neuesSpiel();
    const eintrag = gs.rosters.find((r) => r.teamId === TEAM_A)!;
    const player = gs.players.find((p) => p.id === eintrag.playerId)!;
    const zeilen = klauselZeilen(gs, TEAM_A, player, 9, 3, null, false);
    expect(zeilen.map((z) => z.gehalt)).toEqual([gehaltMitKlausel(9, -1, []), 9, gehaltMitKlausel(9, 1, [])].map((x, i) => (zeilen[i]!.erlaubt || i !== 2 ? x : zeilen[i]!.gehalt)));
    expect(zeilen[1]!.saldo).toBe(0);
    for (const z of zeilen.filter((x) => x.erlaubt)) {
      const vertrag = { ...eintrag, salary: z.gehalt, contractLength: 3, marketingKlausel: z.klausel };
      const gebucht: GameState = { ...gs, rosters: gs.rosters.map((r) => (r.id === eintrag.id ? vertrag : r)) };
      const zeile = marketingTeamUebersicht(gebucht, TEAM_A).zeilen.find((x) => x.playerId === player.id)!;
      expect(zeile.gehalt).toBeCloseTo(z.gehalt, 9);
      expect(zeile.klausel).toBe(z.klausel);
    }
  });
});

describe("Stempel: neues Spiel vs. laufender Spielstand", () => {
  it("ein neues Spiel hat die Regel ab Saison 1, ein laufender Spielstand ohne Stempel nicht; Rueckweg OLY_MARKETING=aus", () => {
    const gs = neuesSpiel();
    expect(gs.seasonState.marketingRegel?.version).toBe("klausel-v2");
    expect(werbeklauselAktiv(gs)).toBe(true);
    const laufend = stempleMarketingNachLaden({ ...gs, seasonState: { ...gs.seasonState, marketingRegel: null } });
    expect(laufend.seasonState.marketingRegel).toEqual({ seasonId: gs.seasonState.seasonId, regel: "aus" });
    expect(marketingAktiv(laufend)).toBe(false);
    expect(werbeklauselAktiv(laufend)).toBe(false);
    const vorher = process.env.OLY_MARKETING;
    try {
      process.env.OLY_MARKETING = "aus";
      const aus = stempleMarketingBeimAnlegen({ ...gs, seasonState: { ...gs.seasonState, marketingRegel: null } });
      expect(aus.seasonState.marketingRegel?.regel).toBe("aus");
      expect(werbeklauselAktiv(aus)).toBe(false);
    } finally {
      if (vorher == null) delete process.env.OLY_MARKETING;
      else process.env.OLY_MARKETING = vorher;
    }
  });

  it("der Saisonwechsel macht aus einem Spielstand ohne Marketing einen mit der neuen Regel", () => {
    const gs = neuesSpiel();
    const laufend = stempleMarketingNachLaden({ ...gs, seasonState: { ...gs.seasonState, marketingRegel: null } });
    const neu = marketingStempelFuerSaisonwechsel(laufend, laufend.seasonState.seasonId, "season-2");
    expect(neu.regel).toBe("an");
    expect(neu.version).toBe("klausel-v2");
  });
});

describe("KI waehlt die Klausel nach Finanzwert; Mensch und delegierter Bereich", () => {
  const mitIdentitaet = (gs: GameState, finances: number): GameState => ({
    ...gs,
    teamIdentities: gs.teamIdentities.map((i) => (i.teamId === TEAM_A ? { ...i, finances } : i)),
  });
  const spieler = (gs: GameState) => gs.players.find((p) => p.id === gs.rosters.find((r) => r.teamId === TEAM_A)!.playerId)!;

  it("ab 7 Team bekommt mehr, unter 4 Spieler behaelt mehr, sonst Standard", () => {
    const gs = neuesSpiel();
    expect(kiKlauselFuerTeam(mitIdentitaet(gs, 8), TEAM_A)).toBe(1);
    expect(kiKlauselFuerTeam(mitIdentitaet(gs, 7), TEAM_A)).toBe(1);
    expect(kiKlauselFuerTeam(mitIdentitaet(gs, 3), TEAM_A)).toBe(-1);
    expect(kiKlauselFuerTeam(mitIdentitaet(gs, 4), TEAM_A)).toBe(0);
    expect(kiKlauselFuerTeam(mitIdentitaet(gs, 6), TEAM_A)).toBe(0);
  });

  it("ein KI-Team ohne Wahl bekommt die KI-Stufe, mit denselben Ablehnungen wie ein Mensch", () => {
    const reich = mitIdentitaet(neuesSpiel(), 9);
    const p = spieler(reich);
    expect(klauselFuerVertrag(reich, TEAM_A, p, undefined)).toBe(wirksameKlausel(1, [...(p.traitsPositive ?? []), ...(p.traitsNegative ?? [])]));
    expect(klauselFuerVertrag(reich, TEAM_A, { ...p, traitsNegative: ["Egomaniac"] }, undefined)).toBe(0);
    expect(klauselFuerVertrag(reich, TEAM_A, { ...p, traitsNegative: ["Diva"], traitsPositive: [] }, 1)).toBe(0);
  });

  it("ein Mensch entscheidet selbst; ohne Wahl bleibt es Standard, solange der Bereich nicht delegiert ist", () => {
    const gs = mitIdentitaet(neuesSpiel(), 9);
    const mensch = (delegation: unknown): GameState => ({
      ...gs,
      seasonState: {
        ...gs.seasonState,
        teamControlSettings: {
          ...(gs.seasonState.teamControlSettings ?? {}),
          [TEAM_A]: { teamId: TEAM_A, controlMode: "manual", ownerId: "user_local", ownerSlot: "user", displayLabel: "A", delegation } as never,
        },
      },
    });
    const p = spieler(gs);
    const selbst = mensch({ stufe: "voll_selbst", bereiche: null });
    expect(klauselFuerVertrag(selbst, TEAM_A, p, undefined)).toBe(0);
    expect(klauselFuerVertrag(selbst, TEAM_A, p, -1)).toBe(-1);
    const delegiert = mensch({ stufe: "voll_selbst", bereiche: { transfers: "ki" } });
    expect(isBereichDelegiert(delegiert.seasonState.teamControlSettings![TEAM_A]!, "transfers")).toBe(true);
    expect(klauselFuerVertrag(delegiert, TEAM_A, p, undefined)).toBe(wirksameKlausel(1, [...(p.traitsPositive ?? []), ...(p.traitsNegative ?? [])]));
    // Mensch ueberschreibt, KI respektiert das
    expect(klauselFuerVertrag(delegiert, TEAM_A, p, -1)).toBe(-1);
  });

  it("ohne die neue Regel bleibt jeder Vertrag auf Standard", () => {
    const alt = stempleMarketingNachLaden({ ...neuesSpiel(), seasonState: { ...neuesSpiel().seasonState, marketingRegel: null } });
    expect(klauselFuerVertrag(mitIdentitaet(alt, 9), TEAM_A, spieler(alt), 1)).toBe(0);
  });
});

describe("Aushaengeschild: KI-Wahl nach Zusatzertrag, Sperre, Rechte", () => {
  it("die KI waehlt den hoechsten Zusatzertrag ans Team unter den besten sechs, nicht die hoechste Marketability", () => {
    const gs = neuesSpiel();
    const sechs = besteSechs(gs, TEAM_A);
    expect(sechs).toHaveLength(6);
    // Der Spieler mit der hoechsten Marketability bekommt ein winziges Gehalt: das Netz schluckt jeden Zusatzertrag.
    const vorher = gesichtKandidaten(gs, TEAM_A);
    const spitze = [...vorher].sort((a, b) => b.jetzt.marketability - a.jetzt.marketability)[0]!;
    const gedeckelt: GameState = {
      ...gs,
      rosters: gs.rosters.map((r) => (r.teamId === TEAM_A && r.playerId === spitze.playerId ? { ...r, salary: 0.05, upkeep: 0.05 } : r)),
    };
    const kandidaten = gesichtKandidaten(gedeckelt, TEAM_A);
    const beste = [...kandidaten].sort((a, b) => b.zusatz - a.zusatz)[0]!;
    const pick = kiAushaengeschild(gedeckelt, TEAM_A);
    expect(pick).toBe(beste.playerId);
    expect(kandidaten.find((k) => k.playerId === spitze.playerId)!.zusatz).toBeLessThan(0.01);
    if (beste.playerId !== spitze.playerId) expect(pick).not.toBe(spitze.playerId);
    expect(aushaengeschildFuer(gedeckelt, TEAM_A)).toBe(pick);
  });

  it("Bestaetigen sperrt: die Wahl gilt, ein zweiter Versuch und ein Spieler ausserhalb der besten sechs scheitern", () => {
    const gs = neuesSpiel();
    const sechs = besteSechs(gs, TEAM_A);
    const ausserhalb = gs.rosters.filter((r) => r.teamId === TEAM_A).map((r) => r.playerId).find((id) => !sechs.some((k) => k.player.id === id))!;
    const abgelehnt = waehleAushaengeschild(gs, TEAM_A, ausserhalb);
    expect(abgelehnt.ok).toBe(false);
    expect(abgelehnt.ok === false && abgelehnt.reason).toBe("nicht_unter_den_besten_sechs");
    const wahl = sechs[sechs.length - 1]!.player.id;
    const ok = waehleAushaengeschild(gs, TEAM_A, wahl);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.gameState.seasonState.marketingAushaengeschild?.[TEAM_A]).toMatchObject({ playerId: wahl, gesperrt: true, von: "mensch" });
    expect(aushaengeschildFuer(ok.gameState, TEAM_A)).toBe(wahl);
    const zweiter = waehleAushaengeschild(ok.gameState, TEAM_A, sechs[0]!.player.id);
    expect(zweiter.ok === false && zweiter.reason).toBe("gesperrt");
    // je Team getrennt: ein anderes Team ist nicht beruehrt
    expect(ok.gameState.seasonState.marketingAushaengeschild?.["B-B"]).toBeUndefined();
  });

  it("nach dem ersten gebuchten Spieltag gilt die KI-Wahl; ohne die neue Regel gibt es keine Wahl", () => {
    const gs = neuesSpiel();
    const spielt: GameState = {
      ...gs,
      seasonState: {
        ...gs.seasonState,
        matchdayResults: [{ seasonId: gs.season.id, matchdayId: gs.season.matchdayIds[0]!, status: "final" } as never],
      },
    };
    const p = pruefeAushaengeschildWahl(spielt, TEAM_A, besteSechs(spielt, TEAM_A)[0]!.player.id);
    expect(p.ok === false && p.reason).toBe("zu_spaet");
    const alt = stempleMarketingNachLaden({ ...gs, seasonState: { ...gs.seasonState, marketingRegel: null } });
    const q = pruefeAushaengeschildWahl(alt, TEAM_A, null);
    expect(q.ok === false && q.reason).toBe("regel_aus");
  });
});

describe("Vorlieben wachsen", () => {
  it("zweimal dasselbe Gesicht in Folge: seine Klasse zaehlt zu den Fan-Vorlieben, ein neuer Zugang ersetzt den fruehren", () => {
    const gs = neuesSpiel();
    const face = aushaengeschildFuer(gs, TEAM_A)!;
    const klasse = gs.players.find((p) => p.id === face)!.className;
    // Saison 1 -> 2: der Zaehler beginnt, noch keine Vorliebe
    const s2 = marketingStempelFuerSaisonwechsel(gs, gs.seasonState.seasonId, "season-2");
    expect(s2.gesichtVorsaison?.[TEAM_A]).toBe(face);
    expect(s2.klassenVorliebe?.[TEAM_A]).toBeUndefined();
    // Saison 2 -> 3: dasselbe Gesicht
    const gs2: GameState = { ...gs, seasonState: { ...gs.seasonState, seasonId: "season-2", finanzenJeSpieltag: { ...gs.seasonState.finanzenJeSpieltag!, seasonId: "season-2" }, marketingRegel: s2, marketingAushaengeschild: null, marketingStand: null }, season: { ...gs.season, id: "season-2" } };
    const s3 = marketingStempelFuerSaisonwechsel(gs2, "season-2", "season-3");
    expect(s3.klassenVorliebe?.[TEAM_A]).toEqual({ klasse, seitSaisonId: "season-3" });
    // ein anderes Gesicht in der Folgesaison ersetzt die Vorliebe nicht, solange es kein zweites Mal in Folge gewaehlt wird; ein neues Doppel ersetzt sie
    const andere = besteSechs(gs2, TEAM_A).find((k) => k.player.className !== klasse && k.player.id !== face);
    if (andere) {
      const gs3: GameState = {
        ...gs2,
        seasonState: {
          ...gs2.seasonState,
          seasonId: "season-3",
          finanzenJeSpieltag: { ...gs2.seasonState.finanzenJeSpieltag!, seasonId: "season-3" },
          marketingRegel: { ...s3, seasonId: "season-3", gesichtVorsaison: { [TEAM_A]: andere.player.id } },
          marketingAushaengeschild: { [TEAM_A]: { seasonId: "season-3", playerId: andere.player.id, gesperrt: true, von: "mensch" } },
        },
        season: { ...gs2.season, id: "season-3" },
      };
      const s4 = marketingStempelFuerSaisonwechsel(gs3, "season-3", "season-4");
      expect(s4.klassenVorliebe?.[TEAM_A]).toEqual({ klasse: andere.player.className, seitSaisonId: "season-4" });
    }
  });
});
