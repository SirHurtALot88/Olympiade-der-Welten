import { afterEach, describe, expect, it, vi } from "vitest";

import { prefetchDisciplineStageMedia } from "@/lib/foundation/foundation-panel-prefetch";

// Bug bug-2026-08-04T15-59-37-826Z-2tlf67: Portraits/Logos sollen waehrend die
// Disziplin laeuft im Idle-Slot vorgeladen werden, damit Hover-Karte und Drawer
// beim Oeffnen nicht nachladen. Diese Suite prueft die Kern-Eigenschaft, die den
// Fix erst sicher macht: jede URL wird hoechstens EINMAL angestossen — weder
// innerhalb eines Aufrufs (doppelte/leere Eintraege) noch ueber mehrere Aufrufe
// mit derselben sessionKey (z. B. re-render waehrend des Reveals) oder ueber
// verschiedene Disziplinen hinweg (derselbe Spieler in D1 UND D2).

class FakeImage {
  decoding = "";
  #src = "";
  set src(value: string) {
    this.#src = value;
    loadedUrls.push(value);
  }
  get src() {
    return this.#src;
  }
}

let loadedUrls: string[] = [];

afterEach(() => {
  loadedUrls = [];
  // @ts-expect-error Test-Stub wieder entfernen, damit andere Suiten im selben
  // Prozess kein globales Image vorfinden, das sie nicht erwarten.
  delete globalThis.Image;
  vi.unstubAllGlobals();
});

describe("prefetchDisciplineStageMedia", () => {
  it("laedt jede Bild-URL nur einmal, auch bei doppeltem Aufruf/gleicher Session", async () => {
    // @ts-expect-error Browser-Global im Node-Testlauf simulieren.
    globalThis.Image = FakeImage;

    prefetchDisciplineStageMedia({
      sessionKey: "save-x:matchday-3:time-trial",
      urls: [
        "/api/media/team-logo/A-A",
        "/api/media/player-portrait/p1",
        "/api/media/player-portrait/p1", // Duplikat innerhalb desselben Aufrufs
        null,
        undefined,
        "",
      ],
    });
    // Zweiter Aufruf mit DERSELBEN sessionKey (z. B. Reveal-Re-Render): darf
    // nichts erneut anstossen, auch nicht die neue URL — die Session ist "erledigt".
    prefetchDisciplineStageMedia({
      sessionKey: "save-x:matchday-3:time-trial",
      urls: ["/api/media/team-logo/A-A", "/api/media/player-portrait/p2"],
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(loadedUrls.sort()).toEqual(["/api/media/player-portrait/p1", "/api/media/team-logo/A-A"]);
  });

  it("stoesst dieselbe URL ueber eine ANDERE Disziplin/Session nicht doppelt an", async () => {
    // @ts-expect-error Browser-Global im Node-Testlauf simulieren.
    globalThis.Image = FakeImage;

    // Team Z-Z tritt in D1 UND D2 an — derselbe Logo-Download soll nur einmal
    // im gesamten Spielverlauf passieren, nicht pro Disziplin. (Eigene URL, damit
    // dieser Test unabhaengig vom URL-Set des vorigen Tests im selben Modul bleibt.)
    prefetchDisciplineStageMedia({
      sessionKey: "save-x:matchday-4:staffel",
      urls: ["/api/media/team-logo/Z-Z"],
    });
    prefetchDisciplineStageMedia({
      sessionKey: "save-x:matchday-4:time-trial",
      urls: ["/api/media/team-logo/Z-Z", "/api/media/player-portrait/p9"],
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(loadedUrls.sort()).toEqual(["/api/media/player-portrait/p9", "/api/media/team-logo/Z-Z"]);
  });

  it("wirft nicht, wenn es kein Browser-Image gibt (SSR/Node)", () => {
    expect(() =>
      prefetchDisciplineStageMedia({
        sessionKey: "save-y:matchday-1:tdm",
        urls: ["/api/media/player-portrait/pZ"],
      }),
    ).not.toThrow();
  });
});
