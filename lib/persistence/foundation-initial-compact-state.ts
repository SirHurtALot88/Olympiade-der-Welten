import type { GameState } from "@/lib/data/olyDataTypes";
import { FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS } from "@/lib/foundation/foundation-admin-dev-flags";
import { projiziereSaisonHistorie } from "@/lib/persistence/foundation-season-history-projection";
import { projiziereFieldRace } from "@/lib/persistence/foundation-field-race-projection";
import { projiziereFormkartenBilanz } from "@/lib/persistence/foundation-form-card-projection";
import { projiziereRekordbuch } from "@/lib/persistence/foundation-record-book-projection";
import { projiziereDisziplinBilanz } from "@/lib/persistence/foundation-discipline-tally-projection";
import { projiziereSpieltagsPunkte } from "@/lib/persistence/foundation-matchday-points-projection";
import { projizierePpAreaFormBonus } from "@/lib/persistence/foundation-pp-area-form-bonus-projection";

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
 * Append-only archive guard for compact-load round-trips.
 *
 * The Foundation compact load strips `seasonSnapshots`/`standingsApplyLogs` to
 * `undefined`, and the client re-stamps an EMPTY sentinel `[]` (see
 * `apply-compact-season-archive-sentinel`). A naive `incoming ?? existing`
 * (and even `preserveIfUnchangedFromCompact`, whose compact baseline is
 * `undefined` — `"[]" !== undefined`) would let that `[]` clobber the durable
 * DB archive on the next gameplay PUT — wiping every prior-season snapshot.
 *
 * These archives are APPEND-ONLY (they only grow, one entry per completed
 * season / applied matchday). So the safe rule is: only accept the incoming
 * array when it has AT LEAST as many entries as the persisted one; otherwise
 * keep the durable copy. This blocks both the empty sentinel and any partial
 * fetch from shrinking the archive, while still accepting legitimate growth
 * (a freshly-completed season adds a snapshot → incoming is longer → wins).
 */
function preserveAppendOnlyArchive<T extends unknown[] | undefined>(incoming: T, existing: T): T {
  const incomingLength = incoming?.length ?? 0;
  const existingLength = existing?.length ?? 0;
  return incomingLength >= existingLength ? incoming : existing;
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
  const activeMatchdayId = gameState.matchdayState.matchdayId;
  const activeMatchdayResults = (gameState.seasonState.matchdayResults ?? []).filter(
    (result) => result.matchdayId === activeMatchdayId,
  );
  const activeMatchdayResultIds = new Set(activeMatchdayResults.map((result) => result.id));

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
       * Landet BEWUSST nicht in `seasonSnapshots`: der Archivschutz vergleicht nur die Anzahl der
       * Eintraege, eine gleich lange Kurzfassung kaeme also durch und wuerde die vollen
       * Schnappschuesse beim naechsten Speichern ueberschreiben.
       */
      foundationSeasonHistory: projiziereSaisonHistorie(gameState.seasonState.seasonSnapshots),
      /**
       * Geschwister-Projektion fuers laufende Feld-Rennen: der Browser kann die gewerteten
       * Spieltage aus dem kompakten Payload nicht mehr selbst zaehlen (matchdayResults/
       * disciplineResults sind hier auf den aktiven Spieltag beschnitten) — Home meldete
       * deshalb mitten in der Saison „erst 0 Spieltage". Die fertige Antwort faehrt mit,
       * gerechnet auf dem vollen Save; zurueckgeschrieben wird sie nie (s. u.).
       */
      foundationFieldRace: projiziereFieldRace(gameState),
      /**
       * Dritte Schwester derselben Bauart: die Saisonstand-Spalte „Formkarten" zaehlt die
       * gespielten Karten ueber die Modifier-Slots der Aufstellungen — und die stehen unten
       * auf den aktiven Spieltag beschnitten. Gemessen: voll 32 von 32 Teams mit Bilanz,
       * kompakt 14 von 32, und diese 14 mit den Karten nur EINES von zehn Spieltagen.
       * Die Beschneidung bleibt (659 KB gegen 70 KB), die fertige Bilanz faehrt mit (1,9 KB).
       */
      foundationFormCardBonus: projiziereFormkartenBilanz(gameState),
      /**
       * Vierte Schwester, gleiche Bauart: das Spieltags-Ergebnis bildet „Rang vorher/nachher"
       * und die Summe der Saisonpunkte, indem es die Punkt-Eintraege ueber alle bisherigen
       * Spieltage summiert. Unten fallen dafuer die `disciplineResults` weg (gemessen 640
       * Zeilen voll gegen 64 kompakt), und ohne sie bucht der Ledger einen Spieltag bewusst
       * gar nicht erst — die Summe VOR dem Spieltag war damit fuer jedes Team 0 und alle 32
       * Zeilen zeigten erfundene Raenge (Z-H „Rang vorher 32" statt 1). Die fertigen
       * Tagespunkte je Spieltag fahren mit, 32 Zahlen pro Spieltag.
       */
      foundationMatchdayPoints: projiziereSpieltagsPunkte(gameState),
      /**
       * Geschwister derselben Bauart: das fertige Rekordbuch. Gemessen am Live-Save zeigte der
       * Browser in ALLEN sieben Eintraegen Halter und Wert eines EINZIGEN Spieltags (164,6 Sir
       * Quacksalot wurde zu 112,7 Lyraeth Vael usw.), waehrend die Ueberschrift „aus 10
       * gespielten Spieltagen" sie beglaubigte. Ursache sind wieder die beschnittenen
       * `disciplineResults` unten — ueber sie faellt auch der Punkte-Ledger auf einen Spieltag
       * zurueck.
       */
      foundationRecordBook: projiziereRekordbuch(gameState),
      /**
       * Und dieselbe Ursache ein Stockwerk weiter: die erweiterten Meilensteine messen ueber
       * mehrere Spieltage („Top 5 in allen vier Bereichen", „drei Spieltage in Folge Top 3")
       * und sahen im Browser nur einen — gemessen „0 von 4 Bereichen" statt 2 und „0 von 3"
       * statt 2. Die Bilanz faehrt fuer ALLE Teams mit, weil der Reiter gegen das jeweils
       * aktive Managerteam misst und das ohne neue Auslieferung wechseln kann.
       */
      foundationDisciplineTally: projiziereDisziplinBilanz(gameState),
      /**
       * Zwillingsschwester von `foundationFormCardBonus`: die trug den NENNWERT der Formkarten,
       * diese die WIRKUNG (`formModifier`) — die `(+x)` hinter jedem PP-Bereichswert im
       * Saisonstand, an der auch die Sortierung der Spalte „Form" haengt. Sie stand am selben
       * beschnittenen Payload, war aber nie mitrepariert worden. Gemessen: voll 32 von 32 Teams
       * mit Bilanz, kompakt 14 — Wicked Wizards 181,8 -> 69,6, Nunchuck Ninjas sogar 133,6 ->
       * 184,3. Siehe `foundation-pp-area-form-bonus-projection`.
       */
      foundationPpAreaFormBonus: projizierePpAreaFormBonus(gameState),
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
       * Die Projektionen darueber bleiben vorerst stehen und sind damit wirkungslos: ihre Leser
       * entscheiden den Vorrang je Spieltag an der Deckung, und die liegt jetzt immer beim
       * Spielstand selbst. Sie kosten zusammen 22 KB und sind der naechste Aufraeumschritt —
       * bewusst getrennt, damit dieser Schnitt hier fuer sich geprueft werden kann.
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
      // Append-only archives: the compact client re-stamps an empty sentinel `[]`,
      // which the old `incoming ?? existing` guard let clobber the durable DB
      // archive (wiping every prior-season snapshot). Only accept incoming when it
      // is at least as long as the persisted copy (see preserveAppendOnlyArchive).
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
      foundationFormCardBonus: undefined,
      foundationMatchdayPoints: undefined,
      foundationRecordBook: undefined,
      foundationDisciplineTally: undefined,
      foundationPpAreaFormBonus: undefined,
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
