function getRecordId(record: unknown) {
  if (!record || typeof record !== "object") {
    return "";
  }

  const candidate = record as Record<string, unknown>;
  return String(candidate.id ?? candidate.auditLogId ?? candidate.resultId ?? candidate.snapshotId ?? "");
}

function getRecordTimestamp(record: unknown) {
  if (!record || typeof record !== "object") {
    return "";
  }

  const candidate = record as Record<string, unknown>;
  return String(candidate.appliedAt ?? candidate.createdAt ?? candidate.archivedAt ?? "");
}

export function latestRecordSignature(records: unknown[] | undefined) {
  if (!Array.isArray(records) || records.length === 0) {
    return "0:";
  }

  // Ergebnis-/Log-/Snapshot-Arrays sind append-only → das letzte Element ist der
  // jüngste Datensatz. O(1) statt eines O(n)-reduce über das ganze Array (das
  // mit gespielten Saisons wächst und bei nicht-memoisierten Aufrufen messbar
  // wurde). Länge + letzte ID + letzter Zeitstempel ändern sich bei jedem
  // Append, taugen also weiterhin als Cache-Signatur.
  const latest = records[records.length - 1];

  return `${records.length}:${getRecordId(latest)}:${getRecordTimestamp(latest)}`;
}

export function buildSaveContentSignature(input: {
  seasonId: string;
  matchdayId: string;
  saveVersion: number;
  lineupDraftCount: number;
  transferHistoryCount: number;
  matchdayResults: unknown[];
  standingsApplyLogs: unknown[];
  seasonSnapshots: unknown[];
  disciplineResults: unknown[];
}) {
  return [
    input.seasonId,
    input.matchdayId,
    String(input.saveVersion),
    String(input.lineupDraftCount),
    String(input.transferHistoryCount),
    latestRecordSignature(input.matchdayResults),
    latestRecordSignature(input.standingsApplyLogs),
    latestRecordSignature(input.seasonSnapshots),
    latestRecordSignature(input.disciplineResults),
  ].join("|");
}
