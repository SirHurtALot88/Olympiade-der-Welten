import { describe, expect, it } from "vitest";

import { filterSchluessel, liesGemerkt, schreibeGemerkt } from "@/app/foundation/shared/filter-gedaechtnis";
import { istFitSichtbar, zaehleFitAusgeblendet } from "@/lib/market/transfermarkt-fit";
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
