import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { ALTE_SPONSOR_NAMEN } from "@/lib/sponsor/sponsor-brand-alte-namen";
import { SPONSOR_BRAND_PARENTS } from "@/lib/sponsor/sponsor-brand-parents";
import { SPONSOR_BRAND_VARIANTS } from "@/lib/sponsor/sponsor-brand-variants";
import {
  aktuellerSponsorName,
  ersetzeAlteSponsorNamen,
  migriereSponsorNamen,
} from "@/lib/sponsor/sponsor-namen-migration";

// Die drei Probe-Wappen aus public/sprites/sponsoren/ (Chris, 22.11.): Name muss genau so stehen.
const PROBE_WAPPEN: Record<string, string> = {
  "red-stag-energy": "Red Stag Energy",
  "rainforest-commerce": "Rainforest Commerce",
  "alphasearch-global": "Alphasearch Global",
};

describe("Sponsor-Namen: eigene Parodien statt echter Marken (22.11.)", () => {
  it("jede der 200 Dachmarken hat einen alten Namen in der Sperrliste und einen neuen, anderen Namen", () => {
    expect(SPONSOR_BRAND_PARENTS).toHaveLength(200);
    for (const parent of SPONSOR_BRAND_PARENTS) {
      const alt = ALTE_SPONSOR_NAMEN[parent.id];
      expect(alt, parent.id).toBeTruthy();
      expect(parent.name, parent.id).not.toBe(alt);
    }
  });

  it("kein alter (echter) Markenname steht noch als Name oder Flavour im Katalog", () => {
    const sperrliste = Object.values(ALTE_SPONSOR_NAMEN);
    const namen = new Set(SPONSOR_BRAND_PARENTS.map((entry) => entry.name));
    for (const alt of sperrliste) {
      expect(namen.has(alt), alt).toBe(false);
    }
    for (const parent of SPONSOR_BRAND_PARENTS) {
      for (const alt of sperrliste) {
        expect(parent.flavorBase.includes(alt), `${parent.id}: ${alt}`).toBe(false);
      }
    }
    for (const variant of SPONSOR_BRAND_VARIANTS) {
      expect(sperrliste.includes(variant.name), variant.id).toBe(false);
      for (const alt of sperrliste) {
        expect(variant.flavor.includes(alt), `${variant.id}: ${alt}`).toBe(false);
      }
    }
  });

  it("neue Namen sind eindeutig, und die drei Probe-Wappen heissen genau wie auf dem Logo", () => {
    const namen = SPONSOR_BRAND_PARENTS.map((entry) => entry.name);
    expect(new Set(namen).size).toBe(namen.length);
    for (const [id, name] of Object.entries(PROBE_WAPPEN)) {
      expect(SPONSOR_BRAND_PARENTS.find((entry) => entry.id === id)?.name).toBe(name);
    }
  });

  it("kein neuer Name enthaelt einen alten als Teilstring (sonst ist die Text-Ersetzung nicht idempotent)", () => {
    const sperrliste = Object.values(ALTE_SPONSOR_NAMEN);
    for (const parent of SPONSOR_BRAND_PARENTS) {
      for (const alt of sperrliste) {
        expect(parent.name.includes(alt), `${parent.name} enthaelt ${alt}`).toBe(false);
      }
    }
  });

  it("kein alter Markenname steht im Quelltext der App (lib, app, components)", () => {
    const sperrliste = Object.values(ALTE_SPONSOR_NAMEN);
    const ausgenommen = new Set([
      path.join("lib", "sponsor", "sponsor-brand-alte-namen.ts"),
    ]);
    const funde: string[] = [];
    const geheDurch = (ordner: string) => {
      for (const eintrag of readdirSync(ordner)) {
        const voll = path.join(ordner, eintrag);
        if (statSync(voll).isDirectory()) {
          if (eintrag === "node_modules" || eintrag.startsWith(".")) continue;
          geheDurch(voll);
        } else if (/\.(ts|tsx)$/.test(eintrag) && !ausgenommen.has(voll)) {
          const text = readFileSync(voll, "utf8");
          for (const alt of sperrliste) {
            if (text.includes(alt)) funde.push(`${voll}: ${alt}`);
          }
        }
      }
    };
    for (const wurzel of ["lib", "app", "components"]) geheDurch(wurzel);
    expect(funde).toEqual([]);
  });

  it("aktuellerSponsorName leitet aus der id ab, sonst aus dem alten Klartext", () => {
    expect(aktuellerSponsorName("red-stag-energy", "Red Bull Energy")).toBe("Red Stag Energy");
    expect(aktuellerSponsorName(undefined, "Google Search")).toBe("Alphasearch Global");
    expect(aktuellerSponsorName(undefined, "Ein ganz anderer Sponsor")).toBe("Ein ganz anderer Sponsor");
  });

  it("Lade-Migration setzt Angebote, Vertraege und Ereignisse um, ohne Geld anzufassen, und ist idempotent", () => {
    const gameState = {
      seasonState: {
        sponsorOffersByTeamId: {
          "M-M": [
            { offerId: "o1", name: "Amazon Commerce", sponsorParentBrandId: "rainforest-commerce", totalUpsideEstimate: 12 },
            { offerId: "o2", name: "Lidl Plus", totalUpsideEstimate: 7 },
          ],
        },
        sponsorContractsByTeamId: {
          "M-M": { name: "Red Bull Energy", sponsorParentBrandId: "red-stag-energy", payouts: { base: 5 } },
        },
        sponsorEvents: [
          { eventId: "e1", sponsorName: "Red Bull Energy", cashDelta: 1.5, message: "Red Bull Energy zahlt einen Medien-Aktions-Bonus aus." },
        ],
      },
    } as unknown as GameState;

    const neu = migriereSponsorNamen(gameState);
    const angebote = neu.seasonState.sponsorOffersByTeamId?.["M-M"] ?? [];
    expect(angebote[0].name).toBe("Rainforest Commerce");
    expect(angebote[0].totalUpsideEstimate).toBe(12);
    expect(angebote[1].name).toBe("Liedl Plus");
    const vertrag = neu.seasonState.sponsorContractsByTeamId?.["M-M"];
    expect(vertrag?.name).toBe("Red Stag Energy");
    expect(vertrag?.payouts).toEqual({ base: 5 });
    const ereignis = neu.seasonState.sponsorEvents?.[0];
    expect(ereignis?.sponsorName).toBe("Red Stag Energy");
    expect(ereignis?.message).toBe("Red Stag Energy zahlt einen Medien-Aktions-Bonus aus.");
    expect(ereignis?.cashDelta).toBe(1.5);

    expect(migriereSponsorNamen(neu)).toBe(neu);
    expect(ersetzeAlteSponsorNamen("Siemenswerk AG meldet Partner-Reibung")).toBe("Simmenswerk AG meldet Partner-Reibung");
  });
});
