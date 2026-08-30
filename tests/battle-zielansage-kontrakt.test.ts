/**
 * ZIELANSAGE / FOKUSFEUER im Kampf-Modus — die Regeln, die man beim Umbauen still
 * kaputtmacht.
 *
 * Wie bei `battle-arena-heal-attribution.test.ts` gilt: `battle-mode.engine.js` ist ein
 * einziges browsergebundenes IIFE, das beim Laden sofort auf `document` zugreift — es
 * laesst sich nicht importieren, und nichts darin ist exportiert. Geprueft wird deshalb
 * der ECHTE Quelltext der drei Dateien gegeneinander. Das trifft genau die Fehlerklasse,
 * die hier real droht: Motor, Huelle und Stilblatt liegen in DREI Dateien, und wer in
 * einer davon eine Kennung umbenennt, merkt es sonst erst, wenn im Spiel nichts passiert.
 *
 * Die Verhaltensabnahme (wirkt die Ansage? bleibt der Kampf ohne Ansage bit-identisch?)
 * laeuft nicht hier, sondern ueber `window.__arena.zielansageLauf(...)` im Browser — die
 * Zahlen dazu stehen als Tabelle am Kommentar von KF_RUF im Motor.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const MOTOR = readFileSync(join(process.cwd(), "public/mockups/battle-mode.engine.js"), "utf8");
const HUELLE = readFileSync(join(process.cwd(), "public/mockups/battle-mode.html"), "utf8");
const STIL = readFileSync(join(process.cwd(), "public/mockups/battle-mode.css"), "utf8");

describe("Battle Arena · Zielansage", () => {
  it("findet jedes Element, das die Zielansage anspricht, auch in der Huelle", () => {
    for (const id of ["fokuszeile", "fokustext", "ansageweg", "ansageuhr", "ansageuhrzahl", "kaderR", "cv"]) {
      expect(MOTOR, `#${id} wird im Motor nicht mehr angesprochen`).toContain(`"${id}"`);
      expect(HUELLE, `#${id} fehlt in battle-mode.html`).toContain(`id="${id}"`);
    }
  });

  it("kennt im Stilblatt jede Klasse, die der Motor auf eine Kaderkachel setzt", () => {
    for (const klasse of ["ansage", "gesperrt", "waehlbar"]) {
      expect(MOTOR, `.${klasse} wird nicht mehr gesetzt`).toContain(`classList.add("${klasse}")`);
      expect(STIL, `.kk.${klasse} fehlt in battle-mode.css`).toContain(`.kk.${klasse}`);
    }
    // Der Klick-Weg ueber die Kaderleiste haengt an genau diesem data-Attribut — und
    // bewusst an einem ANDEREN als beim Basketball-Fokus (data-fokusid), damit sich die
    // beiden Mechaniken nicht gegenseitig auslesen koennen.
    expect(MOTOR).toContain('.kk[data-ansageid]');
    expect(MOTOR).toContain("k.dataset.ansageid");
    expect(MOTOR).toContain('.kk[data-fokusid]');
  });

  it("traegt auf der Leinwand und im Stilblatt denselben Signalton", () => {
    const motorFarbe = /const FOKUS_FARBE="(#[0-9a-fA-F]{3,8})"/.exec(MOTOR);
    const stilFarbe = /--fokus:\s*(#[0-9a-fA-F]{3,8})/.exec(STIL);
    expect(motorFarbe, "FOKUS_FARBE nicht gefunden").not.toBeNull();
    expect(stilFarbe, "--fokus nicht gefunden").not.toBeNull();
    expect(stilFarbe![1].toLowerCase()).toBe(motorFarbe![1].toLowerCase());
    // Ring, Ziellinien, Ruf und Kachel muessen sich aus DERSELBEN Konstante bedienen;
    // ein zweiter, handgeschriebener Farbwert waere genau die Stelle, an der Feld und
    // Leiste spaeter auseinanderlaufen.
    expect(MOTOR.split("FOKUS_FARBE").length - 1).toBeGreaterThanOrEqual(6);
  });

  it("setzt die Ansage in chooseTarget hinter den Durchbruch und vor den Offensivzwang", () => {
    const start = MOTOR.indexOf("function chooseTarget(u){");
    expect(start, "chooseTarget nicht gefunden").toBeGreaterThan(-1);
    const koerper = MOTOR.slice(start, start + 9000);
    const durchbruch = koerper.indexOf("if(u.durch&&u.tgt&&!u.tgt.down)return u.tgt;");
    const ansage = koerper.indexOf("if(angesagt)return angesagt;");
    const zwang = koerper.indexOf("if(u.zwang)return nearest(foes);");
    expect(durchbruch).toBeGreaterThan(-1);
    expect(ansage).toBeGreaterThan(-1);
    expect(zwang).toBeGreaterThan(-1);
    // Wer im Durchbruch ist, hoert den Ruf nicht — das ist die Bindung aus der
    // Aufstellung und muss vor der Ansage stehen bleiben.
    expect(ansage).toBeGreaterThan(durchbruch);
    // Der Offensivzwang ist der Fall "keine Befehle mehr". Eine Ansage IST ein Befehl und
    // gehoert deshalb davor: sonst waere die Mechanik im Endspiel (dort gilt der Zwang
    // fuer alle) genau dann wirkungslos, wenn sie am meisten zaehlt.
    expect(ansage).toBeLessThan(zwang);
  });

  it("stellt die Ansage bei jedem Aufbau zurueck, bevor die Disziplin-Weichen greifen", () => {
    const start = MOTOR.indexOf("function build(saat){");
    expect(start).toBeGreaterThan(-1);
    const kopf = MOTOR.slice(start, start + 900);
    const zuruecksetzen = kopf.indexOf("KFOKUS=null; KFOKUS_CD=0;");
    const ersteWeiche = kopf.indexOf("if(istFeldspiel(disc))");
    expect(zuruecksetzen, "build() setzt die Ansage nicht mehr zurueck").toBeGreaterThan(-1);
    // Vor den Weichen, sonst schleppt ein Wechsel der Disziplin die Ansage aus dem
    // vorigen Kampf mit — build() kehrt fuer Feldspiel/Buehne/Bahn vorher zurueck.
    expect(zuruecksetzen).toBeLessThan(ersteWeiche);
  });

  it("laesst die Sperre in Kampfzeit ablaufen, nicht in Echtzeit", () => {
    const start = MOTOR.indexOf("function stepSim(dt){");
    expect(start).toBeGreaterThan(-1);
    const koerper = MOTOR.slice(start, start + 2000);
    // dt ist die Simulationszeit; das Tempo (1x/2x/4x) darf nicht heimlich bestimmen,
    // wie oft eingegriffen werden darf.
    expect(koerper).toContain("KFOKUS_CD=Math.max(0,KFOKUS_CD-dt)");
  });

  it("fasst den Basketball-Fokus nicht an", () => {
    // Die vier Traeger von PR #685 muessen unveraendert dastehen — die Zielansage ist eine
    // zweite Mechanik daneben, kein Umbau der ersten.
    for (const anker of [
      "function fokusAuswahlMoeglich(){",
      "function fokusUmschalten(id){",
      "function renderFokusZeile(){",
      "function verdrahteFokusAuswahl(){",
    ]) {
      expect(MOTOR, `${anker} ist verschwunden`).toContain(anker);
    }
    expect(HUELLE).toContain('id="fokusweg"');
  });
});
