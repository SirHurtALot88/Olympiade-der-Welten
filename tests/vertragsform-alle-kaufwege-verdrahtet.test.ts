/**
 * JEDER LEBENDE KAUFWEG MUSS DIE TEAMLAGE MITGEBEN — sonst waehlt er die Vertragsform blind.
 *
 * WARUM ES DIESEN TEST GIBT. `recommendContractOfferForPlayer` wird an mehreren Stellen gerufen.
 * Beim ersten Umbau war nur EINE davon mit der Apron-/Mix-Lage versorgt; die anderen fielen still
 * auf das alte Verhalten zurueck. Das faellt in keinem Verhaltenstest auf: die Empfehlung ist ohne
 * die Angaben absichtlich unveraendert, also ist ein unverdrahteter Aufrufer nicht von einem
 * korrekt arbeitenden zu unterscheiden. Erst ein Audit hat es aufgedeckt.
 *
 * WAS HIER GEPRUEFT WIRD, ist deshalb die VERDRAHTUNG selbst, an der Quelle: ruft eine Datei die
 * Empfehlung, muss im selben Aufruf `getContractShapeTeamContext` stehen. Das ist bewusst ein
 * Quelltext-Test — die Fehlerklasse ist „jemand baut einen neuen Kaufweg und vergisst die Lage",
 * und die faengt man nur so.
 *
 * NICHT GEPRUEFT werden Ops-/Sandbox-Pfade und die reine Anzeige-Vorschau: sie kaufen nicht.
 *
 * ZUR EINORDNUNG, WELCHE WEGE UEBERHAUPT LEBEN (Chris: „AI ROSTER FILL haben wir doch verboten ->
 * es gibt nur noch ORGANIC engine!"): der Fuell-Lauf `auto-roster-fill-service.ts` ist ab Saison 2
 * gesperrt, die Sperre steht im Dienst selbst. Gekauft wird organisch — `ai_organic_squad_buy`
 * (Slow-Path) und `ai_preseason_market_buy` (Marktplan); der organische Setup-Draft der Saison 1
 * laeuft ueber den Fast-Batch und beschriftet seine Transfers nur weiterhin mit `ai_roster_fill`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = process.cwd();

/** Dateien, die im Spiel WIRKLICH einen Kauf ausloesen. */
const KAUFWEGE = [
  "lib/market/transfermarkt-local-service.ts",
  "lib/ai/ai-market-plan-apply-service.ts",
] as const;

/**
 * Schneidet zu jedem `recommendContractOfferForPlayer({`-Aufruf den Argumentblock heraus — von der
 * oeffnenden Klammer bis zur passenden schliessenden, damit verschachtelte Objekte nicht abschneiden.
 */
function schneideAufrufe(quelle: string): string[] {
  const bloecke: string[] = [];
  const marke = "recommendContractOfferForPlayer({";
  let ab = 0;
  for (;;) {
    const start = quelle.indexOf(marke, ab);
    if (start < 0) break;
    let tiefe = 0;
    let i = start + marke.length - 1;
    for (; i < quelle.length; i += 1) {
      if (quelle[i] === "{") tiefe += 1;
      else if (quelle[i] === "}") {
        tiefe -= 1;
        if (tiefe === 0) break;
      }
    }
    bloecke.push(quelle.slice(start, i + 1));
    ab = i + 1;
  }
  return bloecke;
}

describe("Vertragsform: alle lebenden Kaufwege geben die Teamlage mit", () => {
  for (const datei of KAUFWEGE) {
    it(`${datei} versorgt jeden Empfehlungs-Aufruf mit der Apron-/Mix-Lage`, () => {
      const quelle = readFileSync(join(WURZEL, datei), "utf8");
      const aufrufe = schneideAufrufe(quelle);

      // Ohne diese Zusicherung liefe der Test leer durch, sobald sich der Aufrufname aendert.
      expect(aufrufe.length, `keine Aufrufe in ${datei} gefunden — Test ist blind geworden`).toBeGreaterThan(0);

      const blind = aufrufe.filter((block) => !block.includes("getContractShapeTeamContext"));
      expect(
        blind.map((block) => block.slice(0, 160)),
        `${datei}: ${blind.length} von ${aufrufe.length} Aufruf(en) ohne getContractShapeTeamContext`,
      ).toEqual([]);
    });
  }

  it("die Verlaengerung gibt die Lage ebenfalls mit", () => {
    const quelle = readFileSync(join(WURZEL, "lib/contracts/contract-renewal-service.ts"), "utf8");
    expect(quelle).toContain("chooseAiRenewalContractShape({");
    // Der Riegel haengt am `shapeContext` — fehlt er, waehlt die Verlaengerung wieder blind.
    expect(quelle).toContain("shapeContext: getContractShapeTeamContext(");
  });

  it("der Fuell-Lauf ist weiterhin ab Saison 2 gesperrt", () => {
    // Chris' Verbot steht im Dienst selbst und nicht nur beim Aufrufer. Faellt die Sperre, waere die
    // Einordnung oben falsch — und ein zweiter, qualitaetsloser Kaufweg zurueck im Spiel.
    const quelle = readFileSync(join(WURZEL, "lib/ai/auto-roster-fill-service.ts"), "utf8");
    expect(quelle).toContain("VERBOTEN AB SAISON 2");
  });
});
