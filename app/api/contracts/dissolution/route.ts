export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  executeLocalContractDissolution,
  listLocalContractDissolutionOffers,
} from "@/lib/morale/contract-dissolution-local-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";

type DissolutionRequestBody = {
  saveId?: string;
  seasonId?: string;
  teamId?: string;
  playerId?: string;
  decision?: "accepted" | "declined";
  source?: "sqlite" | "prisma";
  /**
   * Raum-Kontext. Diese Route schrieb bis hierher OHNE jede Besitzpruefung in den
   * Spielstand: im Coop konnte damit die Vertragsaufloesung eines FREMDEN Teams
   * entschieden werden, und der Mitspieler bekam davon nichts mit (kein Broadcast).
   * Aufgefallen ist das ueber `tests/api-write-route-guard-coverage.test.ts`, wo die
   * Route als einzige echte Gameplay-Schreibroute ungeschuetzt gelistet war.
   */
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  activeManagerTeamId?: string | null;
  activeOwnerId?: string | null;
  controlMode?: "manual" | "ai" | "passive" | null;
};

/** Offene Angebote lesen — treibt die Entscheidungsliste im Kader. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saveId = url.searchParams.get("saveId")?.trim() ?? "";
    const seasonId = url.searchParams.get("seasonId")?.trim() ?? "";
    const teamId = url.searchParams.get("teamId")?.trim() ?? "";

    if (!saveId || !seasonId || !teamId) {
      return NextResponse.json(
        { success: false, error: "saveId, seasonId and teamId are required.", offers: [] },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      offers: listLocalContractDissolutionOffers({ saveId, seasonId, teamId }),
    });
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    const message = error instanceof Error ? error.message : "Dissolution offers could not be read.";
    return NextResponse.json({ success: false, error: message, offers: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as DissolutionRequestBody;
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const playerId = body.playerId?.trim() ?? "";
    const decision = body.decision;

    if (!saveId || !seasonId || !teamId || !playerId) {
      return NextResponse.json(
        { success: false, error: "saveId, seasonId, teamId and playerId are required.", offers: [] },
        { status: 400 },
      );
    }
    if (decision !== "accepted" && decision !== "declined") {
      return NextResponse.json(
        { success: false, error: "decision must be 'accepted' or 'declined'.", offers: [] },
        { status: 400 },
      );
    }
    // Dieselbe Sperre wie beim Verkauf: die Prisma-Referenz ist eine Lesequelle.
    if (body.source === "prisma") {
      return NextResponse.json(
        {
          success: false,
          error: "Prisma-Referenz ist read-only. Für Vertragsauflösungen bitte lokalen Spielstand nutzen.",
          offers: [],
        },
        { status: 409 },
      );
    }

    // Besitzpruefung VOR dem Schreiben: `teamId` ist das Team, dessen Spieler geht — nur wer
    // dieses Team fuehrt, darf ueber die Aufloesung entscheiden. Ausserhalb eines Raums laesst
    // der Guard durch (Solo), im Raum prueft er Sitz und Team-Zugehoerigkeit.
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
      action: "contract_dissolution",
      source: "sqlite",
      dryRun: false,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json(
        { success: false, error: writeAuth.reason, offers: [], warnings: writeAuth.warnings },
        { status: writeAuth.status },
      );
    }

    const result = executeLocalContractDissolution({ saveId, seasonId, teamId, playerId, decision });

    // Der Mitspieler sieht sonst einen Kader, in dem der Spieler noch steht. `contracts` und
    // `team` sind betroffen, `home` wegen der Abfindung auf dem Kontostand.
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId,
      action: "contract_dissolution",
      eventType: "roster_updated",
      affectedViews: ["home", "team", "contracts"],
      dryRun: false,
      success: result.ok,
    });

    return NextResponse.json(
      { success: result.ok, error: result.error, offers: result.offers, applied: result.applied ?? null },
      { status: result.ok ? 200 : 409 },
    );
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    const message = error instanceof Error ? error.message : "Dissolution could not be processed.";
    return NextResponse.json({ success: false, error: message, offers: [] }, { status: 500 });
  }
}
