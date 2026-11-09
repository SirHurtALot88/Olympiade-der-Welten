#!/usr/bin/env node
// PIXEL-FIGUREN FUER DEN ARENA-MOTOR (02.11.).
//
// Der Motor (public/mockups/battle-mode.engine.js) kennt seine Kaempfer nur beim NAMEN
// (`u.n`), nicht bei der Spieler-ID. Die PixelLab-Figuren liegen dagegen unter dem Slug der
// Spieler-ID (`player-0001-umbros` -> `public/sprites/figuren/umbros/`, Index
// data/generated/figuren-sprites.json, Leser lib/data/figurenSprites.ts). Dieses Skript baut
// die Bruecke einmal vorab: Name -> {Slug, Kantenlaenge, Rotationen, je Animationsart und
// Richtung die ERSTE passende Gruppe} und schreibt sie als kleines Datenskript nach
// public/mockups/battle-mode.figuren.js (setzt window.__ARENA_FIGUREN).
//
// Wie figurAnimation() in lib/data/figurenSprites.ts zaehlt die erste Gruppe im Index; nur
// wenn ihr eine Richtung fehlt, springt die naechste Gruppe derselben Art ein.
//
// Reine Anzeige-Daten: der Motor liest sie ausschliesslich in zeichneSprite()/figur(), nie in
// der Simulation. Neu bauen nach jedem Figuren-Export:
//   node scripts/baue-arena-figuren.mjs
// tests/arena-pixel-figuren.test.ts prueft, dass die eingecheckte Datei zum Index passt.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const wurzel = resolve(hier, "..");

export const ARENA_FIGUREN_ZIEL = resolve(wurzel, "public", "mockups", "battle-mode.figuren.js");
// HYROX-ARBEITSPOSEN (Nahkamera-PR, 08.11.): drei zusaetzliche, OPTIONALE Arten neben den vier
// Kampf-Grundarten -- nur bei Figuren gesetzt, fuer die eine eigene PixelLab-Animation bestellt
// wurde (s. docs/design/spurt-hyrox-nahkamera-08-11.md). Fehlt eine Figur in `a`, liest
// zeichnePixelFigur() im Motor den bestehenden "angriff"-Rueckfall -- bit-identisch zum
// Verhalten ohne diese drei Zeilen.
const ARTEN = ["walk", "angriff", "treffer", "tod", "hyroxTechnik", "hyroxKletter", "hyroxKraft"];

/**
 * @param {Record<string, {canvas:number, rotationen:string[], animationen:{name:string,kind:string,frames:number,dirs:string[]}[]}>} index
 * @param {{id:string,name:string}[]} spieler
 * @returns {Record<string, {s:string,c:number,r:string[],a:Record<string,Partial<Record<"east"|"south"|"north",[string,number]>>>}>}
 */
export function baueArenaFigurenTabelle(index, spieler) {
  const tabelle = {};
  const namen = [...spieler].sort((a, b) => a.id.localeCompare(b.id));
  for (const p of namen) {
    const treffer = /^player-\d+-(.+)$/.exec(String(p.id).toLowerCase());
    const slug = treffer ? treffer[1] : null;
    if (!slug || !index[slug]) continue;
    // Doppelte Namen: der erste (nach ID sortiert) gewinnt — heute gibt es keine Kollision
    // unter den Figuren-Spielern, der Test haelt das fest.
    if (tabelle[p.name]) continue;
    const e = index[slug];
    const a = {};
    // Je Art UND Richtung die erste Gruppe, die diese Richtung hat: bei Draco etwa hat "walk"
    // nur einen Sued-Streifen, der Ost-Streifen steckt erst in "walk2". "north" ist optional
    // (Chris, 06.11.: echte Ruecken-Animation statt der Ost-Naeherung beim Nordlauf) — fehlt
    // sie einer Figur, liest zeichnePixelFigur() im Motor weiterhin die bisherige Ost-Naeherung.
    for (const art of ARTEN) {
      const je = {};
      for (const dir of ["east", "south", "north"]) {
        const gruppe = e.animationen.find((g) => g.kind === art && g.dirs.includes(dir));
        if (gruppe) je[dir] = [gruppe.name, gruppe.frames];
      }
      if (Object.keys(je).length) a[art] = je;
    }
    tabelle[p.name] = { s: slug, c: e.canvas, r: [...e.rotationen], a };
  }
  return tabelle;
}

export function baueArenaFigurenQuelle(index, spieler) {
  const tabelle = baueArenaFigurenTabelle(index, spieler);
  const namen = Object.keys(tabelle).sort();
  const zeilen = namen.map((n) => `  ${JSON.stringify(n)}:${JSON.stringify(tabelle[n])}`);
  return [
    "// GENERIERT von scripts/baue-arena-figuren.mjs — nicht von Hand bearbeiten.",
    "// PixelLab-Figuren fuer den Arena-Motor: Spielername -> Ordner unter public/sprites/figuren/.",
    "// Reine Anzeige-Daten (zeichneSprite/figur), keine Simulation. Quelle: data/generated/figuren-sprites.json",
    "// + data/generated/oly-player-stats.json (Name <-> Spieler-ID).",
    "window.__ARENA_FIGUREN={",
    zeilen.join(",\n"),
    "};",
    "",
  ].join("\n");
}

export function leseArenaFigurenEingaben() {
  const index = JSON.parse(readFileSync(resolve(wurzel, "data", "generated", "figuren-sprites.json"), "utf8"));
  const spieler = JSON.parse(readFileSync(resolve(wurzel, "data", "generated", "oly-player-stats.json"), "utf8"));
  return { index, spieler };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { index, spieler } = leseArenaFigurenEingaben();
  const quelle = baueArenaFigurenQuelle(index, spieler);
  writeFileSync(ARENA_FIGUREN_ZIEL, quelle);
  const anzahl = Object.keys(baueArenaFigurenTabelle(index, spieler)).length;
  console.log(`battle-mode.figuren.js geschrieben: ${anzahl} Figuren, ${(quelle.length / 1024).toFixed(1)} KiB`);
}
