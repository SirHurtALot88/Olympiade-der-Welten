/**
 * VERTRÄGE DER MODERNEN SAISONSTAND-ANSICHT (18.11.): dieselben Zusagen wie bei der klassischen, nur am
 * Quelltext von `SeasonStandingsModern.tsx` abgesichert (kein jsdom in dieser Suite). Die klassische
 * Ansicht bleibt unverändert und behält ihre eigenen Tests (`saisonstand-*`, `season-standings-*`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lies = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");
const MODERN = lies("app/foundation/season-v2/SeasonStandingsModern.tsx");
const CSS = lies("app/foundation/season-v2/saisonstand-modern.css");
const CLIENT = lies("app/foundation/season-v2/SeasonStandingsV2Client.tsx");
const LOOK = lies("lib/season/saisonstand-look.ts");

describe("Saisonstand modern: Verträge", () => {
  it("Punkte und Rang kommen aus der Zeile (Punkte enthalten Mutator, Rang ist liga-lokal) — nichts wird neu summiert", () => {
    expect(MODERN).toMatch(/zahl\(z\.points\)/);
    expect(MODERN).toMatch(/z\.rank \?\? "–"/);
    expect(MODERN).not.toMatch(/disciplineValues\)\.reduce|\.reduce\([^)]*points/);
  });
  it("Cash im Minus ist rot, im Plus ohne Auszeichnung", () => {
    expect(MODERN).toMatch(/\(z\.cash \?\? 0\) < 0 \? "is-neg" : undefined/);
    expect(MODERN).toMatch(/wert != null && wert < 0 \? " bc-minus"/);
    expect(CSS).toContain(".ssm .is-neg");
    const start = MODERN.indexOf('key: "cash"');
    const zelle = MODERN.slice(start, MODERN.indexOf("\n", start));
    expect(zelle).not.toContain("bc-plus");
  });
  it("alle Geldspalten der klassischen Tabelle stehen im Spaltensatz Verein", () => {
    for (const key of ['"kader"', '"mw"', '"cash"', '"sponsor"', '"salary"', '"gebaeude"', '"transfer"', '"guv"']) {
      expect(MODERN).toContain(`key: ${key}`);
    }
    expect(MODERN).toMatch(/z\.marketValueTotal/);
    expect(MODERN).toMatch(/z\.salaryTotal/);
    expect(MODERN).toMatch(/z\.sponsorTotal/);
    expect(MODERN).toMatch(/z\.buildingCost/);
    expect(MODERN).toMatch(/z\.transferNet/);
    expect(MODERN).toMatch(/z\.guv/);
  });
  it("Sport-Spalten sind verdrahtet: Bilanz, Verhältnis, Bereiche POW/SPE/MEN/SOC", () => {
    expect(MODERN).toContain("teamBilanzByTeamId?.get(z.teamId)");
    expect(MODERN).toMatch(/z\.verhaeltnis/);
    expect(MODERN).toMatch(/\["pow", "spe", "men", "soc"\]/);
  });
  it("Verhältnis-Spalte erscheint nur, wenn Zeilen eines tragen (Manager-Save bleibt ohne)", () => {
    expect(MODERN).toMatch(/hatVerhaeltnis && !phone/);
  });
  it("Zonen: Titel, Aufstieg, Abstieg haben Farbe und Legende; Medaillenringe gibt es nicht", () => {
    for (const z of ["titel", "aufstieg", "abstieg"]) expect(CSS).toContain(`.ssm-zone--${z}`);
    expect(MODERN).not.toMatch(/NlMedalBadge|medal/i);
  });
  it("vor Spieltag 1 steht der Hinweis auf die Startplätze statt Strichen", () => {
    expect(MODERN).toContain("Startplätze aus dem Endstand der Vorsaison");
  });
  it("eigenes Team, Franky-Team und Rivale sind markiert", () => {
    expect(MODERN).toContain("is-eigene");
    expect(MODERN).toContain("z.isFrankyTeam");
    expect(MODERN).toContain("rivalTeamIds?.has(z.teamId)");
  });
  it("Saisonende: Meister, Aufstieg, Abstieg als Marken", () => {
    expect(MODERN).toContain("isSeasonEnded");
    expect(MODERN).toContain("ZONEN_MARKE_ENDE");
  });
  it("jede Ansicht ist gebaut: Tabelle, Matrix, Verlauf, Spieltage, Bestenliste", () => {
    for (const a of ['"tabelle"', '"matrix"', '"verlauf"', '"spieltage"', '"bestenliste"']) expect(MODERN).toContain(a);
  });
  it("Spieltage laden lazy: je Spieltag-Wahl, eine geteilte Übersicht des nächsten Spieltags (Kopf, Matrix, Nä.-Spalte, Showdown), Duell-Matrix (nur bei neuem Bundle)", () => {
    expect(MODERN.match(/getUebersicht\(/g)?.length).toBe(3);
    // Die Duell-Matrix (Chris 18.11.: Duellpunkte statt PPs) summiert alle gespielten Spieltage —
    // einmal je neuem Spieltage-Bundle, nicht je Render oder Ansichtswechsel.
    expect(MODERN).toMatch(/duellPunkteJeDisziplin\(gespielte\.map\(\(o\) => spieltage\.getUebersicht\(o\.id\)\)\);\n  \}, \[spieltage\]\)/);
  });
  it("Klassisch bleibt erreichbar, modern ist Standard", () => {
    expect(CLIENT).toContain('look === "klassisch"');
    expect(CLIENT).toContain("<SeasonStandingsNewLook {...props} />");
    expect(LOOK).toContain('"modern" as SaisonstandLook');
    expect(LOOK).toContain('get("saisonstand")');
  });
  it("kein Mockup-Erfundenes: keine Papierform-Prozente, keine Rekorde", () => {
    const ohneKommentare = MODERN.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(ohneKommentare).not.toMatch(/Papierform|Siegchance|Rekord/);
  });
  it("Saisonlänge kommt aus der Spieltags-Liste, nicht aus dem Ledger (sonst Endstand mitten in der Saison)", () => {
    expect(MODERN).toContain("const gesamtSpieltage = Math.max(spieltagListe.length, verlauf ? verlauf.spieltage.length : 0);");
  });
  it("Runde 2: Form (6 Plätze), Verlauf-Sparkline, Nä., Abst. und Rang-Bänder sind verdrahtet", () => {
    expect(MODERN).toContain("formPlaetze(form)");
    expect(MODERN).toContain('key: "verlauf"');
    expect(MODERN).toContain('key: "naech"');
    expect(MODERN).toContain('key: "abst"');
    expect(MODERN).toMatch(/rangBand\(bereichsRaenge\[id\]\.get\(z\.teamId\)\)/);
    for (const k of ["gut", "warn", "risk"]) expect(CSS).toContain(`.ssm-band--${k}`);
    expect(CSS).toContain("skewX(-14deg)");
  });
  it("Runde 2: Showdown zeigt Kaderstärke-Verhältnis aus den Stärke-Werten, ehrlich benannt", () => {
    expect(MODERN).toContain("teamStrengthValueByTeamId?.get(p.homeTeamId)");
    expect(MODERN).toContain("kaderStaerkeAnteil(wH, wG)");
    expect(MODERN).toContain("kein Ergebnis und keine Prognose");
  });
});
