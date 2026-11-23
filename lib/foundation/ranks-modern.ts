/**
 * RANKS MODERN (22.11.) — reines Modell der Seite „Ränge: Stärke und Ertrag“.
 * Vorlage: public/mockups/ranks-modern-22-11.html, Konzept docs/design/ranks-modern-22-11.md.
 *
 * KEINE NEUE WERTUNG. Alles, was hier steht, ist gelesen oder aus gelesenem abgeleitet:
 *  - Stärke je Team = Mittel der besten sechs (Regel „Kaderstärke überall über die besten 6“). Quelle ist die
 *    kanonische Rangfunktion `buildTeamDisciplineRankRowsFromGameState` (dieselbe wie Startseite, Vorstandsziel,
 *    Saisonstand, Einsatzliste); hier wird nur durch 6 geteilt und neu geordnet. Gesamt und Bereiche mitteln die
 *    Disziplinen, die Spieler-Gesamtwerte der Spieler gehen nicht ein (die Disziplin-Eignung ist, was zählt).
 *  - Punkte je Team = Duellpunkte (Tabelle) gesamt und je Bereich, je Disziplin die Ergebnispunkte (0 bis 10 je
 *    Begegnung, Vierergruppen: Platzpunkte) — dieselbe Quelle wie der Saisonstand (`duellPunkteJeDisziplin`).
 *  - PP je Spieler = Punkte-Ledger der Saison (`buildSeasonPointsLedger`), öffentlich.
 *
 * SCOUTING-NEBEL (Chris, 18.11.; Kader-&-Teams-Mockup Abschnitt 7a): fremde Spieler tragen feste Stufen (unbekannt 10er,
 * beobachtet 5er, gescoutet exakt), nie „~Zahl“. Teams: der Rang ist öffentlich, der Wert fremder Teams steht als 5er-Stufe.
 * Sortiert und gerankt wird über die SICHTBARE Stufe (Untergrenze der Stufe), bei Gleichstand nach Name; verdeckte Werte
 * gehen nie in Sortierung, Rang oder Anzeige. Die Komponente liest ausschließlich `sichtWert`, `baueSpielerListe` und
 * `baueSpielerProfil` — nie die Rohfelder (Wächter: tests/ranks-modern-nebel.test.ts). „Fog of War aus“
 * (`scenarioMeta.scoutingNebelAus`) macht alles exakt.
 *
 * MEHRSPIELER: das eigene Team kommt als Parameter (`activeManagerTeamId`), nie fest verdrahtet.
 */
import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { isPlayerAvailabilityInjured } from "@/lib/fatigue/fatigue-injury-service";
import { buildTeamDisciplineRankRowsFromGameState } from "@/lib/foundation/team-discipline-rank-engine";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { getTeamLogoModel, getPlayerPortraitMediaModel, getPlayerPortraitInitials } from "@/lib/data/mediaAssets";
import { isScoutingNebelAus } from "@/lib/market/transfermarkt-nebel-einstellung";
import { getEffectiveScoutingLevel } from "@/lib/scouting/scouting-reveal-state";
import { buildSeasonDisciplinePlayerCountMap } from "@/lib/season/season-discipline-schedule";
import { getLeagueOf } from "@/lib/season/league-split";
import type { DuellZelle } from "@/lib/season/saisonstand-modern-logik";

export const RANKS_ACHSEN = ["pow", "spe", "men", "soc"] as const;
export type RanksAchse = (typeof RANKS_ACHSEN)[number];
export const RANKS_ACHSEN_LABEL: Record<RanksAchse, string> = { pow: "POW", spe: "SPE", men: "MEN", soc: "SOC" };

const KATEGORIE_ACHSE: Record<string, RanksAchse> = { power: "pow", speed: "spe", mental: "men", social: "soc" };
const KLASSE_ACHSE: Record<string, RanksAchse> = {
  Berserker: "pow", Warlord: "pow", Tank: "pow",
  Sprinter: "spe", Rogue: "spe", Charger: "spe",
  Mage: "men", Overseer: "men", Templar: "men",
  Bard: "soc", Hero: "soc", Badass: "soc", Tactician: "soc",
};

/** Beste N je Disziplin (Regel aus CLAUDE.md, wie `buildTeamDisciplineRankRowsFromGameState`). */
export const RANKS_BESTE = 6;
/** Mehr Zeilen als diese zeigt die Spielerliste nicht (der Rest ist per Filter erreichbar). */
export const RANKS_SPIELER_LIMIT = 120;

export type RanksDisziplin = { id: string; name: string; achse: RanksAchse; spielerJeTeam: number | null };

export type RanksTeam = {
  teamId: string;
  name: string;
  kuerzel: string;
  logoSrc: string | null;
  initials: string;
  /** 1 oder 2, `null` ohne Liga-Split. */
  liga: 1 | 2 | null;
  mensch: boolean;
  kaderGroesse: number;
  /** Mittel der besten sechs, je Schlüssel: `ges`, `pow`..`soc`, Disziplin-Id. */
  staerke: Record<string, number>;
  /** Punkte je Schlüssel; `null` = noch nicht gespielt bzw. keine Duell-Wertung im Spielstand. */
  punkte: Record<string, number | null>;
};

export type RanksSpieler = {
  id: string;
  name: string;
  teamId: string;
  klasse: string;
  klasseAchse: RanksAchse | null;
  rasse: string;
  portraitSrc: string | null;
  initials: string;
  verletzt: boolean;
  /** PP der Saison (öffentlich). */
  pp: number | null;
  ppJe: Record<string, number>;
  /** Breite der sichtbaren Stufe: 1 exakt, 5 beobachtet, 10 unbekannt. */
  breite: 1 | 5 | 10;
  /** ROHWERTE. Nur `sichtWert` darf sie lesen. */
  roh: { ges: number; achsen: Record<RanksAchse, number>; eignung: Record<string, number> };
};

export type RanksModell = {
  seasonLabel: string;
  gebuchteSpieltage: number;
  nebel: boolean;
  ownTeamId: string | null;
  hatDuell: boolean;
  disziplinen: RanksDisziplin[];
  /** Begegnungen, die je Disziplin schon gespielt sind (größte Zahl je Team). */
  gespielt: Record<string, number>;
  teams: RanksTeam[];
  spieler: RanksSpieler[];
};

export type RanksDuellMatrix = ReadonlyMap<string, ReadonlyMap<string, Pick<DuellZelle, "punkte" | "einsaetze">>>;

/* ---------------------------------------------------------------------------------------------- Rangrechnung */

export type RangWert = { id: string; wert: number | null };

/** Wettkampf-Rang: 1 + Zahl der Besseren, gleiche Werte teilen den Rang. Höher ist besser, Rang 1 = bester. `null` bekommt keinen Rang. */
export function vergibRaenge(eintraege: readonly RangWert[]): Map<string, number> {
  const werte = eintraege.filter((e): e is { id: string; wert: number } => e.wert != null && Number.isFinite(e.wert));
  const rund = (w: number) => Math.round(w * 10000) / 10000;
  const sortiert = [...werte].sort((a, b) => rund(b.wert) - rund(a.wert));
  const karte = new Map<string, number>();
  let vorher: number | null = null;
  let vorherRang = 0;
  sortiert.forEach((e, i) => {
    if (vorher != null && rund(e.wert) === vorher) {
      karte.set(e.id, vorherRang);
      return;
    }
    vorher = rund(e.wert);
    vorherRang = i + 1;
    karte.set(e.id, vorherRang);
  });
  return karte;
}

/* ---------------------------------------------------------------------------------------------- Modell bauen */

function ligaNr(gameState: GameState, teamId: string): 1 | 2 | null {
  const tier = getLeagueOf(gameState, teamId);
  return tier === "liga1" ? 1 : tier === "liga2" ? 2 : null;
}

function auf1(wert: number) {
  return Math.round(wert * 10) / 10;
}

export function baueRanksModell(input: {
  gameState: GameState;
  ownTeamId: string | null;
  /** Duellpunkte je Team und Disziplin (`duellPunkteJeDisziplin`), `null` ohne Duell-Spielplan. */
  duell: RanksDuellMatrix | null;
  gebuchteSpieltage?: number;
}): RanksModell {
  const { gameState, ownTeamId, duell } = input;
  const nebelAus = isScoutingNebelAus(gameState);
  const zaehlerJeDisziplin = buildSeasonDisciplinePlayerCountMap(gameState);

  const katalog = [...gameState.disciplines]
    .map((d, i) => ({ d, i }))
    .sort((a, b) => {
      const ka = RANKS_ACHSEN.indexOf(KATEGORIE_ACHSE[a.d.category] ?? "soc");
      const kb = RANKS_ACHSEN.indexOf(KATEGORIE_ACHSE[b.d.category] ?? "soc");
      return ka - kb || (a.d.displayOrder ?? a.i) - (b.d.displayOrder ?? b.i);
    });
  const disziplinen: RanksDisziplin[] = katalog.map(({ d }) => ({
    id: d.id,
    name: d.name,
    achse: KATEGORIE_ACHSE[d.category] ?? "soc",
    spielerJeTeam: zaehlerJeDisziplin.get(d.id) ?? d.playerCount ?? null,
  }));

  /* ---- Stärke: kanonische Rangfunktion, Summe der besten sechs je Disziplin, hier zum Mittel gemacht */
  const kern = buildTeamDisciplineRankRowsFromGameState(gameState, gameState.disciplines, "combined");
  const kernJeTeam = new Map(kern.map((z) => [z.teamId, z] as const));
  const jeAchse = (achse: RanksAchse) => disziplinen.filter((d) => d.achse === achse).length;

  const rosterAnzahl = new Map<string, number>();
  for (const e of gameState.rosters) rosterAnzahl.set(e.teamId, (rosterAnzahl.get(e.teamId) ?? 0) + 1);

  /* ---- Punkte aus den Duellen */
  const gespielt: Record<string, number> = {};
  for (const d of disziplinen) gespielt[d.id] = 0;
  const duellJe = (teamId: string, disziplinId: string) => duell?.get(teamId)?.get(disziplinId) ?? null;
  if (duell) {
    for (const zeilen of duell.values()) {
      for (const [id, zelle] of zeilen) gespielt[id] = Math.max(gespielt[id] ?? 0, zelle.einsaetze.length);
    }
  }

  const teams: RanksTeam[] = gameState.teams.map((team) => {
    const pack = kernJeTeam.get(team.teamId)?.scorePack;
    const staerke: Record<string, number> = {};
    if (pack) {
      staerke.ges = pack.total / (RANKS_BESTE * Math.max(1, disziplinen.length));
      for (const achse of RANKS_ACHSEN) staerke[achse] = pack[achse] / (RANKS_BESTE * Math.max(1, jeAchse(achse)));
      for (const d of disziplinen) staerke[d.id] = (pack.disciplines[d.id] ?? 0) / RANKS_BESTE;
    }
    const punkte: Record<string, number | null> = {};
    if (duell) {
      let gesamt = 0;
      const achsenSumme: Record<RanksAchse, number> = { pow: 0, spe: 0, men: 0, soc: 0 };
      for (const d of disziplinen) {
        const zelle = duellJe(team.teamId, d.id);
        if (!zelle || zelle.einsaetze.length === 0) {
          punkte[d.id] = null;
          continue;
        }
        punkte[d.id] = zelle.einsaetze.reduce((s, e) => s + (e.eigene ?? e.punkte), 0);
        gesamt += zelle.punkte;
        achsenSumme[d.achse] += zelle.punkte;
      }
      punkte.ges = gesamt;
      for (const achse of RANKS_ACHSEN) punkte[achse] = achsenSumme[achse];
    } else {
      punkte.ges = null;
      for (const achse of RANKS_ACHSEN) punkte[achse] = null;
      for (const d of disziplinen) punkte[d.id] = null;
    }
    const logo = getTeamLogoModel(team);
    return {
      teamId: team.teamId,
      name: team.name,
      kuerzel: team.shortCode,
      logoSrc: logo.src,
      initials: logo.initials,
      liga: ligaNr(gameState, team.teamId),
      mensch: Boolean(team.humanControlled),
      kaderGroesse: rosterAnzahl.get(team.teamId) ?? 0,
      staerke,
      punkte,
    };
  });

  /* ---- Spieler */
  const playerById = new Map(gameState.players.map((p) => [p.id, p] as const));
  const verletzt = new Set(
    (gameState.seasonState.playerAvailabilityState ?? []).filter((e) => isPlayerAvailabilityInjured(e)).map((e) => e.playerId),
  );
  const ledger = buildSeasonPointsLedger(gameState);
  const ppJe = new Map<string, Record<string, number>>();
  const ppSumme = new Map<string, number>();
  for (const e of ledger.pointEntries) {
    if (!Number.isFinite(e.points)) continue;
    const zeile = ppJe.get(e.playerId) ?? {};
    zeile[e.disciplineId] = (zeile[e.disciplineId] ?? 0) + e.points;
    ppJe.set(e.playerId, zeile);
    ppSumme.set(e.playerId, (ppSumme.get(e.playerId) ?? 0) + e.points);
  }

  const spieler: RanksSpieler[] = [];
  for (const eintrag of gameState.rosters) {
    const p: Player | undefined = playerById.get(eintrag.playerId);
    if (!p) continue;
    let breite: 1 | 5 | 10 = 1;
    if (!nebelAus && eintrag.teamId !== ownTeamId) {
      const stufe = ownTeamId ? getEffectiveScoutingLevel(gameState, ownTeamId, p.id) : 0;
      breite = stufe >= 5 ? 1 : stufe <= 0 ? 10 : 5;
    }
    const portrait = getPlayerPortraitMediaModel(p);
    const pp = ppSumme.get(p.id);
    spieler.push({
      id: p.id,
      name: p.name,
      teamId: eintrag.teamId,
      klasse: p.className,
      klasseAchse: KLASSE_ACHSE[p.className] ?? null,
      rasse: p.race,
      portraitSrc: portrait.thumbSrc ?? portrait.src ?? null,
      initials: getPlayerPortraitInitials(p.name),
      verletzt: verletzt.has(p.id),
      pp: pp != null ? auf1(pp) : null,
      ppJe: Object.fromEntries(Object.entries(ppJe.get(p.id) ?? {}).map(([k, v]) => [k, auf1(v)])),
      breite,
      roh: {
        ges: p.rating,
        achsen: { pow: p.coreStats?.pow ?? 0, spe: p.coreStats?.spe ?? 0, men: p.coreStats?.men ?? 0, soc: p.coreStats?.soc ?? 0 },
        eignung: Object.fromEntries(disziplinen.map((d) => [d.id, p.disciplineRatings?.[d.id] ?? 0])),
      },
    });
  }

  return {
    seasonLabel: gameState.season.id,
    gebuchteSpieltage: input.gebuchteSpieltage ?? 0,
    nebel: !nebelAus,
    ownTeamId,
    hatDuell: duell != null,
    disziplinen,
    gespielt,
    teams,
    spieler,
  };
}

/* ---------------------------------------------------------------------------------------------- Teams */

export type RanksMass = "staerke" | "punkte";
export type RanksLiga = "eigene" | "andere" | "alle";

export function teamWert(team: RanksTeam, schluessel: string, mass: RanksMass): number | null {
  return mass === "staerke" ? (team.staerke[schluessel] ?? null) : (team.punkte[schluessel] ?? null);
}

/** Alle Spalten-Schlüssel in der Reihenfolge der Matrix. */
export function ranksSpalten(modell: Pick<RanksModell, "disziplinen">): string[] {
  return ["ges", ...RANKS_ACHSEN, ...modell.disziplinen.map((d) => d.id)];
}

export function ligaFilter(liga: RanksLiga, eigeneLiga: 1 | 2 | null): (team: RanksTeam) => boolean {
  if (liga === "alle" || eigeneLiga == null) return () => true;
  return (team) => (liga === "eigene" ? team.liga === eigeneLiga : team.liga !== eigeneLiga);
}

/** Rang je Spalte und Team innerhalb der übergebenen Teams. Rang 1 = bester. */
export function teamRangTabelle(modell: RanksModell, teams: readonly RanksTeam[], mass: RanksMass): Record<string, Map<string, number>> {
  const tabelle: Record<string, Map<string, number>> = {};
  for (const schluessel of ranksSpalten(modell)) {
    tabelle[schluessel] = vergibRaenge(teams.map((t) => ({ id: t.teamId, wert: teamWert(t, schluessel, mass) })));
  }
  return tabelle;
}

/** 5er-Stufe eines Teamwerts, z. B. „40–45“. */
export function stufenText(wert: number, breite: number): string {
  const von = Math.floor(wert / breite) * breite;
  return `${von}–${von + breite}`;
}

/** Teamwert als Anzeige. Fremde Teams mit Nebel: 5er-Stufe der Stärke; Punkte sind öffentlich. */
export function teamWertText(modell: RanksModell, team: RanksTeam, schluessel: string, mass: RanksMass): string {
  const wert = teamWert(team, schluessel, mass);
  if (wert == null) return "–";
  if (mass === "punkte") return String(Math.round(wert * 10) / 10).replace(".", ",");
  if (modell.nebel && team.teamId !== modell.ownTeamId) return stufenText(wert, 5);
  return auf1(wert).toFixed(1).replace(".", ",");
}

/* ---------------------------------------------------------------------------------------------- Spieler */

export type SichtWert = {
  /** Sortier- und Rangschlüssel: der exakte Wert oder die UNTERGRENZE der sichtbaren Stufe. */
  sort: number;
  text: string;
  exakt: boolean;
  /** Stufe 0..100 für den Balken (`von`, `bis`), bei exakt `bis == von == Wert`. */
  von: number;
  bis: number;
};

function zahlText(wert: number, eineStelle: boolean) {
  return eineStelle ? auf1(wert).toFixed(1).replace(".", ",") : String(Math.round(wert));
}

/** DIE einzige Stelle, an der ein Spielerwert gelesen wird. Fremde, nicht voll gescoutete Spieler liefern nur die Stufe. */
export function sichtWert(sp: RanksSpieler, schluessel: string): SichtWert {
  const roh = schluessel === "ges" ? sp.roh.ges : (RANKS_ACHSEN as readonly string[]).includes(schluessel) ? sp.roh.achsen[schluessel as RanksAchse] : (sp.roh.eignung[schluessel] ?? 0);
  if (sp.breite === 1) {
    return { sort: roh, text: zahlText(roh, schluessel === "ges"), exakt: true, von: roh, bis: roh };
  }
  const von = Math.floor(roh / sp.breite) * sp.breite;
  return { sort: von, text: `${von}–${von + sp.breite}`, exakt: false, von, bis: von + sp.breite };
}

export type SpielerSortSchluessel = "name" | "kl" | "ra" | "team" | "ges" | RanksAchse | "eig" | "pp";

export type SpielerZeile = {
  id: string;
  rang: number | null;
  rangAlle: number | null;
  name: string;
  portraitSrc: string | null;
  initials: string;
  klasse: string;
  klasseAchse: RanksAchse | null;
  rasse: string;
  teamId: string;
  verletzt: boolean;
  ges: SichtWert;
  achsen: Record<RanksAchse, SichtWert>;
  eig: SichtWert;
  pp: number | null;
};

export function baueSpielerListe(
  modell: RanksModell,
  opt: {
    /** Disziplin-Id oder `null` = Gesamt. */
    disziplin: string | null;
    liga: RanksLiga;
    nurKader: boolean;
    klasseAchse: RanksAchse | null;
    sort: { k: SpielerSortSchluessel; d: 1 | -1 };
  },
): { zeilen: SpielerZeile[]; anzahl: number } {
  const eigeneLiga = modell.teams.find((t) => t.teamId === modell.ownTeamId)?.liga ?? null;
  const filter = ligaFilter(opt.liga, eigeneLiga);
  const teamVon = new Map(modell.teams.map((t) => [t.teamId, t] as const));
  const eignungSchluessel = opt.disziplin ?? "ges";

  const imPool = modell.spieler.filter((s) => {
    const team = teamVon.get(s.teamId);
    return team ? filter(team) : false;
  });
  const raengeLiga = vergibRaenge(imPool.map((s) => ({ id: s.id, wert: sichtWert(s, eignungSchluessel).sort })));
  const raengeAlle = vergibRaenge(modell.spieler.map((s) => ({ id: s.id, wert: sichtWert(s, eignungSchluessel).sort })));

  const sichtbar = imPool.filter((s) => (!opt.nurKader || s.teamId === modell.ownTeamId) && (!opt.klasseAchse || s.klasseAchse === opt.klasseAchse));
  const zeilen: SpielerZeile[] = sichtbar.map((s) => ({
    id: s.id,
    rang: raengeLiga.get(s.id) ?? null,
    rangAlle: raengeAlle.get(s.id) ?? null,
    name: s.name,
    portraitSrc: s.portraitSrc,
    initials: s.initials,
    klasse: s.klasse,
    klasseAchse: s.klasseAchse,
    rasse: s.rasse,
    teamId: s.teamId,
    verletzt: s.verletzt,
    ges: sichtWert(s, "ges"),
    achsen: { pow: sichtWert(s, "pow"), spe: sichtWert(s, "spe"), men: sichtWert(s, "men"), soc: sichtWert(s, "soc") },
    eig: sichtWert(s, eignungSchluessel),
    pp: s.pp,
  }));

  const kuerzel = (id: string) => teamVon.get(id)?.kuerzel ?? id;
  const text = (z: SpielerZeile): string | null => {
    switch (opt.sort.k) {
      case "name": return z.name;
      case "kl": return z.klasse;
      case "ra": return z.rasse;
      case "team": return kuerzel(z.teamId);
      default: return null;
    }
  };
  const zahl = (z: SpielerZeile): number | null => {
    switch (opt.sort.k) {
      case "ges": return z.ges.sort;
      case "pow": case "spe": case "men": case "soc": return z.achsen[opt.sort.k].sort;
      case "eig": return z.eig.sort;
      case "pp": return z.pp;
      default: return null;
    }
  };
  zeilen.sort((a, b) => {
    const ta = text(a);
    const tb = text(b);
    let c = 0;
    if (ta != null && tb != null) c = ta.localeCompare(tb, "de");
    else {
      const za = zahl(a);
      const zb = zahl(b);
      if (za == null && zb == null) c = 0;
      else if (za == null) return 1;
      else if (zb == null) return -1;
      else c = za - zb;
    }
    if (c !== 0) return c * opt.sort.d;
    return a.name.localeCompare(b.name, "de") || a.id.localeCompare(b.id);
  });
  return { zeilen, anzahl: zeilen.length };
}

export type SpielerProfil = {
  id: string;
  name: string;
  portraitSrc: string | null;
  initials: string;
  klasse: string;
  klasseAchse: RanksAchse | null;
  rasse: string;
  teamId: string;
  liga: 1 | 2 | null;
  fremd: boolean;
  bereiche: Array<{ schluessel: "ges" | RanksAchse; sicht: SichtWert; rang: number | null }>;
  disziplinen: Array<{ id: string; name: string; achse: RanksAchse; sicht: SichtWert; rang: number | null; pp: number | null }>;
};

export function baueSpielerProfil(modell: RanksModell, spielerId: string): SpielerProfil | null {
  const sp = modell.spieler.find((s) => s.id === spielerId);
  if (!sp) return null;
  const team = modell.teams.find((t) => t.teamId === sp.teamId) ?? null;
  const pool = modell.spieler.filter((s) => modell.teams.find((t) => t.teamId === s.teamId)?.liga === (team?.liga ?? null));
  const rangIn = (schluessel: string) => vergibRaenge(pool.map((s) => ({ id: s.id, wert: sichtWert(s, schluessel).sort }))).get(sp.id) ?? null;
  return {
    id: sp.id,
    name: sp.name,
    portraitSrc: sp.portraitSrc,
    initials: sp.initials,
    klasse: sp.klasse,
    klasseAchse: sp.klasseAchse,
    rasse: sp.rasse,
    teamId: sp.teamId,
    liga: team?.liga ?? null,
    fremd: sp.breite !== 1,
    bereiche: (["ges", ...RANKS_ACHSEN] as const).map((schluessel) => ({ schluessel, sicht: sichtWert(sp, schluessel), rang: rangIn(schluessel) })),
    disziplinen: modell.disziplinen
      .map((d) => ({ id: d.id, name: d.name, achse: d.achse, sicht: sichtWert(sp, d.id), rang: rangIn(d.id), pp: sp.ppJe[d.id] ?? null }))
      .sort((a, b) => b.sicht.sort - a.sicht.sort || a.name.localeCompare(b.name, "de")),
  };
}
