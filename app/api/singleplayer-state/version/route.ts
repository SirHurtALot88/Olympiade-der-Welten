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
  const save = persistence.getSaveById(saveId);

  if (!save) {
    return NextResponse.json({ ok: false, error: `Save ${saveId} not found.` }, { status: 404 });
  }

  const seasonState = save.gameState.seasonState;
  const matchdayResultsSignature = latestRecordSignature(seasonState.matchdayResults);
  const standingsApplySignature = latestRecordSignature(seasonState.standingsApplyLogs);
  const seasonSnapshotsSignature = latestRecordSignature(seasonState.seasonSnapshots);
  const disciplineResultsSignature = latestRecordSignature(seasonState.disciplineResults);
  const signature = [
    save.saveId,
    save.updatedAt,
    save.gameState.season.id,
    save.gameState.matchdayState.matchdayId,
    matchdayResultsSignature,
    standingsApplySignature,
    seasonSnapshotsSignature,
    disciplineResultsSignature,
  ].join("|");

  return NextResponse.json({
    ok: true,
    saveId: save.saveId,
    updatedAt: save.updatedAt,
    seasonId: save.gameState.season.id,
    matchdayId: save.gameState.matchdayState.matchdayId,
    signature,
    matchdayResultsSignature,
    standingsApplySignature,
    seasonSnapshotsSignature,
    disciplineResultsSignature,
  });
}
