/**
 * Kredite als Reiter der Finanzseite (22.11., Vorlage `public/mockups/kredite-modern-22-11.html`).
 *
 * Geprueft wird an der WIRKUNG: die Seite wird gerendert (`renderToStaticMarkup`) und im Ergebnis gelesen, die Rechnung dahinter laeuft ueber den
 * echten Kern. Gezeigt = gebucht, Sperren = Server, Mehrspieler (aktives Team), Fog of War, alter Stil weg.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import FinanzenModern from "@/app/foundation/finances/FinanzenModern";
import type { GameState } from "@/lib/data/olyDataTypes";
import { stempleFinanzenJeSpieltagBeimAnlegen } from "@/lib/finance/finanzen-je-spieltag";
import { bucheSpieltagFinanzen } from "@/lib/finance/finanzen-je-spieltag-buchung";
import { pruefeKreditAufnahme } from "@/lib/finance/kredit-pruefung";
import { stempleKreditRegelBeimAnlegen } from "@/lib/finance/kredit-raten";
import { baueKreditPlan, baueKreditSeitenModell, baueKreditVorschau } from "@/lib/finance/kredite-seite-modell";
import { originateLoan } from "@/lib/finance/loan-service";
import { buildFinancesLeagueTable } from "@/lib/foundation/finances/use-finances-league-table";
import { buildFinancesViewModel } from "@/lib/foundation/finances/use-finances-view-model";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";

const lies = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

const TEAM = "A-A";
const outlook = { currentFactor: 1.1, nextFactor: 1.2, delta: 0.1, direction: "up" as const };

function bestuecke(gameState: GameState, jeTeam = 8): GameState {
  const used = new Set(gameState.rosters.map((r) => r.playerId));
  const frei = gameState.players.filter((p) => !used.has(p.id));
  let zaehler = 0;
  const rosters = [...gameState.rosters];
  for (const team of gameState.teams) {
    for (let i = 0; i < jeTeam; i += 1) {
      const player = frei[zaehler++]!;
      rosters.push({
        id: `ks-roster-${team.teamId}-${i}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: 2,
        upkeep: 2,
        purchasePrice: 10,
        currentValue: 10,
        roleTag: "bench",
        joinedSeasonId: gameState.season.id,
      });
    }
  }
  return { ...gameState, rosters };
}

function spielstand(optionen: { kredit?: boolean; cash?: number; phase?: GameState["gamePhase"] } = {}): GameState {
  let gs = stempleKreditRegelBeimAnlegen(stempleFinanzenJeSpieltagBeimAnlegen(bestuecke(createFreshSeasonOneGameState())));
  gs = { ...gs, teams: gs.teams.map((t) => (t.teamId === TEAM ? { ...t, cash: optionen.cash ?? 120 } : t)), gamePhase: optionen.phase ?? gs.gamePhase };
  if (optionen.kredit) {
    const r = originateLoan(gs, { borrowerTeamId: TEAM, principal: 10, termSeasons: 3 }, { execute: true, emergency: true });
    gs = r.gameState;
    for (const id of gs.season.matchdayIds.slice(0, 4)) gs = bucheSpieltagFinanzen(gs, id);
  }
  return gs;
}

function seite(gs: GameState, extra: Partial<{ kannVerwalten: boolean; teamId: string }> = {}) {
  const teamId = extra.teamId ?? TEAM;
  return renderToStaticMarkup(
    <FinanzenModern
      gameState={gs}
      teamId={teamId}
      finanzen={buildFinancesViewModel(gs, teamId)}
      leagueTable={buildFinancesLeagueTable(gs)}
      salaryFactorOutlook={outlook}
      kannVerwalten={extra.kannVerwalten ?? true}
      onKreditAufnehmen={async () => ({ ok: true, reason: null })}
      onKreditAbloesen={async () => ({ ok: true, reason: null, payoff: 1 })}
      startAnsicht="kredite"
    />,
  );
}

describe("Kredite · die Seite geht mit ihren drei Tafeln auf", () => {
  const html = seite(spielstand({ kredit: true, phase: "transfer_buy_phase" }));

  it("Kopf mit Reiter, Kennzahlen, Tabelle, Plan, Rechner, Liga", () => {
    expect(html).toContain('data-testid="finanzen-kredite"');
    expect(html).toContain("Laufende Kredite");
    expect(html).toContain("Neuer Kredit");
    expect(html).toContain("Liga-Vergleich");
    expect(html).toContain('data-testid="kre-kennzahlen"');
    expect(html).toContain('data-testid="kre-kredite"');
    expect(html).toContain('data-testid="kre-tilgungsplan"');
    expect(html).toContain('data-testid="kre-wirkung"');
    expect(html).toContain('data-testid="kre-liga"');
    expect(html).toContain('data-testid="kre-vorstand"');
  });

  it("Rate gross je Saison, klein je Spieltag, Einheit C", () => {
    expect(html).toMatch(/Rate je Saison/);
    expect(html).toMatch(/C je Spieltag/);
  });

  it("nichts vom alten Stil (nl-credit) und keine Schmalspalte", () => {
    expect(html).not.toContain("nl-credit");
    expect(html).not.toContain("Kreditsystem in Vorbereitung");
  });

  it("Rang 1 = geringste Schulden steht als Regel im Fuss", () => {
    expect(html).toContain("Rang 1 = geringste Schulden");
  });

  it("der Reiter Kredite steht im Kopf der Finanzseite", () => {
    expect(html).toMatch(/Kredite/);
    expect(html).toContain("C Schulden");
  });
});

describe("Kredite · Modell und Vorschau lesen den Kern (gezeigt = gebucht)", () => {
  it("die Wirkungszeile 'Raten je Saison' ist die Summe der Spieltagsraten", () => {
    const gs = spielstand({ phase: "transfer_buy_phase" });
    const v = baueKreditVorschau(gs, TEAM, { betrag: 8, laufzeit: 2, geberId: null, guvAktuell: 5 });
    const angebot = v.gewaehlt!;
    const aufgenommen = originateLoan(gs, { borrowerTeamId: TEAM, principal: 8, termSeasons: 2 }, { execute: true }).loan!;
    expect(angebot.rateJeSpieltag).toBe(aufgenommen.rateJeSpieltag);
    expect(angebot.rateJeSaison).toBe(aufgenommen.installmentPerSeason);
    const rate = v.wirkung.find((w) => w.schluessel === "rate")!;
    expect(-rate.aenderung!).toBeCloseTo(aufgenommen.installmentPerSeason, 1);
    // Kasse sofort um den Betrag, GuV nur um den Zins.
    expect(v.wirkung.find((w) => w.schluessel === "kasse")!.aenderung).toBe(8);
    const guv = v.wirkung.find((w) => w.schluessel === "guv")!;
    expect(Math.abs(guv.aenderung!)).toBeLessThan(aufgenommen.installmentPerSeason);
    expect(Math.abs(guv.aenderung!)).toBeGreaterThan(0);
    expect(v.wirkung.find((w) => w.schluessel === "gesamtkosten")!.neu).toBeGreaterThan(8);
  });

  it("Rahmen: 15 % der Kasse + 30 % des Kaderwerts minus Restschuld, Auslastung wie die Kennzahl", () => {
    const k = baueKreditSeitenModell(spielstand({ kredit: true }), TEAM)!;
    expect(k.rahmenFrei).toBeCloseTo(Math.max(0, k.rahmenGesamt - k.schulden), 0);
    expect(k.auslastung).toBeCloseTo(k.schulden / k.rahmenGesamt, 3);
    expect(k.kredite).toHaveLength(1);
    expect(k.kredite[0]!.ratenGezahlt).toBe(4);
  });

  it("der Tilgungsplan nutzt dieselbe Schrittrechnung wie die Buchung: Rest nach vier Raten stimmt mit dem Kredit", () => {
    const gs = spielstand({ kredit: true });
    const loan = gs.seasonState.loans![0]!;
    const pm = baueKreditPlan(gs, loan, TEAM)!;
    expect(pm.gezahlt).toBe(4);
    expect(pm.gesamt).not.toBeNull();
    expect(pm.gesamt!.jeRate[3]!.rest).toBeCloseTo(loan.principalOutstanding, 1);
    expect(pm.spieltage.filter((s) => s.zustand === "bezahlt")).toHaveLength(4);
    expect(pm.spieltage.find((s) => s.zustand === "naechste")!.spieltag).toBe(5);
  });

  it("Rang 1 = geringste Schulden: ein Team ohne Kredit steht vor dem mit Kredit", () => {
    const k = baueKreditSeitenModell(spielstand({ kredit: true }), TEAM)!;
    const eigen = k.liga.find((x) => x.teamId === TEAM)!;
    const andere = k.liga.filter((x) => x.teamId !== TEAM);
    expect(eigen.schulden).toBeGreaterThan(0);
    expect(andere.every((x) => x.schulden === 0)).toBe(true);
  });

  it("Fog of War: die Kasse fremder Teams steht in keiner Zeile, das Kreditregister ist exakt", () => {
    const k = baueKreditSeitenModell(spielstand({ kredit: true }), TEAM)!;
    for (const z of k.liga) expect(Object.keys(z)).not.toContain("kasse");
    expect(k.register).toHaveLength(1);
    expect(k.register[0]!.aufgenommen).toBe(10);
    expect(k.register[0]!.eigene).toBe(true);
  });

  it("Mehrspieler: das Modell gehoert dem uebergebenen Team, nicht dem ersten", () => {
    const gs = spielstand({ kredit: true });
    const anderes = gs.teams.find((t) => t.teamId !== TEAM)!.teamId;
    expect(baueKreditSeitenModell(gs, anderes)!.kredite).toHaveLength(0);
    expect(baueKreditSeitenModell(gs, TEAM)!.kredite).toHaveLength(1);
    expect(seite(gs, { teamId: anderes })).toContain("Kein Kredit läuft");
  });
});

describe("Kredite · Sperren, dieselbe Funktion fuer Seite und Server", () => {
  it("Kasse im Minus: der Notkredit der Bank wird mit Betrag und Rate angekuendigt", () => {
    const html = seite(spielstand({ cash: -1.2, phase: "transfer_buy_phase" }));
    expect(html).toContain('data-testid="kre-notkredit"');
    expect(html).toContain("Kasse im Minus");
  });

  it("in der Saison (nach dem ersten Spieltag) ist der Knopf gesperrt und sagt warum", () => {
    const gs = spielstand({ phase: "season_active" });
    const gesperrt = { ...gs, season: { ...gs.season, currentMatchday: 5 }, matchdayState: { ...gs.matchdayState, status: "resolved" as const } };
    const k = baueKreditSeitenModell(gesperrt, TEAM)!;
    expect(k.phaseSperre).toContain("Vorsaison");
    const html = seite(gesperrt);
    expect(html).toContain("Kredite gibt es nur in der Vorsaison");
    expect(html).toMatch(/data-testid="kre-aufnehmen"[^>]*disabled|disabled=""[^>]*data-testid="kre-aufnehmen"/);
  });

  it("ohne Verwaltungsrecht ist der Knopf gesperrt (Mehrspieler: nicht dein Team)", () => {
    const html = seite(spielstand({ phase: "transfer_buy_phase" }), { kannVerwalten: false });
    expect(html).toContain("Nur lesbar");
  });

  it("Obergrenze: Schuldendienst ueber 20 % der Planeinnahmen sperrt (Server und Seite)", () => {
    const gs = spielstand({ phase: "transfer_buy_phase" });
    const frei = pruefeKreditAufnahme(gs, TEAM, 0);
    expect(frei.ok).toBe(true);
    // Ohne Sponsorvertrag gibt es keine Planeinnahmen und damit keine Bezugsgroesse.
    expect(frei.planEinnahmen).toBe(0);
    const mitPlan: GameState = {
      ...gs,
      seasonState: {
        ...gs.seasonState,
        sponsorContractsByTeamId: {
          [TEAM]: {
            seasonId: gs.season.id,
            teamId: TEAM,
            offerId: "ks",
            archetype: "security",
            name: "Test",
            chosenAt: "2026-01-01T00:00:00.000Z",
            startRank: 16,
            components: [{ componentId: "base-ks", kind: "base", label: "Basis", targetValue: "season", rewardCash: 50 }],
            payouts: {},
            rarity: "magisch",
            teamQualityRankAtSign: 16,
          },
        },
      } as GameState["seasonState"],
    };
    const plan = pruefeKreditAufnahme(mitPlan, TEAM, 0).planEinnahmen;
    expect(plan).toBeGreaterThan(0);
    expect(pruefeKreditAufnahme(mitPlan, TEAM, plan * 0.15).ok).toBe(true);
    const zuViel = pruefeKreditAufnahme(mitPlan, TEAM, plan * 0.25);
    expect(zuViel.ok).toBe(false);
    expect(zuViel.reason).toBe("schuldendienst_obergrenze");
  });

  it("Sparauflage: kein freiwilliger Kredit, der Server lehnt mit demselben Grund ab", () => {
    const gs = spielstand({ phase: "transfer_buy_phase" });
    const sparauflage: GameState = {
      ...gs,
      season: { ...gs.season, id: "season-2" },
      seasonState: { ...gs.seasonState, seasonId: "season-2", boardConfidence: { [TEAM]: { teamId: TEAM, value: 1, pressure: 10, warnings: [] } } },
    };
    const p = pruefeKreditAufnahme(sparauflage, TEAM, 1);
    expect(p.reason).toBe("vorstand_sparauflage");
    const route = lies("app/api/finance/loan/originate/route.ts");
    expect(route).toContain("pruefeKreditAufnahme");
    expect(route).toContain("authorizeServerRoomWrite");
    expect(route).toContain("resolveAuthoritativeWriteOwnerId");
  });
});

describe("Kredite · Navigation und Aufraeumen", () => {
  it("der Navigationspunkt Kredite springt auf den Reiter der Finanzseite", () => {
    const shell = lies("app/foundation/FoundationShellRouterBody.tsx");
    expect(shell).toContain('activeView === "finances" || activeView === "credits"');
    expect(shell).toContain('startAnsicht={activeView === "credits" ? "kredite" : undefined}');
    expect(shell).not.toContain("FoundationCreditsHost");
  });

  it("die alte Seite und ihr CSS sind weg", () => {
    const css = lies("app/globals.css");
    expect(css).not.toMatch(/\.nl-credits-(offer|burden|alle|vault)/);
    expect(() => lies("app/foundation/credits/FoundationCreditsNewLook.tsx")).toThrow();
  });

  it("Schreibweg nur ueber den Server: die Seite ruft nur Callbacks, kein fetch", () => {
    const seiteQuelle = lies("app/foundation/finances/FinanzenKredite.tsx");
    expect(seiteQuelle).not.toContain("fetch(");
    expect(seiteQuelle).toContain("onAufnehmen");
    expect(seiteQuelle).toContain("onAbloesen");
  });

  it("Schriftregel: keine eigene Schrift in der Seite, nur die Tokens", () => {
    const css = lies("app/foundation/finances/kredite-modern.css");
    expect(css).not.toMatch(/font-family:\s*(Georgia|system-ui)/);
    expect(css).toContain("var(--bc-haus)");
  });
});
