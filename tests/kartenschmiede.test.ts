import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { baueKartenschmiedeSeite } from "@/lib/kartenschmiede/seite";
import {
  istGueltigeKartenId,
  ladeEintrag,
  ladeFaehigkeiten,
  ladeKarte,
  listeGruppen,
  listeKarten,
  loescheKarte,
  speichereEintrag,
  speichereFaehigkeiten,
  speichereKarte,
} from "@/lib/kartenschmiede/karten-store";

type Einheit = Record<string, string>;
type Regeln = {
  punkte(s: Einheit): { pts: number; roh: number };
  stufeFuerPunkte(p: number): number;
  leseWaffe(z: string): { reichweite: number; a: number; ds: number; reissend: boolean; explosion: number; regeln: string };
  regelnVon(regeln: string): Array<{ name: string; text: string }>;
  elementAus(regeln: string): string | null;
  elementWirkung(element: string | null, praegung: string[]): number;
  simuliere(a: Einheit, b: Einheit, o: Record<string, unknown>): { a: number; b: number; u: number };
  balanceTest(o: Record<string, unknown>): { paare: number; fern: number };
};
const laden = createRequire(import.meta.url);
const R = laden("../apps/kartenschmiede/regeln.js") as Regeln;
type Faehigkeit = { id: string; typ: string; name: string; text: string; tags: string[]; waffe?: string; kosten: { typ: string; wert: number } };
const F = laden("../apps/kartenschmiede/katalog.js") as {
  GRUNDBESTAND: Faehigkeit[];
  FRAKTIONEN: Array<{ id: string; name: string; icon: string; praegung: string[] }>;
  TAGS: Array<{ id: string; icon: string }>;
  PRAEGUNGEN: string[];
  konflikt(e: { tags: string[] }, praegung: string[]): { praegung: string; tag: string } | null;
  skaliere(e: Record<string, unknown>, stufe: number): { karte: Record<string, unknown> & { tier: number; points: number; skills: Array<{ id: string; tags: string[] }> }; neu: string[]; weg: string[] };
  FAEHIGKEITEN_JE_STUFE: number[];
};
type Eintrag = { typ: string; name: string; tags: string[]; waffe?: string; text: string; kosten: { typ: string; wert: number } };
const G = laden("../apps/kartenschmiede/generator.js") as {
  generiere(r: Regeln, typ: string, o: Record<string, unknown>): Eintrag;
  waffenPreis(r: Regeln, zeile: string): number;
};

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

  it("rechnet Fähigkeiten aus der Datenbank ein: Skills fest, Sonderregeln in Prozent", () => {
    const basis = einheit(4, 5, 5, "Klingen | Nahkampf | A4 | Reißend");
    const skill = F.GRUNDBESTAND.find(f => f.id === "schattenschritt")!;
    const regel = F.GRUNDBESTAND.find(f => f.id === "strahlende-aura")!;
    expect(R.punkte({ ...basis, skills: [skill] } as never).roh - R.punkte(basis).roh).toBeCloseTo(10);
    expect(R.punkte({ ...basis, skills: [regel] } as never).roh / R.punkte(basis).roh).toBeCloseTo(1.2);
  });

  it("hat im Katalog nur eindeutige IDs, gültige Kosten und bekannte Tags", () => {
    const ids = [...F.GRUNDBESTAND, ...F.FRAKTIONEN].map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tags = new Set(F.TAGS.map(t => t.id));
    for (const f of F.GRUNDBESTAND) {
      expect(["faehigkeit", "zauber", "gegenstand", "waffe"]).toContain(f.typ);
      expect(["fest", "prozent"]).toContain(f.kosten.typ);
      expect(f.text.length).toBeGreaterThan(10);
      for (const t of f.tags) expect(tags).toContain(t);
      if (f.typ === "waffe") expect(R.leseWaffe(f.waffe!).a).toBeGreaterThan(0);
    }
  });

  it("sperrt Einträge, die der Prägung widersprechen", () => {
    const frostlanze = F.GRUNDBESTAND.find(f => f.id === "frostlanze")!;
    const feuerball = F.GRUNDBESTAND.find(f => f.id === "feuerball")!;
    expect(F.konflikt(frostlanze, ["feuer"])).toEqual({ praegung: "feuer", tag: "frost" });
    expect(F.konflikt(feuerball, ["feuer"])).toBeNull();
    expect(F.konflikt(F.GRUNDBESTAND.find(f => f.id === "heilendes-licht")!, ["schatten"])).not.toBeNull();
    expect(F.konflikt(frostlanze, [])).toBeNull();
    const tags = new Set(F.TAGS.map(t => t.id));
    for (const p of F.PRAEGUNGEN) expect(tags).toContain(p);
    for (const fr of F.FRAKTIONEN) for (const p of fr.praegung) expect(F.PRAEGUNGEN).toContain(p);
  });

  it("kennt vier Gegensatzpaare, auch Natur ↔ Gift und Sci-Fi ↔ Magie", () => {
    expect(F.konflikt({ tags: ["gift"] }, ["natur"])).not.toBeNull();
    expect(F.konflikt({ tags: ["magie"] }, ["technik"])).not.toBeNull();
    expect(F.konflikt({ tags: ["technik"] }, ["magie"])).not.toBeNull();
    // Psi-Kräfte sind Technik, keine Magie: eine Sci-Fi-Einheit darf sie nehmen
    for (const f of F.GRUNDBESTAND.filter(x => x.tags.includes("technik"))) expect(f.tags, f.name).not.toContain("magie");
  });

  it("skaliert eine Einheit auf jede Seltenheit: Punkte in der Stufe, mehr Fähigkeiten nach oben, keine Sperren verletzt", () => {
    const grab = { name: "Grabritter", role: "enemy", praegung: ["schatten"], quality: "4+", defense: "3+", tough: "3", size: "1",
      weapons: "Dornenmorgenstern | Nahkampf | A3 | DS(1), Schatten", passives: "Furchtlos", skills: [] };
    let vorher = -1;
    for (let stufe = 1; stufe <= 6; stufe++) {
      const { karte } = F.skaliere(grab, stufe);
      expect(karte.tier, `Stufe ${stufe}`).toBe(stufe);
      expect(karte.skills.length).toBe(F.FAEHIGKEITEN_JE_STUFE[stufe]);
      expect(karte.points).toBeGreaterThan(vorher);
      for (const k of karte.skills) expect(F.konflikt(k, ["schatten"])).toBeNull();
      vorher = karte.points;
    }
    // Runter und wieder hoch landet in derselben Stufe; überzählige Fähigkeiten werden gemeldet
    const boss = F.skaliere(grab, 6).karte;
    const klein = F.skaliere(boss, 1);
    expect(klein.karte.tier).toBe(1);
    expect(klein.weg.length).toBe(4);
  });

  it("gibt jeder Fraktion genau ein eigenes Symbol", () => {
    const symbole = F.FRAKTIONEN.map(f => f.icon);
    expect(new Set(symbole).size).toBe(symbole.length);
  });
});

describe("Kartenschmiede – Generator", () => {
  it("würfelt Waffen, deren Preis mit der Seltenheit steigt", () => {
    const mittel = (stufe: number) => {
      const preise = Array.from({ length: 12 }, (_, i) => G.waffenPreis(R, G.generiere(R, "waffe", { stufe, seed: i + 1 }).waffe!));
      return preise.reduce((a, b) => a + b, 0) / preise.length;
    };
    expect(mittel(5)).toBeGreaterThan(mittel(2) * 1.8);
  });

  it("liefert für jeden Typ einen vollständigen, bepreisten Eintrag", () => {
    for (const typ of ["waffe", "gegenstand", "faehigkeit", "zauber"]) {
      for (const stufe of [1, 3, 6]) {
        const e = G.generiere(R, typ, { stufe, seed: stufe * 11 + typ.length, rolle: "hero" });
        expect(e.typ).toBe(typ);
        expect(e.name.length).toBeGreaterThan(2);
        expect(e.text.length).toBeGreaterThan(5);
        expect(e.tags.length).toBeGreaterThan(0);
        if (typ !== "waffe") expect(e.kosten.wert).toBeGreaterThan(0);
      }
    }
  });

  it("würfelt mit Schwerpunkt Sci-Fi technische Einträge", () => {
    for (const typ of ["waffe", "gegenstand", "faehigkeit", "zauber"]) {
      const e = G.generiere(R, typ, { stufe: 4, seed: 7, rolle: "hero", tag: "technik" });
      expect(e.tags).toContain("technik");
      expect(e.text.length).toBeGreaterThan(5);
    }
  });

  it("erklärt jede Regel der Standardwaffen und bepreist die neuen Regeln", () => {
    for (const f of F.GRUNDBESTAND.filter(x => x.typ === "waffe")) {
      const regeln = R.leseWaffe(f.waffe!).regeln.split(",").map(t => t.trim()).filter(Boolean);
      for (const t of regeln) expect(R.regelnVon(t).length, `${f.name}: ${t}`).toBe(1);
    }
    const basis = G.waffenPreis(R, "Gewehr | 24\" | A1 |");
    expect(G.waffenPreis(R, "Gewehr | 24\" | A1 | Präzise")).toBeGreaterThan(basis);
    expect(G.waffenPreis(R, "Gewehr | 24\" | A1 | Indirekt")).toBeGreaterThan(basis);
    expect(G.waffenPreis(R, "Gewehr | 24\" | A1 | Überhitzen")).toBeLessThan(basis);
  });

  it("liest Elemente aus der Waffenzeile und wirkt über die Prägung des Ziels", () => {
    expect(R.elementAus("DS(1), Feuer")).toBe("feuer");
    expect(R.elementAus("Energie")).toBe("technik");
    expect(R.elementAus("DS(1)")).toBeNull();
    expect(R.elementWirkung("feuer", ["feuer"])).toBe(1);
    expect(R.elementWirkung("feuer", ["frost"])).toBe(-1);
    expect(R.elementWirkung("feuer", ["licht"])).toBe(0);
    // Elemente kosten nichts
    expect(G.waffenPreis(R, "Klinge | Nahkampf | A2 | Feuer")).toBe(G.waffenPreis(R, "Klinge | Nahkampf | A2 |"));
    // Im Simulator gewinnt die Feuerklinge gegen einen Frost-Gegner öfter als gegen einen Feuer-Gegner
    const angreifer = einheit(4, 5, 5, "Flammenklinge | Nahkampf | A3 | Feuer");
    const ziel = (p: string) => ({ ...einheit(4, 4, 5, "Klauen | Nahkampf | A3 |"), praegung: [p] } as unknown as Einheit);
    const gegenFrost = R.simuliere(angreifer, ziel("frost"), { kaempfe: 2000, seed: 3 }).a;
    const gegenFeuer = R.simuliere(angreifer, ziel("feuer"), { kaempfe: 2000, seed: 3 }).a;
    expect(gegenFrost).toBeGreaterThan(gegenFeuer + 0.1);
  });

  it("bepreist Sonderregeln für Gegner in Prozent", () => {
    expect(G.generiere(R, "faehigkeit", { stufe: 4, seed: 5, rolle: "enemy" }).kosten.typ).toBe("prozent");
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
    expect(rumpf).toContain("KartenschmiedeCharaktere");
    for (const id of ["tabRegeln", "charaktere", "formModus", "bauModus", "elemente"]) expect(rumpf).toContain(`id="${id}"`);
    // Gegner werden als Postkarte gedruckt: Querformat im Verhältnis 3:2 und eine eigene Seitengröße 15 × 10 cm
    expect(kopf + rumpf).toContain(".card.land { aspect-ratio: 3 / 2;");
    expect(kopf + rumpf).toContain("@page postkarte-quer { size: 150mm 100mm;");
    expect(kopf + rumpf).toContain("aspect-ratio: 2 / 3;");
    // Es gibt nur Held und Gegner zur Auswahl; Gefährten entstehen in der Gruppe
    expect(rumpf).not.toContain('<option value="companion">');
  });

  it("speichert, listet, lädt und löscht Karten", () => {
    const id = "karte-1234abcd";
    speichereKarte("gemeinsam", id, { name: "Kristallwurm", points: 55, tier: 2, role: "enemy", praegung: ["feuer"], quality: "4+",
      weapons: "Biss | Nahkampf | A3 | Feuer", upload: "data:image/png;base64,GROSS" }, "data:image/jpeg;base64,AAAA", "Chris");
    expect(listeKarten("gemeinsam")).toMatchObject([{ id, name: "Kristallwurm", points: 55, tier: 2, gespeichertVon: "Chris",
      werte: { praegung: ["feuer"], quality: "4+", weapons: "Biss | Nahkampf | A3 | Feuer" } }]);
    expect(JSON.stringify(listeKarten("gemeinsam"))).not.toContain("GROSS");
    expect(ladeKarte("gemeinsam", id)).toMatchObject({ name: "Kristallwurm", id });
    expect(loescheKarte("gemeinsam", id)).toBe(true);
    expect(listeKarten("gemeinsam")).toEqual([]);
  });

  it("speichert Gruppen getrennt von Karten", () => {
    speichereEintrag("gemeinsam", "gruppen", "gruppe-1234abcd", { name: "Die Vier", mitglieder: [{ name: "Schurke" }, { name: "Krieger" }] }, null, "Franky");
    expect(listeGruppen("gemeinsam")).toMatchObject([{ id: "gruppe-1234abcd", name: "Die Vier", mitglieder: 2, gespeichertVon: "Franky" }]);
    expect(listeKarten("gemeinsam")).toEqual([]);
    expect(ladeEintrag("gemeinsam", "gruppen", "gruppe-1234abcd")).toMatchObject({ name: "Die Vier" });
  });

  it("prüft eigene Fähigkeiten beim Speichern und stört die Kartenliste nicht", () => {
    const gespeichert = speichereFaehigkeiten("gemeinsam", [
      { id: "frostatem", name: "Frostatem", art: "Sonderregel", fuer: ["enemy"], kosten: { typ: "prozent", wert: 10 }, text: "Kegel 6\", 1 Treffer." },
      { id: "../boese", name: "x" },
      { id: "ohne-name" },
    ]);
    expect(gespeichert.map(f => f.id)).toEqual(["frostatem"]);
    expect(ladeFaehigkeiten("gemeinsam")[0]).toMatchObject({ name: "Frostatem", kosten: { typ: "prozent", wert: 10 } });
    const mehr = speichereFaehigkeiten("gemeinsam", [
      { id: "blutaxt", typ: "waffe", name: "Blutaxt", waffe: "Blutaxt | Nahkampf | A3 | Reißend", tags: ["nahkampf", "../x"], kosten: { typ: "fest", wert: 0 } },
      { id: "nachtgoblins", typ: "fraktion", name: "Nachtgoblins", icon: "spiral" },
      { id: "komisch", typ: "unsinn", name: "Komisch", text: "x" },
    ]);
    expect(mehr[0]).toMatchObject({ typ: "waffe", waffe: "Blutaxt | Nahkampf | A3 | Reißend", tags: ["nahkampf"] });
    expect(mehr[1]).toMatchObject({ typ: "fraktion", icon: "spiral" });
    expect(mehr[2].typ).toBe("faehigkeit");
    speichereKarte("gemeinsam", "karte-abcdef12", { name: "Test" }, null);
    expect(listeKarten("gemeinsam").map(k => k.id)).toEqual(["karte-abcdef12"]);
  });

  it("lässt keine Pfade als Karten-ID durch", () => {
    expect(istGueltigeKartenId("../../etc/passwd")).toBe(false);
    expect(() => speichereKarte("gemeinsam", "../boese", { name: "x" }, null)).toThrow();
  });
});
