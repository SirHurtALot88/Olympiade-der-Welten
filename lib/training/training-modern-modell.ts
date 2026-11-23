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
import { calculateFormMoralSignal, FORM_MORAL_STANDARD_DOSIS_PCT } from "@/lib/morale/form-moral-modifikator";
import {
  MORAL_SKALA_FAKTOR,
  MORAL_UEBERTRAG_GLEICHE_SAISON,
} from "@/lib/morale/morale-konstanten";
import {
  UEBERLASTUNG_LIMIT,
  UEBERLASTUNG_SCHWELLE,
  baueTrainingsZielKontext,
  bestimmeAusfallSpielerFuerSpieltag,
  berechneSpieltagsZuwachs,
  bestimmeTrainingsZiel,
  schwersteMatrixAttribute,
  trainingsProfilFuerZiel,
  wegeFuerDisziplin,
  type SpieltagsTransparenz,
  type TransparenzAttribut,
  type TrainingsProfilEintrag,
  type TrainingsZielKontext,
} from "@/lib/training/spieltag-training";
import {
  WUNSCH_DRUCK_FAKTOR_LEICHT,
  WUNSCH_DRUCK_FAKTOR_SCHWER,
  evaluateTrainingModeDemandDelta,
  getTrainingModeDemandTerms,
  resolveTrainingModeDemandStatus,
} from "@/lib/training/training-mode-demand-service";
import { getAttributesForAxis } from "@/lib/scouting/player-attribute-ceiling-service";
import { DEVELOPMENT_MAX_ATTRIBUTE_VALUE } from "@/lib/training/training-levelup-service";
import { trainingsVorliebenAktivFuer } from "@/lib/resolve/trainings-vorlieben";
import { baueSaisonFortschritt, spBisSaisonende } from "@/lib/training/training-heatmap";
import { leiteTrainingsVorliebenAb, vorliebeArt, type VorliebeArt } from "@/lib/training/trainings-vorlieben";
import {
  ORGANIC_GAP_ACCEL_CAP,
  ORGANIC_GAP_ACCEL_NEUTRAL,
  ORGANIC_GAP_ACCEL_SLOPE,
  ORGANIC_PO_STEEP_DIVISOR,
  TRAINING_SPILLOVER_SHARE,
} from "@/lib/training/organic-season-progression";
import { FATIGUE_LOAD_BY_MODE, getTrainingSetpointsJeSpieltag } from "@/lib/training/training-mode-presentation";
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
  /** Transparenz des nächsten Spieltags (Potenzial-Beschleuniger, Deckel-Bremse), `null` bei Verletzung/ohne Ziel. */
  transparenz: SpieltagsTransparenz | null;
  wunsch: PlayerTrainingMode | null;
  /** Zahlen zum Wunsch (Moral, Spieltag), `null` ohne Wunsch. Quelle: `trainingDemand` der Zeile. */
  wunschDaten: WunschDaten | null;
  /** Trainingsvorlieben (Runde 2): zwei Lieblings-Disziplinen und die ungeliebte; `null`, wenn die Regel der Saison aus ist. */
  vorlieben: { lieblinge: [string, string]; ungeliebt: string } | null;
  /** Art des aktuellen Ziels (1 Liebling, -1 ungeliebt, 0 neutral oder Regel aus). */
  vorliebeAktuell: VorliebeArt;
  /** Skillpunkte bis Saisonende mit dem aktuellen Plan (Ziel, Weg, Intensitaet): dieselbe Rechnung wie die Heatmap, Spieltag fuer Spieltag. */
  sp: number;
  /** Was er sich diese Saison schon gebucht hat (Summe der Trainings-Zuwaechse). */
  spBisher: number;
  /** Gespeicherte Moral (0..100) und Form (0..100), `null` ohne Eintrag. */
  moral: number | null;
  form: number | null;
  rasse: string;
  traits: string[];
};

export type WunschDaten = {
  moraleReward: number;
  /** Negativ (wie in der Engine: −5 bzw. −10). */
  moralePenalty: number;
  /** Spieltag-Index im Spielplan (steuert, wann ein offener Wunsch zu Druck wird), `null` unbekannt. */
  spieltag: number | null;
  /** Spieltage der Saison (für „bis Saisonende"), `null` unbekannt. */
  saisonSpieltage?: number | null;
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
  const vorliebenAktiv = trainingsVorliebenAktivFuer(gameState);
  const moralJeSpieler = new Map((gameState.playerMoraleState ?? []).map((m) => [m.playerId, m.morale] as const));
  const formJeSpieler = new Map((gameState.playerFormState ?? []).map((f) => [f.playerId, f.form] as const));
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
      transparenz:
        player && bestimmt && !verletzt
          ? (berechneSpieltagsZuwachs({ gameState, player, ziel: bestimmt.ziel, quelle: bestimmt.quelle, modus: row.mode })?.transparenz ?? null)
          : null,
      vorlieben: vorliebenAktiv && player ? leiteTrainingsVorliebenAb(player, gameState.season?.id ?? "") : null,
      vorliebeAktuell: vorliebenAktiv && player && bestimmt ? vorliebeArt(player, bestimmt.ziel.disziplinId, gameState.season?.id ?? "") : 0,
      sp: player && bestimmt ? spBisSaisonende({ gameState, player, ziel: bestimmt.ziel, modus: row.mode }) : 0,
      spBisher: baueSaisonFortschritt(gameState, row.player.id)?.trainingSp ?? 0,
      moral: moralJeSpieler.get(row.player.id) ?? null,
      form: formJeSpieler.get(row.player.id) ?? null,
      rasse: player?.race ?? "",
      traits: player ? [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? [])] : [],
      wunsch: row.trainingDemand?.preferredMode ?? null,
      wunschDaten: row.trainingDemand
        ? {
            moraleReward: row.trainingDemand.moraleReward,
            moralePenalty: row.trainingDemand.moralePenalty,
            spieltag: spieltagIndex,
            saisonSpieltage: gameState.season?.matchdayIds?.length ?? null,
          }
        : null,
    } satisfies TrainingZeile;
  });
}

/* ------------------------------------------------------------------ Sortierung (jede Tabelle) */

export type SortRichtung = "auf" | "ab";
export type KaderSortSchluessel = "name" | "wunsch" | "ziel" | "modus" | "netto" | "potenzial" | "belastung" | "risiko" | "gesamt" | "vorlieben" | "sp";

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
    case "vorlieben":
      // Auf dem aktuellen Ziel: Liebling (2) vor neutral (1) vor ungeliebt (0); ohne Regel alles gleich.
      return z.vorliebeAktuell + 1;
    case "sp":
      return z.sp;
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
  /** Skillpunkte des Kaders bis Saisonende (Summe von `sp`). */
  spSumme: number;
  /** Trainingsvorlieben: Spieler, deren Ziel eine Lieblings- bzw. die ungeliebte Disziplin ist; `vorliebenAktiv` false, wenn die Regel der Saison aus ist. */
  vorliebenAktiv: boolean;
  trainierenLiebling: number;
  trainierenUngeliebt: number;
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
    spSumme: Math.round(summe((z) => z.sp) * 10) / 10,
    vorliebenAktiv: zeilen.some((z) => z.vorlieben != null),
    trainierenLiebling: zeilen.filter((z) => !z.verletzt && z.vorliebeAktuell > 0).length,
    trainierenUngeliebt: zeilen.filter((z) => !z.verletzt && z.vorliebeAktuell < 0).length,
  };
}

/* ------------------------------------------------------------------ Trainingswunsch (leicht/mittel/hart) */

export function wunschOffen(z: Pick<TrainingZeile, "wunsch" | "modus">): boolean {
  return z.wunsch != null && z.wunsch !== z.modus;
}

/**
 * Moral-Folge eines Wunsches bei Intensität `modus` — dieselbe Rechnung wie die Engine
 * (`evaluateTrainingModeDemandDelta`, Status je Spieltag; Abzug je Abweichung von `modus` aus
 * `getTrainingModeDemandTerms`). Die Dringlichkeit der Forderung (1,15) greift im Moral-Dienst NICHT auf Intensitäts-
 * wünsche (`evaluateDemandDelta` reicht deren Wert unverändert durch). `null` ohne Wunsch.
 *
 *  - `delta`: Wirkung des Wunsches im Moral-Dienst, auf eine Stelle gerundet wie dort, vor der Streckung.
 *  - `punkte`: dasselbe auf der Moralskala 0 bis 100 (x `MORAL_SKALA_FAKTOR`) — die Zahl, die die Moral
 *    verschiebt. Sie ist ein ZUSTAND: solange der Wunsch so steht, gilt sie bei jeder Neuberechnung der Moral
 *    (je Spieltag) erneut, sie summiert sich nicht auf.
 */
export function wunschFolge(
  z: Pick<TrainingZeile, "wunsch" | "wunschDaten">,
  modus: PlayerTrainingMode,
  spieltag?: number | null,
): {
  delta: number;
  punkte: number;
  ergebnis: "erfuellt" | "druck" | "verfehlt" | "offen";
  text: string;
} | null {
  if (!z.wunsch || !z.wunschDaten) return null;
  const konditionen = getTrainingModeDemandTerms(modus, z.wunsch);
  const status = resolveTrainingModeDemandStatus({
    currentMode: modus,
    preferredMode: z.wunsch,
    mismatchSeverity: konditionen.mismatchSeverity,
    matchdayIndex: spieltag === undefined ? z.wunschDaten.spieltag : spieltag,
  });
  const erg = evaluateTrainingModeDemandDelta({
    demand: {
      preferredMode: z.wunsch,
      currentMode: modus,
      status,
      moraleReward: z.wunschDaten.moraleReward,
      moralePenalty: konditionen.moralePenalty,
      mismatchSeverity: konditionen.mismatchSeverity,
    },
    activeMode: modus,
  });
  const delta = Number(erg.delta.toFixed(1));
  const punkte = Number((delta * MORAL_SKALA_FAKTOR).toFixed(1));
  const ergebnis = erg.outcome === "fulfilled" ? "erfuellt" : erg.outcome === "pressure" ? "druck" : erg.outcome === "failed" ? "verfehlt" : "offen";
  const text =
    ergebnis === "erfuellt"
      ? "Wunsch erfüllt"
      : ergebnis === "verfehlt"
        ? "Wunsch verfehlt"
        : ergebnis === "druck"
          ? "Wunsch unter Druck"
          : "Wunsch offen, noch ohne Folge";
  return { delta, punkte, ergebnis, text };
}

/* ------------------------------------------------------------------ Moral: Verlauf und Einheit */

export type MoralStufe = {
  /** Von diesem Spieltag an (1-basiert) bis `bis`. */
  ab: number;
  bis: number;
  ergebnis: "erfuellt" | "druck" | "verfehlt" | "offen";
  label: string;
  /** Moralpunkte (0..100-Skala), die die Neuberechnung der Moral in dieser Stufe verschiebt. */
  punkte: number;
  /** Aktuelle Stufe (laut Spieltag der Zeile). */
  aktuell: boolean;
};

export type MoralErklaerung = {
  /** Wirkung im Moral-Dienst je Neuberechnung (Zustand), nicht je Spieltag aufsummiert. */
  zustandPunkte: number;
  stufen: MoralStufe[];
  /** Anteil des Zielwertes, der nach 1, 2, 3, 5 Spieltagen erreicht ist (Moral zieht jeden Spieltag um den Rest nach). */
  anlauf: Array<{ spieltage: number; anteil: number }>;
  /** Arena-Eignung in Prozent bei der Endstufe (Standarddosis), gegenüber Moral 50. */
  eignungProzent: number;
  /** Letzte Stufe (Zielwert am Saisonende) in Moralpunkten. */
  saisonendePunkte: number;
};

/** Anteil des Zielwertes nach n Spieltagen: je Spieltag zieht die Moral um 45 % der Restlücke nach (55 % bleiben). */
export function moralAnlauf(spieltage: number): number {
  return Math.round((1 - MORAL_UEBERTRAG_GLEICHE_SAISON ** Math.max(0, spieltage)) * 1000) / 1000;
}

/**
 * Zeitverlauf eines Wunsches bei gleichbleibender Intensität `modus`: welche Stufe wann greift, wie viel Moral
 * (0..100) sie verschiebt, wie schnell die Moral dem folgt und was das in der Arena heißt. Alles aus denselben
 * Funktionen wie die Buchung (`wunschFolge`). `null` ohne Wunsch.
 */
export function moralErklaerung(
  z: Pick<TrainingZeile, "wunsch" | "wunschDaten">,
  modus: PlayerTrainingMode,
): MoralErklaerung | null {
  if (!z.wunsch || !z.wunschDaten) return null;
  const n = Math.max(1, z.wunschDaten.saisonSpieltage ?? 20);
  const jetzt = z.wunschDaten.spieltag;
  const stufen: MoralStufe[] = [];
  for (let tag = 1; tag <= n; tag++) {
    const f = wunschFolge(z, modus, tag);
    if (!f) continue;
    const letzte = stufen[stufen.length - 1];
    if (letzte && letzte.ergebnis === f.ergebnis && letzte.punkte === f.punkte) {
      letzte.bis = tag;
      continue;
    }
    stufen.push({
      ab: tag,
      bis: tag,
      ergebnis: f.ergebnis,
      label: f.ergebnis === "erfuellt" ? "erfüllt" : f.ergebnis === "druck" ? "unter Druck" : f.ergebnis === "verfehlt" ? "verfehlt" : "folgenlos",
      punkte: f.punkte,
      aktuell: false,
    });
  }
  for (const stufe of stufen) stufe.aktuell = jetzt != null && jetzt >= stufe.ab && jetzt <= stufe.bis;
  const jetztFolge = wunschFolge(z, modus);
  const ende = stufen[stufen.length - 1]?.punkte ?? 0;
  const moralPct = (morale: number) => calculateFormMoralSignal({ morale, dosisPct: FORM_MORAL_STANDARD_DOSIS_PCT }).moralePct;
  return {
    zustandPunkte: jetztFolge?.punkte ?? 0,
    stufen,
    anlauf: [1, 2, 3, 5].map((spieltage) => ({ spieltage, anteil: moralAnlauf(spieltage) })),
    eignungProzent: Math.round((moralPct(50 + ende) - moralPct(50)) * 100) / 100,
    saisonendePunkte: ende,
  };
}

function vorzeichenZahl(wert: number, stellen = 1): string {
  return `${wert > 0 ? "+" : wert < 0 ? "−" : ""}${Math.abs(wert).toFixed(stellen).replace(".", ",")}`;
}

/** Kurzform mit Einheit und Zeitbezug, wie die Engine ihn anwendet: „−12,0 Moral, solange verfehlt". */
export function moralZustandText(folge: { punkte: number; ergebnis: "erfuellt" | "druck" | "verfehlt" | "offen" }): string {
  if (folge.ergebnis === "offen") return "noch keine Moral-Folge";
  const bedingung = folge.ergebnis === "erfuellt" ? "solange erfüllt" : folge.ergebnis === "druck" ? "solange unter Druck" : "solange verfehlt";
  return `${vorzeichenZahl(folge.punkte)} Moral ${bedingung}`;
}

/** Tooltip-Text zum Verlauf (ein Absatz, ohne Zeilenumbrüche). */
export function moralTipp(z: Pick<TrainingZeile, "wunsch" | "wunschDaten">, modus: PlayerTrainingMode): string | null {
  const m = moralErklaerung(z, modus);
  if (!m) return null;
  const stufe = (e: MoralStufe["ergebnis"]) => m.stufen.find((x) => x.ergebnis === e);
  const teile: string[] = [];
  const ok = stufe("erfuellt");
  if (ok) {
    teile.push(`Erfüllt: ${vorzeichenZahl(ok.punkte)} Moral, solange die Intensität passt.`);
  } else {
    const offen = stufe("offen");
    const druck = stufe("druck");
    const verfehlt = stufe("verfehlt");
    if (offen) teile.push(`Spieltag ${offen.ab}${offen.bis > offen.ab ? ` bis ${offen.bis}` : ""}: folgenlos.`);
    if (druck) teile.push(`Ab Spieltag ${druck.ab}: unter Druck, ${vorzeichenZahl(druck.punkte)} Moral.`);
    if (verfehlt) teile.push(`Ab Spieltag ${verfehlt.ab}: verfehlt, ${vorzeichenZahl(verfehlt.punkte)} Moral.`);
    teile.push(
      `Das ist ein Zustand, kein Abzug je Spieltag: Er gilt bei jeder Neuberechnung der Moral erneut und summiert sich nicht auf. Die Moral zieht ihm je Spieltag um 45 % der Restlücke nach (nach 3 Spieltagen ${Math.round(moralAnlauf(3) * 100)} %).`,
    );
    teile.push(`Skala 0 bis 100, neutral 50. In der Arena kosten ${vorzeichenZahl(m.saisonendePunkte)} Moral etwa ${vorzeichenZahl(m.eignungProzent, 2)} % Eignung.`);
  }
  return teile.join(" ");
}

/* ------------------------------------------------------------------ Potenzial und Maximum: Zahlen und Texte */

export const MAXIMUM_ATTRIBUT = DEVELOPMENT_MAX_ATTRIBUTE_VALUE;

const zahlDe = (wert: number, stellen = 2) => wert.toFixed(stellen).replace(".", ",");

/** Der Beschleuniger als Text: „Zuwachs × 1,16 (Rest 15 bis Potenzial 58,0)". */
export function potenzialKurz(t: SpieltagsTransparenz | null): string | null {
  if (!t || t.beschleuniger.potenzial == null) return null;
  const b = t.beschleuniger;
  return `Zuwachs × ${zahlDe(b.faktor)} (Rest ${Math.round(b.luecke)} bis Potenzial ${zahlDe(b.potenzial as number, 1)})`;
}

export function potenzialTipp(t: SpieltagsTransparenz | null): string {
  const b = t?.beschleuniger;
  const regel = `Potenzial wirkt nur als Beschleuniger, nie als Bremse: Bis ${ORGANIC_GAP_ACCEL_NEUTRAL} Punkte Abstand zwischen Stärke und Potenzial gilt × 1,00, darüber +${zahlDe(ORGANIC_GAP_ACCEL_SLOPE * 100, 0)} % je Punkt (höchstens × ${zahlDe(ORGANIC_GAP_ACCEL_CAP)}); ab Potenzial 70 kommt je Punkt +${zahlDe(100 / ORGANIC_PO_STEEP_DIVISOR, 1)} % dazu. Je näher ein Spieler am Potenzial ist, desto kleiner der Faktor, bis × 1,00.`;
  if (!b || b.potenzial == null) return `${regel} Für diesen Spieler liegt kein Potenzial vor, es gilt × 1,00.`;
  return `${regel} Hier: Stärke ${zahlDe(b.aktuell ?? 0, 1)}, Potenzial ${zahlDe(b.potenzial, 1)}, Abstand ${zahlDe(b.luecke, 1)} ⇒ × ${zahlDe(b.gapAccel)} (Abstand) × ${zahlDe(b.poSteep)} (Höhe) = × ${zahlDe(b.faktor)}.`;
}

export function bremsGrundText(a: TransparenzAttribut): string {
  const name = attributLabel(a.attribute);
  switch (a.grund) {
    case "maximum":
      return `${name} steht am Maximum ${MAXIMUM_ATTRIBUT}: kein Zuwachs mehr möglich`;
    case "limit":
      return `${name} am individuellen Limit (Rest unter 1): Zuwachs × 0,05`;
    case "eng":
      return `${name} nahe am individuellen Limit (Rest ${a.rest != null ? Math.max(1, Math.round(a.rest)) : "wenige"}): Zuwachs × 0,45`;
    case "achse": {
      // Dieselbe Zuordnung wie die Engine (`getCombinedAttributeTrainingMultiplier`): erste Achse, die das Attribut enthält.
      const achseId = (["pow", "spe", "men", "soc"] as const).find((x) => getAttributesForAxis(x).includes(a.attribute)) ?? "pow";
      return `${name}: die Achse ${stationDef(achseId).name} ist fast am Sterne-Potenzial, Zuwachs × ${zahlDe(a.faktor)}`;
    }
    default:
      return `${name}: keine Bremse`;
  }
}

export type BremseKurz = {
  /** 0..1, Anteil des Weg-Zuwachses, der verloren geht. */
  verlustAnteil: number;
  verlustProzent: number;
  /** Bremsende Attribute, stärkster Verlust zuerst. */
  attribute: TransparenzAttribut[];
  /** Davon als Nebeneffekt auf andere Attribute umgeleitet (Zuwachs-Punkte je Spieltag). */
  umgeleitet: number;
  /** `true`, wenn mindestens ein Attribut am Maximum 99 steht. */
  mitMaximum: boolean;
  text: string;
};

/** Ab diesem Anteil zeigt die Tabelle ein Warnzeichen. */
export const BREMSE_WARNSCHWELLE = 0.1;

export function bremseKurz(t: SpieltagsTransparenz | null): BremseKurz | null {
  if (!t) return null;
  const attribute = t.attribute.filter((a) => a.verlust > 0.0005).sort((l, r) => r.verlust - l.verlust);
  if (attribute.length === 0 || t.verlustAnteil <= 0.0005) return null;
  const prozent = Math.round(t.verlustAnteil * 100);
  const namen = attribute.map((a) => attributLabel(a.attribute)).join(", ");
  const mitMaximum = attribute.some((a) => a.amMaximum);
  return {
    verlustAnteil: t.verlustAnteil,
    verlustProzent: prozent,
    attribute,
    umgeleitet: t.umgeleitet,
    mitMaximum,
    text: `−${prozent} % Zuwachs (${namen} ${mitMaximum ? "am Maximum" : "gebremst"})`,
  };
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

/* ------------------------------------------------------------------ Legende „So rechnet die Entwicklung" */

export type LegendeEintrag = { id: "potenzial" | "maximum" | "moral" | "intensitaet"; titel: string; text: string };

/**
 * Vier Sätze für die aufklappbare Legende, jede Zahl aus den Konstanten bzw. Funktionen, mit denen gebucht wird.
 * Moral-Beispiel: schwere Abweichung (zwei Stufen daneben) = −10 x Skala 1,2.
 */
export function baueLegende(): LegendeEintrag[] {
  const schwer = getTrainingModeDemandTerms("leicht", "hart");
  const leicht = getTrainingModeDemandTerms("mittel", "hart");
  const schwerPunkte = schwer.moralePenalty * MORAL_SKALA_FAKTOR;
  const schwerDruck = Number((schwer.moralePenalty * WUNSCH_DRUCK_FAKTOR_SCHWER).toFixed(1)) * MORAL_SKALA_FAKTOR;
  const leichtDruck = Number((leicht.moralePenalty * WUNSCH_DRUCK_FAKTOR_LEICHT).toFixed(1)) * MORAL_SKALA_FAKTOR;
  const [lL, lM, lH] = (["leicht", "mittel", "hart"] as const).map((m) => ({
    sp: getTrainingSetpointsJeSpieltag(m),
    last: FATIGUE_LOAD_BY_MODE[m],
  }));
  const p = (w: number) => vorzeichenZahl(Number(w.toFixed(1)), 1);
  return [
    {
      id: "potenzial",
      titel: "Potenzial",
      text: `Beschleuniger, nie Bremse: bis ${ORGANIC_GAP_ACCEL_NEUTRAL} Punkte Abstand zwischen Stärke und Potenzial gilt × 1,00, darüber +${zahlDe(ORGANIC_GAP_ACCEL_SLOPE * 100, 0)} % je Punkt (höchstens × ${zahlDe(ORGANIC_GAP_ACCEL_CAP)}); über Potenzial 70 kommt +${zahlDe(100 / ORGANIC_PO_STEEP_DIVISOR, 1)} % je Punkt dazu.`,
    },
    {
      id: "maximum",
      titel: "Maximum und Limit",
      text: `Jedes Attribut hat ein verdecktes Limit (höchstens ${MAXIMUM_ATTRIBUT}). Rest bis 5: Zuwachs × 0,45, Rest bis 1: × 0,05; ist die Achse fast am Sterne-Potenzial, × 0,55 bzw. × 0,10. Was das Attribut nicht aufnimmt, geht verloren, nur ${Math.round(TRAINING_SPILLOVER_SHARE * 100)} % des gebremsten Anteils fließen als Nebeneffekt in andere Attribute.`,
    },
    {
      id: "moral",
      titel: "Moral",
      text: `Skala 0 bis 100, neutral 50. Ein verfehlter Wunsch ist ein Zustand, kein Abzug je Spieltag: schwere Abweichung ${p(schwerPunkte)} Moral (−${Math.abs(schwer.moralePenalty)} × ${zahlDe(MORAL_SKALA_FAKTOR)}), unter Druck ${p(schwerDruck)}, leichte Abweichung nur ${p(leichtDruck)}. Die Moral zieht dem Zustand je Spieltag um ${Math.round((1 - MORAL_UEBERTRAG_GLEICHE_SAISON) * 100)} % der Restlücke nach.`,
    },
    {
      id: "intensitaet",
      titel: "Intensität",
      text: `Leicht ${zahlDe(lL!.sp, 3)}, Mittel ${zahlDe(lM!.sp, 3)}, Hart ${zahlDe(lH!.sp, 3)} SP Grundbudget je Spieltag (vor Potenzial, Trait, Gebäude). Belastung je Training: +${lL!.last} / +${lM!.last} / +${lH!.last}; ab ${UEBERLASTUNG_SCHWELLE} überlastet, das drückt die Form leicht.`,
    },
  ];
}
