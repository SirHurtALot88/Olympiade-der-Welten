import type { GameState } from "@/lib/data/olyDataTypes";
import { FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS } from "@/lib/foundation/foundation-admin-dev-flags";
import { projiziereSaisonHistorie } from "@/lib/persistence/foundation-season-history-projection";
import { projiziereFieldRace } from "@/lib/persistence/foundation-field-race-projection";

function stableJson(value: unknown) {
  return JSON.stringify(value);
}

function matchesCompactSlice<T>(incoming: T, compactSlice: T) {
  return stableJson(incoming) === stableJson(compactSlice);
}

function preserveIfUnchangedFromCompact<T>(incoming: T, existing: T, compactSlice: T): T {
  return matchesCompactSlice(incoming, compactSlice) ? existing : incoming;
}

/**
 * Roster player-ids of the human-managed team(s).
 *
 * The compact initial payload strips every player's heavy `attributeSheetStats`
 * (fog-of-war + payload slimming) and only re-hydrates a single player on demand
 * when the profile drawer opens. But the whole-roster forecasts of the OWN team
 * (training-SP prognosis, per-intensity/-class gain, season-end preview) need the
 * full attribute sheet up front — without it `normalizePlayerAttributes` returns
 * null and the organic progression collapses to all-zeros (Training/Performance
 * +0, "Weitere Boni" −100%). Opponent sheets stay stripped; the own roster is
 * small (~1 team) so keeping its sheets in the payload is negligible.
 */
function resolveHumanRosterPlayerIds(gameState: GameState): Set<string> {
  const settings = gameState.seasonState.teamControlSettings;
  const humanTeamIds = settings
    ? new Set(
        Object.values(settings)
          .filter((setting) => setting?.controlMode === "manual")
          .map((setting) => setting.teamId),
      )
    : new Set(gameState.teams.filter((team) => team.humanControlled).map((team) => team.teamId));

  if (humanTeamIds.size === 0) {
    // Fallback: any team flagged human-controlled, so a save without control
    // settings still keeps its own-roster sheets rather than zeroing training.
    for (const team of gameState.teams) {
      if (team.humanControlled) humanTeamIds.add(team.teamId);
    }
  }

  return new Set(
    (gameState.rosters ?? [])
      .filter((roster) => humanTeamIds.has(roster.teamId))
      .map((roster) => roster.playerId),
  );
}

/**
 * Der Schluessel, an dem ein Archiv-Eintrag wiedererkannt wird.
 *
 * Beide Archive tragen eine eigene Kennung (`snapshotId` bei den Saison-Schnappschuessen, `id` bei
 * den Standings-Buchungen). Faellt beides aus, dient der Inhalt selbst als Schluessel — dann ist ein
 * Eintrag hoechstens sich selbst gleich, und die Wache haelt ihn erst recht fest.
 */
function archiveEntryKey(entry: unknown): string {
  if (entry && typeof entry === "object") {
    const record = entry as Record<string, unknown>;
    for (const field of ["snapshotId", "id", "seasonId"] as const) {
      const value = record[field];
      if (typeof value === "string" && value.length > 0) {
        return `${field}:${value}`;
      }
    }
  }
  return `json:${stableJson(entry)}`;
}

/**
 * ARCHIVSCHUTZ FUER DIE PUT-RUNDREISE — schuetzt den INHALT, nicht die Anzahl.
 *
 * Die kompakte Anfangsladung streicht `seasonSnapshots`/`standingsApplyLogs` auf `undefined`, und
 * der Browser stempelt an dieselbe Stelle eine LEERE LISTE (`apply-compact-season-archive-sentinel`).
 * Ein naives `incoming ?? existing` liesse dieses `[]` beim naechsten Spiel-PUT das dauerhafte
 * Archiv ueberschreiben — jede vergangene Saison waere weg.
 *
 * DIE ALTE WACHE VERGLICH NUR LAENGEN (`incomingLength >= existingLength ? incoming : existing`).
 * Gemessen am Live-Abbild `new-game-1785823388048-1hf25q`: eine gleich lange, inhaltlich
 * ausgeraeumte Liste kam anstandslos durch — `finalStandings` 32 -> 0 Zeilen, 3.546.497 B ->
 * 3.249.724 B, und die Wache meldete nichts. Heute schreibt niemand so eine Liste; der Code
 * verliess sich aber darauf, dass das so bleibt.
 *
 * DIE REGEL, DIE JETZT GILT: dieser Weg darf das Archiv nur WACHSEN lassen. Ein Eintrag, der im
 * Spielstand liegt, bleibt Zeichen fuer Zeichen erhalten; neue Eintraege werden angehaengt. Das ist
 * keine Verschaerfung ins Blaue, sondern genau die Zusage, die der Client ohnehin gibt: er verfasst
 * Schnappschuesse nie (siehe `buildAutoPersistContentSignature` in `use-foundation-persist`, wo
 * `seasonSnapshots` aus der Aenderungserkennung genommen ist, weil „der Client Schnappschuesse nie
 * verfasst"). Geschrieben werden sie ausschliesslich serverseitig ueber
 * `persistGameStateWithMaterializedDerivations` — dieser Weg hier ist nur der Browser-PUT und kommt
 * an dieser Wache gar nicht vorbei.
 *
 * Reihenfolge: die bestehenden Eintraege behalten ihre, neue haengen hinten an. Damit ist das
 * Ergebnis bei unveraendertem Eingang identisch mit dem Bestand — die Rundreise bleibt Identitaet.
 */
function preserveAppendOnlyArchive<T extends unknown[] | undefined>(incoming: T, existing: T): T {
  if (existing === undefined || existing.length === 0) {
    return incoming ?? existing;
  }
  if (incoming === undefined) {
    return existing;
  }

  const bekannteSchluessel = new Set(existing.map(archiveEntryKey));
  // Bestehende Eintraege gewinnen IMMER — auch wenn der Eingang einen gleichnamigen mitbringt.
  // Genau das ist der Unterschied zur Laengen-Wache: eine ausgeraeumte Fassung desselben
  // Schnappschusses kommt hier nicht mehr durch.
  const zusaetzlich = incoming.filter((entry) => !bekannteSchluessel.has(archiveEntryKey(entry)));
  return (zusaetzlich.length === 0 ? existing : [...existing, ...zusaetzlich]) as T;
}

function mergeKeyedCollection<T>(
  incoming: T[],
  existing: T[],
  compactSlice: T[],
  key: (item: T) => string,
): T[] {
  if (matchesCompactSlice(incoming, compactSlice)) {
    return existing;
  }

  const incomingByKey = new Map(incoming.map((item) => [key(item), item] as const));
  const preservedFromExisting = existing.filter((item) => !incomingByKey.has(key(item)));
  return [...preservedFromExisting, ...incoming];
}

/** Slim initial Foundation payload: strips heavy history and non-active matchday slices. */
export function compactFoundationInitialGameState(gameState: GameState): GameState {
  // Keep the OWN team's attribute sheets in the compact payload so whole-roster
  // forecasts (training-SP, per-intensity/-class gain, season-end preview) work
  // immediately — opponent sheets remain stripped and hydrate on demand.
  const keepSheetPlayerIds = FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS ? null : resolveHumanRosterPlayerIds(gameState);
  const keepSheetsFor = (playerId: string) =>
    FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS || (keepSheetPlayerIds?.has(playerId) ?? false);

  return {
    ...gameState,
    playerBaselines: undefined,
    baselineWriteGuardEvents: undefined,
    transferHistory: gameState.transferHistory,
    logs: [],
    players: gameState.players.map((player) => ({
      ...player,
      attributeSheetStats: keepSheetsFor(player.id) ? player.attributeSheetStats : undefined,
      attributeSheetRatings: keepSheetsFor(player.id) ? player.attributeSheetRatings : undefined,
      flavorEn: "",
      flavorDe: "",
      previousDisciplineRatings: undefined,
      lastSeasonDisciplineValues: undefined,
      currentDisciplineValues: undefined,
      disciplineDelta: undefined,
    })),
    seasonState: {
      ...gameState.seasonState,
      persistedSeasonDerivations: undefined,
      seasonSnapshots: undefined,
      /**
       * Ersatz fuer die gestrichenen Schnappschuesse — siehe
       * `foundation-season-history-projection`. Ohne das zeigte die Saison-Verlauf-Karte fuer jede
       * vergangene Saison „—", weil die Historie mangels Schnappschuss auf Platzhalterzeilen mit
       * `rank: null` zurueckfiel. Die Daten waren nie weg, sie kamen nur nie im Browser an.
       *
       * Landet BEWUSST nicht in `seasonSnapshots`: der Archivschutz laesst dieses Feld ueber die
       * PUT-Rundreise nur WACHSEN und haelt jeden vorhandenen Eintrag Zeichen fuer Zeichen fest
       * (siehe `preserveAppendOnlyArchive`). Eine Kurzfassung unter demselben Namen waere trotzdem
       * falsch: sie wuerde ab dem naechsten Laden als „das Archiv" gelesen und jede Ansicht, die
       * die schweren Anhaenge braucht, still auf Luecken rechnen lassen. Ein eigenes Feld sagt
       * ehrlich, was es ist.
       */
      foundationSeasonHistory: projiziereSaisonHistorie(gameState.seasonState.seasonSnapshots),
      /**
       * Geschwister-Projektion fuers laufende Feld-Rennen — die EINZIGE, die stehen bleibt.
       *
       * Sie entstand aus demselben Grund wie die fuenf entfernten (beschnittene
       * `matchdayResults`/`disciplineResults`), traegt aber inzwischen einen anderen: Home baut
       * die Voll-Derivationen bewusst NICHT (`shouldLoadSeasonDerivations` deckt Home nicht ab),
       * und ohne sie meldete die Kachel „erst 0 Spieltage". Die Projektion ist dort die billige
       * Antwort, nicht die einzig richtige. Nachgemessen am Live-Abbild (S2/MD10 und S1/MD2):
       * Projektion und Eigenbau liefern Zeichen fuer Zeichen dasselbe Ledger — sie verfaelscht
       * also nichts, sie erspart nur die Rechnung.
       */
      foundationFieldRace: projiziereFieldRace(gameState),
      standingsApplyLogs: undefined,
      /**
       * FAEHRT VOLLSTAENDIG MIT — die Beschneidung ist ERSATZLOS ENTFALLEN.
       *
       * ANSAGE VON CHRIS: „bitte keine gekuerzten spielstaende". Die Messung gibt ihm recht,
       * und zwar deutlicher als erwartet. Am Live-Save (Saison 2, Spieltag 10) gemessen:
       *
       *   voller Spielstand                33,16 MB
       *   gekuerzt                         15,19 MB   (18,4 MB gespart)
       *   davon durch `disciplineResults`   271,5 KB -> 26,8 KB, also 245 KB
       *   davon durch `lineupDrafts`        658,5 KB -> 69,7 KB, also 589 KB
       *
       * Diese beiden Felder zusammen tragen 834 KB zur Ersparnis bei — 4,5 % von dem, was die
       * Kuerzung insgesamt einspart. Der Berg liegt woanders (persistedSeasonDerivations 5,7 MB,
       * seasonSnapshots 3,5 MB, injuryEvents 2,3 MB, playerBaselines 4,7 MB); die bleiben
       * beschnitten.
       *
       * Bezahlt haben wir diese 834 KB mit sechs Fehlern, die alle dieselbe Bauart hatten: eine
       * Ansicht rechnet im Browser selbst und bekommt dabei nicht etwa ein leeres Feld, sondern
       * eine FALSCHE ZAHL. Spieltags-Ergebnis (32 von 32 Zeilen falsch), Rekordbuch (7 von 7
       * Haltern falsch), Meilensteine, PP-Formbonus (nur 14 von 32 Teams, Werte teils zu hoch),
       * Formkarten-Alarm der Inbox (605 gemeldete Strafpunkte, in Wahrheit null), Saisonziele.
       *
       * 834 KB auf 15,19 MB sind +5,5 % Ladelast. Das ist der Preis dafuer, dass jede dieser
       * Rechnungen wieder von selbst stimmt, statt einzeln durch eine Projektion abgesichert
       * werden zu muessen. Der Handel ist eindeutig.
       *
       * DIE FUENF PROJEKTIONEN DAZU SIND ERSATZLOS ENTFERNT (foundationMatchdayPoints,
       * foundationRecordBook, foundationDisciplineTally, foundationPpAreaFormBonus,
       * foundationFormCardBonus). Nachgewiesen, nicht angenommen: an beiden aktiven Spielstaenden
       * (S2/MD10 mit 640 Disziplin-Zeilen und 320 Aufstellungen, S1/MD2 mit 64/63) liefert jeder
       * ihrer Leser mit und ohne Projektion Zeichen fuer Zeichen dasselbe Ergebnis — und dasselbe
       * wie der Server auf dem vollen Spielstand.
       *
       * Weg mussten sie nicht nur wegen der 22 KB. `buildSeasonFormCardBonusByTeamId` gab der
       * Projektion BEDINGUNGSLOS Vorrang (`if (projektion && projektion.seasonId === seasonId)
       * return …`) — kein Deckungsvergleich, kein Zurueckfallen. Die Projektion entsteht beim
       * LADEN; wer waehrend der Sitzung eine Formkarte legte, rechnete danach gegen einen
       * veralteten Stand, bis er neu lud. Eine zweite Rechenstelle fuer dieselbe Zahl, die den
       * frischeren Wert ueberstimmt — genau die Fehlerklasse, gegen die die Projektionen einmal
       * gebaut wurden.
       */
      disciplineResults: gameState.seasonState.disciplineResults ?? [],
      /**
       * FAEHRT VOLLSTAENDIG MIT — bewusst nicht auf den aktiven Spieltag beschnitten.
       *
       * Diese Liste ist kein Datenberg, sondern ein Verzeichnis: eine schmale Zeile je
       * gewertetem Spieltag (gemessen 10 Zeilen = 4,7 KB, +0,027 % des Payloads). Die
       * schwere Fracht sind `disciplineResults` und die bleiben beschnitten.
       *
       * Beschnitten war sie trotzdem teuer: `getCurrentSeasonMatchdayResultIds` in
       * `team-season-objectives-service` erkennt an ihr, welche Ergebnisse zur laufenden
       * Saison gehoeren, und wirft alles weg, was nicht drinsteht. Im Browser blieb davon
       * genau ein Spieltag uebrig — also zaehlten die Saisonziele nur den aktiven mit.
       * Gemessen am Live-Save: Server 4/3 Top-20 (erfuellt), Browser 0/3, bestes Rank #33.
       * `getRemainingMatchdays` verrechnete sich aus demselben Grund und meldete fast die
       * ganze Saison als offen.
       */
      matchdayResults: gameState.seasonState.matchdayResults ?? [],
      /** Ebenfalls vollstaendig — siehe die Herleitung bei `disciplineResults` (589 KB). */
      lineupDrafts: gameState.seasonState.lineupDrafts ?? [],
    },
  };
}

function mergePlayerAfterCompactEdit(
  existingPlayer: GameState["players"][number],
  incomingPlayer: GameState["players"][number],
  compactPlayer: GameState["players"][number],
) {
  if (matchesCompactSlice(incomingPlayer, compactPlayer)) {
    return existingPlayer;
  }

  const merged = { ...existingPlayer, ...incomingPlayer };
  const strippedFields = [
    "attributeSheetStats",
    "attributeSheetRatings",
    "flavorEn",
    "flavorDe",
    "previousDisciplineRatings",
    "lastSeasonDisciplineValues",
    "currentDisciplineValues",
    "disciplineDelta",
  ] as const;

  for (const field of strippedFields) {
    if (incomingPlayer[field] === compactPlayer[field]) {
      const preserved = existingPlayer[field];
      if (preserved !== undefined) {
        Object.assign(merged, { [field]: preserved });
      }
    }
  }

  return merged;
}

function lineupDraftMergeKey(draft: NonNullable<GameState["seasonState"]["lineupDrafts"]>[number]) {
  if (draft.lineupId) {
    return draft.lineupId;
  }

  return `${draft.saveId}:${draft.seasonId}:${draft.matchdayId}:${draft.teamId}`;
}

/** Restore compact-stripped slices when the client PUT still reflects the compact load. */
export function rehydrateGameStateAfterCompactPut(existing: GameState, incoming: GameState): GameState {
  const compactFromExisting = compactFoundationInitialGameState(existing);
  const incomingIds = new Set(incoming.players.map((player) => player.id));
  const preservedPlayers = existing.players.filter((player) => !incomingIds.has(player.id));
  const compactPlayersById = new Map(compactFromExisting.players.map((player) => [player.id, player] as const));
  const existingPlayersById = new Map(existing.players.map((player) => [player.id, player] as const));

  const rehydratedPlayers = incoming.players.map((incomingPlayer) => {
    const existingPlayer = existingPlayersById.get(incomingPlayer.id);
    const compactPlayer = compactPlayersById.get(incomingPlayer.id);
    if (!existingPlayer || !compactPlayer) {
      return incomingPlayer;
    }
    return mergePlayerAfterCompactEdit(existingPlayer, incomingPlayer, compactPlayer);
  });

  return {
    ...incoming,
    playerBaselines: incoming.playerBaselines ?? existing.playerBaselines,
    baselineWriteGuardEvents: incoming.baselineWriteGuardEvents ?? existing.baselineWriteGuardEvents,
    transferHistory: preserveIfUnchangedFromCompact(
      incoming.transferHistory,
      existing.transferHistory,
      compactFromExisting.transferHistory,
    ),
    logs: preserveIfUnchangedFromCompact(incoming.logs, existing.logs, compactFromExisting.logs),
    players: [...preservedPlayers, ...rehydratedPlayers],
    seasonState: {
      ...incoming.seasonState,
      persistedSeasonDerivations:
        incoming.seasonState.persistedSeasonDerivations ?? existing.seasonState.persistedSeasonDerivations,
      // Append-only-Archive: der kompakte Client stempelt eine leere Liste `[]` an diese
      // Stelle. Die Wache haelt jeden vorhandenen Eintrag unveraendert fest und laesst nur
      // NEUE hinzukommen — siehe `preserveAppendOnlyArchive`.
      seasonSnapshots: preserveAppendOnlyArchive(
        incoming.seasonState.seasonSnapshots,
        existing.seasonState.seasonSnapshots,
      ),
      /**
       * FAELLT HIER RAUS, IMMER. Die Kurzfassung der Saisonhistorie faehrt nur zum Browser hinaus
       * (siehe `compactFoundationInitialGameState`); zurueck darf sie nicht. Sie ist eine
       * Projektion aus `seasonSnapshots`, also abgeleitet — im Spielstand haette sie nichts zu
       * suchen ausser Gewicht, und jede Aenderung an den echten Schnappschuessen wuerde sie still
       * veralten lassen. Beim naechsten Ausliefern wird sie ohnehin frisch gebaut.
       */
      foundationSeasonHistory: undefined,
      // Dieselbe Regel wie die Saison-Historie darueber: reine Anzeigefracht, faehrt nur
      // zum Browser hinaus und wird beim naechsten Ausliefern frisch gebaut.
      foundationFieldRace: undefined,
      /**
       * DIE FUENF ENTFERNTEN PROJEKTIONEN WERDEN HIER WEITER AUSGERAEUMT — und das ist kein
       * Ueberbleibsel, sondern Absicht: ein Browser-Tab, der noch die alte Auslieferung im
       * Speicher hat, schickt sie beim naechsten Speichern zurueck. Ohne diese Zeilen landeten
       * sie dauerhaft im Spielstand und waeren ab dann eine zweite, nie wieder aufgefrischte
       * Wahrheit. Die Felder selbst sind aus dem Typ verschwunden, deshalb der Umweg ueber
       * `undefined` auf einem aufgeweiteten Objekt.
       */
      ...({
        foundationFormCardBonus: undefined,
        foundationMatchdayPoints: undefined,
        foundationRecordBook: undefined,
        foundationDisciplineTally: undefined,
        foundationPpAreaFormBonus: undefined,
      } as Record<string, undefined>),
      standingsApplyLogs: preserveAppendOnlyArchive(
        incoming.seasonState.standingsApplyLogs,
        existing.seasonState.standingsApplyLogs,
      ),
      lineupDrafts: mergeKeyedCollection(
        incoming.seasonState.lineupDrafts ?? [],
        existing.seasonState.lineupDrafts ?? [],
        compactFromExisting.seasonState.lineupDrafts ?? [],
        lineupDraftMergeKey,
      ),
      matchdayResults: mergeKeyedCollection(
        incoming.seasonState.matchdayResults ?? [],
        existing.seasonState.matchdayResults ?? [],
        compactFromExisting.seasonState.matchdayResults ?? [],
        (result) => result.id,
      ),
      disciplineResults: mergeKeyedCollection(
        incoming.seasonState.disciplineResults ?? [],
        existing.seasonState.disciplineResults ?? [],
        compactFromExisting.seasonState.disciplineResults ?? [],
        (result) => result.id,
      ),
    },
  };
}
