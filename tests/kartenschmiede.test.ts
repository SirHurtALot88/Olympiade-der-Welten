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
  listeSzenarien,
  listeSpielstaende,
  speichereAudio,
  audioDatei,
  listeAudio,
  loescheAudio,
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
  effekteAus(e: Record<string, unknown>): Array<Record<string, unknown>>;
  faehigkeitsCheck(f: unknown, o?: Record<string, unknown>): { sieg: number; messbar: boolean };
  elementWirkung(element: string | null, praegung: string[]): number;
  simuliere(a: Einheit, b: Einheit, o: Record<string, unknown>): { a: number; b: number; u: number };
  balanceTest(o: Record<string, unknown>): { paare: number; fern: number };
  energieVon(f: Record<string, unknown>): number;
  preisVon(f: Record<string, unknown>): number;
  ENERGIE_FAKTOR: number[];
  AKTIONSWUERFEL: number;
  MINDESTWURF: number[];
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
  welleWuerfeln(pool: Array<{ key: string; name: string; pts: number; stufe: number; faction: string }>, ziel: number, o: Record<string, unknown>):
    { einheiten: Array<{ key: string; pts: number; stufe: number; anzahl: number; faction: string }>; summe: number };
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
    expect(R.punkte({ ...basis, skills: [skill] } as never).roh - R.punkte(basis).roh).toBeCloseTo(R.preisVon(skill as never));
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

  it("nutzt in Regeltexten nur bekannte Symbol-Kürzel", () => {
    // Muss zu SYMBOLTEXT in apps/kartenschmiede/app.js passen
    const gueltig = /^\{(RU|DS|[PZSAVTHWRFBXD])([+\-−]?[0-9W+\-]*)\}$/;
    const texte = [...F.GRUNDBESTAND.map(f => f.text)];
    for (const typ of ["faehigkeit", "zauber", "gegenstand"]) for (let i = 1; i < 30; i++) texte.push(G.generiere(R, typ, { stufe: 1 + (i % 6), seed: i, rolle: i % 2 ? "enemy" : "hero", tag: i % 5 ? undefined : "technik" }).text);
    for (const t of texte) for (const k of t.match(/\{[^}]*\}/g) || []) expect(k, t).toMatch(gueltig);
  });

  it("rechnet Würfelwerte wie W6−2 (mindestens 1) und schreibt keinen W3 mehr in Gegenstände", () => {
    const heiltrank = F.GRUNDBESTAND.find(f => f.id === "heiltrank")!;
    expect(heiltrank.text).toContain("{HW6-2}");
    expect(F.GRUNDBESTAND.filter(f => f.typ === "gegenstand").map(f => f.text).join(" ")).not.toMatch(/HW3\+1/);
  });

  it("würfelt Gegnerwellen nahe am Ziel, mit Stufengrenze je Schwierigkeit, höchstens einem Boss und drei Gleichen", () => {
    const pool = [["a", 25, 1, "Urwild"], ["b", 35, 1, "Dämonen"], ["c", 50, 2, "Dämonen"], ["d", 75, 3, "Urwild"], ["e", 120, 4, "Urwild"],
      ["f", 170, 5, "Urwild"], ["g", 240, 6, "Wilde Jagd"], ["h", 30, 1, "Urwild"]].map(([key, pts, stufe, faction]) => ({ key: String(key), name: String(key), pts: +pts, stufe: +stufe, faction: String(faction) }));
    for (let seed = 1; seed <= 30; seed++) for (const [ziel, schw] of [[85, 1], [170, 2], [260, 3], [420, 4]]) {
      const w = F.welleWuerfeln(pool, ziel, { schwierigkeit: schw, seed });
      expect(w.summe, `${ziel}/${schw}`).toBeGreaterThanOrEqual(ziel * 0.85);
      expect(w.summe).toBeLessThanOrEqual(ziel * 1.1);
      expect(Math.max(...w.einheiten.map(e => e.stufe))).toBeLessThanOrEqual([0, 3, 4, 5, 6][schw]);
      expect(w.einheiten.filter(e => e.stufe === 6).reduce((n, e) => n + e.anzahl, 0)).toBeLessThanOrEqual(1);
      for (const e of w.einheiten) expect(e.anzahl).toBeLessThanOrEqual(3);
    }
    const nurUrwild = F.welleWuerfeln(pool, 170, { schwierigkeit: 2, fraktion: "Urwild", seed: 3 });
    for (const e of nurUrwild.einheiten) expect(e.faction).toBe("Urwild");
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

  it("liest Fähigkeiten für den Simulator aus den Symbolen und rechnet sie mit", () => {
    const heilen = F.GRUNDBESTAND.find(f => f.id === "wunden-heilen")!;
    expect(R.effekteAus({ skills: [heilen] })[0]).toMatchObject({ takt: "power", heilen: 2 });
    expect(R.effekteAus({ skills: [F.GRUNDBESTAND.find(f => f.id === "psiblitz")!] })[0]).toMatchObject({ treffer: 2, ds: 2, chance: 0.5 });
    const basis = einheit(4, 4, 5, "Schwert | Nahkampf | A3 |");
    const mit = { ...basis, skills: [heilen] } as unknown as Einheit;
    expect(R.simuliere(mit, basis, { kaempfe: 2000, seed: 7 }).a).toBeGreaterThan(0.62);
    // Preis-Check: Heilung bei gleichen Punkten im Vorteil, Beschwörungen gelten als nicht messbar
    expect(R.faehigkeitsCheck(heilen).messbar).toBe(true);
    expect(R.faehigkeitsCheck(F.GRUNDBESTAND.find(f => f.id === "geistwolf")!).messbar).toBe(false);
  });

  it("bepreist Sonderregeln für Gegner in Prozent", () => {
    expect(G.generiere(R, "faehigkeit", { stufe: 4, seed: 5, rolle: "enemy" }).kosten.typ).toBe("prozent");
  });
});

describe("Kartenschmiede – Aktionswürfel", () => {
  const eintrag = (id: string) => F.GRUNDBESTAND.find(f => f.id === id)! as unknown as Record<string, unknown>;

  it("liest die Würfelstufe aus dem Regeltext: Symbol, Zauber, Auslöser, Passives, freie Aktion", () => {
    expect(R.AKTIONSWUERFEL).toBe(4);
    expect(R.MINDESTWURF).toEqual([0, 3, 5, 6]);
    expect(R.energieVon(eintrag("schattenschritt"))).toBe(1);   // {P1}
    expect(R.energieVon(eintrag("tiergefaehrte"))).toBe(2);     // {P2}
    expect(R.energieVon(eintrag("psiblitz"))).toBe(1);          // Zauber {Z4}
    expect(R.energieVon(eintrag("stasisfeld"))).toBe(2);        // schwerer Zauber {Z5}
    expect(R.energieVon(eintrag("schutzkreis"))).toBe(2);       // Zauber, obwohl er mit „Verbündete {F6}“ beginnt
    expect(R.energieVon(eintrag("feuerball"))).toBe(2);         // im Katalog ausdrücklich gesetzt
    expect(R.energieVon(eintrag("sporenwolke"))).toBe(0);       // „Stirbt es“
    expect(R.energieVon(eintrag("lebensentzug"))).toBe(0);      // {RU} mit Auslöser
    expect(R.energieVon(eintrag("aura-reissend"))).toBe(0);     // Aura wirkt von selbst
    expect(R.energieVon(eintrag("heiltrank"))).toBe(0);         // Freie Aktion
    expect(R.energieVon(eintrag("betaeubungsbombe"))).toBe(1);  // {S} zum Benutzen
    expect(R.energieVon({ text: "{P1} Feind: {A1}.", energie: 3 })).toBe(3);   // von Hand gesetzt schlägt den Text
    for (const f of F.GRUNDBESTAND) expect(R.energieVon(f as unknown as Record<string, unknown>)).toBeLessThanOrEqual(3);
  });

  it("macht Fähigkeiten mit seltenem Mindestwurf beim Bauen billiger, passive bleiben beim Grundpreis", () => {
    expect(R.ENERGIE_FAKTOR[0]).toBe(1);
    expect(R.ENERGIE_FAKTOR).toEqual([...R.ENERGIE_FAKTOR].sort((a, b) => b - a));
    const basis = einheit(4, 4, 5, "Schwert | Nahkampf | A3 |");
    const mit = (f: Record<string, unknown>) => R.punkte({ ...basis, skills: [f] } as never).roh - R.punkte(basis).roh;
    const teuer = { typ: "faehigkeit", text: "Feind {R12}: {A2}.", kosten: { typ: "fest", wert: 20 } };
    expect(mit({ ...teuer, energie: 0 })).toBeCloseTo(20);
    expect(mit({ ...teuer, energie: 2 })).toBeCloseTo(Math.round(20 * R.ENERGIE_FAKTOR[2]));
    expect(mit({ ...teuer, energie: 3 })).toBeLessThan(mit({ ...teuer, energie: 1 }));
  });

  it("nutzt im Simulator nur die Würfel, die nach Bewegen und Angreifen übrig sind, nach Mindestwurf", () => {
    // Je höher der nötige Wurf, desto seltener kommt dieselbe Heilung zum Zug
    const basis = einheit(4, 4, 6, "Schwert | Nahkampf | A3 |");
    const heilen = (energie: number) => ({ ...basis, skills: [{ id: "h", typ: "faehigkeit", text: "Dieses Modell: {H3}.", energie, kosten: { typ: "fest", wert: 0 } }] }) as unknown as Einheit;
    const frei = R.simuliere(heilen(0), basis, { kaempfe: 1500, seed: 4 }).a;
    const zwei = R.simuliere(heilen(2), basis, { kaempfe: 1500, seed: 4 }).a;
    const drei = R.simuliere(heilen(3), basis, { kaempfe: 1500, seed: 4 }).a;
    const ohne = R.simuliere(basis, basis, { kaempfe: 1500, seed: 4 }).a;
    expect(frei).toBeGreaterThan(0.85);
    expect(zwei).toBeLessThan(frei - 0.05);
    expect(drei).toBeLessThan(zwei - 0.05);
    expect(drei).toBeGreaterThan(ohne + 0.1);
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
    for (const id of ["tabRegeln", "charaktere", "formModus", "bauModus", "elemente", "rueckBox", "simCheck", "tabSzenarien", "szKampagne", "szMain", "tabSpielen", "spMain"]) expect(rumpf).toContain(`id="${id}"`);
    expect(rumpf).toContain("KartenschmiedeSzenarien");
    expect(rumpf).toContain("KartenschmiedeSpiel");
    expect(rumpf).toContain("window.SPIELMODUS_MAPS=");
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
    expect(ladeFaehigkeiten("gemeinsam")[0].energie).toBeUndefined();
    const energie = speichereFaehigkeiten("gemeinsam", [
      { id: "frostatem", name: "Frostatem", kosten: { typ: "prozent", wert: 10 }, text: "x", energie: 2 },
      { id: "zu-viel", name: "Zu viel", text: "x", energie: 9 },
    ]);
    expect(energie.map(f => f.energie)).toEqual([2, 3]);
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

  it("speichert und listet Zusatzmissionen", () => {
    speichereEintrag("gemeinsam", "szenarien", "szenario-1234abcd", { titel: "Das Nest", ziel: "saeubern", schauplatz: "waldrand" }, null, "Chris");
    expect(listeSzenarien("gemeinsam")).toMatchObject([{ id: "szenario-1234abcd", name: "Das Nest", ziel: "saeubern", schauplatz: "waldrand" }]);
    expect(ladeEintrag("gemeinsam", "szenarien", "szenario-1234abcd")).toMatchObject({ titel: "Das Nest" });
  });

  it("speichert Spielstände und Audio-Cues, und lässt nur Audio mit gültiger Id durch", () => {
    speichereEintrag("gemeinsam", "spielstaende", "spielstand-1234abcd", { name: "Moosgrab mit Franky", kampagne: "moosgrab", map: 1, fertig: true }, null, "Chris");
    expect(listeSpielstaende("gemeinsam")).toMatchObject([{ id: "spielstand-1234abcd", name: "Moosgrab mit Franky", kampagne: "moosgrab", map: 1, fertig: true }]);
    const mp3 = Buffer.from("ID3-test-daten");
    expect(speichereAudio("gemeinsam", "moosgrab-01b-1", mp3, "audio/mpeg", "Der Schrei.mp3", "Chris")).toMatchObject({ id: "moosgrab-01b-1", typ: "audio/mpeg", bytes: mp3.length });
    expect(listeAudio("gemeinsam").map(a => a.id)).toEqual(["moosgrab-01b-1"]);
    const datei = audioDatei("gemeinsam", "moosgrab-01b-1");
    expect(datei && fs.readFileSync(datei.pfad).toString()).toBe("ID3-test-daten");
    // Neu hochladen ersetzt, auch mit anderem Format
    speichereAudio("gemeinsam", "moosgrab-01b-1", Buffer.from("OggS"), "audio/ogg", "neu.ogg");
    expect(audioDatei("gemeinsam", "moosgrab-01b-1")!.pfad.endsWith(".ogg")).toBe(true);
    expect(fs.readdirSync(path.dirname(audioDatei("gemeinsam", "moosgrab-01b-1")!.pfad)).filter(n => n.startsWith("moosgrab-01b-1"))).toEqual(["moosgrab-01b-1.ogg"]);
    expect(() => speichereAudio("gemeinsam", "../boese", mp3, "audio/mpeg", "x")).toThrow("ungueltige_id");
    expect(() => speichereAudio("gemeinsam", "moosgrab-x", mp3, "text/html", "x")).toThrow("kein_audio");
    expect(audioDatei("gemeinsam", "../../etc/passwd")).toBeNull();
    expect(loescheAudio("gemeinsam", "moosgrab-01b-1")).toBe(true);
    expect(listeAudio("gemeinsam")).toEqual([]);
  });

  it("lässt keine Pfade als Karten-ID durch", () => {
    expect(istGueltigeKartenId("../../etc/passwd")).toBe(false);
    expect(() => speichereKarte("gemeinsam", "../boese", { name: "x" }, null)).toThrow();
  });
});

type Karte = { tisch: string; b: number; t: number; aufstellung: { x: number; y: number; w: number; h: number };
  gelaende: Array<{ art: string; x: number; y: number; w: number; h: number; label?: string; geheim?: boolean }>;
  marker: Array<{ typ: string; x?: number; y?: number; label?: string; geheim?: boolean; kante?: boolean }> };
type Map = { nr: number; empfohlen: string; titel: string; einleitung: string; hauptziel: string; nebenziel: string; spezial: string[]; belohnung: string;
  konsequenzen: string[]; hinweis: string; karte: Karte; teile: Array<{ name: string; ausloeser: string }>; spieler?: Partial<Map> };
const S = laden("../apps/kartenschmiede/szenarien.js") as {
  TISCHE: Array<{ id: string; b: number; t: number }>;
  GELAENDE: Record<string, unknown>;
  SCHAUPLAETZE: Array<{ id: string; gelaende: string[]; ereignisse: string[] }>;
  ZIELE: Array<{ id: string; marker: Array<{ anzahl: number }> }>;
  MOOSGRAB: { maps: Map[] };
  erzeuge(o: Record<string, unknown>): { ziel: string; karte: Karte; ep: { haupt: number; neben: number } };
  wellenPunkte(sz: unknown, p: number): Array<{ punkte: number }>;
  skaliereKarte(k: Karte, tisch: string): Karte;
};
const imTisch = (k: Karte) => k.gelaende.every(g => g.x >= 0 && g.y >= 0 && g.x + g.w <= k.b + 0.01 && g.y + g.h <= k.t + 0.01);

describe("Kartenschmiede – Szenarien", () => {
  it("würfelt mit derselben Saat dasselbe Szenario, mit allen Markern und Gelände auf jedem Tisch", () => {
    expect(JSON.stringify(S.erzeuge({ seed: 42 }))).toBe(JSON.stringify(S.erzeuge({ seed: 42 })));
    for (let seed = 1; seed <= 300; seed++) for (const t of S.TISCHE) {
      const sz = S.erzeuge({ seed, tisch: t.id });
      const soll = S.ZIELE.find(z => z.id === sz.ziel)!.marker.reduce((n, m) => n + m.anzahl, 0);
      expect(sz.karte.marker.filter(m => m.typ !== "feind" && m.typ !== "truhe").length, `${seed}/${t.id}`).toBe(soll);
      expect(imTisch(sz.karte), `${seed}/${t.id}`).toBe(true);
      // Kleines Geländebudget: auch auf 120 × 80 höchstens ein Dutzend Stücke
      expect(sz.karte.gelaende.length).toBeLessThanOrEqual(12);
    }
  });

  it("rechnet Wellen nach OPR aus den Heldenpunkten", () => {
    const sz = S.erzeuge({ seed: 7, ziel: "bergen", schwierigkeit: 2 });
    expect(S.wellenPunkte(sz, 345).map(w => w.punkte)).toEqual([Math.round(345 * 0.5 * 0.8), Math.round(345 * 0.5 * 0.35)]);
    expect(sz.ep).toEqual({ haupt: 4, neben: 2 });
  });

  it("kennt jedes Gelände, das Schauplätze und Kampagne verwenden", () => {
    for (const s of S.SCHAUPLAETZE) { for (const a of s.gelaende) expect(S.GELAENDE[a], s.id).toBeTruthy(); expect(s.ereignisse).toHaveLength(6); }
    for (const m of S.MOOSGRAB.maps) for (const g of m.karte.gelaende) expect(S.GELAENDE[g.art], `Map ${m.nr}`).toBeTruthy();
  });

  it("hat fünf vollständige Moosgrab-Maps, die auf jeden Tisch passen", () => {
    expect(S.MOOSGRAB.maps.map(m => m.nr)).toEqual([1, 2, 3, 4, 5]);
    for (const m of S.MOOSGRAB.maps) {
      for (const feld of ["titel", "einleitung", "hauptziel", "nebenziel", "belohnung", "hinweis"] as const) expect(m[feld], `Map ${m.nr} ${feld}`).toBeTruthy();
      expect(m.spezial.length).toBeGreaterThan(0);
      expect(m.konsequenzen.length).toBeGreaterThan(0);
      expect(m.teile.length).toBeGreaterThan(0);
      expect(S.TISCHE.map(t => t.id)).toContain(m.empfohlen);
      expect(imTisch(m.karte), `Map ${m.nr}`).toBe(true);
      for (const t of S.TISCHE) expect(imTisch(S.skaliereKarte(m.karte, t.id)), `Map ${m.nr} auf ${t.id}`).toBe(true);
    }
  });

  it("verrät in der Spieler-Ansicht nichts, was erst gefunden werden soll", () => {
    // Was die Spieler je Map noch nicht wissen dürfen (docs/KAMPAGNEN_UEBERGABE.md: keine Spoiler)
    const verboten: Record<number, string[]> = {
      1: ["Kupferanhänger", "verwandel", "Erblühte", "mutiert"],
      2: ["Hedda", "Krypta", "Falltür", "Gemeinde", "Kellerschlüssel"],
      3: ["Schmied und", "Harm", "befallenen Häuser", "Station"],
      4: ["Erkennungsmarke", "Protokoll", "Probe", "Soldat", "Erwachen", "Labor", "Metall"],
      5: ["Probe", "Epilog"],
    };
    for (const m of S.MOOSGRAB.maps) {
      const v = { ...m, ...(m.spieler || {}) };
      const sichtbar = [v.titel, v.einleitung, v.hauptziel, v.nebenziel, v.belohnung, ...v.spezial,
        ...m.karte.gelaende.filter(g => !g.geheim).map(g => g.label || ""), ...m.karte.marker.filter(x => !x.geheim).map(x => x.label || "")].join(" | ");
      for (const wort of verboten[m.nr]) expect(sichtbar, `Map ${m.nr}: ${wort}`).not.toContain(wort);
    }
  });
});

type Spielstand = { schritt: string; runde: number; flags: Record<string, unknown>; leisten: Record<string, { wert: number; aktiv: boolean }>;
  gegner: Array<{ uid: string; id: string; wunden: number; zaeh: number }>; letzte: Array<{ id: string; vorlesen: string; art?: string }>; undo: unknown[]; verlauf: string[] };
type Motor = {
  neu(o?: Record<string, unknown>): Spielstand; weiter(s: Spielstand): unknown; zurueck(s: Spielstand): boolean; runde(s: Spielstand): { texte: string[]; sprung: string | null };
  ereignis(s: Spielstand, id: string): unknown; waehle(s: Spielstand, taste: string, eingabe?: string): unknown; schaden(s: Spielstand, uid: string, d: number): unknown;
  zustand(g: { wunden: number; zaeh: number; id: string }): { id: string; satz: string }; wuetend(s: Spielstand): boolean; folgen(s: Spielstand): string[];
  epListe(s: Spielstand): Array<{ ep: number; erreicht: boolean }>; uebernahme(s: Spielstand): { leisten: Record<string, number>; flags: Record<string, unknown> };
};
const SM = laden("../apps/kartenschmiede/spiel-motor.js") as { erstelle(m: unknown, h?: Record<string, unknown>): Motor; pruefe(m: unknown): string[] };
const MAP1 = JSON.parse(fs.readFileSync(path.join(__dirname, "../apps/kartenschmiede/kampagnen/moosgrab/map1.json"), "utf8"));
// Gegnerwerte wie in der Kartenschmiede: Vorlagen-Schlüssel auf Zäh abbilden (Giftmade 3, Sporenhülle 4, Frostfang 12)
const VORLAGE_ZAEH: Record<string, string> = { "v:giftmade": "3", "v:sporenhuelle": "4", "v:frostfang": "12" };
const motor = () => SM.erstelle(MAP1, { werte: (d: { karte: string; werte?: Record<string, string> }) => d.werte || { tough: VORLAGE_ZAEH[d.karte] || "1", size: "1" }, stufe: () => 2, zufall: () => 0.5 });
const bisTyp = (m: Motor, s: Spielstand, id: string, max = 40) => { for (let i = 0; i < max && s.schritt !== id; i++) m.weiter(s); return s.schritt; };

describe("Kartenschmiede – Spielmotor (Moosgrab Map 1)", () => {
  it("hat in Map 1 keine kaputten Verweise", () => {
    expect(SM.pruefe(MAP1)).toEqual([]);
  });

  it("spielt den Weg mit der Frau, dem Boss und dem Anhänger bis zum Ende", () => {
    const m = motor(), s = m.neu();
    expect(s.schritt).toBe("vorb-material");
    expect(bisTyp(m, s, "spieler-runde1")).toBe("spieler-runde1");
    expect(s.leisten.sporenuhr).toEqual({ wert: 3, aktiv: true });
    // Der ganze Tisch steht schon vor dem Intro
    expect(s.verlauf.indexOf("aufbau-tisch")).toBeLessThan(s.verlauf.indexOf("cue-e0"));
    expect(s.flags.oben_aufgebaut).toBe(true);
    m.runde(s);
    expect(s.leisten.sporenuhr.wert).toBe(2);
    m.weiter(s);
    expect(s.schritt).toBe("cue-01b3");
    m.weiter(s);
    expect(s.schritt).toBe("kampf-sporenlinge");
    expect(s.gegner.map(g => g.id)).toEqual(["sporenling-klein", "sporenling-zaeh", "sporenling-klein", "sporenling-zaeh"]);
    expect(m.wuetend(s)).toBe(false);
    m.ereignis(s, "marker2");
    expect(m.wuetend(s)).toBe(true);
    expect(s.letzte[0].vorlesen).toContain("Pilze");
    // Die Quelle erscheint erst nach Marker 3
    m.ereignis(s, "marker3");
    expect(s.gegner.some(g => g.id === "quelle")).toBe(true);
    m.ereignis(s, "frau-erreicht");
    expect(s.schritt).toBe("cue-01b4a");
    expect(s.leisten.sporenuhr.aktiv).toBe(false);
    m.weiter(s); m.weiter(s);
    expect(s.schritt).toBe("wahl-frau");
    m.waehle(s, "2", "Krieger");
    expect(s.flags.name_verraten).toBe("Krieger");
    expect(s.schritt).toBe("frau-antwort-2");
    // Während sie aufblüht: Angreifen gibt den ersten Schlag, aber sie startet wütend
    expect(bisTyp(m, s, "wahl-aufbluehen")).toBe("wahl-aufbluehen");
    m.waehle(s, "2");
    expect(s.flags.aufbluehen_angriff).toBe(true);
    expect(bisTyp(m, s, "kampf-erbluehte")).toBe("kampf-erbluehte");
    expect(m.wuetend(s)).toBe(true);
    const boss = s.gegner.find(g => g.id === "erbluehte")!;
    expect(boss.zaeh).toBe(10);
    m.schaden(s, boss.uid, 5);
    expect(m.zustand(boss).id).toBe("verwundet");
    m.schaden(s, boss.uid, 4);
    expect(m.zustand(boss).id).toBe("am Ende");
    m.schaden(s, boss.uid, 1);
    expect(s.flags.boss_gefallen).toBe(true);
    m.weiter(s);
    expect(s.schritt).toBe("cue-01b5");
    m.weiter(s);
    expect(s.schritt).toBe("wahl-anhaenger");
    const atemVorher = s.leisten.atemzug.wert;
    m.waehle(s, "2", "Kleriker");
    expect(s.flags.anhaenger_traeger).toBe("Kleriker");
    expect(s.leisten.atemzug.wert).toBe(atemVorher + 1);
    m.weiter(s);
    expect(s.schritt).toBe("wahl-nachsuche");
    m.waehle(s, "1");
    expect(s.flags.alle_marker).toBe(true);
    expect(s.flags.nachsuche).toBe(1);
    expect(s.schritt).toBe("ende-map1");
    expect(m.epListe(s).filter(e => e.erreicht).reduce((n, e) => n + e.ep, 0)).toBe(3);
    expect(m.folgen(s).join(" ")).toContain("Kellerschlüssel");
    expect(m.uebernahme(s).flags.name_verraten).toBe("Krieger");
  });

  it("lässt Chris abhaken, was Lene verrät, und die Folgen treten ein", () => {
    type M = Motor & { erfahre(s: Spielstand, f: string, i: number, an: boolean): unknown; wissen(s: Spielstand, f: string): boolean[]; aufgedeckt(s: Spielstand): string[] };
    const m = motor() as unknown as M, s = m.neu();
    bisTyp(m, s, "kampf-sporenlinge");
    m.ereignis(s, "frau-erreicht"); m.weiter(s);
    expect(s.schritt).toBe("npc-frau");
    expect(m.wissen(s, "frau")).toEqual([false, false, false, false]);
    // Das Licht in der Ruine: die Quelle ist sofort aufgedeckt und als Gegner am Tisch, ohne Marker 3
    m.erfahre(s, "frau", 3, true);
    expect(m.aufgedeckt(s)).toContain("Q");
    expect(s.gegner.some(g => g.id === "quelle")).toBe(true);
    // Der Name: wirkt wie die Antwort 1 (Map 2 kennt Lene)
    m.erfahre(s, "frau", 0, true);
    expect(s.flags.frau_name).toBe("Lene");
    m.erfahre(s, "frau", 0, false);
    expect(s.flags.frau_name).toBe(null);
    // Was eine Wahl schon gesetzt hat, steht als Haken da
    m.weiter(s);
    m.waehle(s, "3");
    expect(m.wissen(s, "frau")[2]).toBe(true);
  });

  it("springt bei abgelaufener Sporenuhr von selbst zum Aufblühen, und Zurück stellt alles wieder her", () => {
    const m = motor(), s = m.neu();
    bisTyp(m, s, "spieler-runde1");
    m.runde(s); m.weiter(s); m.weiter(s);
    expect(s.schritt).toBe("kampf-sporenlinge");
    const g = s.gegner[0];
    m.schaden(s, g.uid, 2);
    expect(s.gegner[0].wunden).toBe(2);
    m.zurueck(s);
    expect(s.gegner[0].wunden).toBe(0);
    m.runde(s);
    const r = m.runde(s);
    expect(s.leisten.sporenuhr.wert).toBe(0);
    expect(r.sprung).toBe("uhr-null");
    expect(s.schritt).toBe("uhr-null");
    expect(s.flags.frau_erreicht).toBe(false);
    // Ab der dritten beendeten Runde wütend
    expect(s.flags.gegner_wuetend).toBe(true);
    // Der Wald hat sie bekommen: ein Strich Atemzug, dann zuerst die Wahl, danach der Track
    expect(s.leisten.atemzug.wert).toBe(1);
    m.weiter(s);
    expect(s.schritt).toBe("wahl-aufbluehen");
    m.waehle(s, "1");
    expect(bisTyp(m, s, "cue-01b4b")).toBe("cue-01b4b");
  });

  it("überspringt die Nachsuche, wenn schon alle Marker gefunden sind", () => {
    const m = motor(), s = m.neu();
    bisTyp(m, s, "spieler-runde1");
    for (const e of ["marker1", "marker2", "marker3"]) m.ereignis(s, e);
    expect(s.flags.alle_marker).toBe(true);
    expect(m.ereignis(s, "marker1")).toBeNull();
    m.ereignis(s, "frau-erreicht");
    bisTyp(m, s, "wahl-frau");
    m.waehle(s, "1");
    bisTyp(m, s, "wahl-aufbluehen");
    m.waehle(s, "1");
    bisTyp(m, s, "wahl-anhaenger");
    m.waehle(s, "3");
    m.weiter(s);
    expect(s.schritt).toBe("ende-map1");
  });
});

// Alles, was Chris vorliest oder ansagt (nicht die GM-Notizen): Hier dürfen keine Tabu-Wörter der Kampagne stehen
const LAUT = ["vorlesen", "einstieg", "ansage", "kern", "zustandSaetze", "bedrohungSatz", "spieler", "titel", "kurz", "name", "info"];
function lauteTexte(knoten: unknown, schluessel = "", aus: string[] = []): string[] {
  if (typeof knoten === "string") { if (LAUT.includes(schluessel)) aus.push(knoten); return aus; }
  if (Array.isArray(knoten)) { for (const x of knoten) lauteTexte(x, schluessel, aus); return aus; }
  if (knoten && typeof knoten === "object") for (const [k, v] of Object.entries(knoten)) if (!["gmNotiz", "notiz", "hinweis", "hinweise", "quelle", "text", "folge"].includes(k)) lauteTexte(v, LAUT.includes(k) ? k : schluessel === "zustandSaetze" ? "zustandSaetze" : k, aus);
  return aus;
}
describe("Kartenschmiede – Spielmodus ohne Spoiler", () => {
  for (const datei of ["map1", "map2", "map3", "map4", "map5"]) {
    it(`${datei}: kein Tabu-Wort in Vorlese- und Ansagetexten`, () => {
      const m = JSON.parse(fs.readFileSync(path.join(__dirname, `../apps/kartenschmiede/kampagnen/moosgrab/${datei}.json`), "utf8"));
      const texte = lauteTexte({ schritte: m.schritte, ereignisse: m.ereignisse, figuren: m.figuren, gegner: m.gegner, auftraege: m.auftraege, antreiben: m.antreiben, audio: m.audio, rundenwurf: m.rundenwurf, leisten: m.leisten });
      expect(texte.length).toBeGreaterThan(50);
      for (const wort of ["Station", "Labor", "Soldat", "Myzel", "Marine", "Forschung", "Experiment", "Thousand", "Rubric", "Sorcerer", "Reaktor"]) {
        expect(texte.filter(t => t.includes(wort)), wort).toEqual([]);
      }
      expect(texte.filter(t => /\d\s*(Zoll|")/.test(t)), "Zoll-Angaben").toEqual([]);
    });
  }
});

const MAP2 = JSON.parse(fs.readFileSync(path.join(__dirname, "../apps/kartenschmiede/kampagnen/moosgrab/map2.json"), "utf8"));
describe("Kartenschmiede – Spielmotor (Moosgrab Map 2)", () => {
  const motor2 = () => SM.erstelle(MAP2, { werte: (d: { karte: string; werte?: Record<string, string> }) => d.werte || { tough: VORLAGE_ZAEH[d.karte] || "1", size: "1" }, stufe: () => 2, zufall: () => 0.5 });
  it("hat in Map 2 keine kaputten Verweise und gehört zur selben Kampagne", () => {
    expect(SM.pruefe(MAP2)).toEqual([]);
    expect(MAP2.kampagne).toBe(MAP1.kampagne);
    expect(MAP2.map).toBe(2);
  });
  it("nimmt Sporenpunkte und Beute der Helden in die nächste Map mit", () => {
    const m1 = motor() as unknown as Motor & { sporen(s: Spielstand, h: string, d: number): void; gibBeute(s: Spielstand, h: string, x: string): void };
    const s1 = m1.neu();
    m1.sporen(s1, "Krieger", 1); m1.sporen(s1, "Krieger", 2);
    m1.gibBeute(s1, "Schurke", "Heiltrank");
    const s2 = motor2().neu({ uebernahme: m1.uebernahme(s1) }) as unknown as { sporen: Record<string, number>; inventar: Record<string, string[]> };
    expect(s2.sporen.Krieger).toBe(3);
    expect(s2.inventar.Schurke).toEqual(["Heiltrank"]);
  });
  it("gibt jedem Kampf Gegnerpunkte wie in OPR (Heldenpunkte × 25/50/75/100 %) und lässt die Werte, wie sie sind", () => {
    type M = Motor & { wahlLeisten(s: Spielstand, o: unknown): Record<string, number>; effektiveWerte(s: Spielstand, g: unknown): Record<string, string>;
      schwierigkeit(s: Spielstand): { id: string }; springe(s: Spielstand, id: string): void; budgetVon(s: Spielstand, id: string): { ziel: number; summe: number } | null };
    // Jeder Gegner ohne eigene Werte kostet 25 Punkte, die Erblühte 130
    const punkte = (w: Record<string, string>) => (w.name === "Die Erblühte" ? 130 : 25);
    const werte = (d: { werte?: Record<string, string> }) => d.werte || { tough: "3", quality: "5+" };
    const m = SM.erstelle(MAP2, { werte, punkte, stufe: () => 2, zufall: () => 0.5 }) as unknown as M;
    const stufen = ["anfaenger", "fortgeschritten", "experte", "legendaer"];
    const neu = (mm: M, st: string, hp = 340) => mm.neu({ schwierigkeit: st, heldenpunkte: hp });
    const ids = (mm: M, s: Spielstand, id: string) => { mm.springe(s, id); return (s as unknown as { gegner: Array<{ id: string }> }).gegner.map(x => x.id); };
    // Die Map ist für 340 Heldenpunkte auf Fortgeschritten (50 %) geschrieben. Die sieben Knienden sind das Dorf und
    // bleiben sieben; mehr Punkte heißt mehr Grabgänger (25 Punkte je Figur)
    const zahl = (x: string[], id: string) => x.filter(y => y === id).length;
    const erloesen = stufen.map(st => ids(m, neu(m, st), "kampf-erloesen"));
    expect(erloesen.map(x => zahl(x, "gemeinde"))).toEqual([7, 7, 7, 7]);
    expect(erloesen.map(x => zahl(x, "grabgaenger"))).toEqual([0, 0, 4, 7]);
    // Die Gemeinde erwacht: auf Normal die sieben, die Grabgänger kommen erst je Rundenende nach (höchstens 3)
    const gemeinde = stufen.map(st => zahl(ids(m, neu(m, st), "kampf-gemeinde"), "grabgaenger"));
    expect(gemeinde).toEqual([0, 0, 4, 7]);
    const sn = neu(m, "fortgeschritten"); ids(m, sn, "kampf-gemeinde");
    for (let r = 0; r < 5; r++) m.runde(sn);
    expect(zahl((sn as unknown as { gegner: Array<{ id: string }> }).gegner.map(g => g.id), "grabgaenger")).toBe(3);
    // Mehr Heldenpunkte, mehr Gegner – wie in OPR, wenn die Gruppe wächst
    expect(zahl(ids(m, neu(m, "fortgeschritten", 680), "kampf-gemeinde"), "grabgaenger")).toBe(7);
    const s = neu(m, "experte"); ids(m, s, "kampf-erloesen");
    expect(m.budgetVon(s, "kampf-erloesen")).toMatchObject({ ziel: 263, summe: 275 });
    // „Die drei stehen auf“ bleibt bei drei, egal auf welcher Stufe
    for (const st of stufen) expect(ids(m, neu(m, st), "kampf-drei").length).toBe(3);
    // Die Werte ändern sich nie
    const g = { uid: "t", id: "gemeinde", wunden: 0, zaeh: 3 };
    for (const st of stufen) expect(m.effektiveWerte(neu(m, st), g)).toEqual(m.effektiveWerte(neu(m, "fortgeschritten"), g));
    // Ein Boss bleibt immer; hat er Platz im Budget, füllen Begleiter den Rest
    const m1 = SM.erstelle(MAP1, { werte, punkte, stufe: () => 2, zufall: () => 0.5 }) as unknown as M;
    expect(ids(m1, neu(m1, "anfaenger"), "kampf-erbluehte")).toEqual(["erbluehte"]);
    expect(ids(m1, neu(m1, "fortgeschritten"), "kampf-erbluehte")).toEqual(["erbluehte"]);
    expect(ids(m1, neu(m1, "legendaer"), "kampf-erbluehte")).toEqual(["erbluehte", ...Array(5).fill("sporenling-klein")]);
    // Ohne Heldenpunkte (oder ohne Punkteberechnung) bleibt alles, wie die Map es schreibt
    expect(ids(m, m.neu({ schwierigkeit: "legendaer" }), "kampf-gemeinde").length).toBe(7);
  });
  it("lässt Antworten je nach Schwierigkeit stärker oder schwächer wirken und übernimmt die Stufe", () => {
    type M = Motor & { wahlLeisten(s: Spielstand, o: unknown): Record<string, number>; schwierigkeit(s: Spielstand): { id: string } };
    const m = SM.erstelle(MAP2, { werte: (d: { werte?: Record<string, string> }) => d.werte || { tough: "3", quality: "5+" }, stufe: () => 2, zufall: () => 0.5 }) as unknown as M;
    const schonen = { leisten: { geduld: -1 } }, anhaenger = { leisten: { geduld: 1 } }, laut = { leisten: { laerm: 2 } };
    const normal = m.neu(), schwer = m.neu({ schwierigkeit: "experte" }), leicht = m.neu({ schwierigkeit: "anfaenger" }), alb = m.neu({ schwierigkeit: "legendaer" });
    expect(m.schwierigkeit(normal).id).toBe("fortgeschritten");
    expect(m.wahlLeisten(normal, schonen)).toEqual({ geduld: -1 });
    expect(m.wahlLeisten(schwer, schonen)).toEqual({ geduld: -2 });
    expect(m.wahlLeisten(schwer, laut)).toEqual({ laerm: 3 });
    expect(m.wahlLeisten(leicht, anhaenger)).toEqual({ geduld: 2 });
    expect(m.wahlLeisten(alb, anhaenger)).toEqual({ geduld: 0 });
    expect(m.schwierigkeit(m.neu({ uebernahme: m.uebernahme(alb) })).id).toBe("legendaer");
    // Ältere Spielstände mit den früheren Stufennamen
    expect(m.schwierigkeit(m.neu({ schwierigkeit: "schwer" })).id).toBe("experte");
  });
  it("zieht die Folgen aus Map 1 selbst, baut nur für Kämpfe auf und gibt dem Anhängerträger einen Sporenpunkt", () => {
    type M = Motor & { folgen(s: Spielstand): string[]; springe(s: Spielstand, id: string): void; heldenInfo(s: Spielstand, h: string): unknown[] };
    const m = motor2() as unknown as M;
    const s = m.neu({ uebernahme: { leisten: { atemzug: 2 }, flags: { anhaenger: true, anhaenger_traeger: "Krieger", hinweis_brunnen: true, name_verraten: "Schurke" }, sporen: { Krieger: 1 } } });
    expect((s as unknown as { sporen: Record<string, number> }).sporen).toEqual({ Krieger: 2, Schurke: 1 });
    expect(s.leisten.geduld.wert).toBeGreaterThan(MAP2.leisten.geduld.start || 0);
    expect(m.heldenInfo(s, "Krieger").length).toBe(1);
    bisTyp(m, s, "vorb-aus-map1");
    expect(m.folgen(s).join(" ")).toContain("Krieger trägt ihn");
    // Keine Fragen-Schritte mehr zwischen Übernahme und Friedhof
    m.weiter(s);
    expect(s.schritt).toBe("aufbau-aussen");
    // Die Glocke: erst Friedhof, dann Kapelle aufbauen, dann der Kampf
    bisTyp(m, s, "spieler-draussen");
    m.ereignis(s, "glocke");
    expect(s.schritt).toBe("aufbau-kampf-gemeinde-friedhof");
    m.weiter(s);
    expect(s.schritt).toBe("aufbau-kampf-gemeinde-innen");
    m.weiter(s);
    expect(s.schritt).toBe("kampf-gemeinde");
  });

  it("lässt Beute vom Grab fallen und Gegenstände wie den Anhänger zwischen Helden wandern", () => {
    type M = Motor & { springe(s: Spielstand, id: string): void; reiche(s: Spielstand, v: string, i: number, a: string): void; reicheMerkmal(s: Spielstand, f: string, a: string): void;
      gibBeute(s: Spielstand, h: string, x: string): void; heldenInfo(s: Spielstand, h: string): unknown[] };
    const m = motor2() as unknown as M;
    const s = m.neu({ uebernahme: { leisten: {}, flags: { anhaenger: true, anhaenger_traeger: "Krieger" } } });
    m.springe(s, "kampf-grab");
    const grab = (s as unknown as { gegner: Array<{ id: string; uid: string; zaeh: number }> }).gegner.find(g => g.id === "grab")!;
    m.schaden(s, grab.uid, grab.zaeh);
    const tod = s.letzte.find(e => e.id === `tod:${grab.uid}`) as unknown as { beutewurf: boolean; beute: string[] };
    expect(tod.beutewurf).toBe(true);
    expect(tod.beute).toEqual(["Ehering vom zuckenden Grab"]);
    m.gibBeute(s, "Schurke", tod.beute[0]);
    m.reiche(s, "Schurke", 0, "Kleriker");
    const inv = (s as unknown as { inventar: Record<string, string[]> }).inventar;
    expect(inv.Schurke).toEqual([]);
    expect(inv.Kleriker).toEqual(["Ehering vom zuckenden Grab"]);
    m.reicheMerkmal(s, "anhaenger_traeger", "Waldläufer");
    expect(s.flags.anhaenger_traeger).toBe("Waldläufer");
    expect(m.heldenInfo(s, "Krieger").length).toBe(0);
    expect(m.heldenInfo(s, "Waldläufer").length).toBe(1);
  });

  it("übernimmt Anhänger und Atemzug aus Map 1", () => {
    const m1 = motor(), s1 = m1.neu();
    s1.flags.anhaenger = true; s1.flags.anhaenger_traeger = "Krieger"; s1.leisten.atemzug.wert = 2;
    const s2 = motor2().neu({ uebernahme: m1.uebernahme(s1) });
    expect(s2.flags.anhaenger).toBe(true);
    expect(s2.flags.anhaenger_traeger).toBe("Krieger");
    expect(s2.leisten.atemzug.wert).toBe(2);
  });
  it("kommt ohne Kampf bis zum Ende, wenn die Helden leise bleiben", () => {
    const m = motor2(), s = m.neu();
    for (let i = 0; i < 120 && s.schritt !== "ende-map2"; i++) {
      const st = (MAP2.schritte as Record<string, { typ: string; optionen?: Array<{ taste: string; eingabe?: unknown }> }>)[s.schritt];
      if (st.typ === "wahl") { const o = st.optionen!.find(x => !x.eingabe) || st.optionen![0]; m.waehle(s, o.taste, "Krieger"); } else m.weiter(s);
    }
    expect(s.schritt).toBe("ende-map2");
    expect(s.gegner.filter(g => (g as { id: string }).id === "gemeinde")).toHaveLength(0);
  });
});

// Kleine Testmap für die Bausteine, die Map 1 und Map 2 gemeinsam nutzen
type SpielEintrag = { id: string; name: string; art?: string; probe?: { wurf: number | null; stufen: Array<{ ab: number; vorlesen: string }> } };
type Stand2 = Spielstand & { letzte: SpielEintrag[]; pos: Record<string, { x: number; y: number }>; rundenwurfRunde?: number };
type Motor2 = {
  neu(): Stand2; weiter(s: Stand2): unknown; zurueck(s: Stand2): boolean; runde(s: Stand2): unknown; ereignis(s: Stand2, id: string): unknown;
  schaden(s: Stand2, uid: string, d: number): unknown; probe(s: Stand2, i: number, w: number): { wurf: number } | null;
  rundenwurf(s: Stand2, w: number): { wurf: number; titel?: string } | null; zustand(g: { wunden: number; zaeh: number; id: string }): { id: string; satz: string };
  lage(s: Stand2): { sonderregeln: Array<{ titel: string }>; ziele: Array<{ ist: boolean }> }; setzePos(s: Stand2, k: string, x: number, y: number): void;
  aufgedeckt(s: Stand2): string[]; figurenAmTisch(s: Stand2): Array<{ id: string }>;
};
const MINI = {
  kampagne: "Test", map: 9, titel: "Mini", start: "a",
  leisten: { laerm: { name: "Lärm", min: 0, max: 6, start: 0, schwellen: [{ ab: 3, titel: "Sie drehen sich um", setzt: { umgedreht: true } }, { ab: 6, titel: "Alle wach", springe: "kampf" }] } },
  flags: { angegriffen: { start: false, text: "Angegriffen" }, umgedreht: { start: false }, gefunden: { start: false, text: "Gefunden" } },
  figuren: { frau: { name: "Die Frau", tisch: { x: 2, y: 2, ab: { flag: "umgedreht" }, bis: { flag: "angegriffen" } } } },
  tischplan: { aufdecken: { "falltuer:F": { flag: "gefunden" } } },
  lage: { sonderregeln: [{ titel: "Immer" }, { titel: "Nach Angriff", wenn: { flag: "angegriffen" } }], ziele: [{ art: "Hauptziel", text: "finden", erreicht: { flag: "gefunden" } }] },
  antreiben: [{ titel: "Ein Ast knackt", vorlesen: "Hinter euch knackt ein Ast." }, { titel: "Nur im Kampf", schritte: ["kampf"] }],
  rundenwurf: { name: "Wald", tabelle: [{ w: [1], titel: "Wind", setzt: { gefunden: true } }, { w: [2, 3, 4, 5, 6], titel: "Nichts" }] },
  ereignisse: {
    marker: { name: "Marker", taste: "1", vorlesen: "Ein Reh.", marker: "1", probe: { stufen: [{ ab: 3, vorlesen: "Pilze." }, { ab: 5, vorlesen: "Die Tiere zuerst.", setzt: { gefunden: true } }] } },
    laut: { name: "Laut", leisten: { laerm: 2 } },
    angriff: { name: "Angriff", setzt: { angegriffen: true } },
  },
  gegner: { boss: { name: "Boss", werte: { tough: "3" }, zusatz: [{ wenn: { flag: "angegriffen" }, text: "Wütend", zaeh: 2 }], tod: { vorlesen: "Sie sackt zusammen.", setzt: { boss_tot: true } } } },
  schritte: {
    a: { typ: "spieler", titel: "A", ereignisse: ["marker", "laut", "angriff"], runden: true, zeitlimit: 5, weiter: "kampf" },
    kampf: { typ: "kampf", titel: "Kampf", gegner: [{ id: "boss", anzahl: 1 }], ende: [{ wenn: { gegnerGefallen: "boss" }, ziel: "ende" }], weiter: "ende" },
    ende: { typ: "ende", titel: "Ende" },
  },
};
describe("Kartenschmiede – Spielmotor: Proben, Schwellen, Tod, Lage", () => {
  it("zählt Aktivierungen je Runde, würfelt Verhalten und stuft Befall ab", () => {
    const m = mini() as unknown as Motor2 & { aktiviere(s: Stand2, k: string, an?: boolean): void; verhaltenWurf(s: Stand2): { wurf: number; text: string }; befall(n: number): { stufe: string; wuerfel: number } };
    const s = m.neu() as Stand2 & { aktiviert: Record<string, boolean> };
    m.aktiviere(s, "held:Krieger");
    m.aktiviere(s, "g:x");
    expect(s.aktiviert).toEqual({ "held:Krieger": true, "g:x": true });
    m.aktiviere(s, "g:x");
    expect(s.aktiviert["g:x"]).toBe(false);
    m.runde(s);
    expect(s.aktiviert).toEqual({});
    expect(m.verhaltenWurf(s).wurf).toBe(1);
    expect([m.befall(2).wuerfel, m.befall(3).wuerfel, m.befall(5).wuerfel]).toEqual([4, 3, 2]);
  });
  it("stärkt und schwächt Gegner, holt Gegner dazu und lässt NPCs kämpfen", () => {
    type G = { uid: string; id: string; zaeh: number };
    const m = SM.erstelle(JSON.parse(JSON.stringify(MINI)), { werte: (d: { werte: Record<string, string> }) => d.werte, stufe: () => 1, zufall: () => 0 }) as unknown as Motor2 & {
      effektiveWerte(s: Stand2, g: G): Record<string, string>; modText(s: Stand2, g: G): Array<{ text: string }>; passeGegnerAn(s: Stand2, z: { uid?: string; typ?: string }, mod: Record<string, unknown>, t: string): void;
      fuegeGegnerHinzu(s: Stand2, id: string, n: number, zone: string, def?: unknown): G[]; npcAlsGegner(s: Stand2, id: string): G | null; figurenAmTisch(s: Stand2): Array<{ id: string }>;
    };
    const s = m.neu();
    m.weiter(s);
    const boss = s.gegner[0] as G;
    m.passeGegnerAn(s, { uid: boss.uid }, { quality: 1, tough: 2, passives: ["Dornen"] }, "stärker");
    expect(m.effektiveWerte(s, boss)).toMatchObject({ tough: "5", passives: "Dornen" });
    expect(boss.zaeh).toBe(5);
    expect(m.modText(s, boss).map(x => x.text)).toContain("Dornen");
    const neu = m.fuegeGegnerHinzu(s, "boss", 2, "", undefined);
    expect(neu).toHaveLength(2);
    expect(neu[0].zaeh).toBe(3);
    m.passeGegnerAn(s, { typ: "boss" }, { tough: -1 }, "alle schwächer");
    expect(neu[0].zaeh).toBe(2);
    expect(m.fuegeGegnerHinzu(s, "boss", 1, "", undefined)[0].zaeh).toBe(2);
    const v = m.fuegeGegnerHinzu(s, "v-wolf", 1, "", { name: "Wolf", werte: { tough: "4", quality: "4+", weapons: "Biss | Nahkampf | A2 | " } })[0];
    m.passeGegnerAn(s, { uid: v.uid }, { attacks: 1, quality: 1 }, "Rudel");
    expect(m.effektiveWerte(s, v)).toMatchObject({ quality: "3+", weapons: "Biss | Nahkampf | A3 | " });
    s.flags.umgedreht = true;
    expect(m.figurenAmTisch(s).map(f => f.id)).toEqual(["frau"]);
    const frau = m.npcAlsGegner(s, "frau")!;
    expect(frau.id).toBe("npc-frau");
    expect(m.figurenAmTisch(s)).toEqual([]);
    expect(m.npcAlsGegner(s, "frau")).toBeNull();
    expect((s as unknown as { log: Array<{ art: string }> }).log.filter(e => e.art === "gegner").length).toBeGreaterThanOrEqual(5);
  });
  it("führt ein Log mit Leisten- und Entscheidungsänderungen, ein Inventar und Antreiber nach Zeitlimit", () => {
    let uhr = 0;
    const m = SM.erstelle(MINI, { werte: (d: { werte: Record<string, string> }) => d.werte, stufe: () => 1, zufall: () => 0, jetzt: () => uhr }) as unknown as Motor2 & {
      gibBeute(s: Stand2, h: string, x: string): void; benutze(s: Stand2, h: string, i: number): void; antreiber(s: Stand2): Array<{ titel: string }>; zeitlimit(s: Stand2): number; minuten(s: Stand2): number;
    };
    const s = m.neu() as Stand2 & { log: Array<{ art: string; text: string; leisten: Array<{ name: string; alt: number; neu: number }>; flags: Array<{ text: string }> }>; inventar: Record<string, string[]> };
    m.ereignis(s, "laut");
    m.ereignis(s, "angriff");
    expect(s.log.map(e => e.text)).toEqual(["Laut", "Angriff"]);
    expect(s.log[0].leisten).toEqual([{ id: "laerm", name: "Lärm", alt: 0, neu: 2 }]);
    expect(s.log[1].flags.map(f => f.text)).toEqual(["Angegriffen"]);
    m.gibBeute(s, "Krieger", "Heiltrank");
    expect(s.inventar.Krieger).toEqual(["Heiltrank"]);
    m.benutze(s, "Krieger", 0);
    expect(s.inventar.Krieger).toEqual([]);
    expect(s.log.filter(e => e.art === "beute")).toHaveLength(2);
    expect(m.zeitlimit(s)).toBe(5);
    uhr = 6 * 60000;
    expect(m.minuten(s)).toBe(6);
    expect(m.antreiber(s).map(a => a.titel)).toEqual(["Ein Ast knackt"]);
    m.weiter(s);
    expect(m.minuten(s)).toBe(0);
    expect(m.zeitlimit(s)).toBe(0);
    expect(m.antreiber(s).map(a => a.titel)).toEqual(["Ein Ast knackt", "Nur im Kampf"]);
  });
  const mini = () => SM.erstelle(MINI, { werte: (d: { werte: Record<string, string> }) => d.werte, stufe: () => 1, zufall: () => 0 }) as unknown as Motor2;
  it("hat in der Testmap keine kaputten Verweise", () => {
    expect(SM.pruefe(MINI)).toEqual([]);
    expect(SM.pruefe({ ...MINI, rundenwurf: { name: "x", tabelle: [{ w: [1] }] } })).toContain("Rundenwurf: 2 fehlt in der Tabelle");
  });
  it("legt bei einer Probe die Stufen bis zum Wurf frei, mit Wirkung", () => {
    const m = mini(), s = m.neu();
    m.ereignis(s, "marker");
    expect(s.letzte[0].probe?.wurf).toBeNull();
    m.probe(s, 0, 4);
    expect(s.letzte[0].probe?.stufen.map(x => x.vorlesen)).toEqual(["Pilze."]);
    expect(s.flags.gefunden).toBe(false);
    m.zurueck(s);
    m.probe(s, 0, 5);
    expect(s.letzte[0].probe?.stufen).toHaveLength(2);
    expect(s.flags.gefunden).toBe(true);
    expect(m.aufgedeckt(s)).toEqual(["falltuer:F"]);
    expect(m.lage(s).ziele[0].ist).toBe(true);
    expect(m.probe(s, 0, 6)).toBeNull();
  });
  it("löst Schwellen einmal aus und springt bei der letzten in den Kampf", () => {
    const m = mini(), s = m.neu();
    m.ereignis(s, "laut");
    expect(s.flags.umgedreht).toBe(false);
    m.ereignis(s, "laut");
    expect(s.flags.umgedreht).toBe(true);
    expect(s.letzte.some(e => e.art === "schwelle")).toBe(true);
    expect(m.figurenAmTisch(s).map(f => f.id)).toEqual(["frau"]);
    m.ereignis(s, "laut");
    expect(s.schritt).toBe("kampf");
    expect(s.letzte.filter(e => e.art === "schwelle")).toHaveLength(2);
  });
  it("gibt Zusatzregeln aus Entscheidungen weiter und zeigt den Todestext", () => {
    const m = mini(), s = m.neu();
    m.ereignis(s, "angriff");
    expect(m.lage(s).sonderregeln.map(r => r.titel)).toEqual(["Immer", "Nach Angriff"]);
    expect(m.figurenAmTisch(s)).toEqual([]);
    m.weiter(s);
    const boss = s.gegner[0];
    expect(boss.zaeh).toBe(5);
    m.schaden(s, boss.uid, 5);
    expect(m.zustand(boss).satz).toBe("Sie sackt zusammen.");
    expect(s.flags.boss_tot).toBe(true);
    expect(s.letzte.some(e => e.art === "tod")).toBe(true);
  });
  it("würfelt am Rundenende und lässt Figurenpositionen beim Zurück stehen", () => {
    const m = mini(), s = m.neu();
    m.runde(s);
    const r = m.rundenwurf(s, 1);
    expect(r?.titel).toBe("Wind");
    expect(s.rundenwurfRunde).toBe(1);
    expect(s.flags.gefunden).toBe(true);
    m.setzePos(s, "held:A", 3, 4);
    m.zurueck(s);
    expect(s.flags.gefunden).toBe(false);
    expect(s.pos["held:A"]).toEqual({ x: 3, y: 4 });
  });
});

// Map 3 bis 5: jede Map für sich heil, und die Kampagne läuft als Kette von Map 1 bis zum Ende
type Stand5 = { schritt: string; flags: Record<string, unknown>; inventar: Record<string, string[]>; kampfZiel: unknown; rundenAktiv: boolean;
  letzte: Array<{ id?: string; probe?: { wurf: number | null }; beute?: string[] }>; gegner: Array<{ uid: string; id: string; wunden: number; zaeh: number; weg: boolean }> };
type Kette = { neu(o?: Record<string, unknown>): Stand5; schritt(s: Stand5): { typ: string; ereignisse?: string[] }; optionen(s: Stand5): Array<{ taste: string; eingabe?: { aus?: string } }>;
  waehle(s: Stand5, taste: string, eingabe?: string): unknown; weiter(s: Stand5): unknown; runde(s: Stand5): { texte: string[] }; ereignis(s: Stand5, id: string): unknown;
  schaden(s: Stand5, uid: string, d: number): unknown; probe(s: Stand5, i: number, w: number): unknown; ereignisErlaubt(s: Stand5, id: string): boolean; istFreund(id: string): boolean;
  abschliessen(s: Stand5): void; offeneMarker(s: Stand5): string[]; uebernahme(s: Stand5): unknown };
const MAPS = [1, 2, 3, 4, 5].map(n => JSON.parse(fs.readFileSync(path.join(__dirname, `../apps/kartenschmiede/kampagnen/moosgrab/map${n}.json`), "utf8")));
describe("Kartenschmiede – Spielmotor (Moosgrab Map 3 bis 5)", () => {
  it("hat in jeder Map keine kaputten Verweise und zählt die Maps durch", () => {
    for (const [i, m] of MAPS.entries()) {
      expect(SM.pruefe(m), `map${i + 1}`).toEqual([]);
      expect(m.kampagne).toBe("moosgrab");
      expect(m.map).toBe(i + 1);
    }
    expect(MAPS[4].kampagnenEnde).toBe(true);
  });
  it("spielt die Kampagne mit Zufallsläufen von Map 1 bis zum Ende von Map 5", () => {
    let seed = 11;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    let uebernahmen: unknown[] = [];
    for (const map of MAPS) {
      const m = SM.erstelle(map, { werte: (d: { karte: string; werte?: Record<string, string> }) => d.werte || { tough: "3", quality: "5+" }, stufe: () => 2, zufall: rnd }) as unknown as Kette;
      const neu: typeof uebernahmen = [];
      for (let lauf = 0; lauf < 40; lauf++) {
        const s = m.neu({ uebernahme: uebernahmen[lauf % Math.max(1, uebernahmen.length)] || null, schwierigkeit: ["anfaenger", "fortgeschritten", "experte", "legendaer"][lauf % 4] });
        for (let i = 0; i < 500 && m.schritt(s).typ !== "ende"; i++) {
          const st = m.schritt(s), r = rnd();
          const offen = s.letzte.findIndex(e => e.probe && !e.probe.wurf);
          if (offen >= 0) { m.probe(s, offen, 1 + Math.floor(rnd() * 6)); continue; }
          if (st.typ === "wahl") {
            const opts = m.optionen(s), o = opts[Math.floor(rnd() * opts.length)];
            const ein = o.eingabe ? (o.eingabe.aus === "offene-marker" ? m.offeneMarker(s)[0] : "Krieger") : undefined;
            if (o.eingabe && !ein) m.waehle(s, opts.find(x => !x.eingabe)?.taste || o.taste, "Krieger"); else m.waehle(s, o.taste, ein);
            continue;
          }
          const evs = (st.ereignisse || []).filter(id => m.ereignisErlaubt(s, id));
          if (evs.length && r < 0.35) { m.ereignis(s, evs[Math.floor(rnd() * evs.length)]); continue; }
          if (st.typ === "kampf") {
            const lebend = s.gegner.filter(g => !g.weg && g.wunden < g.zaeh && !m.istFreund(g.id));
            if (!s.kampfZiel && r < 0.55 && lebend.length) { m.schaden(s, lebend[Math.floor(rnd() * lebend.length)].uid, 2); continue; }
            if (!s.kampfZiel && r < 0.8 && s.rundenAktiv) { m.runde(s); continue; }
          } else if (s.rundenAktiv && r < 0.45) { m.runde(s); continue; }
          m.weiter(s);
        }
        expect(m.schritt(s).typ, `map${map.map} hängt in ${s.schritt}`).toBe("ende");
        m.abschliessen(s);
        neu.push(m.uebernahme(s));
      }
      uebernahmen = neu;
    }
  });
});

describe("Kartenschmiede – Spielmotor: Bausteine für Map 3 bis 5", () => {
  const KARTE = {
    kampagne: "Test", map: 9, titel: "Bausteine", start: "w",
    leisten: { glut: { name: "Glut", min: 0, max: 6, start: 0 } },
    flags: { a: { start: false }, b: { start: false }, c: { start: false }, ausgeatmet: { start: false } },
    rundenende: [{ wenn: { flag: "a", ist: true }, ereignis: "atmen" }, { text: "Nur ein Hinweis" }],
    ereignisse: {
      atmen: { name: "Es atmet", setzt: { ausgeatmet: true } },
      suchen: { name: "Suchen", beute: ["Laterne"], probe: { stufen: [{ ab: 5, vorlesen: "Mehr", beute: ["Brecheisen"] }] } },
    },
    gegner: { freund: { name: "Freund", seite: "freund", werte: { tough: "6" } }, feind: { name: "Feind", werte: { tough: "3" } } },
    schritte: {
      w: { typ: "wahl", titel: "W", optionen: [{ taste: "1", kurz: "Immer" }, { taste: "2", kurz: "Mit Ring", wenn: { hat: "Ring" } },
        { taste: "3", kurz: "Zwei von drei", wenn: { mindestens: 2, aus: [{ flag: "a" }, { flag: "b" }, { flag: "c" }] } }], weiter: "k" },
      k: { typ: "kampf", titel: "K", ereignisse: ["suchen"], gegner: [{ id: "freund", anzahl: 1, wunden: 2 }, { id: "feind", anzahl: 1 }], weiter: "e" },
      e: { typ: "ende", titel: "E" },
    },
  };
  const bau = () => SM.erstelle(KARTE, { werte: (d: { werte: Record<string, string> }) => d.werte, stufe: () => 1, zufall: () => 0 }) as unknown as Kette;
  it("zeigt Antworten nur, wenn ihre Bedingung passt (Gegenstand, mindestens zwei von drei)", () => {
    const m = bau(), s = m.neu();
    expect(m.optionen(s).map(o => o.taste)).toEqual(["1"]);
    s.inventar.Krieger = ["Ring"];
    s.flags.a = true; s.flags.c = true;
    expect(m.optionen(s).map(o => o.taste)).toEqual(["1", "2", "3"]);
    s.inventar.Krieger = [];
    expect(m.waehle(s, "2")).toBeNull();
  });
  it("bringt Verbündete angeschlagen auf den Tisch und gibt Beute aus Ereignis und Probe", () => {
    const m = bau(), s = m.neu();
    m.waehle(s, "1");
    const freund = s.gegner.find(g => g.id === "freund")!;
    expect(freund.zaeh).toBe(6);
    expect(freund.wunden).toBe(2);
    m.ereignis(s, "suchen");
    expect(s.letzte[0].beute).toEqual(["Laterne"]);
    m.probe(s, 0, 6);
    expect(s.letzte[0].beute).toEqual(["Laterne", "Brecheisen"]);
  });
  it("löst am Rundenende Ereignisse von selbst aus und zeigt reine Hinweise", () => {
    const m = bau(), s = m.neu();
    m.waehle(s, "1");
    expect(m.runde(s).texte).toEqual(["Nur ein Hinweis"]);
    expect(s.flags.ausgeatmet).toBe(false);
    s.flags.a = true;
    m.runde(s);
    expect(s.flags.ausgeatmet).toBe(true);
    expect(s.letzte.some(e => e.id === "atmen")).toBe(true);
  });
});

describe("Kartenschmiede – Hedda stirbt nicht im Gewühl (Map 2 und 3)", () => {
  type HS = Stand5 & { verlauf: string[] };
  type HM = Kette & { npcAlsGegner(s: HS, id: string): { uid: string; zaeh: number } | null; betrete(s: HS, id: string): unknown };
  const neuMotor = (map: unknown) => SM.erstelle(map, { werte: (d: { werte?: Record<string, string> }) => d.werte || { tough: "3" }, stufe: () => 2, zufall: () => 0.5 }) as unknown as HM;
  it("flieht beim letzten Treffer ins Dunkel, die App geht zum Weg ins Dorf, nachsetzen tötet sie", () => {
    const m = neuMotor(MAPS[1]), s = m.neu() as HS;
    s.flags.falltuer_offen = true;
    m.betrete(s, "npc-hedda");
    const g = m.npcAlsGegner(s, "hedda")!;
    m.schaden(s, g.uid, g.zaeh);
    expect(s.flags.hedda_geflohen).toBe(true);
    expect(s.flags.hedda_tot).toBe(false);
    expect(s.gegner.find(x => x.uid === g.uid)!.weg).toBe(true);
    expect(s.schritt).toBe("hedda-weg-tot");
    expect(m.ereignisErlaubt(s, "hedda-nachsetzen")).toBe(true);
    m.ereignis(s, "hedda-nachsetzen");
    expect(s.flags.hedda_tot).toBe(true);
  });
  it("zeigt die geflohene Hedda in Map 3 an der Luke, und die Wirtin traut den Helden nicht", () => {
    const m = neuMotor(MAPS[2]);
    const s = m.neu({ uebernahme: { flags: { hedda_geflohen: true, hedda_schweigt: true, hedda_angegriffen: true, weg: "haupt" } } }) as HS;
    for (let i = 0; i < 30 && !s.verlauf.includes("wahl-knechte"); i++) { if (m.schritt(s).typ === "wahl") m.waehle(s, m.optionen(s)[0].taste); else m.weiter(s); }
    expect(s.verlauf).toContain("hedda-luke");
    expect(s.verlauf).not.toContain("hedda-dorfrand");
    m.betrete(s, "wirtin-hedda-lebt");
    expect(s.schritt).toBe("wirtin-hedda-geflohen");
    expect(s.flags.wirtin_vertraut).toBe(false);
  });
});
