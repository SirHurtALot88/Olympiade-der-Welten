import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  HAUPT_LEINWAND,
  MOTOR_EINSTIEG_JE_CHASSIS,
  NachgebildeteLeinwand,
  NachgebildetesBild,
  baueMotorKontext,
  leerlaufKnoten,
  ladeMotorSkripte,
} from "@/lib/battle/arena-node-motor.mjs";
import { ARENA_CHASSIS_MOTOR_EINSTIEG } from "@/lib/battle/arena-headless-runner";

/**
 * QUICK-SIM (27.10.): die Browser-Nachbildung, mit der `arena-node-motor.mjs` den Arena-Motor ohne
 * Chromium laedt. Diese Datei prueft die Nachbildung selbst (schnell, ohne Spielstand); ob die
 * Ergebnisse zu Chromium passen, prueft `arena-node-runner-paritaet.test.ts`.
 */

const MOCKUPS = path.resolve(process.cwd(), "public", "mockups");

describe("arena-node-motor · Leinwand", () => {
  it("liefert echte Pixelpuffer in der angefragten Groesse", () => {
    const leinwand = new NachgebildeteLeinwand(128, 64);
    const ctx = leinwand.getContext("2d")!;
    const bild = ctx.getImageData(0, 0, 128, 64);
    expect(bild.data).toBeInstanceOf(Uint8ClampedArray);
    expect(bild.data.length).toBe(128 * 64 * 4);
    expect(bild.data.every((wert: number) => wert === 0)).toBe(true);
  });

  it("putImageData/getImageData/clearRect wirken auf denselben Puffer", () => {
    const leinwand = new NachgebildeteLeinwand(4, 4);
    const ctx = leinwand.getContext("2d")!;
    const roh = ctx.createImageData(2, 2);
    roh.data.fill(200);
    ctx.putImageData(roh, 1, 1);
    const gelesen = ctx.getImageData(0, 0, 4, 4).data;
    const alpha = (x: number, y: number) => gelesen[(y * 4 + x) * 4 + 3];
    expect(alpha(0, 0)).toBe(0);
    expect(alpha(1, 1)).toBe(200);
    expect(alpha(2, 2)).toBe(200);
    expect(alpha(3, 3)).toBe(0);
    ctx.clearRect(0, 0, 2, 2);
    expect(ctx.getImageData(1, 1, 1, 1).data[3]).toBe(0);
    expect(ctx.getImageData(2, 2, 1, 1).data[3]).toBe(200);
  });

  it("Zeichenbefehle rasterisieren nicht (Stand 'Sprite-Blatt nicht geladen')", () => {
    const leinwand = new NachgebildeteLeinwand(16, 16);
    const ctx = leinwand.getContext("2d")!;
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, 16, 16);
    ctx.drawImage(new NachgebildetesBild(), 0, 0);
    expect(ctx.getImageData(0, 0, 16, 16).data.every((wert: number) => wert === 0)).toBe(true);
  });

  it("Groessenaenderung verwirft den Puffer wie im Browser", () => {
    const leinwand = new NachgebildeteLeinwand(2, 2);
    const ctx = leinwand.getContext("2d")!;
    const roh = ctx.createImageData(2, 2);
    roh.data.fill(255);
    ctx.putImageData(roh, 0, 0);
    leinwand.width = 2;
    expect(ctx.getImageData(0, 0, 2, 2).data.every((wert: number) => wert === 0)).toBe(true);
  });

  it("nur 2D-Kontexte, je Leinwand genau einer", () => {
    const leinwand = new NachgebildeteLeinwand();
    expect(leinwand.getContext("webgl")).toBeNull();
    expect(leinwand.getContext("2d")).toBe(leinwand.getContext("2d"));
  });
});

describe("arena-node-motor · Bild und Leerlauf-Knoten", () => {
  it("ein Bild verhaelt sich wie ein fehlgeschlagener Ladevorgang", async () => {
    const bild = new NachgebildetesBild();
    bild.src = "sprites/blatt.png";
    expect(bild.complete).toBe(true);
    expect([bild.width, bild.height, bild.naturalWidth, bild.naturalHeight]).toEqual([0, 0, 0, 0]);
    await expect(bild.decode()).rejects.toThrow();
  });

  it("ein Leerlauf-Knoten nimmt alles an, merkt Geschriebenes und ist kein Promise", () => {
    const knoten = leerlaufKnoten();
    knoten.style.transform = "scale(2)";
    expect(knoten.style.transform).toBe("scale(2)");
    expect(() => knoten.classList.add("x")).not.toThrow();
    expect(() => knoten.querySelector(".a").appendChild(leerlaufKnoten())).not.toThrow();
    expect(Number(knoten.offsetWidth)).toBe(0);
    expect(knoten.then).toBeUndefined();
    expect([...knoten.children]).toEqual([]);
  });
});

describe("arena-node-motor · Kontext", () => {
  it("die Haupt-Leinwand hat die Masse aus battle-mode.html, und window === globalThis", async () => {
    const kontext = baueMotorKontext();
    try {
      const { runInContext } = await import("node:vm");
      expect(
        runInContext(
          `[document.getElementById("${HAUPT_LEINWAND.id}").width, document.getElementById("${HAUPT_LEINWAND.id}").height, window === globalThis, window.parent === window, localStorage.getItem("fehlt")]`,
          kontext.fenster,
        ),
      ).toEqual([HAUPT_LEINWAND.breite, HAUPT_LEINWAND.hoehe, true, true, null]);
    } finally {
      kontext.aufraeumen();
    }
  });

  it("laedt den echten Motor, ohne den globalen Node-Kontext zu veraendern", async () => {
    const vorher = { document: (globalThis as Record<string, unknown>).document, window: (globalThis as Record<string, unknown>).window };
    const skripte = ladeMotorSkripte(MOCKUPS);
    const kontext = baueMotorKontext();
    try {
      kontext.fenster.__olyArenaKader = { heim: [], gast: [], aufstellung: {}, mutatoren: [] };
      skripte.rezepte.runInContext(kontext.fenster);
      skripte.engine.runInContext(kontext.fenster);
      for (let i = 0; i < 100 && !kontext.fenster.__arena; i += 1) await new Promise((resolve) => setImmediate(resolve));
      const motor = kontext.fenster.__arena as Record<string, unknown>;
      expect(motor).toBeTruthy();
      for (const einstieg of Object.values(MOTOR_EINSTIEG_JE_CHASSIS)) expect(typeof motor[einstieg]).toBe("function");
      expect(typeof motor.miniDmFfaEvent).toBe("function");
    } finally {
      kontext.aufraeumen();
    }
    expect((globalThis as Record<string, unknown>).document).toBe(vorher.document);
    expect((globalThis as Record<string, unknown>).window).toBe(vorher.window);
  }, 60_000);

  it("Chassis-Einstiege sind dieselben wie im Chromium-Runner", () => {
    expect({ ...MOTOR_EINSTIEG_JE_CHASSIS }).toEqual({ ...ARENA_CHASSIS_MOTOR_EINSTIEG });
  });
});
