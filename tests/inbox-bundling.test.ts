/**
 * GEMELDET AUS DEM SPIEL: „drei Schritte, ein Ziel — die Inbox fühlt sich an, als führe alles an
 * denselben Ort."
 *
 * Die Ursache ist die Zählweise: der Service erzeugt eine Karte je BEDINGUNG, nicht je ENTSCHEIDUNG.
 * Aufstellung setzen, Formkarten erzeugen und bestätigen sind drei Bedingungen, aber ein Vorgang.
 * Ein belasteter Spieler kann drei Karten auslösen, die dieselbe Person meinen.
 *
 * Geprüft werden die Regeln, an denen eine Bündelung scheitern kann:
 *
 *  1. Sie darf nichts verlieren — insbesondere keine Quick-Action und keinen kritischen Zustand.
 *  2. Der Fortschritt muss ablesbar bleiben („Schritt 2 von 3"), sonst ist die Karte weniger wert
 *     als die drei, die sie ersetzt.
 *  3. Erledigt ist sie erst, wenn ALLE Schritte erledigt sind.
 *  4. Ein Topf mit einer Karte darf nicht „gebündelt" werden — das wäre nur ein schlechterer Titel.
 *  5. Zwei Teams (oder zwei Spieler) dürfen nie in denselben Topf fallen.
 */
import { describe, expect, it } from "vitest";

import type { GameInboxItem } from "@/lib/data/olyDataTypes";
import {
  MATCHDAY_PREP_BUNDLE_PREFIX,
  PLAYER_HEALTH_BUNDLE_PREFIX,
  SCOUT_BUNDLE_PREFIX,
  bundleInboxItems,
} from "@/lib/foundation/inbox-bundling";
import {
  getInboxItemCadence,
  groupInboxItemsForDisplay,
  isAutoResolvingInboxItemId,
} from "@/lib/foundation/game-inbox-service";

function makeItem(partial: Partial<GameInboxItem> & { itemId: string; source: string }): GameInboxItem {
  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchday: "season-1-matchday-3",
    teamId: "C-C",
    category: "task",
    severity: "warning",
    title: "Titel",
    description: "Text",
    targetView: "lineup",
    targetParams: {},
    status: "open",
    createdAt: "2026-08-02T00:00:00.000Z",
    ...partial,
  };
}

const prepStep = (prefix: string, extra?: Partial<GameInboxItem>) =>
  makeItem({
    itemId: `${prefix}:save-1:season-1:season-1-matchday-3:C-C`,
    source: prefix === "formcards_open" ? "season_formcards" : "lineup_drafts",
    ...extra,
  });

describe("Spieltag vorbereiten — drei Schritte, eine Karte", () => {
  it("aus drei Karten wird eine", () => {
    const result = bundleInboxItems([
      prepStep("lineup_missing"),
      prepStep("formcards_open"),
      prepStep("lineup_not_submitted"),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("Spieltag vorbereiten");
  });

  it("die Karte sagt, an welchem Schritt man steht", () => {
    const [card] = bundleInboxItems([
      prepStep("lineup_missing", { status: "done" }),
      prepStep("formcards_open"),
      prepStep("lineup_not_submitted"),
    ]);
    expect(card!.description).toBe("Schritt 2 von 3 — Formkarten erzeugen.");
    expect(card!.ctaLabel).toBe("Formkarten erzeugen");
  });

  it("das Ziel kommt vom Schritt, an dem man wirklich steht", () => {
    // Sonst landet man auf einer bereits erledigten Teilaufgabe und fragt sich, was man dort soll.
    const [card] = bundleInboxItems([
      prepStep("lineup_missing", { status: "done", targetParams: { team: "C-C" } }),
      prepStep("formcards_open", { targetParams: { team: "C-C", panel: "formcards" } }),
      prepStep("lineup_not_submitted"),
    ]);
    expect(card!.targetParams).toEqual({ team: "C-C", panel: "formcards" });
  });

  it("erledigt ist sie erst, wenn ALLE Schritte erledigt sind", () => {
    const partly = bundleInboxItems([
      prepStep("lineup_missing", { status: "done" }),
      prepStep("formcards_open", { status: "done" }),
      prepStep("lineup_not_submitted"),
    ])[0]!;
    expect(partly.status).toBe("open");

    const all = bundleInboxItems([
      prepStep("lineup_missing", { status: "done" }),
      prepStep("formcards_open", { status: "done" }),
      prepStep("lineup_not_submitted", { status: "done" }),
    ])[0]!;
    expect(all.status).toBe("done");
    expect(all.title).toBe("Spieltag vorbereitet");
  });

  it("ein kritischer Schritt verschwindet nicht in einer harmloseren Karte", () => {
    const [card] = bundleInboxItems([
      prepStep("lineup_missing", { severity: "critical" }),
      prepStep("formcards_open", { severity: "info" }),
    ]);
    expect(card!.severity).toBe("critical");
  });

  it("erledigte Schritte ziehen die Schwere nicht mit hoch", () => {
    const [card] = bundleInboxItems([
      prepStep("lineup_missing", { severity: "critical", status: "done" }),
      prepStep("formcards_open", { severity: "warning" }),
    ]);
    expect(card!.severity).toBe("warning");
  });

  it("die gebündelte Karte löst sich weiterhin selbst auf", () => {
    // Ohne diesen Eintrag stuenden auf ihr "Erledigt"/"Ausblenden" — Knöpfe, die einen
    // unerfüllten Zustand verstecken könnten (der Fehler aus #43).
    const [card] = bundleInboxItems([prepStep("lineup_missing"), prepStep("formcards_open")]);
    expect(card!.itemId.startsWith(MATCHDAY_PREP_BUNDLE_PREFIX)).toBe(true);
    expect(isAutoResolvingInboxItemId(card!.itemId)).toBe(true);
    expect(getInboxItemCadence(card!.itemId)).toBe("recurring");
  });

  it("zwei Teams landen nie in derselben Karte", () => {
    const result = bundleInboxItems([
      prepStep("lineup_missing"),
      prepStep("formcards_open"),
      prepStep("lineup_missing", { itemId: "lineup_missing:save-1:season-1:season-1-matchday-3:T-G", teamId: "T-G" }),
      prepStep("formcards_open", { itemId: "formcards_open:save-1:season-1:T-G", teamId: "T-G" }),
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((item) => item.teamId).sort()).toEqual(["C-C", "T-G"]);
  });

  it("ein einzelner offener Schritt bleibt seine eigene Karte", () => {
    const result = bundleInboxItems([prepStep("lineup_missing", { title: "Lineup fehlt" })]);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("Lineup fehlt");
  });
});

const healthItem = (source: string, extra?: Partial<GameInboxItem>) =>
  makeItem({
    itemId: `${source.replace("player_health_", "player_")}:save-1:season-1:C-C:p-1`,
    source,
    playerId: "p-1",
    category: "training",
    targetView: "trainingCompact",
    ...extra,
  });

describe("Belastung — eine Karte je Spieler, nicht drei", () => {
  it("drei Hinweise zu einem Spieler werden eine Karte", () => {
    const result = bundleInboxItems([
      healthItem("player_health_fatigue_risk", { title: "Hohes Verletzungsrisiko", severity: "critical" }),
      healthItem("player_health_lineup_rest", { title: "Spielpause empfohlen" }),
      healthItem("player_health_training_load", { title: "Hard-Training vs. Erholung", severity: "info" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("Hohes Verletzungsrisiko");
    expect(result[0]!.description).toContain("Spielpause empfohlen");
    expect(result[0]!.description).toContain("Hard-Training vs. Erholung");
  });

  it("die Quick-Action bleibt erhalten — deshalb wird je SPIELER gebündelt, nicht je Team", () => {
    /**
     * Der Grund für den Zuschnitt: `applyInboxQuickAction("apply-training-light")` braucht
     * `item.playerId`. Eine Karte je Team hätte den Spielerbezug verloren und damit den Knopf —
     * eine Bündelung, die etwas wegnimmt, ist keine Aufräumaktion.
     */
    const [card] = bundleInboxItems([
      healthItem("player_health_fatigue_risk", { severity: "critical" }),
      healthItem("player_health_training_load"),
    ]);
    expect(card!.playerId).toBe("p-1");
    expect(card!.source).toBe("player_health_fatigue_risk");
    expect(card!.itemId.startsWith(PLAYER_HEALTH_BUNDLE_PREFIX)).toBe(true);
  });

  it("zwei Spieler bleiben zwei Karten", () => {
    const result = bundleInboxItems([
      healthItem("player_health_fatigue_risk"),
      healthItem("player_health_training_load"),
      healthItem("player_health_fatigue_risk", {
        itemId: "player_fatigue_risk:save-1:season-1:C-C:p-2",
        playerId: "p-2",
      }),
      healthItem("player_health_training_load", {
        itemId: "player_training_load:save-1:season-1:C-C:p-2",
        playerId: "p-2",
      }),
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((item) => item.playerId).sort()).toEqual(["p-1", "p-2"]);
  });

  it("ein einzelner Hinweis bleibt unangetastet", () => {
    const result = bundleInboxItems([healthItem("player_health_fatigue_risk", { title: "Ermüdung beobachten" })]);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("Ermüdung beobachten");
    expect(result[0]!.itemId.startsWith("player_fatigue_risk")).toBe(true);
  });
});

const scoutItem = (playerId: string, name: string, certainty: number) =>
  makeItem({
    itemId: `scout_milestone:save-1:season-1:C-C:${playerId}:${certainty}`,
    source: "scout_intel_pipeline",
    category: "transfer",
    severity: "info",
    title: "Scouting-Fortschritt",
    description: `${name}: Certainty ${certainty}% — Intel wird schärfer.`,
    playerId,
  });

describe("Scouting — eine Wochennotiz statt einer Karte je Meilenstein", () => {
  it("ab drei Meldungen wird eine Notiz daraus", () => {
    const result = bundleInboxItems([
      scoutItem("p-1", "Ryze", 75),
      scoutItem("p-2", "Taryn", 50),
      scoutItem("p-3", "Mushu", 50),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("3 Scouting-Reports sind schärfer geworden");
    expect(result[0]!.description).toBe("Ryze, Taryn, Mushu.");
    expect(result[0]!.itemId.startsWith(SCOUT_BUNDLE_PREFIX)).toBe(true);
  });

  it("ab vier wird gekürzt, aber die Zahl bleibt ehrlich", () => {
    const result = bundleInboxItems([
      scoutItem("p-1", "Ryze", 75),
      scoutItem("p-2", "Taryn", 50),
      scoutItem("p-3", "Mushu", 50),
      scoutItem("p-4", "Ixali", 25),
      scoutItem("p-5", "Grimma", 25),
    ]);
    expect(result[0]!.title).toBe("5 Scouting-Reports sind schärfer geworden");
    expect(result[0]!.description).toBe("Ryze, Taryn, Mushu und 2 weitere.");
  });

  it("zwei Meldungen behalten ihren Spielernamen", () => {
    // Bei zwei Karten ist die Notiz kein Gewinn — der Name ist konkreter als eine Zahl.
    const result = bundleInboxItems([scoutItem("p-1", "Ryze", 75), scoutItem("p-2", "Taryn", 50)]);
    expect(result).toHaveLength(2);
  });
});

describe("Was nicht gebündelt wird, bleibt genau wie es war", () => {
  it("fremde Karten gehen unveraendert und in Reihenfolge durch", () => {
    const other = [
      makeItem({ itemId: "player_injured:a", source: "player_health_injury", title: "Verletzter Spieler" }),
      makeItem({ itemId: "contracts_expiring:a", source: "roster_contracts", title: "Verträge laufen aus" }),
      makeItem({ itemId: "board_objective_failed:a", source: "team_season_objectives", title: "Board-Ziel verfehlt" }),
    ];
    expect(bundleInboxItems(other)).toEqual(other);
  });

  it("die gebündelte Karte nimmt den Platz ihrer ersten Einzelkarte ein", () => {
    // Sonst rutschte sie ans Ende und der Nutzer sucht seine dringendste Aufgabe unten.
    const result = bundleInboxItems([
      prepStep("lineup_missing", { severity: "critical" }),
      prepStep("formcards_open"),
      makeItem({ itemId: "contracts_expiring:a", source: "roster_contracts", title: "Verträge laufen aus" }),
    ]);
    expect(result.map((item) => item.title)).toEqual(["Spieltag vorbereiten", "Verträge laufen aus"]);
  });
});

/**
 * DER EINE ANSCHLUSS, DER REISSEN KANN. Die Bündelung nützt nichts, wenn die Anzeige sie nicht
 * aufruft — deshalb wird sie hier nicht direkt, sondern über `groupInboxItemsForDisplay` geprüft,
 * also über genau den Weg, den die Inbox nimmt.
 */
describe("Die Buendelung haengt wirklich in der Anzeige", () => {
  it("groupInboxItemsForDisplay fasst die Spieltags-Schritte zusammen", () => {
    const grouped = groupInboxItemsForDisplay([
      prepStep("lineup_missing", { severity: "critical" }),
      prepStep("formcards_open"),
      prepStep("lineup_not_submitted"),
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.title).toBe("Spieltag vorbereiten");
  });

  it("groupInboxItemsForDisplay fasst die Belastungs-Hinweise je Spieler zusammen", () => {
    const grouped = groupInboxItemsForDisplay([
      healthItem("player_health_fatigue_risk", { severity: "critical" }),
      healthItem("player_health_training_load", { severity: "info" }),
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.playerId).toBe("p-1");
  });

  it("die bestehende Facility-Gruppierung bleibt unangetastet", () => {
    // Sie lief vor der Buendelung und muss danach genauso laufen.
    const facility = (eventId: string, label: string) =>
      makeItem({
        itemId: `facility_news:save-1:${eventId}`,
        source: "facility_events",
        category: "facility",
        severity: "info",
        title: `${label} ausgebaut`,
        description: `${label}: Level 1 → 2.`,
      });
    const grouped = groupInboxItemsForDisplay([facility("e1", "Fan Shop"), facility("e2", "Academy")]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.title).toBe("2 Facility-Events");
  });
});
