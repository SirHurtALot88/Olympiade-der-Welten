/**
 * SPONSOR-TOPF: EINGABEN AUS DEM SPIELSTAND (24.11.). Sammelt je Team, was die reine Rechenschicht (`sponsor-topf-modell.ts`) braucht:
 * Liga, Erwartungsrang (derselbe Anker wie beim Vorstand), Beliebtheit, Kosten B, uebrige Planeinnahmen P, Kaderwert W und die Vertragsdaten
 * (Hebel, Passung, Treuebonus). Gerechnet wird NICHT hier, sondern im Modell.
 *
 * Der Stichtag (`sponsor-topf-stichtag.ts`) friert das Ergebnis ein; vor dem Stichtag liefert `berechneTopfLive` dieselbe Rechnung als Vorschau.
 */
import type { GameState, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { computeTeamExpectation } from "@/lib/board/team-season-objectives-service";
import { berechneGebaeudeSaisonbetraege } from "@/lib/facilities/facility-season-end-service";
import { kaderJahresgehaltAmSpieltag } from "@/lib/finance/finanzen-je-spieltag";
import { getTeamAnnualLoanInterest } from "@/lib/finance/loan-service";
import { ticketsSaisonbetrag } from "@/lib/arena/arena-guv";
import { marketingAktiv } from "@/lib/marketing/marketing-regel";
import { marketingJahresbetrag, marketingTeamUebersicht } from "@/lib/marketing/marketing-team";
import { medaillenAktiv } from "@/lib/medaillen/medaillen-regel";
import { gueltigeWirtschaftsRegeln, wirtschaftsRegel } from "@/lib/resolve/wirtschafts-regeln";
import { gueltigerSponsorStempel } from "@/lib/resolve/sponsor-regel";
import { getCurrentSponsorSalaryFactor } from "@/lib/sponsor/sponsor-economy-calibration";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { getLeagueOf } from "@/lib/season/league-split";
import {
  SPONSOR_TOPF,
  berechneTopf,
  passungRoh,
  schiebeErwartungsraenge,
  sponsorKonjunktur,
  treueBonus,
  vertragsartHebel,
  zBeliebtheit,
  zTreue,
  planMedaillen,
  type SponsorLiga,
  type TopfEingabe,
  type TopfErgebnis,
  type TopfTeamEingabe,
} from "@/lib/sponsors/sponsor-topf-modell";

export function sponsorLigaVon(gameState: GameState, teamId: string): SponsorLiga {
  return getLeagueOf(gameState, teamId) === "liga2" ? 2 : 1;
}

export function ligaVonAlle(gameState: GameState): Record<string, SponsorLiga> {
  return Object.fromEntries(gameState.teams.map((t) => [t.teamId, sponsorLigaVon(gameState, t.teamId)]));
}

/** Gesamtfaktor F: Grundwert des Stempels x Konjunktur der Saison. */
export function sponsorFaktor(gameState: GameState): number {
  const stempel = gueltigerSponsorStempel(gameState);
  const grund = stempel?.saisonfaktor ?? 1;
  return Math.round(grund * sponsorKonjunktur(getCurrentSponsorSalaryFactor(gameState)) * 1e6) / 1e6;
}

/** Saison 1? Die Saison-Nummer steht am Ende der Saison-Id. */
export function istErsteSaison(gameState: Pick<GameState, "season" | "seasonState">): boolean {
  const nr = /(\d+)\s*$/.exec(gameState.season?.id ?? gameState.seasonState?.seasonId ?? "")?.[1];
  return nr == null ? true : Number(nr) <= 1;
}

/**
 * Erwartungsrang je Team, UNGERUNDET und je Liga auf Summe n(n+1)/2 geschoben. Basis ist die Funktion des Vorstands
 * (`computeTeamExpectation`, Staerkerang der Liga); der Vorjahres-Anteil aus dem Wirtschaftsregel-Stempel wird hier ohne Rundung
 * gemittelt. Ist der Topf eingefroren, liefert der Stempel den Anker (Vorstand und Sponsor lesen dieselbe Zahl).
 */
export function berechneErwartungsraenge(gameState: GameState): Record<string, number> {
  const eingefroren = gueltigerSponsorStempel(gameState)?.eingefroren;
  if (eingefroren) {
    return Object.fromEntries(Object.values(eingefroren.teams).map((t) => [t.teamId, t.erwartungsrang]));
  }
  // Ohne Kader (Neues Spiel vor dem Draft) gibt es keine Staerke: alle liegen in der Mitte (kein Zufallsgefaelle durch Reihenfolge).
  if (gameState.rosters.length === 0) {
    const mitte: Record<string, number> = {};
    for (const [id, liga] of Object.entries(ligaVonAlle(gameState))) {
      const n = gameState.teams.filter((t) => ligaVonAlle(gameState)[t.teamId] === liga).length;
      mitte[id] = (n + 1) / 2;
    }
    return mitte;
  }
  const rows = buildTeamSeasonOverviewRows({ gameState });
  const rowsByTeamId = new Map(rows.map((r) => [r.teamId, r] as const));
  // Reiner Staerkerang: die Rundung/Mischung des Vorstands wird hier selbst, ungerundet, nachgerechnet.
  const stempel = gueltigeWirtschaftsRegeln(gameState);
  const ohneAnker = stempel
    ? { ...gameState, seasonState: { ...gameState.seasonState, wirtschaftsRegeln: { ...stempel, anker: "alt" as const } } }
    : gameState;
  const mischen = wirtschaftsRegel(gameState, "anker") === "neu" ? stempel?.vorjahr ?? null : null;
  const ligen = ligaVonAlle(gameState);
  const roh: Record<string, number> = {};
  for (const team of gameState.teams) {
    const row = rowsByTeamId.get(team.teamId);
    if (!row) continue;
    const staerke = computeTeamExpectation({ row, rowsByTeamId, identity: null, gameState: ohneAnker });
    let e = staerke.expectedRank;
    const anteil = mischen?.[team.teamId];
    if (anteil != null && Number.isFinite(anteil)) {
      const vorjahr = 1 + Math.min(1, Math.max(0, anteil)) * Math.max(0, staerke.teamCount - 1);
      e = (staerke.expectedRank + vorjahr) / 2;
    }
    roh[team.teamId] = e;
  }
  return schiebeErwartungsraenge(roh, ligen);
}

export function teamKaderwert(gameState: GameState, teamId: string): number {
  const wert = new Map(gameState.players.map((p) => [p.id, p.marketValue ?? 0] as const));
  return gameState.rosters.filter((r) => r.teamId === teamId).reduce((s, r) => s + (wert.get(r.playerId) ?? 0), 0);
}

function popularitaet(gameState: GameState, teamId: string): number {
  return gameState.teamIdentities.find((i) => i.teamId === teamId)?.popularity ?? 5;
}

/** Beliebtheit des Kaders: Werbegeld aller Spieler je Saison (Marketing-Modell); Rueckfall: Beliebtheit der Teamidentitaet x 10. */
export function kaderBeliebtheit(gameState: GameState, teamId: string): number {
  try {
    const w = marketingTeamUebersicht(gameState, teamId).werbegeld;
    if (Number.isFinite(w) && w > 0) return w;
  } catch {
    // ohne Marketing-Daten (alter Spielstand, Test-Fixture) greift der Rueckfall
  }
  return popularitaet(gameState, teamId) * 10;
}

/** Plan-Posten (Jahr) des Teams: Kosten B und uebrige Einnahmen P. Jede Zeile ist ein gebauter Posten; ungebaute Posten stehen nicht drin. */
export function teamPlanPosten(gameState: GameState, teamId: string): { kosten: number; planEinnahmen: number; zeilen: Record<string, number> } {
  const gebaeude = berechneGebaeudeSaisonbetraege(gameState, teamId);
  const gehalt = kaderJahresgehaltAmSpieltag(gameState, teamId, null);
  const zins = getTeamAnnualLoanInterest(gameState, teamId);
  const liga = sponsorLigaVon(gameState, teamId);
  const tickets = ticketsSaisonbetrag(gameState, teamId);
  const marketing = marketingAktiv(gameState) ? marketingJahresbetrag(gameState, teamId) : 0;
  const medaillen = medaillenAktiv(gameState) ? planMedaillen(liga) : 0;
  const zeilen = {
    gebaeudeEinnahme: gebaeude.income,
    tickets,
    marketing,
    medaillen,
    vorstandsziele: SPONSOR_TOPF.planVorstandsziele,
    termine: SPONSOR_TOPF.planTermine,
  };
  return {
    kosten: gehalt + gebaeude.upkeep + zins,
    planEinnahmen: Object.values(zeilen).reduce((a, b) => a + b, 0),
    zeilen,
  };
}

/** Treue zur Marke: Saisons mit dieser Dachmarke (0 bis 3) aus Markenverlauf und laufendem Vertrag. */
export function treueSaisonsFuerMarke(gameState: GameState, teamId: string, parentBrandId: string | undefined): number {
  if (!parentBrandId) return 0;
  const verlauf = gameState.seasonState.sponsorBrandHistoryByTeamId?.[teamId] ?? [];
  const contract = getTeamSponsorContract(gameState, teamId);
  let n = verlauf.filter((id) => id === parentBrandId).length;
  if (contract && contract.sponsorParentBrandId === parentBrandId && contract.sponsorTopf) {
    n = Math.max(n, contract.sponsorTopf.treueSaisons + contract.sponsorTopf.jahr);
  }
  return Math.min(3, n);
}

export type TopfSammlung = {
  /** Liga-Wert (Summe Kasse + Summe Kaderwert) und seine Abweichung gegen den Stichtag der Vorsaison (`null` ohne Vorjahr). */
  ligaWert: number;
  ligaWertDrift: number | null;
  eingabe: TopfEingabe;
  ligen: Record<string, SponsorLiga>;
  vertraege: Record<string, TeamSponsorContract | null>;
  zeilen: Record<string, Record<string, number>>;
};

/** Liga-Mittel des Kader-Werbegelds je Liga (Eingang der Passung). */
export function werbegeldMittel(gameState: GameState): Record<SponsorLiga, number> & Record<string, number> {
  const ligen = ligaVonAlle(gameState);
  const summe: Record<number, { s: number; n: number }> = { 1: { s: 0, n: 0 }, 2: { s: 0, n: 0 } };
  for (const t of gameState.teams) {
    const l = ligen[t.teamId]!;
    summe[l]!.s += kaderBeliebtheit(gameState, t.teamId);
    summe[l]!.n += 1;
  }
  return { 1: summe[1]!.s / Math.max(1, summe[1]!.n), 2: summe[2]!.s / Math.max(1, summe[2]!.n) };
}

/** Sammelt die Eingabe des Topfs aus dem heutigen Spielstand (Vertraege inklusive). */
export function sammleTopfEingabe(gameState: GameState): TopfSammlung {
  const stempel = gueltigerSponsorStempel(gameState);
  const ligen = ligaVonAlle(gameState);
  const erwartung = berechneErwartungsraenge(gameState);
  const mittel = werbegeldMittel(gameState);
  const vertraege: Record<string, TeamSponsorContract | null> = {};
  const zeilen: Record<string, Record<string, number>> = {};
  const teams: TopfTeamEingabe[] = gameState.teams.map((team) => {
    const liga = ligen[team.teamId]!;
    const vertrag = getTeamSponsorContract(gameState, team.teamId);
    vertraege[team.teamId] = vertrag;
    const plan = teamPlanPosten(gameState, team.teamId);
    zeilen[team.teamId] = plan.zeilen;
    const tv = vertrag?.sponsorTopf ?? null;
    return {
      teamId: team.teamId,
      liga,
      erwartungsrang: erwartung[team.teamId] ?? (liga === 1 ? 8.5 : 8.5),
      beliebtheit: popularitaet(gameState, team.teamId),
      passungRoh: tv ? passungRoh(zBeliebtheit(kaderBeliebtheit(gameState, team.teamId), mittel[liga]), zTreue(tv.treueSaisons)) : 1,
      treue: tv ? treueBonus(tv.jahr) : 0,
      kosten: plan.kosten,
      planEinnahmen: plan.planEinnahmen,
      kaderwert: teamKaderwert(gameState, team.teamId),
    };
  });
  const zusageFaktor = SPONSOR_TOPF.zusage;
  const zusage = stempel?.vorlaeufig
    ? Object.fromEntries(Object.entries(stempel.vorlaeufig.grund).map(([id, g]) => [id, Math.round(g * zusageFaktor * 10) / 10]))
    : undefined;
  // Liga-Wert-Rueckkopplung (Entscheidung 1): bisher angewandte Korrektur plus der Anteil der Abweichung des Liga-Werts seit dem Vorjahres-Stichtag.
  const ligaWert = gameState.teams.reduce((a, t) => a + t.cash, 0) + teams.reduce((a, t) => a + t.kaderwert, 0);
  const wertVorjahr = stempel?.ligaWertVorjahr ?? null;
  const ligaWertDrift = wertVorjahr != null && wertVorjahr > 0 ? ligaWert - wertVorjahr : null;
  const wertKorrektur = (stempel?.ligaWertKorrektur ?? 0) + (ligaWertDrift != null ? SPONSOR_TOPF.wertRueckkopplung * ligaWertDrift : 0);
  const eingabe: TopfEingabe = {
    teams,
    wertKorrektur,
    faktor: sponsorFaktor(gameState),
    saison1: istErsteSaison(gameState),
    kaderErsatz: stempel?.kaderErsatz ?? 1,
    betriebsteilVorjahr: stempel?.betriebsteilVorjahr ?? null,
    uebertrag: stempel?.uebertrag ?? 0,
    ...(zusage ? { zusage } : {}),
  };
  return { ligaWert, ligaWertDrift, eingabe, ligen, vertraege, zeilen };
}

/** Die Rechnung des Topfs mit den heutigen Eingaben (Vorschau vor dem Stichtag, Messung nach dem Stichtag). */
export function berechneTopfLive(gameState: GameState): { ergebnis: TopfErgebnis; sammlung: TopfSammlung } {
  const sammlung = sammleTopfEingabe(gameState);
  return { ergebnis: berechneTopf(sammlung.eingabe), sammlung };
}

export { vertragsartHebel };
