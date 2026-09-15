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
 * HTTP-Request/Proxy-Timeout beim Klick auf "Spieltag simulieren" vertraegt. Seit WEG B (s. unten)
 * kann das PRO SPIELTAG bis zu zweimal anfallen (D1 UND D2 beide arena-aufgeloest) — bewusst
 * sequenziell, nicht parallel (s. `fuehreArenaMatchdayApplyAus()`), also bis zu doppelte Laufzeit.
 *
 * SICHERHEITSRAHMEN: `kickoffArenaMatchdayApply()` prueft SELBST, ob dieser Spieltag ueberhaupt
 * betroffen ist (`isBattleModeSave()` UND MINDESTENS EINE arena-aufgeloeste Disziplin --
 * `ARENA_RESOLVED_DISCIPLINE_IDS`-Mengen-Zugehoerigkeit, s. `determineArenaDisciplineContexts()`
 * -- ist D1 oder D2 dieses Spieltags). Ist das nicht der Fall, liefert es `{ applicable: false }`
 * zurueck OHNE irgendetwas anzufassen — der Aufrufer (die Apply-Route) faellt dann auf den
 * bisherigen synchronen Pfad zurueck. Manager Mode und jeder Spieltag ohne Arena-Disziplin sind
 * dadurch komplett unveraendert.
 *
 * MEHRERE ARENA-DISZIPLINEN AM SELBEN SPIELTAG (D1 UND D2 BEIDE ARENA-AUFGELOEST) — WEG B, seit
 * dem N-Team-Infrastruktur-Audit 13.09. (docs/design/n-team-disziplinen-infrastruktur-audit-13-09.md,
 * Abschnitt 8, Chris' ausdrueckliche Entscheidung 15.09.): JETZT VOLL UNTERSTUETZT. Vorher liess
 * die `mehrdeutig`-Wache (Audit Abschnitt 3, Fund B1) den GESAMTEN Spieltag auf den PPS-Pfad
 * zurueckfallen, sobald D1 UND D2 beide arena-aufgeloest waren — gemessen 41,0-41,8 % aller
 * Battle-Mode-Spieltage (×400 Saves, repeat 1 und 2 gleichermassen). Das war nur solange
 * vertretbar, wie es fast nie zutraf (2 von 20 arena-aufgeloeste Disziplinen bei der
 * urspruenglichen Entscheidung, PR7) — inzwischen sind es 13 von 20.
 *
 * Der Grund, warum das vorher nicht ging, war NICHT die Wache selbst, sondern die
 * Preview-Schnittstelle dahinter: `overridesByTeamId`/`individualBoxscorePpsByPlayerId` waren je
 * EIN teamId-/playerId-keyed Ergebnis ohne Disziplin-Dimension, das eine zweite Disziplin
 * ueberschrieben oder mit ihr vermengt haette (exakt Fund B2, s. legacy-matchday-resolve-engine.ts).
 * Mit der disziplin-geschluesselten Preview-Schnittstelle (`LegacyResolvePreviewOptions.
 * arenaTeamPointsByDisciplineId`/`arenaIndividualBoxscorePpsByDisciplineId`, lib/lineups/
 * legacy-lineup-types.ts) traegt der Arena-Lauf jetzt fuer D1 UND D2 unabhaengig je einen Eintrag,
 * ohne dass einer den anderen ueberschreibt — `fuehreArenaMatchdayApplyAus()` unten ruft
 * `runBattleModeArenaMatchday()` fuer JEDE ermittelte arena-aufgeloeste Disziplin (0, 1 oder 2)
 * sequenziell auf und sammelt die Ergebnisse disziplin-geschluesselt.
 *
 * BALANCE-HINWEIS (Audit Abschnitt 2.1/8, benannt statt versteckt): ein Spieltag mit ZWEI echten
 * Arena-Duellen statt bisher hoechstens einem schuettet an diesem Spieltag entsprechend mehr
 * Liga-Punkte aus (zwei unabhaengige 2/1/0-Ergebnisse statt eines). Das ist eine erwartete,
 * gemessene Folge von WEG B (s. PR-Beschreibung fuer die Vorher/Nachher-Zahlen), keine
 * Kompensationsmechanik ist dafuer vorgesehen (vom Audit nicht verlangt).
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
 * WELCHE arena-aufgeloesten Disziplinen (0, 1 oder — seit WEG B — 2) an diesem Spieltag D1/D2
 * sind — geprueft ueber dieselben geladenen Contexts, die der Lauf ohnehin braucht. Reine Mengen-
 * Zugehoerigkeit zu `ARENA_RESOLVED_DISCIPLINE_IDS`, KEIN Disziplins-Literal-Vergleich — eine
 * kuenftige Arena-Disziplin (Hockey war die dritte, s. docs/design/hockey-produktivierung.md --
 * dieser Code-Pfad brauchte dafuer tatsaechlich KEINE Aenderung) braucht hier keine
 * Code-Aenderung, nur einen Eintrag in dieser Menge.
 *
 * `arenaDisciplineIds` ist leer, wenn keine arena-aufgeloeste Disziplin gespielt wird, hat einen
 * Eintrag im bisher haeufigeren Fall (nur D1 ODER nur D2 arena-aufgeloest) und — WEG B,
 * N-Team-Infrastruktur-Audit 13.09., Abschnitt 8 — zwei Eintraege, wenn D1 UND D2 desselben
 * Spieltags BEIDE arena-aufgeloest sind (vorher: `mehrdeutig`, ganzer Spieltag fiel auf PPS
 * zurueck). Der Aufrufer laeuft jetzt fuer JEDEN Eintrag dieser Liste einen eigenen Arena-Lauf.
 */
function determineArenaDisciplineContexts(
  contextResults: ReturnType<typeof loadAllLocalLegacyLineupContexts>,
): { contexts: LegacyLineupLoadedContext[]; arenaDisciplineIds: string[] } {
  const contexts = contextResults.flatMap((result) => (result.ok ? [result.context] : []));
  const kandidaten = new Set<string>();
  for (const context of contexts) {
    const d1 = context.contextMeta.d1DisciplineId;
    const d2 = context.contextMeta.d2DisciplineId;
    if (d1 && ARENA_RESOLVED_DISCIPLINE_IDS.has(d1)) kandidaten.add(d1);
    if (d2 && ARENA_RESOLVED_DISCIPLINE_IDS.has(d2)) kandidaten.add(d2);
  }
  return { contexts, arenaDisciplineIds: [...kandidaten] };
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
  /**
   * Von `kickoffArenaMatchdayApply()` bereits ermittelt (Mengen-Zugehoerigkeit zu
   * ARENA_RESOLVED_DISCIPLINE_IDS) — s. dort. WEG B: 1 ODER 2 Eintraege, nie leer (der Aufrufer
   * bricht vorher ab, wenn keine arena-aufgeloeste Disziplin an diesem Spieltag gespielt wird).
   */
  arenaDisciplineIds: string[];
  runArenaFixturesImpl?: typeof runArenaFixtures;
}): Promise<void> {
  const { persistence, saveId, seasonId, matchdayId, logPrefix, arenaDisciplineIds } = input;
  try {
    const current = persistence.getSaveById(saveId);
    if (!current) {
      console.error(`${logPrefix} Arena-Matchday-Apply: Save ${saveId} nicht mehr gefunden.`);
      return;
    }

    // WEG B (N-Team-Infrastruktur-Audit 13.09., Abschnitt 8): SEQUENZIELL, NICHT PARALLEL — ein
    // Arena-Lauf startet/schliesst pro Aufruf einen eigenen Chromium-Browser (s. Dateikopf-
    // Kommentar und `runBattleModeArenaMatchday()`s eigener Kommentar zu den Liga-Stufen); zwei
    // Disziplinen gleichzeitig parallel zu starten wuerde den Speicherbedarf verdoppeln, den genau
    // dieses "ein Browser zur selben Zeit"-Muster bewusst begrenzt. Kostet dafuer bis zu doppelte
    // Laufzeit (6-16+ Sekunden je Disziplin) — im Hintergrundlauf, den ohnehin niemand synchron
    // abwartet, ein bewusst akzeptierter Preis.
    const arenaTeamPointsByDisciplineId = new Map<string, Map<string, { teamPoints: number; arenaMatchSeed: string }>>();
    const arenaIndividualBoxscorePpsByDisciplineId = new Map<string, Map<string, number>>();
    const alleWarnungen: string[] = [];
    for (const disziplinId of arenaDisciplineIds) {
      const { overridesByTeamId, individualBoxscorePpsByPlayerId, warnings } = await runBattleModeArenaMatchday({
        gameState: current.gameState,
        saveId,
        seasonId,
        matchdayId,
        disciplineId: disziplinId,
        runArenaFixturesImpl: input.runArenaFixturesImpl,
      });
      arenaTeamPointsByDisciplineId.set(disziplinId, overridesByTeamId);
      arenaIndividualBoxscorePpsByDisciplineId.set(disziplinId, individualBoxscorePpsByPlayerId);
      alleWarnungen.push(...warnings.map((warning) => `${disziplinId}:${warning}`));
    }
    if (alleWarnungen.length > 0) {
      console.warn(`${logPrefix} Arena-Matchday-Resolve: ${alleWarnungen.join(", ")}`);
    }

    // Frisch laden statt den Stand von oben weiterzureichen: der Arena-Lauf braucht 6-16+
    // Sekunden je Disziplin, in denen (Koop) jemand anders geschrieben haben kann.
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
      // WEG B (N-Team-Infrastruktur-Audit 13.09., Abschnitt 8): disziplin-geschluesselt statt
      // flach — D1 UND D2 tragen hier, falls beide arena-aufgeloest sind, je ihren EIGENEN
      // Eintrag, ohne dass einer den anderen ueberschreibt (s. Kommentar an
      // `LegacyResolvePreviewOptions.arenaTeamPointsByDisciplineId`, legacy-lineup-types.ts, und
      // an `arenaOverridesForThisDiscipline`, legacy-matchday-resolve-engine.ts).
      arenaTeamPointsByDisciplineId,
      // BOXSCORE-AN-PPS (docs/design/boxscore-an-pps.md): individuelle Spieler-PPs aus dem echten
      // Arena-Boxscore, s. lib/resolve/battle-mode-arena-team-points.ts — ebenfalls disziplin-
      // geschluesselt seit WEG B.
      arenaIndividualBoxscorePpsByDisciplineId,
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
 * Arena-Pfad braucht (Manager Mode oder keine arena-aufgeloeste Disziplin an D1/D2 dieses
 * Spieltags); der Aufrufer faellt dann auf den bestehenden synchronen
 * `LegacyMatchdayResultApplyService`-Aufruf zurueck — unveraendertes Verhalten fuer diesen Fall.
 *
 * WEG B (N-Team-Infrastruktur-Audit 13.09., Abschnitt 8): sind D1 UND D2 BEIDE arena-aufgeloest,
 * gilt das SEIT DIESER AENDERUNG als anwendbar mit ZWEI Disziplinen, nicht mehr als `mehrdeutig`
 * mit Rueckfall auf `{ applicable: false }` — s. `fuehreArenaMatchdayApplyAus()`, das jetzt fuer
 * jede ermittelte Disziplin einen eigenen Arena-Lauf faehrt.
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
  const { arenaDisciplineIds } = determineArenaDisciplineContexts(contextResults);
  if (arenaDisciplineIds.length === 0) {
    return { applicable: false };
  }

  const markedInProgress = persistence.saveSingleplayerState(saveId, {
    ...current.gameState,
    seasonState: { ...current.gameState.seasonState, arenaMatchdayResolveStatus: "in_progress" },
  });

  // Detached (kein `await`): der Aufrufer (die Apply-Route) darf hier nicht 6-16+ Sekunden (bzw.
  // bis zu doppelt so lange bei zwei arena-aufgeloesten Disziplinen, s. WEG B oben) haengen. Das
  // `.catch` ist kein Schmuck — ohne es waere jeder Fehler, den `fuehreArenaMatchdayApplyAus`
  // nicht selbst faengt, eine unbehandelte Ablehnung.
  void fuehreArenaMatchdayApplyAus({
    persistence,
    saveId,
    seasonId,
    matchdayId,
    forceReplace: input.forceReplace ?? false,
    allowIncompleteOverride: input.allowIncompleteOverride ?? false,
    logPrefix,
    arenaDisciplineIds,
    runArenaFixturesImpl: input.runArenaFixturesImpl,
  }).catch((error) => {
    console.error(`${logPrefix} Arena-Matchday-Resolve: unerwarteter Fehler ausserhalb des try/catch:`, error);
  });

  return { applicable: true, save: markedInProgress };
}
