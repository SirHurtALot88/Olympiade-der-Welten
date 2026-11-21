/**
 * DRAFT-ERGEBNIS: die Datenaufbereitung der Seite „Draft beendet“ (21.11., Mockup public/mockups/draft-ergebnis-modern-21-11.html,
 * Erklärung docs/design/draft-ergebnis-modern-21-11.md). Reine Funktion, keine neue Spielrechnung: Picks, Ablösen und Gehälter
 * kommen aus `/api/draft` (`ansicht`), Eignungen/Achsen/Verträge aus dem Spielstand, Kaderstärke je Disziplin aus
 * `transfermarkt-kaderstaerke.ts` (über `draft-liga.ts`), die Budgetrechnung aus `berechneVorstandBudgetStand`.
 *
 * Für den EIGENEN Kader gilt kein Scouting-Nebel (Chris 21.11.: Gehalt und Kasse aller Teams in der Liga-Übersicht offen).
 * Ränge laufen in der EIGENEN Liga (`leagueByTeamId`); ohne Ligazuordnung (alter 32er-Spielstand) ist die Gruppe „alle“.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import type { LigaDraftAnsicht } from "@/lib/draft/liga-draft-ansicht";
import { endSaisonNummer } from "@/lib/contracts/vertragslaufzeit";
import { berechneVorstandBudgetStand, type VorstandBudgetStand } from "@/lib/finance/vorstand-budgetfreigabe";
import { getCurrentSeasonNumber } from "@/lib/foundation/season-history-clamp";
import { berechneStaerke, type LigaStaerken } from "@/lib/market/transfermarkt-kaderstaerke";
import { getLeagueOf } from "@/lib/season/league-split";
import { baueDraftKaderSicht, kaderMitPicks } from "./draft-liga";

/** Ab dieser Eignung zählt ein Spieler für „Abdeckung“ und „Bedarf“ (Mockup: ein Spieltag braucht bis zu 6). */
export const EIGNUNG_ABDECKUNG = 45;

export const DISZIPLIN_KURZ: Record<string, string> = {
  tdm: "TDM",
  "mini-dm": "Mini DM",
  battlefield: "Battlef.",
  gewichtheben: "Heben",
  climbing: "Climbing",
  staffel: "Staffel",
  "time-trial": "Time Tr.",
  spurt: "Spurt",
  tennis: "Tennis",
  hockey: "Hockey",
  showcase: "Showcase",
  "speed-schach": "Schach",
  "takeshis-castle": "Takeshi",
  breaking: "Breaking",
  wettessen: "Essen",
  basketball: "Basket.",
  football: "Football",
  eiskunstlauf: "Eiskunst",
  fechten: "Fechten",
  "i-spy": "I Spy",
};

export type ErgebnisSpieler = {
  playerId: string;
  name: string;
  className: string;
  race: string;
  runde: number;
  pickNr: number | null;
  quelle: string;
  ovr: number;
  pow: number;
  spe: number;
  men: number;
  soc: number;
  top: Array<{ disziplinId: string; wert: number }>;
  /** Restlaufzeit in Saisons einschließlich der laufenden (Draft-Vertrag: 1) und die Saison-Nummer, nach der der Vertrag endet. */
  vertragLauf: number;
  vertragEndeSaison: number;
  gehalt: number;
  abloese: number;
};

export type ErgebnisTeam = {
  teamId: string;
  name: string;
  kuerzel: string;
  /** 1, 2 oder null (keine Ligazuordnung). */
  liga: 1 | 2 | null;
  ich: boolean;
  picks: number;
  kader: number;
  staerke: number;
  ovr: number;
  teuersterPick: { abloese: number; name: string } | null;
  abloese: number;
  gehalt: number;
  kasse: number;
};

export type ErgebnisVergleich = { id: "staerke" | "gehalt" | "abloese" | "kasse" | "kader"; label: string; wert: number; rang: number; von: number; schnitt: number };

export type ErgebnisDisziplin = { disziplinId: string; staerke: number; rang: number; ligaGroesse: number; abdeckung: number };

export type ErgebnisDaten = {
  teamId: string;
  ligaName: string;
  ligaGroesse: number;
  spieler: ErgebnisSpieler[];
  teams: ErgebnisTeam[];
  disziplinen: ErgebnisDisziplin[];
  staerke: { meine: number; rang: number; schnitt: number; rangleiste: Array<{ teamId: string; name: string; staerke: number; ich: boolean }> };
  achsen: Array<{ id: "pow" | "spe" | "men" | "soc"; label: string; wert: number; liga: number }>;
  bedarf: Array<{ disziplinId: string; rang: number; abdeckung: number }>;
  vertraege: Array<{ endeSaison: number; spieler: number; gehalt: number }>;
  kasse: {
    kasse: number;
    abloesen: number;
    gehaltSumme: number;
    gehaltTopf: number | null;
    gehaltFrei: number | null;
    gehaltAnteil: number | null;
    ruecklage: number;
    gehaltspuffer: number;
    freigabeAnteil: number;
    gedeckelt: boolean;
    freigabeGrund: string;
    restbudget: number;
    pflichtMin: number;
    kaderMax: number;
    kader: number;
  };
  vergleich: ErgebnisVergleich[];
  /** Für die Marktbedarf-Anzeige: alle Spieler des Teams mit Eignungen (für „meine besten 6“ je Disziplin). */
  eignungen: Record<string, Array<{ playerId: string; wert: number }>>;
};

function liga(gameState: GameState, teamId: string): 1 | 2 | null {
  const tier = getLeagueOf(gameState, teamId);
  return tier === "liga1" ? 1 : tier === "liga2" ? 2 : null;
}

function rangIn(werte: readonly number[], mein: number): number {
  return 1 + werte.filter((w) => w > mein + 1e-9).length;
}

export function baueDraftErgebnis(input: {
  gameState: GameState;
  ansicht: LigaDraftAnsicht;
  disziplinIds: readonly string[];
  /** Für Tests: Budgetrechnung ersetzen (die echte braucht einen vollständigen Spielstand). */
  budget?: (gameState: GameState, teamId: string) => VorstandBudgetStand;
}): ErgebnisDaten | null {
  const { gameState, ansicht } = input;
  const mein = ansicht.mein;
  if (!mein) return null;
  const teamId = mein.teamId;
  const spielerById = new Map(gameState.players.map((p) => [p.id, p]));
  const meinLiga = liga(gameState, teamId);
  const ligaName = meinLiga ? `Liga ${meinLiga}` : "der Liga";
  const inLiga = (id: string) => meinLiga == null || liga(gameState, id) === meinLiga;
  const ligaTeams = ansicht.teams.filter((t) => inLiga(t.teamId));
  const ligaIds = new Set(ligaTeams.map((t) => t.teamId));

  const sicht = baueDraftKaderSicht({ gameState, ansicht, teamId, disziplinIds: input.disziplinIds });
  const staerken: LigaStaerken = sicht.staerken;

  // ----- eigener Kader ---------------------------------------------------------------------------------------------
  const laufend = getCurrentSeasonNumber(gameState) ?? 1;
  const rosterByPlayer = new Map(gameState.rosters.filter((r) => r.teamId === teamId).map((r) => [r.playerId, r]));
  const picks = ansicht.verlauf.filter((e) => e.art === "pick" && e.playerId && e.teamId === teamId);
  const pickByPlayer = new Map(picks.map((e) => [e.playerId as string, e]));
  const meinePlayerIds = Array.from(new Set([...rosterByPlayer.keys(), ...pickByPlayer.keys()]));
  const spieler: ErgebnisSpieler[] = meinePlayerIds.map((playerId) => {
    const p = spielerById.get(playerId);
    const pick = pickByPlayer.get(playerId);
    const roster = rosterByPlayer.get(playerId);
    const karte = ansicht.spieler[playerId];
    const ende = roster ? endSaisonNummer(roster, gameState) : null;
    const endeSaison = ende ?? laufend;
    const top = input.disziplinIds
      .map((disziplinId) => ({ disziplinId, wert: p?.disciplineRatings?.[disziplinId] }))
      .filter((x): x is { disziplinId: string; wert: number } => typeof x.wert === "number" && Number.isFinite(x.wert))
      .sort((a, b) => b.wert - a.wert)
      .slice(0, 3);
    return {
      playerId,
      name: p?.name ?? karte?.name ?? playerId,
      className: p?.className ?? karte?.className ?? "",
      race: p?.race ?? karte?.race ?? "",
      runde: pick?.runde ?? 0,
      pickNr: pick?.pickNr ?? null,
      quelle: pick?.quelle ?? "",
      ovr: p?.ovr ?? p?.rating ?? 0,
      pow: p?.coreStats?.pow ?? 0,
      spe: p?.coreStats?.spe ?? 0,
      men: p?.coreStats?.men ?? 0,
      soc: p?.coreStats?.soc ?? 0,
      top,
      vertragLauf: Math.max(1, endeSaison - laufend + 1),
      vertragEndeSaison: endeSaison,
      gehalt: pick?.gehalt ?? roster?.salary ?? karte?.gehalt ?? 0,
      abloese: pick?.abloese ?? karte?.marktwert ?? 0,
    };
  });

  // ----- Teams der Liga-Übersicht ----------------------------------------------------------------------------------
  const kader = kaderMitPicks(gameState.rosters, ansicht.verlauf);
  const ovrSumme = new Map<string, { s: number; n: number }>();
  for (const r of kader) {
    const p = spielerById.get(r.playerId);
    const alt = ovrSumme.get(r.teamId) ?? { s: 0, n: 0 };
    ovrSumme.set(r.teamId, { s: alt.s + (p?.ovr ?? p?.rating ?? 0), n: alt.n + 1 });
  }
  const teuer = new Map<string, { abloese: number; name: string }>();
  for (const e of ansicht.verlauf) {
    if (e.art !== "pick" || !e.playerId) continue;
    const alt = teuer.get(e.teamId);
    if ((e.abloese ?? 0) > (alt?.abloese ?? -1)) teuer.set(e.teamId, { abloese: e.abloese ?? 0, name: ansicht.spieler[e.playerId]?.name ?? spielerById.get(e.playerId)?.name ?? "—" });
  }
  const teams: ErgebnisTeam[] = ansicht.teams.map((t) => {
    const o = ovrSumme.get(t.teamId);
    return {
      teamId: t.teamId,
      name: t.name,
      kuerzel: t.kuerzel,
      liga: liga(gameState, t.teamId),
      ich: t.teamId === teamId,
      picks: t.picks,
      kader: t.kader,
      staerke: t.kaderStaerke,
      ovr: o && o.n ? o.s / o.n : 0,
      teuersterPick: teuer.get(t.teamId) ?? null,
      abloese: t.abloeseSumme,
      gehalt: t.gehaltSumme,
      kasse: t.kasse,
    };
  });

  // ----- Kaderstärke: Rang in der eigenen Liga ---------------------------------------------------------------------
  const rangleiste = [...ligaTeams].sort((a, b) => b.kaderStaerke - a.kaderStaerke).map((t) => ({ teamId: t.teamId, name: t.name, staerke: t.kaderStaerke, ich: t.teamId === teamId }));
  const meinTeam = ansicht.teams.find((t) => t.teamId === teamId)!;
  const staerke = {
    meine: meinTeam.kaderStaerke,
    rang: 1 + rangleiste.findIndex((t) => t.ich),
    schnitt: ligaTeams.length ? ligaTeams.reduce((s, t) => s + t.kaderStaerke, 0) / ligaTeams.length : 0,
    rangleiste,
  };

  const disziplinen: ErgebnisDisziplin[] = input.disziplinIds.map((disziplinId) => {
    const meineStaerke = staerken[teamId]?.[disziplinId] ?? 20;
    const andere = Object.entries(staerken).filter(([id]) => id !== teamId && ligaIds.has(id)).map(([, z]) => z[disziplinId] ?? 20);
    return {
      disziplinId,
      staerke: meineStaerke,
      rang: rangIn(andere, meineStaerke),
      ligaGroesse: ligaTeams.length,
      abdeckung: spieler.filter((s) => (spielerById.get(s.playerId)?.disciplineRatings?.[disziplinId] ?? 0) >= EIGNUNG_ABDECKUNG).length,
    };
  });
  const bedarf = [...disziplinen].sort((a, b) => b.rang - a.rang || a.staerke - b.staerke).slice(0, 3).map((d) => ({ disziplinId: d.disziplinId, rang: d.rang, abdeckung: d.abdeckung }));

  // ----- Achsen gegen den Liga-Schnitt -----------------------------------------------------------------------------
  const achsenKeys = [["pow", "POW"], ["spe", "SPE"], ["men", "MEN"], ["soc", "SOC"]] as const;
  const ligaSpieler = kader.filter((r) => ligaIds.has(r.teamId)).map((r) => spielerById.get(r.playerId)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const mittel = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);
  const achsen = achsenKeys.map(([id, label]) => ({
    id,
    label,
    wert: mittel(spieler.map((s) => s[id])),
    liga: mittel(ligaSpieler.map((p) => p.coreStats?.[id] ?? 0)),
  }));

  // ----- Verträge, die auslaufen -----------------------------------------------------------------------------------
  const enden = Array.from(new Set(spieler.map((s) => s.vertragEndeSaison))).sort((a, b) => a - b);
  const vertraege = enden.map((endeSaison) => {
    const l = spieler.filter((s) => s.vertragEndeSaison === endeSaison);
    return { endeSaison, spieler: l.length, gehalt: l.reduce((s, x) => s + x.gehalt, 0) };
  });

  // ----- Kasse -----------------------------------------------------------------------------------------------------
  const b = (input.budget ?? berechneVorstandBudgetStand)(gameState, teamId);
  const abloesen = spieler.reduce((s, x) => s + x.abloese, 0);
  const gehaltSumme = spieler.reduce((s, x) => s + x.gehalt, 0);
  const gehaltTopf = b.gehalt.gesamt > 0 ? b.gehalt.gesamt : null;
  const kasse = {
    kasse: mein.kasse,
    abloesen,
    gehaltSumme,
    gehaltTopf,
    gehaltFrei: gehaltTopf != null ? b.gehalt.frei : null,
    gehaltAnteil: gehaltTopf != null ? gehaltSumme / gehaltTopf : null,
    ruecklage: b.herleitung.ruecklageZiel,
    gehaltspuffer: b.herleitung.gehaltspuffer,
    freigabeAnteil: b.wirksamerAnteil,
    gedeckelt: b.gedeckelt,
    freigabeGrund: b.grund,
    restbudget: b.investition.frei,
    pflichtMin: ansicht.regeln.minKader,
    kaderMax: ansicht.regeln.maxPicksJeTeam,
    kader: mein.kader,
  };

  // ----- Vergleich in der eigenen Liga -----------------------------------------------------------------------------
  const vgl = (id: ErgebnisVergleich["id"], label: string, f: (t: (typeof ligaTeams)[number]) => number): ErgebnisVergleich => {
    const alle = ligaTeams.map(f);
    const wert = f(meinTeam);
    return { id, label, wert, rang: rangIn(alle, wert), von: ligaTeams.length, schnitt: mittel(alle) };
  };
  const vergleich = [
    vgl("staerke", "Kaderstärke", (t) => t.kaderStaerke),
    vgl("gehalt", "Gehaltssumme", (t) => t.gehaltSumme),
    vgl("abloese", "Ablösen", (t) => t.abloeseSumme),
    vgl("kasse", "Kasse", (t) => t.kasse),
    vgl("kader", "Kadergröße", (t) => t.kader),
  ];

  const eignungen: ErgebnisDaten["eignungen"] = {};
  for (const d of input.disziplinIds) {
    eignungen[d] = spieler
      .map((s) => ({ playerId: s.playerId, wert: spielerById.get(s.playerId)?.disciplineRatings?.[d] ?? 0 }))
      .sort((a, c) => c.wert - a.wert);
  }

  return {
    teamId,
    ligaName,
    ligaGroesse: ligaTeams.length,
    spieler,
    teams,
    disziplinen,
    staerke,
    achsen,
    bedarf,
    vertraege,
    kasse,
    vergleich,
    eignungen,
  };
}

/** Ø der besten sechs (für „meine besten 6“): dieselbe Rechnung wie die Kaderstärke. */
export function besteSechs(eignungen: ErgebnisDaten["eignungen"], disziplinId: string): { liste: Array<{ playerId: string; wert: number }>; staerke: number } {
  const liste = (eignungen[disziplinId] ?? []).slice(0, 6);
  return { liste, staerke: berechneStaerke(liste.map((x) => x.wert)) };
}
