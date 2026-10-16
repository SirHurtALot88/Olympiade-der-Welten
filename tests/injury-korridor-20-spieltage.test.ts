/**
 * VERLETZUNGS-KORRIDOR DER 20-SPIELTAGE-BATTLE-SAISON — Fatigue-Plan PR2, Wächter.
 *
 * CHRIS, 30.08. (Plan E.1): „gleiche absolute Zielzahl (150-200/Saison) beibehalten, auch bei 20
 * Spieltagen". Und Plan Teil C: 20 Spieltage dürfen nicht ohne aktive Erholung laufen.
 *
 * GEMESSEN mit `scripts/messe-erholungskorridor.ts` (Basisfall-Liga, echter Spielplan-Generator,
 * zwei unabhängige Saatstämme à 16 Spielpläne, Doku `docs/design/fatigue-aktive-erholung-
 * korridor-16-10.md`):
 *
 *                          10 Spieltage     20 Spieltage
 *   ohne aktive Erholung     112 / 106        482 / 461     Faktor 4,3 — der Ratchet
 *   mit aktiver (4,5)         30 /  28        159 / 154     im Korridor
 *
 * Dieser Test fährt dieselbe Liga über die GLEICHE Simulation (`lib/fatigue/erholungskorridor-
 * simulation.ts`) mit wenigen Saaten und OHNE ENV-Schalter — das Gate entscheidet selbst, weil die
 * simulierte Liga ein Battle-Save mit 20 Spieltagen ist. Er hält drei Dinge fest:
 *   1. der Mittelwert liegt im Korridor (125-200, Untergrenze wie `injury-basisfall-korridor.test.ts`),
 *   2. die aktive Erholung greift dort wirklich (ohne sie läge dieselbe Liga weit darüber),
 *   3. die Verdopplung der Spieltage verdoppelt das Risiko NICHT mehr einfach: 20 Spieltage mit
 *      aktiver Erholung bleiben unter dem Doppelten der heutigen 10-Spieltage-Saison.
 */
import { afterEach, describe, expect, it } from "vitest";

import { runKorridorSeason, slotsFromRealSchedule } from "@/lib/fatigue/erholungskorridor-simulation";

const FLAG = "OLY_FATIGUE_ACTIVE_RECOVERY";
const SAATEN = ["korridor-saat-1", "korridor-saat-2", "korridor-saat-3", "korridor-saat-4"];
const KORRIDOR_MIN = 125;
const KORRIDOR_MAX = 200;

afterEach(() => {
  delete process.env[FLAG];
});

const mittel = (werte: number[]) => werte.reduce((summe, wert) => summe + wert, 0) / werte.length;

describe("Verletzungs-Korridor der 20-Spieltage-Battle-Saison", () => {
  it(
    "liegt im Korridor, greift über das Gate und verdoppelt das Risiko der 10er-Saison nicht",
    () => {
      delete process.env[FLAG];
      const zwanzigMitGate = SAATEN.map(
        (saat) => runKorridorSeason(saat, slotsFromRealSchedule(saat, 2), { gameMode: "battle" }).injuries,
      );
      // Dieselbe Manager-Liga mit 10 Spieltagen: Gate aus, heutiges Verhalten.
      const zehnHeute = SAATEN.map(
        (saat) => runKorridorSeason(saat, slotsFromRealSchedule(saat, 1), { gameMode: "manager" }).injuries,
      );
      process.env[FLAG] = "0";
      const zwanzigOhne = SAATEN.map(
        (saat) => runKorridorSeason(saat, slotsFromRealSchedule(saat, 2), { gameMode: "battle" }).injuries,
      );

      expect(mittel(zwanzigMitGate)).toBeGreaterThanOrEqual(KORRIDOR_MIN);
      expect(mittel(zwanzigMitGate)).toBeLessThanOrEqual(KORRIDOR_MAX);
      expect(mittel(zwanzigOhne)).toBeGreaterThan(mittel(zwanzigMitGate) * 2);
      expect(mittel(zwanzigMitGate)).toBeLessThan(mittel(zehnHeute) * 2);
    },
    180_000,
  );
});
