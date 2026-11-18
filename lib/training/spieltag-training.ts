/**
 * TRAINING JE SPIELTAG (Chris, 18.11.) — die Spielmechanik hinter dem Bereich „Entwicklung".
 *
 * Entscheidungen (docs/design/training-modern-18-11.md Abschnitt 7a, Bau und Messung:
 * docs/design/training-je-spieltag-18-11.md):
 *
 *   1. Training wirkt JE SPIELTAG und wird je Spieltag gebucht und getrackt (nicht mehr am Saisonende).
 *   2. Neu gebalanct: Satz je Spieltag `TRAINING_SETPOINTS_JE_SPIELTAG` (training-mode-presentation.ts).
 *   3. Regel A: Ziel-Disziplin + Weg statt Trainingsklasse. Profil aus den drei schwersten Attributen
 *      der Matrix (`official-discipline-weights.ts`, NUR gelesen): der gewaehlte Weg bekommt 60 %, die
 *      beiden anderen 25 % und 15 %. Weg 0 = Primaerweg (Hauptattribut), 1/2 = Nebenweg.
 *      Ziel und Weg sind jederzeit wechselbar; der Wechsel wirkt ab dem naechsten Spieltag, weil jeder
 *      Spieltag sein Ziel beim ersten Buchen festschreibt.
 *   4. Regel B: Verletzte trainieren nicht — kein Zuwachs, keine Trainingslast an Ausfall-Spieltagen.
 *   5. Regel E: Ueberlastung drueckt die Form gering, ueber die bestehende Form-Fortschreibung
 *      (`form-moral-modifikator.ts`, Feld `u` im Form-Verlauf). Die Formkarten bleiben unberuehrt.
 *   6. Kein Alter.
 *
 * Mensch und KI rechnen gleich: Wer kein Ziel gesetzt hat (jeder KI-Spieler, jeder Mensch-Spieler vor
 * seiner ersten Wahl), trainiert auf `kiTrainingsZielVorschlag` — nach Kaderluecke und Wichtigkeit.
 *
 * GEZEIGT = GEBUCHT: Die Buchung (`matchday-training-accumulator.ts`) und die Vorschau
 * (`prognostiziereSpieltagsTraining`) rufen dieselbe Funktion `berechneSpieltagsZuwachs`; der Verlauf
 * speichert genau die Differenz, die auf `attributeSheetStats` aufgeschlagen wurde.
 *
 * Der Motor (Arena-Engine) bleibt unangetastet; der Wertungs-Fingerabdruck verschiebt sich nicht.
 */
import type {
  GameState,
  Player,
  PlayerFormState,
  PlayerGeneratorAttributeName,
  PlayerTrainingsZiel,
  TeamFacilityCollection,
  TrainingsSpieltagEintrag,
} from "@/lib/data/olyDataTypes";
import { getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { getPlayerAvailabilityView } from "@/lib/fatigue/fatigue-injury-service";
import {
  officialDisciplineWeightOrder,
  officialDisciplineWeightTable,
  playerGeneratorAttributeKeys,
  type OfficialDisciplineWeightId,
} from "@/lib/player-generator/official-discipline-weights";
import type { PlayerDevelopmentRouteSuggestion } from "@/lib/progression/player-potential-service";
import { getAttributeHeadroom } from "@/lib/scouting/player-attribute-ceiling-service";
import { resolvePlayerPotentialRecordForProgression } from "@/lib/scouting/player-potential-ceiling-service";
import { buildSeasonDisciplinePlayerCountMap, getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import { PROGRESSION_ATTRIBUTE_ORDER } from "@/lib/training/class-progression-config";
import {
  ATTRIBUTE_FALLBACK_AXIS,
  buildOrganicSeasonProgression,
  didPlayerAttributesFallBackToAxes,
} from "@/lib/training/organic-season-progression";
import { getTrainingSetpointsJeSpieltag } from "@/lib/training/training-mode-presentation";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

import { isTrainingJeSpieltagAktiv, resolveTrainingJeSpieltagFaktor } from "@/lib/training/training-je-spieltag-schalter";

export { isTrainingJeSpieltagAktiv, resolveTrainingJeSpieltagFaktor };

// --- Regel A: Profil aus der Matrix -----------------------------------------------------------

/** Anteile je Weg-Platz: das gewaehlte Attribut 60 %, die beiden anderen 25 % und 15 %. */
export const TRAININGS_WEG_ANTEILE = [0.6, 0.25, 0.15] as const;

export type TrainingsWeg = 0 | 1 | 2;

export type TrainingsProfilEintrag = {
  attribute: PlayerGeneratorAttributeName;
  /** Anteil am Spieltagsbudget (0,6 / 0,25 / 0,15). */
  anteil: number;
  /** Gewicht in der Matrix (nur gelesen). */
  matrixGewicht: number;
};

export function istMatrixDisziplin(disziplinId: string | null | undefined): disziplinId is OfficialDisciplineWeightId {
  return Boolean(disziplinId) && (officialDisciplineWeightOrder as readonly string[]).includes(disziplinId as string);
}

/**
 * Die schwersten Matrix-Attribute einer Disziplin, absteigend. Gleichstand: Reihenfolge der Matrix
 * (`playerGeneratorAttributeKeys`), damit das Ergebnis stabil ist.
 */
export function schwersteMatrixAttribute(
  disziplinId: string,
  anzahl = 3,
): Array<{ attribute: PlayerGeneratorAttributeName; matrixGewicht: number }> {
  if (!istMatrixDisziplin(disziplinId)) return [];
  return playerGeneratorAttributeKeys
    .map((attribute, index) => ({
      attribute: attribute as PlayerGeneratorAttributeName,
      matrixGewicht: officialDisciplineWeightTable[attribute][disziplinId] ?? 0,
      index,
    }))
    .filter((eintrag) => eintrag.matrixGewicht > 0)
    .sort((links, rechts) => rechts.matrixGewicht - links.matrixGewicht || links.index - rechts.index)
    .slice(0, anzahl)
    .map(({ attribute, matrixGewicht }) => ({ attribute, matrixGewicht }));
}

/**
 * Trainingsprofil fuer Ziel-Disziplin + Weg. Der gewaehlte Weg-Platz bekommt 60 %, die beiden
 * anderen in Matrix-Reihenfolge 25 % und 15 %. Hat eine Disziplin weniger als drei Attribute mit
 * Gewicht, werden die Anteile auf die vorhandenen normiert. Unbekannte Disziplin: leeres Profil.
 */
export function trainingsProfilFuerZiel(ziel: Pick<PlayerTrainingsZiel, "disziplinId" | "weg">): TrainingsProfilEintrag[] {
  const top = schwersteMatrixAttribute(ziel.disziplinId, 3);
  if (top.length === 0) return [];
  const weg = Math.min(Math.max(0, Math.floor(ziel.weg ?? 0)), top.length - 1);
  const reihenfolge = [top[weg]!, ...top.filter((_, index) => index !== weg)];
  const anteile = TRAININGS_WEG_ANTEILE.slice(0, reihenfolge.length);
  const summe = anteile.reduce((a, b) => a + b, 0);
  return reihenfolge.map((eintrag, index) => ({
    attribute: eintrag.attribute,
    anteil: Number((anteile[index]! / summe).toFixed(4)),
    matrixGewicht: eintrag.matrixGewicht,
  }));
}

export type TrainingsWegOption = {
  weg: TrainingsWeg;
  art: "primaer" | "neben";
  hauptAttribut: PlayerGeneratorAttributeName;
  profil: TrainingsProfilEintrag[];
};

/** Alle waehlbaren Wege einer Disziplin (Primaerweg und bis zu zwei Nebenwege). */
export function wegeFuerDisziplin(disziplinId: string): TrainingsWegOption[] {
  const top = schwersteMatrixAttribute(disziplinId, 3);
  return top.map((eintrag, index) => ({
    weg: index as TrainingsWeg,
    art: index === 0 ? "primaer" : "neben",
    hauptAttribut: eintrag.attribute,
    profil: trainingsProfilFuerZiel({ disziplinId, weg: index as TrainingsWeg }),
  }));
}

function profilAlsGewichte(profil: TrainingsProfilEintrag[]): Partial<Record<PlayerGeneratorAttributeName, number>> {
  return Object.fromEntries(profil.map((eintrag) => [eintrag.attribute, eintrag.anteil]));
}

const ACHSE_ZU_ROUTE: Record<"pow" | "spe" | "men" | "soc", PlayerDevelopmentRouteSuggestion> = {
  pow: "POW",
  spe: "SPE",
  men: "MEN",
  soc: "SOC",
};

/** Fokusachsen-Route des Profils: die Achse des 60-%-Attributs (wie im Mockup „passt zur Fokusachse"). */
export function routeFuerProfil(profil: TrainingsProfilEintrag[]): PlayerDevelopmentRouteSuggestion | null {
  const haupt = profil[0]?.attribute;
  return haupt ? ACHSE_ZU_ROUTE[ATTRIBUTE_FALLBACK_AXIS[haupt]] : null;
}

// --- Zuwachs eines Spieltags (eine Rechnung fuer Buchung und Vorschau) -----------------------

export type SpieltagsZuwachs = {
  ziel: PlayerTrainingsZiel;
  quelle: "manager" | "ki";
  modus: PlayerTrainingMode;
  profil: TrainingsProfilEintrag[];
  /** Grundbudget dieses Spieltags (Satz je Spieltag), vor den Multiplikatoren. */
  grundbudget: number;
  /** Budget nach Trait, Potenzial, Fokusachse, Trainingszentrum, Akademie. */
  budget: number;
  /** Gebuchter Zuwachs je Attribut (nach Decke; Fokus + Spillover), nur Werte > 0. */
  zuwachs: Partial<Record<PlayerGeneratorAttributeName, number>>;
  /** Davon Spillover (Nebeneffekt) je Attribut. */
  nebeneffekt: Partial<Record<PlayerGeneratorAttributeName, number>>;
  summe: number;
  /** Attribute, an denen die Decke bremst (Zustand "capped" oder "closing"). */
  deckeBremst: PlayerGeneratorAttributeName[];
};

function normalizeMode(mode: Player["trainingMode"]): PlayerTrainingMode {
  return mode === "leicht" || mode === "mittel" || mode === "hart" ? mode : "mittel";
}

function rund(wert: number, stellen = 3) {
  return Number(wert.toFixed(stellen));
}

/** Hat der Spieler einen vollstaendigen Attributbogen? Ohne ihn wird nichts gebucht (keine erfundenen Werte). */
export function hatVollenAttributbogen(player: Player): boolean {
  return !didPlayerAttributesFallBackToAxes(player);
}

/**
 * Zuwachs EINES Spieltags fuer einen Spieler — dieselbe Engine wie die Saisonend-Progression
 * (`buildOrganicSeasonProgression`, Trainingsanteil allein), mit dem Profil aus Regel A statt der
 * Klasse und dem Satz je Spieltag als Budget. Gibt `null`, wenn der Spieler keinen vollen
 * Attributbogen hat oder die Ziel-Disziplin unbekannt ist.
 */
export function berechneSpieltagsZuwachs(input: {
  gameState: GameState;
  player: Player;
  ziel: PlayerTrainingsZiel;
  quelle: "manager" | "ki";
  modus?: PlayerTrainingMode;
  facilities?: TeamFacilityCollection | null;
}): SpieltagsZuwachs | null {
  if (!hatVollenAttributbogen(input.player)) return null;
  const profil = trainingsProfilFuerZiel(input.ziel);
  if (profil.length === 0) return null;
  const modus = input.modus ?? normalizeMode(input.player.trainingMode);
  const grundbudget = getTrainingSetpointsJeSpieltag(modus);
  const teamId = input.gameState.rosters.find((eintrag) => eintrag.playerId === input.player.id)?.teamId ?? null;
  const facilities = input.facilities ?? (teamId ? getTeamFacilityState(input.gameState, teamId) : null);
  const ergebnis = buildOrganicSeasonProgression({
    gameState: input.gameState,
    player: input.player,
    facilities,
    accumulatedBaseTrainingBudget: grundbudget,
    trainingProfileOverride: profilAlsGewichte(profil),
    trainingRouteOverride: routeFuerProfil(profil),
    nurTraining: true,
  });
  const zuwachs: Partial<Record<PlayerGeneratorAttributeName, number>> = {};
  const nebeneffekt: Partial<Record<PlayerGeneratorAttributeName, number>> = {};
  const deckeBremst: PlayerGeneratorAttributeName[] = [];
  const record = resolvePlayerPotentialRecordForProgression({ gameState: input.gameState, player: input.player });
  for (const zeile of ergebnis.attributeBreakdown) {
    const delta = rund(zeile.after - zeile.before);
    if (delta > 0) zuwachs[zeile.attribute] = delta;
    if (zeile.spillover > 0 && delta > 0) nebeneffekt[zeile.attribute] = rund(Math.min(delta, zeile.spillover));
  }
  for (const eintrag of profil) {
    const zustand = getAttributeHeadroom({ player: input.player, attribute: eintrag.attribute, record }).state;
    if (zustand !== "open") deckeBremst.push(eintrag.attribute);
  }
  return {
    ziel: input.ziel,
    quelle: input.quelle,
    modus,
    profil,
    grundbudget: rund(grundbudget, 4),
    budget: rund(ergebnis.trainingSetpoints, 4),
    zuwachs,
    nebeneffekt,
    summe: rund(Object.values(zuwachs).reduce((a, b) => a + (b ?? 0), 0)),
    deckeBremst,
  };
}

// --- KI-Vorschlag: Ziel nach Kaderluecke und Wichtigkeit -------------------------------------

export type TrainingsZielKontext = {
  gameState: GameState;
  /** Spieltag, NACH dem trainiert wird (zaehlt nicht mehr zu den offenen Auftritten). */
  matchdayId?: string | null;
  slotsJeDisziplin: Map<string, number>;
  offeneAuftritte: Map<string, number>;
  /** Liga-Median der Top-k-Eignung je Disziplin. */
  ligaMedianTopK: Map<string, number>;
  /** Team-Id -> Disziplin -> absteigend sortierte Eignungen der einsatzfaehigen Spieler. */
  teamEignungen: Map<string, Map<string, Array<{ playerId: string; wert: number }>>>;
  ausfall: Set<string>;
  /** Cache: abgestimmte Ziele je Team (siehe `teamZuweisung`). */
  teamZuweisungen?: Map<string, Map<string, PlayerTrainingsZiel>>;
};

function eignung(player: Player, disziplinId: string): number {
  const wert = player.disciplineRatings?.[disziplinId];
  return typeof wert === "number" && Number.isFinite(wert) ? wert : 0;
}

/**
 * Ligaweiter Kontext fuer den KI-Vorschlag, einmal je Buchung gebaut (alle Teams auf einmal, billig).
 */
export function baueTrainingsZielKontext(gameState: GameState, matchdayId?: string | null, ausfall?: Set<string>): TrainingsZielKontext {
  const disziplinen = (gameState.disciplines ?? []).map((eintrag) => eintrag.id).filter(istMatrixDisziplin);
  const mitSpielplan = Boolean(gameState.seasonState);
  const slotMap = mitSpielplan ? buildSeasonDisciplinePlayerCountMap(gameState) : new Map<string, number | null>();
  const slotsJeDisziplin = new Map<string, number>();
  for (const id of disziplinen) slotsJeDisziplin.set(id, Math.max(1, slotMap.get(id) ?? 2));

  const ids = gameState.season.matchdayIds ?? [];
  const abIndex = matchdayId ? ids.indexOf(matchdayId) : -1;
  const offeneAuftritte = new Map<string, number>();
  for (const eintrag of mitSpielplan ? getSeasonDisciplineSchedule(gameState) : []) {
    const index = ids.indexOf(eintrag.matchdayId);
    if (index >= 0 && index <= abIndex) continue;
    for (const slot of [eintrag.discipline1, eintrag.discipline2]) {
      if (slot?.disciplineId) offeneAuftritte.set(slot.disciplineId, (offeneAuftritte.get(slot.disciplineId) ?? 0) + 1);
    }
  }

  const spieler = new Map(gameState.players.map((p) => [p.id, p] as const));
  const ausfallSet = ausfall ?? new Set<string>();
  const kaderJeTeam = new Map<string, Player[]>();
  for (const eintrag of gameState.rosters) {
    const p = spieler.get(eintrag.playerId);
    if (!p) continue;
    (kaderJeTeam.get(eintrag.teamId) ?? kaderJeTeam.set(eintrag.teamId, []).get(eintrag.teamId)!).push(p);
  }
  const teamEignungen = new Map<string, Map<string, Array<{ playerId: string; wert: number }>>>();
  const topKJeDisziplin = new Map<string, number[]>();
  for (const [teamId, kader] of kaderJeTeam) {
    const jeDisziplin = new Map<string, Array<{ playerId: string; wert: number }>>();
    for (const d of disziplinen) {
      const liste = kader
        .filter((p) => !ausfallSet.has(p.id))
        .map((p) => ({ playerId: p.id, wert: eignung(p, d) }))
        .sort((a, b) => b.wert - a.wert || a.playerId.localeCompare(b.playerId));
      jeDisziplin.set(d, liste);
      const k = slotsJeDisziplin.get(d) ?? 2;
      const top = liste.slice(0, k);
      const mittel = top.length > 0 ? top.reduce((s, e) => s + e.wert, 0) / k : 0;
      (topKJeDisziplin.get(d) ?? topKJeDisziplin.set(d, []).get(d)!).push(mittel);
    }
    teamEignungen.set(teamId, jeDisziplin);
  }
  const ligaMedianTopK = new Map<string, number>();
  for (const [d, werte] of topKJeDisziplin) {
    const sortiert = [...werte].sort((a, b) => a - b);
    ligaMedianTopK.set(d, sortiert.length > 0 ? sortiert[Math.floor(sortiert.length / 2)]! : 0);
  }
  return { gameState, matchdayId: matchdayId ?? null, slotsJeDisziplin, offeneAuftritte, ligaMedianTopK, teamEignungen, ausfall: ausfallSet };
}

export type TrainingsZielBewertung = {
  disziplinId: string;
  weg: TrainingsWeg;
  punkte: number;
  /** Platz des Spielers im eigenen Kader in dieser Disziplin (1 = bester). */
  kaderRang: number;
  slots: number;
  offeneAuftritte: number;
  /** Luecke des Teams gegen den Liga-Median (Eignungspunkte, >= 0). */
  luecke: number;
  begruendung: "stammplatz_halten" | "an_der_schwelle" | "luecke_schliessen" | "ausbauen";
};

const HEADROOM_FAKTOR: Record<"open" | "closing" | "capped", number> = { open: 1, closing: 0.6, capped: 0.15 };

/**
 * Bewertung aller Disziplinen fuer einen Spieler, beste zuerst. Regeln in Klartext (fuer die Oberflaeche):
 *  1. Wichtigkeit: wie oft die Disziplin in dieser Saison noch drankommt (nach diesem Spieltag, gedaempft
 *     mit der Wurzel). Kommt sie
 *     nicht mehr dran, zaehlt sie nur noch ein Viertel (sie zahlt dann erst naechste Saison ein).
 *  2. Kaderluecke: liegt das Team in der Disziplin unter dem Liga-Median (Mittel der Startplaetze), zaehlt
 *     sie bis zu doppelt.
 *  3. Schwelle: am meisten bringt Training dort, wo der Spieler knapp ausserhalb der Startplaetze steht
 *     oder seinen Platz nur knapp haelt; wer weit weg ist, bekommt wenig.
 *  4. Hebel und Decke: zaehlt, wie viel Eignung ein Trainingspunkt bringt (Matrixgewicht der trainierten
 *     Attribute) und ob die Attribute noch Platz bis zur Decke haben. Steht das 60-%-Attribut an der
 *     Decke, gewinnt ein Nebenweg.
 *  5. Verteilung im Kader (`kiTrainingsZielVorschlag`): je Disziplin teilen sich die Spieler eines Teams
 *     den Nutzen — jeder weitere auf dieselbe Disziplin zaehlt weniger (Plaetze sind begrenzt).
 */
export function bewerteTrainingsZiele(kontext: TrainingsZielKontext, player: Player): TrainingsZielBewertung[] {
  const teamId = kontext.gameState.rosters.find((eintrag) => eintrag.playerId === player.id)?.teamId ?? null;
  const teamListe = teamId ? kontext.teamEignungen.get(teamId) : null;
  if (!teamListe) return [];
  const record = resolvePlayerPotentialRecordForProgression({ gameState: kontext.gameState, player });
  const headroomCache = new Map<PlayerGeneratorAttributeName, number>();
  const headroomVon = (attribute: PlayerGeneratorAttributeName) => {
    const vorhanden = headroomCache.get(attribute);
    if (vorhanden != null) return vorhanden;
    const faktor = HEADROOM_FAKTOR[getAttributeHeadroom({ player, attribute, record }).state];
    headroomCache.set(attribute, faktor);
    return faktor;
  };
  const ergebnis: TrainingsZielBewertung[] = [];
  for (const [disziplinId, liste] of teamListe) {
    const slots = kontext.slotsJeDisziplin.get(disziplinId) ?? 2;
    const eigener = eignung(player, disziplinId);
    const rangIndex = liste.findIndex((e) => e.playerId === player.id);
    const kaderRang = rangIndex >= 0 ? rangIndex + 1 : liste.filter((e) => e.wert > eigener).length + 1;
    let schwelle: number;
    let begruendung: TrainingsZielBewertung["begruendung"];
    if (kaderRang <= slots) {
      const ersterDraussen = liste[slots]?.wert ?? 0;
      const vorsprung = Math.max(0, eigener - ersterDraussen);
      schwelle = 0.45 + 0.55 / (1 + vorsprung / 3);
      begruendung = vorsprung < 3 ? "stammplatz_halten" : "ausbauen";
    } else {
      const letzterDrin = liste[slots - 1]?.wert ?? eigener;
      const abstand = Math.max(0, letzterDrin - eigener);
      schwelle = 1.1 / (1 + abstand / 3);
      begruendung = abstand < 4 ? "an_der_schwelle" : "ausbauen";
    }
    const top = liste.slice(0, slots);
    const teamTopK = top.length > 0 ? top.reduce((s, e) => s + e.wert, 0) / slots : 0;
    const luecke = Math.max(0, (kontext.ligaMedianTopK.get(disziplinId) ?? teamTopK) - teamTopK);
    const lueckeFaktor = 1 + Math.min(1, luecke / 8);
    if (luecke >= 2 && begruendung === "ausbauen") begruendung = "luecke_schliessen";
    const offen = kontext.offeneAuftritte.get(disziplinId) ?? 0;
    // Wurzel: ein schon einmal gespielter Termin halbiert den Wert nicht (sonst springt die KI nach jedem Auftritt).
    const wichtigkeit = offen > 0 ? Math.sqrt(offen) : 0.25;
    const wege = wegeFuerDisziplin(disziplinId);
    let besterWeg: TrainingsWeg = 0;
    let besterWegFaktor = -1;
    for (const option of wege) {
      // Hebel eines Weges: Anteil x Decken-Spielraum x Matrixgewicht je Profil-Attribut (Eignung je Trainingspunkt).
      const faktor = option.profil.reduce(
        (summe, eintrag) => summe + eintrag.anteil * headroomVon(eintrag.attribute) * eintrag.matrixGewicht,
        0,
      );
      // Primaerweg bei Gleichstand bevorzugt (kleiner Vorsprung noetig fuer einen Nebenweg).
      const bewertet = option.weg === 0 ? faktor * 1.05 : faktor;
      if (bewertet > besterWegFaktor) {
        besterWegFaktor = bewertet;
        besterWeg = option.weg;
      }
    }
    const punkte = (wichtigkeit * lueckeFaktor * schwelle * Math.max(0, besterWegFaktor)) / 20;
    ergebnis.push({ disziplinId, weg: besterWeg, punkte: rund(punkte, 4), kaderRang, slots, offeneAuftritte: offen, luecke: rund(luecke, 2), begruendung });
  }
  return ergebnis.sort((a, b) => b.punkte - a.punkte || a.disziplinId.localeCompare(b.disziplinId));
}

/** Haltekraft: das bisherige Ziel zaehlt so viel mehr (sonst springt die KI jede Woche). */
export const KI_ZIEL_WECHSEL_VORSPRUNG = 1.5;

/** Jeder weitere Spieler eines Teams auf derselben Disziplin zaehlt `1 / (1 + bisher / Plaetze)`. */
function kaderTeilung(bisher: number, slots: number) {
  return 1 / (1 + bisher / Math.max(1, slots));
}

/**
 * Ziele fuer alle Spieler eines Teams auf einmal (gierig, deterministisch): wer den groessten Nutzen hat,
 * waehlt zuerst; jede Disziplin wird mit jedem weiteren Spieler weniger attraktiv (Regel 5). Vom Manager
 * gesetzte Ziele belegen ihre Disziplin, werden aber nicht veraendert. Das bisherige Ziel eines Spielers
 * (letzter Trainings-Spieltag dieser Saison) zaehlt `KI_ZIEL_WECHSEL_VORSPRUNG`-fach.
 */
function teamZuweisung(kontext: TrainingsZielKontext, teamId: string): Map<string, PlayerTrainingsZiel> {
  const cache = (kontext.teamZuweisungen ??= new Map());
  const vorhanden = cache.get(teamId);
  if (vorhanden) return vorhanden;
  const spieler = new Map(kontext.gameState.players.map((p) => [p.id, p] as const));
  const kader = kontext.gameState.rosters
    .filter((r) => r.teamId === teamId)
    .map((r) => spieler.get(r.playerId))
    .filter((p): p is Player => Boolean(p));
  const belegt = new Map<string, number>();
  const offen: Array<{ player: Player; bewertungen: TrainingsZielBewertung[]; bisher: string | null }> = [];
  for (const player of kader) {
    const gesetzt = gesetztesTrainingsZiel(player);
    if (gesetzt) {
      belegt.set(gesetzt.disziplinId, (belegt.get(gesetzt.disziplinId) ?? 0) + 1);
      continue;
    }
    offen.push({
      player,
      bewertungen: bewerteTrainingsZiele(kontext, player),
      bisher: letzterTrainierterEintrag(player, kontext.gameState.season.id)?.d ?? null,
    });
  }
  offen.sort(
    (a, b) => (b.bewertungen[0]?.punkte ?? 0) - (a.bewertungen[0]?.punkte ?? 0) || a.player.id.localeCompare(b.player.id),
  );
  const ergebnis = new Map<string, PlayerTrainingsZiel>();
  for (const eintrag of offen) {
    let beste: TrainingsZielBewertung | null = null;
    let besteWert = -1;
    for (const b of eintrag.bewertungen) {
      const wert =
        b.punkte * kaderTeilung(belegt.get(b.disziplinId) ?? 0, b.slots) * (b.disziplinId === eintrag.bisher ? KI_ZIEL_WECHSEL_VORSPRUNG : 1);
      if (wert > besteWert) {
        besteWert = wert;
        beste = b;
      }
    }
    if (!beste) continue;
    belegt.set(beste.disziplinId, (belegt.get(beste.disziplinId) ?? 0) + 1);
    ergebnis.set(eintrag.player.id, { disziplinId: beste.disziplinId, weg: beste.weg });
  }
  cache.set(teamId, ergebnis);
  return ergebnis;
}

/**
 * Vorschlag der KI-Logik fuer Ziel-Disziplin + Weg (fuer KI-Spieler und fuer Mensch-Spieler ohne gesetztes
 * Ziel). Im Kader abgestimmt (`teamZuweisung`); ein Spieler ausserhalb eines Kaders bekommt seine beste
 * Einzelbewertung.
 */
export function kiTrainingsZielVorschlag(kontext: TrainingsZielKontext, player: Player): PlayerTrainingsZiel | null {
  const teamId = kontext.gameState.rosters.find((eintrag) => eintrag.playerId === player.id)?.teamId ?? null;
  const ausTeam = teamId ? teamZuweisung(kontext, teamId).get(player.id) : undefined;
  if (ausTeam) return ausTeam;
  const beste = bewerteTrainingsZiele(kontext, player)[0];
  return beste ? { disziplinId: beste.disziplinId, weg: beste.weg } : null;
}

function letzterTrainierterEintrag(player: Player, seasonId: string): TrainingsSpieltagEintrag | null {
  const akku = player.seasonTrainingAccumulator;
  if (!akku || akku.seasonId !== seasonId) return null;
  const verlauf = akku.verlauf ?? [];
  for (let i = verlauf.length - 1; i >= 0; i -= 1) {
    if (verlauf[i]!.s === "t") return verlauf[i]!;
  }
  return null;
}

/** Gueltiges, vom Manager gesetztes Ziel oder `null`. */
export function gesetztesTrainingsZiel(player: Player): PlayerTrainingsZiel | null {
  const ziel = player.trainingsZiel;
  if (!ziel || !istMatrixDisziplin(ziel.disziplinId)) return null;
  const wege = schwersteMatrixAttribute(ziel.disziplinId, 3).length;
  const weg = Math.floor(Number(ziel.weg));
  if (!Number.isFinite(weg) || weg < 0 || weg >= wege) return null;
  return { disziplinId: ziel.disziplinId, weg: weg as TrainingsWeg, ...(ziel.gesetztAm ? { gesetztAm: ziel.gesetztAm } : {}) };
}

/** Ziel, auf das der Spieler am naechsten Spieltag trainiert: gesetzt (Manager) oder KI-Vorschlag. */
export function bestimmeTrainingsZiel(
  kontext: TrainingsZielKontext,
  player: Player,
): { ziel: PlayerTrainingsZiel; quelle: "manager" | "ki" } | null {
  const gesetzt = gesetztesTrainingsZiel(player);
  if (gesetzt) return { ziel: gesetzt, quelle: "manager" };
  const vorschlag = kiTrainingsZielVorschlag(kontext, player);
  return vorschlag ? { ziel: vorschlag, quelle: "ki" } : null;
}

// --- Regel B: wer an diesem Spieltag ausfaellt -------------------------------------------------

/**
 * Spieler, die an `matchdayId` verletzungsbedingt NICHT einsatzfaehig sind (Ausfall-Spieltag). Muss auf
 * dem Stand VOR der Fatigue-/Verletzungsbuchung dieses Spieltags gefragt werden: danach steht ein
 * Spieler am letzten Sperr-Spieltag schon auf "recovering". Wer sich AN diesem Spieltag verletzt, hat
 * an ihm noch gespielt und trainiert (die Sperre beginnt am Folge-Spieltag).
 */
export function bestimmeAusfallSpielerFuerSpieltag(gameState: GameState, matchdayId: string): Set<string> {
  const ausfall = new Set<string>();
  for (const eintrag of gameState.seasonState?.playerAvailabilityState ?? []) {
    if (eintrag.injuryStatus !== "injured") continue;
    const sicht = getPlayerAvailabilityView(gameState, eintrag.playerId, eintrag.teamId, matchdayId, {
      matchdayBookkeeping: true,
    });
    if (sicht.isUnavailable) ausfall.add(eintrag.playerId);
  }
  return ausfall;
}

// --- Regel E: Ueberlastung -> Form ------------------------------------------------------------

/**
 * Schwellen der Gesamtbelastung (Match + Training), dieselben Zonen wie im Mockup und in der Risikokurve:
 * ab 50 „ueberlastet" (Verletzungsrisiko steigt steil), ab 80 „am Limit".
 */
export const UEBERLASTUNG_SCHWELLE = 50;
export const UEBERLASTUNG_LIMIT = 80;
/** Abzug in Form-Punkten (0..100-Skala, eine Form-Stufe = 15 Punkte). Leicht trainieren schont: kein Abzug. */
export const UEBERLASTUNG_ABZUG: Record<PlayerTrainingMode, { ueberlastet: number; amLimit: number }> = {
  leicht: { ueberlastet: 0, amLimit: 0 },
  mittel: { ueberlastet: 1, amLimit: 2 },
  hart: { ueberlastet: 2, amLimit: 3 },
};

/** Abzug (Punkte >= 0) fuer einen Spieler, der an diesem Spieltag mit `modus` trainiert hat. */
export function ueberlastungsAbzug(modus: PlayerTrainingMode, gesamtBelastung: number): number {
  if (!Number.isFinite(gesamtBelastung) || gesamtBelastung < UEBERLASTUNG_SCHWELLE) return 0;
  const stufe = UEBERLASTUNG_ABZUG[modus] ?? UEBERLASTUNG_ABZUG.mittel;
  return gesamtBelastung >= UEBERLASTUNG_LIMIT ? stufe.amLimit : stufe.ueberlastet;
}

/**
 * Abzuege fuer den soeben abgerechneten Spieltag: nur wer an ihm trainiert hat (Verlaufseintrag `s: "t"`).
 * Gesamtbelastung = `player.fatigue` (zwischen den Spieltagen Konto + Trainingsschicht). Leer, wenn der
 * Schalter aus ist.
 */
export function ueberlastungsAbzuegeFuerSpieltag(gameState: GameState, matchdayId: string): Map<string, number> {
  const abzuege = new Map<string, number>();
  if (!isTrainingJeSpieltagAktiv()) return abzuege;
  const seasonId = gameState.season.id;
  const imKader = new Set(gameState.rosters.map((eintrag) => eintrag.playerId));
  for (const player of gameState.players) {
    if (!imKader.has(player.id)) continue;
    const akku = player.seasonTrainingAccumulator;
    if (!akku || akku.seasonId !== seasonId) continue;
    const eintrag = (akku.verlauf ?? []).find((e) => e.m === matchdayId);
    if (!eintrag || eintrag.s !== "t") continue;
    const punkte = ueberlastungsAbzug(eintrag.i ?? normalizeMode(player.trainingMode), player.fatigue ?? 0);
    if (punkte > 0) abzuege.set(player.id, punkte);
  }
  return abzuege;
}

// --- Datenschnittstelle fuer die Oberflaeche --------------------------------------------------

export type TrainingsVerlaufZeile = {
  matchdayId: string;
  /** 1-basierter Spieltag in der Saison (aus `season.matchdayIds`), `null` wenn unbekannt. */
  spieltag: number | null;
  status: "trainiert" | "verletzt";
  disziplinId: string | null;
  weg: TrainingsWeg | null;
  quelle: "manager" | "ki" | null;
  modus: PlayerTrainingMode | null;
  /** Gebuchter Zuwachs je Attribut (genau das, was auf die Attribute aufgeschlagen wurde). */
  zuwachs: Partial<Record<PlayerGeneratorAttributeName, number>>;
  summe: number;
  /** Trainingslast dieses Spieltags (Fatigue-Punkte). */
  last: number;
  /** Formabzug durch Ueberlastung (Punkte > 0), aus dem Form-Verlauf, sonst 0. */
  formAbzug: number;
  /** Begruendung fuer die Anzeige, z. B. „−3 Überlastung". */
  formAbzugText: string | null;
};

/**
 * Trainingsverlauf je Spieltag der laufenden (oder angegebenen) Saison, aelteste zuerst — die Quelle
 * fuer die Verlaufskurve der Oberflaeche. Liest nur Gebuchtes: Zuwachs aus dem Trainingsverlauf, den
 * Formabzug aus dem Form-Verlauf (`playerFormState[].verlauf[].u`).
 */
export function entpackeTrainingsVerlauf(gameState: GameState, playerId: string): TrainingsVerlaufZeile[] {
  const player = gameState.players.find((p) => p.id === playerId);
  const akku = player?.seasonTrainingAccumulator;
  if (!player || !akku || akku.seasonId !== gameState.season.id) return [];
  const ids = gameState.season.matchdayIds ?? [];
  const formZeile = (gameState.playerFormState ?? []).find((z: PlayerFormState) => z.playerId === playerId);
  const formAbzugJeSpieltag = new Map<string, number>();
  if (formZeile && formZeile.lastSeasonId === gameState.season.id) {
    for (const e of formZeile.verlauf ?? []) if (e.u) formAbzugJeSpieltag.set(e.m, e.u);
  }
  return (akku.verlauf ?? []).map((e) => {
    const zuwachs = { ...(e.z ?? {}) };
    const formAbzug = formAbzugJeSpieltag.get(e.m) ?? 0;
    const index = ids.indexOf(e.m);
    return {
      matchdayId: e.m,
      spieltag: index >= 0 ? index + 1 : null,
      status: e.s === "v" ? "verletzt" : "trainiert",
      disziplinId: e.d ?? null,
      weg: e.w ?? null,
      quelle: e.q === "m" ? "manager" : e.q === "k" ? "ki" : null,
      modus: e.i ?? null,
      zuwachs,
      summe: rund(Object.values(zuwachs).reduce((a, b) => a + (b ?? 0), 0)),
      last: e.l ?? 0,
      formAbzug,
      formAbzugText: formAbzug > 0 ? `−${formAbzug} Überlastung` : null,
    } satisfies TrainingsVerlaufZeile;
  });
}

export type TrainingsSaisonSumme = {
  spieltageTrainiert: number;
  spieltageVerletzt: number;
  zuwachsJeAttribut: Partial<Record<PlayerGeneratorAttributeName, number>>;
  summe: number;
  /** Groesster Zuwachs in einem Attribut (der Schwerpunkt). */
  schwerpunkt: { attribute: PlayerGeneratorAttributeName; zuwachs: number } | null;
  formAbzugGesamt: number;
  lastGesamt: number;
};

/** Saisonsumme aus dem Verlauf (exakt die Summe der gebuchten Spieltage). */
export function trainingsSaisonSumme(gameState: GameState, playerId: string): TrainingsSaisonSumme {
  const zeilen = entpackeTrainingsVerlauf(gameState, playerId);
  const zuwachsJeAttribut: Partial<Record<PlayerGeneratorAttributeName, number>> = {};
  let formAbzugGesamt = 0;
  let lastGesamt = 0;
  for (const z of zeilen) {
    for (const [attribute, wert] of Object.entries(z.zuwachs) as Array<[PlayerGeneratorAttributeName, number]>) {
      zuwachsJeAttribut[attribute] = rund((zuwachsJeAttribut[attribute] ?? 0) + wert);
    }
    formAbzugGesamt += z.formAbzug;
    lastGesamt += z.last;
  }
  let schwerpunkt: TrainingsSaisonSumme["schwerpunkt"] = null;
  for (const [attribute, wert] of Object.entries(zuwachsJeAttribut) as Array<[PlayerGeneratorAttributeName, number]>) {
    if (!schwerpunkt || wert > schwerpunkt.zuwachs) schwerpunkt = { attribute, zuwachs: wert };
  }
  return {
    spieltageTrainiert: zeilen.filter((z) => z.status === "trainiert").length,
    spieltageVerletzt: zeilen.filter((z) => z.status === "verletzt").length,
    zuwachsJeAttribut,
    summe: rund(Object.values(zuwachsJeAttribut).reduce((a, b) => a + (b ?? 0), 0)),
    schwerpunkt,
    formAbzugGesamt: rund(formAbzugGesamt, 1),
    lastGesamt: rund(lastGesamt, 2),
  };
}

/**
 * Vorschau fuer den naechsten Spieltag (Plan-Editor „bisher -> mit dieser Aenderung"): dieselbe Rechnung
 * wie die Buchung. Ohne `ziel` gilt das gesetzte bzw. der KI-Vorschlag, ohne `modus` der aktuelle Modus.
 * `verletzt: true` heisst: am naechsten Spieltag gesperrt, also kein Zuwachs.
 */
export function prognostiziereSpieltagsTraining(input: {
  gameState: GameState;
  playerId: string;
  ziel?: PlayerTrainingsZiel | null;
  modus?: PlayerTrainingMode;
  kontext?: TrainingsZielKontext;
}): (SpieltagsZuwachs & { verletzt: false }) | { verletzt: true; ziel: PlayerTrainingsZiel | null } | null {
  const player = input.gameState.players.find((p) => p.id === input.playerId);
  if (!player) return null;
  const naechster = input.gameState.matchdayState?.matchdayId ?? null;
  const ausfall = naechster ? bestimmeAusfallSpielerFuerSpieltag(input.gameState, naechster) : new Set<string>();
  const kontext = input.kontext ?? baueTrainingsZielKontext(input.gameState, naechster, ausfall);
  const bestimmt = input.ziel ? { ziel: input.ziel, quelle: "manager" as const } : bestimmeTrainingsZiel(kontext, player);
  if (ausfall.has(player.id)) return { verletzt: true, ziel: bestimmt?.ziel ?? null };
  if (!bestimmt) return null;
  const zuwachs = berechneSpieltagsZuwachs({
    gameState: input.gameState,
    player,
    ziel: bestimmt.ziel,
    quelle: bestimmt.quelle,
    modus: input.modus,
  });
  return zuwachs ? { ...zuwachs, verletzt: false } : null;
}

/**
 * Ziel-Disziplin + Weg setzen (Mensch). `null` loescht das Ziel (dann gilt der KI-Vorschlag). Wirkt ab dem
 * naechsten Spieltag: ein schon gebuchter Spieltag behaelt sein Ziel. Wirft bei ungueltigem Ziel.
 */
export function setzeTrainingsZiel(
  gameState: GameState,
  playerId: string,
  ziel: { disziplinId: string; weg: number } | null,
  jetzt: string = new Date().toISOString(),
): GameState {
  let neu: PlayerTrainingsZiel | null = null;
  if (ziel) {
    if (!istMatrixDisziplin(ziel.disziplinId)) throw new Error(`trainingsziel_disziplin_unbekannt:${ziel.disziplinId}`);
    const wege = schwersteMatrixAttribute(ziel.disziplinId, 3).length;
    const weg = Math.floor(Number(ziel.weg));
    if (!Number.isFinite(weg) || weg < 0 || weg >= wege) throw new Error(`trainingsziel_weg_ungueltig:${ziel.weg}`);
    neu = { disziplinId: ziel.disziplinId, weg: weg as TrainingsWeg, gesetztAm: jetzt };
  }
  let gefunden = false;
  const players = gameState.players.map((p) => {
    if (p.id !== playerId) return p;
    gefunden = true;
    return { ...p, trainingsZiel: neu };
  });
  if (!gefunden) throw new Error(`trainingsziel_spieler_unbekannt:${playerId}`);
  return { ...gameState, players };
}

export { PROGRESSION_ATTRIBUTE_ORDER as TRAININGS_ATTRIBUT_REIHENFOLGE };
