/**
 * DIE VERKAUFSSPERRE MUSS DEN GRUND NENNEN, DEN DER DIENST GENANNT HAT.
 *
 * AUFGEDECKT BEIM AUDIT der bereits als „behoben" abgehakten Meldungen (Chris, 23.08.: „hast du die
 * anderen bugs auch alle auditiert und geprüft ob sie WIRKLICH gefixt sind?").
 *
 * Meldung `33c172` lautete: „anscheinend wurden verkäufe gestoppt wegen spieler minimum -> diesen
 * grund darf es nicht geben der muss sauber entfernt werden weil beim verkauf gibt es ja kein
 * spieler minimum - das hatten wir jetzt schon so oft!"
 *
 * Die Quittung meldete den Fall als erledigt, und für die KI-Seite stimmt das: `low_roster_depth`
 * und die beiden Kandidaten-Warnungen sind aus `ai-transfermarkt-sell-preview-service.ts` entfernt,
 * der Status aus dem Typ gestrichen. NACHGEPRÜFT — das hält.
 *
 * IM VERKAUFSDIALOG DES MENSCHEN STAND DER GRUND ABER WEITER. Nicht als Sperre, sondern als
 * BEGRÜNDUNG einer fremden Sperre: `FoundationMarketSellShellHost.tsx` fragte zuerst, ob eine
 * Kadergrößen-WARNUNG vorliegt, und schrieb dann „Kader ist am Minimum — verkaufen würde die
 * Aufstellung unmöglich machen." Der echte Grund aus `blockingReasons` kam erst danach und wurde
 * damit verdeckt.
 *
 * NACHGEMESSEN, dass die Verwechslung wirklich möglich ist: keiner der beiden Verkaufsdienste
 * kennt eine Kadergrößen-Sperre. `transfermarkt-sell-service.ts:373` und
 * `transfermarkt-local-service.ts:3166` setzen `canSell = blockingReasons.length === 0`, und in
 * beiden Listen steht kein Kadergrund — wohl aber `sale_price_missing`,
 * `active_player_salary_missing` und `active_player_not_active`. Fällt einer davon, WÄHREND der
 * Kader klein ist, las Chris „gestoppt wegen Spielerminimum". Genau seine Meldung.
 *
 * Die Kadergrößen-Warnung selbst bleibt — sie ist ein Hinweis und war nie das Problem.
 */
import { describe, expect, it } from "vitest";

import { resolveSellDisabledReason } from "@/app/foundation/transfermarkt-v2/transfer-sell-view-labels";

function gesperrt(blocking: string[], warnungen: string[] = []) {
  return resolveSellDisabledReason({
    preview: { canSell: false, blockingReasons: blocking, warnings: warnungen },
    hasIssue: false,
    busy: false,
    strongAckPending: false,
  });
}

describe("Grund der Verkaufssperre", () => {
  it("nennt den echten Grund, auch wenn der Kader unter dem Team-Minimum liegt", () => {
    const grund = gesperrt(["sale_price_missing"], ["team_would_fall_under_player_min"]);
    expect(grund).toContain("Verkaufspreis");
    expect(grund).not.toContain("Kader ist am Minimum");
  });

  it("nennt den echten Grund auch bei der 7er-Grenze — auch die sperrt keinen Verkauf", () => {
    const grund = gesperrt(["active_player_not_active"], ["team_would_fall_under_7"]);
    expect(grund).not.toContain("Kader ist am Minimum");
    expect(grund).toBe("Der Spieler ist nicht (mehr) aktiv im Kader.");
  });

  it("erfindet keinen Kadergrund, wenn der Dienst gar keinen Grund geliefert hat", () => {
    const grund = gesperrt([], ["team_would_fall_under_player_min"]);
    expect(grund).toBe("Dieser Verkauf ist gerade noch blockiert.");
  });

  it("laesst den Grund unveraendert, wenn keine Kaderwarnung vorliegt", () => {
    expect(gesperrt(["sale_price_missing"])).toContain("Verkaufspreis");
  });

  it("meldet keine Sperre, wenn verkauft werden darf", () => {
    expect(
      resolveSellDisabledReason({
        preview: { canSell: true, blockingReasons: [], warnings: ["team_would_fall_under_player_min"] },
        hasIssue: false,
        busy: false,
        strongAckPending: false,
      }),
    ).toBeNull();
  });

  it("haelt die uebrigen Zustaende unveraendert", () => {
    expect(
      resolveSellDisabledReason({ readMetaSource: "prisma", preview: null, hasIssue: false, busy: false, strongAckPending: false }),
    ).toBe("Im Referenzmodus bleibt der Verkauf gesperrt.");
    expect(
      resolveSellDisabledReason({ preview: null, issueKind: "window_closed", hasIssue: true, busy: false, strongAckPending: false }),
    ).toContain("Verkaufsfenster ist geschlossen");
    expect(
      resolveSellDisabledReason({ preview: null, hasIssue: true, busy: false, strongAckPending: false }),
    ).toContain("nicht verfügbar");
    expect(
      resolveSellDisabledReason({ preview: null, hasIssue: false, busy: true, strongAckPending: false }),
    ).toBe("Verkaufsvorschau wird noch geladen.");
    expect(
      resolveSellDisabledReason({
        preview: { canSell: true, blockingReasons: [], warnings: [] },
        hasIssue: false,
        busy: false,
        strongAckPending: true,
      }),
    ).toContain("Board-/GM-Warnung");
  });
});
