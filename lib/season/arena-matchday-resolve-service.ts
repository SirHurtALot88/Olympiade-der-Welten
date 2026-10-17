import { loadAllLocalLegacyLineupContexts } from "@/lib/lineups/legacy-lineup-local-service";
import { attachMatchdayInjuryPerformanceToContexts, buildMatchdayInjuryRollMap } from "@/lib/fatigue/fatigue-injury-service";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import {
  APPLY_CONFIRM_TOKEN,
  LegacyMatchdayResultApplyService,
  type ApplyLegacyMatchdayResultResult,
} from "@/lib/resolve/legacy-matchday-result-apply-service";
import {
  determineArenaDisciplineContexts,
  kickoffArenaVorlauf,
  stelleArenaVorlaufSicher,
  type ArenaVorlaufOptions,
} from "@/lib/battle/arena-vorlauf-service";
import { resolveMatchdayPreviewToBook } from "@/lib/foundation/matchday-resolve-snapshot";
import { isBattleModeSave } from "@/lib/season/game-mode";
import { istKoopSchreibkonflikt } from "@/lib/persistence/koop-schreibkonflikt";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/**
 * KICKOFF-MANTEL UM DEN ARENA-VORLAUF (PR 3, K1 — Plan Abschnitt 2.8). Vor PR 3 baute diese Datei
 * ihre EIGENE, live gerechnete Preview beim Buchen (Fund F3) und hatte keinen Schutz gegen einen
 * zweiten gleichzeitigen Lauf (Fund F4). Seit PR 3 gibt es nur noch EINEN Arena-Weg: den
 * Vorlauf-Service (`lib/battle/arena-vorlauf-service.ts`), der bereits an den Lineup-Routen und am
 * Auto-Run haengt (Plan 2.3/2.4). Dieser Kickoff hier
 *
 *   1. stoesst (idempotent, entdoppelt) denselben Vorlauf an, falls er fuer die aktuelle
 *      Aufstellungs-Signatur noch nicht fertig ist, und antwortet dann `in_progress` — GENAUSO wie
 *      vorher, nur ohne eine zweite Arena-Implementierung dahinter;
 *   2. bucht SYNCHRON den fertigen Snapshot (`resolveMatchdayPreviewToBook()`), wenn der Vorlauf
 *      schon `"ready"` oder `"failed"` ist (beide Zustaende sind terminal, s. Plan 2.1/2.5) — dieser
 *      Codepfad startet dafuer KEIN Chromium mehr, er liest nur.
 *
 * SICHERHEITSRAHMEN unveraendert: `applicable: false` fuer Manager Mode oder einen Spieltag ohne
 * arena-aufgeloeste Disziplin an D1/D2 — der Aufrufer (die Apply-Route) faellt dann auf den
 * bisherigen synchronen Pfad zurueck.
 */

export type ArenaMatchdayApplyKickoffInput = {
  persistence: PersistenceService;
  saveId: string;
  /** Weggelassen -> wird aus dem geladenen Save (`gameState.season.id`) gelesen. */
  seasonId?: string;
  matchdayId: string;
  forceReplace?: boolean;
  allowIncompleteOverride?: boolean;
  /** Log-Praefix fuer console.warn/console.error, z. B. "[legacy-matchday-apply]". */
  logPrefix: string;
} & ArenaVorlaufOptions;

export type ArenaMatchdayApplyKickoffResult =
  | { applicable: false }
  | { applicable: true; booked: false; status: "in_progress" | "failed"; save: PersistedSaveGame }
  | { applicable: true; booked: true; result: ApplyLegacyMatchdayResultResult };

export async function kickoffArenaMatchdayApply(
  input: ArenaMatchdayApplyKickoffInput,
): Promise<ArenaMatchdayApplyKickoffResult> {
  const { persistence, saveId, matchdayId, logPrefix } = input;

  const current = persistence.getSaveById(saveId);
  if (!current) {
    return { applicable: false };
  }
  if (!isBattleModeSave(current.gameState)) {
    return { applicable: false };
  }
  const seasonId = input.seasonId ?? current.gameState.season.id;
  const scope = { saveId, seasonId, matchdayId };

  // `allowIncompleteField: true` IMMER (nicht an `input.allowIncompleteOverride` gekoppelt): der
  // Kickoff ist, anders als die drei automatischen Ausloeser (Lineup-Routen, Arena-Base-Route,
  // Auto-Run, Plan Abschnitt 2.3), keiner, der auf "das Feld steht" warten sollte -- er IST die
  // explizite Admin-Aktion ("2. Result lokal anwenden"). Vor PR 3 kannte dieser Pfad ueberhaupt
  // keine Vollstaendigkeits-Schranke (`determineArenaDisciplineContexts()` brauchte nie eine
  // komplette Einsatzliste, s. Dateikopf-Kommentar an `tests/arena-matchday-weg-b-beide-
  // disziplinen.test.ts`) -- dieser Mantel erzwingt dafuer notfalls einen Snapshot auch ohne
  // vollstaendiges Feld, NUR fuer diesen einen Aufruf, damit sich daran nichts aendert.
  const vorlauf = kickoffArenaVorlauf(
    scope,
    {
      runArenaFixturesImpl: input.runArenaFixturesImpl,
      runArenaFixturesOptions: input.runArenaFixturesOptions,
      allowIncompleteField: true,
    },
    persistence,
  );
  if (!vorlauf.applicable) {
    return { applicable: false };
  }

  // `status === null`: trotz `allowIncompleteField` konnte kein Snapshot entstehen (z. B. keine
  // ladbaren Contexts ueberhaupt). Das ist NICHT "laeuft gerade" -- es laeuft NICHTS und wird
  // auch nichts anlaufen -- `applicable: false` gibt hier GENAU dieselbe Antwort wie "kein
  // Arena-Pfad betroffen", der Aufrufer (die Route) faellt auf `LegacyMatchdayResultApplyService`
  // zurueck, wie vor PR 3.
  if (vorlauf.status === null) {
    return { applicable: false };
  }

  if (vorlauf.status === "in_progress") {
    const markedInProgress = schreibeArenaMatchdayResolveStatus(persistence, saveId, "in_progress");
    // UEBERGANGSFELD-MIRROR (Plan 2.8): der Vorlauf selbst schreibt nur den neuen, spieltagsfesten
    // `ArenaVorlaufRecord` -- NICHT das alte, saveweite `arenaMatchdayResolveStatus` (Poller/Banner
    // lesen es waehrend der Uebergangszeit weiter, s. Dateikopf-Kommentar). Dieser detachte
    // Watcher haengt sich ueber dieselbe In-Prozess-Entdopplung (Signatur-Schluessel,
    // `arena-vorlauf-service.ts`) an GENAU DEN Lauf, den `kickoffArenaVorlauf()` oben schon
    // gestartet hat -- KEIN zweiter Chromium-Lauf -- und spiegelt dessen Endzustand ins alte Feld,
    // sobald er fertig ist, auch wenn niemand `kickoffArenaMatchdayApply()` dafuer erneut aufruft.
    void stelleArenaVorlaufSicher(
      scope,
      {
        runArenaFixturesImpl: input.runArenaFixturesImpl,
        runArenaFixturesOptions: input.runArenaFixturesOptions,
        allowIncompleteField: true,
      },
      persistence,
    )
      .then((ergebnis) => {
        schreibeArenaMatchdayResolveStatus(persistence, saveId, ergebnis.status === "ready" ? "ready" : "failed");
      })
      .catch((error) => {
        console.error(`${logPrefix} Arena-Vorlauf-Spiegelung ins Uebergangsfeld fehlgeschlagen:`, error);
        schreibeArenaMatchdayResolveStatus(persistence, saveId, "failed");
      });
    return { applicable: true, booked: false, status: "in_progress", save: markedInProgress ?? current };
  }

  // "ready" ODER "failed" — beide terminal (Plan 2.1/2.5): der Vorlauf hat die Arbeit bereits
  // getan, hier wird nur noch der Snapshot gebucht. KEIN Chromium-Start mehr auf diesem Pfad.
  const refreshed = persistence.getSaveById(saveId);
  if (!refreshed) {
    console.error(`${logPrefix} Arena-Matchday-Apply: Save ${saveId} verschwand waehrend des Arena-Vorlaufs.`);
    const markedFailed = schreibeArenaMatchdayResolveStatus(persistence, saveId, "failed");
    return { applicable: true, booked: false, status: "failed", save: markedFailed ?? current };
  }

  const contextResults = loadAllLocalLegacyLineupContexts(scope, persistence);
  const { contexts } = determineArenaDisciplineContexts(contextResults);
  if (contexts.length === 0) {
    console.error(`${logPrefix} Arena-Matchday-Apply: keine ladbaren Lineup-Contexts fuer ${matchdayId}.`);
    const markedFailed = schreibeArenaMatchdayResolveStatus(persistence, saveId, "failed");
    return { applicable: true, booked: false, status: "failed", save: markedFailed ?? refreshed };
  }

  const injuryRollMap = buildMatchdayInjuryRollMap({ gameState: refreshed.gameState, saveId, seasonId, matchdayId });
  attachMatchdayInjuryPerformanceToContexts(contexts, injuryRollMap);
  // Nur der FALLBACK, falls `resolveMatchdayPreviewToBook()` den Snapshot verwirft (veraltete
  // Signatur, arenaEingabeHash-Divergenz, Opus-Auflage B2) — dann wird live gerechnet, GENAU wie
  // der Auto-Run es fuer diesen Fall tut.
  const liveFallbackPreview = buildLegacyMatchdayResolvePreview(contexts);
  const previewToBook = resolveMatchdayPreviewToBook({ gameState: refreshed.gameState, scope, livePreview: liveFallbackPreview });

  // OPUS-REVIEW B3 (kritisch): GENAU wie im Auto-Run (`matchday-auto-run-service.ts`) -- ein als
  // "ready" gespeicherter Vorlauf, dessen `arenaEingabeHash` beim Buchen nicht mehr passt, wird
  // NICHT als Bruecke gebucht. Ein frischer Versuch wird erzwungen und synchron abgewartet (der
  // Kickoff-Pfad ist ohnehin schon async/wartend, anders als der HTTP-"hintergrund"-Modus des
  // Auto-Run); divergiert es danach immer noch, bleibt es bei "in_progress" statt zu buchen.
  if (previewToBook.arenaEingabeDivergenz) {
    console.error(`${logPrefix} Arena-Matchday-Apply: arenaEingabeHash-Divergenz beim Buchen -- erzwinge frischen Vorlauf statt die Bruecke zu buchen.`);
    const erneuterVersuch = await stelleArenaVorlaufSicher(
      scope,
      { runArenaFixturesImpl: input.runArenaFixturesImpl, runArenaFixturesOptions: input.runArenaFixturesOptions, erzwingeNeuenVersuch: true },
      persistence,
    );
    const markedInProgress = schreibeArenaMatchdayResolveStatus(persistence, saveId, erneuterVersuch.status === "ready" ? "ready" : "in_progress");
    const nachErneutemVersuch = persistence.getSaveById(saveId);
    const previewNachErneutemVersuch = nachErneutemVersuch
      ? resolveMatchdayPreviewToBook({ gameState: nachErneutemVersuch.gameState, scope, livePreview: liveFallbackPreview })
      : previewToBook;
    if (previewNachErneutemVersuch.arenaEingabeDivergenz || !nachErneutemVersuch) {
      // Divergiert immer noch (oder der Save verschwand) -- NICHT buchen, Aufrufer pollt weiter.
      return { applicable: true, booked: false, status: "in_progress", save: markedInProgress ?? refreshed };
    }
    return bucheArenaSnapshot({
      persistence,
      saveId,
      seasonId,
      matchdayId,
      contexts,
      preview: previewNachErneutemVersuch.preview,
      forceReplace: input.forceReplace,
      allowIncompleteOverride: input.allowIncompleteOverride,
      logPrefix,
      refreshed: nachErneutemVersuch,
    });
  }

  return bucheArenaSnapshot({
    persistence,
    saveId,
    seasonId,
    matchdayId,
    contexts,
    preview: previewToBook.preview,
    forceReplace: input.forceReplace,
    allowIncompleteOverride: input.allowIncompleteOverride,
    logPrefix,
    refreshed,
  });
}

async function bucheArenaSnapshot(input: {
  persistence: PersistenceService;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  contexts: ReturnType<typeof determineArenaDisciplineContexts>["contexts"];
  preview: ReturnType<typeof buildLegacyMatchdayResolvePreview>;
  forceReplace?: boolean;
  allowIncompleteOverride?: boolean;
  logPrefix: string;
  refreshed: PersistedSaveGame;
}): Promise<ArenaMatchdayApplyKickoffResult> {
  const { persistence, saveId, seasonId, matchdayId, contexts, preview, logPrefix, refreshed } = input;
  const service = new LegacyMatchdayResultApplyService(undefined, undefined, persistence);
  const result = await service.applyLegacyMatchdayResult({
    saveId,
    seasonId,
    matchdayId,
    source: "sqlite",
    dryRun: false,
    execute: true,
    confirm: APPLY_CONFIRM_TOKEN,
    forceReplace: input.forceReplace,
    allowIncompleteOverride: input.allowIncompleteOverride,
    preloadedContexts: contexts,
    preloadedPreview: preview,
  });

  if (!result.ok || !result.applied) {
    console.error(`${logPrefix} Arena-Matchday-Apply nicht erfolgreich gebucht:`, result);
    const markedFailed = schreibeArenaMatchdayResolveStatus(persistence, saveId, "failed");
    return { applicable: true, booked: false, status: "failed", save: markedFailed ?? refreshed };
  }

  schreibeArenaMatchdayResolveStatus(persistence, saveId, "ready");
  return { applicable: true, booked: true, result };
}

/**
 * UEBERGANGSFELD (Plan 2.8): `seasonState.arenaMatchdayResolveStatus` ist das ALTE, saveweite
 * Einzelfeld ohne Spieltag/Zeitstempel (Befund F5) — Poller und Banner lesen es heute noch. Es wird
 * hier weiterhin mitgeschrieben, abgeleitet aus dem neuen, spieltagsfesten `ArenaVorlaufRecord`,
 * bis Poller/Banner vollstaendig auf `arenaVorlauf` (je Spieltag) umgestellt sind — dann entfaellt
 * dieses Feld.
 */
function schreibeArenaMatchdayResolveStatus(
  persistence: PersistenceService,
  saveId: string,
  status: "in_progress" | "ready" | "failed",
): PersistedSaveGame | null {
  for (let versuch = 1; versuch <= 3; versuch += 1) {
    const save = persistence.getSaveById(saveId);
    if (!save) return null;
    try {
      return persistence.saveSingleplayerState(saveId, {
        ...save.gameState,
        seasonState: { ...save.gameState.seasonState, arenaMatchdayResolveStatus: status },
      });
    } catch (error) {
      if (!istKoopSchreibkonflikt(error)) {
        throw error;
      }
    }
  }
  return null;
}
