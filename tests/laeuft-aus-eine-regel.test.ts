/**
 * EINE SCHWELLE, EIN ORT.
 *
 * ENTSCHIEDEN VON CHRIS: „nach MD10 muss sie auf 0 LZ sinken!! und das bedeutet läuft aus. Nach
 * verlängern ist sie auf 1 und das ist nicht auslaufend und auch nichts für das auslauf Center."
 *
 * Zehn Anzeigen hatten die Schwelle je einzeln als `contractLength <= 1` stehen. Jede für sich
 * sah harmlos aus; zusammen erklärten sie an Chris' Spielstand 129 von 269 Verträgen für
 * auslaufend, obwohl alle noch eine volle Saison hatten. Und als eine davon korrigiert wurde,
 * widersprach sie prompt den acht übrigen.
 *
 * Die zehnte fiel erst auf, als Chris fragte, warum Xelara „als auslaufend getaggt" wird: das
 * Postfach zog zusaetzlich den GESPEICHERTEN Status `expiring` heran, und der stammt teils aus
 * alten Verlaengerungen.
 *
 * Dieser Wächter hält den Rückweg zu. Er prüft die ANZEIGEN — die Stellen, an denen der Spieler
 * eine Restlaufzeit oder ein „läuft aus" zu sehen bekommt. Die KI-Heuristiken
 * (`ai-transfermarkt-sell-preview-service`, `ai-manager-doctrine-service`) sind bewusst NICHT
 * dabei: dort ist `<= 1` keine Auslauf-Aussage, sondern die Einschätzung „kurzer Vertrag", und
 * die gehört der Spiel-Abstimmung, nicht der Anzeige.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** Jede Datei, die dem Spieler eine Restlaufzeit oder ein „läuft aus" zeigt. */
const ANZEIGEN = [
  "lib/market/contract-negotiation-preview.ts",
  "lib/contracts/contract-recommendation.ts",
  "lib/foundation/player-contract-tile.ts",
  "lib/foundation/tabs/use-teams-roster-table-derivations.ts",
  "app/foundation/teams-v2/FoundationTeamsNewLook.tsx",
  "app/foundation/season-v2/FoundationSeasonFinalePanel.tsx",
  "app/foundation/training-compact/TrainingCompactNewLook.tsx",
  "app/foundation/players-table/FoundationPlayersTableNewLook.tsx",
  "app/foundation/transfermarkt-v2/FoundationMarketSellShellHost.tsx",
  "lib/foundation/game-inbox-service.ts",
] as const;

/**
 * Zeilen, die eine AUSLAUF-Entscheidung an einer eigenen Schwelle festmachen.
 *
 * Bewusst an das Wort gebunden, nicht nur an die Zahl: `contractLength <= 1` steht auch dort
 * voellig zu Recht, wo es um etwas anderes geht — die Gehaltsform eines Einjahresvertrags
 * (`buildShapeWeights`) oder Singular und Plural (`=== 1 ? "Saison" : "Saisons"`). Der Fehler,
 * um den es hier geht, ist die eigene Schwelle fuer „laeuft aus".
 */
const AUSLAUF_WORT = /(expiring|expiry|laeuftAus|läuftAus|auslauf)/i;
const EIGENE_SCHWELLE = /(contractLength|restlaufzeit|remaining)\s*\)?\s*(<=\s*1|===\s*0)(?![0-9])/i;

describe("Kein Anzeigeort rechnet die Auslauf-Schwelle selbst", () => {
  for (const datei of ANZEIGEN) {
    it(`${datei} fragt \`vertragLaeuftAus\``, () => {
      const inhalt = readFileSync(join(process.cwd(), datei), "utf8");
      expect(inhalt, `${datei} importiert die gemeinsame Regel nicht`).toContain(
        "@/lib/contracts/vertragslaufzeit",
      );
      expect(inhalt, `${datei} ruft \`vertragLaeuftAus\` nicht auf`).toContain("vertragLaeuftAus(");

      const treffer = inhalt
        .split("\n")
        .map((zeile, index) => ({ zeile: zeile.trim(), nummer: index + 1 }))
        // Kommentare erklaeren die Regel und duerfen die alte Schwelle nennen.
        .filter(({ zeile }) => !zeile.startsWith("//") && !zeile.startsWith("*") && !zeile.startsWith("/*"))
        .filter(({ zeile }) => EIGENE_SCHWELLE.test(zeile) && AUSLAUF_WORT.test(zeile));

      expect(
        treffer.map(({ nummer, zeile }) => `${datei}:${nummer}  ${zeile}`),
        "eigene Auslauf-Schwelle statt `vertragLaeuftAus`",
      ).toEqual([]);
    });
  }
});
