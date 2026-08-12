/**
 * EIN BLOCKIERTER AUTOSAVE DARF NICHT VERFALLEN.
 *
 * GEMELDET (Chris): „die wunschliste leert sich immer mit der zeit wenn ich durch die spieler
 * scrolle das ist nicht so angedacht."
 *
 * Die Ursache lag nicht in der Wunschliste — sie hat genau einen Schreiber, und der kürzt nichts.
 * Sie lag im Autosave: seine beiden Wachen (Pause während Navigation, und das Ruhefenster aus
 * `navigation-coalescing.ts`) haben schlicht `return` gemacht. Damit war der Schreibversuch WEG,
 * denn der Effekt hängt an `gameState` und läuft erst wieder, wenn sich der Zustand erneut ändert.
 *
 * Wer eine Änderung macht und danach blättert, hat sie nie geschrieben. Der nächste Reload
 * (Saison-Archiv, KI-Poller, Live-Sync, 409-Konflikt) ersetzt dann den lokalen Zustand UND setzt
 * die Inhaltssignatur auf den geladenen Stand — die Änderung gilt als gespeichert und ist still
 * verschwunden. Blättern ist der schlimmste Fall, weil jeder Ansichtswechsel das Ruhefenster neu
 * setzt: die Wache trifft nicht einmal, sondern dauernd.
 *
 * WARUM DIESER TEST DEN QUELLTEXT LIEST statt den Hook zu rendern: der Autosave hängt an einem
 * React-Effekt mit `window`-Timern, einer Schreib-Warteschlange und vier Refs, die von außerhalb
 * des Hooks gesetzt werden. Ein Rendertest davon prüfte am Ende die Attrappen, nicht die Regel.
 * Die Regel selbst ist aber scharf formulierbar und genau das wird hier festgehalten: in den beiden
 * Wachen steht eine WIEDERVORLAGE, kein blankes `return`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = readFileSync(
  join(process.cwd(), "lib/foundation/tabs/use-foundation-persistence-actions.ts"),
  "utf8",
);

/** Der Rumpf von `versucheAutoSave` — dort sitzen die beiden Wachen. */
function leseAutoSaveRumpf(): string {
  const start = quelle.indexOf("function versucheAutoSave()");
  expect(start, "`versucheAutoSave` nicht gefunden — wurde der Autosave umgebaut?").toBeGreaterThan(0);
  const ende = quelle.indexOf("planeAutoSave(AUTO_PERSIST_DEBOUNCE_MS)", start);
  expect(ende, "Ende des Autosave-Blocks nicht gefunden").toBeGreaterThan(start);
  return quelle.slice(start, ende);
}

describe("Autosave beim Blättern", () => {
  it("legt einen blockierten Schreibversuch wieder vor, statt ihn fallen zu lassen", () => {
    const rumpf = leseAutoSaveRumpf();

    // Die Pause-Wache: sie darf nicht mehr aufgeben.
    const pauseWache = rumpf.slice(rumpf.indexOf("autoPersistPausedRef.current"));
    expect(
      pauseWache.slice(0, pauseWache.indexOf("}")),
      "Die Pause-Wache gibt auf, statt wiedervorzulegen",
    ).toContain("planeAutoSave");

    // Die Ruhefenster-Wache: dieselbe Regel.
    const fensterWache = rumpf.slice(rumpf.indexOf("foundationViewTransitionUntilRef.current)"));
    expect(
      fensterWache.slice(0, fensterWache.indexOf("}")),
      "Die Ruhefenster-Wache gibt auf, statt wiedervorzulegen",
    ).toContain("planeAutoSave");
  });

  it("wartet genau bis zum Ende des Ruhefensters, statt blind lange zu schlafen", () => {
    // Ein fester langer Rueckfall waere zwar auch korrekt, wuerde aber jede Aenderung unnoetig
    // verzoegern. Die Wiedervorlage rechnet deshalb aus dem Fensterende.
    expect(leseAutoSaveRumpf()).toContain("foundationViewTransitionUntilRef.current - Date.now()");
  });

  it("haelt die Wiedervorlage kuerzer als das Navigations-Ruhefenster", () => {
    // Sonst griffe sie erst deutlich nach dem Fensterende und das Blaettern bliebe zaeh.
    const wiedervorlage = Number(/const AUTO_PERSIST_RETRY_MS = (\d+)/.exec(quelle)?.[1]);
    const ruhefenster = Number(
      /FOUNDATION_NAVIGATION_QUIET_MS = (\d+)/.exec(
        readFileSync(join(process.cwd(), "lib/foundation/navigation-coalescing.ts"), "utf8"),
      )?.[1],
    );

    expect(Number.isFinite(wiedervorlage), "AUTO_PERSIST_RETRY_MS nicht gefunden").toBe(true);
    expect(Number.isFinite(ruhefenster), "FOUNDATION_NAVIGATION_QUIET_MS nicht gefunden").toBe(true);
    expect(wiedervorlage).toBeGreaterThan(0);
    expect(wiedervorlage).toBeLessThan(ruhefenster);
  });

  it("stellt den Timer unbedingt — die Wachen entscheiden erst im Rueckruf", () => {
    // Der eigentliche Konstruktionsfehler war, dass die Wachen VOR dem Stellen des Timers standen:
    // dann gibt es gar keinen Rueckruf, der sich wiedervorlegen koennte.
    const start = quelle.indexOf("const planeAutoSave =");
    const timerZeile = quelle.indexOf("planeAutoSave(AUTO_PERSIST_DEBOUNCE_MS)", start);
    const davor = quelle.slice(start, timerZeile);

    // Zwischen der Definition und dem unbedingten Stellen darf keine Wache mit blankem `return`
    // stehen, die den Timer ueberspringt.
    expect(davor.includes("if (autoPersistPausedRef.current || liveSaveRefreshInFlightRef.current) {\n      return;")).toBe(
      false,
    );
  });
});
