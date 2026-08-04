/**
 * GEMELDET VON CHRIS (Screenshot des Verhandlungsfensters): „die Debug-Kommentare müssen entfernt
 * werden."
 *
 * Unter der Überschrift RISIKEN standen Sätze, die kein Risiko des DEALS beschreiben, sondern den
 * Stand unserer eigenen Rechnung: „Marktklasse ist nur grob eingeschaetzt.",
 * „Verhandlungssimulation — finaler Kauf über ‚Kauf bestätigen'.", „Ein Teil der Trait-Effekte ist
 * noch unscharf." Ein Spieler kann daraus nichts ableiten; er erfährt nur, dass wir uns unsicher
 * sind — an einer Stelle, an der er eine Kaufentscheidung trifft.
 *
 * Geprüft werden zwei Regeln:
 *
 *  1. Diese Codes werden nicht mehr angezeigt — in BEIDEN Kopien der Filterliste. Es gibt zwei;
 *     eine allein zu pflegen hieße, dass der Hinweis je nach Einstiegsweg doch wieder auftaucht.
 *  2. Im Verhandlungstext stehen echte Umlaute. „drueckt", „haerter", „Vertraege" gehören in
 *     Quelltext-Kommentare, nicht auf eine Karte, die jemand liest.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

/** Beide Stellen, die Verhandlungs-Hinweise filtern. Sie müssen sich gleich verhalten. */
const FILTER_SITES = [
  "lib/foundation/tabs/use-market-buy-derivations.ts",
  "app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx",
];

/** Hinweise über den Stand unserer eigenen Rechnung — kein Deal-Risiko. */
const INTERNAL_NOTE_CODES = [
  "market_bracket_factor_preview_pending",
  "preview_only_contract_negotiation",
  "trait_salary_factor_source_missing",
];

describe("Verhandlungsfenster zeigt keine Notizen über die eigene Rechnung", () => {
  it.each(FILTER_SITES)("%s unterdrückt alle drei Codes", (file) => {
    const source = readFileSync(join(root, file), "utf8");
    const start = source.indexOf("SUPPRESSED_NEGOTIATION_WARNING_CODES");
    expect(start, `${file}: Filterliste nicht gefunden`).toBeGreaterThanOrEqual(0);
    const block = source.slice(start, source.indexOf("]);", start));
    for (const code of INTERNAL_NOTE_CODES) {
      expect(block, `${file}: "${code}" wird noch angezeigt`).toContain(code);
    }
  });

  it("beide Stellen unterdrücken dieselben Codes", () => {
    // Sonst haengt es vom Einstiegsweg ab, ob der Hinweis erscheint.
    const sets = FILTER_SITES.map((file) => {
      const source = readFileSync(join(root, file), "utf8");
      const start = source.indexOf("SUPPRESSED_NEGOTIATION_WARNING_CODES");
      const block = source.slice(start, source.indexOf("]);", start));
      return [...block.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]!).sort().join(",");
    });
    expect(sets[0]).toBe(sets[1]);
  });

  it("der Abbruch-Hinweis bleibt — er IST ein Risiko", () => {
    // Gegenprobe: die Unterdrueckung darf nicht zu viel wegnehmen. Was den Spieler etwas kostet,
    // muss stehen bleiben.
    for (const file of FILTER_SITES) {
      const source = readFileSync(join(root, file), "utf8");
      const start = source.indexOf("SUPPRESSED_NEGOTIATION_WARNING_CODES");
      const block = source.slice(start, source.indexOf("]);", start));
      expect(block).not.toContain("negotiation_cancelled_after_contact");
      expect(block).not.toContain("insufficient_cash");
      expect(block).not.toContain("offer_below_expected_salary");
    }
  });
});

describe("Verhandlungstexte tragen echte Umlaute", () => {
  const TEXT_SITES = [
    "lib/market/contract-negotiation-preview.ts",
    "lib/foundation/tabs/use-market-buy-derivations.ts",
    "app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx",
    "lib/foundation/tabs/foundation-format-render-helpers.ts",
  ];

  it.each(TEXT_SITES)("%s schreibt keine Umschreibungen in Nutzertexte", (file) => {
    const source = readFileSync(join(root, file), "utf8");
    // Nur Zeichenketten pruefen — in Kommentaren ist ae/oe/ue im Repo ueblich und in Ordnung.
    const strings = [...source.matchAll(/"([^"\\\n]{4,})"/g)].map((match) => match[1]!);
    const offenders = strings.filter((text) =>
      /(drueckt|haerter|boeses|Vertraege|eingeschaetzt|erhoeht|staerker|schwaecher)/i.test(text),
    );
    expect(offenders, `${offenders.length} Nutzertexte mit ae/oe/ue`).toEqual([]);
  });
});
