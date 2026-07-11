import { NextResponse } from "next/server";

import {
  readAdminSeasonSimulation,
  setAdminSeasonSimulationStatus,
  startAdminSeasonSimulation,
  tickAdminSeasonSimulation,
  type AdminSeasonSimulationAction,
  type AdminSeasonSimulationMode,
} from "@/lib/admin/season-simulation-runner";

export const dynamic = "force-dynamic";

type AdminSeasonSimulationBody = {
  action?: AdminSeasonSimulationAction;
  runId?: string;
  saveId?: string;
  seasonCount?: 1 | 2 | 5;
  mode?: AdminSeasonSimulationMode;
  fullChurnStress?: boolean;
  injuriesTestMode?: boolean;
};

function parseSeasonCount(value: unknown): 1 | 2 | 5 {
  return value === 2 || value === 5 ? value : 1;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId")?.trim() ?? "";
  if (!runId) {
    return NextResponse.json({ ok: false, run: null, error: "runId is required." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, run: readAdminSeasonSimulation(runId) });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as AdminSeasonSimulationBody;
    const action = body.action ?? "status";
    const runId = body.runId?.trim() ?? "";

    if (action === "start") {
      const saveId = body.saveId?.trim() ?? "";
      if (!saveId) {
        return NextResponse.json({ ok: false, run: null, error: "saveId is required." }, { status: 400 });
      }
      const run = startAdminSeasonSimulation({
        saveId,
        seasonCount: parseSeasonCount(body.seasonCount),
        mode: body.mode === "apply" ? "apply" : "dry_run",
        fullChurnStress: body.fullChurnStress === true,
        injuriesTestMode: body.injuriesTestMode === true,
      });
      return NextResponse.json({ ok: true, run });
    }

    if (!runId) {
      if (action === "status") {
        return NextResponse.json({ ok: true, run: null });
      }
      return NextResponse.json({ ok: false, run: null, error: "runId is required." }, { status: 400 });
    }

    if (action === "tick") {
      return NextResponse.json({ ok: true, run: await tickAdminSeasonSimulation(runId) });
    }
    if (action === "pause") {
      return NextResponse.json({ ok: true, run: setAdminSeasonSimulationStatus(runId, "paused") });
    }
    if (action === "resume") {
      return NextResponse.json({ ok: true, run: setAdminSeasonSimulationStatus(runId, "running") });
    }
    if (action === "cancel") {
      return NextResponse.json({ ok: true, run: setAdminSeasonSimulationStatus(runId, "cancelled") });
    }

    return NextResponse.json({ ok: true, run: readAdminSeasonSimulation(runId) });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        run: null,
        error: error instanceof Error ? error.message : "Admin season simulation failed.",
      },
      { status: 500 },
    );
  }
}
