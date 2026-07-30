export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { isAuthEnabled } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";
import { listBugReports, saveBugReport, type BugReportReporter } from "@/lib/bug-report/bug-report-service";

/** Obergrenze fuer den Freitext — genug fuer eine Beschreibung, zu wenig zum Zumuellen. */
const MAX_NOTE_LENGTH = 4000;

/**
 * Wer meldet. Bewusst NUR serverseitig aus dem signierten Session-Cookie — wuerde die Flagge den
 * Namen mitschicken, koennte ihn jeder Request frei behaupten, und die Zuordnung "wer hat das
 * gesehen" waere wertlos.
 *
 * Der Login ist optional (`OLY_AUTH_ENABLED`). Ist er aus, gibt es keinen Benutzer — das ist etwas
 * anderes als "niemand angemeldet" und wird deshalb unterschieden statt beides als leer zu fuehren.
 */
async function resolveReporter(): Promise<BugReportReporter> {
  if (!isAuthEnabled()) {
    return { username: null, displayName: null, ownerId: null, source: "auth_disabled" };
  }
  const user = await getSessionUser();
  if (!user) {
    return { username: null, displayName: null, ownerId: null, source: "not_logged_in" };
  }
  return { username: user.username, displayName: user.displayName, ownerId: user.ownerId, source: "session" };
}

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
      tab: typeof body.tab === "string" ? body.tab : null,
      // Gedeckelt, weil der Titel aus dem Browser kommt und beliebig lang sein kann.
      pageTitle: typeof body.pageTitle === "string" ? body.pageTitle.slice(0, 300) : null,
      url: typeof body.url === "string" ? body.url : null,
      // Der Client schickt seinen User-Agent nicht mit; der Header ist die verlaessliche Quelle.
      userAgent: request.headers.get("user-agent"),
      viewport,
      clientTime: typeof body.clientTime === "string" ? body.clientTime : null,
      reporter: await resolveReporter(),
    });

    return NextResponse.json({
      ok: true,
      reportId: result.reportId,
      // Spielkontext, Seite und Melder gehen zurueck, damit die Oberflaeche zeigen kann, WAS
      // mitgeschickt wurde. Eine Meldung, bei der man nicht sieht, was rausging, vertraut man nicht.
      game: result.record.game,
      page: result.record.page,
      reporter: result.record.reporter,
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
