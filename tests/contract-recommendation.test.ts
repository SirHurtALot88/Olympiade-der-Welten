/**
 * DIE EMPFEHLUNG DARF NICHT GLATTZIEHEN, WAS SICH WIDERSPRICHT.
 *
 * Der teuerste Vertrag im Kader kann derjenige sein, dessen Verkauf gerade Wert verbrennt. Eine
 * Empfehlung, die daraus "verkaufen" macht, ist bequem und falsch — und wer ihr einmal folgt und
 * Geld verliert, glaubt ihr auch bei den einfachen Faellen nicht mehr. Deshalb steht der
 * Konflikt-Test hier an erster Stelle.
 */
import { describe, expect, it } from "vitest";

import { bewerteGehalt, buildSalaryBenchmark } from "@/lib/contracts/salary-benchmark";
import { empfehleVertrag, istBindungsrisiko } from "@/lib/contracts/contract-recommendation";

/**
 * Eine Liga, in der Gehalt und Leistung ueberhaupt zusammenhaengen: Gehalt ≈ 8 + 0,6 × Leistung.
 * Das ist die Lage, fuer die die Kennzahl gebaut ist — ligaweit, nicht aus acht Vertraegen.
 */
const LIGA = Array.from({ length: 40 }, (_, index) => {
  const leistung = 1 + index * 0.5;
  const rauschen = ((index % 5) - 2) * 0.4;
  return { salary: Number((8 + 0.6 * leistung + rauschen).toFixed(2)), leistung };
});
const MODELL = buildSalaryBenchmark(LIGA);

function fuer(salary: number, leistung: number) {
  return bewerteGehalt(MODELL, { salary, leistung });
}

/**
 * Der echte Kader aus dem Design-Vorschlag — acht Vertraege, in denen das Gehalt praktisch NICHT
 * an der Leistung haengt (Spanne 11–16 bei Leistungen von 1 bis 21).
 */
const KLEINER_KADER = buildSalaryBenchmark([
  { salary: 16, leistung: 20.9 },
  { salary: 13, leistung: 11.5 },
  { salary: 14, leistung: 9 },
  { salary: 14, leistung: 7.5 },
  { salary: 11, leistung: 6.1 },
  { salary: 12, leistung: 6 },
  { salary: 15, leistung: 4.5 },
  { salary: 14, leistung: 1 },
]);

describe("empfehleVertrag", () => {
  it("haelt den Konflikt aus: zu teuer, aber Verkauf unter Wert → beobachten, nicht abgeben", () => {
    // Schwacher Spieler auf Spitzengehalt, dessen Marktpreis eingebrochen ist.
    const ergebnis = empfehleVertrag({
      gehalt: fuer(18, 4),
      vk: 34.3,
      marktwert: 52.8,
      restlaufzeit: 3,
      moral: 52,
      intent: "verlängerungsbereit",
    });
    expect(ergebnis.empfehlung).toBe("beobachten");
    expect(ergebnis.begruendung).toContain("unter Marktwert");
    expect(ergebnis.begruendung).toContain("nicht verlängern");
  });

  it("empfiehlt abgeben, wenn Kosten und Verkaufslage in dieselbe Richtung zeigen", () => {
    const ergebnis = empfehleVertrag({
      gehalt: fuer(18, 4),
      vk: 53.8,
      marktwert: 50.6,
      restlaufzeit: 3,
      moral: 59,
      intent: "verlängerungsbereit",
    });
    expect(ergebnis.empfehlung).toBe("abgeben");
    expect(ergebnis.begruendung).toContain("über Marktwert");
  });

  it("nennt ein Bindungsrisiko ausdruecklich KEIN Kostenproblem", () => {
    // Bester Spieler, wirtschaftlich unauffaellig, aber Moral 41 und "nur kurz binden".
    const ergebnis = empfehleVertrag({
      gehalt: fuer(20, 20),
      vk: 60.5,
      marktwert: 60.5,
      restlaufzeit: 3,
      moral: 41,
      intent: "nur kurz binden",
    });
    expect(ergebnis.empfehlung).toBe("beobachten");
    expect(ergebnis.begruendung).toContain("kein Kostenproblem");
  });

  it("empfiehlt frueh zu verlaengern, wo der Vertrag guenstig ist", () => {
    const ergebnis = empfehleVertrag({
      gehalt: fuer(11, 15),
      vk: 47.2,
      marktwert: 48,
      restlaufzeit: 3,
      moral: 57,
      intent: "verlängerungsbereit",
    });
    expect(ergebnis.empfehlung).toBe("verlaengern");
    expect(ergebnis.begruendung).toContain("weniger als für diese Leistung üblich");
  });

  it("weist auf die auslaufende Restlaufzeit hin, statt sie zu verschweigen", () => {
    const ergebnis = empfehleVertrag({
      gehalt: fuer(13.4, 9),
      vk: 58.5,
      marktwert: 58.5,
      restlaufzeit: 1,
      moral: 53,
      intent: "verlängerungsbereit",
    });
    expect(ergebnis.empfehlung).toBe("verlaengern");
    expect(ergebnis.begruendung).toContain("läuft aus");
  });

  it("bleibt zurueckhaltend, wo der Markt Gehalt und Leistung gar nicht koppelt", () => {
    // Die acht echten Vertraege: Gehaltsspanne 11–16 bei Leistungen von 1 bis 21. Das Modell
    // findet dort kaum eine Steigung — und sagt deshalb ueber den schwaechsten Spieler NICHT,
    // er sei zu teuer. Das ist gewollt: in einem Kader, der ohnehin fast alle gleich bezahlt,
    // ist Schwaeche kein Beleg fuer Ueberbezahlung. Belastbar wird die Aussage erst ligaweit.
    const schwaechster = empfehleVertrag({
      gehalt: bewerteGehalt(KLEINER_KADER, { salary: 14, leistung: 1 }),
      vk: 53.8,
      marktwert: 50.6,
      restlaufzeit: 3,
      moral: 59,
      intent: "verlängerungsbereit",
    });
    expect(schwaechster.gehaltsEinordnung).toBe("ueblich");
    expect(schwaechster.empfehlung).not.toBe("abgeben");
  });

  it("sagt ohne Vergleichswerte, dass es nichts sagen kann", () => {
    const ergebnis = empfehleVertrag({
      gehalt: null,
      vk: 30,
      marktwert: 30,
      restlaufzeit: 2,
      moral: 60,
      intent: "verlängerungsbereit",
    });
    expect(ergebnis.empfehlung).toBe("beobachten");
    expect(ergebnis.begruendung).toContain("Noch keine Vergleichswerte");
    expect(ergebnis.gehaltsEinordnung).toBeNull();
  });

  it("empfiehlt einem schwachen, aber billigen Spieler NICHT den Abgang", () => {
    // Der Kern der ganzen Umstellung: Schwaeche allein ist kein wirtschaftlicher Grund.
    // Derselbe Spieler waere nach dem alten Quotienten (Gehalt/Leistung = 4,7) der mit Abstand
    // schlechteste Wert im Kader gewesen — hier ist er schlicht guenstig.
    const ergebnis = empfehleVertrag({
      gehalt: fuer(7, 1.5),
      vk: 20,
      marktwert: 20,
      restlaufzeit: 3,
      moral: 60,
      intent: "verlängerungsbereit",
    });
    expect(ergebnis.gehaltsEinordnung).not.toBe("teuer");
    expect(ergebnis.empfehlung).not.toBe("abgeben");
  });

  it("rechnet die VK-Abweichung mit, auch wenn sie die Empfehlung nicht dreht", () => {
    const ergebnis = empfehleVertrag({
      gehalt: fuer(14.9, 11.5),
      vk: 52.6,
      marktwert: 52.2,
      restlaufzeit: 3,
      moral: 56,
      intent: "verlängerungsbereit",
    });
    expect(ergebnis.vkAbweichung).toBeCloseTo(0.4, 2);
  });
});

describe("istBindungsrisiko", () => {
  it("erkennt kurze Bindungswuensche und schlechte Moral", () => {
    expect(istBindungsrisiko("nur kurz binden", 70)).toBe(true);
    expect(istBindungsrisiko("will wechseln", 70)).toBe(true);
    expect(istBindungsrisiko("verlängerungsbereit", 30)).toBe(true);
  });

  it("erfindet aus einer unbekannten Formulierung kein Risiko", () => {
    expect(istBindungsrisiko("verlängerungsbereit", 70)).toBe(false);
    expect(istBindungsrisiko(null, 70)).toBe(false);
    expect(istBindungsrisiko(null, null)).toBe(false);
  });
});
