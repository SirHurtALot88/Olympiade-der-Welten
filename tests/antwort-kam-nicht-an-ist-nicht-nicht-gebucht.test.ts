/**
 * GEMELDET (`lwlrwd`, „Spieltag · Arena", Spielstand `swnjlk`, Saison 2, Spieltag 4):
 *
 *   „Die Punkte wurden nicht gebucht — Failed to execute 'json' on 'Response': Unexpected end of
 *    JSON input"
 *
 * DIE MELDUNG WAR FALSCH — nachgemessen am Live-Abbild vom 22.08.:
 *
 *   gewertete Spieltage:   season-2-matchday-1 … -7, alle `preview_applied`
 *   Standings-Buchungen:   season-2-matchday-1 … -7
 *   mit Ergebnis, ohne Buchung: KEINE
 *
 * Spieltag 4 ist gebucht. Der Server hat also gearbeitet; nur die ANTWORT kam nicht (oder nicht
 * als JSON) beim Browser an. `await response.json()` wirft bei leerem Koerper genau jenen Satz —
 * und die Buehne machte daraus die Behauptung „Die Punkte wurden nicht gebucht".
 *
 * Das ist die gefaehrlichste Sorte Fehlmeldung: sie behauptet das Gegenteil des Zustands. Wer ihr
 * glaubt, wertet denselben Spieltag ein zweites Mal.
 *
 * WAS HIER GEPRUEFT WIRD: dass ein Fehler BEIM LESEN der Antwort als „Zustand unbekannt" erkannt
 * wird und nicht als „fehlgeschlagen" — und dass der erhaltene Zustand (Statuscode, Koerper) in
 * der Meldung landet statt im Nichts.
 *
 * WAS NICHT GEPRUEFT WIRD, weil es von hier aus nicht geht: warum der Server einen leeren Koerper
 * schickte. Das steht in seinen Protokollen. Diese Aenderung repariert das nicht — sie sorgt
 * dafuer, dass es beim naechsten Mal in der Meldung steht.
 */
import { describe, expect, it } from "vitest";

import {
  AntwortUnlesbarError,
  istZustandUnbekannt,
  leseAntwortAlsJson,
} from "@/lib/foundation/antwort-als-json";

function antwort(koerper: string, init?: { status?: number; statusText?: string }): Response {
  return new Response(koerper, { status: init?.status ?? 200, statusText: init?.statusText ?? "" });
}

describe("Eine unlesbare Antwort heisst NICHT „nicht gebucht“", () => {
  it("wirft bei leerem Koerper einen Fehler, der den Statuscode nennt", () => {
    // Der gemeldete Fall. Statt „Unexpected end of JSON input" muss dastehen, WAS ankam.
    return expect(leseAntwortAlsJson(antwort("", { status: 502, statusText: "Bad Gateway" })))
      .rejects.toThrow(/502/);
  });

  it("sagt ausdruecklich, dass der Inhalt leer war", async () => {
    await expect(leseAntwortAlsJson(antwort("", { status: 504 }))).rejects.toThrow(/leerem Inhalt/);
  });

  it("erkennt eine HTML-Fehlerseite als solche, statt sie zu verschlucken", async () => {
    // Der zweite haeufige Fall: ein Proxy davor antwortet mit HTML statt JSON.
    const seite = "<!doctype html><html><body><h1>504 Gateway Time-out</h1></body></html>";
    await expect(leseAntwortAlsJson(antwort(seite, { status: 504 }))).rejects.toThrow(/nicht mit JSON/);
  });

  it("kuerzt einen langen Koerper, statt die halbe Seite in die Meldung zu kippen", async () => {
    const lang = "x".repeat(5000);
    try {
      await leseAntwortAlsJson(antwort(lang, { status: 500 }));
      throw new Error("haette werfen muessen");
    } catch (error) {
      expect((error as Error).message.length).toBeLessThan(400);
    }
  });

  it("markiert genau diese Faelle als „Zustand unbekannt“", async () => {
    // DIE KERNZUSAGE. Daran unterscheidet die Buehne „nicht gebucht" von „weiss ich nicht".
    for (const koerper of ["", "<html>502</html>"]) {
      const fehler = await leseAntwortAlsJson(antwort(koerper, { status: 502 })).catch((e) => e);
      expect(istZustandUnbekannt(fehler)).toBe(true);
      expect(fehler).toBeInstanceOf(AntwortUnlesbarError);
    }
  });

  it("markiert einen FACHLICHEN Fehler NICHT als unbekannt", () => {
    // Die Grenze: hat der Server geantwortet und abgelehnt, ist der Zustand sehr wohl bekannt —
    // dann bleibt es bei „nicht gebucht". Ohne diese Zeile wuerde jeder Fehler verharmlost.
    expect(istZustandUnbekannt(new Error("standings_apply_blocked"))).toBe(false);
    expect(istZustandUnbekannt(null)).toBe(false);
  });

  it("liest gueltiges JSON unveraendert durch", async () => {
    // Gegenprobe zur Gegenprobe: haette die Huelle den Normalfall gebrochen, waere jede Buchung
    // kaputt und die Zusagen oben waertlos.
    await expect(leseAntwortAlsJson<{ applied: boolean }>(antwort('{"applied":true}'))).resolves.toEqual({
      applied: true,
    });
  });

  it("wirft auch bei HTTP 200 mit leerem Koerper — genau der gemeldete Fall", async () => {
    // Wichtig: der Statuscode allein haette den Fehler NICHT gefangen. Ein abgebrochener Strom
    // kann durchaus mit 200 beginnen und ohne Inhalt enden.
    await expect(leseAntwortAlsJson(antwort("", { status: 200 }))).rejects.toThrow(/leerem Inhalt/);
  });
});

/**
 * Die Huelle allein nuetzt nichts, solange die beiden Stellen sie nicht benutzen. Geprueft wird
 * die ZUSAGE, nicht die Schreibweise: der Buchungspfad liest Antworten ueber die Huelle, und die
 * Buehne kennt einen dritten Zustand neben „gebucht" und „fehlgeschlagen".
 */
describe("Beide Stellen sind verdrahtet", () => {
  const quelle = (pfad: string) =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("node:fs").readFileSync(require("node:path").join(process.cwd(), pfad), "utf8") as string;

  it("liest im Buchungspfad keine Antwort mehr roh mit .json()", () => {
    const handler = quelle("lib/foundation/tabs/cockpit-matchday-handlers.ts");
    expect(handler).toContain("leseAntwortAlsJson");
    // Der rohe Aufruf ist genau die Zeile, die „Unexpected end of JSON input" geworfen hat.
    expect(handler).not.toContain("(await response.json())");
  });

  it("laesst die Buehne den Zustand „unbekannt“ kennen", () => {
    const arena = quelle("app/foundation/discipline-stage/DisciplineStageArena.tsx");
    expect(arena).toContain("istZustandUnbekannt");
    expect(arena).toContain('"unknown"');
    // Und sie darf in diesem Fall nicht mehr „nicht gebucht" behaupten.
    expect(arena).toContain("ob gebucht wurde, ist unklar");
  });
});
