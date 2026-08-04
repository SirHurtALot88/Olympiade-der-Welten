import type { GameState, LeagueSetupTeamWarning } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { runAiPicksExecutePreview, type AiPicksRunResult } from "@/lib/ai/ai-picks-run-service";
import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";

/**
 * GETEILTER LIGA-SETUP-DRAFT — EIN Ort statt drei Kopien.
 *
 * Vorher gab es densel­ben ~70-Zeilen-Ablauf (Status "in_progress" setzen, den kompletten
 * Ligadraft ueber die ORGANISCHE KI-Engine laufen lassen, "ready"/"failed" + Warnungen
 * nachtragen) DREIMAL, byte-fuer-byte fast identisch:
 *   - app/api/singleplayer-state/route.ts (Aktion "fresh-season-1")
 *   - app/api/new-game/route.ts ("Neues Spiel"-Assistent)
 * und NIRGENDS im dritten Weg:
 *   - lib/room/room-store.ts (`startRoom`, Koop-Raum-Start) — genau die Luecke, die 31 von 32
 *     Koop-Teams ohne Kader zurueckliess (siehe docs/design/coop-absicherung.md und der
 *     gemeldete Fall new-game-1785067203149-82cbka).
 * Kopieren waere hier der falsche Weg: zwei Kopien laufen garantiert auseinander, und dann
 * fuellt der eine Weg Kader, die der andere anders bewertet. Dieses Modul ist die einzige
 * Quelle fuer "wie befuellt sich eine frische Liga" — alle drei Aufrufer binden sich daran.
 *
 * WARUM DER HINTERGRUNDLAUF HINTERGRUNDLAUF BLEIBEN MUSS: der Whole-League-Draft (32 Teams,
 * organische KI-Engine) dauert ~40s. Ein Request, der darauf wartet, laeuft hinter einem Proxy
 * in ein Timeout. Deshalb: den Aufrufer (HTTP-Route ODER `startRoom`, das selbst synchron ist
 * und den Raum-Start nicht 40s blockieren darf) sofort zurueckkehren lassen, der Draft laeuft
 * `void (async () => {...})()` detached weiter und meldet sich ausschliesslich ueber
 * `seasonState.leagueSetupStatus` ("in_progress" -> "ready"/"failed"), das die Foundation-Shell
 * abfragt (siehe use-foundation-shell-router-body-scope.tsx, FoundationShellRouterBody.tsx).
 *
 * `draftSeed` bleibt reproduzierbar aus `${saveId}:${seasonId}:setup` gebaut (unveraendert seit
 * der urspruenglichen fresh-season-1-Implementierung) — an diesem Schema haengt nichts
 * Funktionales, aber ein Wechsel wuerde bestehende Debug-/Audit-Läufe, die den Seed loggen,
 * unnoetig verwirren.
 *
 * GUARD-FRAGE (assert-save-not-room-bound.ts) GEPRUEFT, NICHT ANGENOMMEN: dieser Draft ruft
 * `runAiPicksExecutePreview` DIREKT als Service-Funktion auf, nicht ueber eine der vier Routen,
 * die `assertSaveNotRoomBound` tatsaechlich verdrahten (season-start-reset, season-snapshot,
 * picks-audit-reset, picks-import — grep bestaetigt: `app/api/ai/picks-run/route.ts` ruft ihn
 * NICHT auf). Der Guard kommt also gar nicht in Beruehrung mit diesem Pfad. Das ist auch
 * inhaltlich richtig: `assertSaveNotRoomBound` sperrt Werkzeuge, die ganze Saison-/Save-Zustaende
 * ERSETZEN OHNE Team-Bezug (Saison simulieren, Season-Start-Reset, Picks-Import/-Audit-Reset) —
 * dieser Draft dagegen ist die Ligagruendung selbst, laeuft GENAU beim Uebergang lobby ->
 * season_active (bevor ueberhaupt ein zweiter Teilnehmer etwas zu verlieren haette) und respektiert
 * `excludeTeamIds` fuer bereits von Menschen kontrollierte Teams. Waere er hinter dem Guard
 * gesperrt, koennte kein Koop-Raum mehr starten — falscher Ort fuer diese Sperre.
 */

function buildLeagueSetupWarnings(runResult: AiPicksRunResult): LeagueSetupTeamWarning[] {
  return runResult.teams
    .filter((team) => team.targetRosterMin != null && team.rosterAfter < team.targetRosterMin)
    .map((team) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      rosterAfter: team.rosterAfter,
      targetMin: team.targetRosterMin ?? 0,
      status: team.blockingReasons.length > 0 ? "blocked" : "below_min",
    }));
}

export type LeagueSetupDraftKickoffInput = {
  persistence: PersistenceService;
  saveId: string;
  /** Weggelassen -> wird aus dem geladenen Save (`gameState.season.id`) gelesen. */
  seasonId?: string;
  /**
   * Team-IDs, die der Whole-League-Draft NICHT anfassen darf — menschlich gesteuerte Teams, die
   * ihren Kader selbst zusammenstellen sollen (z.B. das Koop-Team des Gastgebers/Gasts). Leer/
   * undefined -> jedes Team wird gedraftet (fresh-season-1 kennt an dieser Stelle noch kein
   * menschliches Team; der ganze Kader-Grundstock inkl. des eigenen Teams entsteht automatisch).
   */
  excludeTeamIds?: string[] | null;
  /** Log-Praefix fuer console.warn/console.error, z.B. "[fresh-season-1]", "[new-game]", "[room-start]". */
  logPrefix: string;
};

/**
 * Startet den Whole-League-Draft im HINTERGRUND (detached) und kehrt sofort zurueck. Setzt
 * `leagueSetupStatus: "in_progress"` VOR der Rueckkehr (und gibt den so gespeicherten Save
 * zurueck, damit ein Aufrufer wie `app/api/singleplayer-state/route.ts` ihn direkt als
 * Response-Payload weiterreichen kann), damit die Foundation-Shell ihr "Liga wird erstellt…"-Gate
 * sofort zeigen kann, auch wenn der Aufrufer selbst nicht wartet.
 *
 * Gibt `null` zurueck, wenn der Save nicht gefunden wurde (defensiv — sollte bei einem gerade
 * erst angelegten Save nie vorkommen).
 */
export function kickoffLeagueSetupDraft(input: LeagueSetupDraftKickoffInput): PersistedSaveGame | null {
  const { persistence, saveId, logPrefix } = input;
  const excludeTeamIds = new Set(input.excludeTeamIds ?? []);

  const current = persistence.getSaveById(saveId);
  if (!current) {
    console.error(`${logPrefix} Liga-Setup-Draft: Save ${saveId} nicht gefunden — uebersprungen.`);
    return null;
  }
  const seasonId = input.seasonId ?? current.gameState.season.id;

  const markedInProgress = persistence.saveSingleplayerState(saveId, {
    ...current.gameState,
    seasonState: { ...current.gameState.seasonState, leagueSetupStatus: "in_progress" },
  });

  // null = keine Einschraenkung (fresh-season-1: alle 32 Teams, inkl. des spaeter manuell
  // gesteuerten). Eine konkrete Liste = genau die NICHT ausgeschlossenen Teams duerfen bedient
  // werden (spiegelt `callerWritableTeamIds` in ai-picks-run-service.ts).
  const callerWritableTeamIds =
    excludeTeamIds.size > 0
      ? current.gameState.teams.map((team) => team.teamId).filter((teamId) => !excludeTeamIds.has(teamId))
      : null;

  void (async () => {
    try {
      const runResult = await runAiPicksExecutePreview(
        {
          source: "sqlite",
          saveId,
          seasonId,
          dryRun: false,
          confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
          teamScope: "all",
          allowSetupAllTeams: true,
          callerWritableTeamIds,
          draftSeed: `${saveId}:${seasonId}:setup`,
          yieldBetweenTeams: true,
          batchPersistence: true,
        },
        persistence,
      );
      const leagueSetupWarnings = buildLeagueSetupWarnings(runResult);
      const blockedTeamCount = runResult.teams.filter((team) => team.blockingReasons.length > 0).length;
      if (leagueSetupWarnings.length > 0 || blockedTeamCount > 0) {
        console.warn(
          `${logPrefix} AI-Draft liess ${leagueSetupWarnings.length} Team(s) unter Mindestkader, ${blockedTeamCount} blockierte(s) Team(s).`,
        );
      }
      const filled = persistence.getSaveById(saveId);
      if (filled) {
        persistence.saveSingleplayerState(saveId, {
          ...filled.gameState,
          seasonState: {
            ...filled.gameState.seasonState,
            leagueSetupStatus: "ready",
            leagueSetupWarnings,
          },
        });
      }
    } catch (error) {
      console.error(`${logPrefix} Hintergrund-KI-Draft fehlgeschlagen (im Cockpit wiederholbar):`, error);
      const errored = persistence.getSaveById(saveId);
      if (errored) {
        persistence.saveSingleplayerState(saveId, {
          ...errored.gameState,
          seasonState: { ...errored.gameState.seasonState, leagueSetupStatus: "failed" },
        });
      }
    }
  })();

  return markedInProgress;
}

// ---------------------------------------------------------------------------------------------
// TEIL B: Reparatur eines bereits bestehenden Saves mit leeren Kadern (kein Erzeugungs-Fix hilft
// hier — der Save existiert schon, mit ggf. bereits verkauften/gekauften Spielern, Vertraegen,
// Kasse auf einzelnen Teams). Derselbe Draft, nachtraeglich UND NUR AUF DIE LEEREN TEAMS
// anwendbar.
// ---------------------------------------------------------------------------------------------

export type LeagueSetupRepairTeamPlan = {
  teamId: string;
  teamCode: string;
  teamName: string;
  /** Kadergroesse vor dem Lauf (immer 0 — nur komplett leere Teams werden ueberhaupt geplant). */
  rosterBefore: number;
  /** Kadergroesse NACH dem (geplanten oder ausgefuehrten) Lauf. Bei Dry-Run die GEPLANTE Groesse. */
  rosterAfter: number;
  /** Anzahl der (geplanten/ausgefuehrten) Picks, die nicht blockiert wurden. */
  plannedPicks: number;
  targetRosterMin: number | null;
};

export type LeagueSetupRepairResult = {
  saveId: string;
  seasonId: string;
  /** false bei Dry-Run ODER wenn es nichts zu tun gab (bereits alle Teams befuellt). */
  applied: boolean;
  teamsTotal: number;
  teamsAlreadyFilled: number;
  /** Teams, die zu Beginn des Laufs GENAU 0 Spieler im Kader hatten. */
  emptyTeamIds: string[];
  plan: LeagueSetupRepairTeamPlan[];
  leagueSetupStatusBefore: GameState["seasonState"]["leagueSetupStatus"] | null;
  leagueSetupStatusAfter: GameState["seasonState"]["leagueSetupStatus"] | null;
  warnings: LeagueSetupTeamWarning[];
};

/**
 * Reparaturweg fuer einen bestehenden Save, dessen Liga-Setup nie (vollstaendig) durchlief —
 * genau der Zustand aus dem Koop-Fall new-game-1785067203149-82cbka: `leagueSetupStatus` fehlt
 * (kein "failed", also greift auch der Cockpit-Retry-Knopf nicht), 31 von 32 Teams haben
 * ueberhaupt keinen Roster-Eintrag.
 *
 * IDEMPOTENT + NICHT-DESTRUKTIV: nur Teams mit GENAU 0 Roster-Eintraegen werden ueberhaupt in
 * den Draft-Aufruf aufgenommen (`teamIds: emptyTeamIds`, nicht `teamScope:"all"` ueber die ganze
 * Liga) — ein Team mit auch nur einem Spieler (verkauft/gekauft/manuell zusammengestellt) wird
 * NIE angefasst, egal was `stepsPerTeam`/die interne Bedarfslogik fuer dieses Team sonst noch
 * vorschlagen wuerde. Kasse, Vertraege, Transferhistorie bereits befuellter Teams bleiben
 * unberuehrt, weil sie nie in `chooseTeams`/`selectedTeams` landen.
 *
 * Wiederholter Aufruf auf demselben Save ist sicher: sobald kein Team mehr 0 Spieler hat, ist
 * `emptyTeamIds` leer und der Lauf endet als No-Op (`applied:false`), ohne zu persistieren.
 *
 * `dryRun:true` (Standard) berechnet den echten Draftplan (dieselbe organische Engine, derselbe
 * `draftSeed`) OHNE zu persistieren — zeigt exakt, was ein anschliessender `dryRun:false`-Lauf
 * tun WUERDE (Team, Kader vorher/nachher, geplante Picks).
 */
export async function repairLeagueSetupEmptyRosters(input: {
  persistence: PersistenceService;
  saveId: string;
  dryRun?: boolean;
}): Promise<LeagueSetupRepairResult> {
  const { persistence, saveId } = input;
  const dryRun = input.dryRun ?? true;

  const save = persistence.getSaveById(saveId);
  if (!save) {
    throw new Error(`league_setup_repair_save_not_found:${saveId}`);
  }
  const gameState = save.gameState;
  const seasonId = gameState.season.id;
  const leagueSetupStatusBefore = gameState.seasonState.leagueSetupStatus ?? null;

  const rosterCountByTeamId = new Map<string, number>();
  for (const entry of gameState.rosters) {
    rosterCountByTeamId.set(entry.teamId, (rosterCountByTeamId.get(entry.teamId) ?? 0) + 1);
  }
  // Die Grenze ist bewusst hart bei GENAU 0 gezogen, nicht "unter Mindestkader" — ein Team mit
  // z.B. 3 Spielern hat schon echte Kaufentscheidungen (und moeglicherweise Verkaeufe) hinter
  // sich, die dieser Weg nicht anfassen darf. "Unter Mindestkader, aber nicht leer" ist ein
  // anderes, bereits bedientes Problem (Cockpit-Knopf "KI-Teams nachpicken").
  const emptyTeams = gameState.teams.filter((team) => (rosterCountByTeamId.get(team.teamId) ?? 0) === 0);

  if (emptyTeams.length === 0) {
    return {
      saveId,
      seasonId,
      applied: false,
      teamsTotal: gameState.teams.length,
      teamsAlreadyFilled: gameState.teams.length,
      emptyTeamIds: [],
      plan: [],
      leagueSetupStatusBefore,
      leagueSetupStatusAfter: leagueSetupStatusBefore,
      warnings: [],
    };
  }

  const emptyTeamIds = emptyTeams.map((team) => team.teamId);

  if (!dryRun) {
    persistence.saveSingleplayerState(saveId, {
      ...gameState,
      seasonState: { ...gameState.seasonState, leagueSetupStatus: "in_progress" },
    });
  }

  const runResult = await runAiPicksExecutePreview(
    {
      source: "sqlite",
      saveId,
      seasonId,
      dryRun,
      // Der Confirm-Token wird nur bei !dryRun geprueft — im Dry-Run lassen wir ihn bewusst weg,
      // damit ein reiner Vorschau-Aufruf keinen "scharfen" Token braucht.
      confirmToken: dryRun ? null : AI_PICKS_RUN_CONFIRM_TOKEN,
      teamScope: "all",
      allowSetupAllTeams: true,
      // NUR die leeren Teams — das ist der eigentliche Sicherheitsmechanismus dieser Funktion.
      teamIds: emptyTeamIds,
      // "season1_optimum_execute" statt des "default"-Modus (den der ERZEUGUNGS-Kickoff fuer die
      // erste, schnelle Ligadraft-Runde nutzt): das ist der Modus, den der Rest der Codebase
      // bereits fuer "ein Team von 0 auf vollen S1-Kader in einem Rutsch" einsetzt (siehe
      // lib/season/long-run-canonical.ts, scripts/s1-draft-fresh-audit.ts). Mit dem "default"-Modus
      // (stepsPerTeam=5) bliebe ein komplett leeres Team bei 5 Spielern haengen — unter dem
      // gesetzlichen Minimum (7) und damit weiter NICHT spieltag-faehig; genau das soll dieser
      // Reparaturweg in einem Lauf beheben, nicht nur "etwas weniger leer" hinterlassen.
      runMode: "season1_optimum_execute",
      draftSeed: `${saveId}:${seasonId}:setup`,
      yieldBetweenTeams: true,
      batchPersistence: true,
    },
    persistence,
  );

  const warnings = buildLeagueSetupWarnings(runResult);
  const plan: LeagueSetupRepairTeamPlan[] = runResult.teams.map((team) => ({
    teamId: team.teamId,
    teamCode: team.teamCode,
    teamName: team.teamName,
    rosterBefore: team.rosterBefore,
    rosterAfter: team.rosterAfter,
    plannedPicks: team.plannedPicks.filter((pick) => pick.status !== "blocked").length,
    targetRosterMin: team.targetRosterMin,
  }));

  let leagueSetupStatusAfter = leagueSetupStatusBefore;
  if (!dryRun) {
    leagueSetupStatusAfter = "ready";
    const afterSave = persistence.getSaveById(saveId);
    if (afterSave) {
      persistence.saveSingleplayerState(saveId, {
        ...afterSave.gameState,
        seasonState: {
          ...afterSave.gameState.seasonState,
          leagueSetupStatus: "ready",
          leagueSetupWarnings: warnings,
        },
      });
    }
  }

  return {
    saveId,
    seasonId,
    applied: !dryRun,
    teamsTotal: gameState.teams.length,
    teamsAlreadyFilled: gameState.teams.length - emptyTeams.length,
    emptyTeamIds,
    plan,
    leagueSetupStatusBefore,
    leagueSetupStatusAfter,
    warnings,
  };
}
