/**
 * GEMELDET AUS DEM SPIEL: „alles gleich wichtig, alles führt an denselben Ort" — und Chris'
 * Screenshot dazu: eine einzige Spalte, in der eine verfehlte Board-Vorgabe genauso aussieht wie
 * ein Spieltagsbericht, während die rechte Bildschirmhälfte leer bleibt.
 *
 * Der Umbau (docs/INBOX_KONZEPT.md) beantwortet das mit DREI RÄUMEN. Was hier geprüft wird, ist die
 * Regel dahinter — nicht das Aussehen:
 *
 *  1. Ein Bericht ist nie eine Aufgabe.
 *  2. Ein Dauerzustand (Fatigue) besetzt nicht den Handeln-Raum, eine Frist schon.
 *  3. Erledigtes verlässt den Handeln-Raum.
 *  4. Eine NEUE, hier unbekannte Quelle landet nach ihrer eigenen Dringlichkeit — nicht still im
 *     falschen Raum. Das ist der Fall, der sonst beim nächsten Ausbau durchrutscht.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { GameInboxItem } from "@/lib/data/olyDataTypes";
import { INBOX_LANES, groupInboxItemsByLane, resolveInboxLane } from "@/lib/foundation/inbox-lanes";

function makeItem(partial: Partial<GameInboxItem> & { source: string }): GameInboxItem {
  return {
    itemId: partial.itemId ?? `${partial.source}:x`,
    saveId: "save-1",
    seasonId: "season-1",
    category: partial.category ?? "task",
    severity: partial.severity ?? "warning",
    title: partial.title ?? "Titel",
    description: partial.description ?? "Text",
    targetView: partial.targetView ?? "teams",
    targetParams: partial.targetParams ?? {},
    status: partial.status ?? "open",
    createdAt: partial.createdAt ?? "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

describe("Die drei Räume der Inbox", () => {
  it("es gibt genau drei, in der Reihenfolge Handeln → Beobachten → Berichte", () => {
    expect(INBOX_LANES.map((lane) => lane.id)).toEqual(["act", "watch", "report"]);
  });

  it("jeder Raum stellt eine Frage — daran erkennt man, was hineingehört", () => {
    for (const lane of INBOX_LANES) {
      expect(lane.question.length, `${lane.id} braucht eine Frage`).toBeGreaterThan(10);
      expect(lane.emptyText.length, `${lane.id} braucht einen Leer-Text`).toBeGreaterThan(5);
    }
  });

  it("ein Bericht ist nie eine Aufgabe", () => {
    // Spieltags-Recap, Transfer-News, Gebäude-Ausbau, Preisgeld — alles Chronik.
    expect(resolveInboxLane(makeItem({ source: "story:matchday_recap", category: "result" }))).toBe("report");
    expect(resolveInboxLane(makeItem({ source: "transfer_history", category: "transfer" }))).toBe("report");
    expect(resolveInboxLane(makeItem({ source: "facility_events", category: "facility" }))).toBe("report");
    expect(resolveInboxLane(makeItem({ source: "cash_prize_apply_logs", category: "finance" }))).toBe("report");
  });

  it("ein Bericht bleibt Bericht, selbst wenn er als kritisch markiert ist", () => {
    // Sonst könnte eine einzelne laute Chronik-Karte den Handeln-Raum kapern.
    const loudReport = makeItem({ source: "story:matchday_recap", category: "result", severity: "critical" });
    expect(resolveInboxLane(loudReport)).toBe("report");
  });

  it("Belastung ist ein Zustand, keine Frist — sie bleibt im Beobachten-Raum", () => {
    for (const source of ["player_health_fatigue_risk", "player_health_training_load", "player_health_lineup_rest"]) {
      expect(resolveInboxLane(makeItem({ source, category: "warning", severity: "warning" })), source).toBe("watch");
    }
  });

  it("ein kritischer Belastungswert wandert trotzdem hoch", () => {
    expect(
      resolveInboxLane(makeItem({ source: "player_health_fatigue_risk", category: "warning", severity: "critical" })),
    ).toBe("act");
  });

  it("eine Verletzung ist sofort eine Handlung", () => {
    expect(resolveInboxLane(makeItem({ source: "player_health_injury", category: "warning", severity: "critical" }))).toBe(
      "act",
    );
  });

  it("die Aufstellungs-Schritte gehören in den Handeln-Raum", () => {
    expect(resolveInboxLane(makeItem({ source: "lineup_drafts", category: "task" }))).toBe("act");
    expect(resolveInboxLane(makeItem({ source: "season_formcards", category: "task" }))).toBe("act");
  });

  it("Erledigtes verlässt den Handeln-Raum", () => {
    const done = makeItem({ source: "lineup_drafts", category: "task", severity: "critical", status: "done" });
    expect(resolveInboxLane(done)).toBe("watch");
    const dismissed = makeItem({ source: "lineup_drafts", category: "task", severity: "critical", status: "dismissed" });
    expect(resolveInboxLane(dismissed)).toBe("watch");
  });

  it("eine unbekannte NEUE Quelle entscheidet nach ihrer eigenen Dringlichkeit", () => {
    // Der Fall, der beim nächsten Ausbau sonst still im falschen Raum landet.
    expect(resolveInboxLane(makeItem({ source: "gibt_es_noch_nicht", category: "task", severity: "info" }))).toBe("watch");
    expect(resolveInboxLane(makeItem({ source: "gibt_es_noch_nicht", category: "task", severity: "critical" }))).toBe("act");
  });

  it("die Verteilung verliert keine Meldung und behält die Reihenfolge", () => {
    const items = [
      makeItem({ itemId: "a", source: "lineup_drafts", category: "task" }),
      makeItem({ itemId: "b", source: "story:matchday_recap", category: "result" }),
      makeItem({ itemId: "c", source: "season_formcards", category: "task" }),
      makeItem({ itemId: "d", source: "player_health_fatigue_risk", category: "warning" }),
    ];
    const lanes = groupInboxItemsByLane(items, resolveInboxLane);
    expect(lanes.act.map((item) => item.itemId)).toEqual(["a", "c"]);
    expect(lanes.watch.map((item) => item.itemId)).toEqual(["d"]);
    expect(lanes.report.map((item) => item.itemId)).toEqual(["b"]);
    expect(lanes.act.length + lanes.watch.length + lanes.report.length).toBe(items.length);
  });
});

/**
 * VERDRAHTUNG. Die Regel oben nützt nichts, wenn die Ansicht sie nicht benutzt — genau das war der
 * Zwischenstand, den Chris gesehen hat („Inbox ist noch nicht sichtbar ingame"): Stufe 1 war drin,
 * der Umbau nicht. Hausstil im Repo für Oberflächen-Verträge ist die Quelltext-Prüfung
 * (`game-inbox-ui-contract.test.ts`); die vier Punkte hier sind genau die Kette, die reissen kann.
 */
describe("Die Räume sind auch wirklich verdrahtet", () => {
  const root = process.cwd();
  const read = (relative: string) => readFileSync(join(root, relative), "utf8");

  it("der Host schaltet die Räume ein", () => {
    expect(read("app/foundation/inbox-v2/FoundationInboxV2Host.tsx")).toContain("laneLayout: true");
  });

  it("die Ableitung haengt Raum UND Sprungziel an jede Karte", () => {
    const source = read("lib/foundation/tabs/use-inbox-v2-derivations.ts");
    expect(source).toContain("lane: resolveInboxLane(item)");
    expect(source).toContain("targetLabel: resolveInboxTargetLabel(item)");
  });

  it("in der Raeume-Ansicht wird NICHT mehr nach Modus vorgefiltert", () => {
    /**
     * Der wichtigste Punkt: `filterInboxItemsByMode` liesse nur eine Haelfte durch. Mit drei
     * gleichzeitig sichtbaren Raeumen waere der Berichte-Raum dann dauerhaft leer — und der Umbau
     * saehe aus wie ein Fehler.
     */
    const source = read("lib/foundation/tabs/use-inbox-v2-derivations.ts");
    expect(source).toContain("laneLayout ? activeTeamInboxItems : filterInboxItemsByMode");
  });

  it("die Ansicht rendert das Spaltenraster und blendet den Modus-Umschalter aus", () => {
    const source = read("app/foundation/inbox-v2/InboxV2NewLook.tsx");
    expect(source).toContain("nl-inbox-lanes");
    expect(source).toContain("INBOX_LANES.map");
    // Der Umschalter darf in der Raeume-Ansicht nicht mehr erscheinen.
    expect(source).toContain("laneLayout ? null : (");
  });

  it("es gibt ein echtes Spaltenraster im Stylesheet, kein Untereinander", () => {
    const css = read("app/globals.css");
    const laneBlock = css.slice(css.indexOf(".is-new-look .nl-inbox-lanes {"));
    expect(laneBlock.slice(0, 300)).toContain("grid-template-columns: repeat(3");
    // Auf schmalen Schirmen muss es stapeln, sonst quetschen sich drei Spalten aufs Handy.
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
  });
});
