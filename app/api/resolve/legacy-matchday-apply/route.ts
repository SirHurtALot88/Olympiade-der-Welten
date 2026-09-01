export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  LegacyMatchdayResultApplyService,
} from "@/lib/resolve/legacy-matchday-result-apply-service";
import { kickoffArenaMatchdayApply } from "@/lib/season/arena-matchday-resolve-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type ApplyBody = {
  saveId?: string;
  seasonId?: string;
  matchdayId?: string;
  source?: "sqlite" | "prisma";
  dryRun?: boolean;
  execute?: boolean;
  confirm?: string;
  forceReplace?: boolean;
  allowIncompleteOverride?: boolean;
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ApplyBody;
  const saveId = body.saveId?.trim() ?? "";
  const seasonId = body.seasonId?.trim() ?? "";
  const matchdayId = body.matchdayId?.trim() ?? "";
  const source = body.source === "prisma" ? "prisma" : "sqlite";
  const execute = body.execute === true;
  const dryRun = execute ? false : body.dryRun ?? true;

  if (!saveId || !seasonId || !matchdayId) {
    return NextResponse.json(
      { error: "saveId, seasonId and matchdayId are required." },
      { status: 400 },
    );
  }

  const writeAuth = authorizeServerRoomWrite({
    roomCode: body.roomCode,
    participantId: body.participantId,
    seatToken: body.seatToken,
    userId: body.userId,
    saveId,
    action: "matchday_resolve",
    source,
    dryRun,
    confirmToken: body.confirm,
  });
  if (!writeAuth.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: writeAuth.reason,
        warnings: writeAuth.warnings,
      },
      { status: writeAuth.status },
    );
  }

  // Battle Mode PR7 (docs/design/battle-mode-spielmodus-plan.md, Abschnitt 3.4): ein echter
  // "Spieltag simulieren"-Klick, der Basketball-Arena-Duelle braucht, dauert 6-16+ Sekunden
  // (Playwright-Chromium) — zu lang fuer diesen Request. `kickoffArenaMatchdayApply()` prueft
  // SELBST, ob dieser Spieltag ueberhaupt betroffen ist (Battle Mode UND Basketball an diesem
  // Spieltag); ist er es nicht (Manager Mode, jede andere Disziplin, ein reiner Dry-Run-Preview),
  // liefert es `{ applicable: false }` und der bisherige synchrone Pfad laeuft unveraendert weiter.
  if (execute && source === "sqlite") {
    const kickoff = kickoffArenaMatchdayApply({
      persistence: createPersistenceService(),
      saveId,
      seasonId,
      matchdayId,
      forceReplace: body.forceReplace ?? false,
      allowIncompleteOverride: body.allowIncompleteOverride ?? false,
      logPrefix: "[legacy-matchday-apply]",
    });
    if (kickoff.applicable) {
      notifyRoomGameplayWrite(writeAuth, {
        saveId,
        action: "matchday_apply",
        eventType: "matchday_applied",
        affectedViews: ["home", "season", "matchday", "arena", "standings"],
        dryRun: false,
        success: false,
      });
      return NextResponse.json({
        success: true,
        source,
        dryRun: false,
        applied: false,
        arenaMatchdayResolveStatus: "in_progress",
        previewStatus: null,
        summary: null,
        warnings: writeAuth.warnings,
      });
    }
  }

  const service = new LegacyMatchdayResultApplyService();
  const result = await service.applyLegacyMatchdayResult({
    saveId,
    seasonId,
    matchdayId,
    source,
    dryRun,
    execute,
    confirm: body.confirm,
    forceReplace: body.forceReplace ?? false,
    allowIncompleteOverride: body.allowIncompleteOverride ?? false,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        source: result.source,
        previewStatus: result.previewStatus ?? null,
        canApply: result.canApply ?? false,
        blockingReasons: result.blockingReasons ?? [],
      },
      { status: source === "prisma" ? 409 : 422 },
    );
  }
  notifyRoomGameplayWrite(writeAuth, {
    saveId,
    action: "matchday_apply",
    eventType: "matchday_applied",
    affectedViews: ["home", "season", "matchday", "arena", "standings"],
    dryRun,
    success: result.applied === true,
  });

  return NextResponse.json({
    success: true,
    source,
    dryRun: result.dryRun,
    applied: result.applied,
    previewStatus: result.previewStatus,
    summary: result,
    warnings: [...writeAuth.warnings, ...result.blockingReasons],
  });
}
