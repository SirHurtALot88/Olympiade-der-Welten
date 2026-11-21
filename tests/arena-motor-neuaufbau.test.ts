import { describe, expect, it } from "vitest";

import { entscheideMotorNeuaufbau } from "@/lib/foundation/battle-arena/arena-motor-neuaufbau";

// Arena-Fluss 21.11. (docs/design/arena-fluss-21-11.md): der D1-Endstand muss stehen bleiben, auch wenn
// nach der Buchung ein neuer Spielstand eine andere Motor-Nutzlast ergibt.
const basis = {
  signatur: "B",
  gemounteteSignatur: "A",
  motorSteht: true,
  aktuelleDisziplin: "mini-dm",
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

  it("Endstand der gezeigten Disziplin bleibt stehen, auch wenn sich die Nutzlast nach der Buchung aendert", () => {
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
});
