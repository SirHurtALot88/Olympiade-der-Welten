/**
 * TRAININGS-FORECAST JE DISZIPLIN (Training je Spieltag, 18.11.) — Modell fuer Spielerprofil und Bereich
 * „Entwicklung" (Wirkung in 20 Disziplinen, Mockup `training-modern-18-11.html`).
 *
 * Frage: Was bringt das Training bis zum Saisonende (oder in den naechsten N Spieltagen) in jeder
 * Disziplin? Gerechnet mit DERSELBEN Funktion, die je Spieltag bucht (`berechneSpieltagsZuwachs`):
 * Spieltag fuer Spieltag mit dem gesetzten Ziel (oder dem KI-Vorschlag) und dem aktuellen Modus,
 * Ausfall-Spieltage einer laufenden Verletzung zaehlen nicht. Der erste Schritt ist genau der Zuwachs,
 * der am naechsten Spieltag gebucht wird; alle weiteren sind Projektion.
 *
 * Disziplinwerte sind ligaweit relativ (Rang -> Wert). Deshalb zweimal dieselbe Engine
 * (`buildLeagueDisciplineRatingsWithAttributeOverrides`), heute und projiziert — unter der Annahme
 * „die anderen bleiben stehen" (`annahme`), wie im bestehenden Profil-Forecast
 * (`lib/foundation/player-discipline-training-forecast.ts`). Die Anzeige muss das benennen.
 */
import type { GameState, Player, PlayerGeneratorAttributeName, PlayerGeneratorAttributes, PlayerTrainingsZiel } from "@/lib/data/olyDataTypes";
import { berechneEignungNachAttributen, type EignungsModus } from "@/lib/training/eignung-aus-attributen";
import { PROGRESSION_ATTRIBUTE_ORDER } from "@/lib/training/class-progression-config";
import {
  baueTrainingsZielKontext,
  berechneSpieltagsZuwachs,
  bestimmeAusfallSpielerFuerSpieltag,
  bestimmeTrainingsZiel,
  hatVollenAttributbogen,
} from "@/lib/training/spieltag-training";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

export type DisziplinTrainingsPrognoseZeile = {
  disziplinId: string;
  /** Disziplinwert heute (Engine mit heutigen Attributen). */
  heute: number;
  /** Disziplinwert mit den projizierten Attributen (andere Spieler unveraendert). */
  prognose: number;
  /** `prognose - heute`, zwei Nachkommastellen. */
  delta: number;
  /** Platz im eigenen Kader heute / mit Prognose (1 = bester), `null` ohne Kader. */
  kaderRangHeute: number | null;
  kaderRangPrognose: number | null;
  /** Ist das die Ziel-Disziplin des Trainings? */
  istZiel: boolean;
};

export type DisziplinTrainingsPrognose = {
  seasonId: string;
  playerId: string;
  ziel: PlayerTrainingsZiel | null;
  quelle: "manager" | "ki" | null;
  modus: PlayerTrainingMode;
  /** Spieltage im Fenster, davon trainiert / verletzt. */
  spieltageImFenster: number;
  spieltageTrainiert: number;
  spieltageVerletzt: number;
  /** Projizierter Zuwachs je Attribut ueber das Fenster. */
  zuwachsJeAttribut: Partial<Record<PlayerGeneratorAttributeName, number>>;
  /** Je Disziplin, groesstes Delta zuerst. */
  zeilen: DisziplinTrainingsPrognoseZeile[];
  annahme: "andere_spieler_unveraendert";
  /** Wie die Eignung gerechnet wurde: exakt mit der ganzen Liga oder geschätzt (Browser ohne fremde Attributbögen). */
  eignungsModus: EignungsModus;
  /** Erster Spieltag des Fensters, an dem der Spieler wieder trainiert (Verletzte: Rückkehr), sonst `null`. */
  ersterTrainingsSpieltag: { matchdayId: string; nummer: number } | null;
  /** Ist der Spieler am nächsten Spieltag verletzt (Training ruht, die Prognose gilt ab der Rückkehr)? */
  verletztJetzt: boolean;
};

function attributeVon(player: Player): PlayerGeneratorAttributes | null {
  const stats = player.attributeSheetStats;
  if (!stats) return null;
  const werte: Partial<Record<PlayerGeneratorAttributeName, number>> = {};
  for (const a of PROGRESSION_ATTRIBUTE_ORDER) {
    const w = stats[a];
    if (typeof w !== "number" || !Number.isFinite(w)) return null;
    werte[a] = w;
  }
  return { ...(stats as PlayerGeneratorAttributes), ...werte };
}

function rangImKader(gameState: GameState, playerId: string, disziplinId: string, eigenerWert: number): number | null {
  const teamId = gameState.rosters.find((r) => r.playerId === playerId)?.teamId;
  if (!teamId) return null;
  const spieler = new Map(gameState.players.map((p) => [p.id, p] as const));
  let besser = 0;
  for (const r of gameState.rosters) {
    if (r.teamId !== teamId || r.playerId === playerId) continue;
    const wert = spieler.get(r.playerId)?.disciplineRatings?.[disziplinId] ?? 0;
    if (wert > eigenerWert) besser += 1;
  }
  return besser + 1;
}

/**
 * Forecast je Disziplin fuer einen Spieler. Ohne `spieltage`: alle noch offenen Spieltage der Saison
 * (ab `matchdayState.matchdayId` einschliesslich). Ohne `ziel`/`modus`: gesetztes Ziel bzw. KI-Vorschlag
 * und aktueller Modus — also genau das, was gebucht wuerde. `null` ohne vollen Attributbogen.
 */
export function prognostiziereDisziplinTraining(input: {
  gameState: GameState;
  playerId: string;
  ziel?: PlayerTrainingsZiel | null;
  modus?: PlayerTrainingMode;
  spieltage?: number;
}): DisziplinTrainingsPrognose | null {
  const { gameState } = input;
  const original = gameState.players.find((p) => p.id === input.playerId);
  if (!original || !hatVollenAttributbogen(original)) return null;
  const start = attributeVon(original);
  if (!start) return null;
  const modus: PlayerTrainingMode =
    input.modus ?? (original.trainingMode === "leicht" || original.trainingMode === "hart" ? original.trainingMode : "mittel");

  const ids = gameState.season.matchdayIds ?? [];
  const aktuell = gameState.matchdayState?.matchdayId ?? ids[0] ?? null;
  const abIndex = aktuell ? Math.max(0, ids.indexOf(aktuell)) : 0;
  const fenster = ids.slice(abIndex, input.spieltage != null ? abIndex + Math.max(0, Math.floor(input.spieltage)) : undefined);

  const kontext = baueTrainingsZielKontext(gameState, aktuell, aktuell ? bestimmeAusfallSpielerFuerSpieltag(gameState, aktuell) : new Set());
  const bestimmt = input.ziel ? { ziel: input.ziel, quelle: "manager" as const } : bestimmeTrainingsZiel(kontext, original);

  let player: Player = original;
  const zuwachsJeAttribut: Partial<Record<PlayerGeneratorAttributeName, number>> = {};
  let trainiert = 0;
  let verletzt = 0;
  let ersterTrainingsSpieltag: DisziplinTrainingsPrognose["ersterTrainingsSpieltag"] = null;
  for (const matchdayId of fenster) {
    if (bestimmeAusfallSpielerFuerSpieltag(gameState, matchdayId).has(original.id)) {
      verletzt += 1;
      continue;
    }
    if (!ersterTrainingsSpieltag) ersterTrainingsSpieltag = { matchdayId, nummer: ids.indexOf(matchdayId) + 1 };
    if (!bestimmt) continue;
    const schritt = berechneSpieltagsZuwachs({ gameState, player, ziel: bestimmt.ziel, quelle: bestimmt.quelle, modus });
    if (!schritt) continue;
    trainiert += 1;
    const stats = { ...(player.attributeSheetStats as NonNullable<Player["attributeSheetStats"]>) };
    for (const [a, w] of Object.entries(schritt.zuwachs) as Array<[PlayerGeneratorAttributeName, number]>) {
      stats[a] = Number(((stats[a] as number) + w).toFixed(3));
      zuwachsJeAttribut[a] = Number(((zuwachsJeAttribut[a] ?? 0) + w).toFixed(3));
    }
    player = { ...player, attributeSheetStats: stats };
  }

  const projiziert = attributeVon(player)!;
  // Bezugspunkt ist der gespeicherte Wert (wie die Plan-Kacheln); das Delta kommt exakt aus der Engine, sobald die
  // ganze Liga im Speicher ist, sonst aus der Matrix-Rohsumme geschätzt (`eignung-aus-attributen.ts`).
  const eignung = berechneEignungNachAttributen({ players: gameState.players, playerId: original.id, neueAttribute: projiziert });
  if (!eignung) return null;
  const heute = eignung.heute;
  const nachher = eignung.nachher;
  const zeilen: DisziplinTrainingsPrognoseZeile[] = Object.keys(heute).map((disziplinId) => {
    const h = heute[disziplinId] ?? 0;
    const p = nachher[disziplinId] ?? h;
    return {
      disziplinId,
      heute: h,
      prognose: p,
      delta: Number((p - h).toFixed(2)),
      kaderRangHeute: rangImKader(gameState, original.id, disziplinId, h),
      kaderRangPrognose: rangImKader(gameState, original.id, disziplinId, p),
      istZiel: bestimmt?.ziel.disziplinId === disziplinId,
    };
  });
  zeilen.sort((a, b) => b.delta - a.delta || a.disziplinId.localeCompare(b.disziplinId));
  return {
    seasonId: gameState.season.id,
    playerId: original.id,
    ziel: bestimmt?.ziel ?? null,
    quelle: bestimmt?.quelle ?? null,
    modus,
    spieltageImFenster: fenster.length,
    spieltageTrainiert: trainiert,
    spieltageVerletzt: verletzt,
    zuwachsJeAttribut,
    zeilen,
    annahme: "andere_spieler_unveraendert",
    eignungsModus: eignung.modus,
    ersterTrainingsSpieltag,
    verletztJetzt: Boolean(fenster[0] && bestimmeAusfallSpielerFuerSpieltag(gameState, fenster[0]).has(original.id)),
  };
}
