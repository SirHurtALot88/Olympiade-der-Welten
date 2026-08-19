import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { KOOP_SCHREIBKONFLIKT_CODE, KoopSchreibkonfliktError } from "@/lib/persistence/koop-schreibkonflikt";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";

/**
 * DER RIEGEL WAR FERTIG, SEINE ANTWORT NICHT.
 *
 * `assertKeinVeralteterKoopSchreibvorgang` wirft, wenn Chris und Franky denselben Spielstand
 * gleichzeitig ueberschreiben (Befund F3, Aufgabe #46). Die Routen fingen das aber nur in ihrem
 * Sammel-`catch` auf und machten daraus HTTP 500 mit dem ausformulierten Satz als `error`.
 *
 * Zwei Dinge stimmten daran nicht: 500 heisst "der Server ist kaputt" — er hat aber genau richtig
 * gehandelt und den Datenverlust verhindert; und `formatRoomWriteErrorCode`/`istVeralteterSaveStand`
 * (lib/room/parse-room-write-context.ts) erkennen den Fall am CODE `stale_save_version`, den ein
 * ganzer Satz nicht enthaelt. Der Client konnte weder den Satz aus seiner Fehlertabelle zeigen
 * noch von selbst neu laden.
 */
function alleRouten(wurzel: string): string[] {
  const gefunden: string[] = [];
  const laufen = (verzeichnis: string) => {
    for (const eintrag of readdirSync(verzeichnis)) {
      const pfad = join(verzeichnis, eintrag);
      if (statSync(pfad).isDirectory()) laufen(pfad);
      else if (eintrag === "route.ts") gefunden.push(pfad);
    }
  };
  laufen(wurzel);
  return gefunden;
}

describe("Ein gleichzeitiger Schreibvorgang wird 409, nicht 500", () => {
  it("die Antwort traegt den CODE, nicht nur den Satz", () => {
    const antwort = koopSchreibkonfliktAntwort(
      new KoopSchreibkonfliktError({ saveId: "save-koop", geleseneVersion: 7, gespeicherteVersion: 9 }),
    );
    expect(antwort).not.toBeNull();
    expect(antwort?.status).toBe(409);
  });

  it("die Antwort nennt beide Versionen, damit man den Abstand sieht", async () => {
    const antwort = koopSchreibkonfliktAntwort(
      new KoopSchreibkonfliktError({ saveId: "save-koop", geleseneVersion: 7, gespeicherteVersion: 9 }),
    );
    const inhalt = (await antwort?.json()) as Record<string, unknown>;
    expect(inhalt.error).toBe(KOOP_SCHREIBKONFLIKT_CODE);
    expect(inhalt.geleseneVersion).toBe(7);
    expect(inhalt.gespeicherteVersion).toBe(9);
    expect(inhalt.success).toBe(false);
  });

  it("GEGENPROBE: jeder andere Fehler bleibt unberuehrt", () => {
    expect(koopSchreibkonfliktAntwort(new Error("irgendwas anderes"))).toBeNull();
    expect(koopSchreibkonfliktAntwort(null)).toBeNull();
    expect(koopSchreibkonfliktAntwort("stale_save_version")).toBeNull();
  });

  /**
   * DIE EIGENTLICHE ABSICHERUNG — sie gilt der Route, die es noch nicht gibt.
   *
   * Der Riegel selbst wurde bewusst in `saveSingleplayerState` gelegt und nicht in die Routen
   * ("die 31. Route, die jemand naechste Woche baut, haette sie wieder nicht", Kommentar in
   * koop-schreibkonflikt.ts). Fuer die ANTWORT gilt dasselbe Argument, nur laesst sie sich nicht
   * zentralisieren — eine Route muss selbst eine HTTP-Antwort zurueckgeben. Also wird hier
   * nachgezaehlt statt gehofft: wer in den Spielstand schreibt, muss den Konflikt beantworten.
   */
  it("jede schreibende Route beantwortet den Konflikt", () => {
    const wurzel = join(process.cwd(), "app/api");
    const versaeumt = alleRouten(wurzel).filter((pfad) => {
      const quelle = readFileSync(pfad, "utf8");
      return quelle.includes("saveSingleplayerState") && !quelle.includes("koopSchreibkonfliktAntwort");
    });
    expect(versaeumt.map((pfad) => relative(process.cwd(), pfad))).toEqual([]);
  });
});
