import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import type {
  GameState,
  PlayMode,
  ScenarioType,
  SeasonState,
  Team,
  TeamControlMode,
} from "@/lib/data/olyDataTypes";
import { resolvePlayMode } from "@/lib/season/season-discipline-schedule";
import { createNewGameFromPlayerBaseline } from "@/lib/players/player-baseline-service";
import { buildPlayerPotentialRecordsForSave } from "@/lib/progression/player-potential-service";
import { chooseSponsorOfferForAiTeams, ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";
import { stampSponsorSystemVersion } from "@/lib/sponsor/sponsor-v3-offer-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService, PersistedSaveGame } from "@/lib/persistence/types";
import { AI_OWNER_ID, applyChrisFrankyOwnershipToTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { formatGermanDateTime } from "@/lib/utils/format-datetime";
import {
  buildOwnershipForPreset,
  buildParticipant,
  createMultiplayerRoomMeta,
  syncParticipantControlledTeams,
} from "@/lib/room/online-room-model";
import { loesePresetTeamsAusPool, loesePresetTeamsFuerBeideSeiten } from "@/lib/game/preset-team-pool";
import type { RoomParticipant, TeamOwnershipRecord } from "@/types/game";

export type NewGamePresetId = "solo_1" | "solo_2" | "solo_4" | "online_4v4" | "custom";

export type NewGameSetupInput = {
  presetId: NewGamePresetId;
  /**
   * SPIELART DES NEUEN SPIELSTANDS -- die eine Entscheidung, die sich spaeter nicht mehr aendern
   * laesst. "management" (Default, wenn das Feld fehlt) = 32 Teams, 10 Spieltage, flache
   * Einzelrangliste; "battle" = 16 Teams, 20 Spieltage, echte Kopf-an-Kopf-Liga.
   *
   * NICHT ZU VERWECHSELN MIT `presetId`. Das ist die STEUERUNGS-Voreinstellung (wer fuehrt wie
   * viele Teams: solo_1 / solo_2 / solo_4 / online_4v4 / custom) und steht senkrecht dazu -- ein
   * Battle-Spielstand kann genauso solo_1 wie online_4v4 sein. Der Name `gameMode` war fuer diese
   * zweite Bedeutung schon vergeben (`lib/foundation/team-control-settings.ts`), daher `playMode`.
   *
   * Heute nur ueber diesen Parameter setzbar -- eine Auswahl im Neuspiel-Bildschirm gibt es noch
   * nicht und gehoert nicht in diese Phase.
   */
  playMode?: PlayMode;
  chrisTeamIds?: string[];
  frankyTeamIds?: string[];
  sandbox?: boolean;
  saveName?: string;
  confirmToken?: string | null;
  now?: string;
  saveId?: string;
};

export type NewGameTeamPreview = {
  teamId: string;
  shortCode: string;
  name: string;
  budget: number;
  startRank: number;
  controlMode: TeamControlMode;
  ownerId: string;
  ownerLabel: string;
};

export type NewGameSetupPreview = {
  mode: "preview";
  presetId: NewGamePresetId;
  /** Spielart des Spielstands, der aus dieser Vorschau entstehen wuerde. */
  playMode: PlayMode;
  saveName: string;
  sandbox: boolean;
  scenarioType: ScenarioType;
  chrisTeamIds: string[];
  frankyTeamIds: string[];
  aiTeamIds: string[];
  teams: NewGameTeamPreview[];
  counts: {
    chris: number;
    franky: number;
    ai: number;
    passive: number;
    total: number;
  };
  baseline: {
    playerCount: number;
    baselineCount: number;
    resetPlayers: number;
  };
  seasonSetup: {
    seasonId: string;
    currentMatchday: number;
    gamePhase: "season_active";
    matchdayCount: number;
    scheduleCount: number;
    formCardsStatus: "pending_generation";
    lineupsStatus: "empty";
    standingsStatus: "empty_with_start_rank";
  };
  room:
    | {
        enabled: true;
        host: "Chris";
        pendingParticipant: "Franky";
        roomCode: "created_on_apply";
      }
    | {
        enabled: false;
      };
  warnings: string[];
  blockers: string[];
  confirmToken: string;
};

export type NewGameSetupApplyResult = {
  mode: "applied";
  save: {
    saveId: string;
    name: string;
  };
  previousActiveSaveId: string | null;
  preview: NewGameSetupPreview;
};

const CHRIS_ONLINE_4V4_TEAM_IDS = ["P-S", "D-P", "M-M", "V-W"];
const FRANKY_ONLINE_4V4_TEAM_IDS = ["M-S", "P-C", "C-S", "G-G"];

/**
 * `chrisTeamIds`/`frankyTeamIds` sind seit dem Battle-Modus WUNSCHLISTEN, keine Zuteilungen mehr —
 * verbindlich ist `chrisCount`/`frankyCount`. Warum, ausfuehrlich: `lib/game/preset-team-pool.ts`.
 * Kurz: die alten festen Listen enthalten `P-S`/`V-W`, die es in einem 16-Team-Battle-Spielstand
 * nicht gibt; sie fielen beim Filtern lautlos weg und `solo_4` gab Chris zwei Teams statt vier.
 *
 * Die Zahlen stehen bewusst ALS ZAHL da und nicht als `chrisTeamIds.length`: sie sind das
 * Versprechen des Presets ("Solo 4 Teams" heisst vier), die Liste ist nur der Wunsch, mit WELCHEN
 * vier man anfaengt. Beides auseinanderzuhalten ist der ganze Punkt — `new_game_preset_team_count_mismatch`
 * (unten) prueft genau die Zahl.
 */
export const NEW_GAME_PRESETS: Array<{
  presetId: NewGamePresetId;
  label: string;
  chrisTeamIds: string[];
  frankyTeamIds: string[];
  chrisCount: number;
  frankyCount: number;
  isOnline: boolean;
}> = [
  { presetId: "solo_1", label: "Solo 1 Team", chrisTeamIds: ["M-M"], frankyTeamIds: [], chrisCount: 1, frankyCount: 0, isOnline: false },
  {
    presetId: "solo_2",
    label: "Solo 2 Teams",
    chrisTeamIds: ["M-M", "D-P"],
    frankyTeamIds: [],
    chrisCount: 2,
    frankyCount: 0,
    isOnline: false,
  },
  {
    presetId: "solo_4",
    label: "Solo 4 Teams",
    chrisTeamIds: CHRIS_ONLINE_4V4_TEAM_IDS,
    frankyTeamIds: [],
    chrisCount: 4,
    frankyCount: 0,
    isOnline: false,
  },
  {
    presetId: "online_4v4",
    label: "Online 4v4",
    chrisTeamIds: CHRIS_ONLINE_4V4_TEAM_IDS,
    frankyTeamIds: FRANKY_ONLINE_4V4_TEAM_IDS,
    chrisCount: 4,
    frankyCount: 4,
    isOnline: true,
  },
  /**
   * `custom` heisst "der Anrufer benennt seine Teams selbst" — der Assistent schickt seit dem
   * Umbau auf freie Team-Auswahl ausschliesslich dieses Preset (siehe den `applyNewGamePreset`-
   * Effekt in FoundationTeamSettingsNewLook.tsx). Die Zahl 1 gilt deshalb NUR fuer den Fall, dass
   * gar keine Auswahl mitkommt; sobald der Anrufer eine Liste schickt, ist SIE die Ansage und die
   * Anzahl-Pruefung greift bewusst nicht (Kommentar an `presetVorgabeBenutzt` unten).
   */
  { presetId: "custom", label: "Custom", chrisTeamIds: ["M-M"], frankyTeamIds: [], chrisCount: 1, frankyCount: 0, isOnline: false },
];

function uniqueTeamIds(teamIds: string[] | undefined, validTeamIds: Set<string>) {
  return Array.from(new Set((teamIds ?? []).map((teamId) => teamId.trim()).filter((teamId) => validTeamIds.has(teamId))));
}

/** Vom Anrufer benannte Teams, die es in DIESEM Spielstand nicht gibt — vorher fielen sie stumm weg. */
function unbekannteTeamIds(teamIds: string[] | undefined, validTeamIds: Set<string>) {
  return Array.from(new Set((teamIds ?? []).map((teamId) => teamId.trim()).filter((teamId) => teamId && !validTeamIds.has(teamId))));
}

function getPreset(presetId: NewGamePresetId) {
  return NEW_GAME_PRESETS.find((preset) => preset.presetId === presetId) ?? NEW_GAME_PRESETS[0]!;
}

function buildStartRankByTeamId(teams: Team[]) {
  return new Map(
    [...teams]
      .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0) || a.teamId.localeCompare(b.teamId))
      .map((team, index) => [team.teamId, index + 1] as const),
  );
}

function createScenarioRoomMeta(input: {
  enabled: boolean;
  saveId?: string;
  now: string;
  chrisTeamIds: string[];
  frankyTeamIds: string[];
  /**
   * DIE TEAMS, DIE ES IN DIESEM SPIELSTAND WIRKLICH GIBT.
   *
   * GEMESSENER FEHLER: `buildOwnershipForPreset` wurde hier ohne diesen dritten Parameter
   * aufgerufen und fiel damit auf `ONLINE_ROOM_TEAM_IDS` zurueck — die 32er-Liga, fest verdrahtet.
   * Ein Battle-Spielstand (16 Teams) bekam so 32 Besitz-Zeilen in `scenarioMeta.teamOwnership`,
   * 16 davon fuer Teams, die in genau diesem Spielstand nicht existieren. Geister-Zeilen fallen
   * nirgends auf, bis irgendetwas ueber `teamOwnership` iteriert und ein Team sucht, das es nicht
   * gibt. Im Management-Modus sind beide Listen deckungsgleich (32 = 32), das Ergebnis dort also
   * unveraendert.
   */
  teamIds: string[];
}) {
  if (!input.enabled) {
    return {
      participants: [] as RoomParticipant[],
      ownership: [] as TeamOwnershipRecord[],
      roomId: undefined,
      roomCode: undefined,
    };
  }

  const roomCode = `NEW-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const room = createMultiplayerRoomMeta({
    roomCode,
    saveId: input.saveId ?? "created_on_apply",
    createdByUserId: "user_chris",
    now: input.now,
  });
  const participants = syncParticipantControlledTeams(
    [
      buildParticipant({
        participantId: "participant-chris",
        userId: "user_chris",
        displayName: "Chris",
        role: "host",
        controlledTeamIds: input.chrisTeamIds,
        now: input.now,
      }),
      buildParticipant({
        participantId: "participant-franky",
        userId: "user_franky",
        displayName: "Franky",
        role: "player",
        connectionStatus: "offline",
        controlledTeamIds: input.frankyTeamIds,
        now: input.now,
      }),
    ],
    [],
  );
  const ownership = buildOwnershipForPreset(participants, "chris_4_franky_4_rest_ai", input.teamIds);
  const patchedOwnership = ownership.map((entry) => {
    if (input.chrisTeamIds.includes(entry.teamId)) {
      return {
        ...entry,
        controllerType: "human" as const,
        participantId: "participant-chris",
        userId: "user_chris",
        ownerDisplayName: "Chris",
      };
    }
    if (input.frankyTeamIds.includes(entry.teamId)) {
      return {
        ...entry,
        controllerType: "human" as const,
        participantId: "participant-franky",
        userId: "user_franky",
        ownerDisplayName: "Franky",
      };
    }
    return {
      teamId: entry.teamId,
      controllerType: "ai" as const,
      ownerDisplayName: "AI",
    };
  });

  return {
    participants: syncParticipantControlledTeams(participants, patchedOwnership),
    ownership: patchedOwnership,
    roomId: room.roomId,
    roomCode: room.roomCode,
  };
}

function createConfirmToken(input: {
  presetId: NewGamePresetId;
  playMode: PlayMode;
  chrisTeamIds: string[];
  frankyTeamIds: string[];
  sandbox: boolean;
  baselineCount: number;
  playerCount: number;
  rankSignature: string;
}) {
  return [
    "new_game_setup_v1",
    input.presetId,
    // Der Management-Modus haengt hier bewusst GAR KEIN Segment an -- auch kein leeres. Ein
    // leerer String waere beim `join(":")` ein zusaetzliches `::` und haette damit JEDES bisher
    // ausgegebene Token entwertet (`new_game_setup_confirm_token_stale` bei jedem Neuspiel, das
    // die Vorschau vor dieser Aenderung geholt hat). So bleibt das Management-Token buchstabengleich,
    // und ein Battle-Token laesst sich trotzdem nie fuer ein Management-Neuspiel einloesen.
    ...(input.playMode === "battle" ? ["battle"] : []),
    input.sandbox ? "sandbox" : "standard",
    input.chrisTeamIds.join(","),
    input.frankyTeamIds.join(","),
    input.baselineCount,
    input.playerCount,
    input.rankSignature,
  ].join(":");
}

/**
 * DER GEHALTSFAKTOR MUSS STEHEN, BEVOR DIE SPONSORANGEBOTE GEBAUT WERDEN.
 *
 * GEMESSENER FEHLER (Live-Spielstand vom 4.8.): die Angebote entstanden hier im Neuspiel-Setup um
 * 06:03, das Faktor-Fenster wurde aber erst beim Speichern in der Persistenzschicht gesaet
 * (`withSeededSeasonEconomyFactors`, save-repository.ts) — im gemessenen Fall um 11:32. Die
 * Sponsorleiter friert den Faktor bei Unterschrift ein und fand zu diesem Zeitpunkt keinen: sie
 * nahm den Standardwert 1,0 (`getSponsorV3SalaryFactor`). Die Saison lief danach mit 1,18.
 *
 * Ergebnis: alle 32 Vertraege zahlten nach einem Faktor-1,0-Jahr, obwohl ein 1,18-Jahr gespielt
 * wurde. Der Liga fehlten 267,6 C — 10,7 Prozent des Topfes —, und 12 von 32 Teams standen nach
 * einem GUTEN Jahr im Minus. Die Verteilung stimmte, das Niveau nicht.
 *
 * Gesaet wird mit DERSELBEN Funktion und demselben Seed wie in der Persistenzschicht, damit beide
 * exakt dasselbe Fenster erzeugen; steht schon eines im Zustand, bleibt es unberuehrt.
 */
function withSeededSeasonEconomyFactorsForNewGame(gameState: GameState, saveId?: string): GameState {
  if ((gameState.seasonState.seasonEconomyFactors ?? []).length > 0) {
    return gameState;
  }
  const window = getSeasonEconomyFactorWindow({
    saveId: saveId ?? "season-1-new-game-preview",
    seasonId: gameState.season.id,
    seasonState: gameState.seasonState,
  });
  return { ...gameState, seasonState: { ...gameState.seasonState, seasonEconomyFactors: window } };
}

export function buildNewGameStateFromBaseline(input: NewGameSetupInput & { saveId?: string }) {
  const now = input.now ?? new Date().toISOString();
  // Passing input.saveId (when the caller already generated the real unique saveId, e.g.
  // applyNewGameSetup/createRoomCoopSave) ensures the very first season-1 discipline schedule
  // is seeded per-save rather than reusing the shared "local-game-state" default. Preview-only
  // calls (no saveId yet) still fall back to the default seed, which is fine since previews are
  // never persisted.
  const playMode = resolvePlayMode(input.playMode);
  const baseGameState = createFreshSeasonOneGameState(input.saveId, { playMode });
  const validTeamIds = new Set(baseGameState.teams.map((team) => team.teamId));
  const preset = getPreset(input.presetId);
  const warnings: string[] = [];
  const blockers: string[] = [];

  /**
   * ZWEI GRUNDVERSCHIEDENE FAELLE, DIE VORHER EINER WAREN.
   *
   * (a) Der Anrufer benennt seine Teams (`input.chrisTeamIds`) — das ist der Normalfall aus dem
   *     Assistenten, der seit dem Umbau auf freie Auswahl IMMER `custom` plus eine Liste schickt.
   *     Dann gilt seine Liste, gefiltert gegen den Spielstand, und die Anzahl ist SEINE Sache:
   *     wer bewusst zwei Teams anklickt, will zwei, egal welches Preset im Feld steht.
   * (b) Es kommt keine Liste — dann gilt die Preset-Vorgabe, und die ist ein Versprechen ueber die
   *     ANZAHL. Nur hier wird aus dem Pool aufgefuellt, und nur hier ist eine Abweichung ein Fehler.
   *
   * Vorher lief beides durch dieselbe Zeile (`uniqueTeamIds(input.chrisTeamIds ?? preset.chris...)`),
   * und die verlor im Battle-Modus stillschweigend die Haelfte der Preset-Teams.
   */
  const chrisVorgabeBenutzt = input.chrisTeamIds === undefined;
  const frankyVorgabeBenutzt = input.frankyTeamIds === undefined;

  /**
   * FRANKYS AUSDRUECKLICHE LISTE MUSS SCHON HIER STEHEN, VOR CHRIS' AUFLOESUNG.
   *
   * GEMESSENER FEHLER (Review-Befund F2, nachgestellt):
   * `buildNewGameStateFromBaseline({presetId:"online_4v4", playMode:"battle", frankyTeamIds:["A-A"]})`
   * — Chris ohne Liste (also Preset-Vorgabe), Franky mit einer — ergab
   * Chris `["D-P","M-M","A-A","B-B"]` und Franky `[]`, OHNE Warnung und OHNE Blocker.
   *
   * Ursache: hier stand `gastAnzahl: frankyVorgabeBenutzt ? preset.frankyCount : 0`. Bei einer
   * AUSDRUECKLICHEN Franky-Liste wurde also NICHTS fuer ihn zurueckgelegt; Chris' Auffuellung griff
   * sich `A-A` — Frankys einziges Wunschteam —, und die Zeile darunter
   * (`.filter((id) => !chrisTeamIds.includes(id))`) strich es ihm anschliessend weg. Uebrig blieb
   * ein Spieler mit null Teams, und weil eine ausdrueckliche Liste bewusst keiner Anzahl-Pruefung
   * unterliegt, sagte das niemand.
   *
   * Richtig ist: eine ausdrueckliche Liste ist eine STAERKERE Ansage als eine Wunschliste, nicht
   * eine schwaechere. Sie geht deshalb als `gastBevorzugt` mit IHRER EIGENEN Laenge als
   * `gastAnzahl` in die zweiseitige Aufloesung — die legt Frankys Teams im ersten Durchgang
   * beiseite, bevor Chris im zweiten auffuellt. Ueberschneiden sich beide Listen, gewinnt weiter
   * der Host: dieselbe Regel wie im `.filter(...)` unten, nur eine Stufe frueher angewandt.
   */
  const frankyAusdruecklicheTeamIds = frankyVorgabeBenutzt ? [] : uniqueTeamIds(input.frankyTeamIds, validTeamIds);

  /**
   * DIE ZWEISEITIGE AUFLOESUNG IMMER DANN, WENN CHRIS AUS DER VORGABE KOMMT. Nur dann wird auf
   * seiner Seite ueberhaupt aufgefuellt, und nur eine Auffuellung kann der anderen Seite etwas
   * wegnehmen (Begruendung an `loesePresetTeamsFuerBeideSeiten`). Was Franky beizusteuern hat —
   * die Preset-Wunschliste oder seine ausdrueckliche Auswahl —, entscheidet `frankyVorgabeBenutzt`;
   * beides wird gleichermassen vorab reserviert. Benennt Chris seine Teams selbst, wird auf seiner
   * Seite nicht aufgefuellt, und es genuegt, sie Franky unten als `bereitsVergeben` vorzulegen.
   */
  const chrisTeamIds = chrisVorgabeBenutzt
    ? loesePresetTeamsFuerBeideSeiten({
        pool: validTeamIds,
        hostBevorzugt: preset.chrisTeamIds,
        hostAnzahl: preset.chrisCount,
        gastBevorzugt: frankyVorgabeBenutzt ? preset.frankyTeamIds : frankyAusdruecklicheTeamIds,
        gastAnzahl: frankyVorgabeBenutzt ? preset.frankyCount : frankyAusdruecklicheTeamIds.length,
      }).host.teamIds
    : uniqueTeamIds(input.chrisTeamIds, validTeamIds);
  const frankyTeamIds = frankyVorgabeBenutzt
    ? loesePresetTeamsAusPool({
        bevorzugt: preset.frankyTeamIds,
        anzahl: preset.frankyCount,
        pool: validTeamIds,
        bereitsVergeben: chrisTeamIds,
      }).teamIds
    : frankyAusdruecklicheTeamIds.filter((teamId) => !chrisTeamIds.includes(teamId));
  const humanTeamIds = new Set([...chrisTeamIds, ...frankyTeamIds]);
  const aiTeamIds = baseGameState.teams.filter((team) => !humanTeamIds.has(team.teamId)).map((team) => team.teamId);

  if (chrisTeamIds.length === 0) {
    blockers.push("new_game_requires_at_least_one_chris_team");
  }

  /**
   * AUS ZWEI WARNUNGEN NUR FUER `online_4v4` WURDE EIN BLOCKER FUER JEDES PRESET.
   *
   * Die alten Warnungen (`online_4v4_expected_four_chris_teams`/`..._franky_teams`) waren eine
   * Beobachtung ohne Folgen — bei battle/online_4v4 lief das Spiel mit 2 gegen 4 weiter, und
   * `solo_4` hatte ueberhaupt keine Pruefung, gab Chris zwei Teams statt vier und sagte nichts.
   *
   * Seit der Pool-Aufloesung oben KANN ein Preset seine Anzahl aus jedem hinreichend grossen Pool
   * liefern (16 Teams reichen fuer 4+4 dreifach). Eine Abweichung ist damit keine unguenstige Lage
   * mehr, sondern eine verletzte Zusage — also ein Blocker und keine Warnung. Ein Neuspiel mit
   * schiefer Aufstellung entsteht so gar nicht erst, statt hinterher auffallen zu muessen.
   *
   * Nur fuer die Preset-Vorgabe (Fall b oben): eine ausdrueckliche Team-Auswahl des Anrufers darf
   * jede Anzahl haben — sonst wuerde der Assistent, der immer `custom` schickt, bei jeder Auswahl
   * ausser genau einem Team blockieren.
   */
  if (chrisVorgabeBenutzt && chrisTeamIds.length !== preset.chrisCount) {
    blockers.push(`new_game_preset_team_count_mismatch:chris:${input.presetId}:${preset.chrisCount}:${chrisTeamIds.length}`);
  }
  if (frankyVorgabeBenutzt && frankyTeamIds.length !== preset.frankyCount) {
    blockers.push(`new_game_preset_team_count_mismatch:franky:${input.presetId}:${preset.frankyCount}:${frankyTeamIds.length}`);
  }

  /**
   * Vom Anrufer BENANNTE Teams, die es in diesem Spielstand nicht gibt, verschwanden bisher ohne
   * ein Wort — genau die Klasse Fehler, aus der die Battle-Schieflage entstand. Bewusst eine
   * Warnung und kein Blocker: der Assistent baut seinen Klub-Waehler aus dem Team-Satz des neuen
   * Spielstands, kann also gar keine unbekannte ID schicken; eine unbekannte ID kommt von einem
   * alten Client oder einem Skript, und dem soll das Neuspiel nicht komplett verweigert werden,
   * solange mindestens ein gueltiges Team uebrig bleibt (`new_game_requires_at_least_one_chris_team`
   * faengt den Rest ab).
   */
  const unbekannte = [
    ...unbekannteTeamIds(chrisVorgabeBenutzt ? [] : input.chrisTeamIds, validTeamIds),
    ...unbekannteTeamIds(frankyVorgabeBenutzt ? [] : input.frankyTeamIds, validTeamIds),
  ];
  if (unbekannte.length > 0) {
    warnings.push(`new_game_unknown_team_ids:${Array.from(new Set(unbekannte)).join(",")}`);
  }

  const baselineReset = createNewGameFromPlayerBaseline({ gameState: baseGameState });
  if (!baselineReset.ok) {
    blockers.push(...baselineReset.blockers);
  }

  const startRankByTeamId = buildStartRankByTeamId(baseGameState.teams);
  const rankSignature = ["M-M", "R-R"]
    .map((teamId) => `${teamId}:${startRankByTeamId.get(teamId) ?? "missing"}`)
    .join("|");
  /**
   * DIESE ZWEI PRUEFUNGEN MESSEN GEGEN DIE 32er-LIGA -- im Battle-Modus messen sie ins Leere.
   *
   * Sie sind eine Plausibilitaetsprobe auf die Startbudgets: M-M muss der Startrang 1 sein, R-R
   * der Startrang 32. Ein Battle-Spielstand hat aber nur 16 Teams, und in der Platzhalter-Auswahl
   * (`waehleBattleModeTeamIds`) ist R-R gar nicht dabei, waehrend M-M dort auf Rang 5 der 16
   * liegt. Beide Pruefungen schluegen also bei JEDEM Battle-Neuspiel an und meldeten einen Fehler,
   * wo keiner ist -- eine Warnung, die immer kommt, wird in null Sekunden zu einer, die niemand
   * mehr liest. Fuer den Management-Modus bleiben sie Zeichen fuer Zeichen dieselben.
   */
  if (playMode !== "battle") {
    if (startRankByTeamId.get("M-M") !== 1) {
      warnings.push(`start_rank_reference_mismatch:M-M:${startRankByTeamId.get("M-M") ?? "missing"}`);
    }
    if (startRankByTeamId.get("R-R") !== 32) {
      warnings.push(`start_rank_reference_mismatch:R-R:${startRankByTeamId.get("R-R") ?? "missing"}`);
    }
  }

  const roomMeta = createScenarioRoomMeta({
    enabled: input.presetId === "online_4v4",
    saveId: input.saveId,
    now,
    chrisTeamIds,
    frankyTeamIds,
    teamIds: baseGameState.teams.map((team) => team.teamId),
  });

  const teamControlSettings = applyChrisFrankyOwnershipToTeamControlSettings(baseGameState.teams, chrisTeamIds, frankyTeamIds);

  const resetGameState = baselineReset.ok ? baselineReset.gameState : baseGameState;
  const standings: SeasonState["standings"] = Object.fromEntries(
    baseGameState.teams.map((team) => [
      team.teamId,
      {
        points: 0,
        rank: startRankByTeamId.get(team.teamId) ?? null,
        startplatz: startRankByTeamId.get(team.teamId) ?? null,
        rankDiff: 0,
      },
    ]),
  );

  const scenarioType: ScenarioType = input.sandbox ? "sandbox_multiseason_test" : "new_game";
  const saveName =
    input.saveName?.trim() ||
    (input.presetId === "online_4v4"
      ? `Oly Online 4v4 New Game ${formatGermanDateTime(now)}`
      : `Oly New Game ${getPreset(input.presetId).label} ${formatGermanDateTime(now)}`);

  const baseGameStateBeforeSponsorOffers: GameState = {
    ...resetGameState,
    // NUR IM BATTLE-MODUS GESETZT. Ein Management-Spielstand traegt das Feld GAR NICHT -- damit
    // ist sein GameState (und alles, was daraus abgeleitet oder verglichen wird) byteweise der
    // von vorher, statt sich nur "gleichbedeutend" zu verhalten.
    ...(playMode === "battle" ? { playMode } : {}),
    gamePhase: "season_active",
    saveVersion: 1,
    lastAppliedEventId: null,
    appliedEventIds: [],
    scenarioMeta: {
      scenarioType,
      label: saveName,
      saveMode: input.presetId,
      newGamePresetId: input.presetId,
      description: input.sandbox
        ? "Neues Sandbox-Testspiel aus immutable Player-Baseline."
        : "Neues Spiel aus immutable Player-Baseline und echten Startbudgets.",
      createdAt: now,
      isStableTestPoint: false,
      allowTestWrites: Boolean(input.sandbox),
      containsFinalStandings: false,
      containsSeasonHistory: false,
      activeSeasonId: "season-1",
      activeMatchday: 1,
      gamePhase: "season_active",
      humanControlledTeamCount: humanTeamIds.size,
      roomId: roomMeta.roomId,
      roomCode: roomMeta.roomCode,
      roomParticipants: roomMeta.participants,
      teamOwnership: roomMeta.ownership,
    },
    season: {
      ...resetGameState.season,
      id: "season-1",
      name: "Season 1",
      currentMatchday: 1,
    },
    matchdayState: {
      matchdayId: resetGameState.season.matchdayIds[0] ?? "season-1-matchday-1",
      status: "planning",
      pendingTeamIds: baseGameState.teams.map((team) => team.teamId),
      resolvedFixtureIds: [],
    },
    teams: resetGameState.teams.map((team) => ({
      ...team,
      cash: team.budget,
      humanControlled: humanTeamIds.has(team.teamId),
    })),
    rosters: [],
    contracts: [],
    transferHistory: [],
    playerPotential: buildPlayerPotentialRecordsForSave({
      saveId: input.saveId ?? "season-1-new-game-preview",
      players: resetGameState.players,
      gameState: resetGameState,
    }),
    playerProgressionEvents: [],
    seasonState: {
      ...resetGameState.seasonState,
      seasonId: "season-1",
      standings,
      teamControlSettings,
      teamFacilities: {},
      facilityEvents: [],
      teamSeasonObjectives: [],
      boardConfidence: {},
      contractEvents: [],
      preSeasonWorkflowLogs: [],
      playerGeneratorDrafts: [],
      contractNegotiationDrafts: [],
      transferWishlist: [],
      standingsApplyLogs: [],
      cashPrizeApplyLogs: [],
      matchdayAdvanceLogs: [],
      formCards: [],
      lineupDrafts: [],
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
      resultAuditLogs: [],
      seasonSnapshots: [],
      newGameFlow: {
        active: true,
        dismissed: false,
        selectedTeamId: chrisTeamIds[0] ?? frankyTeamIds[0] ?? null,
        updatedAt: now,
        steps: [
          { stepId: "season_intro", status: "open" },
          { stepId: "team_confirm", status: "open" },
          { stepId: "roster_review", status: "open" },
          { stepId: "first_transfers", status: "open" },
          { stepId: "fill_roster", status: "open" },
          { stepId: "training_facilities", status: "open" },
          { stepId: "choose_sponsor", status: "open" },
          { stepId: "set_lineup", status: "open" },
        ],
      },
    },
    logs: [
      {
        id: `log-new-game-${Date.now()}`,
        type: "system",
        message: `Neues Spiel vorbereitet (${getPreset(input.presetId).label}).`,
        createdAt: now,
      },
    ],
  };

  // SPONSORSYSTEM-VERSION ZUERST IN DEN SAVE, DANN ERST ANGEBOTE ERZEUGEN. Reihenfolge ist hier
  // nicht kosmetisch: `ensureSeasonSponsorOffers` liest die Version aus genau diesem gameState, um
  // zu entscheiden, welches Modell die 160 Angebote bekommen. Stuende der Vermerk erst danach im
  // Save, waeren die Angebote nach altem Recht gebaut und der Save behauptete "V2" — Anzeige und
  // Abrechnung liefen auseinander. Der Vermerk bleibt danach fuer die gesamte Lebensdauer des
  // Spielstands stehen und traegt ihn auch ueber Saisonuebergaenge und Serverneustarts.
  // Apron-Linien werden hier BEWUSST NICHT eingefroren (ein frueherer Stand tat es, mit leeren
  // Rosters griff der Referenz-Gehalt-Fallback). Die Season-1-Kader entstehen erst im New-Game-Flow
  // (first_transfers/fill_roster — das Kauffenster), und die Linie soll den Gehaltsstand messen,
  // gegen den die Saison wirklich antritt. Eingefroren wird beim Schliessen des Kauffensters, mit
  // der ersten Wertung des ersten Spieltags: `freezeApronLinesAtBuyWindowClose`
  // (apron-settlement-service.ts) — dieselbe Regel wie bei jedem Saisonuebergang. Bis dahin rechnen
  // Anzeige und KI-Kaufbremse mit der live abgeleiteten, als nicht-eingefroren markierten Linie.
  const baseGameStateWithSponsorSystem: GameState = withSeededSeasonEconomyFactorsForNewGame(
    stampSponsorSystemVersion(baseGameStateBeforeSponsorOffers),
    input.saveId,
  );

  // Seed sponsor offers up front so the "choose_sponsor" flow step (open by default, see
  // newGameFlow.steps above) always has real, selectable offers to show — otherwise the
  // Sponsoren tab flags red with nothing to pick from until some later flow (preseason
  // workflow / AI autopilot / choose route) happens to generate them. Offer generation is
  // deterministic for a given (season id, teamId), so calling this here is idempotent and
  // safe to run again later (e.g. via ensureSeasonSponsorOffers elsewhere) without reshuffling.
  const gameStateWithSponsorOffers: GameState = ensureSeasonSponsorOffers(baseGameStateWithSponsorSystem);

  // AI-/passive Teams signieren ihren Sponsor bereits in Season 1 (bestes Angebot), damit sie — wie das
  // eigene Team — ab S1 einen Vertrag samt sichtbarer Sponsoreinnahmen haben (Finanz-Vergleichstabelle,
  // Sponsor-Tab, Gehaltsabrechnung). Vorher unterschrieben AI-Teams erst beim S1→S2-Übergang, wodurch der
  // gesamte Gegner-Pool in S1 mit 0 Sponsoreinnahmen und leeren Sponsornamen dastand. Das MANUELL
  // gesteuerte (menschliche) Team wird bewusst übersprungen und wählt selbst über den choose_sponsor-Flow-
  // Schritt (chooseSponsorOfferForAiTeams überspringt controlMode==="manual"). Deterministisch + idempotent
  // (Teams mit bestehendem Vertrag werden übersprungen), deferBaseFirstPayout=true → keine sofortige
  // Cash-Gutschrift, die Basisrate wird regulär bei der Saison-Abrechnung fällig.
  const gameState: GameState = chooseSponsorOfferForAiTeams(gameStateWithSponsorOffers);

  const preview: NewGameSetupPreview = {
    mode: "preview",
    presetId: input.presetId,
    playMode,
    saveName,
    sandbox: Boolean(input.sandbox),
    scenarioType,
    chrisTeamIds,
    frankyTeamIds,
    aiTeamIds,
    teams: gameState.teams.map((team) => {
      const setting = teamControlSettings[team.teamId]!;
      return {
        teamId: team.teamId,
        shortCode: team.shortCode,
        name: team.name,
        budget: team.budget,
        startRank: startRankByTeamId.get(team.teamId) ?? 0,
        controlMode: setting.controlMode,
        ownerId: setting.ownerId ?? AI_OWNER_ID,
        ownerLabel: setting.displayLabel ?? "AI",
      };
    }),
    counts: {
      chris: chrisTeamIds.length,
      franky: frankyTeamIds.length,
      ai: aiTeamIds.length,
      passive: 0,
      total: gameState.teams.length,
    },
    baseline: {
      playerCount: baseGameState.players.length,
      baselineCount: baseGameState.playerBaselines?.length ?? 0,
      resetPlayers: baselineReset.ok ? baselineReset.resetPlayers : 0,
    },
    seasonSetup: {
      seasonId: "season-1",
      currentMatchday: 1,
      gamePhase: "season_active",
      matchdayCount: gameState.season.matchdayIds.length,
      scheduleCount: gameState.seasonState.disciplineSchedule?.length ?? gameState.season.matchdayIds.length,
      formCardsStatus: "pending_generation",
      lineupsStatus: "empty",
      standingsStatus: "empty_with_start_rank",
    },
    room:
      input.presetId === "online_4v4"
        ? {
            enabled: true,
            host: "Chris",
            pendingParticipant: "Franky",
            roomCode: "created_on_apply",
          }
        : { enabled: false },
    warnings,
    blockers,
    confirmToken: createConfirmToken({
      presetId: input.presetId,
      playMode,
      chrisTeamIds,
      frankyTeamIds,
      sandbox: Boolean(input.sandbox),
      baselineCount: baseGameState.playerBaselines?.length ?? 0,
      playerCount: baseGameState.players.length,
      rankSignature,
    }),
  };

  return {
    gameState,
    preview,
  };
}

export function previewNewGameSetup(input: NewGameSetupInput): NewGameSetupPreview {
  return buildNewGameStateFromBaseline(input).preview;
}

/**
 * Token-free helper for the co-op room flow: builds a fresh Season-1 online_4v4 save with the
 * host-chosen team split (Chris teams -> user_local human, Franky teams -> franky human, rest AI)
 * and persists it under a brand-new saveId so the room can bind and both players load it by URL.
 *
 * Unlike applyNewGameSetup this deliberately does NOT activate the save (co-op loads via the URL
 * saveId, so activating would clobber the global active/solo save). It is created with "archived"
 * status precisely so getActiveSave() - which picks the newest status='active' row - never returns
 * it; getSaveById(saveId) still loads it for the Foundation room bootstrap.
 */
export function createRoomCoopSave(
  input: {
    chrisTeamIds: string[];
    frankyTeamIds: string[];
    roomCode: string;
    now?: string;
    /**
     * F3 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Notausfahrt-Korrektur): Owner-ID des Hosts, die als
     * `created_by` festgeschrieben wird (siehe `createFreshSeasonOneSave`s `ownerId`-Parameter).
     * Optional/`null` fuer Rueckwaertskompatibilitaet -- nur `room-store.ts`s `startRoom` reicht
     * sie ein, jeder andere/aeltere Aufrufer verhaelt sich unveraendert (leere Urheberschaft, wie
     * vor dieser Korrektur).
     */
    hostOwnerId?: string | null;
    /**
     * Spielart des Koop-Spielstands. Fehlt sie, entsteht wie bisher ein Management-Save — jeder
     * aeltere Aufrufer verhaelt sich also unveraendert. `startRoom` (lib/room/room-store.ts) reicht
     * hier die Spielart durch, mit der der RAUM angelegt wurde: die Entscheidung faellt beim
     * Anlegen des Raums und nicht erst beim Start, weil schon die Team-Zuteilung in der Lobby aus
     * dem richtigen Pool kommen muss (16 statt 32).
     */
    playMode?: PlayMode;
  },
  persistence: PersistenceService = createPersistenceService(),
): { saveId: string; name: string } {
  const saveId = `new-game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const saveName = `Oly Online 4v4 - Raum ${input.roomCode}`;
  const prepared = buildNewGameStateFromBaseline({
    presetId: "online_4v4",
    playMode: input.playMode,
    chrisTeamIds: input.chrisTeamIds,
    frankyTeamIds: input.frankyTeamIds,
    saveId,
    saveName,
    now: input.now,
  });
  const created: PersistedSaveGame = persistence.createFreshSeasonOneSave({
    saveId,
    name: saveName,
    status: "archived",
    ownerId: input.hostOwnerId ?? null,
  });
  const saved = persistence.saveSingleplayerState(created.saveId, prepared.gameState);
  return { saveId: saved.saveId, name: saved.name };
}

export function applyNewGameSetup(
  input: NewGameSetupInput,
  persistence: PersistenceService = createPersistenceService(),
  options?: {
    /**
     * Owner of the acting session (only set when auth is on). When present, the new save becomes
     * active FOR THAT USER only — their `active_saves` pointer is moved and the other player's
     * active save is left untouched. Null/undefined -> unchanged global activate (blanket archive).
     */
    ownerId?: string | null;
  },
): NewGameSetupApplyResult {
  const ownerId = options?.ownerId ?? null;
  const previousActiveSaveId = persistence.getActiveSave(ownerId)?.saveId ?? null;
  const preliminary = buildNewGameStateFromBaseline(input);
  if (preliminary.preview.blockers.length > 0) {
    throw new Error(`new_game_setup_blocked:${preliminary.preview.blockers.join(",")}`);
  }
  if (!input.confirmToken || input.confirmToken !== preliminary.preview.confirmToken) {
    throw new Error("new_game_setup_confirm_token_stale");
  }

  const saveId = `new-game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const prepared = buildNewGameStateFromBaseline({ ...input, saveId });
  // ownerId threaded here too (not just the activateSave call below): createFreshSeasonOneSave
  // activates by default, and without ownerId that internal activate would hit the GLOBAL branch
  // (blanket-archive every other active save) before the explicit activateSave call below ever
  // runs — i.e. the damage would already be done.
  const created: PersistedSaveGame = persistence.createFreshSeasonOneSave({
    saveId,
    name: prepared.preview.saveName,
    ownerId,
  });
  const saved = persistence.saveSingleplayerState(created.saveId, prepared.gameState);
  persistence.activateSave(saved.saveId, ownerId);

  return {
    mode: "applied",
    save: {
      saveId: saved.saveId,
      name: saved.name,
    },
    previousActiveSaveId,
    preview: prepared.preview,
  };
}
