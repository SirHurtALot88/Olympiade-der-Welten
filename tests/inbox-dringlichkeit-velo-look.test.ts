/**
 * S2 · Inbox-Umbau (Mockup inboxV2.html; Audit-Befunde I1–I5).
 *
 * Chris' Meldung nach dem Spielen: „inbox sieht noch gleich aus". Die Befunde dahinter:
 *  - I1: zwei konkurrierende Filtersysteme (äußere Reiter vs. innere Pills mit anderen Kategorien),
 *  - I2: Reiter „Warnungen" meldete „Alles erledigt", während der Kopf „11 offen · 1 kritisch" sagte,
 *  - I3: „1 kritisch" — aber KEIN Item in der Liste war als kritisch markiert,
 *  - I4: Sortierung folgte nicht der Dringlichkeit, Erledigtes stand gleichrangig dazwischen,
 *  - I5: das „kritisch"-Badge war mit 3,09:1 ausgerechnet am schwächsten lesbar.
 *
 * Dieser Test hält die Regeln des Umbaus fest: EIN Filtersystem, Dringlichkeits-Gruppen
 * (Kritisch → Heute → Kann warten → Berichte → Erledigt eingeklappt), Kopf-Zähler und
 * gerenderte kritische Karten aus derselben Quelle — und dass jede benutzte CSS-Klasse
 * wirklich in globals.css existiert (CSS-Klassen fallen still durch).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { GameInboxItem } from "@/lib/data/olyDataTypes";
import { isGameInboxDecisionItem } from "@/lib/foundation/game-inbox-service";
import { resolveInboxLane } from "@/lib/foundation/inbox-lanes";
import {
  INBOX_URGENCY_GROUPS,
  groupInboxItemsByUrgency,
  resolveInboxConsequence,
  resolveInboxUrgencyGroup,
} from "@/lib/foundation/inbox-urgency-groups";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const MARKUP = quelle("app/foundation/inbox-v2/InboxV2NewLook.tsx");
const BODY = quelle("app/foundation/FoundationShellRouterBody.tsx");
const SCOPE = quelle("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
const CSS = quelle("app/globals.css");

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

describe("Dringlichkeits-Gruppen: die Zuordnungsregel", () => {
  it("die Gruppen stehen in der Reihenfolge Kritisch → Heute → Kann warten → Berichte → Erledigt", () => {
    expect(INBOX_URGENCY_GROUPS.map((group) => group.id)).toEqual([
      "critical",
      "today",
      "later",
      "report",
      "resolved",
    ]);
  });

  it("ein offenes kritisches Item steht in der Kritisch-Gruppe — egal welcher Raum", () => {
    expect(resolveInboxUrgencyGroup({ severity: "critical", status: "open", lane: "act" })).toBe("critical");
    expect(resolveInboxUrgencyGroup({ severity: "critical", status: "open", lane: "watch" })).toBe("critical");
  });

  it("Erledigtes ist nie kritisch — es wandert in die eingeklappte Gruppe", () => {
    expect(resolveInboxUrgencyGroup({ severity: "critical", status: "done", lane: "act" })).toBe("resolved");
    expect(resolveInboxUrgencyGroup({ severity: "warning", status: "dismissed", lane: "act" })).toBe("resolved");
  });

  it("Handeln-Raum → Heute, Beobachten-Raum → Kann warten, Chronik → Berichte", () => {
    expect(resolveInboxUrgencyGroup({ severity: "warning", status: "open", lane: "act" })).toBe("today");
    expect(resolveInboxUrgencyGroup({ severity: "info", status: "open", lane: "watch" })).toBe("later");
    expect(resolveInboxUrgencyGroup({ severity: "info", status: "open", lane: "report" })).toBe("report");
  });

  it("ohne Raum-Angabe entscheidet die Schwere — kein Item fällt still heraus", () => {
    expect(resolveInboxUrgencyGroup({ severity: "warning", status: "open" })).toBe("today");
    expect(resolveInboxUrgencyGroup({ severity: "info", status: "open" })).toBe("later");
  });

  it("die Verteilung verliert kein Item", () => {
    const items = [
      { severity: "critical" as const, status: "open" as const, lane: "act" as const },
      { severity: "warning" as const, status: "open" as const, lane: "act" as const },
      { severity: "info" as const, status: "open" as const, lane: "watch" as const },
      { severity: "info" as const, status: "open" as const, lane: "report" as const },
      { severity: "info" as const, status: "done" as const, lane: "watch" as const },
    ];
    const groups = groupInboxItemsByUrgency(items);
    const total = INBOX_URGENCY_GROUPS.reduce((sum, group) => sum + groups[group.id].length, 0);
    expect(total).toBe(items.length);
    expect(groups.critical.length).toBe(1);
    expect(groups.resolved.length).toBe(1);
  });
});

describe("Eine Quelle pro Größe: Kopf-Zähler === gerenderte Karten (Audit I3)", () => {
  // Gemischter Spielstand: das kritische Lineup, offene Aufgaben, Beobachtungen,
  // eine Chronik-Meldung, Erledigtes.
  const gameItems: GameInboxItem[] = [
    makeItem({ itemId: "lineup", source: "lineup_drafts", category: "task", severity: "critical" }),
    makeItem({ itemId: "formcards", source: "season_formcards", category: "task", severity: "warning" }),
    makeItem({ itemId: "contracts", source: "roster_contracts", category: "contract", severity: "warning" }),
    makeItem({ itemId: "captain", source: "team_captain_upgrade", category: "task", severity: "info" }),
    makeItem({ itemId: "objectives", source: "team_season_objectives", category: "task", severity: "warning" }),
    makeItem({ itemId: "chronik", source: "transfer_history", category: "transfer", severity: "info" }),
    makeItem({ itemId: "erledigt", source: "lineup_drafts", category: "task", severity: "info", status: "done" }),
  ];

  // Exakt die Ableitung der Mounts: lane aus resolveInboxLane, Gruppen aus der Urgency-Regel.
  const viewItems = gameItems.map((item) => ({
    id: item.itemId,
    severity: item.severity,
    status: item.status,
    lane: resolveInboxLane(item),
    source: item.source,
  }));
  const groups = groupInboxItemsByUrgency(viewItems);

  it("der Kopf-Zähler kritisch entspricht der Anzahl als kritisch gerenderter Karten", () => {
    // Kopf: activeTeamDecisionCriticalInboxItems (offene Entscheidungen mit severity critical).
    const headCritical = gameItems.filter(
      (item) => item.status === "open" && isGameInboxDecisionItem(item) && item.severity === "critical",
    ).length;
    expect(groups.critical.length).toBe(headCritical);
    expect(groups.critical.map((item) => item.id)).toEqual(["lineup"]);
  });

  it("der Kopf-Zähler offen entspricht den offenen Handlungs-Karten (Kritisch + Heute + Kann warten)", () => {
    // Kopf: activeTeamDecisionInboxItems — dieselbe Quelle wie Home (F4).
    const headOpen = gameItems.filter((item) => item.status === "open" && isGameInboxDecisionItem(item)).length;
    expect(groups.critical.length + groups.today.length + groups.later.length).toBe(headOpen);
  });

  it("Chronik landet unter Berichte, Erledigtes im eingeklappten Block", () => {
    expect(groups.report.map((item) => item.id)).toEqual(["chronik"]);
    expect(groups.resolved.map((item) => item.id)).toEqual(["erledigt"]);
  });
});

describe("Konsequenz-Zeile: nur belegte Spielregeln, nie erfundene Drohungen", () => {
  it("das kritische Lineup nennt die echte Folge (Spieltag startet nicht)", () => {
    expect(
      resolveInboxConsequence({ severity: "critical", status: "open", source: "lineup_drafts" }),
    ).toContain("Spieltag");
  });

  it("dasselbe Item als Warnung (fremdes Team) bekommt keine Zeile", () => {
    expect(resolveInboxConsequence({ severity: "warning", status: "open", source: "lineup_drafts" })).toBeNull();
  });

  it("unbekannte Quellen bekommen keine Zeile — lieber nichts als falsch", () => {
    expect(resolveInboxConsequence({ severity: "critical", status: "open", source: "gibt_es_nicht" })).toBeNull();
  });
});

describe("EIN Filtersystem (Audit I1/I2)", () => {
  it("die äußeren Kategorie-Reiter der Shell sind weg", () => {
    // Der tote „Warnungen"-Reiter war der Kern von I2 („Alles erledigt" neben „11 offen").
    expect(BODY).not.toContain('{ id: "warning", label: "Warnungen" }');
    expect(BODY).not.toContain("inboxAllBadgeCount");
  });

  it("die Ansicht filtert selbst und bekommt dafür die VOLLE Liste", () => {
    expect(MARKUP).toContain("const displayedItems = useMemo(() => {");
    // Der Scope filtert nicht mehr nach Kategorie vor (sonst stimmen die Pill-Zähler nicht).
    expect(SCOPE).not.toContain("category: inboxCategoryFilter,");
  });

  it("gefilterte Leere sagt keine-Einträge-in-dieser-Kategorie statt Alles-erledigt", () => {
    expect(MARKUP).toContain("Keine Einträge in dieser Kategorie");
    expect(MARKUP).toContain("Alle anzeigen");
  });

  it("die Pill-Zähler und der Kopf zählen dieselbe Basis (offene Handlungen)", () => {
    expect(MARKUP).toContain("openActionableItems.length");
    expect(BODY).toContain("openCount={activeTeamDecisionInboxItems.length}");
  });
});

describe("Die Ansicht rendert die Gruppen wirklich", () => {
  it("Gruppen-Renderer, kritische Markierung und eingeklapptes Erledigt existieren im Markup", () => {
    expect(MARKUP).toContain("INBOX_URGENCY_GROUPS.map");
    expect(MARKUP).toContain('" is-critical"');
    expect(MARKUP).toContain("nl-inbox-critical-tag");
    expect(MARKUP).toContain("nl-inbox-done-block");
    expect(MARKUP).toContain("nl-inbox-card-consequence");
  });

  it("beide Mounts liefern lane + source an die Karten (gleiche Gruppierung überall)", () => {
    expect(SCOPE).toContain("lane: resolveInboxLane(item)");
    expect(SCOPE).toContain("source: item.source");
    expect(quelle("lib/foundation/tabs/use-inbox-v2-derivations.ts")).toContain("source: item.source");
  });

  it("die Lineup-Beschreibung zeigt Spieltag N statt des rohen Bezeichners", () => {
    const service = quelle("lib/foundation/game-inbox-service.ts");
    expect(service).toContain(
      "Einsatzliste für ${resolveMatchdayDisplayLabel(input.gameState, input.gameState.matchdayState.matchdayId)} ist noch leer.",
    );
  });
});

describe("Jede im Markup benutzte Inbox-Klasse existiert in globals.css", () => {
  const tokens = new Set<string>();
  for (const match of MARKUP.matchAll(/nl-inbox[a-z0-9-]*(?<!-)/g)) {
    tokens.add(match[0]);
  }
  // Element-ID-Präfix (Scroll-Anker), keine Klasse.
  tokens.delete("nl-inbox-item");
  // Abgeschnittener Template-Präfix (`nl-inbox-cadence-${cadence}`) — geprüft werden
  // stattdessen die echten Varianten.
  tokens.delete("nl-inbox-cadence");
  tokens.add("nl-inbox-cadence-recurring");
  tokens.add("nl-inbox-cadence-once");

  it.each([...tokens].sort())("%s ist in globals.css definiert", (klasse) => {
    expect(CSS).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
  });
});
