/**
 * ES GIBT ZWEI ZEILENBAUER FÜR DEN SAISONSTAND — UND NUR EINER WIRD GERENDERT.
 *
 * DER ANLASS, am 23.08.2026 um ein Haar ins Spiel gelangt: die drei neuen Hovers (Teamname,
 * Marktwert, Gehälter) brauchen `hoverKader` auf der Tabellenzeile. Gesetzt wurde das Feld zuerst
 * nur in `lib/foundation/tabs/use-season-v2-panel-model.ts` — und das Modell hängt am **nirgends
 * gerenderten** `FoundationSeasonV2Host`. Die wirklich gezeigte Tabelle baut ihre Zeilen in
 * `use-foundation-shell-router-body-scope.tsx`.
 *
 * Der Fehler wäre durch JEDEN Test gekommen: `tsc` ist zufrieden (das Feld ist optional), die
 * Ableitung ist einzeln geprüft, die Komponente rendert. Nur im Spiel wäre der Hover leer geblieben.
 * Genau davor warnt seit längerem der Kommentar an `computeTeamBuildingCost`: „waere die Rechnung
 * dort privat geblieben, stuende sie zweimal im Code und driftete auseinander."
 *
 * DIESER WÄCHTER hält deshalb fest, dass beide Bauer dieselben Zeilenfelder befüllen. Er liest den
 * Quelltext — das ist hier angemessen, weil das Problem GENAU eine Quelltext-Eigenschaft ist: ein
 * fehlender Zuweisungsausdruck in einer von zwei Dateien. Ein Verhaltenstest könnte das nicht
 * sehen, solange nur der tote Pfad geprüft wird.
 *
 * Er wird vom Quelltext-Wächter (`scripts/fahre-quelltext-waechter.ts`) automatisch eingesammelt und
 * läuft damit im Pflicht-Job mit.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const GERENDERT = join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
const MODELL = join(process.cwd(), "lib/foundation/tabs/use-season-v2-panel-model.ts");

const gerendert = readFileSync(GERENDERT, "utf8");
const modell = readFileSync(MODELL, "utf8");

/**
 * Felder, die BEIDE Bauer setzen müssen. Bewusst nur die, die eine eigene Ableitung mitbringen —
 * bei ihnen kostet ein Vergessen eine leere Ansicht, nicht bloß einen Strich.
 */
const PFLICHTFELDER = ["hoverKader:", "guvPosten:", "buildingCost:", "marketValueTotal:"];

describe("Beide Saisonstand-Zeilenbauer befuellen dieselben Felder", () => {
  it.each(PFLICHTFELDER)("%s steht im GERENDERTEN Bauer", (feld) => {
    // Der Bauer, den das Spiel wirklich benutzt. Fehlt das Feld hier, bleibt die Ansicht leer —
    // und kein anderer Test merkt es.
    expect(gerendert).toContain(feld);
  });

  it.each(PFLICHTFELDER)("%s steht auch im zweiten Bauer", (feld) => {
    // Der zweite Bauer wird heute nicht gerendert, ist aber der Vorlagen-Pfad. Läuft er auseinander,
    // ist der naechste Umbau ein Ratespiel darueber, welche Fassung stimmt.
    expect(modell).toContain(feld);
  });

  it("nennt in beiden Dateien dieselbe Kader-Ableitung", () => {
    expect(gerendert).toContain("buildSaisonstandHoverKader");
    expect(modell).toContain("buildSaisonstandHoverKader");
  });

  it("warnt im gerenderten Bauer davor, dass es zwei gibt", () => {
    // Ohne diesen Hinweis wiederholt sich der Fehler beim naechsten neuen Feld.
    expect(gerendert).toMatch(/nirgends gerenderten|WIRKLICH gezeigte Tabelle/);
  });
});
