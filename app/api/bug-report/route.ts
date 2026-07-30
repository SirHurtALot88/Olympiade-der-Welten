export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { resolveSessionOwnerId } from "@/lib/auth/session";
import { formatBugReportPage, listBugReports, saveBugReport } from "@/lib/bug-report/bug-report-service";

/** Obergrenze fuer den Freitext — genug fuer eine Beschreibung, zu wenig zum Zumuellen. */
const MAX_NOTE_LENGTH = 4000;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const note = typeof body.note === "string" ? body.note.slice(0, MAX_NOTE_LENGTH) : null;
    const viewport =
      body.viewport && typeof body.viewport === "object"
        ? {
            width: Number((body.viewport as Record<string, unknown>).width) || 0,
            height: Number((body.viewport as Record<string, unknown>).height) || 0,
          }
        : null;

    const result = saveBugReport({
      note,
      view: typeof body.view === "string" ? body.view : null,
      path: typeof body.path === "string" ? body.path : null,
      pageTitle: typeof body.pageTitle === "string" ? body.pageTitle.slice(0, 300) : null,
      url: typeof body.url === "string" ? body.url : null,
      // Der Client schickt seinen User-Agent nicht mit; der Header ist die verlaessliche Quelle.
      userAgent: request.headers.get("user-agent"),
      viewport,
      clientTime: typeof body.clientTime === "string" ? body.clientTime : null,
      // Identitaet NUR aus der Session, nie aus dem Request-Body: sonst koennte eine Meldung
      // im Namen eines anderen abgesetzt werden.
      sessionOwnerId: await resolveSessionOwnerId(),
    });

    return NextResponse.json({
      ok: true,
      reportId: result.reportId,
      // Spielkontext UND Melder gehen zurueck, damit die Oberflaeche zeigen kann, WAS
      // mitgeschickt wurde. Eine Meldung, bei der man nicht sieht, was rausging, vertraut
      // man nicht — und "unter welchem Namen" gehoert dazu.
      game: result.record.game,
      reporter: result.record.reporter,
      page: formatBugReportPage(result.record),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "bug_report_failed" },
      { status: 500 },
    );
  }
}

/** Zum Nachschauen ohne Dateizugriff: die letzten Meldungen. */
export function GET() {
  try {
    return NextResponse.json({ ok: true, reports: listBugReports() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "bug_report_list_failed" },
      { status: 500 },
    );
  }
}
