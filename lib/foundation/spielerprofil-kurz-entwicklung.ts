/**
 * ENTWICKLUNG IM KURZPROFIL (21.11.): die wichtigsten Trainingszahlen eines Spielers fuer den Drawer.
 *
 * Keine Zweitrechnung: Ziel, Weg und Zuwachs kommen aus `prognostiziereSpieltagsTraining` (dieselbe Rechnung wie die Buchung),
 * Potenzial-Faktor und Maximum-Bremse aus `transparenz` bzw. `bremseKurz` (Seite Entwicklung), der Wunsch aus
 * `buildTrainingModeDemandMap`. React-frei, damit es ohne Rendering pruefbar ist. Fremde Spieler: `null` (Scouting-Nebel,
 * das Training eines fremden Teams ist nicht einsehbar).
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { bremseKurz, attributLabel, zielLabel, type BremseKurz } from "@/lib/training/training-modern-modell";
import { prognostiziereSpieltagsTraining } from "@/lib/training/spieltag-training";
import { buildTrainingModeDemandMap } from "@/lib/training/training-mode-demand-service";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

export type KurzEntwicklung = {
  playerId: string;
  /** Gesperrt am naechsten Spieltag (Verletzung): kein Zuwachs, kein Faktor. */
  verletzt: boolean;
  modus: PlayerTrainingMode;
  ziel: {
    disziplinId: string;
    label: string;
    /** 0 = Primaerweg, sonst Nebenweg. */
    weg: number;
    art: "primaer" | "neben";
    quelle: "manager" | "ki";
  } | null;
  /** Schwerpunkt-Attribute des Wegs mit Anteil (0..1), staerkstes zuerst. */
  profil: Array<{ attribute: string; label: string; anteil: number }>;
  /** Zuwachs des naechsten Spieltags in Punkten (Summe ueber alle Attribute), `null` bei Verletzung. */
  zuwachsJeSpieltag: number | null;
  /** Gebuchter Zuwachs je Attribut, groesster zuerst (nur > 0). */
  zuwachsAttribute: Array<{ attribute: string; label: string; wert: number }>;
  /** Potenzial-Beschleuniger (>= 1), `null` ohne Potenzial. */
  potenzialFaktor: number | null;
  potenzial: number | null;
  /** Anteil des Zuwachses, den Maximum 99 oder die Decke wegnehmen (Seite Entwicklung: `bremseKurz`). */
  bremse: BremseKurz | null;
  wunsch: {
    modus: PlayerTrainingMode;
    erfuellt: boolean;
    moraleReward: number;
    moralePenalty: number;
  } | null;
};

export function baueKurzEntwicklung(gameState: GameState, playerId: string): KurzEntwicklung | null {
  const player = gameState.players.find((eintrag) => eintrag.id === playerId);
  if (!player) return null;
  const teamId = gameState.rosters.find((eintrag) => eintrag.playerId === playerId)?.teamId ?? null;
  const modus: PlayerTrainingMode =
    player.trainingMode === "leicht" || player.trainingMode === "mittel" || player.trainingMode === "hart" ? player.trainingMode : "mittel";
  const vorschau = prognostiziereSpieltagsTraining({ gameState, playerId });
  const demand = teamId ? (buildTrainingModeDemandMap(gameState, teamId).get(playerId) ?? null) : null;
  const wunsch = demand
    ? {
        modus: demand.preferredMode,
        erfuellt: demand.preferredMode === modus,
        moraleReward: demand.moraleReward,
        moralePenalty: demand.moralePenalty,
      }
    : null;
  if (!vorschau) {
    return { playerId, verletzt: false, modus, ziel: null, profil: [], zuwachsJeSpieltag: null, zuwachsAttribute: [], potenzialFaktor: null, potenzial: null, bremse: null, wunsch };
  }
  const zielRoh = vorschau.ziel;
  const ziel = zielRoh
    ? {
        disziplinId: zielRoh.disziplinId,
        label: zielLabel(zielRoh.disziplinId),
        weg: zielRoh.weg ?? 0,
        art: (zielRoh.weg ?? 0) === 0 ? ("primaer" as const) : ("neben" as const),
        quelle: "quelle" in vorschau ? vorschau.quelle : ("ki" as const),
      }
    : null;
  if (vorschau.verletzt) {
    return { playerId, verletzt: true, modus, ziel, profil: [], zuwachsJeSpieltag: null, zuwachsAttribute: [], potenzialFaktor: null, potenzial: null, bremse: null, wunsch };
  }
  const beschleuniger = vorschau.transparenz.beschleuniger;
  return {
    playerId,
    verletzt: false,
    modus,
    ziel,
    profil: vorschau.profil.map((eintrag) => ({ attribute: eintrag.attribute, label: attributLabel(eintrag.attribute), anteil: eintrag.anteil })),
    zuwachsJeSpieltag: vorschau.summe,
    zuwachsAttribute: Object.entries(vorschau.zuwachs)
      .filter(([, wert]) => (wert ?? 0) > 0)
      .map(([attribute, wert]) => ({ attribute, label: attributLabel(attribute), wert: wert as number }))
      .sort((a, b) => b.wert - a.wert),
    potenzialFaktor: beschleuniger.potenzial != null ? beschleuniger.faktor : null,
    potenzial: beschleuniger.potenzial,
    bremse: bremseKurz(vorschau.transparenz),
    wunsch,
  };
}
