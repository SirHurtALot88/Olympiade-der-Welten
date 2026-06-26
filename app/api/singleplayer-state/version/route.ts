export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { createPersistenceService } from "@/lib/persistence/persistence-service";

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

function latestRecordSignature(records: unknown[] | undefined) {
  if (!Array.isArray(records) || records.length === 0) {
    return "0:";
  }

  const latest = records.reduce<unknown | null>((currentLatest, record) => {
    if (!currentLatest) {
      return record;
    }

    return getRecordTimestamp(record) > getRecordTimestamp(currentLatest) ? record : currentLatest;
  }, null);

  return `${records.length}:${getRecordId(latest)}:${getRecordTimestamp(latest)}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim() || "active";
  const persistence = createPersistenceService();
  const save = persistence.getSaveVersionMetadata(saveId);

  if (!save) {
    return NextResponse.json({ ok: false, error: `Save ${saveId} not found.` }, { status: 404 });
  }

  const matchdayResultsSignature = latestRecordSignature(save.matchdayResults);
  const standingsApplySignature = latestRecordSignature(save.standingsApplyLogs);
  const seasonSnapshotsSignature = latestRecordSignature(save.seasonSnapshots);
  const disciplineResultsSignature = latestRecordSignature(save.disciplineResults);
  const signature = [
    save.saveId,
    save.updatedAt,
    save.seasonId,
    save.matchdayId,
    matchdayResultsSignature,
    standingsApplySignature,
    seasonSnapshotsSignature,
    disciplineResultsSignature,
  ].join("|");

  const contentSignature = [
    save.seasonId,
    save.matchdayId,
    String(save.saveVersion),
    String(save.lineupDraftCount),
    String(save.transferHistoryCount),
    matchdayResultsSignature,
    standingsApplySignature,
    seasonSnapshotsSignature,
    disciplineResultsSignature,
  ].join("|");

  return NextResponse.json({
    ok: true,
    saveId: save.saveId,
    updatedAt: save.updatedAt,
    seasonId: save.seasonId,
    matchdayId: save.matchdayId,
    signature,
    contentSignature,
    matchdayResultsSignature,
    standingsApplySignature,
    seasonSnapshotsSignature,
    disciplineResultsSignature,
  });
}
