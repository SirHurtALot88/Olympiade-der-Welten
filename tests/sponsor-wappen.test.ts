import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SPONSOR_BRAND_PARENTS } from "@/lib/sponsor/sponsor-brand-parents";
import {
  SPONSOR_WAPPEN_IDS,
  sponsorMonogramm,
  sponsorWappenPfad,
  sponsorWappenPfadFuer,
} from "@/lib/sponsor/sponsor-wappen";

const ORDNER = path.join(process.cwd(), "public", "sprites", "sponsoren");
const QUELLEN = JSON.parse(readFileSync(path.join(ORDNER, "quellen.json"), "utf8")) as Record<string, unknown>;
const QUELL_DATEIEN = Object.keys(QUELLEN).filter((schluessel) => !schluessel.startsWith("_"));

describe("Sponsor-Wappen (22.11.)", () => {
  it("jedes Wappen in quellen.json existiert als Datei, und jede Datei hat einen Herkunftseintrag", () => {
    for (const datei of QUELL_DATEIEN) {
      expect(existsSync(path.join(ORDNER, datei)), datei).toBe(true);
    }
    const dateien = readdirSync(ORDNER).filter((datei) => datei.endsWith(".png")).sort();
    expect(dateien).toEqual([...QUELL_DATEIEN].sort());
  });

  it("die Liste im Helfer ist deckungsgleich mit den Dateien, und jede ID ist eine Dachmarke des Katalogs", () => {
    expect([...SPONSOR_WAPPEN_IDS].sort()).toEqual(QUELL_DATEIEN.map((datei) => datei.replace(/\.png$/, "")).sort());
    const katalog = new Set(SPONSOR_BRAND_PARENTS.map((parent) => parent.id));
    for (const id of SPONSOR_WAPPEN_IDS) {
      expect(katalog.has(id), id).toBe(true);
    }
  });

  it("liefert den Pfad, wenn es ein Wappen gibt, auch aus der Marken-ID mit Variante", () => {
    expect(sponsorWappenPfad("evonik-materials")).toBe("/sprites/sponsoren/evonik-materials.png");
    expect(sponsorWappenPfad("sennheiser-audio:identity_special")).toBe("/sprites/sponsoren/sennheiser-audio.png");
  });

  it("fällt ohne Wappen auf null zurück (die Seite zeigt dann das Monogramm)", () => {
    const ohne = SPONSOR_BRAND_PARENTS.find((parent) => !SPONSOR_WAPPEN_IDS.has(parent.id));
    expect(ohne).toBeTruthy();
    expect(sponsorWappenPfad(ohne!.id)).toBeNull();
    expect(sponsorWappenPfad(null)).toBeNull();
    expect(sponsorWappenPfad(undefined)).toBeNull();
    expect(sponsorWappenPfad("")).toBeNull();
    expect(sponsorWappenPfad("gibt-es-nicht")).toBeNull();
    expect(sponsorWappenPfad("../geheim")).toBeNull();
    expect(sponsorWappenPfadFuer(null)).toBeNull();
    expect(sponsorWappenPfadFuer({ name: ohne!.name })).toBeNull();
    expect(sponsorMonogramm("Evonix Materials")).toBe("EM");
    expect(sponsorMonogramm("")).toBe("?");
  });

  it("findet das Wappen eines Vertrags über Dachmarke, Marken-ID oder Namen", () => {
    expect(sponsorWappenPfadFuer({ sponsorParentBrandId: "kuka-automation", name: "egal" })).toBe("/sprites/sponsoren/kuka-automation.png");
    expect(sponsorWappenPfadFuer({ sponsorBrandId: "porsche-holding:elite" })).toBe("/sprites/sponsoren/porsche-holding.png");
    const evonik = SPONSOR_BRAND_PARENTS.find((parent) => parent.id === "evonik-materials")!;
    expect(sponsorWappenPfadFuer({ name: evonik.name })).toBe("/sprites/sponsoren/evonik-materials.png");
  });
});
