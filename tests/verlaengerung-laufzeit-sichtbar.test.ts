/**
 * GEMELDET VON CHRIS: „xelara steht aktuell dann immernoch auf vertrag läuft aus" — und dann,
 * entscheidend: „ich will sie ja eine season verlängern bis ende season 2 das muss sauber sein."
 *
 * SEIN VERTRAG WAR RICHTIG. Am Spielstand gemessen läuft Xelara bis Ende Saison 2, also genau wie
 * gewollt. Falsch war das Etikett: die Alterung senkt die Laufzeit am ENDE von Saison 1, während
 * Saison 1 noch die laufende ist — danach heißt eine 1 nicht mehr „letzte Saison", sondern „noch
 * eine volle". Die Statusregel weiß das nicht. Das behebt der Umbau auf die Endsaison.
 *
 * Zwei echte Bedienfehler sind bei der Suche trotzdem aufgefallen, und die stehen hier:
 *
 * 1. Die Wunschlaufzeit trug einen Stern und war trotzdem gesperrt. Xelaras Wunsch ist 3, ihr
 *    Moral-Limit 2 — die 3 war anklickbar, ließ sich aber nicht bestätigen („wähle eine kürzere
 *    Laufzeit"). Eine Empfehlung, der man nicht folgen kann, ist keine.
 * 2. Der Bestätigen-Knopf sagte nicht, welche Laufzeit er unterschreibt. Eine Ein-Saison-
 *    Verlängerung ließ sich abschließen, ohne sie je gelesen zu haben.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const MODAL = readFileSync(
  join(process.cwd(), "app/foundation/teams-v2/ContractRenewalNegotiationModal.tsx"),
  "utf8",
);

describe("Was nicht unterschreibbar ist, ist nicht anklickbar", () => {
  it("sperrt Laufzeiten über dem Moral-Limit", () => {
    expect(MODAL).toContain("disabled={overLimit}");
  });

  it("sagt im Tooltip, dass die Laufzeit nicht unterschreibbar ist", () => {
    expect(MODAL).toContain("ist nicht unterschreibbar.");
  });

  it("setzt den Stern nur auf eine Laufzeit, die wirklich geht", () => {
    // Der Stern auf einer gesperrten Laufzeit schickt den Nutzer in eine Sackgasse.
    expect(MODAL).toContain("const istWunsch = negotiation?.contractPreference?.idealLength === length && !overLimit;");
    expect(MODAL).not.toContain("{negotiation?.contractPreference?.idealLength === length ? <small>★</small> : null}");
  });
});

describe("Der Knopf sagt, was er unterschreibt", () => {
  it("trägt die gewählte Laufzeit", () => {
    expect(MODAL).toContain('`Schritt 2: ${formatNlNumber(draftLength, 0)} ${draftLength === 1 ? "Saison" : "Saisons"} unterschreiben`');
  });

  it("sagt beim Verlängern nicht mehr nur „Vertrag unterschreiben“", () => {
    expect(MODAL).not.toContain('"Schritt 2: Vertrag unterschreiben"');
  });
});
