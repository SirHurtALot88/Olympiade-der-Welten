/**
 * TRAINING: WO DAS ANKOMMT (22.11.) — reine Verdrahtung ueber die vorhandenen Engine-Funktionen, keine eigene Formel.
 *
 *  - `waehleTopWirkung`: die Top-N Disziplinen nach Eignungszuwachs aus `prognostiziereDisziplinTraining`
 *    (Attributzuwachs bis Saisonende -> offizielle Matrix -> Eignung aller 20 Disziplinen).
 *  - `baueWirkungVergleich`: dasselbe fuer zwei Plaene (bisher / mit Aenderung), Top-N nach dem neuen Plan.
 *  - `prognostiziereTrainingAbRueckkehr`: der Zuwachs je Spieltag, auch fuer Verletzte — dann ab dem erwarteten
 *    Rueckkehr-Spieltag. Das Training ruht waehrend der Verletzung (Regel B), die Prognose zeigt nur, was danach gilt.
 */
import type { GameState, PlayerTrainingsZiel } from "@/lib/data/olyDataTypes";
import {
  baueTrainingsZielKontext,
  berechneSpieltagsZuwachs,
  bestimmeAusfallSpielerFuerSpieltag,
  bestimmeTrainingsZiel,
  hatVollenAttributbogen,
  type SpieltagsZuwachs,
  type TrainingsZielKontext,
} from "@/lib/training/spieltag-training";
import {
  prognostiziereDisziplinTraining,
  type DisziplinTrainingsPrognose,
  type DisziplinTrainingsPrognoseZeile,
} from "@/lib/training/disziplin-trainings-prognose";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

/* ------------------------------------------------------------------ Top-N Wirkung */

/** Groesster Zuwachs zuerst, bei Gleichstand die hoehere Eignung, dann alphabetisch (stabil). */
export function waehleTopWirkung<T extends Pick<DisziplinTrainingsPrognoseZeile, "disziplinId" | "delta" | "prognose">>(
  zeilen: readonly T[],
  n: number,
): T[] {
  return [...zeilen]
    .sort((a, b) => b.delta - a.delta || b.prognose - a.prognose || a.disziplinId.localeCompare(b.disziplinId))
    .slice(0, Math.max(0, n));
}

export type WirkungsVergleichZeile = {
  disziplinId: string;
  heute: number;
  /** Eignung bis Saisonende mit dem bisherigen Plan / mit dem Plan der Auswahl. */
  bisher: number;
  neu: number;
  deltaBisher: number;
  deltaNeu: number;
  kaderRangHeute: number | null;
  kaderRangBisher: number | null;
  kaderRangNeu: number | null;
  /** Ziel-Disziplin des neuen Plans. */
  istZiel: boolean;
};

export type WirkungsVergleich = {
  zeilen: WirkungsVergleichZeile[];
  eignungsModus: "liga" | "schaetzung";
  /** Erster Spieltag, ab dem der Plan wirkt (Verletzte: Rueckkehr). */
  ersterTrainingsSpieltag: DisziplinTrainingsPrognose["ersterTrainingsSpieltag"];
  verletztJetzt: boolean;
};

type PlanWahl = { ziel: { disziplinId: string; weg: number } | null; modus: PlayerTrainingMode };

function alsZiel(ziel: { disziplinId: string; weg: number } | null): PlayerTrainingsZiel | null {
  return ziel ? { disziplinId: ziel.disziplinId, weg: Math.max(0, Math.min(2, Math.floor(ziel.weg))) as 0 | 1 | 2 } : null;
}

export function baueWirkungVergleich(input: {
  gameState: GameState;
  playerId: string;
  bisher: PlanWahl;
  neu: PlanWahl;
  anzahl?: number;
}): WirkungsVergleich | null {
  const { gameState, playerId } = input;
  const gleich =
    input.bisher.modus === input.neu.modus &&
    input.bisher.ziel?.disziplinId === input.neu.ziel?.disziplinId &&
    input.bisher.ziel?.weg === input.neu.ziel?.weg;
  const a = prognostiziereDisziplinTraining({ gameState, playerId, ziel: alsZiel(input.bisher.ziel), modus: input.bisher.modus });
  const b = gleich
    ? a
    : prognostiziereDisziplinTraining({ gameState, playerId, ziel: alsZiel(input.neu.ziel), modus: input.neu.modus });
  if (!a || !b) return null;
  const alt = new Map(a.zeilen.map((z) => [z.disziplinId, z] as const));
  const zeilen = waehleTopWirkung(b.zeilen, input.anzahl ?? 5).map((z) => {
    const v = alt.get(z.disziplinId) ?? z;
    return {
      disziplinId: z.disziplinId,
      heute: z.heute,
      bisher: v.prognose,
      neu: z.prognose,
      deltaBisher: v.delta,
      deltaNeu: z.delta,
      kaderRangHeute: z.kaderRangHeute,
      kaderRangBisher: v.kaderRangPrognose,
      kaderRangNeu: z.kaderRangPrognose,
      istZiel: z.istZiel,
    } satisfies WirkungsVergleichZeile;
  });
  return {
    zeilen,
    eignungsModus: b.eignungsModus,
    ersterTrainingsSpieltag: b.ersterTrainingsSpieltag,
    verletztJetzt: b.verletztJetzt,
  };
}

/* ------------------------------------------------------------------ Zuwachs je Spieltag, auch fuer Verletzte */

export type SpieltagsPrognoseAb = SpieltagsZuwachs & {
  verletzt: false;
  /** Spieltag, fuer den der Zuwachs gilt: der naechste, bei Verletzten der erwartete Rueckkehr-Spieltag. */
  abSpieltag: { matchdayId: string; nummer: number };
  /** `true`, wenn das erst nach einer Verletzungspause gilt (Training ruht bis dahin). */
  nachVerletzung: boolean;
};

export type SpieltagsPrognoseKeine = {
  verletzt: true;
  ziel: PlayerTrainingsZiel | null;
  /** Bis Saisonende keine Rueckkehr in Sicht. */
  ohneRueckkehr: true;
};

/**
 * Wie `prognostiziereSpieltagsTraining`, aber ein verletzter Spieler bekommt den Zuwachs ab dem ersten Spieltag, an
 * dem er wieder einsatzfaehig ist (`bestimmeAusfallSpielerFuerSpieltag`, dieselbe Quelle wie die Buchung). Der Zuwachs
 * selbst kommt aus `berechneSpieltagsZuwachs`, der Funktion, die auch bucht.
 */
export function prognostiziereTrainingAbRueckkehr(input: {
  gameState: GameState;
  playerId: string;
  ziel?: PlayerTrainingsZiel | null;
  modus?: PlayerTrainingMode;
  kontext?: TrainingsZielKontext;
}): SpieltagsPrognoseAb | SpieltagsPrognoseKeine | null {
  const { gameState } = input;
  const player = gameState.players.find((p) => p.id === input.playerId);
  if (!player || !hatVollenAttributbogen(player)) return null;
  const ids = gameState.season?.matchdayIds ?? [];
  const aktuell = gameState.matchdayState?.matchdayId ?? ids[0] ?? null;
  if (!aktuell) return null;
  const start = Math.max(0, ids.indexOf(aktuell));
  let rueckkehr: string | null = null;
  for (const id of ids.slice(start)) {
    if (!bestimmeAusfallSpielerFuerSpieltag(gameState, id).has(player.id)) {
      rueckkehr = id;
      break;
    }
  }
  const kontext =
    input.kontext ?? baueTrainingsZielKontext(gameState, aktuell, bestimmeAusfallSpielerFuerSpieltag(gameState, aktuell));
  const bestimmt = input.ziel ? { ziel: input.ziel, quelle: "manager" as const } : bestimmeTrainingsZiel(kontext, player);
  if (!rueckkehr) return { verletzt: true, ziel: bestimmt?.ziel ?? null, ohneRueckkehr: true };
  if (!bestimmt) return null;
  const zuwachs = berechneSpieltagsZuwachs({
    gameState,
    player,
    ziel: bestimmt.ziel,
    quelle: bestimmt.quelle,
    modus: input.modus,
  });
  if (!zuwachs) return null;
  return {
    ...zuwachs,
    verletzt: false,
    abSpieltag: { matchdayId: rueckkehr, nummer: ids.indexOf(rueckkehr) + 1 },
    nachVerletzung: rueckkehr !== aktuell,
  };
}
