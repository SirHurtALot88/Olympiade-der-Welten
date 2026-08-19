import { NextResponse } from "next/server";

import { KOOP_SCHREIBKONFLIKT_CODE, istKoopSchreibkonflikt } from "@/lib/persistence/koop-schreibkonflikt";

/**
 * Route-Antwort zu einem `KoopSchreibkonfliktError`.
 *
 * WARUM ES DIESE DATEI BRAUCHT — der Riegel selbst war fertig, seine ANTWORT nicht.
 * `assertKeinVeralteterKoopSchreibvorgang` (koop-schreibkonflikt.ts) wirft, wenn Chris und Franky
 * denselben Spielstand gleichzeitig ueberschreiben. Die Routen fangen das aber nur in ihrem
 * Sammel-`catch` auf und machen daraus
 *
 *   HTTP 500, error: "stale_save_version: Der Spielstand ... wurde inzwischen ..."
 *
 * Zwei Dinge stimmen daran nicht. Erstens der Status: 500 heisst "der Server ist kaputt", und
 * genau das ist es nicht — der Server hat vollkommen richtig gehandelt und den Datenverlust
 * verhindert. Ein Konflikt ist 409. Zweitens die Form: `formatRoomWriteErrorCode` und
 * `istVeralteterSaveStand` (lib/room/parse-room-write-context.ts) erkennen den Fall am CODE
 * `stale_save_version` — in einem ausformulierten Satz finden sie ihn nicht. Der Client konnte
 * also weder den Satz aus seiner Fehlertabelle zeigen noch von selbst neu laden.
 *
 * WARUM SIE VOM RIEGEL GETRENNT IST: exakt derselbe Grund wie bei
 * `save-resolution-response.ts` (siehe Kommentar dort) — `next/server` ist nur in der
 * Next-Laufzeit ladbar, und `koop-schreibkonflikt.ts` haengt ueber `persistence-service.ts` in der
 * Importkette des Socket-Servers (`server.ts` via tsx). Ein `next/server`-Import dort waere ein
 * Serverstart-Absturz beim Modulladen.
 *
 * Gibt `null` fuer jeden anderen Fehler zurueck — der Aufrufer behaelt seine bisherige
 * Fehlerbehandlung unveraendert.
 */
export function koopSchreibkonfliktAntwort(error: unknown): NextResponse | null {
  if (!istKoopSchreibkonflikt(error)) {
    return null;
  }
  return NextResponse.json(
    {
      success: false,
      error: KOOP_SCHREIBKONFLIKT_CODE,
      message: error.message,
      summary: null,
      // Die gelesene und die gespeicherte Version mitgeben: ohne sie steht in der Antwort nur
      // "veraltet", und wer den Fall untersucht, muss raten, wie weit auseinander die Staende
      // waren. Der Fehler traegt beide Zahlen ohnehin schon.
      geleseneVersion: error.geleseneVersion,
      gespeicherteVersion: error.gespeicherteVersion,
    },
    { status: 409 },
  );
}
