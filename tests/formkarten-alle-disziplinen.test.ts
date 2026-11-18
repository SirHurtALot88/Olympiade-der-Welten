/**
 * FORMKARTEN IN ALLEN DISZIPLINEN + FARBBONUS JE SPIELER (18.11., Chris aus dem Live-Spiel).
 *
 * A) "zählt hier noch nicht": in Arena-Disziplinen ausser time-trial/spurt nahm der Motor eine Ersatzkarte.
 *    Seit 18.11. steht jede motor-gebuchte Disziplin in FORMKARTEN_ECHT_DISCIPLINE_IDS. Dieser Test haelt:
 *     1. Waechter: keine Disziplin, die im Battle-Modus aus dem Motor gebucht wird, fehlt in der Menge
 *        (sonst kehrt der Hinweis zurueck und die Karte zaehlt still nicht).
 *     2. Vorschau = Motor-Eingabe: die Zahl, die die Einsatzliste je Spieler zeigt (`berechneKartenWirkung`),
 *        ist genau die `form`, die `buildArenaAufstellung` dem Motor uebergibt — dieselbe Funktion bauen
 *        Vorlauf, Pods, Eingabe-Hash und Arena-Anzeige, also bucht der Motor genau diese Zahl.
 *     3. Der Motor liest die Karte auch in Mini-DM-FFA (FORM_POD), dessen Aufstellung nicht ueber `place` laeuft.
 * B) Farbbonus: der Zusatz einer Karte geht an Spieler, deren KLASSE die Kartenfarbe hat — nicht an die
 *    Disziplinfarbe, nicht an die Rolle. Chris' Fall: Battlefield (SOC), Mental-Karte +8 von Duskwhisper;
 *    aufgestellt Kati (Bard, SOC), Ferdinand Lionfist (Warlord, POW), Wildfire (Tactician, SOC) -> alle +4,
 *    Farbe ±0, weil keiner MEN ist.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";
import { FORMKARTEN_ECHT_DISCIPLINE_IDS, nutztEchteFormkarten } from "@/lib/battle/formkarten-echt-disziplinen";
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildArenaAufstellung } from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";
import {
  berechneKartenWirkung,
  formkartenBuchung,
  kartenEffektText,
  wirdAusMotorGebucht,
} from "@/lib/lineups/formkarten-wirkung";
import { getTeamFormCardOptions } from "@/lib/lineups/legacy-lineup-modifiers";

const SPIELER = [
  { id: "kati", name: "Kati", className: "Bard" },
  { id: "ferdinand", name: "Ferdinand Lionfist", className: "Warlord" },
  { id: "wildfire", name: "Wildfire", className: "Tactician" },
  { id: "dusk", name: "Duskwhisper", className: "Mage" },
];

function spielstand(disciplineId: string, category: string, aufgestellt: string[], karte: string) {
  return {
    scenarioMeta: { gameMode: "battle" },
    players: SPIELER,
    rosters: SPIELER.map((s) => ({ id: `roster-${s.id}`, teamId: "t1", playerId: s.id })),
    disciplines: [{ id: disciplineId, name: disciplineId, category }],
    seasonState: {
      formCards: [
        { id: "fc-dusk", saveId: "s1", seasonId: "season-1", teamId: "t1", playerId: "dusk", playerName: "Duskwhisper", cardColor: "blue", cardValue: 8, createdAt: "x" },
        { id: "fc-kati", saveId: "s1", seasonId: "season-1", teamId: "t1", playerId: "kati", playerName: "Kati", cardColor: "yellow", cardValue: 8, createdAt: "x" },
      ],
      formCardPlans: [],
      lineupDrafts: [
        {
          lineupId: "l1",
          saveId: "s1",
          seasonId: "season-1",
          matchdayId: "md-1",
          teamId: "t1",
          status: "draft",
          modifiers: { d2: { primaryFormCardId: karte, secondaryFormCardId: null, intensity: "normal" } },
          entries: aufgestellt.map((id, i) => ({
            disciplineId,
            disciplineSide: "d2",
            slotIndex: i,
            playerId: id,
            activePlayerId: `roster-${id}`,
          })),
        },
      ],
    },
  } as unknown as GameState;
}

function wirkung(gs: GameState, disciplineId: string, category: string, aufgestellt: string[], karte: string) {
  return berechneKartenWirkung({
    gameState: gs,
    side: "d2",
    disciplineId,
    disciplineCategory: category,
    formCards: getTeamFormCardOptions({ gameState: gs, seasonId: "season-1", teamId: "t1", lineupId: "l1" }),
    primaryCardId: karte,
    secondaryCardId: null,
    playerIds: aufgestellt,
  });
}

describe("A) Formkarte zählt in jeder motor-gebuchten Disziplin", () => {
  it("Wächter: jede im Battle-Modus aus dem Motor gebuchte Disziplin liest die gespielte Karte", () => {
    const motorGebucht = [...ARENA_RESOLVED_DISCIPLINE_IDS, "battlefield", "mini-dm"].filter(wirdAusMotorGebucht);
    expect(motorGebucht.length).toBeGreaterThanOrEqual(17);
    const fehlend = motorGebucht.filter((d) => !FORMKARTEN_ECHT_DISCIPLINE_IDS.has(d));
    expect(fehlend).toEqual([]);
  });

  it("Climbing (D1 im Live-Spiel) bucht die Karte, kein 'zählt hier noch nicht' mehr", () => {
    expect(nutztEchteFormkarten("climbing")).toBe(true);
    const gs = spielstand("climbing", "speed", ["kati", "wildfire"], "fc-dusk");
    expect(formkartenBuchung(gs, "climbing")).toEqual({ gebucht: true, grund: null });
  });

  for (const [d, kat, k] of [
    ["climbing", "speed", 2],
    ["battlefield", "social", 3],
    ["basketball", "social", 3],
    ["mini-dm", "power", 2],
  ] as const) {
    it(`${d}: Vorschau je Spieler = form, die der Motor bekommt (gezeigt = gebucht)`, () => {
      const aufgestellt = ["kati", "ferdinand", "wildfire", "dusk"].slice(0, k);
      for (const karte of ["fc-dusk", "fc-kati"]) {
        const gs = spielstand(d, kat, aufgestellt, karte);
        const w = wirkung(gs, d, kat, aufgestellt, karte);
        const motor = buildArenaAufstellung(gs, "t1", "md-1");
        const namen = Object.keys(motor);
        expect(namen.length).toBe(aufgestellt.length);
        for (const s of w.spieler) {
          const name = SPIELER.find((x) => x.id === s.playerId)!.name;
          expect(motor[name]).toMatchObject({ d, form: s.zerlegung.summe, intensitaet: "normal" });
        }
        // Team-Summe der Anzeige = Summe der Motor-Eingaben.
        const summe = namen.reduce((x, n) => x + (motor[n].form ?? 0), 0);
        expect(Number(summe.toFixed(1))).toBe(w.teamSumme);
      }
    });
  }

  it("Karte wechseln ändert die Motor-Eingabe (Eingabe-Hash/Vorlauf rechnen neu)", () => {
    const a = buildArenaAufstellung(spielstand("climbing", "speed", ["kati", "wildfire"], "fc-dusk"), "t1", "md-1");
    const b = buildArenaAufstellung(spielstand("climbing", "speed", ["kati", "wildfire"], "fc-kati"), "t1", "md-1");
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  const motor = readFileSync(
    join(fileURLToPath(new URL(".", import.meta.url)), "..", "public", "mockups", "battle-mode.engine.js"),
    "utf8",
  );
  it("Motor: Mini-DM-FFA liest die Karte aus platzJeTeam (FORM_POD), sonst unverändert", () => {
    expect(motor).toContain("FORM_POD=mdffaFormAusPlatz(platzJeTeam)||formPodVorher;");
    expect(motor).toContain("} finally { FORM_POD=formPodVorher; }");
    expect(motor).toContain("if(ep&&ep.d===d)return {form:ep.form,int:INTENSITAET[ep.intensitaet]?ep.intensitaet:\"normal\"};");
  });
  it("Motor: der Pod-Messschalter fasst FORM_MESS nur im Modus 'echt' an", () => {
    expect(motor).toContain('if(FORM_MESS_MODUS==="echt")FORM_MESS=zieheFormSzenarioEcht((saat^0x5bd1e995)>>>0,teams);');
  });
});

describe("B) Farbbonus je Spieler: Klasse = Kartenfarbe", () => {
  it("Chris' Fall: Battlefield (SOC), MEN-Karte +8 -> alle +4, keiner bekommt Farbbonus, mit Begründung", () => {
    const aufgestellt = ["kati", "ferdinand", "wildfire"];
    const gs = spielstand("battlefield", "social", aufgestellt, "fc-dusk");
    const w = wirkung(gs, "battlefield", "social", aufgestellt, "fc-dusk");
    expect(w.spieler.map((s) => [s.playerId, s.zerlegung.alle, s.zerlegung.traeger, s.zerlegung.summe])).toEqual([
      ["kati", 4, 0, 4],
      ["ferdinand", 4, 0, 4],
      ["wildfire", 4, 0, 4],
    ]);
    expect(w.teamSumme).toBe(12);
    const wildfire = w.spieler.find((s) => s.playerId === "wildfire")!;
    expect(wildfire).toMatchObject({ klasse: "Tactician", klassenFarbe: "yellow" });
    expect(wildfire.farbGrund).toBe("kein Farbbonus: Tactician ist SOC, Karte MEN");
    expect(w.spieler.find((s) => s.playerId === "ferdinand")!.farbGrund).toBe("kein Farbbonus: Warlord ist POW, Karte MEN");
    expect(w.farbHinweis).toBe("Farbbonus MEN nur für Mage, Overseer, Templar — keiner aufgestellt");
  });

  it("Gegenprobe: ein Mage auf dem Feld bekommt +4 alle und +4 Farbbonus", () => {
    const aufgestellt = ["kati", "ferdinand", "dusk"];
    const gs = spielstand("battlefield", "social", aufgestellt, "fc-dusk");
    const w = wirkung(gs, "battlefield", "social", aufgestellt, "fc-dusk");
    const dusk = w.spieler.find((s) => s.playerId === "dusk")!;
    expect(dusk.zerlegung).toMatchObject({ alle: 4, traeger: 4, summe: 8, istTraeger: true });
    expect(dusk.farbGrund).toBe("Farbbonus +4: Mage ist MEN wie die Karte");
    expect(w.teamSumme).toBe(16);
    expect(w.farbHinweis).toBe("Farbbonus MEN nur für Mage, Overseer, Templar — 1 aufgestellt");
  });

  it("Passende Karte (SOC in SOC-Disziplin): +8 für alle, Kati und Wildfire zusätzlich +4", () => {
    const aufgestellt = ["kati", "ferdinand", "wildfire"];
    const gs = spielstand("battlefield", "social", aufgestellt, "fc-kati");
    const w = wirkung(gs, "battlefield", "social", aufgestellt, "fc-kati");
    expect(w.spieler.map((s) => [s.playerId, s.zerlegung.summe])).toEqual([
      ["kati", 12],
      ["ferdinand", 8],
      ["wildfire", 12],
    ]);
    expect(w.teamSumme).toBe(32);
  });

  it("Dropdown-Text nennt die Farbe des Bonus statt nur 'Farbe'", () => {
    expect(kartenEffektText({ value: 8, color: "blue" }, "yellow")).toBe(" · fremd: +4 alle, +4 extra für MEN-Spieler");
    expect(kartenEffektText({ value: 8, color: "yellow" }, "yellow")).toBe(" · passt: +8 alle, +4 extra für SOC-Spieler");
  });
});
