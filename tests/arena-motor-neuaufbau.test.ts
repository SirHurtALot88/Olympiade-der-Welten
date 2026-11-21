import { describe, expect, it } from "vitest";

import {
  entscheideMotorNeuaufbau,
  spielteilSignatur,
  type ArenaNutzlastSpielteil,
} from "@/lib/foundation/battle-arena/arena-motor-neuaufbau";

// Arena-Fluss 21.11. (docs/design/arena-fluss-21-11.md): der D1-Endstand muss stehen bleiben, auch wenn
// nach der Buchung ein neuer Spielstand eine andere Motor-Nutzlast ergibt.
const basis = {
  signatur: "B",
  gemounteteSignatur: "A",
  motorSteht: true,
  spieltagsId: "md-12",
  gemounteteSpieltagsId: "md-12",
  aktuelleDisziplin: "mini-dm",
  spielteil: "S",
  gemounteterSpielteil: "S",
  endeDisziplin: null,
  angeschauteDisziplin: null,
} as const;

describe("entscheideMotorNeuaufbau", () => {
  it("erster Aufbau und Nicht-Spieltag bauen immer auf", () => {
    expect(entscheideMotorNeuaufbau({ ...basis, gemounteteSignatur: null })).toBe("neu");
    expect(entscheideMotorNeuaufbau({ ...basis, motorSteht: false, endeDisziplin: "mini-dm" })).toBe("neu");
    expect(entscheideMotorNeuaufbau({ ...basis, signatur: null, endeDisziplin: "mini-dm" })).toBe("neu");
  });

  it("gleiche Nutzlast: Motor bleibt", () => {
    expect(entscheideMotorNeuaufbau({ ...basis, signatur: "A" })).toBe("behalten");
  });

  it("Endstand der gezeigten Disziplin bleibt stehen, wenn sich nur Kader-Werte aendern", () => {
    expect(entscheideMotorNeuaufbau({ ...basis, endeDisziplin: "mini-dm", angeschauteDisziplin: "mini-dm" })).toBe("aufschieben");
  });

  it("ein laufendes (angeschautes) Spiel wird nicht mitten drin neu aufgebaut", () => {
    expect(entscheideMotorNeuaufbau({ ...basis, angeschauteDisziplin: "mini-dm" })).toBe("aufschieben");
  });

  it("noch nicht angeschaut (Vorstellung steht): neue Nutzlast wird eingehaengt", () => {
    expect(entscheideMotorNeuaufbau(basis)).toBe("neu");
  });

  it("Klick auf Weiter zu D2 holt den aufgeschobenen Neuaufbau nach", () => {
    expect(
      entscheideMotorNeuaufbau({ ...basis, aktuelleDisziplin: "basketball", endeDisziplin: "mini-dm", angeschauteDisziplin: "mini-dm" }),
    ).toBe("neu");
  });

  it("(a) Spieltagswechsel bei gleicher Disziplin (D2 auf n, D1 auf n+1): immer neu, auch angeschaut/beendet", () => {
    const wechsel = { ...basis, spieltagsId: "md-13", endeDisziplin: "mini-dm", angeschauteDisziplin: "mini-dm" } as const;
    expect(entscheideMotorNeuaufbau(wechsel)).toBe("neu");
    // Selbst eine (zufaellig) gleiche Nutzlast haelt das alte Match nicht auf der Buehne.
    expect(entscheideMotorNeuaufbau({ ...wechsel, signatur: "A" })).toBe("neu");
  });

  it("(b) echte Spielaenderung waehrend des angeschauten Spiels (neue Saat/Pod/Paarung): neu", () => {
    expect(entscheideMotorNeuaufbau({ ...basis, angeschauteDisziplin: "mini-dm", gemounteterSpielteil: "S-alt" })).toBe("neu");
    expect(entscheideMotorNeuaufbau({ ...basis, endeDisziplin: "mini-dm", spielteil: null })).toBe("neu");
  });
});

describe("spielteilSignatur", () => {
  const kader = (wert: number) => [{ id: "p1", a: { kraft: wert }, d: { basketball: wert } }];
  const nutzlast = (over: Record<string, unknown> = {}, kraft = 50): ArenaNutzlastSpielteil => ({
    heimTeamId: "D-P",
    gastTeamId: "A-A",
    umschlag: {
      heim: kader(kraft),
      gast: kader(kraft),
      aufstellung: { Ada: { d: "basketball", slot: "pg", form: 3 }, Bo: { d: "mini-dm", slot: "x" } },
      seedByDisciplineId: { basketball: 11, "mini-dm": 22 },
      mutatorenByDisciplineId: { basketball: ["Timid"], "mini-dm": [] },
      miniDmFfaTeams: [{ name: "D-P", kader: kader(kraft) }],
      miniDmFfaK: 4,
      miniDmFfaSaat: 99,
      miniDmFfaAufstellung: [{ Bo: { d: "mini-dm", slot: "x", wechselPaarBonus: 1 } }],
      bahnPodByDisciplineId: { staffel: { teams: [{ name: "D-P", kader: kader(kraft) }], k: 4, saat: 5 } },
      ...over,
    } as unknown as ArenaNutzlastSpielteil["umschlag"],
  });

  it("Kader-Werte (Attribute, Disziplinwerte) und Zusatzfelder der Aufstellung zaehlen nicht", () => {
    for (const d of ["basketball", "mini-dm", "staffel"]) {
      expect(spielteilSignatur(nutzlast({}, 60), d)).toBe(spielteilSignatur(nutzlast({}, 50), d));
    }
    const mitForm = nutzlast({ aufstellung: { Ada: { d: "basketball", slot: "pg", form: 5 }, Bo: { d: "mini-dm", slot: "x" } } });
    expect(spielteilSignatur(mitForm, "basketball")).toBe(spielteilSignatur(nutzlast(), "basketball"));
  });

  it("Saat, Mutatoren, Pod und Plaetze der aktuellen Disziplin zaehlen, die der anderen nicht", () => {
    const b = spielteilSignatur(nutzlast(), "basketball");
    expect(spielteilSignatur(nutzlast({ seedByDisciplineId: { basketball: 12, "mini-dm": 22 } }), "basketball")).not.toBe(b);
    expect(spielteilSignatur(nutzlast({ mutatorenByDisciplineId: { basketball: ["Obsessive"], "mini-dm": [] } }), "basketball")).not.toBe(b);
    expect(
      spielteilSignatur(nutzlast({ aufstellung: { Ada: { d: "basketball", slot: "c" }, Bo: { d: "mini-dm", slot: "x" } } }), "basketball"),
    ).not.toBe(b);
    // Andere Disziplin geaendert: Basketball bleibt dasselbe Spiel.
    expect(spielteilSignatur(nutzlast({ seedByDisciplineId: { basketball: 11, "mini-dm": 23 } }), "basketball")).toBe(b);
    // Mini-DM-Pod: neue Saat oder neues k ist ein anderes Spiel.
    const m = spielteilSignatur(nutzlast(), "mini-dm");
    expect(spielteilSignatur(nutzlast({ miniDmFfaSaat: 100 }), "mini-dm")).not.toBe(m);
    expect(spielteilSignatur(nutzlast({ miniDmFfaK: 5 }), "mini-dm")).not.toBe(m);
    // Bahn-Pod
    const s = spielteilSignatur(nutzlast(), "staffel");
    expect(spielteilSignatur(nutzlast({ bahnPodByDisciplineId: { staffel: { teams: [], k: 4, saat: 6 } } }), "staffel")).not.toBe(s);
    // Paarung
    expect(spielteilSignatur({ ...nutzlast(), gastTeamId: "B-B" }, "basketball")).not.toBe(b);
    expect(spielteilSignatur(nutzlast(), null)).toBeNull();
  });
});
