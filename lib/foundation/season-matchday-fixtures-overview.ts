/**
 * SPIELTAGS-PAARUNGEN MIT ERGEBNIS — Task #159 Punkt 2 (Saisonstand-UI, Modus "Spieltage").
 *
 * GENAU DAS, WAS DER KONZEPTDOC VERMISST (docs/design/liga-split-plan.md Abschnitt 6, Konzeptdoc
 * 16.10. Abschnitt 4.4 Fund 10): ein Spielplan-Tab, der je Spieltag zeigt, WER gegen WEN spielt
 * und WIE das Duell ausging — recherchiert, nicht vermutet: `MatchdayResultNewLook.tsx` (die
 * heutige Spieltagsergebnis-Ansicht) zeigt nur die EIGENEN Disziplin-Ergebnisse, kein `opponent`
 * im ganzen File; der Arena-Zuschauer (`FoundationBattleArenaHost.tsx`) zeigt genau EIN selbst
 * gewähltes Duell, keine Liste aller Paarungen; keine Matchday-Navigationskomponente existiert
 * außerhalb des Admin-Debug-Tools `legacy-resolve-lab`.
 *
 * DIE DATEN WAREN SCHON FAST VOLLSTAENDIG DA — reine Projektion, keine neue Persistenz:
 *  - `findeSpieltagsFixtures()` (lib/resolve/battle-mode-pps-duell.ts) liefert Heim/Gast je
 *    Spieltag direkt aus `seasonState.schedule`.
 *  - `DisciplineResultRecord` (pro Team UND Disziplin) trägt bereits `opponentTeamId`,
 *    `duellSeiten: [diese Seite, Gegner]`, `verhaeltnis`, `resolutionSource` (Arena/Brücke-
 *    Markierung) und `arenaAusfall` (PR #1269/K1-Sichtbarkeit).
 *  - `gameState.seasonState.disciplineResults` trägt seit Commit `8ec6454b` die VOLLE Saison
 *    (nicht mehr auf den aktiven Spieltag beschnitten, s. Kommentar bei `foundationFieldRace` in
 *    olyDataTypes.ts) — für die laufende Saison kein neuer API-Roundtrip nötig.
 *
 * RÜCKSPIEL-ERKENNUNG, KORRIGIERT GEGENÜBER DER ERSTEN ANNAHME: `occurrenceInSeason`
 * (`SeasonDisciplineScheduleSlot`) markiert, welche SAISONHÄLFTE eine DISZIPLIN-Zuordnung
 * betrifft (Hinrunde/Rückrunde der Disziplin-Rotation, `season-discipline-schedule.ts`) — das
 * ist ein ANDERES System als der FIXTURE-Spielplan und sagt NICHTS darüber aus, ob zwei
 * bestimmte Teams sich in dieser Saison ein zweites Mal treffen. Nachgelesen in
 * `season-fixture-schedule.ts`: der Spielplan ist ein Circle-Rundenplan mit `matchdayIds.length`
 * Runden aus einem Fenster von bis zu 2·(LEAGUE_SIZE-1) Runden (Doppel-Rundenplan nur, wenn mehr
 * Spieltage als Einfach-Runden) — bei 20 Spieltagen und 15 Einfach-Runden trifft NUR EIN TEIL
 * der Paarungen (rechnerisch 5 von 15 je Liga) ein zweites Mal aufeinander, mit getauschter
 * Heim/Auswärts-Seite; der Rest spielt in dieser Saison nur einmal. Ein generisches
 * "Hinrunde/Rückrunde"-Saisonabzeichen gibt es deshalb NICHT (es gibt keine zwei symmetrischen
 * Hälften) — `findeFruehereBegegnung()` unten prüft darum DIREKT am Spielplan, ob es für GENAU
 * DIESES Team-Paar schon eine frühere Begegnung mit getauschten Seiten gab, und markiert nur
 * dann "Rückspiel gegen X".
 *
 * PRÄZISIERUNG (Opus, 17.10., bestätigt gegen Konzeptdoc 16.10. Abschnitt 2.1 — Hin-/Rückrunde ist
 * dort selbst als Begriff der DISZIPLIN definiert, nicht der Gegner): die beiden Konzepte bleiben
 * getrennt und werden an UNTERSCHIEDLICHEN Stellen ausgegeben. Je PAARUNG: `istRueckspiel`/
 * `hinspielMatchdayId`/`hinspielMatchdayLabel` NUR, wenn `findeFruehereBegegnung()` tatsächlich
 * ein früheres Treffen mit getauschten Seiten findet — mit konkretem Verweis ("Hinspiel: Spieltag
 * 4"), kein generisches Badge. Je DISZIPLIN: `occurrenceInSeason` (1|2) direkt aus dem
 * Rotationsplan-Slot — das ist der ehrliche Ort für "1./2. Durchgang", weil jede Disziplin genau
 * zweimal in der Saison läuft, mit eigener Kadergröße je Durchgang.
 *
 * MINI-DM-VORBEREITUNG (nur vorbereiten, nicht bauen): `SpieltagsPaarungTeilnehmer[]` ist
 * bewusst eine LISTE statt eines festen `{home, away}`-Paars — heute immer genau zwei Einträge
 * mit `rolle: "heim"|"gast"`. Ein künftiges 4-Team-Pod-Format (Mini-DM, Platz 1..4) könnte hier
 * vier Einträge mit `rolle: "pod"` und einem zusätzlichen Platz-Feld einsetzen, ohne den Typ
 * selbst oder die Builder-Funktion umzubauen — nur ein neuer Zweig bei der Erzeugung.
 */
import type {
  DisciplineResultRecord,
  Fixture,
  GameState,
} from "@/lib/data/olyDataTypes";
import type { ArenaAusfall } from "@/lib/resolve/legacy-matchday-resolve-types";
import { isBattleModeSave } from "@/lib/season/game-mode";
import { getLeagueOf, type LeagueTier } from "@/lib/season/league-split";
import { findeSpieltagsFixtures } from "@/lib/resolve/battle-mode-pps-duell";
import { getSeasonDisciplineScheduleEntry } from "@/lib/season/season-discipline-schedule";

export type SpieltagsPaarungTeilnehmer = {
  teamId: string;
  /**
   * Heute immer "heim"/"gast" (ein Duell). Ein 4-Team-Pod-Format würde hier eine eigene Rolle
   * (z. B. "pod") mit zusätzlichem Platz-Feld einsetzen — s. Dateikommentar.
   */
  rolle: "heim" | "gast";
};

export type SpieltagsDuellDisziplin = {
  disciplineId: string;
  disciplineName: string;
  disciplineSide: "d1" | "d2";
  gespielt: boolean;
  /** Das eigentliche Ergebnis, z. B. "2:0/1:1/0:2" — die Duell-Teampunkte je Seite, NICHT die Rohwerte. */
  punkteHeim: number | null;
  punkteGast: number | null;
  /** Rohwerte (z. B. 70:15) aus HEIMTEAM-Perspektive: [heim, gast]. `null`, solange nicht gewertet. */
  seiten: [number, number] | null;
  /** Punkteverhältnis ±D aus Sicht des HEIMTEAMS. `null` außerhalb von Battle-Duellen/ungespielt. */
  verhaeltnisHeim: number | null;
  /** Dieselbe Größe aus Sicht des GASTTEAMS — eigenständig aus dessen Zeile gelesen (Gegenprobe: Summe = 0). */
  verhaeltnisGast: number | null;
  /** `null`, solange nicht gewertet. */
  resolutionSource: "pps" | "arena" | "pps_duell" | null;
  arenaAusfall: ArenaAusfall | null;
  /**
   * PRÄZISIERUNG (Opus, 17.10.): Hin-/Rückrunde ist ein Begriff der DISZIPLIN (jede läuft genau
   * zweimal in der Saison, mit eigener Kadergröße je Durchgang), NICHT der Paarung — s.
   * Dateikommentar. Hier der ehrliche Ort dafür, roh aus dem Disziplin-Rotationsplan
   * (`SeasonDisciplineScheduleSlot.occurrenceInSeason`). Die UI macht daraus z. B. "2. Durchgang";
   * `null` bei Alt-Saves/Manager-Mode ohne diese Markierung.
   */
  occurrenceInSeason: 1 | 2 | null;
};

export type SpieltagsPaarung = {
  fixtureId: string;
  matchdayId: string;
  leagueTier: LeagueTier | null;
  teilnehmer: SpieltagsPaarungTeilnehmer[];
  homeTeamId: string;
  awayTeamId: string;
  /** `true`, sobald mindestens eine Disziplin dieses Duells gewertet ist. */
  gespielt: boolean;
  disziplinen: SpieltagsDuellDisziplin[];
  /** `true`, wenn dieselben zwei Teams sich an einem FRÜHEREN Spieltag schon mit getauschten Seiten begegnet sind. */
  istRueckspiel: boolean;
  /** Spieltag der früheren Begegnung, nur gesetzt wenn `istRueckspiel`. */
  hinspielMatchdayId: string | null;
  /** Lesbares Label dazu (z. B. "Spieltag 4"), für den direkten UI-Hinweis "Hinspiel: Spieltag 4". */
  hinspielMatchdayLabel: string | null;
};

export type SpieltagsUebersicht = {
  matchdayId: string;
  matchdayIndex: number;
  paarungen: SpieltagsPaarung[];
};

/**
 * Lesbarer Grund für einen ausgefallenen Arena-Lauf (`ArenaAusfallGrund`, PR #1269/K1) — es gab
 * dafür noch KEINE Beschriftung im Projekt (nachgesehen: kein Treffer außerhalb von
 * `legacy-matchday-resolve-types.ts` selbst). Der "Spieltage"-Modus ist die erste Stelle, die
 * `arenaAusfall` überhaupt sichtbar macht.
 */
export function arenaAusfallGrundLabel(grund: ArenaAusfall["grund"]): string {
  switch (grund) {
    case "chromium_start":
      return "Browser konnte nicht starten";
    case "timeout":
      return "Zeitüberschreitung";
    case "absturz":
      return "Absturz";
    case "liga_fehlgeschlagen":
      return "Liga-Lauf fehlgeschlagen";
    case "ergebnis_unvollstaendig":
      return "Ergebnis unvollständig";
    case "abgebrochen_neustart":
      return "abgebrochen (Neustart)";
    case "deaktiviert":
      return "deaktiviert";
    case "nicht_ausgefuehrt":
      return "noch nicht ausgeführt";
    default:
      return grund;
  }
}

/**
 * Die dezente Quellen-Markierung je Disziplin, die Chris in der UI sehen soll: "Arena",
 * "PPS-Duell" oder "PPS-Duell mit Hinweis 'Arena ausgefallen: <Grund>'" — macht PR #1269s
 * `arenaAusfall` (bisher nur in Rohdaten sichtbar) hier erstmals für den Spieler lesbar.
 * Leerer String, solange die Disziplin nicht gewertet ist.
 */
export function resolveSpielquelleLabel(disziplin: Pick<SpieltagsDuellDisziplin, "gespielt" | "resolutionSource" | "arenaAusfall">): string {
  if (!disziplin.gespielt || disziplin.resolutionSource == null) {
    return "";
  }
  if (disziplin.resolutionSource === "arena") {
    return "Arena";
  }
  if (disziplin.resolutionSource === "pps_duell") {
    if (disziplin.arenaAusfall != null) {
      return `PPS-Duell — Arena ausgefallen: ${arenaAusfallGrundLabel(disziplin.arenaAusfall.grund)}`;
    }
    return "PPS-Duell";
  }
  // "pps": der alte Rangtabellen-Pfad -- im Spieltage-Modus (nur Battle-Saves) nicht erwartet,
  // aber kein Fehlerwurf an einer reinen Lese-/Anzeigefunktion.
  return "Rangtabelle";
}

/**
 * NUR bei Battle-Saves mit echtem Fixture-Plan sichtbar (Auftrag: Manager-Saves mit
 * Dummy-Paarungen — `buildSeasonFixtures()` in preseason-workflow-service.ts, ein `i % n`-
 * Rundenlauf ohne Liga-/Duell-Bedeutung — zeigen diesen Modus gar nicht).
 */
export function istSpieltagsModusVerfuegbar(gameState: Pick<GameState, "scenarioMeta" | "seasonState">): boolean {
  if (!isBattleModeSave(gameState)) {
    return false;
  }
  return (gameState.seasonState.schedule?.length ?? 0) > 0;
}

/** teamId -> seine DisciplineResultRecord-Zeilen AN DIESEM SPIELTAG, nach disciplineId. */
function buildTeamDisciplineRowsAtMatchday(
  gameState: GameState,
  matchdayId: string,
): Map<string, Map<string, DisciplineResultRecord>> {
  const matchdayIdByResultId = new Map<string, string>();
  for (const result of gameState.seasonState.matchdayResults ?? []) {
    matchdayIdByResultId.set(result.id, result.matchdayId);
  }

  const byTeam = new Map<string, Map<string, DisciplineResultRecord>>();
  for (const row of gameState.seasonState.disciplineResults ?? []) {
    if (matchdayIdByResultId.get(row.matchdayResultId) !== matchdayId) {
      continue;
    }
    let byDiscipline = byTeam.get(row.teamId);
    if (!byDiscipline) {
      byDiscipline = new Map();
      byTeam.set(row.teamId, byDiscipline);
    }
    // Ein Team hat je Disziplin genau eine Zeile pro Spieltag — eine zweite (sollte nicht
    // vorkommen) würde hier die erste überschreiben, bewusst kein Fehlerwurf an dieser Stelle.
    byDiscipline.set(row.disciplineId, row);
  }
  return byTeam;
}

/**
 * Gibt es für GENAU dieses Team-Paar (in GETAUSCHTEN Seiten) eine frühere Begegnung im
 * Saison-Spielplan? S. Dateikommentar — das ist pair-spezifisch, nicht saisonhälften-weit.
 */
function findeFruehereBegegnung(
  schedule: readonly Fixture[],
  matchdayIndexById: Map<string, number>,
  fixture: Fixture,
): Fixture | null {
  const thisIndex = matchdayIndexById.get(fixture.matchdayId) ?? Number.POSITIVE_INFINITY;
  let fruehesteBegegnung: Fixture | null = null;
  let fruehesterIndex = thisIndex;
  for (const kandidat of schedule) {
    if (kandidat.homeTeamId !== fixture.awayTeamId || kandidat.awayTeamId !== fixture.homeTeamId) {
      continue;
    }
    const kandidatIndex = matchdayIndexById.get(kandidat.matchdayId) ?? Number.POSITIVE_INFINITY;
    if (kandidatIndex < fruehesterIndex) {
      fruehesterIndex = kandidatIndex;
      fruehesteBegegnung = kandidat;
    }
  }
  return fruehesteBegegnung;
}

/**
 * Baut die Paarungen EINES Spieltags, optional auf eine Liga eingegrenzt. `null`, wenn der Modus
 * für diesen Save nicht gilt (`istSpieltagsModusVerfuegbar`) oder der Spieltag unbekannt ist.
 */
export function buildSpieltagsUebersicht(
  gameState: GameState,
  matchdayId: string,
  options?: { leagueTier?: LeagueTier },
): SpieltagsUebersicht | null {
  if (!istSpieltagsModusVerfuegbar(gameState)) {
    return null;
  }

  const matchdayIndex = gameState.season.matchdayIds.indexOf(matchdayId);
  if (matchdayIndex < 0) {
    return null;
  }

  const matchdayIndexById = new Map(gameState.season.matchdayIds.map((id, index) => [id, index] as const));
  const schedule = gameState.seasonState.schedule ?? [];
  let fixtures = findeSpieltagsFixtures(gameState, matchdayId);
  if (options?.leagueTier) {
    fixtures = fixtures.filter(
      (fixture) =>
        (fixture.leagueTier ?? getLeagueOf(gameState, fixture.homeTeamId)) === options.leagueTier,
    );
  }

  const scheduleEntry = getSeasonDisciplineScheduleEntry(gameState, matchdayId);
  const disziplinSlots = [scheduleEntry?.discipline1, scheduleEntry?.discipline2].filter(
    (slot): slot is NonNullable<typeof slot> => slot != null,
  );

  const rowsByTeam = buildTeamDisciplineRowsAtMatchday(gameState, matchdayId);

  const paarungen: SpieltagsPaarung[] = fixtures.map((fixture) => {
    const homeRows = rowsByTeam.get(fixture.homeTeamId);
    const awayRows = rowsByTeam.get(fixture.awayTeamId);
    const disziplinen: SpieltagsDuellDisziplin[] = disziplinSlots.map((slot, slotIndex) => {
      const homeRow = homeRows?.get(slot.disciplineId) ?? null;
      const awayRow = awayRows?.get(slot.disciplineId) ?? null;
      const gespielt = (homeRow != null && homeRow.teamPoints != null) || (awayRow != null && awayRow.teamPoints != null);
      return {
        disciplineId: slot.disciplineId,
        disciplineName: slot.displayName,
        disciplineSide: slotIndex === 0 ? "d1" : "d2",
        gespielt,
        punkteHeim: homeRow?.teamPoints ?? null,
        punkteGast: awayRow?.teamPoints ?? null,
        seiten: gespielt && homeRow?.duellSeiten ? homeRow.duellSeiten : null,
        verhaeltnisHeim: gespielt ? homeRow?.verhaeltnis ?? null : null,
        verhaeltnisGast: gespielt ? awayRow?.verhaeltnis ?? null : null,
        resolutionSource: gespielt ? homeRow?.resolutionSource ?? awayRow?.resolutionSource ?? null : null,
        arenaAusfall: homeRow?.arenaAusfall ?? awayRow?.arenaAusfall ?? null,
        occurrenceInSeason: slot.occurrenceInSeason ?? null,
      };
    });

    const fruehereBegegnung = findeFruehereBegegnung(schedule, matchdayIndexById, fixture);

    return {
      fixtureId: fixture.id,
      matchdayId: fixture.matchdayId,
      leagueTier: fixture.leagueTier ?? getLeagueOf(gameState, fixture.homeTeamId),
      teilnehmer: [
        { teamId: fixture.homeTeamId, rolle: "heim" as const },
        { teamId: fixture.awayTeamId, rolle: "gast" as const },
      ],
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      gespielt: disziplinen.some((d) => d.gespielt),
      disziplinen,
      istRueckspiel: fruehereBegegnung != null,
      hinspielMatchdayId: fruehereBegegnung?.matchdayId ?? null,
      // Dieselbe Konvention wie an jeder anderen Spieltag-Label-Stelle im Projekt (z. B.
      // legacy-lineup-local-service.ts, game-inbox-service.ts): 1-basiert aus dem Schedule-Index.
      hinspielMatchdayLabel: fruehereBegegnung
        ? `Spieltag ${(matchdayIndexById.get(fruehereBegegnung.matchdayId) ?? 0) + 1}`
        : null,
    };
  });

  return { matchdayId, matchdayIndex, paarungen };
}
