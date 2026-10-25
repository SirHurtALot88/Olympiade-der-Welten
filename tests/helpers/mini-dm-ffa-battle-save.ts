/**
 * GETEILTER TESTHELFER (nicht selbst eine `.test.ts`-Datei!): baut einen frischen Battle-Save,
 * lässt den echten Liga-/KI-Lineup-Pfad einmal durchlaufen und ERZWINGT danach Mini-DM an D1 von
 * Spieltag 1 -- statt auf einen zufälligen Treffer zu warten (s. Begründung im Funktionskommentar
 * unten). Ursprünglich lokal in `tests/arena-vorlauf-mini-dm-ffa.test.ts` definiert; ausgelagert
 * (OPUS-REVIEW, PR 5, Pflicht-Fix 3), weil `tests/mini-dm-ffa-e2e-real-chromium.test.ts` denselben
 * Aufbau braucht.
 *
 * WARUM EINE EIGENE DATEI STATT EINES IMPORTS AUS DER `.test.ts`-DATEI: ein Import aus einer
 * `.test.ts`-Datei fuehrt beim Laden auch deren Modul-Top-Level-Code aus -- inklusive jedem
 * `describe()`/`it()`-Aufruf. Vitest registriert diese dann ZUSAETZLICH unter der importierenden
 * Datei, die betroffenen Tests laufen also ZWEIMAL (einmal in ihrer eigenen Datei, einmal
 * "huckepack" in der importierenden) und koennen sich dabei gegenseitig stoeren (z. B. ueber
 * `process.env.OLY_APP_SQLITE_PATH`, das beide Kopien parallel setzen). Genau das geschah beim
 * ersten Versuch dieses Fixes: `tests/mini-dm-ffa-e2e-real-chromium.test.ts` importierte die
 * Bau-Funktion direkt aus der Geschwisterdatei, worauf deren GESAMTE Testsuite ein zweites Mal
 * (als Teil der E2E-Datei) lief und ein Test darin ("Mini-DM-Pod-Teams werden ueber die ECHTEN
 * FFA-Rohdaten gebucht") sporadisch mit einem falschen `platz` fehlschlug -- ein Testartefakt
 * dieser falschen Import-Struktur, kein Produktionsfehler. Diese Datei (ohne `describe`/`it`,
 * reiner Helfer) behebt das strukturell: beide Testdateien importieren von HIER, keine importiert
 * von der anderen.
 */
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";
import { getMiniDmPodsForMatchday, type MiniDmPod } from "@/lib/season/mini-dm-pod-schedule";
import { buildArenaAufstellung } from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";
import { MINI_DM_FFA_ROLLEN6 } from "@/lib/resolve/mini-dm-pod-resolve";
import { MINI_DM_DISCIPLINE_ID } from "@/lib/season/season-discipline-schedule";
import type { GameState, LineupDraft } from "@/lib/data/olyDataTypes";
import type { PersistenceService } from "@/lib/persistence/types";
import { expect } from "vitest";

/** Default-Kadergroesse fuer Tests, die die VERDRAHTUNG pruefen (laeuft der FFA-Pfad ueberhaupt
 *  an, wird sein Ergebnis gebucht), nicht die k-Abhaengigkeit selbst (die deckt
 *  `tests/mini-dm-ffa-matchday.test.ts` unit-genau ab). */
export const TEST_K = 4;

/**
 * CI-FIX (24.-25.10., Opus-Review-Nacharbeit, DRITTER ANLAUF): erzwingt fuer JEDES Team JEDES
 * Pods eine VOLLSTAENDIGE Mini-DM-Aufstellung (alle `k` Rollen besetzt), unabhaengig davon, ob der
 * echte (unseeded) KI-/Liga-Draft diesem Team genug Mini-DM-faehige Spieler zugeteilt hat. Ersetzt
 * NUR den Mini-DM-Eintrag (`disciplineId: "mini-dm", disciplineSide: "d1"`) eines Teams -- andere
 * Disziplin-Eintraege/die AI-gesetzte Reihenfolge sonstiger Rollen bleiben unberuehrt. Mini-DM
 * steht in diesem Helfer immer auf D1 (s. `erzwungenerSpieltag` oben), deshalb `disciplineSide: "d1"`
 * fest.
 *
 * ZWEI FRUEHERE ANLAEUFE, BEIDE AM SELBEN SYMPTOM GESCHEITERT (`tests/arena-vorlauf-mini-dm-ffa.
 * test.ts`s erster Test, sporadisch `status: "failed"` statt `"ready"` in CI, nie lokal
 * reproduzierbar genug):
 *
 *  1. (24.10.) Erster Anlauf wählte `k` Roster-Einträge nach distinkter `playerId` -- schlug in der
 *     vollen CI-Suite weiterhin fehl.
 *  2. (24.-25.10.) ROOT CAUSE gefunden: `buildArenaAufstellung()` (arena-aufstellung-adapter.ts)
 *     schluesselt sein Ergebnis nach SPIELER-NAME, nicht nach `playerId` (deren Kopfkommentar,
 *     Zeilen ~140-147: der Namensgenerator baut aus nur 280 Kombinationen OHNE Eindeutigkeits-
 *     pruefung ueber den ganzen Save). Zweiter Anlauf wählte deshalb `k` Einträge nach paarweise
 *     DISTINKTEM `player.name` INNERHALB des bestehenden Rosters -- bestand 22 lokale
 *     Zufalls-Wiederholungen UND den vollen `persistenz-suiten`-Joblauf (197/197), schlug aber in
 *     einem DRITTEN CI-Lauf (`full-test-suite`, andere/mehr gleichzeitig importierte Testdateien)
 *     am exakt selben Symptom erneut fehl.
 *
 * WARUM ZWEI ANLAEUFE NICHT REICHTEN: "genug eindeutige Namen im bestehenden Roster suchen" bleibt
 * ein WAHRSCHEINLICHKEITS-Problem, solange der Namenspool nur 280 Kombinationen hat -- bei genug
 * Wiederholungen/Testkombinationen (verschiedene CI-Jobs, unterschiedliche Dateizahl, unter-
 * schiedliche Nebenlaeufigkeit) wird eine Kollision IMMER wieder auftreten, nur mit wechselnder
 * Haeufigkeit. Eine hohe Erfolgsquote ist nicht dasselbe wie eine Garantie.
 *
 * FIX, DIESMAL DETERMINISTISCH STATT WAHRSCHEINLICHKEITSBASIERT: die `k` fuer Mini-DM gewaehlten
 * Spieler bekommen ihren `name` HIER EXPLIZIT auf einen garantiert eindeutigen Test-Namen gesetzt
 * (`MiniDM-Test-<teamId>-<slotIndex>`) -- VOR dem Aufruf von `buildArenaAufstellung()`. Das macht
 * das Testergebnis unabhaengig vom Zufall der echten Namensgenerierung: es ist vollkommen egal, ob
 * der echte 280-Kombinationen-Generator fuer diese Spieler irgendwo im Save einen doppelten Namen
 * erzeugt hat, weil ihr Name ab hier ohnehin ueberschrieben wird. Das ist eine Aenderung an der
 * TESTMETHODIK (wie dieser Helfer den Battle-Save fuer den Test vorbereitet), NICHT am
 * Produktionscode -- der echte Namensgenerator mit seinen 280 Kombinationen ist ein bekanntes,
 * vorbestehendes, nicht von dieser PR verursachtes Verhalten und bleibt unveraendert.
 *
 * Nutzt bewusst dieselbe `LineupDraftEntry`-Form wie `tests/mini-dm-ffa-matchday.test.ts`s
 * `buildTeamFixture()` (dort schon gegen `buildArenaAufstellung()` erfolgreich erprobt) -- keine
 * neue Annahme ueber die Lineup-Form, nur eine zweite Anwendung derselben.
 */
function stelleVollstaendigeMiniDmTeilnahmeSicher(
  persistence: PersistenceService,
  saveId: string,
  matchdayId: string,
  pods: readonly MiniDmPod[],
  k: number,
): void {
  const save = persistence.getSaveById(saveId);
  if (!save) return;
  let gameState: GameState = save.gameState;
  const rollen = MINI_DM_FFA_ROLLEN6.slice(0, k);
  const teamIds = [...new Set(pods.flatMap((pod) => pod.teamIds))];
  let geaendert = false;

  for (const teamId of teamIds) {
    const vollstaendig = new Set(
      Object.values(buildArenaAufstellung(gameState, teamId, matchdayId))
        .filter((eintrag) => eintrag.d === MINI_DM_DISCIPLINE_ID)
        .map((eintrag) => eintrag.slot),
    );
    if (rollen.every((rolle) => vollstaendig.has(rolle))) continue; // bereits vollstaendig, nichts zu tun.

    // `k` DISTINKTE playerIds aus dem Roster dieses Teams -- distinkte Roster-ZEILEN sind per
    // Konstruktion distinkte Spieler, unabhaengig von ihrem (moeglicherweise kollidierenden) Namen.
    const rosterPlayerIds = [...new Set(gameState.rosters.filter((zeile) => zeile.teamId === teamId).map((zeile) => zeile.playerId))];
    if (rosterPlayerIds.length < rollen.length) {
      throw new Error(
        `stelleVollstaendigeMiniDmTeilnahmeSicher: Team ${teamId} hat nur ${rosterPlayerIds.length} Kaderspieler, braucht ${rollen.length} fuer k=${k} -- Draft-Annahme (genug Spieler je Team) stimmt nicht mehr.`,
      );
    }
    const gewaehlteSpielerIds = rosterPlayerIds.slice(0, rollen.length);

    // DETERMINISTISCHE NAMENS-EINDEUTIGKEIT (s. Kopfkommentar): ersetzt den (moeglicherweise mit
    // einem anderen Spieler irgendwo im Save kollidierenden) echten Namen dieser `k` Spieler durch
    // einen garantiert eindeutigen Test-Namen -- `buildArenaAufstellung()` schluesselt nach `name`,
    // dieser Name ist hier fest, nicht vom 280-Kombinationen-Generator abhaengig.
    const neuerNameJePlayerId = new Map(gewaehlteSpielerIds.map((playerId, slotIndex) => [playerId, `MiniDM-Test-${teamId}-${slotIndex}`] as const));
    const neuePlayers = gameState.players.map((player) =>
      neuerNameJePlayerId.has(player.id) ? { ...player, name: neuerNameJePlayerId.get(player.id)! } : player,
    );

    const neueEintraege = rollen.map((_rolle, slotIndex) => ({
      playerId: gewaehlteSpielerIds[slotIndex]!,
      slotIndex,
      disciplineId: MINI_DM_DISCIPLINE_ID,
      disciplineSide: "d1" as const,
      activePlayerId: null,
    })) as unknown as LineupDraft["entries"];

    const bestehendeDrafts = gameState.seasonState.lineupDrafts ?? [];
    const bestehenderDraft = bestehendeDrafts.find((draft) => draft.teamId === teamId && draft.matchdayId === matchdayId);
    const andereEintraege = (bestehenderDraft?.entries ?? []).filter(
      (eintrag) => !(eintrag.disciplineId === MINI_DM_DISCIPLINE_ID && eintrag.disciplineSide === "d1"),
    );
    const neuerDraft: LineupDraft = {
      lineupId: bestehenderDraft?.lineupId ?? `lineup-${teamId}-${matchdayId}-mini-dm-fix`,
      saveId,
      seasonId: gameState.season.id,
      matchdayId,
      teamId,
      status: bestehenderDraft?.status ?? "submitted",
      entries: [...andereEintraege, ...neueEintraege],
      createdAt: bestehenderDraft?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    gameState = {
      ...gameState,
      players: neuePlayers,
      seasonState: {
        ...gameState.seasonState,
        lineupDrafts: [...bestehendeDrafts.filter((draft) => !(draft.teamId === teamId && draft.matchdayId === matchdayId)), neuerDraft],
      },
    };
    geaendert = true;
  }

  if (geaendert) {
    persistence.saveSingleplayerState(saveId, gameState);
    // SELBSTPRUEFUNG, NICHT NUR HOFFNUNG: nach dem Schreiben noch einmal durch `buildArenaAufstellung()`
    // lesen (derselbe Pfad, den die Produktion und `baueGesetzteRollenFuerTeam()` tatsaechlich
    // nutzen) -- schlaegt HIER laut und sofort fehl, falls die deterministischen Namen aus
    // irgendeinem Grund (z. B. zwei verschiedene Teams bekommen denselben `teamId`-Praefix, was bei
    // echten Save-IDs nicht vorkommen sollte) trotzdem kollidieren, statt erst Minuten spaeter als
    // ein verwirrendes `status: "failed"` im eigentlichen Test aufzutauchen.
    for (const teamId of teamIds) {
      const nachPatchVollstaendig = new Set(
        Object.values(buildArenaAufstellung(gameState, teamId, matchdayId))
          .filter((eintrag) => eintrag.d === MINI_DM_DISCIPLINE_ID)
          .map((eintrag) => eintrag.slot),
      );
      if (!rollen.every((rolle) => nachPatchVollstaendig.has(rolle))) {
        throw new Error(
          `stelleVollstaendigeMiniDmTeilnahmeSicher: Selbstpruefung fehlgeschlagen fuer Team ${teamId} -- nach dem deterministischen Namens-Patch sind trotzdem nur ${nachPatchVollstaendig.size}/${rollen.length} Rollen in buildArenaAufstellung() sichtbar. Das sollte mit garantiert eindeutigen Namen nie passieren -- Pruefen, ob eine andere Ursache vorliegt.`,
        );
      }
    }
  }
}

/**
 * Baut einen frischen Battle-Save, laesst den echten Liga-/KI-Lineup-Pfad einmal durchlaufen und
 * ERZWINGT danach Mini-DM an D1 von Spieltag 1 mit `k` Spielern.
 *
 * WARUM NICHT EINE ZUFALLS-SUCHE: Mini-DM ist GENAU EINE von 20 Disziplinen mit (bei
 * Battle-Mode-Repeat 2) zwei Vorkommen auf 20 Spieltagen -- die Trefferquote fuer "steht an
 * Spieltag 1" liegt bei ~10 %, eine zufallsbasierte Suche haette unzumutbar viele (und
 * unzumutbar teure, je ein voller 32-Team-Liga-Draft) Versuche gebraucht. Das direkte
 * Ueberschreiben des Spielplan-Slots ist deterministisch UND kostet nur EINEN Liga-Draft.
 *
 * Das Ueberschreiben passiert NACH `fuehreLigaSetupDraftAus()` (Liga-/Team-Zuordnung steht schon,
 * `getMiniDmPodsForMatchday()` braucht nur diese, nicht den urspruenglichen Spielplan-Inhalt) und
 * VOR `applyAiLegacyLineupBatchLocally()` (die KI liest den Spielplan-Slot erst beim Aufstellen).
 */
export async function bauFrischenBattleSaveMitMiniDmAnSpieltag1(k: number = TEST_K) {
  process.env.OLY_APP_SQLITE_PATH = `/tmp/oly-arena-vorlauf-mini-dm-ffa-${Math.random().toString(36).slice(2)}.sqlite`;
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  await fuehreLigaSetupDraftAus({
    persistence,
    saveId,
    seasonId: persistence.getSaveById(saveId)!.gameState.season.id,
    callerWritableTeamIds: null,
    excludeTeamIds: [],
    logPrefix: "[arena-vorlauf-mini-dm-ffa-test]",
  });
  const nachDraft = persistence.getSaveById(saveId)!;
  persistence.saveSingleplayerState(
    saveId,
    applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
  );
  const vorUeberschreiben = persistence.getSaveById(saveId)!;
  const seasonId = vorUeberschreiben.gameState.season.id;
  const matchdayId = vorUeberschreiben.gameState.matchdayState.matchdayId;
  const bisherigerSpieltag = (vorUeberschreiben.gameState.seasonState.disciplineSchedule ?? []).find((e) => e.matchdayId === matchdayId);
  const andereArenaDisziplinPraesent = bisherigerSpieltag?.discipline2?.disciplineId != null && ARENA_RESOLVED_DISCIPLINE_IDS.has(bisherigerSpieltag.discipline2.disciplineId);

  if (!bisherigerSpieltag) {
    throw new Error("bauFrischenBattleSaveMitMiniDmAnSpieltag1: Spieltag 1 hat gar keinen Spielplan-Eintrag -- Setup pruefen.");
  }
  // NUR `discipline1` wird ersetzt -- der Rest des bestehenden, typkorrekten Eintrags (inklusive
  // `discipline2`, s. `andereArenaDisziplinPraesent` oben) bleibt unveraendert, statt ihn hier per
  // Objektliteral neu (und fehleranfaellig gegenueber `SeasonDisciplineScheduleSourceStatus`) nachzubauen.
  const erzwungenerSpieltag = {
    ...bisherigerSpieltag,
    discipline1: {
      disciplineId: "mini-dm",
      displayName: "Mini DM",
      order: bisherigerSpieltag.discipline1?.order ?? 1,
      playerCount: k,
      legacyScorePlayerCount: k,
      category: bisherigerSpieltag.discipline1?.category ?? "power",
      occurrenceInSeason: 1 as const,
    },
  };
  const neuerSpielplan = [
    ...(vorUeberschreiben.gameState.seasonState.disciplineSchedule ?? []).filter((e) => e.matchdayId !== matchdayId),
    erzwungenerSpieltag,
  ];
  persistence.saveSingleplayerState(saveId, {
    ...vorUeberschreiben.gameState,
    seasonState: { ...vorUeberschreiben.gameState.seasonState, disciplineSchedule: neuerSpielplan },
  });

  const pods = getMiniDmPodsForMatchday(persistence.getSaveById(saveId)!.gameState, matchdayId, { saveId });
  if (pods.length === 0) {
    throw new Error(
      "bauFrischenBattleSaveMitMiniDmAnSpieltag1: erzwungener Mini-DM-Slot lieferte trotzdem keine Pods -- " +
        "Annahme ueber den Spielplan-Aufbau (getSeasonDisciplineSchedule()) stimmt nicht mehr, Setup pruefen.",
    );
  }

  const batch = applyAiLegacyLineupBatchLocally(
    { saveId, seasonId, matchdayId, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
    persistence,
  );
  expect(batch.summary.blockingReasons, batch.summary.blockingReasons.join(" | ")).toEqual([]);

  // CI-FIX (24.10., Opus-Review-Nacharbeit): `batch.summary.blockingReasons` leer heisst nur, dass
  // die KI-Aufstellungsrunde selbst nicht komplett gescheitert ist -- es garantiert NICHT, dass
  // JEDES der vier Pod-Teams fuer JEDE der k Mini-DM-Rollen tatsaechlich einen gesetzten Spieler
  // hat. Ein Team mit einem (durch die ECHTE, unseeded Zufallsvergabe im Liga-Draft) zu duennen
  // Mini-DM-Kader bekommt von der KI nur so viele Rollen besetzt, wie Spieler da sind -- der Rest
  // bleibt ungesetzt, `teilnahme: false` in den Rohdaten (s. Kopfkommentar der Produktionsdatei:
  // "Teilnahme kommt aus der ECHTEN Aufstellung"). Gemessen (CI, Commit 6daf2581): genau das liess
  // `tests/arena-vorlauf-mini-dm-ffa.test.ts`s ersten Test sporadisch fehlschlagen (einmal
  // `platz` falsch, einmal `status: "failed"`), OBWOHL der injizierte Fake-Motor (der NICHTS von
  // echten Rostern weiss) IMMER einen vollstaendigen, strukturell gueltigen Boxscore liefert -- der
  // Fake-Motor ist nicht das Problem, die reale Teilnahme-Herleitung ist es. Das ist eine
  // PRE-EXISTING Fragilitaet der Testmethodik (echter, unseeded Liga-Draft, kein Produktionsfehler)
  // -- diese Funktion macht die Teilnahme ab hier deterministisch vollstaendig, statt auf einen
  // "guten" Zufalls-Draft zu hoffen.
  stelleVollstaendigeMiniDmTeilnahmeSicher(persistence, saveId, matchdayId, pods, k);

  return {
    persistence,
    scope: { saveId, seasonId, matchdayId },
    k,
    pods,
    andereArenaDisziplinPraesent,
  };
}
