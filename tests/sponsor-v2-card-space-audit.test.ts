/**
 * KARTENRAUM-AUDIT ALS CI-WACHE.
 *
 * Erzeugt komplette Angebotssaetze (32 Teams x 5 Angebote) ueber den ECHTEN Erzeugungspfad — den
 * des "Neues Spiel"-Knopfes (`buildNewGameStateFromBaseline`) und den des Preseason-Workflows
 * (`ensureSeasonSponsorOffers` unter neuer Saison-ID) — und prueft JEDE Karte auf ihre
 * tatsaechlichen Betraege gegen die sechs Kriterien A-F. Messkern und Schwellen:
 * `scripts/sponsor-v2-card-audit-core.ts`; das CLI-Werkzeug fuer mehr Saetze und den vollen
 * Zahlenbericht ist `scripts/sponsor-v2-card-audit.ts`.
 *
 * WARUM ES DIESEN TEST GIBT: Alle frueheren Pruefungen massen entweder das abstrakte Modell mit
 * eigenen Parametern oder die Verdrahtung ("hat V2-Konditionen") — nie die real erzeugten
 * Betraege. So gingen Karten live, die auf allen 32 Raengen flach 37,0 zahlten (Rangleiter,
 * Klausel, Sonderziel tot) und Karten, deren Sonderziel 77 % der Auszahlung trug. Gemessener
 * Stand VOR der Behebung, 480 Karten: A 104 · B 409 · C 274 · D 0 · E 26 · F 36 Verstoesse.
 * Dieser Test haelt den Stand DANACH fest: 0 Verstoesse, jede Karte, jedes Kriterium.
 */
import { describe, expect, it } from "vitest";

import { generateAndMeasureSeed } from "../scripts/sponsor-v2-card-audit-core";

/** 2 Saetze = 320 Karten: Satz 0 ist exakt der "Neues Spiel"-Pfad, Satz 1 der Folgesaison-Pfad. */
const SEEDS = [0, 1];

describe("sponsor v2 — Kartenraum-Audit ueber den echten Erzeugungspfad", () => {
  for (const seed of SEEDS) {
    it(`Satz ${seed}: alle 160 Karten halten die sechs Kriterien`, { timeout: 300_000 }, () => {
      const res = generateAndMeasureSeed(seed);
      expect(res.cards.length, "es muessen 32 Teams x 5 Angebote entstehen").toBe(160);
      expect(res.missingV2Terms, "jedes Angebot traegt V2-Konditionen").toBe(0);
      const byCriterion = new Map<string, number>();
      for (const f of res.fails) byCriterion.set(f.criterion, (byCriterion.get(f.criterion) ?? 0) + 1);
      expect(
        res.fails.map((f) => `${f.criterion}: ${f.detail}`).slice(0, 10),
        `Verstoesse je Kriterium: ${JSON.stringify(Object.fromEntries(byCriterion))}`,
      ).toEqual([]);
    });
  }
});
