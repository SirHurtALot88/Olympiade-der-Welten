/**
 * DIE ENTWICKLUNGS-ACHSE MISST KEINE ENTWICKLUNG — sie misst den Marktwert.
 *
 * CHRIS' EINWAND, der das aufgedeckt hat: „neee das kann nicht sein, die spieler verbessern sich ja
 * nur um ein paar statpoints! Das kann nicht 23 mio MW unterschied ausmachen OHNE mw faktor!!!"
 *
 * ER HATTE RECHT, und der Grund ist gravierender als vermutet.
 *
 * `talentJumpCount` (`sponsor-v4-axes.ts`) zaehlt Spieler, bei denen
 * `after.marketValuePreview − before.marketValue >= AXIS_TALENT_JUMP_MV` gilt. An 339
 * Entwicklungs-Ereignissen aus drei Live-Spielstaenden nachgemessen:
 *
 *   before.marketValue > 0 :   0 von 339
 *   before.marketValue = 0 : 339 von 339
 *
 * Die Differenz ist damit `after − 0`, also der ABSOLUTE Marktwert des Spielers. Die Achse zaehlt
 * „Spieler mit Marktwert ueber X", nicht „Spieler, die sich entwickelt haben".
 *
 * DIE ZAHLEN NEBENEINANDER, gemessen am selben Spielstand:
 *
 *   Summe aller Attribut-Aenderungen je Spieler   median  0,5   p90  4,2   max 10,5
 *   groesste Einzelaenderung je Spieler           median  0,8   p90  2,1   max  4,3
 *   was die Achse als „Zuwachs" zaehlt            median 21,6              max 61,6
 *   Marktwerte im Spielstand heute                median 24,9              max 113,4
 *
 * Der „Zuwachs" liegt auf der Hoehe der Marktwerte, nicht der Entwicklung. Chris' „nur ein paar
 * statpoints" ist exakt richtig: der Median der gesamten Attributentwicklung einer Saison ist 0,5.
 *
 * FOLGE FUER DIE KALIBRIERUNG: die Schwelle von 6 siebt nichts aus (96 % aller Spieler reissen
 * sie), und das Ziel von 20 ist zusaetzlich strukturell unerreichbar, weil ein Kader hoechstens
 * `DEFAULT_ROSTER_MAX` = 14 Spieler fasst. Beides sind SYMPTOME derselben Ursache — eine
 * Nachkalibrierung der beiden Zahlen wuerde die kaputte Messgroesse nur anders skalieren.
 * Genau das war mein erster Entwurf zu dieser Meldung; er ist zurueckgedreht.
 *
 * DIESER TEST FIXIERT DEN BEFUND, damit er nicht durch eine erneute Kalibrierung verdeckt wird.
 * Er prueft NICHT die Zahlen 6 und 20 — die duerfen sich aendern —, sondern dass die Ursache
 * benannt bleibt, solange sie besteht.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DEFAULT_ROSTER_MAX } from "@/lib/foundation/roster-limits";

const ACHSEN = readFileSync(join(process.cwd(), "lib/sponsor/sponsor-v4-axes.ts"), "utf8");

const TALENT_JUMP = (() => {
  const start = ACHSEN.indexOf("function talentJumpCount");
  return start < 0 ? "" : ACHSEN.slice(start, ACHSEN.indexOf("\nfunction ", start + 1));
})();

describe("Der Befund: die Achse rechnet gegen einen leeren Ausgangswert", () => {
  it("die Rechnung haengt an `progressionSnapshotBefore.marketValue`", () => {
    // Die Stelle, an der der Fehler sitzt. Aendert jemand die Quelle, faellt dieser Test und die
    // Notiz darueber muss neu geprueft werden — genau so soll es sein.
    expect(TALENT_JUMP).toContain("progressionSnapshotBefore");
    expect(TALENT_JUMP).toContain("mvAfter - mvBefore >= AXIS_TALENT_JUMP_MV");
  });

  it("der Befund steht als Warnung im Quelltext, solange er besteht", () => {
    // Ohne diesen Hinweis kalibriert der naechste Durchgang wieder die Symptome. Die Meldung ist
    // namentlich genannt, damit die Messung auffindbar bleibt.
    expect(ACHSEN).toContain("u3wlh4");
    expect(ACHSEN).toContain("before.marketValue");
  });

  it("das Ziel oberhalb der Kadergrenze ist als Symptom benannt, nicht als Zahl repariert", () => {
    // Ein Kader fasst hoechstens DEFAULT_ROSTER_MAX. Das aktuelle Ziel liegt darueber — das ist
    // ein ECHTER Zweitfehler, aber er laesst sich nicht sinnvoll beziffern, solange die Messgroesse
    // selbst falsch ist. Der Test haelt fest, dass beides zusammen gehoert.
    expect(DEFAULT_ROSTER_MAX).toBe(14);
    expect(ACHSEN).toContain("DEFAULT_ROSTER_MAX");
  });
});
