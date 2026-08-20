/**
 * DIE ARENA SAGT AN, BEVOR DIE KAUFPHASE FÜR EINE GANZE SAISON ZUFÄLLT.
 *
 * GEMELDET VON CHRIS (`cubix1`, „Spieltag · Home", Spielstand `hwz8fk`, Saison 2, MD1):
 * „Season Übergang von S1 -> S2 blockiert die neuen käufe und die kann man manuell nicht
 * nachholen. das ist natürlich ein problem bitte dann probleme fixen und käufe erneut anstoßen"
 *
 * DIE REGEL BLEIBT — nachgemessen war das kein Defekt. `TRANSFER_BUY_PHASES` ist leer, gekauft
 * wird ausschliesslich in der neuen Saison vor ihrem ersten Spieltag, und „nicht nachholen" ist
 * genau die gewollte Härte dieser Regel. Chris hat aus drei Wegen den ersten gewählt: nichts an
 * der Regel, nur die fehlende Ansage davor.
 *
 * GEPRÜFT WIRD DIE ENTSCHEIDUNG, nicht die Pixel: wann erscheint die Warnung, wann nicht. Dazu
 * eine Wache, dass die Arena sie überhaupt anzeigt — eine Warnung, die niemand rendert, ist keine.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { ermittleKaufphasenWarnung } from "@/lib/foundation/discipline-stage/kaufphasen-warnung";

const ARENA = readFileSync(
  join(process.cwd(), "app/foundation/discipline-stage/DisciplineStageArena.tsx"),
  "utf8",
);

/**
 * Der gemeldete Stand, eingedampft: neue Saison, Spieltag 1 noch offen, kein Ergebnis gebucht.
 * Genau die vier Bedingungen aus `isEarlySeasonTransferSetup`.
 */
function spielstand(input: {
  gamePhase?: string;
  currentMatchday?: number;
  matchdayStatus?: string;
  mitErgebnis?: boolean;
  teams?: Array<{ teamId: string; cash: number; manuell: boolean }>;
}): GameState {
  const teams = input.teams ?? [
    { teamId: "S-C", cash: 24.5, manuell: true },
    { teamId: "M-M", cash: 900, manuell: false },
  ];
  return {
    gamePhase: input.gamePhase ?? "season_active",
    season: { id: "season-2", currentMatchday: input.currentMatchday ?? 1, matchdayIds: ["season-2-matchday-1"] },
    matchdayState: {
      matchdayId: "season-2-matchday-1",
      status: input.matchdayStatus ?? "planning",
    },
    teams: teams.map((team) => ({
      teamId: team.teamId,
      shortCode: team.teamId,
      name: `Team ${team.teamId}`,
      cash: team.cash,
      humanControlled: team.manuell,
    })),
    seasonState: {
      teamControlSettings: Object.fromEntries(
        teams.map((team) => [
          team.teamId,
          { teamId: team.teamId, controlMode: team.manuell ? "manual" : "ai", ownerId: team.manuell ? "user_local" : null },
        ]),
      ),
      matchdayResults: input.mitErgebnis
        ? [{ id: "r1", seasonId: "season-2", matchdayId: "season-2-matchday-1", status: "preview_applied" }]
        : [],
    },
  } as unknown as GameState;
}

describe("Die Warnung erscheint genau im letzten Moment, in dem sie noch nützt", () => {
  it("neue Saison, Spieltag 1 offen, Geld auf dem Konto → Warnung mit Kontostand", () => {
    // Der gemeldete Fall. Vorher stand hier nichts, und das Fenster fiel wortlos zu.
    expect(ermittleKaufphasenWarnung(spielstand({}))).toEqual({ kontostand: 24.5, teamCount: 1 });
  });

  it("sobald der Spieltag ein Ergebnis trägt, ist die Warnung gegenstandslos", () => {
    // Ab hier ist die Tür zu — eine Warnung wäre jetzt nur noch Hohn.
    expect(ermittleKaufphasenWarnung(spielstand({ mitErgebnis: true }))).toBeNull();
  });

  it("ein gewerteter Spieltag schliesst sie ebenfalls", () => {
    expect(ermittleKaufphasenWarnung(spielstand({ matchdayStatus: "resolved" }))).toBeNull();
  });

  it("ab Spieltag 2 gibt es nichts mehr anzusagen", () => {
    expect(ermittleKaufphasenWarnung(spielstand({ currentMatchday: 2 }))).toBeNull();
  });

  it("am SAISONENDE schweigt sie — dort wird verkauft, nicht gekauft", () => {
    // Die zweite Hälfte von Chris' Regel. Stünde die Warnung auch hier, behauptete sie ein
    // Kauffenster, das es am Saisonende für niemanden gibt.
    expect(ermittleKaufphasenWarnung(spielstand({ gamePhase: "season_end_management" }))).toBeNull();
    expect(ermittleKaufphasenWarnung(spielstand({ gamePhase: "transfer_sell_phase" }))).toBeNull();
  });

  it("ein Teil-Spielstand ohne Saison oder Spieltag wirft nicht, er schweigt", () => {
    /**
     * DER FALL, DER DIE ARENA ZERLEGT HAT. `isEarlySeasonTransferSetup` liest
     * `season.currentMatchday` und `matchdayState.status` ungeschuetzt; im Bootstrap- und im
     * Render-Test-Fall fehlen beide, und der Aufruf warf mitten im `useMemo` der Arena. Sichtbar
     * wurde das erst in der vollen Testsuite — die Fälle darüber bauen alle einen kompletten
     * Spielstand, und genau deshalb hat keiner davon es gesehen.
     */
    expect(ermittleKaufphasenWarnung({} as never)).toBeNull();
    expect(ermittleKaufphasenWarnung({ teams: [] } as never)).toBeNull();
    expect(ermittleKaufphasenWarnung({ season: { id: "season-1" } } as never)).toBeNull();
    expect(ermittleKaufphasenWarnung({ matchdayState: { status: "planning" } } as never)).toBeNull();
  });

  it("ohne Geld keine Warnung — sie wäre eine Ansage ohne Handlungsmöglichkeit", () => {
    expect(
      ermittleKaufphasenWarnung(spielstand({ teams: [{ teamId: "S-C", cash: 0, manuell: true }] })),
    ).toBeNull();
  });

  it("ein negativer Kontostand zählt als kein Geld, nicht als Minus im Topf", () => {
    // Sonst zöge ein überzogenes Team die Summe eines zweiten nach unten (Koop) oder erzeugte
    // allein eine negative „Warnung".
    expect(
      ermittleKaufphasenWarnung(spielstand({ teams: [{ teamId: "S-C", cash: -12, manuell: true }] })),
    ).toBeNull();
  });

  it("das Geld der KI-Teams zählt NICHT mit", () => {
    // Im Aufbau oben trägt M-M 900 und ist KI-gesteuert. Zählte es mit, erschiene die Warnung
    // auch für einen Menschen mit leerem Konto.
    expect(
      ermittleKaufphasenWarnung(
        spielstand({
          teams: [
            { teamId: "S-C", cash: 0, manuell: true },
            { teamId: "M-M", cash: 900, manuell: false },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("im Koop werden alle eigenen Konten zusammengezählt", () => {
    expect(
      ermittleKaufphasenWarnung(
        spielstand({
          teams: [
            { teamId: "S-C", cash: 10.5, manuell: true },
            { teamId: "V-W", cash: 4.5, manuell: true },
            { teamId: "M-M", cash: 900, manuell: false },
          ],
        }),
      ),
    ).toEqual({ kontostand: 15, teamCount: 2 });
  });
});

describe("Die Arena zeigt sie auch wirklich an", () => {
  it("die Vor-dem-Anpfiff-Tafel ruft die Entscheidung auf", () => {
    expect(ARENA).toContain("ermittleKaufphasenWarnung");
  });

  it("sie steht in der Tafel UND auf dem Knopf zur Bühne", () => {
    // Beides zusammen ist die Aussage: wer die Tafel überfliegt, liest wenigstens den Knopf.
    expect(ARENA).toContain("arena-prematch-kaufwarnung");
    const knopf = ARENA.slice(ARENA.indexOf("arena-prematch-start-cta"));
    expect(knopf.slice(0, 600)).toContain("schließt die Kaufphase");
  });
});
