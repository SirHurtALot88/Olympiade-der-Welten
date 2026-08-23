import { NextResponse } from "next/server";

import {
  readAdminSeasonSimulation,
  setAdminSeasonSimulationStatus,
  startAdminSeasonSimulation,
  tickAdminSeasonSimulation,
  type AdminSeasonSimulationAction,
  type AdminSeasonSimulationMode,
} from "@/lib/admin/season-simulation-runner";
import { assertSaveNotRoomBound } from "@/lib/room/assert-save-not-room-bound";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";
import { mapSaveResolutionErrorToResponse } from "@/lib/persistence/save-resolution-response";

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
      const mode: AdminSeasonSimulationMode = body.mode === "apply" ? "apply" : "dry_run";

      // Nur `mode: "apply"` schreibt real (der Runner haengt `dry_run` an eine In-Memory-Kopie,
      // siehe createExecutionContext in season-simulation-runner.ts) — der Guard darf Dry Runs auf
      // raumgebundenen Saves also nicht blockieren, sonst kann niemand mehr eine Vorschau sehen.
      if (mode === "apply") {
        const roomCheck = assertSaveNotRoomBound(saveId, "admin_season_simulation");
        if (roomCheck.blocked) {
          return NextResponse.json({ ok: false, run: null, error: roomCheck.reason }, { status: roomCheck.status });
        }
      }

      const run = startAdminSeasonSimulation({
        saveId,
        seasonCount: parseSeasonCount(body.seasonCount),
        mode,
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
      // Der Lauf ist zustandsbehaftet und zieht sich ueber viele Requests: `start` legt nur die
      // Lauf-Metadatei an (kein saveSingleplayerState, siehe startAdminSeasonSimulation), das
      // tatsaechliche Schreiben passiert phasenweise in JEDEM `tick` (tickAdminSeasonSimulation ->
      // executeCurrentPhase -> saveSingleplayerState). Ein Start-Guard allein reicht deshalb nicht:
      // ein `apply`-Lauf kann auf einem raumfreien Save gestartet werden, DANACH kann derselbe Save
      // in einen Koop-Raum wandern — jeder folgende `tick` muss das frisch pruefen, nicht nur der
      // erste Request.
      const run = readAdminSeasonSimulation(runId);
      if (run && run.mode === "apply") {
        const roomCheck = assertSaveNotRoomBound(run.saveId, "admin_season_simulation");
        if (roomCheck.blocked) {
          return NextResponse.json({ ok: false, run, error: roomCheck.reason }, { status: roomCheck.status });
        }
      }
      const tickedRun = await tickAdminSeasonSimulation(runId);
      // `saveVersion` mitgeben — siehe Begruendung in `app/api/sponsor/choose/route.ts`. Nur ein
      // `apply`-Tick schreibt real ueber `saveSingleplayerState` (siehe Kommentar oben); ein
      // `dry_run`-Tick schreibt ausschliesslich in die In-Memory-Kopie des Runners
      // (`createSingleSavePersistenceHarness`, season-simulation-runner.ts) und laesst den echten
      // Save unangetastet — die real gelesene Version bleibt in dem Fall unveraendert, das
      // Mitschicken ist also harmlos.
      const saveVersion = tickedRun ? createPersistenceService().getSaveById(tickedRun.saveId)?.gameState.saveVersion ?? null : null;
      return NextResponse.json({ ok: true, run: tickedRun, saveVersion });
    }
    if (action === "pause") {
      return NextResponse.json({ ok: true, run: setAdminSeasonSimulationStatus(runId, "paused") });
    }
    if (action === "resume") {
      // Bewusst OHNE Room-Bound-Check hier: `setAdminSeasonSimulationStatus` schreibt nur die
      // Lauf-Metadatei (writeRun -> JSON unter outputs/admin-season-simulation/runs/), NIEMALS den
      // Spielstand selbst (kein saveSingleplayerState-Aufruf im Runner) — `resume` setzt lediglich
      // `status: "running"` und einen Log-Eintrag. Der eigentliche Schreibvorgang ist `tick`, und
      // der prueft jetzt bei JEDEM Aufruf frisch. Ein zusaetzlicher Check hier waere reine
      // Fruehwarnung (bessere Fehlermeldung statt "resumed, dann beim naechsten Tick doch blockiert"),
      // aber keine Sicherheitsnotwendigkeit — der Guard sitzt bewusst nur an echten Schreibstellen.
      return NextResponse.json({ ok: true, run: setAdminSeasonSimulationStatus(runId, "running") });
    }
    if (action === "cancel") {
      return NextResponse.json({ ok: true, run: setAdminSeasonSimulationStatus(runId, "cancelled") });
    }

    return NextResponse.json({ ok: true, run: readAdminSeasonSimulation(runId) });
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    // Eine ID, hinter der kein Spielstand mehr liegt, ist eine 404 mit dem Code `save_not_found` —
    // nicht ein 500 mit einem Satz, den keine Fehlertabelle wiedererkennt. Begruendung ausfuehrlich
    // bei `resolveSave` in lib/admin/season-simulation-runner.ts.
    const nichtAufloesbar = mapSaveResolutionErrorToResponse(error);
    if (nichtAufloesbar) return nichtAufloesbar;
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
