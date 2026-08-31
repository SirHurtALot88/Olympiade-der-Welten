/**
 * RENNPLAN-ANSAGE auf dem Bahn-Chassis: den Plan eines eigenen Laeufers MITTEN IM RENNEN
 * wechseln (Gegenstueck zum Fokus-Doppeln im Basketball, PR #685).
 *
 * WAS HIER GEPRUEFT WIRD, und warum ausgerechnet das:
 *
 *  1. DIE `ab`-KLEMME. `ab` ist der Angriffspunkt — eine POSITION im Rennverlauf, keine
 *     Fahne: `planT = pos>=ab ? 1.0 : tempo` wird je Tick neu ausgewertet. Beim Wechsel
 *     zerfaellt das deshalb in zwei Faelle, und nur einer davon ist heikel:
 *       - noch nicht angegangen  -> der neue Angriffspunkt gilt unveraendert;
 *       - schon angegangen       -> ein Plan mit SPAETEREM Angriffspunkt darf den Antritt
 *         nicht zurueckdrehen. Ohne Klemme wuerde ein Laeufer, der bei 74 % laengst
 *         sprintet, durch die Ansage "Windschatten" (ab 0.78) wieder auf Sparflamme
 *         gehen — der neue Plan wirkte rueckwaerts in eine Strecke, die schon gelaufen ist.
 *     GEGENPROBE: nimmt man in planWechsel die Zeile `u.ab=schonAngegangen?...` heraus und
 *     setzt stur `u.ab=p.ab`, faellt der dritte Fall unten.
 *
 *  2. DASS ES ALLE FUENF BAHNEN TRAEGT. Der Wechsel schreibt genau die drei Felder, die
 *     tempoVon()/stepSpurt lesen (tempo, sucht, ab). Fehlt einer Bahn eines davon in
 *     ihren Plaenen, waere der Wechsel dort ein stiller Teil-Wechsel — deshalb wird die
 *     Vollstaendigkeit von BAHN_ART[*].plaene geprueft und nicht nur die von Spurt.
 *
 *  3. DASS DAS SICHTBARE FEEDBACK AN DER QUELLE HAENGT. Chris' wichtigstes Kriterium ist
 *     nicht die Zahlenbalance, sondern dass man den Wechsel SIEHT. Das Label ueber dem
 *     Kopf muss aus `BA().plaene[u.plan]` gelesen werden (dann steht der neue Name im
 *     selben Bild da), und der Ruf muss ueber schwebe() an den Laeufer geheftet sein.
 *
 * WARUM DIESE DATEI KEIN GEWOEHNLICHER IMPORT-TEST IST: `battle-mode.engine.js` ist ein
 * einziges grosses IIFE fuer den Browser, das beim Laden sofort auf `document` zugreift —
 * es laesst sich nicht als ES-Modul importieren, und nichts darin ist exportiert. Deshalb
 * dasselbe Vorgehen wie in tests/battle-arena-heal-attribution.test.ts: der ECHTE
 * Funktionstext wird aus der Datei geschnitten und isoliert ausgefuehrt. Eine Nachbildung
 * wuerde nur beweisen, dass MEINE Kopie stimmt, nicht die im Spiel ausgelieferte.
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

type Laeufer = {
  plan: string; tempo: number; sucht: number; ab: number; pos: number;
  label?: string; text?: string; ansagen?: number; ansageBei?: number;
};
type Plan = { label: string; tempo: number; sucht: number; ab: number; text: string };

/**
 * Laedt planWechsel mit einer vorgegebenen Plantabelle. `BA` und `rennT` sind die einzigen
 * beiden Namen, die die Funktion aus ihrer Umgebung liest — sie werden hier eingereicht,
 * der Funktionskoerper selbst bleibt der echte.
 */
function ladePlanWechsel(plaene: Record<string, Plan>, rennT = 4.2) {
  const quelle = schneideFunktion("planWechsel");
  // eslint-disable-next-line no-new-func -- bewusst: fuehrt den ECHTEN Funktionstext aus, siehe Kopfkommentar.
  const bau = new Function("BA", "rennT", `"use strict"; return (${quelle});`);
  return bau(() => ({ plaene }), rennT) as (u: Laeufer, planId: string) => boolean;
}

/** Die Plantabelle des Spurts, wortgleich aus BAHN_ART gelesen statt hier nachgebaut. */
function spurtPlaene(): Record<string, Plan> {
  const block = /spurt:\{[\s\S]*?plaene:\{([\s\S]*?)\n {6}\},\n {6}planJeSlot/.exec(QUELLTEXT);
  expect(block, "Spurt-Plaene nicht im erwarteten Format gefunden").not.toBeNull();
  // eslint-disable-next-line no-new-func -- derselbe Grund: der echte Objekt-Literal-Text.
  return new Function(`"use strict"; return ({${block![1]}});`)();
}

describe("Bahn · Rennplan-Ansage", () => {
  it("liest die Plaene aus BAHN_ART — Spurt hat Von vorn / Windschatten / Schlusssprint", () => {
    const P = spurtPlaene();
    expect(Object.keys(P)).toEqual(["vorn", "schatten", "kick"]);
    expect(P.vorn.label).toBe("Von vorn");
    expect(P.schatten.label).toBe("Windschatten");
    expect(P.kick.label).toBe("Schlusssprint");
  });

  it("schreibt beim Wechsel genau die Felder, die der Motor je Tick liest", () => {
    const P = spurtPlaene();
    const wechsel = ladePlanWechsel(P, 4.2);
    const u: Laeufer = { plan: "schatten", ...P.schatten, pos: 0.30 };

    expect(wechsel(u, "kick")).toBe(true);
    expect(u.plan).toBe("kick");
    expect(u.tempo).toBe(P.kick.tempo);
    expect(u.sucht).toBe(P.kick.sucht);
    expect(u.ab).toBe(P.kick.ab);
    // Fuer die Anzeige: WIE OFT umgestellt wurde und WANN zuletzt (Nachleuchten am Kopf).
    expect(u.ansagen).toBe(1);
    expect(u.ansageBei).toBe(4.2);
  });

  it("wechselt nicht auf denselben Plan und nicht auf einen, den die Bahn nicht kennt", () => {
    const P = spurtPlaene();
    const wechsel = ladePlanWechsel(P);
    const u: Laeufer = { plan: "vorn", ...P.vorn, pos: 0.10 };

    expect(wechsel(u, "vorn")).toBe(false);
    expect(wechsel(u, "gleich")).toBe(false); // Zeitfahren-Plan, auf dem Spurt sinnlos
    expect(u.ansagen).toBeUndefined();
    expect(u.ab).toBe(P.vorn.ab);
  });

  it("dreht einen schon begonnenen Antritt NICHT zurueck (die ab-Klemme)", () => {
    const P = spurtPlaene();
    const wechsel = ladePlanWechsel(P);
    // Bei 74 % der Strecke und "Von vorn" (ab 0.70) ist er laengst unterwegs.
    const u: Laeufer = { plan: "vorn", ...P.vorn, pos: 0.74 };

    expect(wechsel(u, "schatten")).toBe(true);
    // Ohne Klemme stuende hier 0.78 — und der Laeufer fiele mitten im Sprint auf
    // Sparflamme zurueck, weil planT wieder u.tempo statt 1.0 waere.
    expect(u.ab).toBe(0.74);
    expect(u.ab).toBeLessThan(P.schatten.ab);
    // tempo/sucht des neuen Plans gelten trotzdem — er sucht ab jetzt wieder Sog.
    expect(u.sucht).toBe(P.schatten.sucht);
  });

  it("laesst einen noch nicht begonnenen Antritt beim Planwert — auch nach hinten", () => {
    const P = spurtPlaene();
    const wechsel = ladePlanWechsel(P);
    const u: Laeufer = { plan: "vorn", ...P.vorn, pos: 0.30 };

    expect(wechsel(u, "schatten")).toBe(true);
    expect(u.ab).toBe(P.schatten.ab); // 0.78, unveraendert nach hinten geschoben
  });

  it("laesst eine Ansage sofort greifen, wenn der neue Angriffspunkt schon hinter ihm liegt", () => {
    const P = spurtPlaene();
    const wechsel = ladePlanWechsel(P);
    // Bei 90 % mit "Windschatten" (ab 0.78) sprintet er schon; "Schlusssprint" (ab 0.62)
    // liegt weit hinter ihm. Das ist keine Rueckwirkung, sondern die Ansage "jetzt" —
    // nachgezahlt wird nichts, weil Verbrauch und Tempo je Tick neu entstehen.
    const u: Laeufer = { plan: "schatten", ...P.schatten, pos: 0.90 };
    expect(wechsel(u, "kick")).toBe(true);
    expect(u.ab).toBeLessThanOrEqual(u.pos);
    expect(u.tempo).toBe(P.kick.tempo);
  });

  it("deckt alle fuenf Bahnen ab: jede fuehrt Plaene mit tempo, sucht und ab", () => {
    const bahnen = ["spurt", "time-trial", "climbing", "staffel", "takeshis-castle"];
    for (const bahn of bahnen) {
      const anker = QUELLTEXT.indexOf(`\n    ${bahn.includes("-") ? `"${bahn}"` : bahn}:{`);
      expect(anker, `${bahn} nicht in BAHN_ART gefunden`).toBeGreaterThan(-1);
      // Ab dem Anker bis zum Dateiende und dann NICHT-GIERIG suchen: die Bloecke sind
      // unterschiedlich lang (time-trial traegt allein ueber 12 kB Herleitung), eine
      // feste Fensterbreite waere geraten statt gemessen.
      const block = QUELLTEXT.slice(anker);
      const treffer = /plaene:\{([\s\S]*?)\n {6}\},\n {6}planJeSlot/.exec(block);
      expect(treffer, `${bahn}: plaene-Block nicht gefunden`).not.toBeNull();
      // eslint-disable-next-line no-new-func -- derselbe Grund wie oben.
      const P: Record<string, Plan> = new Function(`"use strict"; return ({${treffer![1]}});`)();
      const ids = Object.keys(P);
      expect(ids.length, `${bahn} sollte drei Plaene haben`).toBe(3);
      for (const id of ids) {
        expect(typeof P[id].label, `${bahn}.${id}.label`).toBe("string");
        expect(typeof P[id].tempo, `${bahn}.${id}.tempo`).toBe("number");
        expect(typeof P[id].sucht, `${bahn}.${id}.sucht`).toBe("number");
        expect(typeof P[id].ab, `${bahn}.${id}.ab`).toBe("number");
      }
      // Und der Wechsel funktioniert mit DIESER Tabelle genauso wie mit der des Spurts.
      const wechsel = ladePlanWechsel(P);
      const [erst, zweit] = ids;
      const u: Laeufer = { plan: erst, ...P[erst], pos: 0 };
      expect(wechsel(u, zweit), `${bahn}: Wechsel ${erst} -> ${zweit}`).toBe(true);
      expect(u.ab).toBe(P[zweit].ab);
    }
  });
});

describe("Bahn · Rennplan-Ansage, das sichtbare Feedback", () => {
  it("liest das Label ueber dem Kopf je Bild aus BA().plaene[u.plan]", () => {
    // Genau deshalb steht der neue Plan im SELBEN Bild ueber dem Kopf, in dem der Wechsel
    // zugewiesen wurde — es gibt keinen zwischengespeicherten Namen, der veralten koennte.
    expect(QUELLTEXT).toContain('const pl=((BA().plaene)[u.plan]||{}).label||"";');
    // Und das Nachleuchten haengt an derselben Rennuhr, die planWechsel stempelt.
    expect(QUELLTEXT).toContain("const frisch=u.ansageBei!=null&&(rennT-u.ansageBei)<ANSAGE_NACHLEUCHTEN;");
  });

  it("ruft den neuen Plan als Schwebetext ueber dem Laeufer aus", () => {
    const quelle = schneideFunktion("rennplanAnsagen");
    expect(quelle).toContain('txt:p.label.toUpperCase()+"!"');
    expect(quelle).toContain("ansage:true");
    expect(quelle).toContain("_laeufer:u.id");   // am Laeufer verankert, nicht an festen Koordinaten
    expect(quelle).toContain("feed(0,");         // und im Ticker, mit Streckenmarke
  });

  it("zeichnet Schwebetexte auf der Bahn ueberhaupt — vorher fielen sie unter den Tisch", () => {
    // draw() springt fuer die Bahn mit `return` in zeichneSpurt; die Schleife ueber floats
    // stand nur im Kampf-, Feldspiel- und Buehnen-Zweig. Ohne diese Schleife bliebe der
    // Ansage-Ruf unsichtbar — und mit ihm "stolpert", "getackelt", "eingebrochen".
    const quelle = schneideFunktion("zeichneSpurt");
    expect(quelle).toContain("for(const f of floats)");
    expect(quelle).toContain("f._laeufer");
  });

  it("laesst nur die EIGENE Seite ansagen — der Gegner ist nicht ansprechbar", () => {
    const waehlen = schneideFunktion("rennplanWaehlen");
    expect(waehlen).toContain("x.seite===0");
    expect(waehlen).toContain("x.fertig==null");
    const ansagen = schneideFunktion("rennplanAnsagen");
    expect(ansagen).toContain("u.seite!==0");
  });

  it("baut kein zweites Kostenmodell auf den Wechsel", () => {
    // Der Preis steht schon in reserve/nerven: ein falscher Plan verbrennt beides
    // schneller. Ein Kontingent oder eine Abklingzeit wuerde dieselbe Sache doppelt
    // berechnen — planWechsel darf deshalb weder zaehlen noch sperren.
    const quelle = schneideFunktion("planWechsel");
    expect(quelle).not.toMatch(/cooldown|Cd\b|kontingent|Kontingent/i);
    expect(quelle).not.toContain("reserve");
    expect(quelle).not.toContain("nerven");
    // Und er wuerfelt nicht: der Wechsel ist eine Zuweisung, damit ein Rennen ohne
    // Eingriff Tick fuer Tick derselbe bleibt wie vorher.
    expect(quelle).not.toContain("rr()");
    expect(quelle).not.toContain("Math.random");
  });
});
