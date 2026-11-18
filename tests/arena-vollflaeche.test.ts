import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  berechneLeinwandBreite,
  messeNavigationsKante,
  messeRechtsFrei,
} from "@/app/foundation/battle-arena/ArenaVollflaecheBuehne";

/**
 * ARENA-VOLLFLAECHE (Chris 18.11., docs/design/arena-vollbild-18-11/): die Arena liegt als feste
 * Buehne ueber dem Fenster, die Leinwand nutzt die volle Breite und zeichnet scharf nach. Hier die
 * reinen Rechenregeln und die Vertraege zwischen Host, CSS und Motor.
 */

type Rechteck = { left: number; right: number; top: number; width: number; height: number };
function fakeDoc(elemente: Record<string, { rect: Rechteck; attrs?: Record<string, string> } | undefined>): Document {
  return {
    querySelector: (sel: string) => {
      const e = elemente[sel];
      if (!e) return null;
      return {
        getBoundingClientRect: () => e.rect,
        getAttribute: (name: string) => e.attrs?.[name] ?? null,
      };
    },
  } as unknown as Document;
}

describe("berechneLeinwandBreite", () => {
  it("16:9 (2560x1440 mit Icon-Schiene): volle Breite, die Hoehe reicht", () => {
    expect(berechneLeinwandBreite({ hauptBreite: 2488, rahmenHoehe: 1400, andereZeilenHoehe: 220 })).toBe(2488);
  });

  it("sehr breites, flaches Fenster: Breite folgt der Hoehe (1240:470), Rest bleibt Kulisse", () => {
    const b = berechneLeinwandBreite({ hauptBreite: 3000, rahmenHoehe: 800, andereZeilenHoehe: 200, untenMin: 130 });
    expect(b).toBe(Math.floor((800 - 200 - 130) * (1240 / 470)));
    expect(b).toBeLessThan(3000);
  });

  it("nie unter 320 px", () => {
    expect(berechneLeinwandBreite({ hauptBreite: 1200, rahmenHoehe: 200, andereZeilenHoehe: 300 })).toBe(320);
  });
});

describe("messeNavigationsKante", () => {
  it("Seitenleiste links: rechte Kante", () => {
    const doc = fakeDoc({ ".foundation-sidebar": { rect: { left: 0, right: 64, top: 0, width: 64, height: 1440 } } });
    expect(messeNavigationsKante(doc)).toBe(64);
  });

  it("ausgefahrene Icon-Schiene (Hover-Ueberlagerung) wird nicht nachgezogen", () => {
    const doc = fakeDoc({
      ".foundation-sidebar": { rect: { left: 0, right: 288, top: 0, width: 288, height: 1440 }, attrs: { "data-rail": "open" } },
    });
    expect(messeNavigationsKante(doc)).toBeNull();
  });

  it("Handy-Leiste oben (flach) oder keine Leiste: 0", () => {
    expect(messeNavigationsKante(fakeDoc({}))).toBe(0);
    const flach = fakeDoc({ ".foundation-sidebar": { rect: { left: 0, right: 412, top: 0, width: 412, height: 56 } } });
    expect(messeNavigationsKante(flach)).toBe(0);
  });
});

describe("messeRechtsFrei", () => {
  it("haelt die Ecke fuer Anmelde-Badge und Fehler-Flagge frei", () => {
    const doc = fakeDoc({
      ".oly-auth-status-badge": { rect: { left: 2300, right: 2548, top: 10, width: 248, height: 26 } },
      ".oly-bug-report-flag": { rect: { left: 2522, right: 2548, top: 44, width: 26, height: 26 } },
    });
    expect(messeRechtsFrei(doc, 2560)).toBe(2560 - 2300 + 8);
  });

  it("nichts oben rechts: 0", () => {
    expect(messeRechtsFrei(fakeDoc({}), 1920)).toBe(0);
  });
});

describe("Vertraege Host / CSS / Motor", () => {
  const wurzel = path.resolve(__dirname, "..");
  const css = readFileSync(path.join(wurzel, "public/mockups/battle-mode.css"), "utf8");
  const motor = readFileSync(path.join(wurzel, "public/mockups/battle-mode.engine.js"), "utf8");
  const host = readFileSync(path.join(wurzel, "app/foundation/battle-arena/FoundationBattleArenaHost.tsx"), "utf8");
  const html = readFileSync(path.join(wurzel, "public/mockups/battle-mode.html"), "utf8");

  it("CSS kennt die Buehne und die Leinwandbreite des Hosts", () => {
    expect(css).toContain('.oly-arena-buehne[data-voll="1"]{position:fixed');
    expect(css).toContain("var(--arena-cv-breite,100%)");
    expect(css).toContain("var(--arena-links,0px)");
  });

  it("der Host legt beide Ansichten (Test und Spieltag) in die Buehne", () => {
    expect(host.match(/<ArenaVollflaecheBuehne/g)?.length).toBe(2);
  });

  it("Motor: scharfe Leinwand fuer #cv und die Mini-DM-Buehne, logische Groesse bleibt 1240x470", () => {
    expect(motor).toContain("const cvScharf=leinwandScharf(cv,ctx);");
    expect(motor).toContain("scharf=cx?leinwandScharf(cv,cx):null;");
    expect(motor).toContain("cvScharf.pruefe()");
    expect(html).toContain('<canvas id="cv" width="1240" height="470">');
  });
});
