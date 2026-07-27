/**
 * DER ALTE ERZEUGUNGSPFAD DARF NICHT ZURUECKKOMMEN.
 *
 * Das alte Sponsorsystem ist nicht "abgeschaltet", sondern ENTFERNT: es gibt keinen Schalter, keine
 * Umgebungsvariable und keinen Spielstand-Zustand mehr, der wieder ein Angebot nach altem Recht
 * erzeugen koennte. Dieser Test ist die Zusage dafuer, und zwar auf zwei Ebenen:
 *
 *   1. VERHALTEN — kein erzeugtes Angebot und kein daraus unterschriebener Vertrag traegt jemals eine
 *      Ueberperformance- oder Tabellenziel-Komponente oder eine der elf alten Kurvenformen. Geprueft
 *      wird ueber BEIDE Spielstand-Arten: den neu angelegten UND den ohne Versionsvermerk (den ein
 *      Spieler von vor der Umstellung mitbringt). Genau der war frueher die Ruecktuer.
 *
 *   2. QUELLTEXT — die Bausteine, aus denen der alte Pfad bestand, existieren in lib/ nicht mehr.
 *      Ohne diese Ebene koennte jemand die Funktionen wieder anlegen und nur den Aufruf vergessen;
 *      der Verhaltenstest waere dann gruen und die Falle stuende wieder bereit.
 *
 * WAS DIESER TEST BEWUSST NICHT VERBIETET: das LESEN. Ein Vertrag aus einem alten Spielstand traegt
 * weiter `improvement`/`overperformance`-Komponenten und eine alte Kurvenform, und Anzeige, Evaluator
 * und Abrechnung muessen ihn weiter verstehen. Gemessen wurden 64 solcher Vertraege in der lokalen
 * Datenbank. Dass die weiter rechnen, sichert tests/sponsor-v2-display-settlement-parity.test.ts.
 */
import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { GameState, SponsorOffer } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildSponsorOffersForTeam, chooseSponsorOffer } from "@/lib/sponsor/sponsor-offer-service";
import { SPONSOR_CURVE_SHAPE_KEYS } from "@/lib/sponsor/sponsor-curve-shapes";
import { SPONSOR_V2_CURVES } from "@/lib/sponsor/sponsor-v2-model";
import {
  getSponsorV2Terms, resetSponsorV2KCache, stampSponsorSystemVersion,
} from "@/lib/sponsor/sponsor-v2-offer-service";

afterEach(() => { resetSponsorV2KCache(); });

/** Der Spielstand, den "Neues Spiel" anlegt. */
const v2State = (): GameState => stampSponsorSystemVersion(structuredClone(createSingleplayerGameState()), 2);
/** Ein Spielstand ohne Versionsvermerk — jeder vor der Umstellung angelegte Save. */
const legacyState = (): GameState => structuredClone(createSingleplayerGameState());

const MODEL_CURVE_NAMES = SPONSOR_V2_CURVES.map((curve) => curve.name);

function offersFor(gameState: GameState): { gameState: GameState; offers: SponsorOffer[]; teamId: string } {
  const teamId = gameState.teams[0]!.teamId;
  const offers = buildSponsorOffersForTeam({ gameState, teamId });
  expect(offers.length, "die Erzeugung liefert gar keine Angebote").toBeGreaterThan(0);
  return { gameState, offers, teamId };
}

describe("V1-Erzeugung ist tot — Verhalten", () => {
  for (const [label, build] of [
    ["ein neu angelegter Spielstand", v2State],
    ["ein Spielstand OHNE Versionsvermerk", legacyState],
  ] as const) {
    it(`${label}: kein Angebot traegt eine Ueberperformance- oder Tabellenziel-Komponente`, { timeout: 120_000 }, () => {
      const { offers } = offersFor(build());
      for (const offer of offers) {
        const kinds = offer.components.map((component) => component.kind);
        expect(kinds, `Angebot ${offer.offerId}`).not.toContain("overperformance");
        expect(kinds, `Angebot ${offer.offerId}`).not.toContain("improvement");
        // Auch die abgeleitete Modulliste darf die beiden nicht mehr behaupten.
        expect(offer.moduleIds ?? []).not.toContain("overperformance");
        expect(offer.moduleIds ?? []).not.toContain("improvement-target");
      }
    });

    it(`${label}: kein Angebot traegt eine der elf alten Kurvenformen`, { timeout: 120_000 }, () => {
      const { offers } = offersFor(build());
      for (const offer of offers) {
        expect(offer.curveShape, `Angebot ${offer.offerId} traegt Legacy-Kurvenform`).toBeUndefined();
        const terms = getSponsorV2Terms(offer);
        expect(terms, `Angebot ${offer.offerId} hat keine Modell-Konditionen`).not.toBeNull();
        expect(MODEL_CURVE_NAMES).toContain(terms!.curveName);
        expect(SPONSOR_CURVE_SHAPE_KEYS as readonly string[]).not.toContain(terms!.curveName);
      }
    });

    it(`${label}: auch der UNTERSCHRIEBENE Vertrag traegt nichts davon`, { timeout: 120_000 }, () => {
      const base = build();
      const { offers, teamId } = offersFor(base);
      const withOffers: GameState = {
        ...base,
        seasonState: {
          ...base.seasonState,
          sponsorOffersByTeamId: { ...(base.seasonState.sponsorOffersByTeamId ?? {}), [teamId]: offers },
        },
      };
      const signed = chooseSponsorOffer({ gameState: withOffers, teamId, offerId: offers[0]!.offerId });
      expect(signed.contract).not.toBeNull();
      const contract = signed.contract!;
      const kinds = contract.components.map((component) => component.kind);
      expect(kinds).not.toContain("overperformance");
      expect(kinds).not.toContain("improvement");
      expect(contract.curveShape).toBeUndefined();
      expect(getSponsorV2Terms(contract)).not.toBeNull();
    });
  }

  it("ueber die ganze Liga: kein einziges Angebot faellt durch", { timeout: 300_000 }, () => {
    const gameState = v2State();
    const all = gameState.teams.flatMap((team) => buildSponsorOffersForTeam({ gameState, teamId: team.teamId }));
    expect(all.length).toBeGreaterThan(100);
    const withLegacyModule = all.filter((offer) =>
      offer.components.some((c) => c.kind === "overperformance" || c.kind === "improvement"),
    );
    const withLegacyCurve = all.filter((offer) => offer.curveShape != null || getSponsorV2Terms(offer) == null);
    expect(withLegacyModule.length, `${withLegacyModule.length}/${all.length} Angebote mit Altmodul`).toBe(0);
    expect(withLegacyCurve.length, `${withLegacyCurve.length}/${all.length} Angebote mit Altkurve`).toBe(0);
  });
});

describe("V1-Erzeugung ist tot — Quelltext", () => {
  const libDir = path.join(process.cwd(), "lib");

  /** Zeilen, die reiner Kommentar sind, entfernen — Typ- und Doku-Kommentare duerfen die Altarten nennen. */
  function codeOnly(text: string): string {
    return text
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return t.length > 0 && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
  }

  async function readLibSources(): Promise<Array<{ file: string; text: string }>> {
    const out: Array<{ file: string; text: string }> = [];
    const walk = async (dir: string): Promise<void> => {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
          out.push({ file: path.relative(process.cwd(), full), text: await fs.readFile(full, "utf8") });
        }
      }
    };
    await walk(libDir);
    return out;
  }

  it("die Bausteine des alten Pfades existieren in lib/ nicht mehr", async () => {
    const sources = await readLibSources();
    // Diese Namen waren der alte Erzeugungspfad. Kommt einer zurueck, ist der Weg zurueck wieder offen.
    const forbidden = [
      "getSponsorOverperfConfig",
      "getSponsorImprovementConfig",
      "SPONSOR_OVERPERF_FAMILY",
      "SPONSOR_IMPROVEMENT_FAMILY",
      "buildOverperformanceComponent",
      "buildFanInfrastructureSpecialComponent",
      "buildBeatExpectedRankSpecialComponent",
    ];
    for (const name of forbidden) {
      const hits = sources.filter((s) => codeOnly(s.text).includes(name)).map((s) => s.file);
      expect(hits, `"${name}" ist wieder in lib/: ${hits.join(", ")}`).toEqual([]);
    }
  });

  it("nichts in lib/ BAUT noch eine improvement- oder overperformance-Komponente", async () => {
    const sources = await readLibSources();
    // Das Lesen (`component.kind === "improvement"`) bleibt erlaubt und noetig; verboten ist nur das
    // Erzeugen, also das Objektliteral `kind: "improvement"`.
    for (const kind of ["improvement", "overperformance"]) {
      const hits = sources.filter((s) => new RegExp(`kind:\\s*"${kind}"`).test(codeOnly(s.text))).map((s) => s.file);
      expect(hits, `eine Komponente der Art "${kind}" wird wieder gebaut: ${hits.join(", ")}`).toEqual([]);
    }
  });

  it("die Erzeugungs-Module nennen keine der elf alten Kurvenformen mehr", async () => {
    const generationFiles = [
      "lib/sponsor/sponsor-offer-service.ts",
      "lib/sponsor/sponsor-tier-pool.ts",
      "lib/sponsor/sponsor-v2-offer-service.ts",
      "lib/sponsor/sponsor-brand-catalog.ts",
      "lib/sponsor/sponsor-brand-variants.ts",
    ];
    for (const file of generationFiles) {
      const text = await fs.readFile(path.join(process.cwd(), file), "utf8");
      // Der Kommentar darf sie beim Namen nennen; der CODE nicht. Deshalb wird zeilenweise geprueft und
      // reine Kommentarzeilen werden uebersprungen.
      const codeLines = codeOnly(text);
      for (const shape of SPONSOR_CURVE_SHAPE_KEYS) {
        expect(codeLines.includes(`"${shape}"`), `${file} nennt die alte Kurvenform "${shape}" im Code`).toBe(false);
      }
    }
  });
});
