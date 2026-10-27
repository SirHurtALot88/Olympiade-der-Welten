import { leseAntwortAlsJson } from "@/lib/foundation/antwort-als-json";
import type { Dispatch, SetStateAction } from "react";

import type { FoundationSaveMode } from "@/lib/persistence/foundation-save-mode";
import { invalidateMatchdayArenaSessionCache } from "@/lib/foundation/matchday-arena-session-cache";
import { clearPrefetchedMatchdayArenaBaseKeys } from "@/lib/foundation/foundation-panel-prefetch";
import type { LegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";
import type {
  FoundationApplySummary,
  FoundationMatchdayAutoRunSummary,
  FoundationMatchdayMvpScoringResponse,
} from "@/lib/foundation/tabs/cockpit-types";
import {
  ADVANCE_MATCHDAY_CONFIRM_TOKEN,
  CASH_APPLY_CONFIRM_TOKEN,
  MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
  MATCHDAY_MVP_SCORING_CONFIRM_TOKEN,
  RESULT_APPLY_CONFIRM_TOKEN,
  STANDINGS_APPLY_CONFIRM_TOKEN,
} from "@/lib/foundation/tabs/cockpit-confirm-tokens";

export type CockpitMatchdayApplyHandlersDeps = {
  readMetaSource: "sqlite" | "prisma";
  showReadOnlyNotice: () => void;
  setCockpitBusyKey: Dispatch<SetStateAction<string | null>>;
  withRoomBody: <T extends Record<string, unknown>>(body: T) => Record<string, unknown>;
  activeSaveId: string;
  seasonId: string;
  matchdayId: string;
  firstMatchdayId: string;
  matchdayMvpForceReplaceExisting: boolean;
  matchdayAutoRunIncludeWarningLineups: boolean;
  matchdayAutoRunOverwriteExistingLineups: boolean;
  matchdayAutoRunStopOnTie: boolean;
  setResultApplyFeed: Dispatch<SetStateAction<FoundationApplySummary | null>>;
  setStandingsApplyFeed: Dispatch<SetStateAction<FoundationApplySummary | null>>;
  setCashApplyFeed: Dispatch<SetStateAction<FoundationApplySummary | null>>;
  setMatchdayAdvanceFeed: Dispatch<SetStateAction<FoundationApplySummary | null>>;
  setMatchdayAutoRunFeed: Dispatch<SetStateAction<FoundationMatchdayAutoRunSummary | null>>;
  setMatchdayMvpScoringFeed: Dispatch<SetStateAction<FoundationMatchdayMvpScoringResponse | null>>;
  reloadResolvePreview: (signal?: AbortSignal) => Promise<unknown>;
  reloadStandingsPreviewFeed: (signal?: AbortSignal) => Promise<unknown>;
  reloadPrizePreviewFeed: () => Promise<unknown>;
  reloadLiveSeasonState: (
    reason?: "manual_apply" | "room_event" | "local_save_version",
    options?: { skipGameStateReload?: boolean; reloadFullGameState?: boolean; compactReload?: boolean },
  ) => Promise<unknown>;
  loadSave: (
    saveId?: string,
    saveMode?: FoundationSaveMode,
    options?: { compactInitial?: boolean },
  ) => Promise<unknown>;
  reloadSeasonStandingsOverview: () => Promise<unknown>;
  reloadSeasonManagementOverview: () => Promise<unknown>;
  reloadHistoryFeed: () => Promise<unknown>;
  reloadTransferRecapFeed: () => Promise<unknown>;
  bumpMarketReloadToken: () => void;
  setFoundationActionFeedback: Dispatch<
    SetStateAction<{
      tone: "success" | "warning" | "info" | "blocked" | "error";
      title: string;
      detail: string;
    } | null>
  >;
};

export type CockpitMatchdayMvpScoringFeed = FoundationMatchdayMvpScoringResponse & { error?: string };

export type CockpitMatchdayApplyHandlers = {
  runCockpitMatchdayMvpScoring: (execute: boolean) => Promise<CockpitMatchdayMvpScoringFeed | null>;
  runCockpitResultApply: (execute: boolean) => Promise<FoundationApplySummary | null>;
  /** `forceReplace` ist der Gleichstands-Notausgang — siehe die Erklaerung an der Implementierung. */
  runCockpitStandingsApply: (execute: boolean, forceReplace?: boolean) => Promise<FoundationApplySummary | null>;
  runCockpitCashApply: (execute: boolean) => Promise<FoundationApplySummary | null>;
  runCockpitMatchdayAdvance: (execute: boolean) => Promise<FoundationApplySummary | null>;
  runCockpitMatchdayAutoRun: (
    execute: boolean,
    commitThroughSide?: "d1" | "d2",
    /** Default `true` (Cockpit). Die Arena uebergibt `false` — sie schaltet ueber
     *  „Spieltag abschliessen" weiter, damit die Spieltagstabelle stehen bleibt. */
    advanceAfterCashApply?: boolean,
    /** Die Preview, die die Arena gezeigt hat — sie wird gebucht statt neu gerechnet. */
    submittedPreview?: LegacyMatchdayResolvePreview | null,
    /**
     * Lauf-Optionen, die den Cockpit-Schaltern VORGEHEN.
     *
     * Die Arena hat sie vorher gesetzt, indem sie `setMatchdayAutoRunStopOnTie(false)` &Co. rief und
     * unmittelbar danach diesen Lauf startete. Das konnte nicht wirken: die Setter aktualisieren erst
     * beim naechsten Render, waehrend dieser Handler seine Werte aus dem Closure des AKTUELLEN
     * Renders liest. Der Lauf sah also weiter die alten Schalter — `stopOnTie` blieb bei seinem
     * Default `true`.
     */
    optionOverrides?: {
      includeWarningLineups?: boolean;
      overwriteExistingLineups?: boolean;
      stopOnTie?: boolean;
      /**
       * QUICK-SIM (27.10.): die Buehne bucht nach "⏩ Quick-Sim" -- der Server rechnet den
       * Arena-Vorlauf dann per Node statt Chromium (`arenaModus: "quick-sim"`). Cockpit: nie.
       */
      arenaQuickSim?: boolean;
    },
  ) => Promise<FoundationMatchdayAutoRunSummary | null>;
  /**
   * "Spieltag komplett ausführen" — EIN Klick statt zwei (s. Erklärung an der Implementierung).
   * Fragt bei laufendem Arena-Vorlauf automatisch weiter nach, statt einen zweiten Klick zu
   * verlangen.
   */
  runCockpitMatchdayAutoRunWithAutoRetry: () => Promise<FoundationMatchdayAutoRunSummary | null>;
};

/**
 * Matchday apply pipeline handlers (Strangler Phase 5.3+).
 * Result / standings / cash apply, matchday advance, auto-run, MVP scoring.
 */
export function createCockpitMatchdayApplyHandlers(
  deps: CockpitMatchdayApplyHandlersDeps,
): CockpitMatchdayApplyHandlers {
  const {
    readMetaSource,
    showReadOnlyNotice,
    setCockpitBusyKey,
    withRoomBody,
    activeSaveId,
    seasonId,
    matchdayId,
    firstMatchdayId,
    matchdayMvpForceReplaceExisting,
    matchdayAutoRunIncludeWarningLineups,
    matchdayAutoRunOverwriteExistingLineups,
    matchdayAutoRunStopOnTie,
    setResultApplyFeed,
    setStandingsApplyFeed,
    setCashApplyFeed,
    setMatchdayAdvanceFeed,
    setMatchdayAutoRunFeed,
    setMatchdayMvpScoringFeed,
    reloadResolvePreview,
    reloadStandingsPreviewFeed,
    reloadPrizePreviewFeed,
    reloadLiveSeasonState,
    loadSave,
    reloadSeasonStandingsOverview,
    reloadSeasonManagementOverview,
    reloadHistoryFeed,
    reloadTransferRecapFeed,
    bumpMarketReloadToken,
    setFoundationActionFeedback,
  } = deps;

  /**
   * KI-AUFSTELLUNGEN FUER DEN NEUEN SPIELTAG — IM HINTERGRUND, NICHT IM SPIELTAGSWECHSEL.
   *
   * Das Erzeugen fuer 32 Teams kostet gemessen 15-21 s. Frueher lief es mitten im
   * Spieltagswechsel (`writeLocalMatchdayAdvance`) und machte 82 % der 46,7 s aus, die
   * „Spieltag abschliessen" gebraucht hat. Der Wechsel schreibt jetzt nur noch den
   * Spieltag; angestossen wird hier, wenn der Spieler wieder im Saisonstand steht und die
   * Oberflaeche ohnehin bedienbar ist.
   *
   * BEWUSST NICHT ABGEWARTET (`void`, kein `await`): Der Aufruf darf den Auto-Run nicht
   * verlaengern — sonst waere nichts gewonnen, die Wartezeit stuende nur an anderer Stelle.
   * Aus demselben Grund setzt er auch KEINEN `cockpitBusyKey`: der sperrt die Bedienung,
   * und gesperrt werden soll hier gerade nichts.
   *
   * FEHLER SIND FOLGENLOS: Der Spieltags-Lauf und das Speichern der eigenen Aufstellung
   * rufen den Batch ohnehin selbst auf und holen Fehlendes nach. Ein gescheiterter oder
   * abgebrochener Aufwaermlauf verschiebt darum nur den Zeitpunkt, er verliert nichts.
   * Deshalb wird ein Fehlschlag hier auch nur leise gemeldet und nicht als Stoerung.
   */
  function startAiLineupPrewarm() {
    if (readMetaSource === "prisma") {
      return;
    }
    void (async () => {
      try {
        const response = await fetch(
          `/api/lineups/legacy/ai-batch-prewarm?saveId=${encodeURIComponent(activeSaveId)}&seasonId=${encodeURIComponent(seasonId)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(withRoomBody({})),
          },
        );
        if (!response.ok) {
          return;
        }
        const payload = (await leseAntwortAlsJson(response)) as { skipped?: boolean; summary?: { savedTeams?: number } };
        if (payload.skipped || !payload.summary?.savedTeams) {
          return;
        }
        // Nur melden, wenn wirklich etwas entstanden ist — sonst waere es Rauschen.
        setFoundationActionFeedback({
          tone: "info",
          title: "KI-Aufstellungen stehen",
          detail: `${payload.summary.savedTeams} Teams haben für den neuen Spieltag aufgestellt.`,
        });
      } catch {
        // Siehe oben: folgenlos, der naechste regulaere Aufruf holt es nach.
      }
    })();
  }

  async function runCockpitMatchdayMvpScoring(execute: boolean) {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey(execute ? "matchday-mvp-apply" : "matchday-mvp-dry-run");
    try {
      const response = await fetch("/api/season/matchday-mvp-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveId: activeSaveId,
          seasonId,
          matchdayId: firstMatchdayId,
          source: readMetaSource,
          dryRun: !execute,
          execute,
          confirmToken: execute ? MATCHDAY_MVP_SCORING_CONFIRM_TOKEN : undefined,
          forceReplace: matchdayMvpForceReplaceExisting,
        }),
      });
      const payload = (await leseAntwortAlsJson(response)) as {
        success?: boolean;
        summary?: FoundationMatchdayMvpScoringResponse;
        error?: string;
      };
      const nextFeed = payload.summary ? { ...payload.summary, error: payload.error } : null;
      setMatchdayMvpScoringFeed(nextFeed);

      if (execute && response.ok && nextFeed?.executed) {
        setResultApplyFeed({
          ok: true,
          source: "sqlite",
          dryRun: false,
          applied: nextFeed.resultApply.applied,
          summary: {
            matchdayResultId: nextFeed.resultApply.matchdayResultId ?? undefined,
            previewStatus: nextFeed.resolveStatus,
            blockingReasons: nextFeed.blockingReasons,
            warnings: nextFeed.warnings,
          },
        });
        setStandingsApplyFeed({
          ok: true,
          source: "sqlite",
          dryRun: false,
          applied: nextFeed.standingsApply.applied,
          auditLogId: nextFeed.standingsApply.auditLogId,
          summary: {
            auditLogId: nextFeed.standingsApply.auditLogId,
            blockingReasons: nextFeed.blockingReasons,
            warnings: nextFeed.warnings,
          },
        });
        await Promise.all([
          loadSave(activeSaveId),
          reloadResolvePreview(),
          reloadStandingsPreviewFeed(),
          reloadPrizePreviewFeed(),
          reloadSeasonStandingsOverview(),
          reloadSeasonManagementOverview(),
          reloadHistoryFeed(),
          reloadTransferRecapFeed(),
        ]);
        bumpMarketReloadToken();
      }

      return nextFeed;
    } finally {
      setCockpitBusyKey(null);
    }
  }

  async function runCockpitResultApply(execute: boolean) {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey(execute ? "result-apply" : "result-dry-run");
    try {
      const response = await fetch("/api/resolve/legacy-matchday-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withRoomBody({
            saveId: activeSaveId,
            seasonId,
            matchdayId,
            source: readMetaSource,
            dryRun: !execute,
            execute,
            confirm: execute ? RESULT_APPLY_CONFIRM_TOKEN : undefined,
          }),
        ),
      });
      const payload = (await leseAntwortAlsJson(response)) as FoundationApplySummary;
      setResultApplyFeed(payload);
      if (execute && response.ok && payload.applied) {
        await Promise.all([reloadResolvePreview(), reloadStandingsPreviewFeed()]);
      }
      return payload;
    } finally {
      setCockpitBusyKey(null);
    }
  }

  /**
   * @param forceReplace Notausgang fuer einen Gleichstand.
   *
   *   `prepareStandingsApply` blockiert bei `tieGroups.length > 0`, solange dieses Flag fehlt
   *   (standings-apply-service.ts). Das Cockpit hat es nie mitgeschickt — bei einem exakten
   *   Gleichstand war der Apply-Knopf deshalb dauerhaft gesperrt, und mit ihm der einzige manuelle
   *   Weg, einen haengenden Spieltag zu buchen.
   *
   *   Es umgeht auch den Doppel-Schutz, deshalb setzt es NUR der Aufrufer, der vorher im DryRun
   *   geprueft hat, dass ausschliesslich Gleichstands-Gruende blockieren — siehe
   *   `recoverMissingStandingsApply`.
   */
  async function runCockpitStandingsApply(execute: boolean, forceReplace = false) {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey(execute ? "standings-apply" : "standings-dry-run");
    try {
      const response = await fetch("/api/standings/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withRoomBody({
            saveId: activeSaveId,
            seasonId,
            matchdayId,
            source: readMetaSource,
            dryRun: !execute,
            execute,
            forceReplace,
            confirm: execute ? STANDINGS_APPLY_CONFIRM_TOKEN : undefined,
          }),
        ),
      });
      const payload = (await leseAntwortAlsJson(response)) as FoundationApplySummary;
      setStandingsApplyFeed(payload);
      if (execute && response.ok && payload.applied) {
        await reloadLiveSeasonState("manual_apply");
      }
      return payload;
    } finally {
      setCockpitBusyKey(null);
    }
  }

  async function runCockpitCashApply(execute: boolean) {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey(execute ? "cash-apply" : "cash-dry-run");
    try {
      const response = await fetch("/api/season/cash-prize-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withRoomBody({
            saveId: activeSaveId,
            seasonId,
            matchdayId,
            source: readMetaSource,
            phase: "season_end",
            dryRun: !execute,
            execute,
            confirm: execute ? CASH_APPLY_CONFIRM_TOKEN : undefined,
          }),
        ),
      });
      const payload = (await leseAntwortAlsJson(response)) as FoundationApplySummary;
      setCashApplyFeed(payload);
      if (execute && response.ok && payload.applied) {
        await Promise.all([loadSave(activeSaveId), reloadPrizePreviewFeed(), reloadStandingsPreviewFeed()]);
        bumpMarketReloadToken();
      }
      return payload;
    } finally {
      setCockpitBusyKey(null);
    }
  }

  async function runCockpitMatchdayAdvance(execute: boolean) {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey(execute ? "matchday-advance" : "matchday-advance-dry-run");
    try {
      const response = await fetch("/api/season/advance-matchday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withRoomBody({
            saveId: activeSaveId,
            seasonId,
            source: readMetaSource,
            dryRun: !execute,
            execute,
            confirm: execute ? ADVANCE_MATCHDAY_CONFIRM_TOKEN : undefined,
          }),
        ),
      });
      const payload = (await leseAntwortAlsJson(response)) as FoundationApplySummary;
      setMatchdayAdvanceFeed(payload);
      if (execute && response.ok && payload.applied) {
        invalidateMatchdayArenaSessionCache({
          saveId: activeSaveId,
          seasonId,
        });
        clearPrefetchedMatchdayArenaBaseKeys({
          saveId: activeSaveId,
          seasonId,
        });
        setFoundationActionFeedback({
          tone: "success",
          title: "Spieltag weitergeschaltet",
          detail: "Matchday wurde geschrieben. Tabelle, Preisgeld-Preview und nächster Spieltag sind aktualisiert.",
        });
        await Promise.all([loadSave(activeSaveId), reloadResolvePreview(), reloadStandingsPreviewFeed(), reloadPrizePreviewFeed()]);
        bumpMarketReloadToken();
      }
      return payload;
    } finally {
      setCockpitBusyKey(null);
    }
  }

  type MatchdayAutoRunOptionOverrides = {
    includeWarningLineups?: boolean;
    overwriteExistingLineups?: boolean;
    stopOnTie?: boolean;
    /**
     * QUICK-SIM (27.10.): die Buehne bucht nach "⏩ Quick-Sim" -- der Server rechnet den
     * Arena-Vorlauf dann per Node statt Chromium (`arenaModus: "quick-sim"`). Cockpit: nie.
     */
    arenaQuickSim?: boolean;
  };

  /** Ein einzelner POST an `/api/season/matchday-auto-run`, ohne Busy-Key- oder Folgefahrt-Logik. */
  async function performMatchdayAutoRunCall(
    execute: boolean,
    commitThroughSide: "d1" | "d2",
    advanceAfterCashApply: boolean,
    submittedPreview: LegacyMatchdayResolvePreview | null,
    optionOverrides: MatchdayAutoRunOptionOverrides,
  ): Promise<FoundationMatchdayAutoRunSummary | null> {
    const response = await fetch("/api/season/matchday-auto-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        withRoomBody({
          saveId: activeSaveId,
          seasonId,
          matchdayId,
          source: readMetaSource,
          dryRun: !execute,
          execute,
          confirmToken: execute ? MATCHDAY_AUTO_RUN_CONFIRM_TOKEN : undefined,
          options: {
            includeWarningLineups: optionOverrides.includeWarningLineups ?? matchdayAutoRunIncludeWarningLineups,
            overwriteExistingLineups:
              optionOverrides.overwriteExistingLineups ?? matchdayAutoRunOverwriteExistingLineups,
            stopOnTie: optionOverrides.stopOnTie ?? matchdayAutoRunStopOnTie,
            advanceAfterCashApply,
            commitThroughSide,
            submittedPreview,
            ...(optionOverrides.arenaQuickSim ? { arenaQuickSim: true } : {}),
          },
        }),
      ),
    });
    const payload = (await leseAntwortAlsJson(response)) as {
      success?: boolean;
      summary?: FoundationMatchdayAutoRunSummary;
    };
    if (payload.summary) {
      setMatchdayAutoRunFeed(payload.summary);
    }
    return payload.summary ?? null;
  }

  /** Nachlauf nach einer AUSFUEHRENDEN Buchung (egal ob erfolgreich oder blockiert) — Caches
   *  invalidieren und die betroffenen Feeds neu laden. Laeuft deshalb genau EINMAL je Knopfdruck
   *  bzw. genau einmal am Ende der Pruefschleife unten, nie je Poll-Versuch — sonst wuerde ein
   *  haengender Arena-Vorlauf alle paar Sekunden denselben vollen Reload-Schwung ausloesen. */
  async function applyMatchdayAutoRunSideEffects() {
    invalidateMatchdayArenaSessionCache({
      saveId: activeSaveId,
      seasonId,
    });
    clearPrefetchedMatchdayArenaBaseKeys({
      saveId: activeSaveId,
      seasonId,
    });
    await Promise.all([loadSave(activeSaveId), reloadResolvePreview(), reloadStandingsPreviewFeed(), reloadPrizePreviewFeed()]);
    bumpMarketReloadToken();
    startAiLineupPrewarm();
  }

  async function runCockpitMatchdayAutoRun(
    execute: boolean,
    // Die Arena bucht pro Disziplin: nach D1 mit `"d1"` (nur D1 landet im Saisonstand,
    // kein Spieltagswechsel), nach D2 mit `"d2"` (Spieltag komplett). Ohne Angabe bleibt
    // es beim vollstaendigen Durchlauf, wie ihn das Cockpit ausloest.
    commitThroughSide: "d1" | "d2" = "d2",
    /**
     * Direkt nach der Wertung auf den naechsten Spieltag weiterschalten.
     *
     * Fuer das Cockpit weiter der Default (`true`) — dort ist der Auto-Run genau
     * "Spieltag durchziehen". Die ARENA gibt `false` mit: sonst sprang die Ansicht
     * unmittelbar nach D2 auf den naechsten Spieltag, und die gerade gespielte
     * Spieltagstabelle war weg, bevor man sie ansehen konnte. Weitergeschaltet wird
     * dort ueber den expliziten "Spieltag abschliessen"-Knopf.
     */
    advanceAfterCashApply = true,
    /**
     * Die Preview, die die Arena dem Spieler gerade gezeigt hat.
     *
     * Ohne sie rechnet der Server ein zweites Mal — und weil die Engine zwar deterministisch ist,
     * aber ueber den Zustand rechnet, den sie IM MOMENT DES BUCHENS vorfindet, wich das gebuchte
     * Ergebnis von dem ab, das gerade ueber den Schirm gelaufen war. Das Cockpit hat keine Buehne
     * vor sich und laesst das Feld leer.
     */
    submittedPreview: LegacyMatchdayResolvePreview | null = null,
    /**
     * Lauf-Optionen, die den Cockpit-Schaltern vorgehen — siehe die Erklaerung am Typ.
     * Ohne Angabe gelten die Schalter wie bisher.
     */
    optionOverrides: MatchdayAutoRunOptionOverrides = {},
  ) {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey(execute ? "matchday-auto-run-execute" : "matchday-auto-run-dry-run");
    try {
      const summary = await performMatchdayAutoRunCall(
        execute,
        commitThroughSide,
        advanceAfterCashApply,
        submittedPreview,
        optionOverrides,
      );
      if (execute) {
        await applyMatchdayAutoRunSideEffects();
      }
      return summary;
    } finally {
      setCockpitBusyKey(null);
    }
  }

  // PRUEFSCHLEIFE STATT ZWEITEM KLICK — Chris, woertlich: „Kannst du denn den Fehler nicht
  // abfangen, dass man zweimal druecken muss, sondern dass man einmal drueckt, aber der dann
  // direkt eine Pruefschleife macht?"
  //
  // Solange der Arena-Vorlauf (die Disziplin-Simulation fuer den Spieltag) im Hintergrund noch
  // rechnet, antwortet der Server mit 202 und `blockingReasons: ["arena_vorlauf_laeuft"]` (bzw.
  // "arena_eingabe_divergenz", wenn sich die Aufstellung seither geaendert hat und ein neuer
  // Vorlauf angestossen wurde) — s. `matchday-auto-run-service.ts`. Vorher musste der Spieler das
  // selbst erkennen und den Knopf erneut druecken, teils mehrfach.
  //
  // EIN ERNEUTER POST IST DABEI GEFAHRLOS: `kickoffArenaVorlauf` (arena-vorlauf-service.ts) ist
  // idempotent — ein laufender Vorlauf wird nicht neu angestossen, nur sein Fortschritt gelesen —,
  // und die KI-Aufstellungen werden pro Team nur geschrieben, wenn noch kein Draft existiert.
  // Genau dieses Muster nutzt die Arena-Buehne bereits seit PR 3 (K1, Opus-Review B4) fuer
  // `commitArenaDiscipline` (`use-foundation-shell-router-body-scope.tsx`) — diese Funktion ist
  // seine Entsprechung fuer den Cockpit-Knopf "Spieltag komplett ausfuehren".
  //
  // BUDGET bewusst identisch zur Arena-Buehne: der Server haelt serverseitig genau einen
  // automatischen Wiederholungsversuch plus ein Gesamt-Timeout von bis zu 180s je Disziplin vor
  // (`OLY_ARENA_GESAMT_TIMEOUT_MS`). Worst Case dort: 2 Versuche x 180s x bis zu 2 Disziplinen =
  // 720s. 300 x 3s = 900s deckt das mit Reserve, ohne dass diese Seite endlos pollt, wenn der
  // Vorlauf wirklich haengt.
  const MATCHDAY_AUTO_RUN_POLL_INTERVAL_MS = 3_000;
  const MATCHDAY_AUTO_RUN_POLL_MAX_VERSUCHE = 300;

  function istArenaVorlaufNochOffen(blockingReasons: string[]) {
    return blockingReasons.includes("arena_vorlauf_laeuft") || blockingReasons.includes("arena_eingabe_divergenz");
  }

  /**
   * "Spieltag komplett ausfuehren" — EIN Klick statt zwei.
   *
   * Entspricht `runCockpitMatchdayAutoRun(true)` (D2, voller Durchlauf, Standard-Optionen,
   * keine Preview), fragt aber, solange der Arena-Vorlauf noch laeuft, automatisch weiter nach,
   * statt den Spieler zu einem zweiten Klick zu zwingen. Der Busy-Key bleibt ueber die GESAMTE
   * Pruefschleife gesetzt (nicht nur je Versuch), damit der Knopf waehrenddessen gesperrt bleibt
   * und kein Doppel-Klick dazwischenfunkt. Endet entweder mit dem fertigen Ergebnis (Erfolg oder
   * ein echter, nicht arena-bedingter Blocker) oder — bei einem wirklich haengenden Vorlauf — nach
   * Erreichen des Zeitbudgets mit einer klaren Rueckmeldung, dass ein manueller erneuter Versuch
   * noetig ist.
   */
  async function runCockpitMatchdayAutoRunWithAutoRetry(): Promise<FoundationMatchdayAutoRunSummary | null> {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey("matchday-auto-run-execute");
    try {
      let summary: FoundationMatchdayAutoRunSummary | null = null;
      let versuch = 0;
      while (true) {
        try {
          summary = await performMatchdayAutoRunCall(true, "d2", true, null, {});
        } catch (error) {
          setFoundationActionFeedback({
            tone: "error",
            title: "Spieltag nicht ausgeführt",
            detail:
              error instanceof Error
                ? error.message
                : "Die Anfrage an den Server ist fehlgeschlagen. Bitte erneut versuchen.",
          });
          return null;
        }

        const blockingReasons = summary?.blockingReasons ?? [];
        if (!istArenaVorlaufNochOffen(blockingReasons)) {
          break;
        }
        if (versuch >= MATCHDAY_AUTO_RUN_POLL_MAX_VERSUCHE) {
          setFoundationActionFeedback({
            tone: "warning",
            title: "Spieltag nicht automatisch abgeschlossen",
            detail:
              "Der Arena-Vorlauf ist auch nach mehreren Minuten nicht fertig geworden. Bitte in Kürze erneut auf „Spieltag komplett ausführen“ klicken.",
          });
          break;
        }
        setFoundationActionFeedback({
          tone: "info",
          title: "Arena-Vorlauf läuft noch …",
          detail:
            "Die Disziplinen des Spieltags werden im Hintergrund simuliert. Der Spieltag wird automatisch gebucht, sobald der Vorlauf fertig ist — ein erneuter Klick ist nicht nötig.",
        });
        await new Promise((resolve) => setTimeout(resolve, MATCHDAY_AUTO_RUN_POLL_INTERVAL_MS));
        versuch += 1;
      }

      if (versuch > 0 && summary?.status === "applied") {
        setFoundationActionFeedback({
          tone: "success",
          title: "Spieltag automatisch abgeschlossen",
          detail: "Der Arena-Vorlauf ist fertig — der Spieltag wurde ohne weiteren Klick gebucht.",
        });
      }

      await applyMatchdayAutoRunSideEffects();
      return summary;
    } finally {
      setCockpitBusyKey(null);
    }
  }

  return {
    runCockpitMatchdayMvpScoring,
    runCockpitResultApply,
    runCockpitStandingsApply,
    runCockpitCashApply,
    runCockpitMatchdayAdvance,
    runCockpitMatchdayAutoRun,
    runCockpitMatchdayAutoRunWithAutoRetry,
  };
}
