export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  applyContractRenewalAction,
  previewContractRenewalAction,
  type ContractRenewalAction,
} from "@/lib/contracts/contract-renewal-service";
import type { ContractShape } from "@/lib/data/olyDataTypes";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { darfVertragsentscheidungTrotzPhase } from "@/lib/contracts/vertragsentscheidung";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { zieheVertragsalterungNach } from "@/lib/contracts/vertragsalterung-nachziehen";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";

type ContractRenewalBody = {
  saveId?: string;
  teamId?: string;
  playerId?: string;
  action?: ContractRenewalAction;
  contractLength?: number | null;
  offeredSalary?: number | null;
  contractShape?: ContractShape;
  /** Werbeklausel (23.11.): -1 Spieler behaelt mehr, 0 Standard, 1 Team bekommt mehr. */
  marketingKlausel?: number | null;
  dryRun?: boolean;
  confirmToken?: string | null;
  source?: "sqlite" | "prisma";
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  activeManagerTeamId?: string | null;
  activeOwnerId?: string | null;
  controlMode?: "human" | "ai" | "passive" | "manual" | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ContractRenewalBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const playerId = body.playerId?.trim() ?? "";
    const action = body.action === "release" ? "release" : body.action === "renew" ? "renew" : null;
    const dryRun = body.dryRun !== false;
    const marketingKlausel = body.marketingKlausel === -1 || body.marketingKlausel === 0 || body.marketingKlausel === 1 ? body.marketingKlausel : null;

    if (source === "prisma") {
      return NextResponse.json({ success: false, error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
    }
    if (!saveId || !teamId || !playerId || !action) {
      return NextResponse.json(
        { success: false, error: "saveId, teamId, playerId and action are required.", summary: null },
        { status: 400 },
      );
    }

    const persistence = createPersistenceService();
    const gefundenerSave = persistence.getSaveById(saveId);
    if (!gefundenerSave) {
      return NextResponse.json({ success: false, error: "save_not_found", summary: null }, { status: 404 });
    }
    // Vertraege altern beim Betreten der Saisonende-Phase. Spielstaende, die schon davor in der
    // Phase standen, haben den Hop nie gesehen — siehe `zieheVertragsalterungNach`. Nichtstun,
    // sobald die Alterung fuer diese Saison gelaufen ist.
    const nachgezogen = zieheVertragsalterungNach({ save: gefundenerSave, persistence });
    const save = nachgezogen.save;
    const phaseGateRoh = evaluateGamePhaseAction(save.gameState, "renew_contract");
    // NACHHOLEN (Chris 19.11., lib/contracts/vertragsentscheidung.ts): ein Vertrag, der schon in einer FRUEHEREN Saison
    // auslief und ueber den nie entschieden wurde (Altstand vor der Saisonwechsel-Sperre), darf jederzeit verlaengert oder
    // freigegeben werden — sonst saesse der Spieler bis zum naechsten Saisonende ohne Vertrag im Kader.
    const eintrag = save.gameState.rosters.find((entry) => entry.teamId === teamId && entry.playerId === playerId) ?? null;
    const phaseGate =
      !phaseGateRoh.allowed && eintrag && darfVertragsentscheidungTrotzPhase(eintrag, save.gameState)
        ? { ...phaseGateRoh, allowed: true, reason: null, warnings: [...phaseGateRoh.warnings, "vertragsentscheidung_nachgeholt"] }
        : phaseGateRoh;
    // Phase gate blocks only PRODUCTIVE writes. Dry-run previews pass through,
    // so the negotiation window can show real numbers mid-season (preview-only,
    // same graceful pattern as the sell dialog); the phase reason is appended
    // to the preview's blockingReasons below so the UI can explain the gate.
    if (!phaseGate.allowed && !dryRun) {
      return NextResponse.json(
        {
          success: false,
          error: phaseGate.reason,
          summary: null,
          warnings: phaseGate.warnings,
          blockingReasons: phaseGate.reason ? [phaseGate.reason] : [],
        },
        { status: 409 },
      );
    }

    const preview = previewContractRenewalAction({
      save,
      teamId,
      playerId,
      action,
      contractLength: body.contractLength,
      offeredSalary: body.offeredSalary,
      contractShape: body.contractShape,
      marketingKlausel,
    });
    // Stufe 0.3 (Befund B2): Identitaet AUSSERHALB eines Raums kommt serverseitig aus der Sitzung,
    // nie aus `body.activeOwnerId` — siehe Kommentar an `resolveAuthoritativeWriteOwnerId`.
    const activeOwnerId = await resolveAuthoritativeWriteOwnerId();
    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId,
      action: "contract_renewal",
      source,
      dryRun,
      confirmToken: body.confirmToken,
      expectedConfirmToken: preview.confirmToken,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: writeAuth.reason,
          summary: null,
          warnings: writeAuth.warnings,
          blockingReasons: [writeAuth.reason],
        },
        { status: writeAuth.status },
      );
    }

    const summary = dryRun
      ? preview
      : applyContractRenewalAction({
          save,
          teamId,
          playerId,
          action,
          confirmToken: body.confirmToken,
          persistence,
          contractLength: body.contractLength,
          offeredSalary: body.offeredSalary,
          contractShape: body.contractShape,
          marketingKlausel,
          source: action === "renew" ? "manual_contract_renewal" : "manual_player_release",
        });
    const success = "applied" in summary ? Boolean(summary.applied) : Boolean(summary.ok);
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId,
      action: `contract_${action}`,
      eventType: "save_updated",
      affectedViews: ["home", "team", "contracts"],
      dryRun,
      success,
    });

    const phaseBlockers = !phaseGate.allowed && phaseGate.reason ? [phaseGate.reason] : [];
    return NextResponse.json(
      {
        success,
        summary:
          phaseBlockers.length > 0
            ? { ...summary, ok: false, blockingReasons: Array.from(new Set([...summary.blockingReasons, ...phaseBlockers])) }
            : summary,
        warnings: [...phaseGate.warnings, ...writeAuth.warnings, ...summary.warnings],
        blockingReasons: Array.from(new Set([...summary.blockingReasons, ...phaseBlockers])),
      },
      { status: success || dryRun ? 200 : 409 },
    );
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Contract renewal failed.",
        summary: null,
      },
      { status: 500 },
    );
  }
}
