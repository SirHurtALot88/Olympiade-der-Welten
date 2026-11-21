import type { GameState, Player, PlayerGeneratorAttributeName, TrainingsSpieltagEintrag } from "@/lib/data/olyDataTypes";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import { FATIGUE_LOAD_BY_MODE } from "@/lib/training/training-mode-presentation";
import { getRecoveryTrainingFatigueReductionPct, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { buildLeagueDisciplineRatingsWithAttributeOverrides } from "@/lib/player-formulas/discipline-rating-engine";
import { buildCoreStatsFromDisciplineRatings } from "@/lib/training/season-end-progression-preview";
import { PROGRESSION_ATTRIBUTE_ORDER } from "@/lib/training/class-progression-config";
import { isTrainingJeSpieltagAktiv } from "@/lib/training/training-je-spieltag-schalter";
import {
  baueTrainingsZielKontext,
  berechneSpieltagsZuwachs,
  bestimmeAusfallSpielerFuerSpieltag,
  bestimmeTrainingsZiel,
  hatVollenAttributbogen,
  type TrainingsZielKontext,
} from "@/lib/training/spieltag-training";

/**
 * Per-matchday training accumulation (anti-cheese Teil B, B.4).
 *
 * Runs once per resolved matchday, AFTER `applyFatigueAndInjuryAfterMatchday` (so the training-fatigue
 * share is layered on top of the pure match fatigue and NEVER enters `fatigueBeforeRoll` / the injury
 * roll / `playerAvailabilityState` — otherwise `player-season-fatigue-stats.ts`' back-calculation
 * `event.fatigueBefore - MATCHDAY_FATIGUE_LOAD` would be wrong; see B.3).
 *
 * For every rostered player (used, benched OR injured — training happens regardless of playing time,
 * "Äquivalenz"), the active `trainingMode` for this matchday is recorded and the accumulated training
 * fatigue is advanced by `FATIGUE_LOAD_BY_MODE[mode] / totalMatchdays`, MINUS the REHA/recovery-center
 * training-fatigue reduction of the player's team (`getRecoveryTrainingFatigueReductionPct`). So a built
 * recovery_center now actually lowers the player's applied per-matchday training fatigue (Fix A) — the
 * reduction was previously only reflected in the forecast/AI-planning and discarded at season-end apply.
 * The same reduction factor is applied to the rollback term on a forced re-apply so it stays consistent.
 *
 * Idempotency / forceReplace (keyed on `matchdayId`):
 *  - Same matchday + same mode already recorded → the accumulator is returned untouched, but the
 *    already-accumulated training-fatigue share is re-layered onto `player.fatigue` (which the
 *    preceding `applyFatigueAndInjuryAfterMatchday` just reset to the pure match fatigue). This keeps
 *    a `forceReplace` with an unchanged mode from silently dropping the training-fatigue layer.
 *  - Same matchday + different mode (a forced re-apply of a corrected result) → the old matchday's
 *    contribution is rolled back via the stored `modeByMatchday` entry and the new one applied;
 *    `matchdaysCounted` stays constant.
 *
 * `player.fatigue` is set to `pureMatchFatigue + accumulatedTrainingFatigue` where `pureMatchFatigue`
 * is whatever `applyFatigueAndInjuryAfterMatchday` just wrote (derived exclusively from the
 * availability state, which carries no training fatigue). Because that value is re-derived every
 * matchday, adding the FULL accumulated training fatigue here is idempotent across matchdays.
 *
 * `deferredPlayerIds` — DIE TEIL-BUCHUNG JE DISZIPLIN.
 * Die ganze Idempotenz oben haengt an einer einzigen Voraussetzung: `player.fatigue` ist beim
 * Eintritt die frisch abgeleitete REINE Match-Fatigue. Seit die Arena je Disziplin bucht, gilt
 * das nicht mehr fuer jeden: Wer erst in D2 antritt, wird vom D1-Commit gar nicht angefasst
 * (keine Last, keine Erholung — siehe `collectPendingLaterSideKeys`). Sein `player.fatigue`
 * traegt noch den Vor-Spieltags-Wert, in dem die Trainingsfatigue der VORIGEN Spieltage bereits
 * steckt. Legte der D1-Commit die neue Gesamtsumme obendrauf, bekam er die Trainingsschicht ein
 * zweites Mal — GEMESSEN in `tests/matchday-auto-run-service.test.ts` exakt eine Schicht zuviel
 * (2,2 Punkte bei Modus "hart" auf 10 Spieltage), und ueber die Fallback-Kette
 * `getPlayerCurrentFatigue` (Availability fehlt -> `player.fatigue`) wanderte der Fehler beim
 * D2-Commit in `playerAvailabilityState` und damit in den Verletzungswurf.
 *
 * Solche Spieler werden hier deshalb UEBERSPRUNGEN: ihr Spieltag ist noch nicht gebucht. Ihre
 * Trainingsschicht schlaegt beim Commit ihrer eigenen Seite auf — dort steht `player.fatigue`
 * wieder auf reiner Match-Fatigue, und `modeByMatchday[matchdayId]` sorgt weiterhin dafuer, dass
 * die Schicht je Spieltag genau EINMAL gezaehlt wird, egal in wie vielen Teilschritten gebucht
 * wurde.
 */

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clampFatigue(value: number) {
  return Math.max(0, Math.min(100, roundValue(value)));
}

function normalizeMode(mode: Player["trainingMode"]): PlayerTrainingMode {
  return mode === "leicht" || mode === "mittel" || mode === "hart" ? mode : "mittel";
}

export function resolveSeasonTotalMatchdays(gameState: GameState): number {
  const declared = gameState.season.totalMatchdays;
  if (typeof declared === "number" && Number.isFinite(declared) && declared > 0) return Math.floor(declared);
  const fromIds = gameState.season.matchdayIds?.length ?? 0;
  return fromIds > 0 ? fromIds : 10;
}

export function accumulateMatchdayTrainingProgress(input: {
  gameState: GameState;
  seasonId: string;
  matchdayId: string;
  /** Spieler, die diese Teil-Buchung ausgelassen hat (siehe Kopfkommentar). */
  deferredPlayerIds?: ReadonlySet<string> | null;
  /**
   * Regel B (Training je Spieltag): Spieler, die an diesem Spieltag verletzungsbedingt ausfallen — auf
   * dem Stand VOR der Fatigue-/Verletzungsbuchung bestimmt (`bestimmeAusfallSpielerFuerSpieltag`).
   * Fehlt die Menge, wird sie hier aus dem uebergebenen Stand gelesen (am letzten Sperr-Spieltag
   * eines D2-Commits dann einen Spieltag zu frueh gesund — deshalb uebergibt der Spieltags-Apply sie).
   */
  ausfallSpielerIds?: ReadonlySet<string> | null;
  /** Zuwachs je Spieltag buchen (Standard: Schalter `OLY_TRAINING_JE_SPIELTAG`). Fatigue-Simulationen schalten ab. */
  mitZuwachs?: boolean;
  /**
   * DER SPIELTAG IST ERST HALB GEWERTET (Arena-Teilbuchung nach D1, Befund 21.11.,
   * docs/design/arena-fluss-21-11.md). Der Zuwachs wird dann wie sonst bestimmt und im Verlauf
   * festgehalten (`o: true`), aber NICHT auf die Attribute gebucht — das holt der Abschluss-Commit
   * (D2) mit genau diesen Zahlen nach.
   *
   * Grund: Attribute und (ligaweit neu abgeleitete) Disziplinwerte sind Eingabe der Arena. Buchte schon
   * der D1-Commit den Zuwachs, aenderte sich mitten im Spieltag der Kader: die Buehne baute den Motor
   * mit dem gerade gezeigten D1-Endstand neu auf, und der Vorlauf-Fingerabdruck fuer D2 kippte
   * (`arena_eingabe_divergenz`) — D2 wartete beim Buchen auf einen neuen Vorlauf und haette mit anderen
   * Eingaben gebucht, als die Buehne zeigte. Trainingslast, Modus und Ausfall-Entscheidung bleiben
   * unveraendert beim ersten Commit.
   */
  spieltagOffen?: boolean;
}): GameState {
  const { gameState, seasonId, matchdayId } = input;
  const spieltagOffen = input.spieltagOffen === true;
  const deferredPlayerIds = input.deferredPlayerIds ?? null;
  const rosteredPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  if (rosteredPlayerIds.size === 0) return gameState;
  const totalMatchdays = resolveSeasonTotalMatchdays(gameState);
  const now = new Date().toISOString();
  // TRAINING JE SPIELTAG (Chris, 18.11., `lib/training/spieltag-training.ts`). Schalter aus: exakt der
  // bisherige Ablauf (nur Modus zaehlen + Trainingslast), Zuwachs am Saisonende.
  const jeSpieltag = isTrainingJeSpieltagAktiv();
  const mitZuwachs = jeSpieltag && input.mitZuwachs !== false;
  const ausfall: ReadonlySet<string> = jeSpieltag
    ? (input.ausfallSpielerIds ?? bestimmeAusfallSpielerFuerSpieltag(gameState, matchdayId))
    : new Set<string>();

  // Fix A: pro Spieler das Team (Roster) auflösen und den REHA/recovery-center-Trainingsfatigue-Rabatt
  // des Teams anwenden. Reduktions-Faktor pro Team memoisiert (ein getTeamFacilityState-Aufruf je Team),
  // Faktor = 1 - reductionPct/100 (auf [0,1] geklemmt). Ohne Team/Recovery-Center = 1.0 (kein Rabatt).
  const teamIdByPlayerId = new Map<string, string>();
  for (const entry of gameState.rosters) teamIdByPlayerId.set(entry.playerId, entry.teamId);
  const reductionFactorByTeamId = new Map<string, number>();
  const resolveTrainingFatigueFactor = (playerId: string): number => {
    const teamId = teamIdByPlayerId.get(playerId);
    if (!teamId || !gameState.seasonState) return 1;
    const cached = reductionFactorByTeamId.get(teamId);
    if (cached != null) return cached;
    const reductionPct = getRecoveryTrainingFatigueReductionPct(getTeamFacilityState(gameState, teamId));
    const factor = Math.max(0, Math.min(1, 1 - reductionPct / 100));
    reductionFactorByTeamId.set(teamId, factor);
    return factor;
  };
  // Ligaweiter Kontext fuer den KI-Vorschlag (Ziel-Disziplin), erst bei Bedarf gebaut.
  let zielKontext: TrainingsZielKontext | null = null;
  const kontext = () => (zielKontext ??= baueTrainingsZielKontext(gameState, matchdayId, new Set(ausfall)));

  let mutated = false;
  let attributeChanged = false;
  const nextPlayers = gameState.players.map((player) => {
    if (!rosteredPlayerIds.has(player.id)) {
      // OFFENER ZUWACHS OHNE KADER (Review 21.11.): wer zwischen D1 und D2 den Kader verlassen hat
      // (Verkauf, Entlassung), traegt noch den beim D1-Commit festgehaltenen Zuwachs (`o`). Der
      // Abschluss-Commit bucht ihn auch fuer ihn — sonst bliebe er ewig offen. Keine Last, kein
      // neuer Eintrag: nur das schon Festgelegte wird gebucht.
      if (spieltagOffen) return player;
      const abgeschlossen = schliesseOffeneZuwaechseEinesSpielers(player, { seasonId, matchdayId, now });
      if (!abgeschlossen) return player;
      if (abgeschlossen.attributeChanged) attributeChanged = true;
      mutated = true;
      return abgeschlossen.player;
    }
    // Sein Spieltag ist noch nicht gebucht — weder Last noch Erholung, `player.fatigue` ist
    // nicht die reine Match-Fatigue. Hier anzusetzen hiesse, die Trainingsschicht ein zweites
    // Mal aufzuschlagen. Er kommt beim Commit seiner eigenen Disziplin-Seite dran.
    if (deferredPlayerIds?.has(player.id)) return player;

    const previousAccumulator =
      player.seasonTrainingAccumulator && player.seasonTrainingAccumulator.seasonId === seasonId
        ? player.seasonTrainingAccumulator
        : null;
    const priorMode = previousAccumulator?.modeByMatchday[matchdayId] ?? null;
    const priorEintrag = jeSpieltag ? (previousAccumulator?.verlauf ?? []).find((e) => e.m === matchdayId) ?? null : null;
    const verletzt = ausfall.has(player.id);
    const mode = normalizeMode(player.trainingMode);
    const trainingFatigueFactor = resolveTrainingFatigueFactor(player.id);
    const shareOf = (m: PlayerTrainingMode) => (FATIGUE_LOAD_BY_MODE[m] / totalMatchdays) * trainingFatigueFactor;

    // Exact idempotency: replaying the same matchday with the same outcome does not change the
    // accumulator itself, BUT `player.fatigue` was just re-derived to the pure match fatigue by
    // `applyFatigueAndInjuryAfterMatchday` (which carries no training fatigue). We must therefore
    // re-layer the already-accumulated training-fatigue share on top — exactly as the main path
    // below does — so a `forceReplace` with an unchanged mode does not silently drop it.
    // This stays idempotent because `player.fatigue` is the fresh pure match fatigue on every apply.
    // Je Spieltag gilt dasselbe fuer den Zuwachs: ein schon gebuchter Spieltag mit gleichem Modus
    // wird nicht neu gebucht (auch wenn das Ziel inzwischen gewechselt hat — der Wechsel wirkt ab
    // dem naechsten Spieltag). Ein Alt-Spieltag (vor dem Umstieg gezaehlt, ohne Verlaufseintrag)
    // bleibt Alt-Spieltag und wird am Saisonende gebucht.
    const unveraendert = verletzt
      ? priorEintrag?.s === "v" && priorMode == null
      : priorMode === mode && (priorEintrag == null || priorEintrag.s === "t");
    if (unveraendert && previousAccumulator) {
      const relayered = clampFatigue((player.fatigue ?? 0) + previousAccumulator.accumulatedTrainingFatigue);
      // Abschluss-Commit nach einer Teilbuchung: der beim D1-Commit festgelegte Zuwachs (`o: true`)
      // landet jetzt auf den Attributen — dieselben Zahlen, kein neues Ziel, kein neuer Wurf.
      if (!spieltagOffen && priorEintrag?.o) {
        const abgeschlossen = schliesseOffeneZuwaechseEinesSpielers(player, { seasonId, matchdayId, now });
        if (abgeschlossen) {
          if (abgeschlossen.attributeChanged) attributeChanged = true;
          mutated = true;
          return { ...abgeschlossen.player, fatigue: relayered };
        }
      }
      if (relayered === (player.fatigue ?? 0)) return player;
      mutated = true;
      return { ...player, fatigue: relayered };
    }

    const modeByMatchday = { ...(previousAccumulator?.modeByMatchday ?? {}) };
    let matchdaysCounted = previousAccumulator?.matchdaysCounted ?? 0;
    let accumulatedTrainingFatigue = previousAccumulator?.accumulatedTrainingFatigue ?? 0;
    let verlauf = previousAccumulator?.verlauf ? [...previousAccumulator.verlauf] : undefined;
    let attributeSheetStats = player.attributeSheetStats;

    // Rueckbau eines frueheren Buchens desselben Spieltags (forceReplace mit anderem Ergebnis):
    // Trainingslast des alten Modus und, je Spieltag gebucht, der alte Zuwachs.
    if (priorMode != null) {
      accumulatedTrainingFatigue -= shareOf(priorMode);
      matchdaysCounted -= 1;
      delete modeByMatchday[matchdayId];
    }
    // Ein noch offener Zuwachs (`o`) steht nicht auf den Attributen — dann gibt es nichts zurueckzunehmen.
    if (priorEintrag?.s === "t" && priorEintrag.z && !priorEintrag.o && attributeSheetStats) {
      const zurueck = { ...attributeSheetStats } as NonNullable<Player["attributeSheetStats"]>;
      for (const [attribute, wert] of Object.entries(priorEintrag.z) as Array<[PlayerGeneratorAttributeName, number]>) {
        const aktuell = zurueck[attribute];
        if (typeof aktuell === "number") zurueck[attribute] = roundValue(aktuell - wert, 3);
      }
      attributeSheetStats = zurueck;
      attributeChanged = true;
    }
    if (verlauf) verlauf = verlauf.filter((e) => e.m !== matchdayId);

    let eintrag: TrainingsSpieltagEintrag | null = null;
    if (verletzt) {
      // Regel B: kein Modus gezaehlt, keine Trainingslast, kein Zuwachs.
      eintrag = { m: matchdayId, s: "v" };
    } else {
      const fatigueShare = shareOf(mode);
      matchdaysCounted += 1;
      accumulatedTrainingFatigue += fatigueShare;
      modeByMatchday[matchdayId] = mode;
      if (mitZuwachs) {
        const spielerJetzt = attributeSheetStats === player.attributeSheetStats ? player : { ...player, attributeSheetStats };
        // Ohne vollen Attributbogen wird nichts gebucht (keine erfundenen Werte) — dann auch kein Ziel.
        const bestimmt = hatVollenAttributbogen(spielerJetzt) ? bestimmeTrainingsZiel(kontext(), spielerJetzt) : null;
        const zuwachs = bestimmt
          ? berechneSpieltagsZuwachs({
              gameState,
              player: spielerJetzt,
              ziel: bestimmt.ziel,
              quelle: bestimmt.quelle,
              modus: mode,
            })
          : null;
        eintrag = {
          m: matchdayId,
          s: "t",
          ...(bestimmt
            ? { d: bestimmt.ziel.disziplinId, w: bestimmt.ziel.weg, q: bestimmt.quelle === "manager" ? ("m" as const) : ("k" as const) }
            : {}),
          i: mode,
          l: roundValue(fatigueShare, 3),
        };
        if (zuwachs && attributeSheetStats && Object.keys(zuwachs.zuwachs).length > 0) {
          const { neu, gebucht } = bucheZuwachsAufAttribute(attributeSheetStats, zuwachs.zuwachs);
          if (neu) {
            eintrag.z = gebucht;
            if (spieltagOffen) {
              // Halber Spieltag: Zuwachs festhalten, Attribute erst mit dem Abschluss-Commit (s. Eingabe).
              eintrag.o = true;
            } else {
              attributeSheetStats = neu;
              attributeChanged = true;
            }
          }
        }
      }
    }
    if (jeSpieltag && eintrag && (mitZuwachs || verletzt)) verlauf = [...(verlauf ?? []), eintrag];
    accumulatedTrainingFatigue = Math.max(0, roundValue(accumulatedTrainingFatigue));

    // Saisonbilanz: Stand vor dem ersten je Spieltag gebuchten Zuwachs festhalten.
    const startAttribute =
      previousAccumulator?.startAttribute ??
      (mitZuwachs && player.attributeSheetStats ? pickAttributes(player.attributeSheetStats) : undefined);
    const startDisziplinwerte =
      previousAccumulator?.startDisziplinwerte ??
      (mitZuwachs && player.disciplineRatings ? { ...player.disciplineRatings } : undefined);

    mutated = true;
    return {
      ...player,
      ...(attributeSheetStats !== player.attributeSheetStats ? { attributeSheetStats } : {}),
      seasonTrainingAccumulator: {
        seasonId,
        matchdaysCounted: Math.max(0, matchdaysCounted),
        modeByMatchday,
        accumulatedTrainingFatigue,
        updatedAt: now,
        ...(verlauf ? { verlauf } : {}),
        ...(startAttribute ? { startAttribute } : {}),
        ...(startDisziplinwerte ? { startDisziplinwerte } : {}),
      },
      fatigue: clampFatigue((player.fatigue ?? 0) + accumulatedTrainingFatigue),
    };
  });

  if (!mutated) return gameState;
  const naechsterStand: GameState = { ...gameState, players: nextPlayers };
  return attributeChanged ? withRefreshedDisciplineRatings(naechsterStand) : naechsterStand;
}

/**
 * Zuwachs auf einen Attributbogen legen. Gespeichert wird die tatsaechliche Differenz nach Rundung
 * (gezeigt = gebucht); `neu` ist `null`, wenn kein Attribut wirklich steigt.
 */
function bucheZuwachsAufAttribute(
  stats: Player["attributeSheetStats"],
  zuwachs: Partial<Record<PlayerGeneratorAttributeName, number>>,
): { neu: NonNullable<Player["attributeSheetStats"]> | null; gebucht: Partial<Record<PlayerGeneratorAttributeName, number>> } {
  if (!stats) return { neu: null, gebucht: {} };
  const neu = { ...stats } as NonNullable<Player["attributeSheetStats"]>;
  const gebucht: Partial<Record<PlayerGeneratorAttributeName, number>> = {};
  for (const [attribute, wert] of Object.entries(zuwachs) as Array<[PlayerGeneratorAttributeName, number]>) {
    const vorher = neu[attribute];
    if (typeof vorher !== "number") continue;
    const nachher = roundValue(vorher + wert, 3);
    const differenz = roundValue(nachher - vorher, 3);
    if (differenz <= 0) continue;
    neu[attribute] = nachher;
    gebucht[attribute] = differenz;
  }
  return Object.keys(gebucht).length > 0 ? { neu, gebucht } : { neu: null, gebucht };
}

/**
 * Offene Zuwaechse (`o: true`, festgehalten beim D1-Teil-Commit) eines Spielers auf die Attribute buchen
 * und den Eintrag abschliessen. Mit `matchdayId` nur der Eintrag dieses Spieltags, sonst alle offenen der
 * Saison. `null`, wenn nichts offen ist. Disziplinwerte leitet der Aufrufer danach ligaweit neu ab.
 */
function schliesseOffeneZuwaechseEinesSpielers(
  player: Player,
  input: { seasonId: string; matchdayId?: string | null; now: string },
): { player: Player; attributeChanged: boolean } | null {
  const akku = player.seasonTrainingAccumulator;
  if (!akku || akku.seasonId !== input.seasonId || !akku.verlauf) return null;
  const betroffen = (e: TrainingsSpieltagEintrag) => e.o === true && (input.matchdayId == null || e.m === input.matchdayId);
  if (!akku.verlauf.some(betroffen)) return null;
  let stats = player.attributeSheetStats;
  let attributeChanged = false;
  const verlauf = akku.verlauf.map((e) => {
    if (!betroffen(e)) return e;
    const { neu, gebucht } = bucheZuwachsAufAttribute(stats, e.z ?? {});
    const abgeschlossen: TrainingsSpieltagEintrag = { ...e };
    delete abgeschlossen.o;
    if (Object.keys(gebucht).length > 0) abgeschlossen.z = gebucht;
    else delete abgeschlossen.z;
    if (neu) {
      stats = neu;
      attributeChanged = true;
    }
    return abgeschlossen;
  });
  return {
    player: {
      ...player,
      ...(stats !== player.attributeSheetStats ? { attributeSheetStats: stats } : {}),
      seasonTrainingAccumulator: { ...akku, verlauf, updatedAt: input.now },
    },
    attributeChanged,
  };
}

/**
 * Alle noch offenen Trainingszuwaechse (`o: true`) der laufenden Saison buchen — fuer die angegebenen
 * Spieler oder alle. Fuer Pfade, die einen Spieler zwischen D1- und D2-Commit aus dem Kader nehmen
 * oder eine Saison abschliessen, ohne dass der Abschluss-Commit des Spieltags noch kommt. Ohne offene
 * Eintraege: derselbe Stand (Referenz).
 */
export function schliesseOffeneTrainingsZuwaechse(
  gameState: GameState,
  input?: { playerIds?: Iterable<string> | null; matchdayId?: string | null },
): GameState {
  const nur = input?.playerIds ? new Set(input.playerIds) : null;
  const now = new Date().toISOString();
  let mutated = false;
  let attributeChanged = false;
  const players = gameState.players.map((player) => {
    if (nur && !nur.has(player.id)) return player;
    const abgeschlossen = schliesseOffeneZuwaechseEinesSpielers(player, {
      seasonId: gameState.season.id,
      matchdayId: input?.matchdayId ?? null,
      now,
    });
    if (!abgeschlossen) return player;
    mutated = true;
    if (abgeschlossen.attributeChanged) attributeChanged = true;
    return abgeschlossen.player;
  });
  if (!mutated) return gameState;
  const naechster: GameState = { ...gameState, players };
  return attributeChanged ? withRefreshedDisciplineRatings(naechster) : naechster;
}

function pickAttributes(stats: NonNullable<Player["attributeSheetStats"]>): Partial<Record<PlayerGeneratorAttributeName, number>> {
  const ergebnis: Partial<Record<PlayerGeneratorAttributeName, number>> = {};
  for (const attribute of PROGRESSION_ATTRIBUTE_ORDER) {
    const wert = stats[attribute];
    if (typeof wert === "number" && Number.isFinite(wert)) ergebnis[attribute] = wert;
  }
  return ergebnis;
}

/**
 * Nach einem je Spieltag gebuchten Zuwachs: Disziplinwerte (Rang -> Wert, ligaweit relativ) und Achsen
 * neu ableiten — derselbe Weg wie am Saisonende (`finalizeSeasonEndProgressionLeagueEconomy`), damit
 * der Zuwachs im naechsten Spiel wirkt. Marktwerte bleiben bis zum Saisonende stehen (Wirtschaft der
 * laufenden Saison, Transfers, eingefrorene Bewertungen).
 */
export function withRefreshedDisciplineRatings(gameState: GameState): GameState {
  const ratingsByPlayerId = buildLeagueDisciplineRatingsWithAttributeOverrides(gameState.players, {});
  let geaendert = false;
  const players = gameState.players.map((player) => {
    const next = ratingsByPlayerId.get(player.id);
    if (!next) return player;
    const vorher = player.disciplineRatings ?? {};
    const gleich =
      Object.keys(next).length === Object.keys(vorher).length &&
      Object.entries(next).every(([id, wert]) => vorher[id] === wert);
    if (gleich) return player;
    geaendert = true;
    return {
      ...player,
      disciplineRatings: next,
      currentDisciplineValues: next,
      coreStats: buildCoreStatsFromDisciplineRatings({
        disciplines: gameState.disciplines,
        disciplineRatings: next,
        fallback: player.coreStats,
      }),
    };
  });
  return geaendert ? { ...gameState, players } : gameState;
}
