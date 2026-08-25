/**
 * GEMELDET (Chris, `ihcjoz`, Seite „Spieltag · Battle Arena"): „heal fehlt noch komplett dass man
 * sieht wen man geheilt hat." Schaden, Betäubung und KOs hatten schon eine Adresse — der
 * Endscreen zeigt beim Hover über die jeweilige Spalte, GEGEN WEN das passiert ist
 * (`GEGENFELD`, `gegenZaehler`). Heilung nicht: die Spalte „H" zeigte nur die Summe.
 *
 * URSACHE, belegt in `public/mockups/battle-mode.engine.js`:
 *   - `GEGENFELD` (Zeile ~8566) kannte kein `heal`-Feld, obwohl `u.st.gegen[name]` das
 *     passende `heil`-Feld laengst im Default-Objekt haette tragen koennen.
 *   - Beide Stellen, an denen geheilt wird (Flaechenzauber ~Zeile 6132, Standardheiler
 *     ~Zeile 6618), erhoehten `u.st.heal`, riefen aber nie `gegenZaehler(...)` auf — anders
 *     als jede andere Wirkung (Schaden, Betaeubung, KO), die das an ihrer jeweiligen Stelle
 *     tut.
 *
 * WARUM DIESE DATEI KEIN GEWOEHNLICHER IMPORT-TEST IST. `battle-mode.engine.js` ist ein
 * einziges grosses IIFE fuer den Browser, das beim Laden sofort auf `document` zugreift — es
 * laesst sich nicht wie ein ES-Modul importieren, und keine seiner ~9000 Zeilen ist exportiert.
 * `gegenZaehler` selbst ist aber vollstaendig selbststaendig (keine Closure-Variablen ausser den
 * eigenen Parametern) — dieser Test liest ihren ECHTEN Quelltext aus der Datei und fuehrt ihn
 * isoliert aus, statt die Logik hier nachzubauen. Eine Nachbildung wuerde nur beweisen, dass
 * MEINE Kopie stimmt, nicht die im Spiel ausgelieferte.
 *
 * GEGENPROBE: mit dem alten `GEGENFELD` (ohne `heal:"heil"`) faellt der erste Fall, weil die
 * Spalte dann nie aufgeschluesselt wuerde — genau der gemeldete Zustand.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const QUELLTEXT = readFileSync(join(process.cwd(), "public/mockups/battle-mode.engine.js"), "utf8");

/** Schneidet eine benannte Funktion (einfache, unverschachtelte Klammerung) aus dem Quelltext. */
function schneideFunktion(name: string): string {
  const anker = `function ${name}(`;
  const start = QUELLTEXT.indexOf(anker);
  expect(start, `${anker} nicht in battle-mode.engine.js gefunden`).toBeGreaterThan(-1);
  const ende = QUELLTEXT.indexOf("\n  }\n", start);
  expect(ende, `Ende von ${name} nicht gefunden`).toBeGreaterThan(-1);
  return QUELLTEXT.slice(start, ende + 4);
}

/** Wertet die ausgeschnittene Funktion aus und gibt sie als aufrufbare Funktion zurueck. */
function ladeGegenZaehler(): (u: unknown, name: string, feld: string, wert: number) => void {
  const quelle = schneideFunktion("gegenZaehler");
  // eslint-disable-next-line no-new-func -- bewusst: fuehrt den ECHTEN Funktionstext aus, siehe Kopfkommentar.
  return new Function(`"use strict"; return (${quelle});`)();
}

function ladeGegenfeld(): Record<string, string> {
  const treffer = /const GEGENFELD=(\{[^}]*\});/.exec(QUELLTEXT);
  expect(treffer, "GEGENFELD nicht im erwarteten Format gefunden").not.toBeNull();
  // eslint-disable-next-line no-new-func -- dieselbe Begruendung: der echte Objekt-Literal-Text.
  return new Function(`"use strict"; return (${treffer![1]});`)();
}

describe("Battle Arena · Heilung bekommt eine Adresse", () => {
  it("kennt jetzt ein GEGENFELD fuer die Heal-Spalte", () => {
    const gegenfeld = ladeGegenfeld();
    expect(gegenfeld.heal).toBe("heil");
    // Die bestehenden drei bleiben unangetastet — Schaden/CC/KO durften durch den Fix nicht
    // verschwinden.
    expect(gegenfeld).toMatchObject({ ko: "ko", cc: "cc", dmg: "dmg", tank: "erl" });
  });

  it("gegenZaehler traegt Heilung genauso ein wie Schaden — dieselbe Funktion, echter Quelltext", () => {
    const gegenZaehler = ladeGegenZaehler();
    const heiler = { st: { gegen: {} as Record<string, Record<string, number>> } };

    gegenZaehler(heiler, "Johanna", "heil", 16);
    gegenZaehler(heiler, "Johanna", "heil", 9);
    gegenZaehler(heiler, "Draco", "dmg", 40);

    expect(heiler.st.gegen["Johanna"]?.heil).toBe(25);
    // Das Default-Objekt traegt jetzt `heil:0` fuer JEDEN neu angelegten Gegner-Eintrag —
    // auch wenn der erste Aufruf fuer diesen Namen ein anderes Feld war (hier: dmg).
    expect(heiler.st.gegen["Draco"]?.heil).toBe(0);
    expect(heiler.st.gegen["Draco"]?.dmg).toBe(40);
  });

  it("laesst einen Aufruf ohne st-Objekt unbeanstandet — dieselbe Wache wie fuer dmg/cc/ko", () => {
    const gegenZaehler = ladeGegenZaehler();
    expect(() => gegenZaehler(null, "X", "heil", 5)).not.toThrow();
    expect(() => gegenZaehler({}, "X", "heil", 5)).not.toThrow();
  });

  it("verdrahtet gegenZaehler an BEIDEN Stellen, an denen geheilt wird", () => {
    // Die Aufrufe selbst laufen ueber viele Simulationsschritte und sind hier nicht sinnvoll
    // isoliert auszufuehren (KI-Bewegung, Zufalls-Seeds, Kampfschleife) — dieselbe Grenze wie
    // bei den vier Faellen oben, wo nur die reine Buchfuehrung isoliert laeuft. Dass die
    // beiden Call-Sites den Zaehler wirklich aufrufen, ist eine Quelltext-Eigenschaft.
    // `e.art==="heilung"` kommt DREIMAL im Quelltext vor (Bewertungsfunktion, KI-Vorschau,
    // und hier die eigentliche Wirkung) — der Anker muss die tatsaechliche Heilschleife
    // treffen, sonst findet der Fall den falschen Treffer und meldet einen Fehler, der nichts
    // ueber den gemeldeten Bug aussagt. Genau das ist beim ersten Anlauf passiert.
    const flaechenzauber = QUELLTEXT.indexOf('if(e.art==="heilung"){\n        for(const z of ziele)');
    const standardheiler = QUELLTEXT.indexOf("if(u.heiler&&u.retreat<=0&&u.cd<=0){");
    expect(flaechenzauber, "Flaechenzauber-Heilung nicht gefunden").toBeGreaterThan(-1);
    expect(standardheiler, "Standardheiler nicht gefunden").toBeGreaterThan(-1);

    const flaechenzauberBlock = QUELLTEXT.slice(flaechenzauber, flaechenzauber + 400);
    const standardheilerBlock = QUELLTEXT.slice(standardheiler, standardheiler + 700);
    expect(flaechenzauberBlock).toContain('gegenZaehler(u,z.n,"heil",echt)');
    expect(standardheilerBlock).toContain('gegenZaehler(u,ziel.n,"heil",echt)');
  });
});
