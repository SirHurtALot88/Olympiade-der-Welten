/**
 * DIE MW-ZERLEGUNG DARF NICHT IM BROWSER GERECHNET WERDEN — und der Hover muss sie bekommen.
 *
 * Das ist eine QUELLTEXT-Eigenschaft, deshalb ein Quelltext-Waechter: die Kette Slice → Hook →
 * Zeile → Panel besteht aus vier Zuweisungen in vier Dateien, und faellt EINE davon weg, ist der
 * Hover leer, waehrend `tsc` zufrieden bleibt (jedes Feld ist optional) und jede Einzelableitung
 * gruen ist. Genau dieser Fehler ist bei den Saisonstand-Hovers schon einmal passiert
 * (`hoverKader` lag am nirgends gerenderten Modell) und waere durch jeden anderen Test gekommen.
 *
 * DIE ZWEITE HAELFTE IST DIE WICHTIGERE. `references/formulas/rank-to-discipline-market-value.json`
 * ist 222 KB gross und liegt heute in KEINEM Client-Bundle. Wer die Zerlegung „mal eben" im Hook
 * rechnet, zieht sie hinein — fuer einen Tooltip. Deshalb steht hier fest, dass die Rechenwege
 * (`calculateMarketValueFromRankTable`, `loadPlayerFormulaSources`) im Client-Pfad NICHT
 * vorkommen. `npm run ci:client-bundle-lint` prueft Modulgrenzen, nicht diese Absicht.
 *
 * Die `readFileSync(join(process.cwd()`-Aufrufe stehen ausgeschrieben da: `fahre-quelltext-
 * waechter.ts` sammelt seine Auswahl an genau dieser woertlichen Signatur ein, und eine Fassung
 * mit Pfadkonstanten fiele lautlos aus dem Pflicht-Job.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const slice = readFileSync(join(process.cwd(), "lib/foundation/player-directory-slice.ts"), "utf8");
const hook = readFileSync(join(process.cwd(), "lib/foundation/use-player-directory-slice.ts"), "utf8");
const zeilenbauer = readFileSync(
  join(process.cwd(), "lib/foundation/tabs/use-foundation-cross-tab-player-directory.ts"),
  "utf8",
);
const tabelle = readFileSync(
  join(process.cwd(), "app/foundation/players-table/FoundationPlayersTableNewLook.tsx"),
  "utf8",
);

describe("Marktwert-Hover · die Kette vom Server bis zur Zelle", () => {
  it("rechnet die Zerlegung im Slice — dort liegt der volle Save", () => {
    expect(slice).toContain("calculateMarketValueFromRankTable");
    expect(slice).toContain("marketValueBreakdownByPlayerId: buildMarketValueBreakdownByPlayerId(input.gameState)");
  });

  it("reicht sie durch den Hook, mit stabilem Leer-Rueckfall fuer alte Payloads", () => {
    // Ein vor diesem Feld gecachter Payload darf kein `undefined` durch die React-Deps tragen —
    // dieselbe Vorsichtsmassnahme wie bei den drei Feldern daneben.
    expect(hook).toContain("EMPTY_MARKET_VALUE_BREAKDOWN_BY_PLAYER_ID");
    expect(hook).toContain("payload?.marketValueBreakdownByPlayerId ?? EMPTY_MARKET_VALUE_BREAKDOWN_BY_PLAYER_ID");
  });

  it("legt sie auf die Zeile der Spielerliste", () => {
    expect(zeilenbauer).toContain("marketValueBreakdown: sliceMarketValueBreakdowns[player.id] ?? null");
  });

  it("haengt den Hover an die MW-Zelle und nicht an eine andere", () => {
    expect(tabelle).toContain("renderMarketValuePanel");
    expect(tabelle).toContain("panel={renderMarketValuePanel({");
    expect(tabelle).toContain("herleitung: row.marketValueBreakdown");
  });

  it("zieht die 222-KB-Rangtabelle NICHT in den Client-Pfad", () => {
    for (const [name, quelltext] of [
      ["use-player-directory-slice.ts", hook],
      ["use-foundation-cross-tab-player-directory.ts", zeilenbauer],
      ["FoundationPlayersTableNewLook.tsx", tabelle],
    ] as const) {
      expect(quelltext, `${name} zieht die Rangtabelle in den Client`).not.toContain(
        "loadPlayerFormulaSources",
      );
      expect(quelltext, `${name} rechnet die Zerlegung im Client`).not.toContain(
        "calculateMarketValueFromRankTable",
      );
    }
  });

  it("haelt sich bewusst KEINE lokale Rueckfallebene offen", () => {
    // Beim Verkaufswert gibt es eine (`useSliceSellValues`), hier absichtlich nicht: eine im
    // Browser halb gerechnete Zerlegung waere eine zweite, leicht andere Zahl neben der gezeigten.
    // Der Kommentar traegt die Begruendung — er darf nicht verschwinden, ohne dass es auffaellt.
    expect(zeilenbauer).toContain("KEINE lokale Rückfallebene");
  });
});
