/**
 * SAISONENDE-RÜCKBLICK — was in der Liga passiert ist, und was sich dadurch für die neue Saison
 * ändert.
 *
 * GEWÜNSCHT VON CHRIS: „es wäre cool am Ende der Season nen Ticker zu haben wo man dann sieht welche
 * Teams ihren GM ersetzt haben -> oder per INBOX message. Genauso könnte man in die Inbox die Top
 * Transfers zusammenfassen. Dazu welches Team hat am meisten MW dazu gewonnen in der Transferphase.
 * Welches sind die Top 3 im Ranks-Reiter die die meisten Plätze dazu gewonnen oder verloren haben."
 *
 * WARUM INBOX UND NICHT TICKER — der Grund ist nicht Geschmack, sondern Timing: die GM-Wechsel
 * EXISTIEREN am Saisonfinale-Bildschirm noch gar nicht. `buildTeamGeneralManagerAssignments` feuert
 * erst, wenn `season.id` wechselt. Ein Saisonende-Ticker könnte die Meldung, die ausdrücklich
 * gewünscht war, also nicht zeigen. Die Inbox der NEUEN Saison kann es. Dazu will ein Rückblick
 * nachgelesen werden — genau die Frage des dritten Inbox-Raums („Berichte & Momente — Was ist
 * passiert?"). Ein Ticker ist weg, sobald man wegklickt.
 *
 * HARTES LIMIT: 6 Karten, feste Reihenfolge. Fehlt eine Datenquelle (Saison 1 ohne Vorsaison, keine
 * GM-Wechsel, kein Transferfenster), FÄLLT DIE KARTE WEG statt mit Platzhaltern zu erscheinen. Eine
 * Karte, die „—" sagt, ist schlechter als keine.
 *
 * NUR DIE JÜNGSTE abgeschlossene Saison erzeugt Karten. Sonst wiederholte jede alte Saison ihren
 * Rückblick bei jedem Inbox-Aufbau.
 *
 * Rein abgeleitet, wie der Rest der Inbox: keine neue Persistenz, keine Migration. Der Status je
 * Karte hängt an der stabilen `itemId` und wird vom bestehenden Mechanismus gespeichert.
 */

import type { GameState, SeasonSnapshotRecord, SeasonSnapshotTeamRecord, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { getTeamGeneralManagerProfile } from "@/lib/foundation/team-general-managers";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import { leseSaisonSchnappschuesse } from "@/lib/persistence/foundation-season-history-projection";
import { resolveSeasonSnapshotTeamRecords } from "@/lib/season/season-snapshot-helpers";

export type SeasonRecapSlot =
  | "zeugnis"
  | "gm_karussell"
  | "top_deals"
  | "mw_gewinner"
  | "kletterer"
  | "kraefteverschiebung";

export type SeasonRecapEntry = {
  slot: SeasonRecapSlot;
  /** `null` = Liga-Meldung, für alle sichtbar. Gesetzt = persönliche Karte eines Teams. */
  teamId: string | null;
  title: string;
  description: string;
  targetView: FoundationViewId;
  targetParams: Record<string, string | number | boolean | null>;
};

export type SeasonRecap = {
  seasonId: string;
  seasonName: string;
  archivedAt: string;
  entries: SeasonRecapEntry[];
};

function money(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 10) / 10}`.replace(".", ",");
}

function signed(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${`${rounded}`.replace(".", ",")}`;
}

function nameOf(record: SeasonSnapshotTeamRecord): string {
  return record.teamName ?? record.teamCode ?? record.teamId;
}

/**
 * Die Transfers des Fensters ZWISCHEN zwei Saisons.
 *
 * NICHT über `seasonId` abgegrenzt, und das ist der Kern: das Fenster ist in den Übergangsphasen der
 * ALTEN Saison offen (`preseason_management`, `transfer_sell_phase`, `transfer_buy_phase`) UND früh
 * in der neuen (`season_active`, Spieltag ≤ 1, siehe `transfer-window-policy.ts`). Ein Kauf trägt
 * immer die `season.id`, die zum Zeitpunkt der Buchung galt — Deals desselben Fensters liegen
 * deshalb auf ZWEI Saison-IDs verteilt. Über `archivedAt` des Snapshots abzugrenzen erwischt beide,
 * denn der Snapshot entsteht am Saisonende, bevor das Fenster aufgeht.
 */
export function selectTransferWindowEntries(
  gameState: GameState,
  snapshot: SeasonSnapshotRecord,
): TransferHistoryEntry[] {
  const von = Date.parse(snapshot.archivedAt ?? "");
  if (!Number.isFinite(von)) return [];
  return (gameState.transferHistory ?? []).filter((entry) => {
    const zeit = Date.parse(entry.happenedAt ?? "");
    return Number.isFinite(zeit) && zeit >= von;
  });
}

function buildZeugnis(input: {
  snapshot: SeasonSnapshotRecord;
  records: SeasonSnapshotTeamRecord[];
  teamIds: Set<string>;
}): SeasonRecapEntry[] {
  const entries: SeasonRecapEntry[] = [];
  for (const record of input.records) {
    if (!input.teamIds.has(record.teamId)) continue;
    const rang = record.rank;
    const start = record.startplatz;
    const diff = record.rankDiff;
    const bewegung =
      diff == null || diff === 0
        ? "Platz gehalten"
        : diff > 0
          ? `${diff} Plätze gutgemacht`
          : `${Math.abs(diff)} Plätze verloren`;
    entries.push({
      slot: "zeugnis",
      teamId: record.teamId,
      title: `Dein Saison-Zeugnis: Platz ${rang ?? "—"}`,
      description: [
        start != null ? `Start als Nummer ${start}, Ende auf Platz ${rang ?? "—"} — ${bewegung}.` : `Endplatz ${rang ?? "—"}.`,
        `Kasse ${money(record.cashEnd)} · Transferbilanz ${signed(record.transferNet)}.`,
      ].join(" "),
      targetView: "seasonV2",
      targetParams: { season: input.snapshot.seasonId, team: record.teamId },
    });
  }
  return entries;
}

function buildGmKarussell(input: { gameState: GameState; snapshot: SeasonSnapshotRecord }): SeasonRecapEntry | null {
  const assignments = Object.values(input.gameState.seasonState.teamGeneralManagers ?? {}).filter(
    (entry) => entry.source === "board_replacement" && entry.assignedSeasonId === input.gameState.season.id,
  );
  if (assignments.length === 0) return null;

  const teamNameById = new Map(input.gameState.teams.map((team) => [team.teamId, team.name] as const));
  const grund = (reason: string | null | undefined) =>
    reason === "low_board_confidence" ? "Vertrauen im Keller" : reason === "high_board_pressure" ? "Druck zu hoch" : "Neuausrichtung";
  const zeilen = assignments.map((entry) => {
    const neu = getTeamGeneralManagerProfile(entry.gmId);
    const alt = getTeamGeneralManagerProfile(entry.previousGmId);
    const team = teamNameById.get(entry.teamId) ?? entry.teamId;
    return `${neu?.name ?? "Neuer GM"} übernimmt bei ${team}${alt ? ` für ${alt.name}` : ""} (${grund(entry.dismissalReason)})`;
  });

  return {
    slot: "gm_karussell",
    teamId: null,
    title:
      assignments.length === 1
        ? "Ein Board hat die Reißleine gezogen"
        : `${assignments.length} Boards haben die Reißleine gezogen`,
    // Ein neuer GM-Archetyp heisst real anderes Marktverhalten — das ist eine spielrelevante
    // Information, keine Deko. Deshalb steht der Name im Text und nicht nur die Anzahl.
    description: `${zeilen.join(" · ")}. Ein neuer GM heißt eine neue Marktdoktrin.`,
    targetView: "teams",
    targetParams: { season: input.snapshot.seasonId },
  };
}

function buildTopDeals(input: {
  fenster: TransferHistoryEntry[];
  snapshot: SeasonSnapshotRecord;
  teamNameById: Map<string, string>;
}): SeasonRecapEntry | null {
  const kaeufe = input.fenster
    .filter((entry) => entry.transferType === "buy" && (entry.fee ?? 0) > 0)
    .sort((left, right) => (right.fee ?? 0) - (left.fee ?? 0))
    .slice(0, 3);
  if (kaeufe.length === 0) return null;

  const zeilen = kaeufe.map((entry) => {
    const team = entry.toTeamId ? input.teamNameById.get(entry.toTeamId) ?? entry.toTeamId : "—";
    return `${entry.playerName ?? entry.playerId} → ${team} (${money(entry.fee)})`;
  });
  return {
    slot: "top_deals",
    teamId: null,
    title: "Die Deals des Fensters",
    description: zeilen.join(" · "),
    targetView: "historyV2",
    targetParams: { season: input.snapshot.seasonId },
  };
}

/**
 * Wer hat im Fenster am meisten Marktwert eingekauft?
 *
 * Gerechnet als SALDO der bewegten Marktwerte (Zugänge − Abgänge), nicht als Differenz zweier
 * Gesamtstände: einen „Team-Marktwert vor dem Fenster" gibt es nicht mehr, weil
 * `patchCompletedSeasonSnapshotAfterPreseasonBuy` den Saison-Endwert überschreibt. Der Saldo ist
 * ohnehin die richtigere Zahl — er misst, was durch TRANSFERS dazukam, nicht was durch Training
 * gewachsen ist.
 */
function buildMwGewinner(input: {
  fenster: TransferHistoryEntry[];
  snapshot: SeasonSnapshotRecord;
  teamNameById: Map<string, string>;
  eigeneTeamIds: Set<string>;
}): SeasonRecapEntry | null {
  const saldoByTeam = new Map<string, number>();
  for (const entry of input.fenster) {
    const mw = typeof entry.marketValue === "number" && Number.isFinite(entry.marketValue) ? entry.marketValue : 0;
    if (mw === 0) continue;
    if (entry.transferType === "buy" && entry.toTeamId) {
      saldoByTeam.set(entry.toTeamId, (saldoByTeam.get(entry.toTeamId) ?? 0) + mw);
    }
    if (entry.transferType === "sell" && entry.fromTeamId) {
      saldoByTeam.set(entry.fromTeamId, (saldoByTeam.get(entry.fromTeamId) ?? 0) - mw);
    }
  }
  if (saldoByTeam.size === 0) return null;

  const rangliste = [...saldoByTeam.entries()].sort((left, right) => right[1] - left[1]);
  const [bestTeamId, bestSaldo] = rangliste[0]!;
  const eigener = rangliste.findIndex(([teamId]) => input.eigeneTeamIds.has(teamId));
  const eigenerZusatz =
    eigener >= 0
      ? ` Dein Team: ${signed(rangliste[eigener]![1])} (Platz ${eigener + 1} von ${rangliste.length}).`
      : "";

  return {
    slot: "mw_gewinner",
    teamId: null,
    title: "Marktwert-Gewinner des Fensters",
    description: `${input.teamNameById.get(bestTeamId) ?? bestTeamId} rüstet auf: ${signed(bestSaldo)} Marktwert eingekauft.${eigenerZusatz}`,
    targetView: "marketV2",
    targetParams: { season: input.snapshot.seasonId },
  };
}

function buildKletterer(input: {
  records: SeasonSnapshotTeamRecord[];
  snapshot: SeasonSnapshotRecord;
}): SeasonRecapEntry | null {
  const mitDiff = input.records.filter(
    (record) => typeof record.rankDiff === "number" && Number.isFinite(record.rankDiff) && record.rankDiff !== 0,
  );
  if (mitDiff.length === 0) return null;
  const sortiert = [...mitDiff].sort((left, right) => (right.rankDiff ?? 0) - (left.rankDiff ?? 0));
  const auf = sortiert[0]!;
  const ab = sortiert[sortiert.length - 1]!;
  if ((auf.rankDiff ?? 0) <= 0 && (ab.rankDiff ?? 0) >= 0) return null;

  const teile: string[] = [];
  if ((auf.rankDiff ?? 0) > 0) teile.push(`${nameOf(auf)} klettert ${auf.rankDiff} Plätze auf Rang ${auf.rank ?? "—"}`);
  if ((ab.rankDiff ?? 0) < 0) teile.push(`${nameOf(ab)} verliert ${Math.abs(ab.rankDiff ?? 0)} Plätze auf Rang ${ab.rank ?? "—"}`);

  return {
    slot: "kletterer",
    teamId: null,
    title: "Kletterer & Absturz",
    description: `${teile.join(" — ")}.`,
    targetView: "allTimeTable",
    targetParams: { season: input.snapshot.seasonId },
  };
}

/**
 * Verschiebung im STÄRKE-Rang (Ranks-Reiter), nicht in der Tabelle — das war ausdrücklich der
 * Wunsch („welches sind die Top 3 im Ranks-Reiter"). Braucht die Vorsaison zum Vergleich und fällt
 * deshalb ab Saison 2 an; vorher gibt es die Karte stumm nicht.
 */
function buildKraefteverschiebung(input: {
  snapshot: SeasonSnapshotRecord;
  vorsaison: SeasonSnapshotRecord | null;
}): SeasonRecapEntry | null {
  const jetzt = input.snapshot.teamDisciplineRankSnapshots ?? [];
  const vorher = input.vorsaison?.teamDisciplineRankSnapshots ?? [];
  if (jetzt.length === 0 || vorher.length === 0) return null;

  const vorherByTeam = new Map(vorher.map((entry) => [entry.teamId, entry.totalRank] as const));
  const bewegungen = jetzt
    .map((entry) => {
      const alt = vorherByTeam.get(entry.teamId);
      // Kleinere Rangzahl = stärker. Delta positiv = Plätze gutgemacht.
      return alt == null ? null : { teamName: entry.teamName, delta: alt - entry.totalRank, rank: entry.totalRank };
    })
    .filter((entry): entry is { teamName: string; delta: number; rank: number } => entry != null && entry.delta !== 0)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 3);
  if (bewegungen.length === 0) return null;

  return {
    slot: "kraefteverschiebung",
    teamId: null,
    title: "Kräfteverschiebung",
    description: bewegungen
      .map((entry) => `${entry.teamName} ${entry.delta > 0 ? "+" : ""}${entry.delta} auf Stärke-Rang ${entry.rank}`)
      .join(" · "),
    targetView: "ranks",
    targetParams: { season: input.snapshot.seasonId },
  };
}

/**
 * Baut den Rückblick auf die jüngste abgeschlossene Saison. `null`, solange es keine gibt.
 *
 * `eigeneTeamIds` steuert nur die persönliche Zeugnis-Karte und den „Dein Team"-Zusatz beim
 * Marktwert; alle anderen Karten sind Liga-Meldungen (`teamId: null`) und damit für jeden sichtbar.
 */
export function buildSeasonRecap(input: {
  gameState: GameState;
  eigeneTeamIds?: Set<string> | null;
}): SeasonRecap | null {
  /**
   * ÜBER `leseSaisonSchnappschuesse`, NICHT ÜBER `seasonSnapshots ?? []`.
   *
   * Hier stand die direkte Lesestelle, und im Browser lief sie garantiert leer: die Anfangsladung
   * streicht `seasonSnapshots`, und der Sentinel stempelt eine LEERE LISTE an dieselbe Stelle —
   * `?? []` greift bei `[]` nicht, also war die Liste immer leer und diese Funktion gab immer
   * `null` zurück. Am Live-Abbild gemessen (Save `new-game-1785823388048-1hf25q`, Saison 2):
   * volle Inbox 261 Karten, davon 36 `story:season_recap` und eine `champion_news`; im Browser
   * 224 Karten und keine einzige davon.
   *
   * Nachgeladen wird das volle Archiv nur in ausgewählten Ansichten (`use-season-archive-load`) —
   * der Rückblick sitzt in der Inbox, also auf Home/Cockpit, und die gehören nicht dazu. Die
   * mitgefahrene Kurzfassung `foundationSeasonHistory` trägt genau das, was der Rückblick liest:
   * Ränge, Punkte, Wirtschaftsfelder je Team und die Spielerzeilen.
   */
  const abgeschlossen = leseSaisonSchnappschuesse(input.gameState).filter(
    (snapshot) => snapshot.status === "completed",
  );
  const snapshot = abgeschlossen[abgeschlossen.length - 1] ?? null;
  if (!snapshot || !snapshot.archivedAt) return null;
  // Nur RÜCKBLICKEN: solange die abgeschlossene Saison noch die laufende ist, ist nichts vorbei.
  if (snapshot.seasonId === input.gameState.season.id) return null;

  const records = resolveSeasonSnapshotTeamRecords(snapshot);
  if (records.length === 0) return null;

  const vorsaison = abgeschlossen[abgeschlossen.length - 2] ?? null;
  const teamNameById = new Map(input.gameState.teams.map((team) => [team.teamId, team.name] as const));
  const eigeneTeamIds =
    input.eigeneTeamIds ??
    new Set(input.gameState.teams.filter((team) => team.humanControlled).map((team) => team.teamId));
  const fenster = selectTransferWindowEntries(input.gameState, snapshot);

  const entries = [
    ...buildZeugnis({ snapshot, records, teamIds: eigeneTeamIds }),
    buildGmKarussell({ gameState: input.gameState, snapshot }),
    buildTopDeals({ fenster, snapshot, teamNameById }),
    buildMwGewinner({ fenster, snapshot, teamNameById, eigeneTeamIds }),
    buildKletterer({ records, snapshot }),
    buildKraefteverschiebung({ snapshot, vorsaison }),
  ].filter((entry): entry is SeasonRecapEntry => entry != null);

  return {
    seasonId: snapshot.seasonId,
    seasonName: snapshot.seasonName,
    archivedAt: snapshot.archivedAt,
    entries,
  };
}
