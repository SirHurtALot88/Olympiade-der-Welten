/**
 * GEMELDET AUS DEM SPIEL (Chris, Sponsoren-Ansicht):
 * „ich sehe hier nicht mehr die sponsoren die die anderen teams haben also mit namen und
 * seltenheit etc"
 *
 * Es gab ZWEI Regeln dafür, ob ein Sponsorvertrag aktuell ist — und sie waren verschieden:
 *
 *   Engine  (`isActiveSponsorContract`): seasonsRemaining > 0 UND (seasonId passt ODER
 *                                        seasonsRemaining > 1)
 *   Anzeige (`getTeamSponsorContract`):  null, sobald seasonId nicht EXAKT passt
 *
 * Ein Mehrjahresvertrag mit altem `seasonId` war damit für die Engine aktiv — er zahlte am
 * Saisonende aus — und für die Oberfläche nicht vorhanden. Die Liga-Sponsorenübersicht baut ihre
 * Zeilen über genau diese Funktion; betroffene Teams standen dort ohne Namen und ohne Seltenheit.
 *
 * Dass der Fall eintritt, liegt am Neustempeln: `advanceSponsorContractsForNewSeason` setzt beim
 * Saisonwechsel `seasonId` neu, wird aber nur aus dem Preseason-Workflow gerufen. Ein Spielstand,
 * der die Saison auf einem anderen Weg gewechselt hat, trägt Verträge mit altem `seasonId`.
 *
 * Diese Datei hält beide Seiten der Sache fest: der Mehrjahresvertrag wird sichtbar, UND der
 * verbrauchte Einjahresvertrag der Vorsaison bleibt unsichtbar — er war der Grund für den strengen
 * Riegel, und die gemeinsame Regel darf ihn nicht aufweichen.
 */
import { describe, expect, it } from "vitest";

import type { GameState, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { isActiveSponsorContract } from "@/lib/sponsor/sponsor-contract-lifecycle";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";

const contract = (partial: Partial<TeamSponsorContract>): TeamSponsorContract =>
  ({
    seasonId: "season-2",
    seasonsRemaining: 1,
    name: "Nordwind Werke",
    rarity: "selten",
    ...partial,
  }) as TeamSponsorContract;

const stateWith = (entry: TeamSponsorContract | null, seasonId = "season-2"): GameState =>
  ({
    season: { id: seasonId },
    seasonState: { sponsorContractsByTeamId: entry ? { "A-A": entry } : {} },
  }) as unknown as GameState;

describe("Sponsorvertrag — Anzeige und Engine sind sich einig", () => {
  it("zeigt den Vertrag der laufenden Saison", () => {
    const entry = contract({ seasonId: "season-2", seasonsRemaining: 1 });
    expect(getTeamSponsorContract(stateWith(entry), "A-A")).toBe(entry);
  });

  /**
   * DER GEMELDETE FALL: Mehrjahresvertrag, dessen `seasonId` noch auf die Abschlusssaison zeigt.
   * Die Engine zahlt ihn aus — vorher war er in der Übersicht unsichtbar.
   */
  it("zeigt einen laufenden Mehrjahresvertrag auch mit alter seasonId", () => {
    const entry = contract({ seasonId: "season-1", seasonsRemaining: 3 });
    expect(getTeamSponsorContract(stateWith(entry), "A-A")).toBe(entry);
  });

  /**
   * DIE GEGENSEITE — die Absicht des alten, strengen Riegels. Ein VERBRAUCHTER Einjahresvertrag
   * der Vorsaison darf nicht als aktueller Sponsor erscheinen; sonst listet die Übersicht ein Team
   * mit einem Sponsor, den es nicht mehr hat.
   */
  it("zeigt einen verbrauchten Einjahresvertrag der Vorsaison NICHT", () => {
    expect(getTeamSponsorContract(stateWith(contract({ seasonId: "season-1", seasonsRemaining: 1 })), "A-A")).toBeNull();
  });

  it("zeigt einen abgelaufenen Vertrag nicht", () => {
    expect(getTeamSponsorContract(stateWith(contract({ seasonsRemaining: 0 })), "A-A")).toBeNull();
    expect(getTeamSponsorContract(stateWith(null), "A-A")).toBeNull();
  });

  /**
   * DIE KLAMMER: was die Engine für aktiv hält, muss die Anzeige zeigen — und umgekehrt. Genau
   * diese Deckungsgleichheit fehlte, und genau daran hing die Meldung.
   */
  it("Anzeige und Engine urteilen über dieselben Verträge gleich", () => {
    const cases: TeamSponsorContract[] = [
      contract({ seasonId: "season-2", seasonsRemaining: 1 }),
      contract({ seasonId: "season-1", seasonsRemaining: 3 }),
      contract({ seasonId: "season-1", seasonsRemaining: 1 }),
      contract({ seasonId: "season-2", seasonsRemaining: 0 }),
      contract({ seasonId: "season-3", seasonsRemaining: 2 }),
    ];
    for (const entry of cases) {
      const shown = getTeamSponsorContract(stateWith(entry), "A-A") != null;
      const active = isActiveSponsorContract(entry, "season-2");
      expect(shown, `seasonId=${entry.seasonId} remaining=${entry.seasonsRemaining}`).toBe(active);
    }
  });
});
