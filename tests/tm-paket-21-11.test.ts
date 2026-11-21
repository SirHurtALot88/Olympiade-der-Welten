import { describe, expect, it } from "vitest";

import { filterSchluessel, liesGemerkt, schreibeGemerkt } from "@/app/foundation/shared/filter-gedaechtnis";
import { erfuelltFitSchwelle, FIT_AUS, fitSortWert, istFitSichtbar, naechsteFitSchwelle, zaehleFitAusgeblendet } from "@/lib/market/transfermarkt-fit";
import { baueDisziplinBedarf, sortiereDisziplinen } from "@/lib/market/transfermarkt-disziplin-bedarf";
import { LEERE_FILTER, type WeitereFilter } from "@/lib/market/transfermarkt-weitere-filter";

function speicher() {
  const daten = new Map<string, string>();
  return {
    getItem: (k: string) => daten.get(k) ?? null,
    setItem: (k: string, v: string) => void daten.set(k, v),
    removeItem: (k: string) => void daten.delete(k),
    daten,
  };
}

describe("Team-Fit-Regel (Markt und Draft-Brett, wie der alte Markt)", () => {
  it("negativer Fit ist standardmäßig ausgeblendet, Fit 0 und positive bleiben", () => {
    expect(istFitSichtbar({ fit: 4, mercenary: false })).toBe(true);
    expect(istFitSichtbar({ fit: 0, mercenary: false })).toBe(true);
    expect(istFitSichtbar({ fit: -1.5, mercenary: false })).toBe(false);
  });

  it("Mercenaries sind von der Regel ausgenommen, auch mit negativem Fit", () => {
    expect(istFitSichtbar({ fit: -8, mercenary: true })).toBe(true);
  });

  it("ohne Team (kein Fit gerechnet) bleibt alles sichtbar", () => {
    expect(istFitSichtbar({ fit: null, mercenary: false })).toBe(true);
    expect(istFitSichtbar({ fit: undefined, mercenary: undefined })).toBe(true);
  });

  it("der Schalter blendet negative ein", () => {
    expect(istFitSichtbar({ fit: -8, mercenary: false }, true)).toBe(true);
  });

  it("zählt nur, was die Regel wirklich ausblendet", () => {
    const pool = [
      { fit: 3, mercenary: false },
      { fit: -2, mercenary: false },
      { fit: -4, mercenary: true },
      { fit: -1, mercenary: false },
      { fit: null, mercenary: false },
    ];
    expect(zaehleFitAusgeblendet(pool)).toBe(2);
    expect(pool.filter((s) => istFitSichtbar(s)).length).toBe(3);
  });
});

describe("Fit-Schwellenfilter „Fit > X“ (Markt und Draft-Brett)", () => {
  const pool = [
    { id: "a", fit: 12, mercenary: false },
    { id: "b", fit: 5, mercenary: false },
    { id: "c", fit: 0, mercenary: false },
    { id: "d", fit: -3, mercenary: false },
    { id: "e", fit: -9, mercenary: true },
    { id: "f", fit: null, mercenary: false },
  ];
  const ids = (schwelle: number) => pool.filter((s) => erfuelltFitSchwelle(s, schwelle)).map((s) => s.id);

  it("aus lässt alles durch", () => {
    expect(ids(FIT_AUS)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("> X heißt strikt größer; Mercenaries und fit-lose Zeilen bleiben Ausnahme", () => {
    expect(ids(0)).toEqual(["a", "b", "e", "f"]);
    expect(ids(5)).toEqual(["a", "e", "f"]);
    expect(ids(10)).toEqual(["a", "e", "f"]);
    expect(ids(15)).toEqual(["e", "f"]);
  });

  it("kombinierbar mit dem Schalter für negativen Fit", () => {
    const sichtbar = pool.filter((s) => istFitSichtbar(s, false) && erfuelltFitSchwelle(s, 0)).map((s) => s.id);
    expect(sichtbar).toEqual(["a", "b", "e", "f"]);
    const mitNegativ = pool.filter((s) => istFitSichtbar(s, true) && erfuelltFitSchwelle(s, 5)).map((s) => s.id);
    expect(mitNegativ).toEqual(["a", "e", "f"]);
  });

  it("der Stufen-Knopf geht reihum: aus, 0, 5, 10, 15, 20, aus", () => {
    const reihe: number[] = [];
    let w: number = FIT_AUS;
    for (let i = 0; i < 6; i += 1) {
      w = naechsteFitSchwelle(w);
      reihe.push(w);
    }
    expect(reihe).toEqual([0, 5, 10, 15, 20, FIT_AUS]);
  });

  it("Sortierschlüssel der Fit-Spalte: Zahl, sonst ans Ende", () => {
    expect(fitSortWert({ fit: -2.5 })).toBe(-2.5);
    expect(fitSortWert({ fit: null })).toBeNull();
  });

  it("die Schwelle überlebt im Filter-Gedächtnis; „aus“ räumt den Eintrag auf", () => {
    const s = speicher();
    schreibeGemerkt("k:fitMin", 10, FIT_AUS, s);
    expect(liesGemerkt("k:fitMin", FIT_AUS, s)).toBe(10);
    schreibeGemerkt("k:fitMin", 0, FIT_AUS, s);
    expect(liesGemerkt("k:fitMin", FIT_AUS, s)).toBe(0);
    schreibeGemerkt("k:fitMin", FIT_AUS, FIT_AUS, s);
    expect(s.daten.has("k:fitMin")).toBe(false);
  });
});

describe("Filter bleiben beim Reiterwechsel stehen", () => {
  it("Schlüssel trennt Liste, Spielstand und Feld", () => {
    const a = filterSchluessel("markt", "save-1", "suche");
    expect(a).not.toBe(filterSchluessel("draft-brett", "save-1", "suche"));
    expect(a).not.toBe(filterSchluessel("markt", "save-2", "suche"));
    expect(a).not.toBe(filterSchluessel("markt", "save-1", "sort"));
    expect(filterSchluessel("markt", null, "suche")).toContain("ohne-save");
  });

  it("schreibt und liest Werte aller Arten zurück", () => {
    const s = speicher();
    schreibeGemerkt("k:suche", "Karl", "", s);
    schreibeGemerkt("k:fit", true, false, s);
    expect(liesGemerkt("k:suche", "", s)).toBe("Karl");
    expect(liesGemerkt("k:fit", false, s)).toBe(true);
    expect(liesGemerkt("k:fehlt", "start", s)).toBe("start");
  });

  it("Weitere Filter überleben, neue Felder kommen aus dem Startwert", () => {
    const s = speicher();
    const gesetzt: WeitereFilter = { ...LEERE_FILTER, achsenMin: { pow: 4 }, mwMax: 12, farben: ["gold"] as never };
    schreibeGemerkt("k:weitere", gesetzt, LEERE_FILTER, s);
    const alt = JSON.parse(s.daten.get("k:weitere")!) as Record<string, unknown>;
    delete alt.valueMin;
    s.daten.set("k:weitere", JSON.stringify(alt));
    const gelesen = liesGemerkt("k:weitere", LEERE_FILTER, s);
    expect(gelesen.achsenMin).toEqual({ pow: 4 });
    expect(gelesen.mwMax).toBe(12);
    expect(gelesen.valueMin).toBeNull();
  });

  it("der Startwert löscht den Eintrag (Zurücksetzen räumt auf)", () => {
    const s = speicher();
    schreibeGemerkt("k:sort", "gehalt", "eignung", s);
    expect(s.daten.has("k:sort")).toBe(true);
    schreibeGemerkt("k:sort", "eignung", "eignung", s);
    expect(s.daten.has("k:sort")).toBe(false);
  });

  it("Unsinn und falsche Typen fallen auf den Startwert zurück", () => {
    const s = speicher();
    s.daten.set("k:a", "{kaputt");
    s.daten.set("k:b", JSON.stringify("text"));
    s.daten.set("k:c", JSON.stringify({ x: 1 }));
    expect(liesGemerkt("k:a", false, s)).toBe(false);
    expect(liesGemerkt("k:b", 3, s)).toBe(3);
    expect(liesGemerkt("k:c", [] as number[], s)).toEqual([]);
  });
});

describe("Kaderstärke in Spielplan-Reihenfolge", () => {
  const bedarf = baueDisziplinBedarf([
    [{ disciplineId: "hockey", playerCount: 6 }, { disciplineId: "tennis", playerCount: 2 }],
    [{ disciplineId: "fechten", playerCount: 3 }, { disciplineId: "hockey", playerCount: 6 }],
  ]);
  const ids = ["golf", "fechten", "tennis", "hockey"];

  it("Spielplan: erster Auftritt zuerst, nicht Gesetztes ans Ende", () => {
    expect(sortiereDisziplinen("spielplan", bedarf, ids)).toEqual(["hockey", "tennis", "fechten", "golf"]);
  });

  it("Wichtigkeit = Summe der Slots, Gleichstand nach fester Reihenfolge", () => {
    expect(sortiereDisziplinen("wichtigkeit", bedarf, ids)).toEqual(["hockey", "fechten", "tennis", "golf"]);
  });

  it("Matrix: unverändert", () => {
    expect(sortiereDisziplinen("liste", bedarf, ids)).toEqual(ids);
  });
});
