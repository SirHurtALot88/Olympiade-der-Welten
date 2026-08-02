/**
 * DIE DREI RÄUME DER INBOX (docs/INBOX_KONZEPT.md, Abschnitt 2).
 *
 * Gemeldet war: „alles gleich wichtig, alles führt an denselben Ort." Der Grund lag nicht an den
 * einzelnen Karten, sondern an der Anordnung — eine einzige Liste, in der die Dringlichkeit
 * ausschließlich als Farbstreifen auftaucht, und ein Modus-Umschalter („Entscheidungen"/„Chronik"),
 * der jeweils die eine Hälfte versteckt.
 *
 * Der Leitsatz dahinter ist **Handeln ≠ Wissen**: eine Meldung, die eine Entscheidung verlangt,
 * darf nicht neben einer stehen, die nur informiert. Statt einer Liste gibt es drei Räume:
 *
 *   1. JETZT HANDELN     — „Was kostet mich etwas, wenn ich es liegen lasse?"
 *   2. IM BLICK BEHALTEN — „Was wird bald wichtig?"
 *   3. BERICHTE          — „Was ist passiert?"
 *
 * Dringlichkeit ist damit **Position**, nicht nur Farbe, und alle drei sind gleichzeitig sichtbar.
 *
 * Diese Datei enthält NUR die Zuordnung — sie ist bewusst frei von React, damit die Regel ohne
 * gerenderte Oberfläche prüfbar bleibt.
 */
import type { GameInboxItem } from "@/lib/data/olyDataTypes";
import { isGameInboxChronicleItem } from "@/lib/foundation/game-inbox-service";

export type InboxLaneId = "act" | "watch" | "report";

export type InboxLaneMeta = {
  id: InboxLaneId;
  title: string;
  /** Die Frage, die dieser Raum beantwortet — steht als Unterzeile über der Spalte. */
  question: string;
  /** Was hier steht, wenn der Raum leer ist. Leer ist im ersten Raum eine gute Nachricht. */
  emptyText: string;
};

export const INBOX_LANES: InboxLaneMeta[] = [
  {
    id: "act",
    title: "Jetzt handeln",
    question: "Was kostet dich etwas, wenn du es liegen lässt?",
    emptyText: "Nichts offen — du bist durch.",
  },
  {
    id: "watch",
    title: "Im Blick behalten",
    question: "Was wird bald wichtig?",
    emptyText: "Nichts am Horizont.",
  },
  {
    id: "report",
    title: "Berichte & Momente",
    question: "Was ist passiert?",
    emptyText: "Noch nichts passiert — nach dem nächsten Spieltag steht hier was.",
  },
];

/**
 * Quellen, die IMMER nur beobachten lassen, auch wenn ihre Karte „warning" trägt.
 *
 * Der Belastungs-Report ist der wichtigste Fall: Fatigue und Verletzungsrisiko sind ein Zustand,
 * keine Frist. Wer sie in den Handeln-Raum stellt, macht aus einem Dauerzustand einen Daueralarm —
 * und der erste Raum verliert genau die Bedeutung, für die es ihn gibt.
 */
const WATCH_ONLY_SOURCES = new Set<string>([
  "player_health_fatigue_risk",
  "player_health_training_load",
  "player_health_lineup_rest",
  "team_captain_upgrade",
  "scout_intel_pipeline",
  "roster_cash_transfer_window",
  "roster_value_contract_cash",
  "facility_catalog_cash_check",
  "facility_condition_forecast",
  "team_season_objectives",
]);

/**
 * Quellen, die immer eine Handlung verlangen — unabhängig von der Schwere, die die Karte trägt.
 *
 * Beispiel `roster_contracts`: „4 Verträge laufen aus" ist ausserhalb des Entscheidungsfensters nur
 * eine Info, aber innerhalb davon eine Frist. Die Schwere wird an der Quelle bereits richtig
 * gesetzt; hier steht nur, dass es überhaupt eine Handlung ist.
 */
const ACT_SOURCES = new Set<string>([
  "player_health_injury",
  "lineup_drafts",
  "season_formcards",
  "roster_contracts",
  "contract_dissolution_offer",
  "sponsor_v2_choice_pending",
  "team_captain_missing",
  "player_training_mode",
  "room_flow_state",
  "game_flow_controller",
  "game_phase",
  "facility_finance_forecast",
  "preseason_workflow_logs",
]);

/**
 * In welchen Raum gehört diese Meldung?
 *
 * Reihenfolge der Prüfungen ist Absicht: Berichte zuerst (eine Chronik-Meldung ist nie eine
 * Aufgabe, egal was sonst zutrifft), dann die beiden benannten Quellenlisten, und erst zuletzt der
 * Rückfall über die Schwere. So entscheidet eine unbekannte NEUE Quelle nach ihrer eigenen
 * Dringlichkeit statt still im falschen Raum zu landen.
 */
export function resolveInboxLane(item: GameInboxItem): InboxLaneId {
  if (isGameInboxChronicleItem(item)) {
    return "report";
  }

  // Erledigtes und Ausgeblendetes verlangt nichts mehr — es darf den Handeln-Raum nicht belegen.
  if (item.status !== "open") {
    return "watch";
  }

  if (WATCH_ONLY_SOURCES.has(item.source)) {
    // Ein einzelner Ausreisser darf trotzdem hochwandern: ein kritischer Belastungswert ist keine
    // Beobachtung mehr. Die Schwelle setzt die Quelle, nicht diese Datei.
    return item.severity === "critical" ? "act" : "watch";
  }

  if (ACT_SOURCES.has(item.source)) {
    return "act";
  }

  return item.severity === "info" ? "watch" : "act";
}

/** Alle Meldungen auf ihre Räume verteilen, Reihenfolge innerhalb eines Raums bleibt erhalten. */
export function groupInboxItemsByLane<T>(items: T[], resolve: (item: T) => InboxLaneId): Record<InboxLaneId, T[]> {
  const lanes: Record<InboxLaneId, T[]> = { act: [], watch: [], report: [] };
  for (const item of items) {
    lanes[resolve(item)].push(item);
  }
  return lanes;
}
