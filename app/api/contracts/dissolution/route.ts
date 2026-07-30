export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  executeLocalContractDissolution,
  listLocalContractDissolutionOffers,
} from "@/lib/morale/contract-dissolution-local-service";

type DissolutionRequestBody = {
  saveId?: string;
  seasonId?: string;
  teamId?: string;
  playerId?: string;
  decision?: "accepted" | "declined";
  source?: "sqlite" | "prisma";
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

    const result = executeLocalContractDissolution({ saveId, seasonId, teamId, playerId, decision });

    return NextResponse.json(
      { success: result.ok, error: result.error, offers: result.offers, applied: result.applied ?? null },
      { status: result.ok ? 200 : 409 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dissolution could not be processed.";
    return NextResponse.json({ success: false, error: message, offers: [] }, { status: 500 });
  }
}
