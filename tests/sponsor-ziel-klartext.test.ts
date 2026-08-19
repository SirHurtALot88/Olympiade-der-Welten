/**
 * GEMELDET VON CHRIS (Screenshot der Sponsor-Karte): „Ziele müssen klarer formuliert sein — was
 * bedeutet 20 Aufstiegsstufen? Sind damit 20 SP gemeint, die die Spieler erreichen müssen, oder was?
 * Dann muss das aber auch genau angegeben sein. Und dazu: ist das brutto, ist das netto nach
 * Regression?"
 *
 * Auf der Karte stand „Entwicklung: 20Sprünge Zuwachs gegenüber dem eigenen Saisonstart". Drei
 * Fehler in einem Satz:
 *
 *  1. Die Einheit „Sprünge" sagt nicht, WAS springt. Gezählt werden Spieler, deren Marktwert um
 *     mindestens 6 steigt — nicht SP, nicht Punkte.
 *  2. „Zuwachs gegenüber dem eigenen Saisonstart" ist für diese Achse schlicht falsch: ihre
 *     `baseline` ist `() => 0`, es gibt gar keine Ausgangslage. Der Satz war ein Sammeltext für
 *     alle fünf Achsen.
 *  3. „20Sprünge" ohne Leerzeichen.
 *
 * Geprüft wird die Regel: jede Achse erklärt sich selbst, in ganzen Sätzen, ohne Programmjargon.
 */
import { describe, expect, it } from "vitest";

import { SPONSOR_V4_AXIS_KEYS, sponsorV4AxisDefinition } from "@/lib/sponsor/sponsor-v4-axes";

function renderDetail(key: (typeof SPONSOR_V4_AXIS_KEYS)[number]) {
  const definition = sponsorV4AxisDefinition(key);
  const ziel = Math.round((definition.scale - definition.offset) * 10) / 10;
  return definition.erklaerung.replace("{ziel}", `${ziel} ${definition.unit}`);
}

describe("Sponsor-Ziele erklären sich selbst", () => {
  it("jede Achse hat einen eigenen Erklärsatz mit Zielwert", () => {
    for (const key of SPONSOR_V4_AXIS_KEYS) {
      const definition = sponsorV4AxisDefinition(key);
      expect(definition.erklaerung, `${key} braucht eine Erklärung`).toBeTruthy();
      expect(definition.erklaerung, `${key}: Zielwert muss im Satz vorkommen`).toContain("{ziel}");
      // Ein Satz, kein Stichwort.
      expect(renderDetail(key).length, `${key} ist zu knapp, um etwas zu erklären`).toBeGreaterThan(60);
    }
  });

  it("keine zwei Achsen teilen sich denselben Text", () => {
    // Der alte Sammelsatz galt für alle fünf — genau das war der Fehler.
    const texts = SPONSOR_V4_AXIS_KEYS.map((key) => sponsorV4AxisDefinition(key).erklaerung);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("zwischen Zahl und Einheit steht ein Leerzeichen", () => {
    // Gemeldet als „20Sprünge".
    for (const key of SPONSOR_V4_AXIS_KEYS) {
      expect(renderDetail(key), `${key}: Zahl und Einheit kleben aneinander`).not.toMatch(/\d[A-Za-zÄÖÜäöü%]/);
    }
  });

  it("kein Programmjargon und keine Umschreibungen statt Umlauten im Nutzertext", () => {
    for (const key of SPONSOR_V4_AXIS_KEYS) {
      const text = renderDetail(key);
      for (const jargon of ["baseline", "metric", "scale", "offset", "axis"]) {
        expect(text.toLowerCase(), `${key} zeigt den Bezeichner "${jargon}"`).not.toContain(jargon);
      }
      // „muessen"/„zaehlt"/„groesser" gehören in Kommentare, nicht auf die Karte.
      expect(text, `${key}: ae/oe/ue statt Umlaut im Nutzertext`).not.toMatch(
        /\b\w*(muessen|zaehlt|gezaehlt|groesser|heisst|hoechstens|zusaetzlich|gebaeude|vertraege|haerter|boeses|eingeschaetzt)\w*\b/i,
      );
    }
  });

  it("die Entwicklungs-Achse beantwortet genau Chris' drei Fragen", () => {
    /**
     * DIE FRAGEN BLEIBEN, DIE ANTWORTEN HABEN SICH GEAENDERT (Meldung `u3wlh4`, Chris' Weg 1).
     *
     * Der Fall verlangte bis zum 19.08.2026 „Marktwert", „nicht SP" und „nach Regression" — die
     * Antworten der alten, marktwertbasierten Achse. Die misst jetzt ATTRIBUTPUNKTE, weil die
     * Marktwert-Rechnung nachweislich den absoluten Wert statt eines Zuwachses zaehlte
     * (`before.marketValue` war in allen 1017 gemessenen Ereignissen 0). „nicht SP" waere heute
     * sogar falsch: gezaehlt werden genau die Attributpunkte, die Chris „statpoints" nennt.
     *
     * Umgeschrieben statt geloescht — die Karte muss die drei Fragen weiterhin beantworten.
     */
    const text = renderDetail("entwicklung");
    // Was wird gezählt — Spieler oder Punkte?
    expect(text).toContain("Spieler");
    expect(text).toMatch(/Gezählt werden Spieler, nicht Punkte/);
    // Welche Größe?
    expect(text).toContain("Attributpunkte");
    // Brutto oder netto?
    expect(text).toMatch(/Rückschritte abgezogen/);
    // Und die Einheit selbst nennt nicht das unklare Wort „Sprünge".
    expect(sponsorV4AxisDefinition("entwicklung").unit).toBe("Spieler");
  });

  it("keine Achse behauptet mehr eine Ausgangslage, die sie nicht hat", () => {
    /**
     * `entwicklung` und `kaderpflege` messen reinen Saisonzuwachs (`baseline: () => 0`). Ein Satz
     * „gegenüber dem eigenen Saisonstart" wäre dort erfunden.
     */
    for (const key of SPONSOR_V4_AXIS_KEYS) {
      const definition = sponsorV4AxisDefinition(key);
      const hasBaseline = definition.baseline.toString().replace(/\s/g, "") !== "()=>0";
      if (!hasBaseline) {
        expect(definition.erklaerung, `${key} hat keine Ausgangslage, darf aber keine behaupten`).not.toContain(
          "Vertragsabschluss",
        );
      }
    }
  });
});
