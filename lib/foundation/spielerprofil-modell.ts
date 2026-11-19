/**
 * SPIELERPROFIL NEU (18.11.) — die reine Datenseite der Seite und des Kurzprofils.
 *
 * Vorlage: public/mockups/spielerprofil-modern-18-11.html, Doku: docs/design/spielerprofil-modern-18-11.md,
 * Abgleich: docs/design/spielerprofil-neu-abgleich-18-11.md.
 *
 * Nichts hier erfindet Spielwerte. Ränge, Punkte, Verletzung und Wege werden aus dem `GameState` und dem
 * vorhandenen `PlayerDetailDrawerData` abgeleitet; fehlt eine Quelle, kommt `null` und die Ansicht blendet aus.
 * React-frei, damit Ränge, Verletzungsanzeige, Primär-/Nebenweg und Scouting-Nebel ohne Rendering prüfbar sind.
 *
 * Entscheidungen Chris 18.11. (siehe Auftrag): keine Kaderrolle als Wort; Verletzt = nicht einsetzbar;
 * Kaderstärke über die besten 6; ungescoutete Spieler zeigen nur grobe Bereiche (Scouting-Nebel).
 */
import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { buildSharedRankMap } from "@/lib/foundation/player-discipline-rank-core";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import {
  playerGeneratorAttributeKeys,
  type PlayerGeneratorAttributeKey,
} from "@/lib/player-generator/official-discipline-weights";
import { resolveDisciplineWeightProfile } from "@/lib/player-generator/spiel-eignung-overrides";
import { getLeagueOf, isLeagueSplitActive } from "@/lib/season/league-split";

/* ------------------------------------------------------------------ Achsen und Attribute */

export type AchseId = "pow" | "spe" | "men" | "soc";
export type DisziplinKategorie = "power" | "speed" | "mental" | "social";

/** Die vier Achsen mit ihren drei Attributen (Reihenfolge der Matrix: je drei hintereinander). */
export const ACHSEN: ReadonlyArray<{
  id: AchseId;
  label: "POW" | "SPE" | "MEN" | "SOC";
  kategorie: DisziplinKategorie;
  attribute: readonly PlayerGeneratorAttributeKey[];
}> = [
  { id: "pow", label: "POW", kategorie: "power", attribute: ["power", "health", "determination"] },
  { id: "spe", label: "SPE", kategorie: "speed", attribute: ["stamina", "speed", "dexterity"] },
  { id: "men", label: "MEN", kategorie: "mental", attribute: ["awareness", "intelligence", "will"] },
  { id: "soc", label: "SOC", kategorie: "social", attribute: ["charisma", "spirit", "torment"] },
];

export const ATTRIBUT_LABEL: Record<PlayerGeneratorAttributeKey, string> = {
  power: "Power",
  health: "Health",
  determination: "Determination",
  stamina: "Stamina",
  speed: "Speed",
  dexterity: "Dexterity",
  awareness: "Awareness",
  intelligence: "Intelligence",
  will: "Will",
  charisma: "Charisma",
  spirit: "Spirit",
  torment: "Torment",
};

export function achseVonKategorie(kategorie: string | null | undefined): AchseId {
  return ACHSEN.find((achse) => achse.kategorie === kategorie)?.id ?? "pow";
}

export function achseVonAttribut(attribut: PlayerGeneratorAttributeKey): AchseId {
  return ACHSEN.find((achse) => achse.attribute.includes(attribut))?.id ?? "pow";
}

/* ------------------------------------------------------------------ Scouting-Nebel */

/**
 * Nebel = der Betrachter sieht den Spieler nur gescoutet (`attributeVisibility !== "exact"`). Dann zeigt
 * jede Tafel grobe Bereiche, und Ränge dürfen keine verdeckten Werte verraten (Chris 18.11., wie im
 * vorhandenen Scouting-System: `buildScoutedDisciplineTiers`, `maskForeignAttributeStats`).
 */
export function hatNebel(data: { attributeVisibility: string; revealConfidencePct?: number | null }): boolean {
  if (data.attributeVisibility === "exact") return false;
  // Voll aufgedeckt (gescoutet) = exakt, kein Nebel mehr.
  return (data.revealConfidencePct ?? 0) < 100;
}

/**
 * Breite der Bereiche im Nebel (Chris 18.11.): unbekannt = 10er-Stufe, beobachtet = 5er-Stufe, gescoutet = exakt.
 * Die Stufe folgt der Aufdeckung (`revealConfidencePct`); ab 40 % gilt der Spieler als beobachtet.
 */
export function nebelBreite(data: { attributeVisibility: string; revealConfidencePct?: number | null }): 0 | 5 | 10 {
  if (!hatNebel(data)) return 0;
  return (data.revealConfidencePct ?? 0) >= 40 ? 5 : 10;
}

/** Grober Bereich einer Zahl: 73 -> "70–79" (Breite 10) oder "70–74" (Breite 5). Nur für den Nebel. */
export function grobBereich(wert: number | null | undefined, breite: 5 | 10 | 0 = 10): string | null {
  if (wert == null || !Number.isFinite(wert)) return null;
  if (breite === 0) return String(Math.round(wert));
  const unten = Math.max(0, Math.floor(wert / breite) * breite);
  return `${unten}–${unten + breite - 1}`;
}

/** Grobe Rangeinordnung statt exaktem Rang (Nebel). */
export function grobeRangStufe(rang: number | null | undefined, von: number | null | undefined): string | null {
  if (rang == null || von == null || von <= 0) return null;
  const anteil = rang / von;
  if (anteil <= 0.1) return "Spitze (Top 10 %)";
  if (anteil <= 0.25) return "obere Gruppe";
  if (anteil <= 0.5) return "obere Hälfte";
  if (anteil <= 0.75) return "untere Hälfte";
  return "hintere Gruppe";
}

/* ------------------------------------------------------------------ Primär- und Nebenweg */

export type DisziplinWeg = {
  disziplinId: string;
  /** Attribut mit dem höchsten Matrixgewicht (Gewicht aus `resolveDisciplineWeightProfile`). */
  primaerAttribut: PlayerGeneratorAttributeKey | null;
  primaerGewicht: number;
  /** Attribut, das beim Spieler am meisten zur Eignung beiträgt (Gewicht x Wert). */
  tragendesAttribut: PlayerGeneratorAttributeKey | null;
  tragendesGewicht: number;
  tragenderWert: number | null;
  /** true = der Spieler trägt die Eignung über das Primärattribut, false = Nebenweg. */
  istPrimaer: boolean;
};

export function bestimmeWeg(
  disziplinId: string,
  werte: Partial<Record<PlayerGeneratorAttributeKey, number | null>>,
): DisziplinWeg {
  const profil = resolveDisciplineWeightProfile(disziplinId);
  let primaer: PlayerGeneratorAttributeKey | null = null;
  let primaerGewicht = 0;
  let tragend: PlayerGeneratorAttributeKey | null = null;
  let tragendBeitrag = -1;
  for (const attribut of playerGeneratorAttributeKeys) {
    const gewicht = profil[attribut] ?? 0;
    if (gewicht <= 0) continue;
    if (gewicht > primaerGewicht) {
      primaer = attribut;
      primaerGewicht = gewicht;
    }
    const wert = werte[attribut];
    if (wert == null || !Number.isFinite(wert)) continue;
    const beitrag = gewicht * wert;
    if (beitrag > tragendBeitrag) {
      tragend = attribut;
      tragendBeitrag = beitrag;
    }
  }
  return {
    disziplinId,
    primaerAttribut: primaer,
    primaerGewicht: primaerGewicht,
    tragendesAttribut: tragend,
    tragendesGewicht: tragend ? profil[tragend] ?? 0 : 0,
    tragenderWert: tragend ? werte[tragend] ?? null : null,
    istPrimaer: primaer != null && tragend === primaer,
  };
}

/** Beitrag je Attribut zur Eignung einer Disziplin (Gewicht x Wert), absteigend — erklärt die Zahl. */
export function beitraegeJeAttribut(
  disziplinId: string,
  werte: Partial<Record<PlayerGeneratorAttributeKey, number | null>>,
): Array<{ attribut: PlayerGeneratorAttributeKey; gewicht: number; wert: number | null; beitrag: number | null }> {
  const profil = resolveDisciplineWeightProfile(disziplinId);
  return playerGeneratorAttributeKeys
    .filter((attribut) => (profil[attribut] ?? 0) > 0)
    .map((attribut) => {
      const gewicht = profil[attribut] ?? 0;
      const wert = werte[attribut] ?? null;
      return { attribut, gewicht, wert, beitrag: wert == null ? null : (gewicht * wert) / 100 };
    })
    .sort((a, b) => b.gewicht - a.gewicht);
}

/** Die zwölf Attributwerte des Spielers aus `attributeStats` (null im Nebel). */
export function attributWerteAusDaten(
  data: Pick<PlayerDetailDrawerData, "attributeStats">,
): Partial<Record<PlayerGeneratorAttributeKey, number | null>> {
  const werte: Partial<Record<PlayerGeneratorAttributeKey, number | null>> = {};
  for (const zeile of data.attributeStats) {
    if ((playerGeneratorAttributeKeys as readonly string[]).includes(zeile.key)) {
      werte[zeile.key as PlayerGeneratorAttributeKey] = zeile.value;
    }
  }
  return werte;
}

/* ------------------------------------------------------------------ Verletzung */

export type VerletzungsAnzeige = {
  verletzt: boolean;
  /** "verletzt · nicht einsetzbar · noch N Spieltage" (rot) oder null. */
  text: string | null;
  nochSpieltage: number | null;
  bisSpieltag: string | null;
  /** Genesen, aber noch im Erholungsfenster. */
  genesend: boolean;
  /** Disziplinen, in denen im Spiel der Verletzung nur 50 % zählten (Chris 18.11., Regel 1). */
  halbeDisziplinen: Array<{ disziplinId: string; name: string }>;
};

function matchdayIndex(gameState: GameState | null | undefined, matchdayId: string | null | undefined) {
  if (!gameState || !matchdayId) return -1;
  return gameState.season.matchdayIds?.findIndex((id) => id === matchdayId) ?? -1;
}

/**
 * Verletzungsanzeige. `isUnavailable` aus der Verfügbarkeit ist die Quelle der Wahrheit (dieselbe wie Einsatzliste
 * und Validator); „noch N Spieltage" zählt vom nächsten ungespielten Spieltag bis `injuryUntilMatchday` einschließlich.
 */
export function bestimmeVerletzung(
  data: Pick<PlayerDetailDrawerData, "availability" | "injuryHistoryRows">,
  gameState?: GameState | null,
): VerletzungsAnzeige {
  const verfuegbarkeit = data.availability;
  const verletzt = verfuegbarkeit.isUnavailable || verfuegbarkeit.injuryStatus === "injured";
  const genesend = !verletzt && verfuegbarkeit.injuryStatus === "recovering";
  let noch: number | null = null;
  if (verletzt) {
    const bis = matchdayIndex(gameState, verfuegbarkeit.injuryUntilMatchday);
    const aktuell = matchdayIndex(gameState, gameState?.matchdayState?.matchdayId);
    if (bis >= 0 && aktuell >= 0) {
      const naechster = gameState?.matchdayState?.status === "resolved" ? aktuell + 1 : aktuell;
      noch = Math.max(1, bis - naechster + 1);
    }
  }
  const letzte = verletzt ? data.injuryHistoryRows?.[0] : null;
  const halbe = (letzte?.disciplines ?? []).map((disziplin) => ({ disziplinId: disziplin.disciplineId, name: disziplin.name }));
  const text = verletzt
    ? `verletzt · nicht einsetzbar${noch != null ? ` · noch ${noch} ${noch === 1 ? "Spieltag" : "Spieltage"}` : ""}`
    : null;
  return {
    verletzt,
    text,
    nochSpieltage: noch,
    bisSpieltag: verletzt ? verfuegbarkeit.injuryUntilMatchday : null,
    genesend,
    halbeDisziplinen: halbe,
  };
}

/* ------------------------------------------------------------------ Gehalt je Spieltag */

/** Eine Saison hat 20 Spieltage; das Jahresgehalt wird in 20 Raten gebucht (Finanzkonzept V2). */
export const SPIELTAGE_JE_SAISON = 20;

export function gehaltJeSpieltag(gehaltJeSaison: number | null | undefined, spieltage = SPIELTAGE_JE_SAISON): number | null {
  if (gehaltJeSaison == null || !Number.isFinite(gehaltJeSaison) || spieltage <= 0) return null;
  return gehaltJeSaison / spieltage;
}

/* ------------------------------------------------------------------ Ränge */

export type DisziplinRang = {
  disziplinId: string;
  wert: number | null;
  /** Rang unter den aktiven Spielern der eigenen Liga (Spieler mit Vertrag in einem Team der Liga). */
  ligaRang: number | null;
  ligaVon: number;
  /** Rang unter allen aktiven Spielern (Spieler in einem Kader). */
  aktivRang: number | null;
  aktivVon: number;
  /** Rang im eigenen Kader (ohne Team: null). */
  kaderRang: number | null;
  kaderVon: number;
  /** Zählt der Spieler zu den besten 6 seines Kaders in dieser Disziplin (Kaderstärke-Bezug)? */
  inBesten6: boolean;
  /**
   * Nur für Spieler ohne Vertrag (Draft, Transfermarkt): Rang, den er unter allen Aktiven hätte (er selbst zählt
   * nicht mit, `aktivVon` bleibt die Zahl der Aktiven), und der Rang, den er im Kader des Betrachters hätte.
   * Sonst null.
   */
  freiAktivRang: number | null;
  beiDirRang: number | null;
  beiDirVon: number;
  /** PP der laufenden Saison in dieser Disziplin (gebucht) und Rang in der Liga. */
  ppSaison: number | null;
  ppLigaRang: number | null;
  ppLigaVon: number;
};

export type SpielerRaenge = {
  ligaAktiv: boolean;
  ligaName: string | null;
  /** Der Spieler steht in keinem Kader (vertragslos). */
  vertragslos: boolean;
  disziplinen: Map<string, DisziplinRang>;
  /** PP der Saison insgesamt (gebucht) und Rang in der Liga. */
  ppGesamt: number | null;
  ppGesamtLigaRang: number | null;
  ppGesamtLigaVon: number;
  /** Mittel der besten 6 des Kaders je Disziplin (die Kaderstärke), Rang des Teams ist hier nicht nötig. */
  kaderStaerkeBeste6: Map<string, number | null>;
};

function eignungVon(player: Player, disziplinId: string): number | null {
  const wert = player.currentDisciplineValues?.[disziplinId] ?? player.disciplineRatings?.[disziplinId];
  return typeof wert === "number" && Number.isFinite(wert) ? wert : null;
}

/** Mittel der besten sechs Werte (Chris 18.11.: Kaderstärke überall über die besten 6). */
export function mittelBeste6(werte: ReadonlyArray<number | null | undefined>): number | null {
  const zahlen = werte.filter((wert): wert is number => typeof wert === "number" && Number.isFinite(wert)).sort((a, b) => b - a);
  if (zahlen.length === 0) return null;
  const beste = zahlen.slice(0, 6);
  return beste.reduce((summe, wert) => summe + wert, 0) / beste.length;
}

/** Rang, den `wert` in `ids` hätte, ohne dass der Spieler selbst in `ids` stehen muss (1 + Zahl der Besseren). */
export function hypothetischerRang(
  wert: number | null,
  ids: readonly string[],
  wertVon: (id: string) => number | null,
): number | null {
  if (wert == null) return null;
  let besser = 0;
  for (const id of ids) {
    const andere = wertVon(id);
    if (andere != null && andere > wert) besser += 1;
  }
  return besser + 1;
}

export function berechneSpielerRaenge(
  gameState: GameState,
  playerId: string,
  disziplinIds: readonly string[],
  betrachterTeamId: string | null = null,
): SpielerRaenge {
  const rosterByPlayer = new Map(gameState.rosters.map((eintrag) => [eintrag.playerId, eintrag.teamId] as const));
  const ligaAktiv = isLeagueSplitActive(gameState);
  const teamId = rosterByPlayer.get(playerId) ?? null;
  const eigeneLiga = teamId && ligaAktiv ? getLeagueOf(gameState, teamId) : null;
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));

  const aktiveIds = [...rosterByPlayer.keys()].filter((id) => playerById.has(id));
  const ligaIds = aktiveIds.filter((id) => {
    if (!eigeneLiga) return true;
    const team = rosterByPlayer.get(id);
    return team != null && getLeagueOf(gameState, team) === eigeneLiga;
  });
  const kaderIds = teamId ? aktiveIds.filter((id) => rosterByPlayer.get(id) === teamId) : [];
  const vertragslos = teamId == null;
  const betrachterKader = vertragslos && betrachterTeamId ? aktiveIds.filter((id) => rosterByPlayer.get(id) === betrachterTeamId) : [];

  const ledger = buildSeasonPointsLedger(gameState);
  const ppJeDisziplin = new Map<string, Map<string, number>>();
  const ppGesamtJeSpieler = new Map<string, number>();
  for (const eintrag of ledger.pointEntries) {
    if (!Number.isFinite(eintrag.points)) continue;
    const jeSpieler = ppJeDisziplin.get(eintrag.disciplineId) ?? new Map<string, number>();
    jeSpieler.set(eintrag.playerId, (jeSpieler.get(eintrag.playerId) ?? 0) + eintrag.points);
    ppJeDisziplin.set(eintrag.disciplineId, jeSpieler);
    ppGesamtJeSpieler.set(eintrag.playerId, (ppGesamtJeSpieler.get(eintrag.playerId) ?? 0) + eintrag.points);
  }

  const rangVon = (ids: readonly string[], wertVon: (id: string) => number | null) => {
    const map = buildSharedRankMap(ids.map((id) => ({ playerId: id, value: wertVon(id) })));
    return { map, von: ids.filter((id) => wertVon(id) != null).length };
  };

  const disziplinen = new Map<string, DisziplinRang>();
  const kaderStaerkeBeste6 = new Map<string, number | null>();
  for (const disziplinId of disziplinIds) {
    const wertVon = (id: string) => {
      const player = playerById.get(id);
      return player ? eignungVon(player, disziplinId) : null;
    };
    const liga = rangVon(ligaIds, wertVon);
    const aktiv = rangVon(aktiveIds, wertVon);
    const kader = rangVon(kaderIds, wertVon);
    const ppMap = ppJeDisziplin.get(disziplinId) ?? new Map<string, number>();
    const ppLiga = rangVon(ligaIds, (id) => (ppMap.has(id) ? Math.round((ppMap.get(id) ?? 0) * 10) / 10 : null));
    const eigenKaderRang = kader.map.get(playerId) ?? null;
    const eignungWert = wertVon(playerId);
    disziplinen.set(disziplinId, {
      disziplinId,
      wert: eignungWert,
      ligaRang: liga.map.get(playerId) ?? null,
      ligaVon: liga.von,
      aktivRang: aktiv.map.get(playerId) ?? null,
      aktivVon: aktiv.von,
      kaderRang: eigenKaderRang,
      kaderVon: kader.von,
      inBesten6: eigenKaderRang != null && eigenKaderRang <= 6,
      freiAktivRang: vertragslos ? hypothetischerRang(eignungWert, aktiveIds, wertVon) : null,
      beiDirRang: vertragslos && betrachterTeamId ? hypothetischerRang(eignungWert, betrachterKader, wertVon) : null,
      beiDirVon: vertragslos && betrachterTeamId && eignungWert != null ? betrachterKader.filter((id) => wertVon(id) != null).length + 1 : 0,
      ppSaison: ppMap.has(playerId) ? Math.round((ppMap.get(playerId) ?? 0) * 10) / 10 : null,
      ppLigaRang: ppLiga.map.get(playerId) ?? null,
      ppLigaVon: ppLiga.von,
    });
    kaderStaerkeBeste6.set(disziplinId, mittelBeste6(kaderIds.map(wertVon)));
  }

  const ppGesamt = rangVon(ligaIds, (id) => (ppGesamtJeSpieler.has(id) ? Math.round((ppGesamtJeSpieler.get(id) ?? 0) * 10) / 10 : null));
  return {
    ligaAktiv: eigeneLiga != null,
    ligaName: eigeneLiga ?? null,
    vertragslos,
    disziplinen,
    ppGesamt: ppGesamtJeSpieler.has(playerId) ? Math.round((ppGesamtJeSpieler.get(playerId) ?? 0) * 10) / 10 : null,
    ppGesamtLigaRang: ppGesamt.map.get(playerId) ?? null,
    ppGesamtLigaVon: ppGesamt.von,
    kaderStaerkeBeste6,
  };
}

/* ------------------------------------------------------------------ Rangzeile der Experten-Karten */

export type RangZeile = { wort: string; wert: string; gross: boolean };

/**
 * Die zwei Ränge, die eine Karte in „Hier ist er stark“ nennt (Chris 19.11.): Rang im Team und Rang in der Liga.
 * - Spieler im Kader: „#N im Kader“ und „Liga #N“ (ohne Liga-Split heißt die ganze Aktivenschaft Liga).
 * - Vertragslos: „bei dir #N“ (Rang im Kader des Betrachters) und „Alle #N“; fehlt ein Rang, entfällt die Angabe.
 * - Nebel: kein exakter Teamrang; die Liga nur als grobe Stufe („obere Gruppe“).
 */
export function baueRangZeilen(rang: DisziplinRang | null | undefined, raenge: Pick<SpielerRaenge, "vertragslos"> | null | undefined, nebel: boolean): RangZeile[] {
  if (!rang || !raenge) return [];
  const zeilen: RangZeile[] = [];
  if (raenge.vertragslos) {
    if (nebel) {
      const stufe = grobeRangStufe(rang.freiAktivRang, rang.aktivVon + 1);
      return stufe ? [{ wort: "Alle", wert: stufe, gross: false }] : [];
    }
    if (rang.beiDirRang != null) zeilen.push({ wort: "bei dir", wert: `#${rang.beiDirRang}`, gross: true });
    if (rang.freiAktivRang != null) zeilen.push({ wort: "Alle", wert: `#${rang.freiAktivRang}`, gross: false });
    return zeilen;
  }
  if (nebel) {
    const stufe = grobeRangStufe(rang.ligaRang, rang.ligaVon);
    return stufe ? [{ wort: "Liga", wert: stufe, gross: false }] : [];
  }
  if (rang.kaderRang != null) zeilen.push({ wort: "im Kader", wert: `#${rang.kaderRang}`, gross: true });
  if (rang.ligaRang != null) zeilen.push({ wort: "Liga", wert: `#${rang.ligaRang}`, gross: false });
  return zeilen;
}

/* ------------------------------------------------------------------ PP je Spieltag */

export type PpSpieltag = {
  matchdayId: string;
  /** Nummer 1..20, soweit aus der Id lesbar. */
  nummer: number | null;
  /** Gebuchte PP je Disziplin an diesem Spieltag (höchstens zwei Disziplinen). */
  eintraege: Array<{ disziplinId: string; seite: "d1" | "d2"; pp: number; rangAmSpieltag: number | null }>;
  summe: number;
};

/** PP-Reihe der laufenden Saison aus dem Ledger: gebuchte Punkte, nicht neu gerechnet (gezeigt = gebucht). */
export function baueMatchdayPpReihe(gameState: GameState, playerId: string): PpSpieltag[] {
  const ledger = buildSeasonPointsLedger(gameState);
  const jeSpieltag = new Map<string, PpSpieltag>();
  for (const eintrag of ledger.pointEntries) {
    if (eintrag.playerId !== playerId || !eintrag.matchdayId) continue;
    const zeile =
      jeSpieltag.get(eintrag.matchdayId) ??
      ({
        matchdayId: eintrag.matchdayId,
        nummer: Number(eintrag.matchdayId.match(/(\d+)/)?.[1] ?? NaN) || null,
        eintraege: [],
        summe: 0,
      } satisfies PpSpieltag);
    zeile.eintraege.push({
      disziplinId: eintrag.disciplineId,
      seite: eintrag.disciplineSide,
      pp: Math.round(eintrag.points * 10) / 10,
      rangAmSpieltag: eintrag.rankInDiscipline ?? null,
    });
    zeile.summe = Math.round((zeile.summe + eintrag.points) * 10) / 10;
    jeSpieltag.set(eintrag.matchdayId, zeile);
  }
  return [...jeSpieltag.values()].sort((a, b) => (a.nummer ?? 0) - (b.nummer ?? 0));
}

/** Ziellinie der PP-Skala (Chris 18.11.: Top-Spieler um 5). Nur Markierung, die Werte sind die gebuchten. */
export const PP_ZIELLINIE = 5;

/* ------------------------------------------------------------------ Experte in */

export type ExperteIn = {
  disziplinId: string;
  label: string;
  achse: AchseId;
  wert: number;
  weg: DisziplinWeg;
};

/** Die besten Disziplinen des Spielers (nach Eignung), mit Primär-/Nebenweg. Im Nebel leer. */
export function bestimmeExperte(
  data: Pick<PlayerDetailDrawerData, "disciplineValues" | "attributeStats" | "attributeVisibility">,
  anzahl = 4,
): ExperteIn[] {
  if (hatNebel(data)) return [];
  const werte = attributWerteAusDaten(data);
  return data.disciplineValues
    .filter((zeile) => zeile.value != null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, anzahl)
    .map((zeile) => ({
      disziplinId: zeile.id,
      label: zeile.label,
      achse: achseVonKategorie(zeile.category),
      wert: zeile.value as number,
      weg: bestimmeWeg(zeile.id, werte),
    }));
}

/** Bestes Wort für „beste Disziplin" (Kulisse der Figur); null im Nebel oder ohne Werte. */
export function besteDisziplinId(data: Pick<PlayerDetailDrawerData, "disciplineValues">): string | null {
  let beste: { id: string; wert: number } | null = null;
  for (const zeile of data.disciplineValues) {
    if (zeile.value == null) continue;
    if (!beste || zeile.value > beste.wert) beste = { id: zeile.id, wert: zeile.value };
  }
  return beste?.id ?? null;
}
