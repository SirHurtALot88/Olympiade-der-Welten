import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { baueKartenschmiedeSeite } from "@/lib/kartenschmiede/seite";
import { istGueltigeKartenId, ladeKarte, listeKarten, loescheKarte, speichereKarte } from "@/lib/kartenschmiede/karten-store";

type Einheit = Record<string, string>;
type Regeln = {
  punkte(s: Einheit): { pts: number; roh: number };
  stufeFuerPunkte(p: number): number;
  leseWaffe(z: string): { reichweite: number; a: number; ds: number; reissend: boolean; explosion: number };
  simuliere(a: Einheit, b: Einheit, o: Record<string, unknown>): { a: number; b: number; u: number };
  balanceTest(o: Record<string, unknown>): { paare: number; fern: number };
};
const R = createRequire(import.meta.url)("../apps/kartenschmiede/regeln.js") as Regeln;

const einheit = (q: number, d: number, t: number, weapons: string, passives = "", size = "1"): Einheit =>
  ({ quality: `${q}+`, defense: `${d}+`, tough: String(t), weapons, passives, size });

describe("Kartenschmiede – Schmiede-Formel", () => {
  it("trifft offizielle OPR-Einheiten aus Chris' Tabelle im erwarteten Rahmen", () => {
    // Werte aus Age_of_Fantasy_Quest.xlsx (Blatt Units); Formel darf höchstens 20 % abweichen
    const gator = einheit(4, 3, 9, "Obsidian-Großwaffe | Nahkampf | A9 | Disintegrate", "Fearless, Primal");
    const titan = einheit(3, 2, 54, "Stampfen | Nahkampf | A18 | AP(2)\nKiefer | Nahkampf | A12 | AP(4), Deadly(3)", "Fear(9), Fearless, Impact(18)");
    for (const [e, opr] of [[gator, 160], [titan, 2275]] as const) {
      expect(Math.abs(R.punkte(e).pts - opr) / opr).toBeLessThan(0.2);
    }
  });

  it("versteht deutsche und OPR-Begriffe gleich", () => {
    const de = R.leseWaffe('Splitter | 18" | A2 | DS(1), Reißend, Explosion(3)');
    const en = R.leseWaffe('Splitter | 18" | A2 | AP(1), Rending, Blast(3)');
    expect(de).toMatchObject({ reichweite: 18, a: 2, ds: 1, reissend: true, explosion: 3 });
    expect(R.punkte(einheit(4, 4, 5, 'x | 18" | A2 | DS(1), Reißend')).roh).toBeCloseTo(R.punkte(einheit(4, 4, 5, 'x | 18" | A2 | AP(1), Rending')).roh);
    expect(en.ds).toBe(1);
  });

  it("ordnet Punkte den sechs Seltenheiten zu", () => {
    expect([0, 40, 45, 75, 105, 165, 224, 225, 900].map(R.stufeFuerPunkte)).toEqual([1, 1, 2, 3, 4, 5, 5, 6, 6]);
  });

  it("gibt Helden 25 Punkte für ihre Quest-Skills dazu", () => {
    const basis = einheit(4, 5, 5, "Klingen | Nahkampf | A4 | Reißend");
    expect(R.punkte({ ...basis, role: "hero" }).roh - R.punkte(basis).roh).toBeCloseTo(25);
  });
});

describe("Kartenschmiede – Duell-Simulator", () => {
  it("lässt die deutlich teurere Einheit fast immer gewinnen", () => {
    const stark = einheit(3, 3, 12, "Klauen | Nahkampf | A6 | DS(2)");
    const schwach = einheit(5, 6, 3, "Biss | Nahkampf | A1 |");
    const r = R.simuliere(stark, schwach, { kaempfe: 300, seed: 3 });
    expect(r.a).toBeGreaterThan(0.95);
  });

  it("hält Fern- und Nahkampf bei gleichen Punkten und mittlerem Gelände im Gleichgewicht", () => {
    const r = R.balanceTest({ deckung: 0.5, kaempfe: 120, kandidaten: 160 });
    expect(r.paare).toBeGreaterThan(80);
    expect(r.fern).toBeGreaterThan(0.4);
    expect(r.fern).toBeLessThan(0.62);
  });
});

describe("Kartenschmiede – Seite und Kartenspeicher", () => {
  let ordner: string;
  beforeEach(() => {
    ordner = fs.mkdtempSync(path.join(os.tmpdir(), "kartenschmiede-"));
    process.env.KARTENSCHMIEDE_DIR = ordner;
  });
  afterEach(() => {
    delete process.env.KARTENSCHMIEDE_DIR;
    fs.rmSync(ordner, { recursive: true, force: true });
  });

  it("baut die Seite vollständig zusammen", () => {
    const { kopf, rumpf } = baueKartenschmiedeSeite("server");
    expect(kopf + rumpf).not.toContain("{{");
    expect(kopf).toContain("@font-face");
    expect(rumpf).toContain("window.KARTENSCHMIEDE_SERVER=true");
    expect(rumpf).toContain("Kartenschmiede");
  });

  it("speichert, listet, lädt und löscht Karten", () => {
    const id = "karte-1234abcd";
    speichereKarte("gemeinsam", id, { name: "Kristallwurm", points: 55, tier: 2, role: "enemy" }, "data:image/jpeg;base64,AAAA", "Chris");
    expect(listeKarten("gemeinsam")).toMatchObject([{ id, name: "Kristallwurm", points: 55, tier: 2, gespeichertVon: "Chris" }]);
    expect(ladeKarte("gemeinsam", id)).toMatchObject({ name: "Kristallwurm", id });
    expect(loescheKarte("gemeinsam", id)).toBe(true);
    expect(listeKarten("gemeinsam")).toEqual([]);
  });

  it("lässt keine Pfade als Karten-ID durch", () => {
    expect(istGueltigeKartenId("../../etc/passwd")).toBe(false);
    expect(() => speichereKarte("gemeinsam", "../boese", { name: "x" }, null)).toThrow();
  });
});
