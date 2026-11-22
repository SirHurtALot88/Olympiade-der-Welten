/**
 * BELASTUNGS-FORECAST JE INTENSITAET (Training, 22.11.) — „wie entwickelt sich die Belastung, wenn der Spieler
 * eingesetzt wird, bei Leicht / Mittel / Hart?"
 *
 * Gezeigt = gebucht: keine zweite Formel, nur die Aufrufe der Buchung in der Reihenfolge, in der sie buchen
 * (`lib/fatigue/fatigue-injury-service.ts`, `lib/training/matchday-training-accumulator.ts`):
 *
 *  - Konto je Einsatz:  `projectMatchdayInjuryRisk` (Last x Trait x Einsatz, minus aktive Erholung des Modus
 *    ueber `getPlayerActiveRecoveryCredit`) -> `fatigueBeforeRoll` ist der neue Kontostand.
 *  - Trainingsschicht:  `FATIGUE_LOAD_BY_MODE[modus] / Spieltage x Reha-Faktor` je Spieltag, auf den Stand gelegt.
 *  - Wert im Verlauf = Konto + Trainingsschicht = die Belastung, gegen die der Verletzungswurf wuerfelt (`risikoFatigue`).
 *  - Ausfall-Spieltag: keine Last, Erholung `injuryRecovery`, keine Trainingsschicht (Regel B).
 *  - Pause nach Spieltag 10 (Regel v2): Erholung eines spielfreien Spieltags auf das Konto.
 *
 * Annahmen, die die Anzeige benennt: eingesetzt an jedem Spieltag, normale Intensitaet, Platzstufe „mittel"
 * (der kuenftige Platz ist unbekannt), Modus bleibt der gewaehlte.
 *
 * Verlauf BISHER: Die Belastung je Spieltag wird im Spielstand nicht historisiert (`injuryEvents` sind im
 * Speicher auf Verletzungen gekuerzt, `playerAvailabilityState` haelt nur den aktuellen Stand). Historisiert ist
 * nur die Trainingsschicht (`seasonTrainingAccumulator.verlauf[].l`) — sie wird als eigene Reihe mitgegeben.
 */
import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { getInjuryRiskPercent } from "@/lib/fatigue/fatigue-calibration";
import { getRecoveryTrainingFatigueReductionPct, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { belastungsRegelFuer } from "@/lib/fatigue/belastung-regel-stempel";
import {
  calculatePlayerRecovery,
  getPlayerActiveRecoveryCredit,
  getPlayerGesamtFatigue,
  getPlayerTrainingFatigueShare,
  isBelastungsPauseNachSpieltag,
  projectMatchdayInjuryRisk,
} from "@/lib/fatigue/fatigue-injury-service";
import { bestimmeAusfallSpielerFuerSpieltag } from "@/lib/training/spieltag-training";
import { resolveSeasonTotalMatchdays } from "@/lib/training/matchday-training-accumulator";
import { FATIGUE_LOAD_BY_MODE } from "@/lib/training/training-mode-presentation";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

/** Ab hier beginnt das Verletzungsrisiko (Kurve `fatigue-calibration`, Zone „kein Risiko" endet bei 25). */
export const RISIKO_SCHWELLE = 25;

export type BelastungsPunkt = {
  matchdayId: string;
  /** Spieltag-Nummer in der Saison (1-basiert). */
  nummer: number;
  /** Belastung, gegen die gewuerfelt wird (Konto + Trainingsschicht); an Ausfall-Spieltagen der Stand ohne Wurf. */
  wert: number;
  /** Verletzungsrisiko in Prozent bei diesem Wert (0 bei Ausfall: kein Einsatz, kein Wurf). */
  risiko: number;
  /** Spieler faellt an diesem Spieltag aus (verletzt). */
  ausfall: boolean;
};

export type BelastungsStufenForecast = {
  modus: PlayerTrainingMode;
  punkte: BelastungsPunkt[];
  /** Erster Spieltag (Nummer) mit Wert ueber der Schwelle, `null` wenn nie. */
  ersterUeberSchwelle: number | null;
  /** Hoechster Wert im Fenster. */
  maximum: number;
  /** Wert am letzten Spieltag des Fensters. */
  ende: number;
};

export type BelastungsForecast = {
  seasonId: string;
  playerId: string;
  /** Aktueller Gesamtwert (Konto + Trainingsschicht) — der Ist-Punkt. */
  jetzt: number;
  /** Nummer des naechsten Spieltags, `null` ohne Spielplan. */
  naechsterSpieltag: number | null;
  /** Bisherige Trainingsschicht je gebuchtem Spieltag (kumuliert). Die Spiel-Belastung selbst ist nicht historisiert. */
  trainingsschichtVerlauf: Array<{ nummer: number; wert: number }>;
  stufen: Record<PlayerTrainingMode, BelastungsStufenForecast>;
  annahme: string;
};

const MODI: PlayerTrainingMode[] = ["leicht", "mittel", "hart"];

function klemme(wert: number) {
  return Math.max(0, Math.min(100, Number(wert.toFixed(2))));
}

function rundeZwei(wert: number) {
  return Number(wert.toFixed(2));
}

export function berechneBelastungsForecast(input: {
  gameState: GameState;
  playerId: string;
  /** Anzahl Spieltage vorwaerts, Standard: alle bis Saisonende. */
  spieltage?: number;
}): BelastungsForecast | null {
  const { gameState } = input;
  const player = gameState.players.find((p) => p.id === input.playerId);
  const teamId = gameState.rosters.find((r) => r.playerId === input.playerId)?.teamId;
  if (!player || !teamId) return null;
  const ids = gameState.season?.matchdayIds ?? [];
  const aktuell = gameState.matchdayState?.matchdayId ?? ids[0] ?? null;
  const start = aktuell ? Math.max(0, ids.indexOf(aktuell)) : 0;
  const fenster = ids.slice(start, input.spieltage != null ? start + Math.max(0, Math.floor(input.spieltage)) : undefined);

  const seasonId = gameState.season.id;
  const schichtJetzt = getPlayerTrainingFatigueShare(player, seasonId);
  const jetzt = getPlayerGesamtFatigue(gameState, player, teamId);
  const kontoStart = klemme(jetzt - schichtJetzt);
  const spieltageGesamt = resolveSeasonTotalMatchdays(gameState);
  const rehaFaktor = Math.max(
    0,
    Math.min(1, 1 - getRecoveryTrainingFatigueReductionPct(getTeamFacilityState(gameState, teamId)) / 100),
  );
  const regel = belastungsRegelFuer(gameState);
  const ausfallJeSpieltag = new Map(fenster.map((id) => [id, bestimmeAusfallSpielerFuerSpieltag(gameState, id).has(player.id)] as const));

  const stufen = {} as Record<PlayerTrainingMode, BelastungsStufenForecast>;
  for (const modus of MODI) {
    // Das Konto folgt der Buchung des Modus: aktive Erholung und Bank-Erholung haengen am Trainingsmodus.
    const aktiveErholung = getPlayerActiveRecoveryCredit(gameState, teamId, modus);
    const erholung = calculatePlayerRecovery(gameState, teamId, modus);
    const anteil = (FATIGUE_LOAD_BY_MODE[modus] / spieltageGesamt) * rehaFaktor;
    let konto = kontoStart;
    let schicht = schichtJetzt;
    const punkte: BelastungsPunkt[] = [];
    for (const matchdayId of fenster) {
      const nummer = ids.indexOf(matchdayId) + 1;
      const ausfall = ausfallJeSpieltag.get(matchdayId) === true;
      if (ausfall) {
        konto = klemme(konto - erholung.injuryRecovery);
        punkte.push({ matchdayId, nummer, wert: klemme(konto + schicht), risiko: 0, ausfall: true });
      } else {
        const projektion = projectMatchdayInjuryRisk({
          player: player as Pick<Player, "traitsPositive" | "traitsNegative">,
          currentFatigue: konto,
          intensity: "normal",
          activeRecovery: aktiveErholung,
          regel,
          slot: regel === "v2" ? { stufe: "medium", resistenz: null } : null,
        });
        konto = projektion.fatigueBeforeRoll;
        schicht = rundeZwei(schicht + anteil);
        const wert = klemme(konto + schicht);
        punkte.push({ matchdayId, nummer, wert, risiko: getInjuryRiskPercent(wert), ausfall: false });
      }
      if (isBelastungsPauseNachSpieltag(gameState, matchdayId)) konto = klemme(konto - erholung.normalRecovery);
    }
    const ueber = punkte.find((p) => !p.ausfall && p.wert > RISIKO_SCHWELLE) ?? null;
    stufen[modus] = {
      modus,
      punkte,
      ersterUeberSchwelle: ueber ? ueber.nummer : null,
      maximum: punkte.reduce((m, p) => Math.max(m, p.wert), 0),
      ende: punkte.length > 0 ? punkte[punkte.length - 1]!.wert : jetzt,
    };
  }

  const verlauf = player.seasonTrainingAccumulator?.seasonId === seasonId ? (player.seasonTrainingAccumulator.verlauf ?? []) : [];
  let summe = 0;
  const trainingsschichtVerlauf = verlauf.map((e) => {
    summe = rundeZwei(summe + (e.l ?? 0));
    return { nummer: ids.indexOf(e.m) + 1, wert: summe };
  });

  return {
    seasonId,
    playerId: player.id,
    jetzt,
    naechsterSpieltag: fenster[0] ? ids.indexOf(fenster[0]) + 1 : null,
    trainingsschichtVerlauf,
    stufen,
    annahme: "eingesetzt an jedem Spieltag, normale Intensität, Platzstufe mittel",
  };
}
