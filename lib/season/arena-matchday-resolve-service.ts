import { loadAllLocalLegacyLineupContexts } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { attachMatchdayInjuryPerformanceToContexts, buildMatchdayInjuryRollMap } from "@/lib/fatigue/fatigue-injury-service";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import {
  APPLY_CONFIRM_TOKEN,
  LegacyMatchdayResultApplyService,
} from "@/lib/resolve/legacy-matchday-result-apply-service";
import { ARENA_RESOLVED_DISCIPLINE_IDS, runBattleModeArenaMatchday } from "@/lib/resolve/battle-mode-arena-team-points";
import type { runArenaFixtures } from "@/lib/battle/arena-headless-runner";
import { isBattleModeSave } from "@/lib/season/game-mode";
import { istKoopSchreibkonflikt } from "@/lib/persistence/koop-schreibkonflikt";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/**
 * HINTERGRUNDLAUF FUER BATTLE-MODE-ARENA-SPIELTAGE (PR 7 von 9, docs/design/
 * battle-mode-spielmodus-plan.md, Abschnitt 3.4; seit der Gewichtheben-Produktivierung S6,
 * docs/design/gewichtheben-produktivierung.md, disziplinuebergreifend statt Basketball-fest).
 * GENAU DASSELBE Status-/Polling-Muster wie `lib/game/league-setup-draft-service.ts`
 * (`kickoffLeagueSetupDraft`) — dort nachgelesen, nicht neu erfunden: sofortiger Rueckkehrwert mit
 * `arenaMatchdayResolveStatus: "in_progress"`, ein detachter Lauf schreibt am Ende Ergebnis +
 * Status, die Foundation-Shell pollt exakt wie beim Liga-Draft.
 *
 * WARUM DER HINTERGRUNDLAUF NOETIG IST: ein echter Playwright-Chromium-Lauf fuer 8-16 Arena-Duelle
 * dauert 6-16+ Sekunden (Plan Abschnitt 3.4/PR6-Messungen) — deutlich ueber dem, was ein normaler
 * HTTP-Request/Proxy-Timeout beim Klick auf "Spieltag simulieren" vertraegt.
 *
 * SICHERHEITSRAHMEN: `kickoffArenaMatchdayApply()` prueft SELBST, ob dieser Spieltag ueberhaupt
 * betroffen ist (`isBattleModeSave()` UND MINDESTENS EINE arena-aufgeloeste Disziplin --
 * `ARENA_RESOLVED_DISCIPLINE_IDS`-Mengen-Zugehoerigkeit, s. `determineArenaDisciplineContexts()`
 * -- ist D1 oder D2 dieses Spieltags). Ist das nicht der Fall, liefert es `{ applicable: false }`
 * zurueck OHNE irgendetwas anzufassen — der Aufrufer (die Apply-Route) faellt dann auf den
 * bisherigen synchronen Pfad zurueck. Manager Mode und jeder Spieltag ohne Arena-Disziplin sind
 * dadurch komplett unveraendert.
 *
 * MEHRERE ARENA-DISZIPLINEN AM SELBEN SPIELTAG (D1 UND D2 BEIDE ARENA-AUFGELOEST): bewusst NICHT
 * unterstuetzt. `overridesByTeamId`/`arenaIndividualBoxscorePpsByPlayerId` sind je EIN
 * teamId-/playerId-keyed Ergebnis, das sich nicht disziplinuebergreifend zusammenfuehren laesst,
 * ohne die Preview-Schnittstelle (`buildLegacyMatchdayResolvePreview`) selbst
 * disziplin-bewusst zu machen — eine groessere Aenderung, die diese Runde bewusst NICHT anfasst
 * (Risiko fuer Produktionscode, s. docs/design/gewichtheben-produktivierung.md). Trifft dieser
 * seltene Fall ein (zwei Arena-Disziplinen als D1/D2 desselben Spieltags), faellt der GESAMTE
 * Spieltag auf den bestehenden, gut getesteten PPS-Pfad zurueck (`{ applicable: false }` plus
 * `console.error`) statt eine der beiden Disziplinen zu bevorzugen oder Ergebnisse zu vermengen.
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
  /** Injektionspunkt fuer Tests — Default ist der echte, Playwright-gestuetzte Runner. */
  runArenaFixturesImpl?: typeof runArenaFixtures;
};

export type ArenaMatchdayApplyKickoffResult =
  | { applicable: false }
  | { applicable: true; save: PersistedSaveGame };

/**
 * Welche arena-aufgeloeste Disziplin (falls ueberhaupt eine) an diesem Spieltag D1 oder D2 ist —
 * geprueft ueber dieselben geladenen Contexts, die der Lauf ohnehin braucht. Reine Mengen-
 * Zugehoerigkeit zu `ARENA_RESOLVED_DISCIPLINE_IDS`, KEIN Disziplins-Literal-Vergleich — eine
 * kuenftige Arena-Disziplin (Hockey war die dritte, s. docs/design/hockey-produktivierung.md --
 * dieser Code-Pfad brauchte dafuer tatsaechlich KEINE Aenderung) braucht hier keine
 * Code-Aenderung, nur einen Eintrag in dieser Menge.
 *
 * `arenaDisciplineId` ist `null`, wenn keine arena-aufgeloeste Disziplin gespielt wird.
 * `mehrdeutig` ist `true`, wenn D1 UND D2 BEIDE arena-aufgeloest sind (s. Dateikopf-Kommentar,
 * "MEHRERE ARENA-DISZIPLINEN...") — der Aufrufer behandelt das als NICHT anwendbar, statt zu
 * raten, welche der beiden Vorrang hat.
 */
function determineArenaDisciplineContexts(
  contextResults: ReturnType<typeof loadAllLocalLegacyLineupContexts>,
): { contexts: LegacyLineupLoadedContext[]; arenaDisciplineId: string | null; mehrdeutig: boolean } {
  const contexts = contextResults.flatMap((result) => (result.ok ? [result.context] : []));
  const kandidaten = new Set<string>();
  for (const context of contexts) {
    const d1 = context.contextMeta.d1DisciplineId;
    const d2 = context.contextMeta.d2DisciplineId;
    if (d1 && ARENA_RESOLVED_DISCIPLINE_IDS.has(d1)) kandidaten.add(d1);
    if (d2 && ARENA_RESOLVED_DISCIPLINE_IDS.has(d2)) kandidaten.add(d2);
  }
  const liste = [...kandidaten];
  return { contexts, arenaDisciplineId: liste[0] ?? null, mehrdeutig: liste.length > 1 };
}

function schreibeArenaMatchdayResolveStatus(
  persistence: PersistenceService,
  saveId: string,
  status: "ready" | "failed",
): void {
  for (let versuch = 1; versuch <= 3; versuch += 1) {
    const save = persistence.getSaveById(saveId);
    if (!save) return;
    try {
      persistence.saveSingleplayerState(saveId, {
        ...save.gameState,
        seasonState: { ...save.gameState.seasonState, arenaMatchdayResolveStatus: status },
      });
      return;
    } catch (error) {
      if (!istKoopSchreibkonflikt(error)) {
        throw error;
      }
    }
  }
}

async function fuehreArenaMatchdayApplyAus(input: {
  persistence: PersistenceService;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  forceReplace: boolean;
  allowIncompleteOverride: boolean;
  logPrefix: string;
  /** Von `kickoffArenaMatchdayApply()` bereits ermittelt (Mengen-Zugehoerigkeit zu ARENA_RESOLVED_DISCIPLINE_IDS) — s. dort. */
  arenaDisciplineId: string;
  runArenaFixturesImpl?: typeof runArenaFixtures;
}): Promise<void> {
  const { persistence, saveId, seasonId, matchdayId, logPrefix, arenaDisciplineId } = input;
  try {
    const current = persistence.getSaveById(saveId);
    if (!current) {
      console.error(`${logPrefix} Arena-Matchday-Apply: Save ${saveId} nicht mehr gefunden.`);
      return;
    }

    const { overridesByTeamId, individualBoxscorePpsByPlayerId, warnings } = await runBattleModeArenaMatchday({
      gameState: current.gameState,
      saveId,
      seasonId,
      matchdayId,
      disciplineId: arenaDisciplineId,
      runArenaFixturesImpl: input.runArenaFixturesImpl,
    });
    if (warnings.length > 0) {
      console.warn(`${logPrefix} Arena-Matchday-Resolve: ${warnings.join(", ")}`);
    }

    // Frisch laden statt den Stand von oben weiterzureichen: der Arena-Lauf braucht 6-16+
    // Sekunden, in denen (Koop) jemand anders geschrieben haben kann.
    const beforeApply = persistence.getSaveById(saveId);
    if (!beforeApply) {
      console.error(`${logPrefix} Arena-Matchday-Apply: Save ${saveId} verschwand waehrend des Arena-Laufs.`);
      schreibeArenaMatchdayResolveStatus(persistence, saveId, "failed");
      return;
    }

    const contextResults = loadAllLocalLegacyLineupContexts({ saveId, seasonId, matchdayId }, persistence);
    const { contexts } = determineArenaDisciplineContexts(contextResults);
    if (contexts.length === 0) {
      console.error(`${logPrefix} Arena-Matchday-Apply: keine ladbaren Lineup-Contexts fuer ${matchdayId}.`);
      schreibeArenaMatchdayResolveStatus(persistence, saveId, "failed");
      return;
    }

    const injuryRollMap = buildMatchdayInjuryRollMap({
      gameState: beforeApply.gameState,
      saveId,
      seasonId,
      matchdayId,
    });
    attachMatchdayInjuryPerformanceToContexts(contexts, injuryRollMap);

    // `preloadedPreview` sticht IMMER (auch vor einem evtl. schon vorliegenden, PPS-basierten
    // Resolve-Snapshot aus `ensureMatchdayResolveSnapshot`) — s. legacy-matchday-result-apply-
    // service.ts, `previewToBook`. Das ist der einzige Weg, wie das Arena-Ergebnis garantiert
    // gebucht wird statt eines veralteten, ohne Arena-Overrides berechneten Snapshots.
    const preview = buildLegacyMatchdayResolvePreview(contexts, {
      arenaTeamPointsByTeamId: overridesByTeamId,
      // BOXSCORE-AN-PPS (docs/design/boxscore-an-pps.md): individuelle Spieler-PPs aus dem echten
      // Arena-Boxscore, s. lib/resolve/battle-mode-arena-team-points.ts.
      arenaIndividualBoxscorePpsByPlayerId: individualBoxscorePpsByPlayerId,
    });

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
      schreibeArenaMatchdayResolveStatus(persistence, saveId, "failed");
      return;
    }

    schreibeArenaMatchdayResolveStatus(persistence, saveId, "ready");
  } catch (error) {
    console.error(`${logPrefix} Arena-Matchday-Resolve: unerwarteter Fehler im Hintergrundlauf:`, error);
    schreibeArenaMatchdayResolveStatus(persistence, saveId, "failed");
  }
}

/**
 * Startet den Arena-Matchday-Apply im HINTERGRUND (detached) und kehrt sofort zurueck — analog zu
 * `kickoffLeagueSetupDraft()`. Liefert `{ applicable: false }`, wenn dieser Spieltag gar keinen
 * Arena-Pfad braucht (Manager Mode oder keine Basketball-Seite an diesem Spieltag); der Aufrufer
 * faellt dann auf den bestehenden synchronen `LegacyMatchdayResultApplyService`-Aufruf zurueck —
 * bit-identisches Verhalten zu vorher.
 */
export function kickoffArenaMatchdayApply(input: ArenaMatchdayApplyKickoffInput): ArenaMatchdayApplyKickoffResult {
  const { persistence, saveId, matchdayId, logPrefix } = input;

  const current = persistence.getSaveById(saveId);
  if (!current) {
    return { applicable: false };
  }
  if (!isBattleModeSave(current.gameState)) {
    return { applicable: false };
  }

  const seasonId = input.seasonId ?? current.gameState.season.id;
  const contextResults = loadAllLocalLegacyLineupContexts({ saveId, seasonId, matchdayId }, persistence);
  const { arenaDisciplineId, mehrdeutig } = determineArenaDisciplineContexts(contextResults);
  if (mehrdeutig) {
    // S. Dateikopf-Kommentar ("MEHRERE ARENA-DISZIPLINEN..."): D1 und D2 sind BEIDE
    // arena-aufgeloest -- nicht unterstuetzt, ganzer Spieltag faellt auf den PPS-Pfad zurueck.
    console.error(
      `${logPrefix} Arena-Matchday: mehrere arena-aufgeloeste Disziplinen an einem Spieltag (${matchdayId}) -- ` +
        "noch nicht unterstuetzt, falle auf den PPS-Pfad zurueck.",
    );
    return { applicable: false };
  }
  if (!arenaDisciplineId) {
    return { applicable: false };
  }

  const markedInProgress = persistence.saveSingleplayerState(saveId, {
    ...current.gameState,
    seasonState: { ...current.gameState.seasonState, arenaMatchdayResolveStatus: "in_progress" },
  });

  // Detached (kein `await`): der Aufrufer (die Apply-Route) darf hier nicht 6-16+ Sekunden haengen.
  // Das `.catch` ist kein Schmuck — ohne es waere jeder Fehler, den `fuehreArenaMatchdayApplyAus`
  // nicht selbst faengt, eine unbehandelte Ablehnung.
  void fuehreArenaMatchdayApplyAus({
    persistence,
    saveId,
    seasonId,
    matchdayId,
    forceReplace: input.forceReplace ?? false,
    allowIncompleteOverride: input.allowIncompleteOverride ?? false,
    logPrefix,
    arenaDisciplineId,
    runArenaFixturesImpl: input.runArenaFixturesImpl,
  }).catch((error) => {
    console.error(`${logPrefix} Arena-Matchday-Resolve: unerwarteter Fehler ausserhalb des try/catch:`, error);
  });

  return { applicable: true, save: markedInProgress };
}
