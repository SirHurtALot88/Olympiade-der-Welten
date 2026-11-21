/**
 * ENTWICKLUNG / TRAINING NEU (21.11.) — die reine Datenseite der Seite. Vorlage: public/mockups/training-modern-18-11.html,
 * Doku: docs/design/training-modern-18-11.md. React-frei, damit Station, Risiko, Sortierung und Disziplinkarten ohne
 * Rendering prüfbar sind.
 *
 * Nichts hier erfindet Spielwerte: Ziel/Weg kommen aus `bestimmeTrainingsZiel` (gesetzt oder KI-Vorschlag), Ausfall aus
 * `bestimmeAusfallSpielerFuerSpieltag`, Eignung aus `player.disciplineRatings`, offene Auftritte aus dem Spielplan.
 * Fehlt eine Quelle, kommt `null` und die Ansicht blendet aus.
 */
import type { GameState, Player, PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";
import type { TrainingPlayerRowView } from "@/app/foundation/training-facilities-v2/training-view-types";
import { getInjuryRiskPercent } from "@/lib/fatigue/fatigue-calibration";
import { ACHSEN, achseVonAttribut, ATTRIBUT_LABEL, type AchseId } from "@/lib/foundation/spielerprofil-modell";
import {
  officialDisciplineWeightLabels,
  officialDisciplineWeightOrder,
  type OfficialDisciplineWeightId,
  type PlayerGeneratorAttributeKey,
} from "@/lib/player-generator/official-discipline-weights";
import {
  UEBERLASTUNG_LIMIT,
  UEBERLASTUNG_SCHWELLE,
  baueTrainingsZielKontext,
  bestimmeAusfallSpielerFuerSpieltag,
  bestimmeTrainingsZiel,
  schwersteMatrixAttribute,
  trainingsProfilFuerZiel,
  wegeFuerDisziplin,
  type TrainingsProfilEintrag,
  type TrainingsZielKontext,
} from "@/lib/training/spieltag-training";
import {
  evaluateTrainingModeDemandDelta,
  getTrainingModeMismatchSeverity,
  resolveTrainingModeDemandStatus,
} from "@/lib/training/training-mode-demand-service";
import { FATIGUE_LOAD_BY_MODE } from "@/lib/training/training-mode-presentation";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

/* ------------------------------------------------------------------ Stationen der Halle */

export type StationId = AchseId | "reha";

export const STATIONEN: ReadonlyArray<{
  id: StationId;
  name: string;
  kurz: string;
  farbe: string;
}> = [
  { id: "pow", name: "Kraft", kurz: "POW", farbe: "#e0637a" },
  { id: "spe", name: "Tempo", kurz: "SPE", farbe: "#62d394" },
  { id: "men", name: "Kopf", kurz: "MEN", farbe: "#62a0f4" },
  { id: "soc", name: "Ausstrahlung", kurz: "SOC", farbe: "#f0c35a" },
  { id: "reha", name: "Reha", kurz: "REHA", farbe: "#9aa7ba" },
];

export function stationDef(id: StationId) {
  return STATIONEN.find((s) => s.id === id) ?? STATIONEN[0]!;
}

/** Achse des stärksten Schwerpunkt-Attributs; ohne Schwerpunkt die Achse mit dem höchsten Kernwert. */
export function stationFuerZeile(input: {
  verletzt: boolean;
  profil: Array<{ attribute: string }>;
  coreStats: { pow: number; spe: number; men: number; soc: number };
}): StationId {
  if (input.verletzt) return "reha";
  const haupt = input.profil[0]?.attribute as PlayerGeneratorAttributeKey | undefined;
  if (haupt) return achseVonAttribut(haupt);
  const achsen: AchseId[] = ["pow", "spe", "men", "soc"];
  return achsen.reduce((beste, id) => (input.coreStats[id] > input.coreStats[beste] ? id : beste), "pow" as AchseId);
}

/* ------------------------------------------------------------------ Belastung */

export const ZONEN = [
  { von: 0, bis: 25, name: "kein Risiko", farbe: "#62d394" },
  { von: 25, bis: 50, name: "minimal", farbe: "#c3cf5e" },
  { von: 50, bis: 80, name: "überlastet", farbe: "#f3b54a" },
  { von: 80, bis: 100, name: "am Limit", farbe: "#ff6058" },
] as const;

export function belastungsZone(fatigue: number) {
  const wert = Number.isFinite(fatigue) ? fatigue : 0;
  return ZONEN.find((z) => wert < z.bis) ?? ZONEN[ZONEN.length - 1]!;
}

export function istUeberlastet(fatigue: number): boolean {
  return Number.isFinite(fatigue) && fatigue >= UEBERLASTUNG_SCHWELLE;
}

export function risikoProzent(fatigue: number): number {
  return getInjuryRiskPercent(fatigue);
}

/** Belastung nach dem nächsten Training bei Modus `modus` (ohne Einsatz; die Einsatzliste kennt die Anwendung nicht). */
export function belastungNachTraining(fatigue: number, modus: PlayerTrainingMode): number {
  const wert = (Number.isFinite(fatigue) ? fatigue : 0) + (FATIGUE_LOAD_BY_MODE[modus] ?? 0);
  return Math.max(0, Math.min(100, Math.round(wert * 100) / 100));
}

/* ------------------------------------------------------------------ Zeilenmodell des Kaders */

export type TrainingZeile = {
  playerId: string;
  name: string;
  klasse: string;
  portrait: string | null;
  row: TrainingPlayerRowView;
  modus: PlayerTrainingMode;
  verletzt: boolean;
  ziel: { disziplinId: string; weg: number; quelle: "manager" | "ki" } | null;
  zielLabel: string | null;
  art: "primaer" | "neben" | null;
  profil: Array<{
    attribute: PlayerGeneratorAttributeName;
    label: string;
    anteil: number;
  }>;
  station: StationId;
  fatigue: number;
  risiko: number;
  gesamt: number | null;
  potenzial: number | null;
  /** Potenzial minus Gesamtwert (Luft nach oben), `null` ohne Potenzial. */
  potenzialRest: number | null;
  /** Netto-Zuwachs bis Saisonende laut Engine (Setpoints). */
  netto: number;
  wunsch: PlayerTrainingMode | null;
  /** Zahlen zum Wunsch (Moral, Spieltag), `null` ohne Wunsch. Quelle: `trainingDemand` der Zeile. */
  wunschDaten: WunschDaten | null;
};

export type WunschDaten = {
  moraleReward: number;
  /** Negativ (wie in der Engine: −5 bzw. −10). */
  moralePenalty: number;
  /** Spieltag-Index im Spielplan (steuert, wann ein offener Wunsch zu Druck wird), `null` unbekannt. */
  spieltag: number | null;
};

export function zielLabel(disziplinId: string): string {
  return officialDisciplineWeightLabels[disziplinId as OfficialDisciplineWeightId] ?? disziplinId;
}

export function attributLabel(attribut: string): string {
  return ATTRIBUT_LABEL[attribut as PlayerGeneratorAttributeKey] ?? attribut;
}

export function baueTrainingZeilen(input: {
  gameState: GameState;
  rows: TrainingPlayerRowView[];
  kontext?: TrainingsZielKontext;
  ausfall?: Set<string>;
}): TrainingZeile[] {
  const { gameState } = input;
  const matchdayId = gameState.matchdayState?.matchdayId ?? null;
  const ausfall = input.ausfall ?? (matchdayId ? bestimmeAusfallSpielerFuerSpieltag(gameState, matchdayId) : new Set<string>());
  const kontext = input.kontext ?? baueTrainingsZielKontext(gameState, matchdayId, ausfall);
  const spieler = new Map(gameState.players.map((p) => [p.id, p] as const));
  const spieltagIndex =
    gameState.seasonState?.disciplineSchedule?.find((e) => e.matchdayId === matchdayId)?.matchdayIndex ?? null;
  return input.rows.map((row) => {
    const player: Player | undefined = spieler.get(row.player.id);
    const bestimmt = player ? bestimmeTrainingsZiel(kontext, player) : null;
    const profil: TrainingsProfilEintrag[] = bestimmt ? trainingsProfilFuerZiel(bestimmt.ziel) : [];
    const verletzt = ausfall.has(row.player.id);
    const gesamt = row.developmentStars.currentAbilityRating;
    const potenzial = row.developmentStars.potentialRating;
    return {
      playerId: row.player.id,
      name: row.player.name,
      klasse: row.player.className,
      portrait: row.player.portraitUrl ?? row.player.portraitPath ?? null,
      row,
      modus: row.mode,
      verletzt,
      ziel: bestimmt
        ? {
            disziplinId: bestimmt.ziel.disziplinId,
            weg: bestimmt.ziel.weg,
            quelle: bestimmt.quelle,
          }
        : null,
      zielLabel: bestimmt ? zielLabel(bestimmt.ziel.disziplinId) : null,
      art: bestimmt ? (bestimmt.ziel.weg === 0 ? "primaer" : "neben") : null,
      profil: profil.map((p) => ({
        attribute: p.attribute,
        label: attributLabel(p.attribute),
        anteil: p.anteil,
      })),
      station: stationFuerZeile({
        verletzt,
        profil,
        coreStats: row.player.coreStats,
      }),
      fatigue: row.player.fatigue,
      risiko: risikoProzent(row.player.fatigue),
      gesamt,
      potenzial,
      potenzialRest: gesamt != null && potenzial != null ? Math.max(0, potenzial - gesamt) : null,
      netto: row.organicForecast.netSetpoints,
      wunsch: row.trainingDemand?.preferredMode ?? null,
      wunschDaten: row.trainingDemand
        ? {
            moraleReward: row.trainingDemand.moraleReward,
            moralePenalty: row.trainingDemand.moralePenalty,
            spieltag: spieltagIndex,
          }
        : null,
    } satisfies TrainingZeile;
  });
}

/* ------------------------------------------------------------------ Sortierung (jede Tabelle) */

export type SortRichtung = "auf" | "ab";
export type KaderSortSchluessel = "name" | "wunsch" | "ziel" | "modus" | "netto" | "potenzial" | "belastung" | "risiko" | "gesamt";

const MODUS_REIHE: Record<PlayerTrainingMode, number> = {
  leicht: 0,
  mittel: 1,
  hart: 2,
};

/** Sortierwert der Wunsch-Spalte: offen (2) vor erfüllt (1) vor kein Wunsch (0). */
function wunschRang(z: Pick<TrainingZeile, "wunsch" | "modus">): number {
  if (!z.wunsch) return 0;
  return z.wunsch === z.modus ? 1 : 2;
}

function sortWert(z: TrainingZeile, schluessel: KaderSortSchluessel): number | string {
  switch (schluessel) {
    case "name":
      return z.name.toLocaleLowerCase("de");
    case "ziel":
      return z.verletzt ? "~" : (z.zielLabel ?? "~").toLocaleLowerCase("de");
    case "modus":
      return MODUS_REIHE[z.modus];
    case "wunsch":
      return wunschRang(z);
    case "netto":
      return z.netto;
    case "potenzial":
      return z.potenzialRest ?? -1;
    case "belastung":
      return z.fatigue;
    case "risiko":
      return z.risiko;
    case "gesamt":
      return z.gesamt ?? -1;
  }
}

/** Stabil sortieren; Gleichstand nach Name. Zweiter Klick auf dieselbe Spalte dreht (siehe `naechsteSortierung`). */
export function sortiereZeilen<T>(
  zeilen: readonly T[],
  wert: (z: T) => number | string,
  richtung: SortRichtung,
  name: (z: T) => string,
): T[] {
  const faktor = richtung === "auf" ? 1 : -1;
  return [...zeilen].sort((a, b) => {
    const wa = wert(a);
    const wb = wert(b);
    const vergleich = typeof wa === "number" && typeof wb === "number" ? wa - wb : String(wa).localeCompare(String(wb), "de");
    return vergleich !== 0 ? vergleich * faktor : name(a).localeCompare(name(b), "de");
  });
}

export function sortiereKader(zeilen: readonly TrainingZeile[], schluessel: KaderSortSchluessel, richtung: SortRichtung): TrainingZeile[] {
  return sortiereZeilen(
    zeilen,
    (z) => sortWert(z, schluessel),
    richtung,
    (z) => z.name,
  );
}

/** Erster Klick: Standardrichtung der Spalte; zweiter Klick auf dieselbe Spalte dreht. */
export function naechsteSortierung<K extends string>(
  aktuell: { schluessel: K; richtung: SortRichtung },
  klick: K,
  standard: SortRichtung = "ab",
): { schluessel: K; richtung: SortRichtung } {
  if (aktuell.schluessel === klick)
    return {
      schluessel: klick,
      richtung: aktuell.richtung === "ab" ? "auf" : "ab",
    };
  return { schluessel: klick, richtung: standard };
}

/* ------------------------------------------------------------------ Kennzahlen im Kopf */

export type KaderKennzahlen = {
  nettoSumme: number;
  belastungMittel: number;
  ueberlastet: number;
  verletzt: number;
  anzahl: number;
  /** Spieler mit Trainingswunsch, davon (noch) nicht erfüllt. */
  wuenscheGesamt: number;
  wuenscheOffen: number;
};

export function baueKaderKennzahlen(zeilen: readonly TrainingZeile[]): KaderKennzahlen {
  const anzahl = zeilen.length;
  const summe = (f: (z: TrainingZeile) => number) => zeilen.reduce((s, z) => s + f(z), 0);
  return {
    nettoSumme: Math.round(summe((z) => z.netto) * 10) / 10,
    belastungMittel: anzahl > 0 ? Math.round(summe((z) => z.fatigue) / anzahl) : 0,
    ueberlastet: zeilen.filter((z) => !z.verletzt && istUeberlastet(z.fatigue)).length,
    verletzt: zeilen.filter((z) => z.verletzt).length,
    anzahl,
    wuenscheGesamt: zeilen.filter((z) => z.wunsch).length,
    wuenscheOffen: zeilen.filter((z) => wunschOffen(z)).length,
  };
}

/* ------------------------------------------------------------------ Trainingswunsch (leicht/mittel/hart) */

export function wunschOffen(z: Pick<TrainingZeile, "wunsch" | "modus">): boolean {
  return z.wunsch != null && z.wunsch !== z.modus;
}

/**
 * Moral-Folge eines Wunsches bei Intensität `modus` — dieselbe Rechnung wie die Engine
 * (`evaluateTrainingModeDemandDelta`, Status je Spieltag). `null` ohne Wunsch.
 * Hinweis: Die Engine gewichtet zusätzlich mit der Dringlichkeit des Wunsches; angezeigt wird der Grundwert.
 */
export function wunschFolge(
  z: Pick<TrainingZeile, "wunsch" | "wunschDaten">,
  modus: PlayerTrainingMode,
): { delta: number; ergebnis: "erfuellt" | "druck" | "verfehlt" | "offen"; text: string } | null {
  if (!z.wunsch || !z.wunschDaten) return null;
  const schwere = getTrainingModeMismatchSeverity(modus, z.wunsch);
  const status = resolveTrainingModeDemandStatus({
    currentMode: modus,
    preferredMode: z.wunsch,
    mismatchSeverity: schwere,
    matchdayIndex: z.wunschDaten.spieltag,
  });
  const erg = evaluateTrainingModeDemandDelta({
    demand: {
      preferredMode: z.wunsch,
      currentMode: modus,
      status,
      moraleReward: z.wunschDaten.moraleReward,
      moralePenalty: z.wunschDaten.moralePenalty,
      mismatchSeverity: schwere,
    },
    activeMode: modus,
  });
  const delta = Math.round(erg.delta * 10) / 10;
  const ergebnis = erg.outcome === "fulfilled" ? "erfuellt" : erg.outcome === "pressure" ? "druck" : erg.outcome === "failed" ? "verfehlt" : "offen";
  const text =
    ergebnis === "erfuellt"
      ? "Wunsch erfüllt"
      : ergebnis === "verfehlt"
        ? "Wunsch verfehlt"
        : ergebnis === "druck"
          ? "Wunsch unter Druck"
          : "Wunsch offen, noch ohne Folge";
  return { delta, ergebnis, text };
}

/** Was „Wünsche erfüllen" setzt: je Spieler mit offenem Wunsch (nicht verletzt) die gewünschte Intensität; leer, wenn nichts offen ist. */
export function wuenscheErfuellen(zeilen: readonly TrainingZeile[], entwurf: Record<string, { modus?: PlayerTrainingMode }>): Record<string, PlayerTrainingMode> {
  const aus: Record<string, PlayerTrainingMode> = {};
  for (const z of zeilen) {
    if (!z.wunsch || z.verletzt) continue;
    const aktuell = entwurf[z.playerId]?.modus ?? z.modus;
    if (aktuell !== z.wunsch) aus[z.playerId] = z.wunsch;
  }
  return aus;
}

export function stationenBelegung(zeilen: readonly TrainingZeile[]): Array<{ id: StationId; zeilen: TrainingZeile[] }> {
  return STATIONEN.map((s) => ({
    id: s.id,
    zeilen: zeilen.filter((z) => z.station === s.id),
  }));
}

export function zonenText(fatigue: number): string {
  if (fatigue >= UEBERLASTUNG_LIMIT) return "am Limit";
  if (fatigue >= UEBERLASTUNG_SCHWELLE) return "überlastet";
  return belastungsZone(fatigue).name;
}

/* ------------------------------------------------------------------ Disziplinkarten (Plan, Radar) */

export type DisziplinKarte = {
  disziplinId: string;
  label: string;
  /** Eignung des Spielers in dieser Disziplin (Engine-Wert), `null` ohne Wert. */
  eignung: number | null;
  /** Plätze im Kader dieser Disziplin (Spielplan), `null` unbekannt. */
  plaetze: number | null;
  /** Noch offene Auftritte der Saison. */
  offen: number;
  /** Rang des Spielers im eigenen Kader in dieser Disziplin (1 = bester). */
  kaderRang: number | null;
  wege: Array<{
    weg: number;
    art: "primaer" | "neben";
    hauptAttribut: PlayerGeneratorAttributeName;
    matrixGewicht: number;
  }>;
};

export function baueDisziplinKarten(input: {
  gameState: GameState;
  teamId: string;
  playerId: string;
  kontext: TrainingsZielKontext;
}): DisziplinKarte[] {
  const { gameState, kontext, playerId, teamId } = input;
  const spieler = new Map(gameState.players.map((p) => [p.id, p] as const));
  const kader = gameState.rosters
    .filter((r) => r.teamId === teamId)
    .map((r) => spieler.get(r.playerId))
    .filter((p): p is Player => Boolean(p));
  const ich = spieler.get(playerId);
  return officialDisciplineWeightOrder.map((id) => {
    const eignung = ich?.disciplineRatings?.[id];
    const wert = typeof eignung === "number" && Number.isFinite(eignung) ? eignung : null;
    const besser = wert == null ? 0 : kader.filter((p) => p.id !== playerId && (p.disciplineRatings?.[id] ?? 0) > wert).length;
    const top = schwersteMatrixAttribute(id, 3);
    return {
      disziplinId: id,
      label: officialDisciplineWeightLabels[id],
      eignung: wert,
      plaetze: kontext.slotsJeDisziplin.get(id) ?? null,
      offen: kontext.offeneAuftritte.get(id) ?? 0,
      kaderRang: wert == null ? null : besser + 1,
      wege: wegeFuerDisziplin(id).map((w, index) => ({
        weg: w.weg,
        art: w.art,
        hauptAttribut: w.hauptAttribut,
        matrixGewicht: top[index]?.matrixGewicht ?? 0,
      })),
    } satisfies DisziplinKarte;
  });
}

export function achsenFarbe(attribut: string): string {
  const achse = achseVonAttribut(attribut as PlayerGeneratorAttributeKey);
  return STATIONEN.find((s) => s.id === achse)?.farbe ?? "#9aa7ba";
}

type ZielWahl = { disziplinId: string; weg: number };

export function zielGleich(a: ZielWahl | null, b: ZielWahl | null): boolean {
  if (!a || !b) return a === b;
  return a.disziplinId === b.disziplinId && a.weg === b.weg;
}

export { ACHSEN };
