/**
 * LEADERS MODERN (22.11.) — reines Modell der Seite „Leaders“: Bestenlisten der laufenden Saison.
 * Vorlage: public/mockups/leaders-modern-22-11.html, Konzept docs/design/leaders-modern-22-11.md.
 *
 * KEINE NEUE WERTUNG, nur gelesen und gefiltert:
 *  - PP je Spieler, Einsatz, Disziplin und Spieltag = Punkte-Ledger der Saison (`buildSeasonPointsLedger`). Die Zeilen tragen die
 *    GEBUCHTEN Punkte (Skala C2, Tagesanker, wo er gilt): gezeigt = gebucht, nie neu skaliert. Ob der Tagesanker an einem
 *    Spieltag gilt, sagt `ppTagesankerFuer(gameState, matchdayId)`, nie eine Prozess-Variable.
 *  - Team-Ergebnisse je Disziplin und Spieltag = die Spieltags-Übersichten des Saisonstands (`getUebersicht`): Duell 0 bis 10 je
 *    Seite (Skala E1), Vierergruppen (Mini-DM, Takeshi, Staffel, Battlefield) mit Platzpunkten und `wert`.
 *  - Medaillen = Hochrechnung „wenn heute Schluss wäre“: je Liga und Disziplin Gold/Silber/Bronze nach der Summe der
 *    Ergebnispunkte (Regel docs/design/finanzen-posten-22-11.md g.1). VERGEBEN wird am Saisonende; hier wird nichts gebucht.
 *    ENTSCHEIDUNG DES PM (22.11., so im Mockup): in den Vierer-Pod-Disziplinen steht kein 0-bis-10-Ergebnis, dort wertet die
 *    Rangfolge nach dem Verhältnis (eigener Wert minus Mittel der Gegner, Summe der Einsätze). Gleichstand: Ergebnispunkte,
 *    dann Verhältnis, dann PP-Summe der Disziplin, sonst wird der Rang geteilt.
 *
 * Alles hier ist öffentlich (PP, Ergebnisse, Medaillen): kein Scouting-Nebel.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { getPlayerPortraitInitials, getPlayerPortraitMediaModel, getTeamLogoModel } from "@/lib/data/mediaAssets";
import { isPlayerAvailabilityInjured } from "@/lib/fatigue/fatigue-injury-service";
import { getLeagueOf } from "@/lib/season/league-split";
import type { SpieltagsUebersicht } from "@/lib/foundation/season-matchday-fixtures-overview";

export const LEADERS_ACHSEN = ["pow", "spe", "men", "soc"] as const;
export type LeadersAchse = (typeof LEADERS_ACHSEN)[number];
export const LEADERS_ACHSEN_LABEL: Record<LeadersAchse, string> = { pow: "POW", spe: "SPE", men: "MEN", soc: "SOC" };
const KATEGORIE_ACHSE: Record<string, LeadersAchse> = { power: "pow", speed: "spe", mental: "men", social: "soc" };
const KLASSE_ACHSE: Record<string, LeadersAchse> = {
  Berserker: "pow", Warlord: "pow", Tank: "pow",
  Sprinter: "spe", Rogue: "spe", Charger: "spe",
  Mage: "men", Overseer: "men", Templar: "men",
  Bard: "soc", Hero: "soc", Badass: "soc", Tactician: "soc",
};

/** Medaillen-Prämie je Liga und Platz in C (docs/design/finanzen-posten-22-11.md g.1). Nur Anzeige der Hochrechnung. */
export const LEADERS_PRAEMIE: Record<1 | 2, [number, number, number]> = { 1: [0.5, 0.3, 0.2], 2: [0.3, 0.2, 0.1] };

export type LeadersDisziplin = { id: string; name: string; achse: LeadersAchse; spielerJeTeam: number | null; pod: boolean };

/** Eine PP-Buchung (ein Spieler in einer Disziplin an einem Spieltag). */
export type LeadersBuchung = {
  spieltag: number;
  playerId: string;
  disziplinId: string;
  pp: number;
  platz: number;
  mvp: boolean;
};

/** Ein Einsatz eines Teams in einer Disziplin an einem Spieltag. */
export type LeadersEinsatz = {
  spieltag: number;
  teamId: string;
  disziplinId: string;
  /** Tabellenpunkte: 2 Sieg, 1 Unentschieden, 0 Niederlage; Vierergruppe 2-1-0-0. */
  punkte: number;
  /** Duell: eigene Seite 0 bis 10 (E1); Pod: `null`. */
  eigene: number | null;
  gegnerZahl: number | null;
  gegner: string[];
  /** Pod: Platz 1 bis 4. */
  platz: number | null;
  /** Duell: eigene minus Gegner; Pod: eigener Wert minus Mittel der Gegner. Das Verhältnis. */
  verhaeltnis: number;
  /** Was die Medaillen-Wertung summiert: Duell `eigene`, Pod das Verhältnis. */
  wertung: number;
};

export type LeadersSpieler = {
  id: string;
  name: string;
  teamId: string;
  klasse: string;
  klasseAchse: LeadersAchse | null;
  portraitSrc: string | null;
  initials: string;
  verletzt: boolean;
};

export type LeadersTeam = {
  teamId: string;
  name: string;
  kuerzel: string;
  logoSrc: string | null;
  initials: string;
  liga: 1 | 2 | null;
  mensch: boolean;
};

export type LeadersModell = {
  gebuchteSpieltage: number;
  spieltageGesamt: number;
  /** Spieltage mit gebuchtem Ergebnis (1-basiert), aufsteigend. */
  gespielteSpieltage: number[];
  /** Tagesanker je Spieltag: `true`, wenn die PP dieses Spieltags nach dem Tagesanker gebucht sind. */
  tagesanker: Record<number, boolean>;
  ownTeamId: string | null;
  disziplinen: LeadersDisziplin[];
  /** Disziplinen je Spieltag (Slot 1, Slot 2), aus den gebuchten Einsätzen. */
  disziplinenJeSpieltag: Record<number, string[]>;
  teams: LeadersTeam[];
  spieler: LeadersSpieler[];
  buchungen: LeadersBuchung[];
  einsaetze: LeadersEinsatz[];
};

function ligaNr(gameState: GameState, teamId: string): 1 | 2 | null {
  const tier = getLeagueOf(gameState, teamId);
  return tier === "liga1" ? 1 : tier === "liga2" ? 2 : null;
}

const rund = (w: number, stellen = 1) => Math.round(w * 10 ** stellen) / 10 ** stellen;

/** Wettkampf-Rang: 1 + Zahl der Besseren, Gleiche teilen. Höher ist besser. `null` bekommt keinen Rang. */
export function vergibRaenge(eintraege: ReadonlyArray<{ id: string; wert: number | null }>): Map<string, number> {
  const werte = eintraege.filter((e): e is { id: string; wert: number } => e.wert != null && Number.isFinite(e.wert));
  const r4 = (w: number) => Math.round(w * 10000) / 10000;
  const sortiert = [...werte].sort((a, b) => r4(b.wert) - r4(a.wert));
  const karte = new Map<string, number>();
  let vorher: number | null = null;
  let vorherRang = 0;
  sortiert.forEach((e, i) => {
    if (vorher != null && r4(e.wert) === vorher) {
      karte.set(e.id, vorherRang);
      return;
    }
    vorher = r4(e.wert);
    vorherRang = i + 1;
    karte.set(e.id, vorherRang);
  });
  return karte;
}

export function baueLeadersModell(input: {
  gameState: GameState;
  ownTeamId: string | null;
  /** Gebuchte Spieltage mit ihrer Übersicht (1-basierte Nummer). */
  uebersichten: ReadonlyArray<{ spieltag: number; matchdayId: string; uebersicht: SpieltagsUebersicht | null }>;
  /** Fürs Tagesanker-Urteil je Spieltag (`ppTagesankerFuer`), von der Komponente gereicht, damit dieses Modul React-frei bleibt. */
  tagesankerFuer?: (matchdayId: string) => boolean;
}): LeadersModell {
  const { gameState, ownTeamId, uebersichten } = input;
  const matchdayIds = gameState.season.matchdayIds ?? [];
  const spieltagVon = new Map(matchdayIds.map((id, i) => [id, i + 1] as const));

  const katalog = [...gameState.disciplines]
    .map((d, i) => ({ d, i }))
    .sort((a, b) => {
      const ka = LEADERS_ACHSEN.indexOf(KATEGORIE_ACHSE[a.d.category] ?? "soc");
      const kb = LEADERS_ACHSEN.indexOf(KATEGORIE_ACHSE[b.d.category] ?? "soc");
      return ka - kb || (a.d.displayOrder ?? a.i) - (b.d.displayOrder ?? b.i);
    });

  /* ---- Einsätze der Teams aus den Übersichten */
  const einsaetze: LeadersEinsatz[] = [];
  const podDisziplinen = new Set<string>();
  const disziplinenJeSpieltag: Record<number, string[]> = {};
  const merke = (spieltag: number, disziplinId: string) => {
    const liste = (disziplinenJeSpieltag[spieltag] ??= []);
    if (!liste.includes(disziplinId)) liste.push(disziplinId);
  };
  for (const { spieltag, uebersicht } of uebersichten) {
    if (!uebersicht) continue;
    for (const p of uebersicht.paarungen) {
      for (const d of p.disziplinen) {
        if (!d.gespielt || d.punkteHeim == null || d.punkteGast == null) continue;
        merke(spieltag, d.disciplineId);
        const zahlen: [number, number] | null = d.ergebnisNormiert ?? (d.seiten ? [Math.round(d.seiten[0]), Math.round(d.seiten[1])] : null);
        if (!d.miniDmPodIdHeim) {
          einsaetze.push({ spieltag, teamId: p.homeTeamId, disziplinId: d.disciplineId, punkte: d.punkteHeim, eigene: zahlen?.[0] ?? null, gegnerZahl: zahlen?.[1] ?? null, gegner: [p.awayTeamId], platz: null, verhaeltnis: zahlen ? zahlen[0] - zahlen[1] : 0, wertung: zahlen?.[0] ?? d.punkteHeim });
        }
        if (!d.miniDmPodIdGast) {
          einsaetze.push({ spieltag, teamId: p.awayTeamId, disziplinId: d.disciplineId, punkte: d.punkteGast, eigene: zahlen?.[1] ?? null, gegnerZahl: zahlen?.[0] ?? null, gegner: [p.homeTeamId], platz: null, verhaeltnis: zahlen ? zahlen[1] - zahlen[0] : 0, wertung: zahlen?.[1] ?? d.punkteGast });
        }
      }
    }
    for (const pod of uebersicht.miniDmPods ?? []) {
      podDisziplinen.add(pod.disciplineId);
      for (const m of pod.mitglieder) {
        if (m.teamPoints == null) continue;
        merke(spieltag, pod.disciplineId);
        const andere = pod.mitglieder.filter((x) => x.teamId !== m.teamId);
        const werte = andere.map((x) => x.wert).filter((w): w is number => w != null);
        const mittel = werte.length ? werte.reduce((s, w) => s + w, 0) / werte.length : null;
        const vh = m.wert != null && mittel != null ? rund(m.wert - mittel, 2) : 0;
        einsaetze.push({ spieltag, teamId: m.teamId, disziplinId: pod.disciplineId, punkte: m.teamPoints, eigene: null, gegnerZahl: null, gegner: andere.map((x) => x.teamId), platz: m.platz, verhaeltnis: vh, wertung: vh });
      }
    }
  }

  const disziplinen: LeadersDisziplin[] = katalog.map(({ d }) => ({
    id: d.id,
    name: d.name,
    achse: KATEGORIE_ACHSE[d.category] ?? "soc",
    spielerJeTeam: d.playerCount ?? null,
    pod: podDisziplinen.has(d.id),
  }));

  /* ---- PP-Buchungen */
  const ledger = buildSeasonPointsLedger(gameState);
  const buchungen: LeadersBuchung[] = [];
  for (const e of ledger.pointEntries) {
    if (!Number.isFinite(e.points)) continue;
    const spieltag = e.matchdayId ? (spieltagVon.get(e.matchdayId) ?? 0) : 0;
    buchungen.push({ spieltag, playerId: e.playerId, disziplinId: e.disciplineId, pp: e.points, platz: e.rankInDiscipline, mvp: Boolean(e.isMvpCandidate) });
  }

  const gespielteSpieltage = [...new Set([...einsaetze.map((e) => e.spieltag), ...buchungen.map((b) => b.spieltag)])].filter((s) => s > 0).sort((a, b) => a - b);
  const tagesanker: Record<number, boolean> = {};
  for (const s of gespielteSpieltage) tagesanker[s] = input.tagesankerFuer ? input.tagesankerFuer(matchdayIds[s - 1] ?? "") : false;

  /* ---- Teams, Spieler */
  const teams: LeadersTeam[] = gameState.teams.map((t) => {
    const logo = getTeamLogoModel(t);
    return { teamId: t.teamId, name: t.name, kuerzel: t.shortCode, logoSrc: logo.src, initials: logo.initials, liga: ligaNr(gameState, t.teamId), mensch: Boolean(t.humanControlled) };
  });
  const teamVonSpieler = new Map(gameState.rosters.map((r) => [r.playerId, r.teamId] as const));
  const playerById = new Map(gameState.players.map((p) => [p.id, p] as const));
  const verletzt = new Set((gameState.seasonState.playerAvailabilityState ?? []).filter((e) => isPlayerAvailabilityInjured(e)).map((e) => e.playerId));
  const spieler: LeadersSpieler[] = [];
  for (const [playerId, teamId] of teamVonSpieler) {
    const p = playerById.get(playerId);
    if (!p) continue;
    spieler.push({ id: p.id, name: p.name, teamId, klasse: p.className, klasseAchse: KLASSE_ACHSE[p.className] ?? null, portraitSrc: getPlayerPortraitMediaModel(p).thumbSrc, initials: getPlayerPortraitInitials(p.name), verletzt: verletzt.has(p.id) });
  }

  return {
    gebuchteSpieltage: gespielteSpieltage.length ? gespielteSpieltage[gespielteSpieltage.length - 1]! : 0,
    spieltageGesamt: matchdayIds.length,
    gespielteSpieltage,
    tagesanker,
    ownTeamId,
    disziplinen,
    disziplinenJeSpieltag,
    teams,
    spieler,
    buchungen,
    einsaetze,
  };
}

/* ---------------------------------------------------------------------------------------------- Filter */

export type LeadersLiga = "eigene" | "andere" | "alle";
/** `0` = ganze Saison, sonst der Spieltag (1-basiert). */
export type LeadersZeit = number;

export function ligaFilter(liga: LeadersLiga, eigeneLiga: 1 | 2 | null): (liga: 1 | 2 | null) => boolean {
  if (liga === "alle" || eigeneLiga == null) return () => true;
  return (l) => (liga === "eigene" ? l === eigeneLiga : l !== eigeneLiga);
}

/* ---------------------------------------------------------------------------------------------- Spieler */

export type SpielerZeile = {
  spieler: LeadersSpieler;
  pp: number;
  einsaetze: number;
  /** PP je Bereich in der Reihenfolge POW, SPE, MEN, SOC. */
  pa: [number, number, number, number];
  pd: Record<string, number>;
  mvp: number;
  top10: number;
  best: { pp: number; disziplinId: string } | null;
};

export function baueSpielerZeilen(m: LeadersModell, zeit: LeadersZeit): SpielerZeile[] {
  const achseVon = new Map(m.disziplinen.map((d) => [d.id, LEADERS_ACHSEN.indexOf(d.achse)] as const));
  const spielerVon = new Map(m.spieler.map((s) => [s.id, s] as const));
  const jeSpieler = new Map<string, SpielerZeile>();
  for (const b of m.buchungen) {
    if (zeit > 0 && b.spieltag !== zeit) continue;
    const sp = spielerVon.get(b.playerId);
    if (!sp) continue;
    let z = jeSpieler.get(b.playerId);
    if (!z) {
      z = { spieler: sp, pp: 0, einsaetze: 0, pa: [0, 0, 0, 0], pd: {}, mvp: 0, top10: 0, best: null };
      jeSpieler.set(b.playerId, z);
    }
    z.pp += b.pp;
    z.einsaetze += 1;
    const a = achseVon.get(b.disziplinId) ?? 3;
    z.pa[a] += b.pp;
    z.pd[b.disziplinId] = (z.pd[b.disziplinId] ?? 0) + b.pp;
    if (b.mvp) z.mvp += 1;
    if (b.platz > 0 && b.platz <= 10) z.top10 += 1;
    if (!z.best || b.pp > z.best.pp) z.best = { pp: b.pp, disziplinId: b.disziplinId };
  }
  return [...jeSpieler.values()];
}

/* ---------------------------------------------------------------------------------------------- Teams */

export type TeamZeile = {
  team: LeadersTeam;
  punkte: number;
  s: number;
  u: number;
  n: number;
  verhaeltnis: number;
  pp: number;
  ppJeEinsatz: number;
  best: { spieler: LeadersSpieler; pp: number } | null;
  pa: [number, number, number, number];
};

export function baueTeamZeilen(m: LeadersModell, zeit: LeadersZeit, spielerZeilen: readonly SpielerZeile[]): TeamZeile[] {
  const achseVon = new Map(m.disziplinen.map((d) => [d.id, LEADERS_ACHSEN.indexOf(d.achse)] as const));
  return m.teams.map((team) => {
    const meine = spielerZeilen.filter((z) => z.spieler.teamId === team.teamId);
    const pp = meine.reduce((s, z) => s + z.pp, 0);
    const e = meine.reduce((s, z) => s + z.einsaetze, 0);
    const best = [...meine].sort((a, b) => b.pp - a.pp || a.spieler.name.localeCompare(b.spieler.name, "de"))[0] ?? null;
    let punkte = 0, s = 0, u = 0, n = 0, vh = 0;
    const pa: [number, number, number, number] = [0, 0, 0, 0];
    for (const x of m.einsaetze) {
      if (x.teamId !== team.teamId || (zeit > 0 && x.spieltag !== zeit)) continue;
      punkte += x.punkte;
      if (x.punkte >= 2) s += 1;
      else if (x.punkte === 1) u += 1;
      else n += 1;
      vh += x.verhaeltnis;
      pa[achseVon.get(x.disziplinId) ?? 3] += x.punkte;
    }
    return { team, punkte, s, u, n, verhaeltnis: rund(vh, 1), pp, ppJeEinsatz: e ? pp / e : 0, best: best ? { spieler: best.spieler, pp: best.pp } : null, pa };
  });
}

/* ---------------------------------------------------------------------------------------------- Medaillen */

export type MedaillenZeile = { teamId: string; gold: number; silber: number; bronze: number; praemie: number; disziplinen: Array<{ disziplinId: string; platz: 0 | 1 | 2 }> };
export type PodiumEintrag = { teamId: string; wert: number; verhaeltnis: number };

export type MedaillenTabellenZeile = { teamId: string; name: string; wert: number; vh: number; pp: number };

/** Summe der Wertung je Team und Disziplin (Saison): Duell die eigenen Ergebnispunkte, Pod das Verhaeltnis; dazu PP-Summe der Disziplin. */
export function medaillenSummen(m: LeadersModell, disziplinId: string): { summe: Map<string, { wert: number; vh: number }>; pp: Map<string, number>; einsaetze: number } {
  const summe = new Map<string, { wert: number; vh: number }>();
  const zaehler = new Map<string, number>();
  for (const x of m.einsaetze) {
    if (x.disziplinId !== disziplinId) continue;
    const alt = summe.get(x.teamId) ?? { wert: 0, vh: 0 };
    summe.set(x.teamId, { wert: alt.wert + x.wertung, vh: alt.vh + x.verhaeltnis });
    zaehler.set(x.teamId, (zaehler.get(x.teamId) ?? 0) + 1);
  }
  const teamVon = new Map(m.spieler.map((s) => [s.id, s.teamId] as const));
  const pp = new Map<string, number>();
  for (const b of m.buchungen) {
    if (b.disziplinId !== disziplinId) continue;
    const t = teamVon.get(b.playerId);
    if (t) pp.set(t, (pp.get(t) ?? 0) + b.pp);
  }
  let max = 0;
  for (const c of zaehler.values()) max = Math.max(max, c);
  return { summe, pp, einsaetze: max };
}

/**
 * DIE EINE MEDAILLEN-TABELLE: alle Teams einer Liga in einer Disziplin, geordnet nach Summe der Wertung, dann Verhaeltnis, dann
 * PP-Summe der Disziplin, zuletzt nach Name. Anzeige (Hochrechnung) UND Buchung am Saisonende lesen genau diese Reihenfolge.
 */
export function medaillenTabelle(m: LeadersModell, disziplinId: string, liga: 1 | 2): MedaillenTabellenZeile[] {
  const { summe, pp } = medaillenSummen(m, disziplinId);
  return m.teams
    .filter((t) => t.liga === liga && summe.has(t.teamId))
    .map((t) => ({ teamId: t.teamId, name: t.name, wert: summe.get(t.teamId)!.wert, vh: summe.get(t.teamId)!.vh, pp: pp.get(t.teamId) ?? 0 }))
    .sort((a, b) => b.wert - a.wert || b.vh - a.vh || b.pp - a.pp || a.name.localeCompare(b.name, "de"));
}

const r4 = (w: number) => Math.round(w * 10000) / 10000;
const gleichauf = (a: MedaillenTabellenZeile, b: MedaillenTabellenZeile) => r4(a.wert) === r4(b.wert) && r4(a.vh) === r4(b.vh) && r4(a.pp) === r4(b.pp);

export type MedaillenPlatz = { teamId: string; platz: 1 | 2 | 3; geteilt: boolean; wert: number; vh: number; praemie: number };

/**
 * Wer bekommt welche Medaille? Wettkampf-Rang (Gleichstand in Summe, Verhaeltnis UND PP teilt den Rang). Eine geteilte Medaille
 * bekommen alle Gleichauf, das Geld der belegten Plaetze (Gold, Silber, Bronze) wird durch ihre Zahl geteilt.
 */
export function medaillenPlaetze(tabelle: readonly MedaillenTabellenZeile[], praemie: readonly [number, number, number]): MedaillenPlatz[] {
  const aus: MedaillenPlatz[] = [];
  let i = 0;
  while (i < tabelle.length && i < 3) {
    let j = i + 1;
    while (j < tabelle.length && gleichauf(tabelle[i]!, tabelle[j]!)) j += 1;
    const gruppe = tabelle.slice(i, j);
    const geld = praemie.slice(i, Math.min(3, j)).reduce((s, v) => s + v, 0) / gruppe.length;
    for (const z of gruppe) aus.push({ teamId: z.teamId, platz: (i + 1) as 1 | 2 | 3, geteilt: gruppe.length > 1, wert: z.wert, vh: z.vh, praemie: geld });
    i = j;
  }
  return aus;
}

/** Die Hochrechnung: je Liga und Disziplin die ersten drei nach Ergebnispunkten (Saison, nicht je Spieltag). */
export function baueMedaillen(m: LeadersModell): { jeTeam: Map<string, MedaillenZeile>; podien: Map<string, PodiumEintrag[]>; gespielt: Record<string, number> } {
  const jeTeam = new Map<string, MedaillenZeile>(m.teams.map((t) => [t.teamId, { teamId: t.teamId, gold: 0, silber: 0, bronze: 0, praemie: 0, disziplinen: [] }] as const));
  const podien = new Map<string, PodiumEintrag[]>();
  const gespielt: Record<string, number> = {};
  for (const d of m.disziplinen) {
    const { einsaetze } = medaillenSummen(m, d.id);
    gespielt[d.id] = einsaetze;
    if (einsaetze === 0) continue;
    for (const liga of [1, 2] as const) {
      const tabelle = medaillenTabelle(m, d.id, liga);
      podien.set(`${liga}:${d.id}`, tabelle.slice(0, 3).map((t) => ({ teamId: t.teamId, wert: rund(t.wert, 1), verhaeltnis: rund(t.vh, 1) })));
      for (const p of medaillenPlaetze(tabelle, LEADERS_PRAEMIE[liga])) {
        const z = jeTeam.get(p.teamId)!;
        if (p.platz === 1) z.gold += 1;
        else if (p.platz === 2) z.silber += 1;
        else z.bronze += 1;
        z.praemie += p.praemie;
        z.disziplinen.push({ disziplinId: d.id, platz: (p.platz - 1) as 0 | 1 | 2 });
      }
    }
  }
  return { jeTeam, podien, gespielt };
}

/** Ergebnis-Anzeige einer Podium-/Karten-Zahl: Duell als Zahl, Pod mit Vorzeichen. */
export function wertungText(m: LeadersModell, disziplinId: string, wert: number): string {
  const pod = m.disziplinen.find((d) => d.id === disziplinId)?.pod;
  const r = rund(wert, 1);
  if (pod) return `${r > 0 ? "+" : r < 0 ? "−" : "±"}${Math.abs(r).toString().replace(".", ",")}`;
  return String(r).replace(".", ",");
}
