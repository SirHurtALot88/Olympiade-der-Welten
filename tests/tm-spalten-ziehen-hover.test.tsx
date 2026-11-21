import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VorschauKarte } from "@/app/foundation/shared/PortraetVorschau";
import {
  begrenzeBreite,
  gridVorlage,
  ladeBreiten,
  speichereBreiten,
  spaltenSchluessel,
  standardBreiten,
  zeilenMinU,
  type SpaltenDef,
} from "@/app/foundation/shared/spalten-layout";
import { baueSpielerSicht } from "@/lib/market/transfermarkt-sicht";
import { TM_SPALTEN } from "@/app/foundation/transfermarkt-modern/TransfermarktModern";
import { DRAFT_SPALTEN } from "@/app/foundation/draft-modern/DraftLive";

const DEFS: SpaltenDef[] = [
  { id: "por", standard: 2.3, min: 1.6, max: 9 },
  { id: "nm", standard: 8, min: 5, max: 24, flex: true },
];

function speicher() {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe("Spaltenbreiten: speichern, laden, zurücksetzen", () => {
  it("Schlüssel getrennt je Benutzer und Liste", () => {
    expect(spaltenSchluessel("Franky", "transfermarkt")).not.toBe(spaltenSchluessel("Franky", "draft-brett"));
    expect(spaltenSchluessel("Franky", "transfermarkt")).not.toBe(spaltenSchluessel("Chris", "transfermarkt"));
    expect(spaltenSchluessel(null, "x")).toContain(":gast:");
  });

  it("Breiten werden gespeichert, geladen und auf Min/Max begrenzt", () => {
    const sp = speicher();
    const k = spaltenSchluessel("Franky", "transfermarkt");
    speichereBreiten(k, { por: 6, nm: 99 }, sp, DEFS);
    const geladen = ladeBreiten(k, DEFS, sp);
    expect(geladen.por).toBe(6);
    expect(geladen.nm).toBe(24);
    expect(begrenzeBreite(DEFS[0], 0.1)).toBe(1.6);
  });

  it("Standardbreiten löschen den Eintrag; kaputter Speicher fällt auf Standard zurück", () => {
    const sp = speicher();
    const k = "k";
    speichereBreiten(k, { por: 5, nm: 8 }, sp, DEFS);
    expect(sp.m.has(k)).toBe(true);
    speichereBreiten(k, standardBreiten(DEFS), sp, DEFS);
    expect(sp.m.has(k)).toBe(false);
    sp.m.set(k, "{kaputt");
    expect(ladeBreiten(k, DEFS, sp)).toEqual(standardBreiten(DEFS));
    expect(
      ladeBreiten(k, DEFS, {
        getItem: () => {
          throw new Error("gesperrt");
        },
      }),
    ).toEqual(standardBreiten(DEFS));
  });

  it("Vorlage und Zeilenhöhe folgen der Porträtbreite", () => {
    expect(gridVorlage(DEFS, { por: 4, nm: 8 })).toBe("calc(4 * var(--u)) minmax(calc(8 * var(--u)), 1fr)");
    expect(zeilenMinU("por", DEFS, { por: 2.3, nm: 8 })).toBe(0);
    expect(zeilenMinU("por", DEFS, { por: 6, nm: 8 })).toBeGreaterThan(6);
  });

  it("Transfermarkt und Draft-Brett haben je eine Porträtspalte und keine PP-Spalte", () => {
    for (const defs of [TM_SPALTEN, DRAFT_SPALTEN]) {
      expect(defs.find((d) => d.id === "por")).toBeTruthy();
      expect(defs.some((d) => /pp/i.test(d.id))).toBe(false);
    }
    const tm = readFileSync("app/foundation/transfermarkt-modern/TransfermarktModern.tsx", "utf8");
    expect(tm).not.toContain("ppz");
    expect(tm).not.toContain("Klick sortiert nach Eignung");
  });
});

describe("Hover-Karte", () => {
  it("zeigt POW/SPE/MEN/SOC mit Nebel-Werten, keine PP", () => {
    const sicht = baueSpielerSicht({ playerId: "p1", name: "Test", scoutingLevel: 0, powTier: "A", speTier: "B", menTier: "C", socTier: "D" } as never);
    const html = renderToStaticMarkup(
      <VorschauKarte
        offen={{
          anker: { left: 10, right: 50, top: 100, height: 40 } as DOMRect,
          daten: {
            bild: "/x.png",
            name: "Test Spieler",
            klasse: "Krieger",
            rasse: "Elf",
            achsen: (["pow", "spe", "men", "soc"] as const).map((a) => ({ label: a.toUpperCase(), anzeige: sicht.achsen[a].anzeige, exakt: sicht.achsen[a].exakt })),
          },
        }}
      />,
    );
    for (const l of ["POW", "SPE", "MEN", "SOC"]) expect(html).toContain(`<small>${l}</small>`);
    expect(html).toContain("Test Spieler");
    expect(html).toContain("Elf");
    expect(html).not.toMatch(/PP/);
    expect(html).toContain("pv-a nb");
  });
});
