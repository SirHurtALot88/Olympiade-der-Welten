/**
 * ARENA-STAND (22.11.): der Arena-Stand je Team im Spielstand (`seasonState.arena`), die Ereignisse je Heimspiel (g.3) und die
 * Buchung der Tageskasse je Spieltag. Die Rechnung selbst steht in `arena-modell.ts` (rein); hier haengt sie am Spielstand.
 *
 * Lesen darf jeder Rechenweg, SCHREIBEN nur der Server: die Buchung beim Spieltagsabschluss (`bucheSpieltagFinanzen`), der Ausbau und
 * die Dauerkarten-Wahl (`/api/arena`, KI-Lauf). Der Stand wirkt nur auf Geld und Fans, nie auf die Wertung.
 */
import { buildTeamRivalryLedger } from "@/lib/rivalries/team-rivalries";
import { computeTeamBeliebtheitFromGameState } from "@/lib/economy/team-beliebtheit";
import { getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { sponsorBasisJahr } from "@/lib/sponsor/sponsor-settlement-service";
import { RELEGATION_COUNT, getLeagueOf } from "@/lib/season/league-split";
import { findLeagueMovementLog } from "@/lib/season/league-movement-service";
import { budgetRangFuer, kaderEinesTeams, marketabilityFuer, perzentilFuer, teamErfolgAusSnapshot, gleicheLigaWie } from "@/lib/marketing/marketing-kontext";
import { kaderJahresgehaltAmSpieltag } from "@/lib/finance/finanzen-je-spieltag";
import { findeSpieltagsFixtures } from "@/lib/resolve/battle-mode-pps-duell";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { isBereichDelegiert } from "@/lib/foundation/team-delegation";
import type { GameState } from "@/lib/data/olyDataTypes";
import { arenaAusAltemGebaeude, arenaAktiv, gueltigerArenaStempel } from "@/lib/arena/arena-regel";
import {
  DAUERKARTEN_ANTEIL,
  EINS_PLAETZE,
  GRUND_PLAETZE,
  HEIMSPIELE_REFERENZ,
  auslastungFan,
  dauerkartenGeld,
  dauerkartenPlaetze,
  grundNachfrage,
  kiDauerkartenStufe,
  mapBereiche,
  nachfrageJeBereich,
  rechneHeimspiel,
  runde2,
  serieNachSpieltag,
  stimmungNachSpieltag,
} from "@/lib/arena/arena-modell";
import {
  FAN_KONFIG,
  ankerNachSaison,
  erwartetePunkteJeSpieltag,
  fanBilanzAddiere,
  fanGruendeSaisonende,
  fanGruendeSpieltag,
  fanbasisStart,
  sternFans,
  sternGewicht,
  startStadionPlaetze,
  startStadionSchritte,
  wendeFanGruendeAn,
} from "@/lib/arena/fan-modell";
import {
  ARENA_BEREICHE,
  type ArenaFanGrund,
  type ArenaKaderMerk,
  type ArenaEreignisZeile,
  type ArenaHeimspiel,
  type ArenaPlaetze,
  type ArenaTeamStand,
  type DauerkartenStufe,
} from "@/lib/arena/arena-typen";

export function seasonIdVon(gameState: Pick<GameState, "season" | "seasonState">): string {
  return gameState.seasonState?.seasonId ?? gameState.season?.id ?? "";
}

/** Tabellen-Anteil 0 (letzter) bis 1 (erster) eines Rangs in einer Liga mit `n` Teams. */
export function anteilVonRang(rang: number, n: number): number {
  if (n <= 1) return 0.5;
  return Math.min(1, Math.max(0, 1 - (rang - 1) / (n - 1)));
}

/** Teams und Ligen: `ligaVon` (1/2/null) je Team, `ligaTeams` je Liga. Ohne Liga-Split bilden alle Teams eine Liga (Faktor Liga 2). */
function ligaTeams(gameState: GameState): Map<string, string[]> {
  const aus = new Map<string, string[]>();
  for (const t of gameState.teams) {
    const liga = getLeagueOf(gameState, t.teamId) ?? "alle";
    (aus.get(liga) ?? aus.set(liga, []).get(liga)!).push(t.teamId);
  }
  return aus;
}

export function istLiga1(gameState: GameState, teamId: string): boolean {
  return getLeagueOf(gameState, teamId) === "liga1";
}

/** Spieltagsnummern (1-basiert), an denen das Team Heimrecht hat. */
export function heimSpieltage(gameState: GameState, teamId: string): number[] {
  const ids = gameState.season?.matchdayIds ?? [];
  const aus: number[] = [];
  const schedule = gameState.seasonState?.schedule ?? [];
  const heimTage = new Set<string>();
  for (const f of schedule) if (f.homeTeamId === teamId && f.awayTeamId && f.homeTeamId !== f.awayTeamId) heimTage.add(f.matchdayId);
  ids.forEach((id, i) => {
    if (heimTage.has(id)) aus.push(i + 1);
  });
  return aus;
}

/** Zahl der Heimspiele der Saison (Preisgrundlage der Dauerkarten); ohne Spielplan die Referenz 10. */
export function heimspieleDerSaison(gameState: GameState, teamId: string): number {
  const n = heimSpieltage(gameState, teamId).length;
  return n > 0 ? n : HEIMSPIELE_REFERENZ;
}

export function rundeKI(gameState: GameState, teamId: string): boolean {
  const kontrolle = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  const e = kontrolle[teamId];
  const modus = e?.controlMode ?? "manual";
  if (modus === "ai" || modus === "passive") return true;
  return isBereichDelegiert(e, "gebaeude");
}

/** Die Liga-Tabelle nach Punkten (laufender Stand), je Liga: Rang 1..n. */
const RAENGE_MEMO = new WeakMap<object, Map<string, { rang: number; n: number }>>();
const SPONSOR_MEMO = new WeakMap<object, Map<string, number>>();

export function ligaRaenge(gameState: GameState): Map<string, { rang: number; n: number }> {
  const gemerkt = RAENGE_MEMO.get(gameState);
  if (gemerkt) return gemerkt;
  const aus = new Map<string, { rang: number; n: number }>();
  const standings = gameState.seasonState?.standings ?? {};
  for (const ids of ligaTeams(gameState).values()) {
    const reihe = [...ids].sort((a, b) => {
      const sa = standings[a];
      const sb = standings[b];
      return (sb?.points ?? 0) - (sa?.points ?? 0) || (sb?.verhaeltnis ?? 0) - (sa?.verhaeltnis ?? 0) || a.localeCompare(b);
    });
    reihe.forEach((id, i) => aus.set(id, { rang: i + 1, n: reihe.length }));
  }
  RAENGE_MEMO.set(gameState, aus);
  return aus;
}

/** Sponsor-Stufe je Team: 0 (kleinster Sponsor der Liga) bis 1 (groesster), nach der Saisonbasis des Vertrags. */
export function sponsorStufen(gameState: GameState): Map<string, number> {
  const gemerkt = SPONSOR_MEMO.get(gameState);
  if (gemerkt) return gemerkt;
  const aus = new Map<string, number>();
  for (const ids of ligaTeams(gameState).values()) {
    const basis = ids.map((id) => ({ id, b: sponsorBasisJahr(gameState, id) }));
    basis.sort((a, b) => b.b - a.b || a.id.localeCompare(b.id));
    basis.forEach((e, i) => aus.set(e.id, anteilVonRang(i + 1, basis.length)));
  }
  SPONSOR_MEMO.set(gameState, aus);
  return aus;
}

/** Der Arena-Stand eines Teams, den es heute hat: gespeichert oder (noch nicht geschrieben) die Ausgangslage. */
export function holeArenaStand(gameState: GameState, teamId: string): ArenaTeamStand {
  const seasonId = seasonIdVon(gameState);
  const gespeichert = gameState.seasonState?.arena?.[teamId];
  if (gespeichert) {
    if (gespeichert.seasonId === seasonId) return gespeichert;
    // Eine Saison weiter, aber der Wechsel hat den Stand noch nicht fortgeschrieben (z. B. Ladeweg): Plaetze, Fans und Stimmung bleiben.
    return { ...gespeichert, seasonId, dauerkarten: null, heimspiele: [], letzte: gespeichert.heimspiele.slice(-3), ausbauSaison: { steh: 0, sitz: 0, loge: 0 }, stand: 0, serie: 0 };
  }
  return neuerArenaStand(gameState, teamId);
}

/** Matrix-Beliebtheit (TeamIdentity.popularity 1..10) eines Teams; `null` ohne Eintrag. */
function matrixBeliebtheit(gameState: GameState, teamId: string): number | null {
  const p = gameState.teamIdentities?.find((t) => t.teamId === teamId)?.popularity;
  return typeof p === "number" && Number.isFinite(p) ? p : null;
}

/**
 * START-STADION (Chris, 23.11.): Grundarena 4.000 fuer alle plus ein Bonus von 0 bis 3 Schritten (je 1.000 Plaetze) aus einer gedeckelten Mischung:
 * 60 % Beliebtheit/Tradition aus der Team-Matrix, 25 % Liga (Liga 1 vor Liga 2), nur 15 % Budget. Starke Teams starten etwas groesser, muessen
 * aber weiter investieren; das Budget allein vergroessert das Stadion nicht (sonst werden die Starken noch staerker, weil sie Invest sparen).
 */
export function startStadionFuer(gameState: GameState, teamId: string): { plaetze: ArenaPlaetze; schritte: number } {
  const pop = matrixBeliebtheit(gameState, teamId);
  const popAnteil = pop == null ? 0.5 : (pop - 1) / 8;
  const rang = budgetRangFuer(gameState, teamId);
  const budgetAnteil = rang.anzahl > 1 ? 1 - (rang.rang - 1) / (rang.anzahl - 1) : 0.5;
  const schritte = startStadionSchritte(popAnteil, istLiga1(gameState, teamId), budgetAnteil);
  return { plaetze: startStadionPlaetze(GRUND_PLAETZE, schritte), schritte };
}

export function neuerArenaStand(gameState: GameState, teamId: string): ArenaTeamStand {
  const stempel = gueltigerArenaStempel(gameState);
  let plaetze: ArenaPlaetze = startStadionFuer(gameState, teamId).plaetze;
  let umstieg = false;
  if (stempel?.umstieg) {
    const stufe = getTeamFacilityState(gameState, teamId).facilities.arena_upgrade?.level ?? 0;
    plaetze = arenaAusAltemGebaeude(stufe);
    umstieg = stufe > 0;
    if (!umstieg) plaetze = { ...GRUND_PLAETZE };
  }
  const bel = computeTeamBeliebtheitFromGameState(gameState, teamId).value;
  // Fanbasis unabhaengig vom Stadion (23.11.). Umstieg: die Arena ist schon da, die Fans sollen sie fuellen koennen (halbes Haus x Beliebtheit).
  const start = fanbasisStart(bel, matrixBeliebtheit(gameState, teamId));
  const fans = umstieg ? Math.max(start, Math.round(0.5 * 1.5 * (plaetze.steh + plaetze.sitz) * bel)) : start;
  return {
    plaetze,
    fanbasis: fans,
    fanAnker: fans,
    fanStart: fans,
    fanVerlauf: [fans],
    stimmung: 50,
    serie: 0,
    punkte: gameState.seasonState?.standings?.[teamId]?.points ?? 0,
    stand: 0,
    seasonId: seasonIdVon(gameState),
    dauerkarten: null,
    heimspiele: [],
    letzte: [],
    ausbau: [],
    ausbauSaison: { steh: 0, sitz: 0, loge: 0 },
  };
}

/** Kaderstaerke je Team als Anteil in der Liga (1 = staerkster Kader, 0 = schwaechster): Mittel der besten sechs Spieler nach Rating. */
const STAERKE_MEMO = new WeakMap<object, Map<string, number>>();
export function kaderStaerken(gameState: GameState): Map<string, number> {
  const gemerkt = STAERKE_MEMO.get(gameState);
  if (gemerkt) return gemerkt;
  const aus = new Map<string, number>();
  for (const ids of ligaTeams(gameState).values()) {
    const wert = ids.map((id) => {
      const top = kaderEinesTeams(gameState, id).map((k) => k.player.rating).sort((a, b) => b - a).slice(0, 6);
      return { id, w: top.length ? top.reduce((x, y) => x + y, 0) / top.length : 0 };
    });
    wert.sort((a, b) => b.w - a.w || a.id.localeCompare(b.id));
    wert.forEach((e, i) => aus.set(e.id, anteilVonRang(i + 1, wert.length)));
  }
  STAERKE_MEMO.set(gameState, aus);
  return aus;
}

/**
 * Kauf und Verkauf von Stars (Chris, 23.11.): vergleicht den Kader von heute mit dem gemerkten. Ein Zugang mit Stern-Gewicht (Marketability
 * und Leistung) bringt Fans, ein Abgang (Verkauf oder Vertragsende) kostet sie. Ohne gemerkten Kader wird er ohne Wirkung angelegt;
 * `auffrischen` rechnet die Gewichte der bleibenden Spieler neu (einmal je Saison).
 */
export function kaderDifferenz(gameState: GameState, teamId: string, alt: Record<string, ArenaKaderMerk> | undefined, auffrischen: boolean): { kader: Record<string, ArenaKaderMerk>; gruende: ArenaFanGrund[] } {
  const kader: Record<string, ArenaKaderMerk> = {};
  const gruende: ArenaFanGrund[] = [];
  for (const { player } of kaderEinesTeams(gameState, teamId)) {
    const bekannt = alt?.[player.id];
    if (bekannt && !auffrischen) {
      kader[player.id] = bekannt;
      continue;
    }
    const w = sternGewicht(marketabilityFuer(gameState, teamId, player), perzentilFuer(gameState, teamId, player.id));
    kader[player.id] = { w, n: player.name };
    if (!bekannt && alt && w >= FAN_KONFIG.sternMin) gruende.push({ id: `kauf:${player.id}`, label: `Kauf ${player.name}`, delta: sternFans(w, true) });
  }
  if (alt) {
    for (const [id, m] of Object.entries(alt)) {
      if (!(id in kader) && m.w >= FAN_KONFIG.sternMin) gruende.push({ id: `verkauf:${id}`, label: `Verkauf ${m.n}`, delta: sternFans(m.w, false) });
    }
  }
  return { kader, gruende };
}

export type SaisonendeErfolg = { rangAnteil: number | null; titel: boolean; aufgestiegen: boolean; abgestiegen: boolean };

/** Der Stand der Fans fuer die naechste Saison: Plaetze, Fanbasis und Stimmung ruecken nach, die Saison-Listen beginnen neu. */
export function arenaStandFuerSaisonwechsel(
  gameState: GameState,
  teamId: string,
  naechsteSaisonId: string,
  endRang: { rang: number; n: number } | null,
  erfolg?: SaisonendeErfolg,
): ArenaTeamStand | null {
  const alt = gameState.seasonState?.arena?.[teamId];
  if (!alt) return null;
  // Finanzkonzept V2, Abschnitt 4: 50 + 0,5 x (S am Saisonende - 50); Titel/Aufstieg +10, Abstieg -10 (hier: Rang 1 und die Abstiegsplaetze).
  let s = alt.stimmung;
  if (endRang) {
    if (endRang.rang === 1) s += 10;
    else if (endRang.rang > endRang.n - RELEGATION_COUNT) s -= 10;
  }
  // FAN-MODELL ORGANISCH (23.11.): der grosse Schritt am Saisonende (Platz, Platz gegen Erwartung, Titel, Auf- und Abstieg), in der Saison-Schranke.
  const fanStart = alt.fanStart ?? alt.fanbasis;
  const rangAnteil = erfolg?.rangAnteil ?? (endRang ? anteilVonRang(endRang.rang, endRang.n) : null);
  const gruende = fanGruendeSaisonende({
    fanbasis: alt.fanbasis,
    rangAnteil,
    erwartungAnteil: alt.erwartung ?? null,
    titel: erfolg?.titel ?? endRang?.rang === 1,
    aufgestiegen: erfolg?.aufgestiegen ?? false,
    abgestiegen: erfolg?.abgestiegen ?? false,
  });
  const w = wendeFanGruendeAn(alt.fanbasis, fanStart, gruende);
  const fanbasis = Math.round(w.fanbasis);
  return {
    ...alt,
    seasonId: naechsteSaisonId,
    fanbasis,
    fanStart: fanbasis,
    fanAnker: Math.round(ankerNachSaison(alt.fanAnker ?? fanStart, fanbasis)),
    fanBilanzVorsaison: fanBilanzAddiere(alt.fanBilanz, w.gruende),
    fanBilanz: [],
    fanLetzte: { tag: 0, seasonId: naechsteSaisonId, delta: Math.round(fanbasis - alt.fanbasis), gruende: w.gruende.map((g) => ({ ...g, delta: Math.round(g.delta * 10) / 10 })) },
    fanVerlauf: [fanbasis],
    fanTrendVorsaison: fanStart > 0 ? (fanbasis - fanStart) / fanStart : 0,
    erwartung: undefined,
    stimmung: Math.min(100, Math.max(0, 50 + 0.5 * (s - 50))),
    serie: 0,
    stand: 0,
    punkte: 0,
    dauerkarten: null,
    heimspiele: [],
    letzte: alt.heimspiele.slice(-3).length > 0 ? alt.heimspiele.slice(-3) : alt.letzte,
    ausbauSaison: { steh: 0, sitz: 0, loge: 0 },
    tabelleVorjahr: endRang ? anteilVonRang(endRang.rang, endRang.n) : alt.tabelleVorjahr,
  };
}

/** Alle Arena-Staende fuer die naechste Saison (Teams ohne Stand bekommen ihn erst beim ersten Zugriff). `null`, wenn es keine gibt. */
export function arenaStaendeFuerSaisonwechsel(gameState: GameState, naechsteSaisonId: string): Record<string, ArenaTeamStand> | null {
  const alt = gameState.seasonState?.arena;
  if (!alt || Object.keys(alt).length === 0) return null;
  const raenge = ligaRaenge(gameState);
  // Erfolg der abgelaufenen Saison aus dem Snapshot (Endtabelle, Farb-Meister) und dem Liga-Log (Auf- und Abstieg).
  const seasonId = seasonIdVon(gameState);
  const snap = (gameState.seasonState?.seasonSnapshots ?? []).find((x) => x.seasonId === seasonId);
  const log = findLeagueMovementLog(gameState, seasonId);
  const aufgestiegen = new Set(log?.promotedTeamIds ?? []);
  const abgestiegen = new Set(log?.relegatedTeamIds ?? []);
  const aus: Record<string, ArenaTeamStand> = {};
  for (const teamId of Object.keys(alt)) {
    const zeile = snap?.finalStandings?.find((z) => z.teamId === teamId);
    const n = Math.max(2, ligaTeams(gameState).get(getLeagueOf(gameState, teamId) ?? "alle")?.length ?? 16);
    const rangAnteil = zeile?.rank != null ? anteilVonRang(zeile.rank, n) : null;
    const stufe = snap ? teamErfolgAusSnapshot(snap, teamId, gleicheLigaWie(gameState, teamId)).stufe : "keiner";
    const neu = arenaStandFuerSaisonwechsel(gameState, teamId, naechsteSaisonId, raenge.get(teamId) ?? null, {
      rangAnteil,
      titel: stufe === "titel",
      aufgestiegen: aufgestiegen.has(teamId),
      abgestiegen: abgestiegen.has(teamId),
    });
    if (neu) aus[teamId] = neu;
  }
  return aus;
}

/* ------------------------------------------------------------------------------------------------ Ereignisse (g.3) */

function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000003) / 1000003;
}

export const DERBY_FAKTOR: Record<number, number> = { 2: 1.5, 3: 1.7, 4: 1.8, 5: 2.0 };

const gleich = (f: number): ArenaPlaetze => ({ steh: f, sitz: f, loge: f });

export type EreignisKontext = {
  seasonId: string;
  saat: string;
  /** Spieltag des Heimspiels (1-basiert). */
  index: number;
  spieltage: number;
  heimTage: number[];
  gegnerId: string | null;
  derbyIntensitaet: number;
  eigenRang: number;
  gegnerRang: number | null;
  ligaGroesse: number;
  serie: number;
};

/** Ligaweite Ereignisse, die zwischen dem vorigen Heimspiel des Teams und diesem gewuerfelt wurden. Deterministisch aus der Saat. */
export function ligaEreignisse(saat: string, seasonId: string, vonExklusiv: number, bisInklusiv: number, spieltage: number): ArenaEreignisZeile[] {
  const aus: ArenaEreignisZeile[] = [];
  const feiertag = 3 + Math.floor(hash01(`${saat}:feiertag`) * Math.max(1, spieltage - 4));
  for (let k = vonExklusiv + 1; k <= bisInklusiv; k += 1) {
    if (k === feiertag) aus.push({ id: "feiertag", label: "Feiertag, Volksfest", faktor: gleich(1.3) });
    if (hash01(`${saat}:${seasonId}:unwetter:${k}`) < 0.06) aus.push({ id: "unwetter", label: "Unwetter", faktor: { steh: 0.6, sitz: 0.8, loge: 1 } });
    if (hash01(`${saat}:${seasonId}:streik:${k}`) < 0.03) aus.push({ id: "streik", label: "Streik im Nahverkehr", faktor: gleich(0.7) });
  }
  return aus;
}

export function ereignisseFuerHeimspiel(k: EreignisKontext): ArenaEreignisZeile[] {
  const aus: ArenaEreignisZeile[] = [];
  const pos = k.heimTage.indexOf(k.index);
  const vorigHeim = pos > 0 ? k.heimTage[pos - 1]! : 0;
  const letzteVier = pos >= 0 && pos >= k.heimTage.length - 4;
  if (k.derbyIntensitaet >= 2) aus.push({ id: "derby", label: `Derby (Intensität ${k.derbyIntensitaet})`, faktor: gleich(DERBY_FAKTOR[Math.min(5, k.derbyIntensitaet)] ?? 1.5) });
  const fuehrer = k.gegnerRang === 1 && k.index >= 5;
  const spitze = !fuehrer && k.index >= 8 && k.gegnerRang != null && (k.gegnerRang <= 3 || Math.abs(k.gegnerRang - k.eigenRang) === 1);
  if (fuehrer) aus.push({ id: "fuehrer", label: "Tabellenführer zu Gast", faktor: gleich(1.5) });
  else if (spitze) aus.push({ id: "spitze", label: "Spitzenspiel", faktor: gleich(1.4) });
  if (pos === 0) aus.push({ id: "eroeffnung", label: "Saisoneröffnung", faktor: gleich(1.3) });
  if (pos >= 0 && pos === k.heimTage.length - 1 && k.heimTage.length > 1) {
    const geht = k.eigenRang <= 4 || k.eigenRang > k.ligaGroesse - RELEGATION_COUNT - 1;
    aus.push({ id: "finale", label: geht ? "Saisonfinale um Titel, Aufstieg oder Abstieg" : "Saisonfinale", faktor: gleich(geht ? 1.6 : 1.3) });
  }
  if (letzteVier && k.eigenRang > k.ligaGroesse - RELEGATION_COUNT - 2) aus.push({ id: "abstieg", label: "Abstiegskampf", faktor: gleich(1.25) });
  if (k.serie >= 4) aus.push({ id: "siegesserie", label: "Siegesserie", faktor: gleich(1.15) });
  else if (k.serie <= -4) aus.push({ id: "niederlagenserie", label: "Niederlagenserie", faktor: gleich(0.85) });
  aus.push(...ligaEreignisse(k.saat, k.seasonId, vorigHeim, k.index, k.spieltage));
  return aus;
}

/** Produkt der Ereignisse je Platzart, auf 0,5 bis 2,0 begrenzt. */
export function ereignisProdukt(zeilen: readonly ArenaEreignisZeile[]): ArenaPlaetze {
  const p = { ...EINS_PLAETZE };
  for (const z of zeilen) for (const b of ARENA_BEREICHE) p[b] *= z.faktor[b];
  return mapBereiche((b) => Math.min(2, Math.max(0.5, p[b])));
}

function derbyMatrix(gameState: GameState): Map<string, number> {
  const aus = new Map<string, number>();
  for (const e of buildTeamRivalryLedger(gameState)) {
    aus.set(`${e.teamAId}|${e.teamBId}`, e.intensity);
    aus.set(`${e.teamBId}|${e.teamAId}`, e.intensity);
  }
  return aus;
}

/* ------------------------------------------------------------------------------------------------ Dauerkarten */

export function dauerkartenFuer(gameState: GameState, teamId: string, stufe: DauerkartenStufe, standard = false) {
  const stand = holeArenaStand(gameState, teamId);
  const heim = heimspieleDerSaison(gameState, teamId);
  const geld = dauerkartenGeld(stand.plaetze, stufe, istLiga1(gameState, teamId), heim);
  return {
    seasonId: seasonIdVon(gameState),
    stufe,
    anteil: DAUERKARTEN_ANTEIL[stufe],
    plaetze: dauerkartenPlaetze(stand.plaetze, stufe),
    geld,
    heimspiele: heim,
    ...(standard ? { standard: true as const } : {}),
  };
}

/** Die erwartete Auslastung eines Teams (Steh + Sitz) bei der Stimmung und Fanbasis von heute, ohne Ereignis. Grundlage der KI-Wahl. */
export function erwarteteAuslastung(gameState: GameState, teamId: string): number {
  const stand = holeArenaStand(gameState, teamId);
  const e = rechneHeimspiel({ plaetze: stand.plaetze, fanbasis: stand.fanbasis, stimmung: stand.stimmung, liga1: false, sponsorStufe: 0.5, tabellenAnteil: 0.5 });
  return auslastungFan(stand.plaetze, e.auslastung);
}

/** Wahl und Gutschrift der Dauerkarten: setzt den Stand und die Kasse. `immerNeu` ersetzt eine fruehere Wahl der Saison (Delta wird nachgebucht). */
export function setzeDauerkarten(gameState: GameState, teamId: string, stufe: DauerkartenStufe, optionen?: { standard?: boolean; jetzt?: string }): GameState {
  const stand = holeArenaStand(gameState, teamId);
  const neu = { ...dauerkartenFuer(gameState, teamId, stufe, optionen?.standard), sofort: true, zeit: optionen?.jetzt ?? new Date().toISOString() };
  const alt = stand.dauerkarten && stand.dauerkarten.seasonId === neu.seasonId ? stand.dauerkarten : null;
  const delta = runde2(neu.geld - (alt?.geld ?? 0));
  return {
    ...gameState,
    teams: delta === 0 ? gameState.teams : gameState.teams.map((t) => (t.teamId === teamId ? { ...t, cash: Math.round((t.cash + delta) * 10) / 10 } : t)),
    seasonState: {
      ...gameState.seasonState,
      arena: { ...(gameState.seasonState.arena ?? {}), [teamId]: { ...stand, dauerkarten: neu } },
    },
  };
}

/* ------------------------------------------------------------------------------------------------ Buchung je Spieltag */

export type ArenaSpieltagTeil = { tickets: number; heim: boolean; gegnerId: string | null; dauerkarten: number };

/**
 * Bereitet die Arena-Buchung eines Spieltags vor (einmal je Aufruf von `bucheSpieltagFinanzen`): Ligen, Raenge, Sponsor-Stufen und
 * die Derby-Matrix werden einmal gerechnet. `team(teamId)` rechnet Heimspiel und Fortschreibung dieses Teams und merkt den neuen
 * Stand; `ergebnis(gameState)` schreibt alle Staende in den Spielstand. `null`, wenn die Arena in dieser Saison nicht gilt.
 *
 * REIHENFOLGE: die Tageskasse rechnet mit dem Stand VOR diesem Spieltag (Stimmung und Fanbasis vom letzten Heimspiel); danach
 * rueckt der Stand fort (Ergebnis des Spieltags, Serie, Fanbasis nach Auslastung). Ein Team, dessen Spieltag schon gebucht ist
 * (`stand >= index`), bucht nichts mehr.
 */
export function bereiteArenaBuchung(gameState: GameState, matchdayId: string, index: number) {
  if (!arenaAktiv(gameState)) return null;
  const stempel = gueltigerArenaStempel(gameState)!;
  const seasonId = seasonIdVon(gameState);
  const raenge = ligaRaenge(gameState);
  const sponsor = sponsorStufen(gameState);
  const derby = derbyMatrix(gameState);
  const fixtures = findeSpieltagsFixtures(gameState, matchdayId);
  const spieltage = gameState.season?.matchdayIds?.length ?? 0;
  const neueStaende: Record<string, ArenaTeamStand> = {};

  const team = (teamId: string): ArenaSpieltagTeil => {
    const stand = holeArenaStand(gameState, teamId);
    if (stand.stand >= index) return { tickets: 0, heim: false, gegnerId: null, dauerkarten: 0 };
    const fixture = fixtures.find((f) => f.homeTeamId === teamId || f.awayTeamId === teamId) ?? null;
    const heim = fixture?.homeTeamId === teamId;
    const gegnerId = fixture ? (heim ? fixture.awayTeamId : fixture.homeTeamId) : null;
    const rang = raenge.get(teamId) ?? { rang: 1, n: 16 };
    const liga1 = istLiga1(gameState, teamId);
    let dauer = stand.dauerkarten?.seasonId === seasonId ? stand.dauerkarten : null;
    let dauerGeld = 0;
    // Wer vor dem ersten Spieltag keine Dauerkarten gewaehlt hat: KI und delegierte Teams nach der KI-Regel, Menschen "wenig" (Standard).
    if (index <= 1 && !dauer) {
      const ki = rundeKI(gameState, teamId);
      // Kasse knapp = weniger als zwei Gehaltsraten (Jahresgehalt / N) auf dem Konto: die KI nimmt dann eine Stufe mehr Dauerkarten.
      const kasse = gameState.teams.find((t) => t.teamId === teamId)?.cash ?? 0;
      const rate = spieltage > 0 ? kaderJahresgehaltAmSpieltag(gameState, teamId, null) / spieltage : 0;
      const stufe = ki ? kiDauerkartenStufe(erwarteteAuslastung(gameState, teamId), kasse < 2 * rate) : "wenig";
      dauer = dauerkartenFuer(gameState, teamId, stufe, !ki);
      dauerGeld = dauer.geld;
    }
    let kasse = 0;
    let heimspiel: ArenaHeimspiel | null = null;
    const heimTage = heimSpieltage(gameState, teamId);
    if (heim) {
      const gegnerRang = gegnerId ? (raenge.get(gegnerId)?.rang ?? null) : null;
      const zeilen = ereignisseFuerHeimspiel({
        seasonId,
        saat: stempel.saat,
        index,
        spieltage,
        heimTage,
        gegnerId,
        derbyIntensitaet: gegnerId ? (derby.get(`${teamId}|${gegnerId}`) ?? 0) : 0,
        eigenRang: rang.rang,
        gegnerRang,
        ligaGroesse: rang.n,
        serie: stand.serie,
      });
      // Tabellenplatz-Anteil der Logen: bis Spieltag 5 der Rang der Vorsaison, danach der laufende Rang.
      const tabelle = index >= 5 ? anteilVonRang(rang.rang, rang.n) : (stand.tabelleVorjahr ?? 0.5);
      const r = rechneHeimspiel({
        plaetze: stand.plaetze,
        fanbasis: stand.fanbasis,
        stimmung: stand.stimmung,
        liga1,
        ereignis: ereignisProdukt(zeilen),
        sponsorStufe: sponsor.get(teamId) ?? 0.5,
        tabellenAnteil: tabelle,
        dauer: dauer?.plaetze,
      });
      kasse = r.tickets;
      heimspiel = {
        seasonId,
        matchdayId,
        matchdayIndex: index,
        gegnerId,
        stimmung: Math.round(stand.stimmung * 10) / 10,
        fanbasis: Math.round(stand.fanbasis),
        plaetze: { ...stand.plaetze },
        nachfrage: mapBereiche((b) => Math.round(r.nachfrage[b])),
        auslastung: mapBereiche((b) => Math.round(r.auslastung[b] * 1000) / 1000),
        kasse: mapBereiche((b) => runde2(r.kasse[b])),
        zuschlag: mapBereiche((b) => Math.round(r.zuschlag[b] * 1000) / 1000),
        ereignisse: zeilen.map((z) => z.label),
        tickets: runde2(r.tickets),
      };
    }
    // Fortschreibung: Ergebnis des Spieltags (Tabellenpunkte), Serie, Stimmung, Fanbasis.
    const punkteJetzt = gameState.seasonState?.standings?.[teamId]?.points ?? stand.punkte;
    // Wurde der Stand erst jetzt angelegt (erster Spieltag), zaehlen die Punkte dieses Spieltags ab 0.
    const punkteBasis = index <= 1 && stand.stand === 0 ? 0 : stand.punkte;
    const delta = punkteJetzt - punkteBasis;
    const serie = serieNachSpieltag(stand.serie, delta);
    const stimmung = stimmungNachSpieltag(stand.stimmung, delta, heim, serie);
    // FAN-MODELL ORGANISCH (23.11.): die Fanbasis haengt nicht am Stadion. Ergebnis gegen die Erwartung der Kaderstaerke, Serien,
    // Rueckzug zum Anker, Kauf und Verkauf von Stars; je Saison zwischen -15 % und +30 % des Saisonstarts.
    const neueSaison = stand.erwartung === undefined;
    const erwartung = stand.erwartung ?? kaderStaerken(gameState).get(teamId) ?? 0.5;
    const diff = kaderDifferenz(gameState, teamId, stand.kader, neueSaison);
    const fanStart = stand.fanStart ?? stand.fanbasis;
    const gruende = [
      ...fanGruendeSpieltag({ fanbasis: stand.fanbasis, anker: stand.fanAnker ?? stand.fanbasis, deltaPunkte: fixture ? delta : null, erwartetePunkte: erwartetePunkteJeSpieltag(erwartung), serie }),
      ...diff.gruende,
    ];
    const fan = wendeFanGruendeAn(stand.fanbasis, fanStart, gruende);
    const fanbasis = fan.fanbasis;
    const verlauf = [...(stand.fanVerlauf ?? [Math.round(stand.fanbasis)])];
    while (verlauf.length < index) verlauf.push(verlauf[verlauf.length - 1] ?? Math.round(stand.fanbasis));
    verlauf[index] = Math.round(fanbasis);
    neueStaende[teamId] = {
      ...stand,
      stimmung,
      serie,
      fanbasis,
      fanStart,
      fanAnker: stand.fanAnker ?? stand.fanbasis,
      erwartung,
      kader: diff.kader,
      fanBilanz: fanBilanzAddiere(stand.fanBilanz, fan.gruende),
      fanLetzte: { tag: index, seasonId, delta: fanbasis - stand.fanbasis, gruende: fan.gruende.map((g) => ({ ...g, delta: Math.round(g.delta * 10) / 10 })).filter((g) => Math.abs(g.delta) >= 0.5) },
      fanVerlauf: verlauf,
      punkte: punkteJetzt,
      stand: index,
      dauerkarten: dauer,
      heimspiele: heimspiel ? [...stand.heimspiele, heimspiel] : stand.heimspiele,
    };
    return { tickets: runde2(kasse), heim, gegnerId, dauerkarten: dauerGeld };
  };

  return {
    team,
    ergebnis: (zustand: GameState): GameState => ({
      ...zustand,
      seasonState: { ...zustand.seasonState, arena: { ...(zustand.seasonState.arena ?? {}), ...neueStaende } },
    }),
  };
}

/** Der Schnitt der letzten drei Heimspiele (diese Saison, sonst die der Vorsaison): Nachfrage und Auslastung je Platzart. */
export function letzteDreiSchnitt(stand: ArenaTeamStand): { n: number; nachfrage: ArenaPlaetze; auslastung: ArenaPlaetze } | null {
  const liste = [...stand.letzte, ...stand.heimspiele].slice(-3);
  if (liste.length === 0) return null;
  const mittel = (f: (h: ArenaHeimspiel) => ArenaPlaetze) => mapBereiche((b) => liste.reduce((s, h) => s + f(h)[b], 0) / liste.length);
  return { n: liste.length, nachfrage: mittel((h) => h.nachfrage), auslastung: mittel((h) => h.auslastung) };
}

/** Nachfrage bei dem Stand von heute (neutrales Ereignis), fuer die Anzeige vor dem ersten Heimspiel. */
export function nachfrageHeute(gameState: GameState, teamId: string): ArenaPlaetze {
  const stand = holeArenaStand(gameState, teamId);
  return nachfrageJeBereich({ plaetze: stand.plaetze, fanbasis: stand.fanbasis, stimmung: stand.stimmung, sponsorStufe: sponsorStufen(gameState).get(teamId) ?? 0.5, tabellenAnteil: ligaTabellenAnteil(gameState, teamId) });
}

export function ligaTabellenAnteil(gameState: GameState, teamId: string): number {
  const r = ligaRaenge(gameState).get(teamId);
  const stand = holeArenaStand(gameState, teamId);
  const index = gameState.season?.currentMatchday ?? 0;
  if (!r) return 0.5;
  return index >= 5 ? anteilVonRang(r.rang, r.n) : (stand.tabelleVorjahr ?? 0.5);
}

export { grundNachfrage };
