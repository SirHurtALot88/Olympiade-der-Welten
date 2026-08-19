export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { getDatabase } from "@/lib/persistence/sqlite";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";

export function GET() {
  try {
    const database = getDatabase();
    const activeSave = database
      .prepare("SELECT save_id FROM saves WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1")
      .get() as { save_id: string } | undefined;

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      database: {
        ok: true,
        activeSaveId: activeSave?.save_id ?? null,
      },
    });
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      {
        ok: false,
        generatedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown healthcheck error.",
      },
      { status: 500 },
    );
  }
}

