import type { GameState, InjuryEventRecord, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";

/**
 * SPIELSTAND-SÄUBERUNG BEIM SCHREIBEN — Felder, die nichts tragen, kommen gar nicht erst mit.
 *
 * GEMELDET VON CHRIS: „kannst du mal schauen ob wir den spielstand kleiner bekommen wenn du meinst
 * da ist so viel luft? dass man da mal aufräumt ohne natürlich wichtige daten zu eliminieren"
 *
 * Der Nachsatz ist die ganze Regel. Hier wird NICHTS gelöscht, was irgendwo gelesen wird oder
 * irgendeine Auskunft trägt. Entfernt werden ausschließlich:
 *   - Felder, die auf der jeweiligen Zeile fest `null` sind und dort auch niemand liest,
 *   - Felder, deren Wert der dokumentierte Standard ist (beim Lesen unverändert wieder da),
 *   - ein Array, das byte-identisch ein zweites Mal danebenstand.
 *
 * WARUM BEIM SCHREIBEN UND NICHT BEIM LESEN: Chris hatte gerade Ladezeit-Ärger. Ein Durchlauf
 * beim Speichern kostet einmal ein paar Millisekunden und wirkt danach dauerhaft; ein Durchlauf
 * beim Laden kostet bei JEDEM Laden. Nebenbei schrumpfen dadurch auch die bestehenden Spielstände
 * — beim nächsten Speichern, ohne Migration und ohne Eingriff am Server.
 */

/**
 * Der Standardwert von `InjuryEventRecord.source`. Fehlt das Feld, war es dieser Wert — die
 * Proben-Würfe (`fatigue_injury_rehearsal_v1`) behalten ihre Angabe.
 */
export const INJURY_EVENT_DEFAULT_SOURCE = "fatigue_injury_risk_v1" as const;

/**
 * DIE eine Stelle, an der ein gespeicherter Verletzungs-Wurf wieder vollständig gemacht wird.
 * Wer `source` liest, liest ihn hierüber — sonst gäbe es zwei Antworten auf die Frage, woher ein
 * Wurf stammt.
 */
export function resolveInjuryEventSource(event: Pick<InjuryEventRecord, "source">) {
  return event.source ?? INJURY_EVENT_DEFAULT_SOURCE;
}

/**
 * Ein Verletzungs-Wurf ohne Verletzung ist eine BELASTUNGS-MESSUNG, kein Verletzungs-Datensatz.
 *
 * Am Live-Spielstand nachgemessen (2026-08, n=5032): 4988 Würfe gingen `healthy` aus, 44 endeten
 * in einer Verletzung. Auf den 4988 gesunden Zeilen standen `unavailableUntil`, `injuryRecovery`
 * und `fatigueAfterRecovery` ausnahmslos auf `null`, `unavailableForMatchdays` ausnahmslos auf
 * `1` — und gelesen werden diese vier Felder nur über `injuryEventToPlayerHistoryRecord`, das
 * jede Zeile mit `result !== "injured"` sofort verwirft. `normalRecovery` teilt dasselbe
 * Schicksal. Zusammen 593 KB, die nie jemand angesehen hat.
 *
 * WAS BLEIBT, UND WARUM: `fatigueBefore` ist die Belastung vor dem Spieltag — sie ist der einzige
 * Grund, warum die gesunden Zeilen überhaupt aufbewahrt werden müssen
 * (`computePlayerSeasonAverageMatchdayFatigue` mittelt genau darüber, ohne nach `result` zu
 * filtern). `riskPercent` und `roll` bleiben ebenfalls: sie sind das Kalibrierungs-Material für
 * `export-fatigue-injury-audit`, also Risiko gegen tatsächlichen Wurf. `timestamp` bleibt, weil
 * die Audit-Ausgabe eine Zeitachse braucht.
 *
 * Verletzte Zeilen werden NICHT angefasst — bis auf `fatigueAfterRecovery`, das im gesamten
 * Repository keinen einzigen Leser hat und auch dort nur `null` ist.
 */
export function slimInjuryEvent(event: InjuryEventRecord): InjuryEventRecord {
  const gesund = event.result !== "injured";
  const wegfallend: Array<keyof InjuryEventRecord> = [];
  // Kein Leser im ganzen Repository, und ueberall null — auf jeder Zeile weg.
  if ("fatigueAfterRecovery" in event && event.fatigueAfterRecovery == null) {
    wegfallend.push("fatigueAfterRecovery");
  }
  // Der Standard steht in der Konstante, nicht 5000-mal im Spielstand.
  if (event.source === INJURY_EVENT_DEFAULT_SOURCE) {
    wegfallend.push("source");
  }
  if (gesund) {
    // Der Wurf ging gut aus — die Verletzungs-Nachwehen gibt es schlicht nicht.
    if ("unavailableUntil" in event && event.unavailableUntil == null) wegfallend.push("unavailableUntil");
    if ("injuryRecovery" in event && event.injuryRecovery == null) wegfallend.push("injuryRecovery");
    if ("normalRecovery" in event) wegfallend.push("normalRecovery");
    if (event.unavailableForMatchdays === 1) wegfallend.push("unavailableForMatchdays");
  }
  // Nichts zu tun heisst: dasselbe Objekt zurueck. So bleibt ein zweiter Durchlauf gratis.
  if (wegfallend.length === 0) {
    return event;
  }
  const rest = { ...event };
  for (const feld of wegfallend) {
    delete rest[feld];
  }
  return rest;
}

/**
 * `playerPerformanceSnapshots` war der byte-identische Zwilling von `playerPerformances`.
 *
 * Am Live-Spielstand nachgemessen: im Saison-1-Schnappschuss standen beide Arrays mit je 333
 * Einträgen und je 647 KB nebeneinander, `JSON.stringify` beider Seiten Zeichen für Zeichen
 * gleich. Geschrieben wurden sie in `season-snapshot-service` sogar aus DERSELBEN Variablen.
 *
 * `playerPerformances` ist im Typ das Pflichtfeld, `playerPerformanceSnapshots` das optionale
 * Altfeld. Alle fünf Lesestellen führen bereits beide zusammen und bevorzugen dabei das
 * Pflichtfeld — der Zwilling kann deshalb ersatzlos weg, ohne dass irgendein Leser etwas
 * bemerkt. Ältere Schnappschüsse, in denen NUR das Altfeld gefüllt ist, behalten es: dort trägt
 * es die einzige Kopie und die Zusammenführung braucht sie.
 */
export function slimSeasonSnapshot(snapshot: SeasonSnapshotRecord): SeasonSnapshotRecord {
  const legacy = snapshot.playerPerformanceSnapshots;
  if (legacy == null) {
    return snapshot;
  }
  const canonical = snapshot.playerPerformances ?? [];
  // Nur wegwerfen, wenn das Pflichtfeld die Angaben nachweislich schon trägt. Ein leeres
  // Pflichtfeld neben einem gefüllten Altfeld waere Datenverlust, kein Aufraeumen.
  const istUeberfluessig =
    legacy.length === 0 ||
    (canonical.length > 0 && JSON.stringify(canonical) === JSON.stringify(legacy));
  if (!istUeberfluessig) {
    return snapshot;
  }
  const rest = { ...snapshot };
  delete rest.playerPerformanceSnapshots;
  return rest;
}

/**
 * Der Sammelgriff, den das Save-Repository unmittelbar vor dem Schreiben anfasst.
 *
 * Idempotent: ein zweiter Durchlauf über einen bereits gesäuberten Zustand ändert nichts. Und er
 * gibt den EINGANGSZUSTAND unveraendert zurueck, wenn es nichts zu tun gibt — so entsteht kein
 * neues Objekt, das die Signatur-Bildung unnoetig beschaeftigt.
 */
export function slimGameStateForWrite(gameState: GameState): GameState {
  const seasonState = gameState.seasonState;
  const injuryEvents = seasonState.injuryEvents;
  const seasonSnapshots = seasonState.seasonSnapshots;

  const nextInjuryEvents = injuryEvents?.map(slimInjuryEvent);
  const nextSeasonSnapshots = seasonSnapshots?.map(slimSeasonSnapshot);

  const injuryChanged =
    nextInjuryEvents != null && nextInjuryEvents.some((event, index) => event !== injuryEvents?.[index]);
  const snapshotsChanged =
    nextSeasonSnapshots != null &&
    nextSeasonSnapshots.some((snapshot, index) => snapshot !== seasonSnapshots?.[index]);

  if (!injuryChanged && !snapshotsChanged) {
    return gameState;
  }

  return {
    ...gameState,
    seasonState: {
      ...seasonState,
      ...(injuryChanged ? { injuryEvents: nextInjuryEvents } : {}),
      ...(snapshotsChanged ? { seasonSnapshots: nextSeasonSnapshots } : {}),
    },
  };
}
