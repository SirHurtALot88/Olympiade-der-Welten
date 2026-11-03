export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { applySeasonEndContractTick } from "@/lib/contracts/contract-renewal-service";
import {
  applyPreSeasonNextSeasonSetup,
  buildPreSeasonWorkflowPreview,
} from "@/lib/season/preseason-workflow-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";
import { starteKiSaisonstartKaufLaufImHintergrund } from "@/lib/ai/ai-preseason-background-service";
import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";

type PreSeasonWorkflowBody = {
  saveId?: string;
  dryRun?: boolean;
  stepId?: string | null;
  confirmToken?: string | null;
  source?: "sqlite" | "prisma";
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as PreSeasonWorkflowBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const dryRun = body.dryRun !== false;

    if (source === "prisma") {
      return NextResponse.json({ success: false, error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
    }
    if (!saveId) {
      return NextResponse.json({ success: false, error: "saveId is required.", summary: null }, { status: 400 });
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json({ success: false, error: "save_not_found", summary: null }, { status: 404 });
    }

    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      action: "season_transition",
      source,
      dryRun,
      confirmToken: body.confirmToken,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json(
        { success: false, error: writeAuth.reason, summary: null, warnings: writeAuth.warnings, blockingReasons: [writeAuth.reason] },
        { status: writeAuth.status },
      );
    }

    const summary = dryRun
      ? await buildPreSeasonWorkflowPreview(save, persistence)
      : body.stepId === "next_season_setup"
        ? await applyPreSeasonNextSeasonSetup(save, body.confirmToken, persistence)
        : body.stepId === "contract_renewal"
          ? applySeasonEndContractTick(save, body.confirmToken, persistence)
        : null;

    if (!summary) {
      return NextResponse.json(
        { success: false, error: "unsupported_preseason_apply_step", summary: null },
        { status: 409 },
      );
    }

    const success = "applied" in summary ? summary.applied : summary.ok;
    const kiKauflaufHinweise: string[] = [];
    if (!dryRun && success) {
      notifyRoomGameplayWrite(writeAuth, {
        saveId,
        teamId: null,
        action: "season_transition",
        eventType: "save_updated",
        affectedViews: ["home", "season", "team", "contracts"],
        dryRun: false,
        success: true,
      });
      /**
       * DAS KAUFFENSTER DER NEUEN SAISON STOESST JETZT DER SERVER AN.
       *
       * Saisontest 02.11. (Battle Mode, VW-Spielstand): der Saisonwechsel lief ueber genau diese
       * Route, danach war die Shell nicht offen — und Saison 2 begann mit 8-11 Spielern je
       * KI-Kader, null Kaeufen, null Krediten, ohne Lauf-Datensatz. Der einzige Ausloeser fuer den
       * KI-Kauflauf der Folgesaison sass im Browser. Detached: die ~2 Minuten wartet hier niemand
       * ab; oeffnet der Spieler die Shell, sieht sie den laufenden Datensatz und stoesst keinen
       * zweiten an (gemeinsame Sperre im Dienst).
       */
      if (body.stepId === "next_season_setup") {
        try {
          const kickoff = starteKiSaisonstartKaufLaufImHintergrund({
            saveId,
            scope: { room: writeAuth.room, participant: writeAuth.participant, activeOwnerId: await resolveAuthoritativeWriteOwnerId() },
            logPrefix: "[preseason-workflow]",
            persistence,
          });
          kiKauflaufHinweise.push(`ki_saisonstart_kauflauf:${kickoff.grund}`);
        } catch (error) {
          kiKauflaufHinweise.push(`ki_saisonstart_kauflauf_fehler:${error instanceof Error ? error.message : "unbekannt"}`);
        }
      }
    }
    return NextResponse.json(
      {
        success,
        summary,
        warnings: [...writeAuth.warnings, ...summary.warnings, ...kiKauflaufHinweise],
        blockingReasons: summary.blockingReasons,
      },
      { status: success || dryRun ? 200 : 409 },
    );
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Pre-Season workflow failed.",
        summary: null,
      },
      { status: 500 },
    );
  }
}
