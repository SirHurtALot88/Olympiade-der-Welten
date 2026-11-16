/**
 * ENGINE-BILDER AUSGELAGERT (Task #165, Performance-Paket 3 "Ladezeit").
 *
 * battle-mode.engine.js trug 532 data:-URIs (15 MB Text). scripts/lagere-engine-bilder-aus.mjs
 * hat sie nach public/mockups/engine-bilder/<inhaltshash>.png (bzw. auf byte-gleiche Dateien unter
 * public/sprites/) ausgelagert. Dieser Test ist die CI-Stufe von `--pruefen`: keine neuen
 * eingebetteten Bilder in SPRITES/B_SPRITES, jede Referenz existiert und hat noch denselben
 * Inhalt, keine verwaisten Dateien. Rot? -> `node scripts/lagere-engine-bilder-aus.mjs`; bei "Inhalt ... hat sich geaendert" (Sprite-Datei unter public/sprites/ neu gerendert) zuerst `--einlagern`, dann erneut ohne Argument auslagern.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ENGINE_DATEI, findeTabellenWerte, pruefen } from "../scripts/lagere-engine-bilder-aus.mjs";

type Wert = { tabelle: string; schluessel: string; wert: string };

describe("Engine-Bilder ausgelagert", () => {
  const quelltext = readFileSync(ENGINE_DATEI, "utf8");

  it("--pruefen ist ohne Befund", () => {
    expect(pruefen()).toEqual([]);
  });

  it("SPRITES und B_SPRITES verweisen nur auf Dateien, keine data:-URIs mehr", () => {
    const werte = findeTabellenWerte(quelltext) as Wert[];
    expect(werte.length).toBeGreaterThan(500);
    for (const w of werte) {
      expect(w.wert, `${w.tabelle}.${w.schluessel}`).toMatch(
        /^(engine-bilder\/[0-9a-f]{12}\.png|\.\.\/sprites\/[\w./-]+\.png#[0-9a-f]{12})$/,
      );
    }
    expect(quelltext).not.toContain("data:image/png;base64,");
  });

  it("die Engine laedt beide Tabellen ueber engineBild() (relativ zur eigenen Skript-URL)", () => {
    expect(quelltext).toContain("for(const k in SPRITES)sprBild[k]=engineBild(SPRITES[k]);");
    expect(quelltext).toContain("for(const k in B_SPRITES)bBild[k]=engineBild(B_SPRITES[k]);");
    expect(quelltext).toMatch(/new URL\("\.\/",PIXEL_FIGUR_SKRIPT_SRC\)/);
  });
});
