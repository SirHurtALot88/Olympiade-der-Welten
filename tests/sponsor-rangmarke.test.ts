/**
 * SCHRITT 6, ERSTER TEIL: DIE RANGMARKE — die Bedingung, die aus einem Tausch eine Entscheidung
 * macht.
 *
 * Ohne sie ist die Gebäude-Leihe reine Arithmetik: fester Verzicht gegen festes Gebäude, kein
 * Risiko, nichts zu ueberlegen. Mit ihr ist das Gebäude BEDINGT und der Preis trotzdem fest — genau
 * die Asymmetrie, die Chris beschrieben hat („die Rangmarke macht ihn bedingt, waehrend der
 * Verzicht fest bleibt").
 *
 * Die drei Zusagen aus Abschnitt 4.4, und diese Suite prueft jede einzeln:
 *   1. Die Marke liegt nie ueber dem eigenen Startblock (sonst waere sie die alte Zielfalle).
 *   2. Geld ist nie betroffen — weder die Leiter noch der Verzicht.
 *   3. Sofort aus, sofort wieder an, nichts rueckwirkend.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { SPONSOR_RANK_LADDER_RUNGS } from "@/lib/sponsor/sponsor-offer-presenter";
import {
  anteiligeSaisonwirkung,
  baueRangmarke,
  beschreibeRangmarke,
  blockFuerRang,
  marktGehalten,
  RANGMARKEN_BLOECKE,
  schalteAlleLeihgabenNachTabelle,
  schalteLeihgaben,
} from "@/lib/sponsor/sponsor-rangmarke";

describe("Die Bloecke", () => {
  it("sind dieselben, die die Sponsor-Rangleiter ohnehin zeigt", () => {
    // Eine zweite Skala neben der bestehenden waere genau der Doppelbegriff, an dem dieses System
    // schon einmal unuebersichtlich geworden ist.
    expect([...RANGMARKEN_BLOECKE].sort((a, b) => b - a)).toEqual(
      SPONSOR_RANK_LADDER_RUNGS.map((rung) => rung.maxRank),
    );
  });

  it("ordnet jeden Rang der kleinsten Sprosse zu, die ihn noch enthaelt", () => {
    expect(blockFuerRang(1)).toBe(1);
    expect(blockFuerRang(3)).toBe(4);
    expect(blockFuerRang(5)).toBe(8);
    expect(blockFuerRang(14)).toBe(16);
    expect(blockFuerRang(30)).toBe(28);
    // Auch ausserhalb der Tabelle bleibt es eine Zahl statt eines Absturzes.
    expect(blockFuerRang(99)).toBe(28);
    expect(blockFuerRang(0)).toBe(1);
  });
});

describe("Die Marke selbst", () => {
  it("liegt NIE ueber dem eigenen Startblock — das waere die alte Zielfalle", () => {
    for (let rang = 1; rang <= 32; rang += 1) {
      for (const haerte of ["mild", "hart"] as const) {
        const marke = baueRangmarke({ startRang: rang, haerte });
        // „Ueber dem Startblock" hiesse: eine KLEINERE Zahl als der eigene Block.
        expect(marke, `Rang ${rang}/${haerte}`).toBeGreaterThanOrEqual(blockFuerRang(rang));
      }
    }
  });

  it("setzt hart den eigenen Block, mild einen darunter", () => {
    expect(baueRangmarke({ startRang: 14, haerte: "hart" })).toBe(16);
    expect(baueRangmarke({ startRang: 14, haerte: "mild" })).toBe(20);
    expect(baueRangmarke({ startRang: 1, haerte: "hart" })).toBe(1);
    expect(baueRangmarke({ startRang: 1, haerte: "mild" })).toBe(4);
  });

  it("laesst dem untersten Block eine Marke, die er halten kann", () => {
    // Unter „Top 28" gibt es keine Sprosse mehr. Ohne diesen Zweig haette ausgerechnet das
    // schwaechste Team eine Leihe, die es nie nutzen kann.
    expect(baueRangmarke({ startRang: 30, haerte: "mild" })).toBe(32);
    expect(marktGehalten({ aktuellerRang: 32, marke: 32 })).toBe(true);
  });

  it("gilt als gehalten, solange es gar keinen Rang gibt", () => {
    // Vor dem ersten Spieltag hat niemand einen Platz. Ein Gebäude, das dann schon ruht, waere eine
    // Strafe fuer nichts.
    expect(marktGehalten({ aktuellerRang: null, marke: 8 })).toBe(true);
    expect(marktGehalten({ aktuellerRang: undefined, marke: 8 })).toBe(true);
  });
});

describe("Das Schalten", () => {
  const leihgabe = { facilityId: "training_center", stufe: 3, zustandPct: 90, seasonId: "s1" };

  it("legt die Leihe schlafen, sobald das Team unter die Marke faellt", () => {
    const [aus] = schalteLeihgaben({ leihgaben: [leihgabe], aktuellerRang: 12, marke: 8 });
    expect(aus!.ruht).toBe(true);
    // Stufe und Zustand bleiben unberuehrt — sie ruht, sie verfaellt nicht.
    expect(aus!.stufe).toBe(3);
    expect(aus!.zustandPct).toBe(90);
  });

  it("weckt sie sofort wieder auf, ohne dass etwas nachwirkt", () => {
    const [an] = schalteLeihgaben({ leihgaben: [{ ...leihgabe, ruht: true }], aktuellerRang: 6, marke: 8 });
    expect(an!.ruht).toBeUndefined();
  });

  it("gibt dieselbe Liste zurueck, wenn sich nichts aendert", () => {
    // Am Referenzvergleich haengt, ob der Aufrufer den Spielstand ueberhaupt anfasst.
    const liste = [leihgabe];
    expect(schalteLeihgaben({ leihgaben: liste, aktuellerRang: 4, marke: 8 })).toBe(liste);
  });
});

describe("Der Spielstand nach dem Spieltag", () => {
  function baueSpielstand(rang: number, marke: number): GameState {
    return {
      season: { id: "s1" },
      seasonState: {
        standings: { "M-M": { points: 40, rank: rang } },
        sponsorContractsByTeamId: {
          "M-M": { teamId: "M-M", sponsorLeihe: { facilityId: "training_center", rangmarke: marke } },
        },
        sponsorLeihgabenByTeamId: {
          "M-M": [{ facilityId: "training_center", stufe: 3, zustandPct: 100, seasonId: "s1" }],
        },
      },
    } as unknown as GameState;
  }

  it("nimmt dem Team die Gebaeudewirkung, wenn es unter die Marke rutscht", () => {
    const gehalten = schalteAlleLeihgabenNachTabelle(baueSpielstand(6, 8));
    const gerissen = schalteAlleLeihgabenNachTabelle(baueSpielstand(15, 8));

    expect(getTeamFacilityState(gehalten, "M-M").facilities.training_center?.level).toBe(3);
    // Und bei gerissener Marke steht da wieder der eigene Bestand — hier also nichts.
    expect(getTeamFacilityState(gerissen, "M-M").facilities.training_center?.level ?? 0).toBe(0);
  });

  it("laesst das GELD unberuehrt — nur das Gebaeude ruht", () => {
    const gerissen = schalteAlleLeihgabenNachTabelle(baueSpielstand(20, 8));
    const vertrag = gerissen.seasonState.sponsorContractsByTeamId?.["M-M"];
    // Weder Leiter noch Verzicht werden angefasst; der Sponsor stellt bereit, das Nutzungsrisiko
    // traegt der Spieler. Das ist die Zusage, an der die Planbarkeit der Auszahlung haengt.
    expect(vertrag?.sponsorV3).toBeUndefined();
    expect(vertrag?.payouts).toBeUndefined();
  });

  it("ist fuer einen Spielstand ohne Leihgaben ein echtes No-op", () => {
    const ohne = { season: { id: "s1" }, seasonState: { standings: {} } } as unknown as GameState;
    expect(schalteAlleLeihgabenNachTabelle(ohne)).toBe(ohne);
  });

  it("fasst einen Vertrag ohne Marke nicht an", () => {
    // Angebote aus der Zeit vor diesem Schritt tragen keine Marke — sie wirken unbedingt weiter,
    // statt reihenweise einzuschlafen.
    const ohneMarke = baueSpielstand(31, 8);
    delete (ohneMarke.seasonState.sponsorContractsByTeamId!["M-M"] as { sponsorLeihe?: unknown }).sponsorLeihe;
    const danach = schalteAlleLeihgabenNachTabelle(ohneMarke);
    expect(danach.seasonState.sponsorLeihgabenByTeamId?.["M-M"]?.[0]?.ruht).toBeUndefined();
  });
});

describe("Anteilige Saisonwirkung", () => {
  it("rechnet aktive Spieltage gegen die ganze Saison", () => {
    // Spieltagsnahe Wirkungen schalten sich selbst ab. Saisonweite (Training, Academy) werden
    // EINMAL am Ende gerechnet und wuessten sonst nichts vom Stillstand.
    expect(anteiligeSaisonwirkung({ aktiveSpieltage: 8, gesamtSpieltage: 10 })).toBe(0.8);
    expect(anteiligeSaisonwirkung({ aktiveSpieltage: 0, gesamtSpieltage: 10 })).toBe(0);
    expect(anteiligeSaisonwirkung({ aktiveSpieltage: 10, gesamtSpieltage: 10 })).toBe(1);
  });

  it("gibt volle Wirkung, solange gar nichts gelaufen ist", () => {
    expect(anteiligeSaisonwirkung({ aktiveSpieltage: 0, gesamtSpieltage: 0 })).toBe(1);
  });
});

describe("Die Statuszeile", () => {
  it("sagt, wie weit es noch ist", () => {
    expect(beschreibeRangmarke({ aktuellerRang: 6, marke: 8 })).toContain("aktiv");
    expect(beschreibeRangmarke({ aktuellerRang: 9, marke: 8 })).toContain("1 Platz unter");
    expect(beschreibeRangmarke({ aktuellerRang: 12, marke: 8 })).toContain("4 Plätze unter");
  });
});
