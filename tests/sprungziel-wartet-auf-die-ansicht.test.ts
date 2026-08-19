import { describe, expect, it } from "vitest";

import {
  FOUNDATION_JUMP_DEADLINE_MS,
  warteAufSprungziel,
  type FoundationJumpErgebnis,
} from "@/lib/foundation/tabs/foundation-page-module-helpers";

/**
 * DER WEITER-KNOPF SPRANG INS LEERE — Befund A1 aus `docs/AUDIT-INGAME-2026-08-19.md`.
 *
 * CHRIS: „ja fang mit A1 an."
 *
 * GEMESSEN am echten Spielstand (Season 1, Spieltag 10), bevor hier etwas geaendert wurde:
 * der Scroller feuerte nach festen 90 ms, `#season-finale` war da noch nicht im DOM, und das
 * Element erschien erst nach 2972 ms. `getElementById` lieferte `null`, die Funktion brach
 * STILL ab, die Scrollposition blieb 0.
 *
 * Von aussen sah das aus wie ein toter Knopf: 16 Klicks gemessen, ab dem vierten 13 Mal
 * derselbe Uebergang „Season vorbereiten → Season vorbereiten" — bei gruenem Knopf.
 *
 * WAS HIER GEPRUEFT WIRD ist nicht die Zahl 4000, sondern das Verhalten: es wird auf das
 * ELEMENT gewartet, nicht auf die Uhr. Gegenprobe: ersetzt man die Warteschleife wieder durch
 * einen einmaligen Blick nach 90 ms, wird der erste Fall rot.
 */

/** Eine Uhr, die nur springt, wenn der Test sie springen laesst — keine echte Zeit im Test. */
function nachstellung(input: { erscheintNachMs: number; fristMs?: number }) {
  let jetzt = 0;
  const warteschlange: Array<{ faellig: number; rueckruf: () => void }> = [];
  let ergebnis: FoundationJumpErgebnis<string> | null = null;
  let versuche = 0;

  warteAufSprungziel<string>({
    suche: () => {
      versuche += 1;
      return jetzt >= input.erscheintNachMs ? "das-element" : null;
    },
    jetzt: () => jetzt,
    planeErneut: (rueckruf, verzoegerungMs) => warteschlange.push({ faellig: jetzt + verzoegerungMs, rueckruf }),
    fertig: (e) => {
      ergebnis = e;
    },
    fristMs: input.fristMs,
  });

  // Die Uhr laufen lassen, bis nichts mehr geplant ist.
  let sicherung = 0;
  while (warteschlange.length > 0 && sicherung < 10_000) {
    sicherung += 1;
    const naechster = warteschlange.shift()!;
    jetzt = naechster.faellig;
    naechster.rueckruf();
  }
  return { ergebnis: ergebnis as FoundationJumpErgebnis<string> | null, versuche, endzeit: jetzt };
}

describe("Sprungziel: gewartet wird auf das Element, nicht auf die Uhr", () => {
  it("findet ein Ziel, das erst nach 2972 ms erscheint — die gemessene Wirklichkeit", () => {
    // Genau der Fall aus der Messung. Mit dem alten festen Blick nach 90 ms war er unmoeglich.
    const { ergebnis, versuche } = nachstellung({ erscheintNachMs: 2972 });
    expect(ergebnis).toEqual({ gefunden: "das-element" });
    // Mehr als ein Blick — sonst waere es wieder die einmalige Wette.
    expect(versuche).toBeGreaterThan(1);
  });

  it("nimmt ein sofort vorhandenes Ziel beim ersten Blick — ohne Verzoegerung", () => {
    // Der haeufige Fall darf nicht langsamer werden, nur weil der seltene jetzt funktioniert.
    const { ergebnis, versuche, endzeit } = nachstellung({ erscheintNachMs: 0 });
    expect(ergebnis).toEqual({ gefunden: "das-element" });
    expect(versuche).toBe(1);
    expect(endzeit).toBe(0);
  });

  it("gibt nach der Frist auf und meldet, wie lange es gedauert hat", () => {
    // Ein Ziel, das es nicht gibt, ist ein Verdrahtungsfehler. Vorher verschwand er spurlos.
    const { ergebnis } = nachstellung({ erscheintNachMs: Number.POSITIVE_INFINITY });
    expect(ergebnis).toMatchObject({ gefunden: null });
    expect((ergebnis as { verstrichenMs: number }).verstrichenMs).toBeGreaterThanOrEqual(
      FOUNDATION_JUMP_DEADLINE_MS,
    );
  });

  it("laesst sich abbrechen — ein neuer Sprung darf den alten nicht erben", () => {
    /*
     * Zwei Weiter-Klicks kurz hintereinander: der erste Sprung wartet noch, waehrend der zweite
     * startet. Ohne Abbruch scrollte der alte, sobald SEIN Ziel auftaucht — der Spieler landet
     * dann dort, wo er vor zwei Klicks hinwollte.
     */
    let jetzt = 0;
    const warteschlange: Array<() => void> = [];
    let abgebrochen = false;
    let fertigGerufen = 0;

    warteAufSprungziel<string>({
      suche: () => (jetzt >= 1000 ? "spaetes-element" : null),
      jetzt: () => jetzt,
      planeErneut: (rueckruf) => warteschlange.push(rueckruf),
      abgebrochen: () => abgebrochen,
      fertig: () => {
        fertigGerufen += 1;
      },
    });

    expect(warteschlange.length).toBe(1);
    abgebrochen = true;
    jetzt = 2000;
    warteschlange.shift()!();

    expect(fertigGerufen).toBe(0);
  });
});
