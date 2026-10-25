import type {
  DisciplineResultRecord,
  GameState,
  LegacyResultReadinessStatus,
  LineupDraft,
  LineupDraftEntry,
  StaffelWechselPaarRecord,
} from "@/lib/data/olyDataTypes";

/**
 * STAFFEL O7 "EINGESPIELTE PAARE" — Vertrauen als Spielstand-Zustand.
 *
 * Spezifikation: docs/design/fable-ideen-bahn-30-09.md Abschnitt 4.1, eingeordnet als O7 in
 * docs/design/staffel-nachtkonzept-03-10.md (Klasse S, setzt O1 "Marke pur" voraus, das seit
 * PR #1154 live ist). Chris' Freigabe 11.10.: "Ja, bauen".
 *
 *   Jedes Geber/Nehmer-Paar, das in einem Spiel zusammen gewechselt hat, bekommt im Spielstand
 *   einen Zaehler. Ab drei gemeinsamen Spielen gilt das Paar als "eingespielt" (drei Stufen, bis
 *   zu +0,10 auf `Q` der Wechselformel, zusaetzlich etwas engere Streuung). Ein Kaderwechsel oder
 *   eine neue Reihenfolge setzt den Zaehler des betroffenen Paares zurueck.
 *
 * DIESE DATEI IST REIN: jede Funktion liest `gameState` nur und gibt neue Werte zurueck (Muster
 * lib/foundation/season-form-card-bonus.ts). Geschrieben wird der Zaehler an genau einer Stelle,
 * im Result-Apply (`LegacyMatchdayResultApplyService.applyLegacyMatchdayResult`), durch den JEDER
 * Spieltagspfad laeuft (Arena-Hintergrundlauf, Auto-Run, Apply-Route, MVP-Scoring); gelesen wird
 * er im Aufstellungs-Rohr zur Arena (`buildArenaAufstellung`) und in der Einsatzliste (Anzeige).
 *
 * WAS "PAAR" HEISST — und warum das erst mit O7 stimmt. Ein Paar ist gerichtet: Geber = Bein i,
 * Nehmer = Bein i+1, beide in AUFSTELLUNGSREIHENFOLGE (`slotIndex` aufsteigend). Vor O7 lief der
 * Motor die Beine NICHT in dieser Reihenfolge, sondern in der Kaderreihenfolge (`buildArenaTeam`
 * sortiert nach TDM-Eignung, `inDisc()` filtert nur) — nachgemessen, s. PR-Beschreibung und
 * `bauSpurt()` in battle-mode.engine.js. O7 stellt den Motor deshalb fuer die Staffel auf die
 * Slot-Reihenfolge um; erst damit sind die hier gezaehlten Nachbarn auch die, die im Rennen
 * tatsaechlich den Stab tauschen. Der Motor prueft zusaetzlich bei jedem Wechsel, ob der
 * tatsaechliche Geber der hier erwartete ist (`wechselPaarGeber`), und wendet den Bonus sonst
 * nicht an — ein Spieler ohne Attributbogen, der in der Arena fehlt, verschiebt also keine
 * Boni auf falsche Paare.
 *
 * SPIELER-IDENTITAET: die Spieler-Id (`player.id`), aufgeloest wie im Aufstellungs-Rohr
 * (`activePlayerId` ist die Id der KADERZEILE, nicht des Spielers — die Falle steht ausfuehrlich
 * in arena-aufstellung-adapter.ts). Am Live-Abbild (11.10., alle 10 052 Aufstellungseintraege
 * aller sieben Spielstaende) nachgeprueft: `rosters[activePlayerId].playerId === playerId` in
 * jedem einzelnen Eintrag, `activePlayerId` nie selbst eine Spieler-Id.
 */

export const STAFFEL_DISCIPLINE_ID = "staffel";

/**
 * Bonus auf `Q` der Wechselformel je Zahl gemeinsamer Spiele VOR dem anstehenden Spiel
 * (Index = min(Spiele, 3)). Drei Stufen, Obergrenze +0,10 (Fable 4.1, "innerhalb des K4-Rahmens").
 * Die Werte sind der Vorschlag aus dem Auftrag; gemessen (Messprotokoll in der PR-Beschreibung und
 * docs/design/stand-aller-disziplinen.md) kosten sie weder rho noch Pp sichtbar — die Abbruchregel
 * ("kostet der Bonus rho, kleiner machen, nicht weglassen") musste nicht greifen.
 *
 * Wer die Zahlen aendert, aendert sie auch in der Messsonde `staffelPaarSonde` (battle-mode.engine.js,
 * Standard-`stufen`) und misst neu — die Sonde ist der einzige Weg, den Bonus kaderfest zu messen.
 */
export const STAFFEL_PAAR_BONUS_STUFEN: readonly [number, number, number, number] = [0, 0.03, 0.06, 0.1];

/** Ab so vielen gemeinsamen Spielen gilt ein Paar als "eingespielt" (oberste Stufe + engere Streuung). */
export const STAFFEL_PAAR_EINGESPIELT_AB = 3;

/** Gezaehlt wird nur, wer wirklich angetreten ist: kein Nicht-Antritt, keine ungueltige Aufstellung. */
const STAFFEL_GELAUFEN_STATUS: ReadonlySet<LegacyResultReadinessStatus> = new Set(["ready", "underfilled_roster"]);

function sauberAnzahl(wert: unknown): number {
  const zahl = typeof wert === "number" && Number.isFinite(wert) ? Math.floor(wert) : 0;
  return Math.max(0, zahl);
}

/**
 * Ein persistierter Eintrag kann aus einem aelteren Stand, einer Handreparatur oder einem
 * kuenftigen Format kommen. Was nicht wie ein Paar aussieht, wird beim Lesen ignoriert — nie als
 * Fehler behandelt — und beim naechsten Schreiben fuer dieses Team weggeraeumt.
 */
function istGueltigerEintrag(eintrag: unknown): eintrag is StaffelWechselPaarRecord {
  if (!eintrag || typeof eintrag !== "object") return false;
  const e = eintrag as Partial<StaffelWechselPaarRecord>;
  return (
    typeof e.teamId === "string" &&
    typeof e.geberPlayerId === "string" &&
    typeof e.nehmerPlayerId === "string" &&
    e.geberPlayerId !== e.nehmerPlayerId
  );
}

/** Alle gueltigen Paar-Eintraege des Spielstands. Fehlt das Feld (jeder Stand vor O7): `[]`. */
export function readStaffelWechselPaare(gameState: Pick<GameState, "seasonState">): StaffelWechselPaarRecord[] {
  const roh = gameState.seasonState?.staffelWechselPaare;
  return Array.isArray(roh) ? roh.filter(istGueltigerEintrag) : [];
}

export function buildStaffelPairKey(teamId: string, geberPlayerId: string, nehmerPlayerId: string): string {
  return `${teamId}::${geberPlayerId}>${nehmerPlayerId}`;
}

function buildRecordId(teamId: string, geberPlayerId: string, nehmerPlayerId: string): string {
  return `staffel-paar__${teamId}__${geberPlayerId}__${nehmerPlayerId}`;
}

/** Bonus auf `Q` fuer ein Paar mit `gamesTogether` gemeinsamen Spielen VOR dem anstehenden. */
export function getStaffelPairBondBonus(gamesTogether: number): number {
  const stufe = Math.min(sauberAnzahl(gamesTogether), STAFFEL_PAAR_BONUS_STUFEN.length - 1);
  return STAFFEL_PAAR_BONUS_STUFEN[stufe] ?? 0;
}

export function isStaffelPairEingespielt(gamesTogether: number): boolean {
  return sauberAnzahl(gamesTogether) >= STAFFEL_PAAR_EINGESPIELT_AB;
}

/**
 * Spieler-Id eines Aufstellungseintrags — dieselbe Aufloesung wie `buildArenaAufstellung`
 * (arena-aufstellung-adapter.ts, dort die Herleitung der Falle `activePlayerId` = Kaderzeile).
 */
function resolveEntryPlayerId(entry: LineupDraftEntry, spielerVonKaderzeile: ReadonlyMap<string, string>): string {
  return entry.activePlayerId ? spielerVonKaderzeile.get(entry.activePlayerId) ?? entry.playerId : entry.playerId;
}

/** Die Aufstellung eines Teams fuer genau diesen Spieltag (oder `null`). */
export function findStaffelLineupDraft(
  gameState: Pick<GameState, "seasonState">,
  scope: { teamId: string; seasonId?: string | null; matchdayId: string },
): LineupDraft | null {
  const entwuerfe = gameState.seasonState?.lineupDrafts ?? [];
  return (
    entwuerfe.find(
      (draft) =>
        draft.teamId === scope.teamId &&
        draft.matchdayId === scope.matchdayId &&
        (!scope.seasonId || !draft.seasonId || draft.seasonId === scope.seasonId),
    ) ?? null
  );
}

/**
 * Die Staffel-Laeufer eines Entwurfs in BEIN-REIHENFOLGE (`slotIndex` aufsteigend), als
 * Spieler-Ids. Nicht aufloesbare Eintraege (Spieler nicht im Spielstand) und Doppel fallen raus —
 * genau wie im Aufstellungs-Rohr, das sie dem Motor ebenfalls nicht reicht.
 */
export function resolveStaffelLegPlayerIds(
  gameState: Pick<GameState, "players" | "rosters">,
  draft: Pick<LineupDraft, "entries"> | null | undefined,
): string[] {
  if (!draft) return [];
  const staffel = draft.entries
    .map((entry, reihenfolge) => ({ entry, reihenfolge }))
    .filter(({ entry }) => entry.disciplineId === STAFFEL_DISCIPLINE_ID)
    .sort((a, b) => a.entry.slotIndex - b.entry.slotIndex || a.reihenfolge - b.reihenfolge);
  if (staffel.length === 0) return [];
  const spielerIds = new Set(gameState.players.map((player) => player.id));
  const spielerVonKaderzeile = new Map(gameState.rosters.map((zeile) => [zeile.id, zeile.playerId] as const));
  const beine: string[] = [];
  for (const { entry } of staffel) {
    const spielerId = resolveEntryPlayerId(entry, spielerVonKaderzeile);
    if (!spielerIds.has(spielerId) || beine.includes(spielerId)) continue;
    beine.push(spielerId);
  }
  return beine;
}

export type StaffelLegPair = { geberPlayerId: string; nehmerPlayerId: string };

/** Benachbarte Beine: (0→1), (1→2), … — genau die Uebergaben, die der Motor laeuft. */
export function buildStaffelLegPairs(legPlayerIds: readonly string[]): StaffelLegPair[] {
  const paare: StaffelLegPair[] = [];
  for (let i = 0; i + 1 < legPlayerIds.length; i += 1) {
    paare.push({ geberPlayerId: legPlayerIds[i]!, nehmerPlayerId: legPlayerIds[i + 1]! });
  }
  return paare;
}

/**
 * Gemeinsame Spiele eines Paares VOR dem Spiel `scope`. Ist dieses Spiel selbst schon gezaehlt
 * (der Eintrag traegt genau diesen Spieltag), zaehlt es nicht mit — damit liefert ein erneutes
 * Durchrechnen desselben Spieltags (Arena-Wiederholung, Replay nach dem Buchen) denselben Bonus
 * wie der erste Lauf, statt sich am eigenen Ergebnis hochzuziehen.
 */
export function getStaffelPairGamesBefore(
  record: Pick<StaffelWechselPaarRecord, "gamesTogether" | "seasonId" | "lastMatchdayId">,
  scope: { seasonId?: string | null; matchdayId?: string | null },
): number {
  const spiele = sauberAnzahl(record.gamesTogether);
  const diesesSpielGezaehlt =
    scope.matchdayId != null &&
    record.lastMatchdayId === scope.matchdayId &&
    (!scope.seasonId || record.seasonId === scope.seasonId);
  return diesesSpielGezaehlt ? Math.max(0, spiele - 1) : spiele;
}

export type StaffelWechselPaarBonus = StaffelLegPair & {
  gamesBefore: number;
  bonus: number;
  eingespielt: boolean;
};

/**
 * Bonus je NEHMER fuer genau diesen Entwurf (der Motor rechnet `Q` ueber den Nehmer, s.
 * WECHSEL-Block in battle-mode.engine.js). Nur Paare mit Bonus > 0 stehen in der Map; ohne
 * gespeicherte Paar-Geschichte ist sie leer und das Aufstellungs-Rohr unveraendert.
 */
export function buildStaffelWechselPaarBonusByNehmer(
  gameState: Pick<GameState, "players" | "rosters" | "seasonState">,
  draft: Pick<LineupDraft, "entries" | "teamId" | "seasonId" | "matchdayId"> | null | undefined,
): Map<string, StaffelWechselPaarBonus> {
  const ergebnis = new Map<string, StaffelWechselPaarBonus>();
  if (!draft) return ergebnis;
  const eintraege = readStaffelWechselPaare(gameState).filter((record) => record.teamId === draft.teamId);
  if (eintraege.length === 0) return ergebnis;
  const nachSchluessel = new Map(
    eintraege.map((record) => [buildStaffelPairKey(record.teamId, record.geberPlayerId, record.nehmerPlayerId), record] as const),
  );
  for (const paar of buildStaffelLegPairs(resolveStaffelLegPlayerIds(gameState, draft))) {
    const record = nachSchluessel.get(buildStaffelPairKey(draft.teamId, paar.geberPlayerId, paar.nehmerPlayerId));
    if (!record) continue;
    const gamesBefore = getStaffelPairGamesBefore(record, { seasonId: draft.seasonId, matchdayId: draft.matchdayId });
    const bonus = getStaffelPairBondBonus(gamesBefore);
    if (!(bonus > 0)) continue;
    ergebnis.set(paar.nehmerPlayerId, { ...paar, gamesBefore, bonus, eingespielt: isStaffelPairEingespielt(gamesBefore) });
  }
  return ergebnis;
}

/**
 * Anzeige-Nachschlag fuer die Einsatzliste: `"geberId>nehmerId"` -> gemeinsame Spiele VOR dem
 * Spiel `scope`, nur Paare mit mindestens einem Spiel. Unabhaengig von der aktuellen Auswahl,
 * damit die Anzeige beim Umstellen sofort mitgeht.
 */
export function buildStaffelPairGamesLookup(
  gameState: Pick<GameState, "seasonState">,
  scope: { teamId: string; seasonId?: string | null; matchdayId?: string | null },
): Record<string, number> {
  const lookup: Record<string, number> = {};
  for (const record of readStaffelWechselPaare(gameState)) {
    if (record.teamId !== scope.teamId) continue;
    const spiele = getStaffelPairGamesBefore(record, scope);
    if (spiele > 0) lookup[`${record.geberPlayerId}>${record.nehmerPlayerId}`] = spiele;
  }
  return lookup;
}

/**
 * Teams, deren Staffel in diesem Spieltag WIRKLICH gelaufen ist: eine gebuchte Staffel-Zeile mit
 * einem Antritts-Status. Nicht-Antritt (`missing_lineup`), ungueltige Aufstellung und fehlende
 * Wertungsdeckung zaehlen nicht — dort hat kein Paar gewechselt, also wird auch nichts
 * zurueckgesetzt.
 */
export function listStaffelTeamsThatRan(
  disciplineResults: readonly Pick<DisciplineResultRecord, "teamId" | "disciplineId" | "readinessStatus" | "matchdayResultId">[],
  scope: { matchdayResultId: string },
): string[] {
  const teams = new Set<string>();
  for (const result of disciplineResults) {
    if (result.matchdayResultId !== scope.matchdayResultId) continue;
    if (result.disciplineId !== STAFFEL_DISCIPLINE_ID) continue;
    if (!STAFFEL_GELAUFEN_STATUS.has(result.readinessStatus)) continue;
    teams.add(result.teamId);
  }
  return [...teams];
}

/**
 * Fortschreiben nach einem gebuchten Spieltag. Fuer jedes Team in `teamIds` (Staffel gelaufen):
 *  - jedes Nachbarpaar dieser Aufstellung: gab es den Eintrag schon, +1, sonst neu mit 1;
 *  - jeder andere Eintrag dieses Teams faellt weg (Paar hat diesmal nicht gewechselt: neue
 *    Reihenfolge, Kaderwechsel, Bank) — beim naechsten gemeinsamen Spiel beginnt er wieder bei 1.
 * Teams ohne gelaufene Staffel bleiben unberuehrt.
 *
 * IDEMPOTENT je Spieltag: ein Eintrag, der genau diesen Spieltag schon traegt, bleibt Zeichen fuer
 * Zeichen stehen. Das braucht die gestaffelte Buchung (D1-Commit, dann D2-Commit mit denselben
 * Staffel-Zeilen) und jedes erneute Buchen mit `forceReplace`.
 *
 * Gibt den UNVERAENDERTEN `gameState` zurueck, wenn kein Team betroffen ist — ein Spielstand, in
 * dem nie eine Staffel lief, bekommt das Feld also gar nicht erst.
 */
export function updateStaffelWechselPaareAfterMatchday(
  gameState: GameState,
  scope: { saveId: string; seasonId: string; matchdayId: string; teamIds: readonly string[]; now?: string },
): GameState {
  const teamIds = [...new Set(scope.teamIds)];
  if (teamIds.length === 0) return gameState;
  const now = scope.now ?? new Date().toISOString();
  const bestand = readStaffelWechselPaare(gameState);
  const bearbeiteteTeams = new Set<string>();
  const neueEintraege: StaffelWechselPaarRecord[] = [];

  for (const teamId of teamIds) {
    const draft = findStaffelLineupDraft(gameState, { teamId, seasonId: scope.seasonId, matchdayId: scope.matchdayId });
    const beine = resolveStaffelLegPlayerIds(gameState, draft);
    // Kein aufloesbarer Laeufer: fuer dieses Team ist nichts Verwertbares passiert.
    if (beine.length === 0) continue;
    bearbeiteteTeams.add(teamId);
    const alt = new Map(
      bestand
        .filter((record) => record.teamId === teamId)
        .map((record) => [buildStaffelPairKey(teamId, record.geberPlayerId, record.nehmerPlayerId), record] as const),
    );
    for (const paar of buildStaffelLegPairs(beine)) {
      const vorher = alt.get(buildStaffelPairKey(teamId, paar.geberPlayerId, paar.nehmerPlayerId));
      const schonGezaehlt =
        vorher && vorher.seasonId === scope.seasonId && vorher.lastMatchdayId === scope.matchdayId && sauberAnzahl(vorher.gamesTogether) >= 1;
      if (vorher && schonGezaehlt) {
        neueEintraege.push(vorher);
        continue;
      }
      neueEintraege.push({
        id: buildRecordId(teamId, paar.geberPlayerId, paar.nehmerPlayerId),
        saveId: scope.saveId,
        seasonId: scope.seasonId,
        teamId,
        geberPlayerId: paar.geberPlayerId,
        nehmerPlayerId: paar.nehmerPlayerId,
        gamesTogether: sauberAnzahl(vorher?.gamesTogether) + 1,
        lastMatchdayId: scope.matchdayId,
        updatedAt: now,
      });
    }
  }

  if (bearbeiteteTeams.size === 0) return gameState;
  // Feste Reihenfolge (Team, Geber, Nehmer) statt Einfuegereihenfolge: ein idempotentes zweites
  // Buchen ergibt damit dieselbe Liste, nicht nur denselben Inhalt.
  const sortSchluessel = (record: StaffelWechselPaarRecord) =>
    buildStaffelPairKey(record.teamId, record.geberPlayerId, record.nehmerPlayerId);
  const naechste = [...bestand.filter((record) => !bearbeiteteTeams.has(record.teamId)), ...neueEintraege].sort((a, b) => {
    const ka = sortSchluessel(a);
    const kb = sortSchluessel(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      staffelWechselPaare: naechste,
    },
  };
}
