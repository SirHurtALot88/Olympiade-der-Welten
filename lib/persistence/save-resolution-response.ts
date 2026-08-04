import { NextResponse } from "next/server";

import { SaveResolutionError } from "@/lib/persistence/resolve-local-save";

/**
 * Route-Antwort zu einem `SaveResolutionError` — bewusst in EINER eigenen Datei, getrennt vom
 * Resolver selbst (`resolve-local-save.ts`).
 *
 * Der Grund ist kein Stilempfinden, sondern ein Serverstart-Absturz: `next/server` ist nur in der
 * Next-Laufzeit ladbar. In einem nackten Node-Prozess wirft schon der IMPORT
 * "Invariant: AsyncLocalStorage accessed in runtime where it is not available" — und genau so ein
 * nackter Node-Prozess ist unser Socket-Server (`server.ts` via tsx). Solange das hier in
 * `resolve-local-save.ts` stand, war jede Importkette vom Socket-Server dorthin eine Landmine:
 * `lib/room/room-store.ts` zog sich beim Einbau des Liga-Setup-Drafts ueber
 * `league-setup-draft-service` → `ai-picks-run-service` → … → `resolve-local-save` genau diese
 * Kante ein, und `npm start` starb beim Modulladen, bevor der Server ueberhaupt lauschen konnte.
 *
 * Der Resolver (`requireLocalPersistedSave`, `SaveResolutionError`) ist reine Server-Logik ohne
 * Next-Bezug und darf von ueberall geladen werden. Nur das Uebersetzen in eine HTTP-Antwort ist
 * Routen-Sache — und Routen laufen ohnehin in der Next-Laufzeit. Diese Trennung haelt die Grenze
 * dort, wo sie hingehoert.
 */
export function mapSaveResolutionErrorToResponse(error: unknown): NextResponse | null {
  if (error instanceof SaveResolutionError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }
  return null;
}
