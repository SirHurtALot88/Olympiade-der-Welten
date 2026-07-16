export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { createPersistenceService } from "@/lib/persistence/persistence-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim() || "active";
  const persistence = createPersistenceService();
  const save = persistence.getSaveVersionMetadata(saveId);

  if (!save) {
    return NextResponse.json({ ok: false, error: `Save ${saveId} not found.` }, { status: 404 });
  }

  const contentSignature =
    save.contentSignature ??
    [
      save.seasonId,
      save.matchdayId,
      String(save.saveVersion ?? 0),
      String(save.lineupDraftCount),
      String(save.transferHistoryCount),
    ].join("|");

  const signature = [save.saveId, save.updatedAt, contentSignature].join("|");

  return NextResponse.json({
    ok: true,
    saveId: save.saveId,
    updatedAt: save.updatedAt,
    seasonId: save.seasonId,
    matchdayId: save.matchdayId,
    saveVersion: save.saveVersion ?? 0,
    signature,
    contentSignature,
  });
}
