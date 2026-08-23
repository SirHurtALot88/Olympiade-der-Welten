import { createHash } from "node:crypto";

import type { GameState, MatchdayResolveSnapshotRecord } from "@/lib/data/olyDataTypes";
import { buildLegacyMatchdayReadiness } from "@/lib/lineups/legacy-matchday-readiness";
import { loadAllLocalLegacyLineupContexts } from "@/lib/lineups/legacy-lineup-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { requireLocalPersistedSave } from "@/lib/persistence/resolve-local-save";
import type { PersistenceService } from "@/lib/persistence/types";
import {
  buildLegacyMatchdayResolvePreviewPayload,
  type LegacyMatchdayResolvePreviewPayload,
} from "@/lib/foundation/legacy-matchday-resolve-preview-service";
import type { LegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";

export type MatchdayResolveScope = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
};

export type MatchdayResolveSnapshot = {
  record: MatchdayResolveSnapshotRecord;
  payload: LegacyMatchdayResolvePreviewPayload;
};

function buildSnapshotId(scope: MatchdayResolveScope) {
  return `matchday-resolve-snapshot::${scope.saveId}::${scope.seasonId}::${scope.matchdayId}`;
}

type MatchdayDisciplineSide = "d1" | "d2";

const MATCHDAY_DISCIPLINE_SIDES: MatchdayDisciplineSide[] = ["d1", "d2"];

function collectMatchdayDrafts(gameState: GameState, scope: MatchdayResolveScope) {
  return (gameState.seasonState.lineupDrafts ?? []).filter(
    (draft) => draft.seasonId === scope.seasonId && draft.matchdayId === scope.matchdayId,
  );
}

function buildAvailabilityPart(gameState: GameState, fieldedPlayerIds: Set<string>) {
  return Object.entries(gameState.seasonState.playerAvailabilityState ?? {})
    .filter(([playerId]) => fieldedPlayerIds.has(playerId))
    .map(([playerId, state]) => `${playerId}:${JSON.stringify(state)}`)
    .sort();
}

/**
 * Bindet den Snapshot an genau die Eingaben, aus denen das Ergebnis entstanden ist.
 *
 * Drin ist alles, was die Wertung bewegt: die Aufstellungen des Spieltags (Slots,
 * Reihenfolge, Kapitaen, Formkarten) und der Verfuegbarkeitsstand der eingesetzten
 * Spieler (Fatigue und Verletzung gehen ueber den Injury-Multiplikator direkt in die
 * Scores). Aendert sich davon etwas, passt der Snapshot nicht mehr und wird verworfen.
 *
 * Bewusst NICHT drin: der komplette GameState. Der aendert sich bei jeder Kleinigkeit
 * (Kasse, Postfach, Marktbewegungen) und wuerde den Snapshot dauernd ungueltig machen,
 * ohne dass sich am Spieltagsergebnis irgendetwas aendert.
 */
export function buildMatchdayResolveSignature(gameState: GameState, scope: MatchdayResolveScope) {
  const drafts = collectMatchdayDrafts(gameState, scope)
    .map((draft) => ({
      teamId: draft.teamId,
      status: draft.status,
      entries: draft.entries
        .map((entry) => JSON.stringify(entry))
        .sort(),
      modifiers: draft.modifiers ? JSON.stringify(draft.modifiers) : null,
    }))
    .sort((left, right) => left.teamId.localeCompare(right.teamId));

  const fieldedPlayerIds = new Set<string>();
  for (const draft of collectMatchdayDrafts(gameState, scope)) {
    for (const entry of draft.entries) {
      const playerId = (entry as { playerId?: string }).playerId;
      if (playerId) fieldedPlayerIds.add(playerId);
    }
  }
  const availability = buildAvailabilityPart(gameState, fieldedPlayerIds);

  return createHash("sha256")
    .update(JSON.stringify({ scope, drafts, availability }))
    .digest("hex");
}

/**
 * Signatur EINER Disziplin-Seite: die Aufstellungen dieser Seite plus die Verfuegbarkeit
 * genau der Spieler, die auf dieser Seite laufen.
 *
 * Der Zweck ist die Naht zwischen D1 und D2. Der D1-Commit schreibt die Fatigue der in D1
 * gelaufenen Spieler; die volle Signatur des Spieltags aendert sich dadurch zwangslaeufig.
 * Fuer die noch offene Seite D2 ist das aber ohne Belang, solange sich an ihren
 * Aufstellungen und an ihren Spielern nichts geaendert hat — und genau das prueft diese
 * Signatur, statt die Pruefung fuer den ganzen Spieltag abzuschalten.
 */
export function buildMatchdaySideSignature(
  gameState: GameState,
  scope: MatchdayResolveScope,
  side: MatchdayDisciplineSide,
) {
  const drafts = collectMatchdayDrafts(gameState, scope)
    .map((draft) => ({
      teamId: draft.teamId,
      entries: draft.entries
        .filter((entry) => entry.disciplineSide === side)
        .map((entry) => JSON.stringify(entry))
        .sort(),
      modifiers: draft.modifiers ? JSON.stringify(draft.modifiers) : null,
    }))
    .filter((draft) => draft.entries.length > 0)
    .sort((left, right) => left.teamId.localeCompare(right.teamId));

  const fieldedPlayerIds = new Set<string>();
  for (const draft of collectMatchdayDrafts(gameState, scope)) {
    for (const entry of draft.entries) {
      if (entry.disciplineSide !== side) continue;
      const playerId = (entry as { playerId?: string }).playerId;
      if (playerId) fieldedPlayerIds.add(playerId);
    }
  }

  return createHash("sha256")
    .update(JSON.stringify({ scope, side, drafts, availability: buildAvailabilityPart(gameState, fieldedPlayerIds) }))
    .digest("hex");
}

export function buildMatchdaySideSignatures(
  gameState: GameState,
  scope: MatchdayResolveScope,
): Record<MatchdayDisciplineSide, string> {
  return {
    d1: buildMatchdaySideSignature(gameState, scope, "d1"),
    d2: buildMatchdaySideSignature(gameState, scope, "d2"),
  };
}

/**
 * Welche Disziplin-Seiten des Spieltags sind bereits GEBUCHT? Quelle sind die
 * `disciplineResults` am Spieltags-Ergebnis — der D1-Commit schreibt nur die d1-Zeilen,
 * der D2-Commit beide (`legacy-matchday-result-apply-service`, `commitThroughSide`).
 */
function getBookedMatchdaySides(gameState: GameState, scope: MatchdayResolveScope): Set<MatchdayDisciplineSide> {
  const resultIds = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter(
        (entry) =>
          entry.saveId === scope.saveId &&
          entry.seasonId === scope.seasonId &&
          entry.matchdayId === scope.matchdayId,
      )
      .map((entry) => entry.id),
  );
  const sides = new Set<MatchdayDisciplineSide>();
  if (resultIds.size === 0) return sides;
  for (const result of gameState.seasonState.disciplineResults ?? []) {
    if (resultIds.has(result.matchdayResultId)) sides.add(result.disciplineSide);
  }
  return sides;
}

/**
 * Liest den Snapshot des Spieltags — aber nur, wenn er noch zu dem passt, was gerechnet
 * werden soll. Sonst `null`, und der Aufrufer rechnet live bzw. zeigt das gebuchte
 * Ergebnis.
 *
 * DREI FAELLE, in dieser Reihenfolge:
 *
 * 1. Der Spieltag ist DURCH (beide Seiten gebucht). Dann gibt es ein gebuchtes Ergebnis,
 *    und das ist die Wahrheit — ein Snapshot OHNE Buchungsstempel darf nichts mehr
 *    ueberstimmen. GEMESSEN am Spielstand `new-game-1785823388048-1hf25q` (Saison 2,
 *    Spieltag 10): der dortige Snapshot hatte eine laengst nicht mehr passende Signatur
 *    und zeigte in 20 von 32 d1-Zeilen einen anderen Score als gebucht (max 0,70) —
 *    Zahlen, die nie gebucht wurden. Die Raenge stimmten dort zufaellig noch; bei einem
 *    Gleichstand kippt einer, und mit ihm die Punkte.
 *
 *    AUSNAHME, UND SIE IST DER GANZE PUNKT: traegt der Datensatz einen `bookedAt`-Stempel,
 *    ist er nicht "eine Vorschau von damals", sondern DIE Rechnung, aus der gebucht wurde —
 *    der Apply stempelt sie mit der Ergebnis-ID. Zum ANZEIGEN ist sie dann die einzig
 *    richtige Quelle. Ohne diese Ausnahme fiel die Arena nach dem Buchen auf den LIVE-Pfad
 *    zurueck und rechnete den Spieltag gegen den Zustand NACH der Buchung neu — mit der
 *    Nach-Spieltags-Fatigue, die derselbe Apply gerade geschrieben hat. Chris sah dadurch
 *    Sekunden nach dem Buchen andere Zahlen und getauschte Plaetze (Malagor 98,8 → 92,1,
 *    S-S 14,9 → 14,2, C-S 14,4 → 14,9).
 *
 *    Zum BUCHEN gilt die Ausnahme NICHT: `resolveMatchdayPreviewToBook` darf sich nie aus
 *    einer bereits gebuchten Rechnung bedienen, sonst schriebe ein Re-Apply die alte
 *    Rechnung ein zweites Mal fest. Deshalb der `zweck`-Parameter statt eines Schalters,
 *    den man vergessen kann.
 * 2. Der Spieltag LAEUFT (eine Seite gebucht, die andere offen). Fuer die offene Seite
 *    zaehlt ihre eigene Signatur: Aufstellungen dieser Seite und Verfuegbarkeit ihrer
 *    Spieler. Die Fatigue, die der D1-Commit gerade geschrieben hat, faellt damit nicht
 *    ins Gewicht — eine geaenderte Aufstellung aber sehr wohl. Alt-Snapshots ohne
 *    `sideSignatures` sind nicht pruefbar und werden verworfen.
 * 3. Der Spieltag hat noch nicht angefangen: die volle Signatur muss passen (wie bisher).
 */
/**
 * WOFUER der Snapshot gelesen wird. Die beiden Zwecke haben verschiedene Wahrheiten:
 *
 *   `buchen`   — der Apply sucht eine Rechnung, aus der er ein Ergebnis machen darf. Eine schon
 *                gebuchte kommt dafuer nie in Frage.
 *   `anzeigen` — die Buehne sucht die Rechnung, die dem Ergebnis zugrunde liegt. Nach der Buchung
 *                ist genau die gebuchte die richtige — und eine Neuberechnung die falsche.
 */
export type MatchdayResolveSnapshotZweck = "buchen" | "anzeigen";

export function readMatchdayResolveSnapshot(
  gameState: GameState,
  scope: MatchdayResolveScope,
  options?: { zweck?: MatchdayResolveSnapshotZweck },
): MatchdayResolveSnapshot | null {
  const record = (gameState.seasonState.matchdayResolveSnapshots ?? []).find(
    (entry) =>
      entry.saveId === scope.saveId &&
      entry.seasonId === scope.seasonId &&
      entry.matchdayId === scope.matchdayId,
  );
  if (!record) return null;
  const payload = record.payload as LegacyMatchdayResolvePreviewPayload | null;
  if (!payload?.preview) return null;

  const bookedSides = getBookedMatchdaySides(gameState, scope);
  if (MATCHDAY_DISCIPLINE_SIDES.every((side) => bookedSides.has(side))) {
    // Der Buchungsstempel schlaegt die Signatur: er sagt nicht "diese Rechnung passt noch zum
    // Zustand", sondern "aus dieser Rechnung ist das Ergebnis entstanden". Das kann eine spaetere
    // Zustandsaenderung nicht mehr entwerten — im Gegenteil, sie ist ja gerade der Grund, warum
    // eine Neuberechnung hier falsch waere.
    if ((options?.zweck ?? "buchen") === "anzeigen" && record.bookedAt) {
      return { record, payload };
    }
    return null;
  }

  if (bookedSides.size > 0) {
    const storedSideSignatures = record.sideSignatures;
    if (!storedSideSignatures) return null;
    const openSides = MATCHDAY_DISCIPLINE_SIDES.filter((side) => !bookedSides.has(side));
    const openSidesMatch = openSides.every(
      (side) => storedSideSignatures[side] === buildMatchdaySideSignature(gameState, scope, side),
    );
    if (!openSidesMatch) return null;
    return { record, payload };
  }

  if (record.signature !== buildMatchdayResolveSignature(gameState, scope)) {
    return null;
  }
  return { record, payload };
}

export type MatchdayPreviewToBook = {
  preview: LegacyMatchdayResolvePreview;
  /** `snapshot`: die Vorberechnung der Arena. `live`: frisch gerechnet, weil keine gueltige vorlag. */
  source: "snapshot" | "live";
};

/**
 * DIE EINE RECHENSTELLE DES SPIELTAGS.
 *
 * Wer diesen Spieltag bucht — die Arena ueber `matchday-auto-run-service` oder das Cockpit
 * ueber `/api/resolve/legacy-matchday-apply` — nimmt seine Zahlen von hier. Vorher hatte
 * jeder Weg seine eigene: die Arena buchte die Vorberechnung, das Cockpit rechnete beim
 * Buchen frisch. Beide Wege stehen dem Spieler offen, und sie lieferten verschiedene
 * Ergebnisse.
 *
 * GEMESSEN am Live-Abbild vom 12.08.2026: derselbe Ausgangszustand, einmal ueber die Arena
 * gebucht, einmal ueber das Cockpit, verglichen werden die GEBUCHTEN Zeilen. Zwischen
 * "Aufstellung gespeichert" und "gebucht" lag eine gewoehnliche Trainingswoche — die
 * Spielerwerte bewegen sich, die Aufstellungen nicht, die Vorberechnung bleibt gueltig:
 *   - `new-game-1784747079649-n90y4m`, Spieltag 1: 60 von 64 Disziplin-Zeilen verschieden,
 *     max 5,10 Score, 21 vertauschte Raenge, 125 von 160 Spielerzeilen (max 3,20).
 *   - `new-game-1785823388048-1hf25q`, Saison 2, Spieltag 9: 63 von 64 Zeilen, max 6,70,
 *     22 vertauschte Raenge, 172 von 224 Spielerzeilen (max 2,70).
 *   Danach beide Male: 0 Zeilen, 0 Raenge, 0 Spielerzeilen.
 *
 * Wie weit eine liegende Vorberechnung vom frisch Gerechneten wegdriften kann, zeigen die
 * drei Vorberechnungen, die im Abbild tatsaechlich liegen (je 64 Zeilen): 64/64 verschieden
 * bei max 29,1 Score (`…0kalpx`), 64/64 bei max 17,5 (`…1hf25q`), 63/64 bei max 52,5 und
 * 33 vertauschten Raengen (`…h0z7cl`). In zwei dieser drei Faelle war die Vorberechnung
 * Zeile fuer Zeile das, was auch GEBUCHT wurde — die Arena-Zahl also die gespielte.
 *
 * Die Gueltigkeitspruefung der Vorberechnung steckt in `readMatchdayResolveSnapshot`:
 * gebuchte Seiten stechen sie aus, geaenderte Aufstellungen verwerfen sie. Fehlt sie,
 * bleibt es beim frisch gerechneten Ergebnis — fuer beide Wege gleichermassen.
 */
export function resolveMatchdayPreviewToBook(input: {
  gameState: GameState;
  scope: MatchdayResolveScope;
  livePreview: LegacyMatchdayResolvePreview;
}): MatchdayPreviewToBook {
  const snapshot = readMatchdayResolveSnapshot(input.gameState, input.scope);
  if (!snapshot) return { preview: input.livePreview, source: "live" };
  return { preview: snapshot.payload.preview, source: "snapshot" };
}

/**
 * Steht das Feld? Erst wenn jedes Team fuer beide Disziplin-Seiten eine Aufstellung
 * hat, ergibt eine Vorberechnung Sinn — vorher wuerde sie ein Ergebnis zu einem
 * unvollstaendigen Teilnehmerfeld festschreiben.
 */
export function isMatchdayFieldComplete(gameState: GameState, scope: MatchdayResolveScope) {
  const drafts = (gameState.seasonState.lineupDrafts ?? []).filter(
    (draft) => draft.seasonId === scope.seasonId && draft.matchdayId === scope.matchdayId,
  );
  if (gameState.teams.length === 0) return false;
  const sidesByTeam = new Map<string, Set<string>>();
  for (const draft of drafts) {
    const sides = sidesByTeam.get(draft.teamId) ?? new Set<string>();
    for (const entry of draft.entries) {
      sides.add(entry.disciplineSide);
    }
    sidesByTeam.set(draft.teamId, sides);
  }
  return gameState.teams.every((team) => {
    const sides = sidesByTeam.get(team.teamId);
    return sides != null && sides.has("d1") && sides.has("d2");
  });
}

/**
 * Rechnet den Spieltag EINMAL und legt das Ergebnis im Save ab.
 *
 * Ab hier lesen Arena-Buehne und beide Disziplin-Buchungen aus demselben Ergebnis,
 * statt jeweils neu zu rechnen. Genau daran scheiterte die Gleichheit vorher: Der
 * erste Commit schreibt die Nach-Spieltags-Fatigue, und deren Rekonstruktion beim
 * naechsten Resolve traf den Ausgangsstand nicht exakt — dieselbe Disziplin kam
 * zweimal unterschiedlich heraus.
 *
 * Gibt `null` zurueck, wenn sich (noch) nichts rechnen laesst; der Aufrufer faellt
 * dann auf den bisherigen Live-Pfad zurueck.
 */
export function writeMatchdayResolveSnapshot(
  scope: MatchdayResolveScope,
  persistence: PersistenceService = createPersistenceService(),
): MatchdayResolveSnapshot | null {
  const { save } = requireLocalPersistedSave(persistence, scope.saveId);
  const contextResults = loadAllLocalLegacyLineupContexts(scope, persistence);
  const payload = buildLegacyMatchdayResolvePreviewPayload({
    source: "sqlite",
    params: scope,
    contextResults,
    gameState: save.gameState,
  });
  if (!payload) return null;

  const readinessByTeamId = Object.fromEntries(
    contextResults
      .flatMap((result) => (result.ok ? [result.context] : []))
      .map((context) => {
        const readiness = buildLegacyMatchdayReadiness(context);
        return [
          context.team.id,
          {
            readinessStatus: readiness.readinessStatus,
            reasonCodes: readiness.reasonCodes,
            shortReason: readiness.shortReason,
          },
        ] as const;
      }),
  );

  const record: MatchdayResolveSnapshotRecord = {
    id: buildSnapshotId(scope),
    saveId: scope.saveId,
    seasonId: scope.seasonId,
    matchdayId: scope.matchdayId,
    signature: buildMatchdayResolveSignature(save.gameState, scope),
    sideSignatures: buildMatchdaySideSignatures(save.gameState, scope),
    previewStatus: payload.preview.status,
    readinessByTeamId,
    payload,
    createdAt: new Date().toISOString(),
  };

  const nextGameState: GameState = {
    ...save.gameState,
    seasonState: {
      ...save.gameState.seasonState,
      // Immer nur der aktuelle Spieltag — aeltere Vorberechnungen sind wertlos und
      // wuerden den Save nur aufblaehen.
      matchdayResolveSnapshots: [record],
    },
  };
  persistence.saveSingleplayerState(save.saveId, nextGameState);

  return { record, payload };
}

/**
 * STEMPELT DIE GEBUCHTE RECHNUNG — aufgerufen vom Apply, nachdem das Ergebnis steht.
 *
 * Ab hier ist der Datensatz kein Vorschlag mehr, sondern der Beleg des Spieltags: die Buehne zeigt
 * danach genau die Zahlen, die gebucht wurden, statt den Spieltag gegen den veraenderten Zustand
 * neu zu rechnen (siehe `bookedAt` in olyDataTypes.ts).
 *
 * ZWEI FAELLE, beide muessen abgedeckt sein:
 *   - Es lag eine Vorberechnung vor und der Apply hat aus ihr gebucht (`previewSource: "snapshot"`).
 *     Dann wird sie nur gestempelt; ihr Inhalt ist bereits der richtige.
 *   - Der Apply hat LIVE gerechnet (keine oder eine verfallene Vorberechnung). Dann wird die
 *     GEBUCHTE Rechnung hier abgelegt — sonst haette die Buehne danach gar keine Quelle ausser der
 *     Neuberechnung, also genau das Problem.
 *
 * Rein: gibt den naechsten `GameState` zurueck und persistiert nichts. Der Apply hat seine eigene
 * Transaktionsfuehrung und schreibt ohnehin im selben Zug.
 */
export function markMatchdayResolveSnapshotAsBooked(input: {
  gameState: GameState;
  scope: MatchdayResolveScope;
  /** Die Rechnung, aus der das Ergebnis entstanden ist (`prepared.preview` des Apply). */
  preview: LegacyMatchdayResolvePreview;
  matchdayResultId: string;
  bookedAt: string;
}): GameState {
  const { gameState, scope, preview, matchdayResultId, bookedAt } = input;
  const vorhandene = gameState.seasonState.matchdayResolveSnapshots ?? [];
  const bestehend =
    vorhandene.find(
      (entry) =>
        entry.saveId === scope.saveId &&
        entry.seasonId === scope.seasonId &&
        entry.matchdayId === scope.matchdayId,
    ) ?? null;

  /**
   * Der Rest des Payloads (`summary`, `teamDetails`, `topPlayers`, `playerCatalog`) wird vom
   * bestehenden Datensatz uebernommen, wenn es einen gibt — er beschreibt dasselbe Feld und
   * dieselben Aufstellungen. Die Buehne liest ohnehin nur `preview` (siehe
   * `matchday-arena-base-service.ts`); ihn hier neu zu bauen hiesse, den ganzen Spieltag ein
   * zweites Mal aufzuloesen, und zwar fuer Felder, die niemand abruft.
   */
  const bestehendesPayload =
    bestehend?.payload != null && typeof bestehend.payload === "object" ? (bestehend.payload as object) : {};

  const record: MatchdayResolveSnapshotRecord = {
    id: bestehend?.id ?? buildSnapshotId(scope),
    saveId: scope.saveId,
    seasonId: scope.seasonId,
    matchdayId: scope.matchdayId,
    // Die Signaturen bleiben stehen, verlieren aber ihre Rolle: geprueft wird ab jetzt der
    // Stempel. Sie zu loeschen wuerde nur die Spur verwischen, aus welchem Feldstand die
    // Rechnung kam.
    signature: bestehend?.signature ?? "",
    ...(bestehend?.sideSignatures ? { sideSignatures: bestehend.sideSignatures } : {}),
    previewStatus: preview.status,
    readinessByTeamId: bestehend?.readinessByTeamId ?? {},
    // Der Inhalt ist IMMER die GEBUCHTE Rechnung — auch wenn schon ein Datensatz lag. Buchte der
    // Apply live, weil die Vorberechnung verfallen war, stuende sonst weiter die verfallene drin
    // und die Buehne zeigte Zahlen, die nie gebucht wurden.
    payload: { ...bestehendesPayload, preview },
    bookedAt,
    bookedMatchdayResultId: matchdayResultId,
    createdAt: bestehend?.createdAt ?? bookedAt,
  };

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      matchdayResolveSnapshots: [record],
    },
  };
}

/**
 * Sorgt dafuer, dass der Spieltag vorberechnet ist — rechnet aber nur, wenn das Feld
 * vollstaendig ist und noch kein gueltiger Snapshot vorliegt. Mehrfachaufrufe sind
 * damit billig; das ist der Einstiegspunkt fuer den Weg zur Arena.
 */
export function ensureMatchdayResolveSnapshot(
  scope: MatchdayResolveScope,
  persistence: PersistenceService = createPersistenceService(),
): MatchdayResolveSnapshot | null {
  const { save } = requireLocalPersistedSave(persistence, scope.saveId);
  const existing = readMatchdayResolveSnapshot(save.gameState, scope);
  if (existing) return existing;
  // Ist der Spieltag durch, gibt es nichts mehr vorzuberechnen: das gebuchte Ergebnis
  // steht. Ohne diese Klammer wuerde jedes Speichern einer Aufstellung an einem
  // gewerteten Spieltag eine komplette 32-Team-Aufloesung ausloesen — und ein frisches
  // "Ergebnis" hinterlegen, das mit dem gebuchten nichts zu tun hat.
  if (getBookedMatchdaySides(save.gameState, scope).size > 0) return null;
  if (!isMatchdayFieldComplete(save.gameState, scope)) return null;
  return writeMatchdayResolveSnapshot(scope, persistence);
}
