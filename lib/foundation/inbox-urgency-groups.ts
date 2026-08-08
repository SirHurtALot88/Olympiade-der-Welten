/**
 * DRINGLICHKEITS-GRUPPEN DER INBOX (Audit I1–I4, Mockup `inboxV2.html`).
 *
 * Befund: Die Inbox hatte zwei konkurrierende Filtersysteme (äußere Reiter, innere Pills mit
 * anderen Kategorien) und eine flache Liste, in der der Kopf „1 kritisch" meldete, ohne dass
 * irgendein Item als kritisch erkennbar war. Die Antwort ist keine dritte Filterebene, sondern
 * POSITION: die Liste wird nach Dringlichkeit gruppiert —
 *
 *   1. KRITISCH        — blockiert den Spielbetrieb, steht rot markiert ganz oben.
 *   2. HEUTE SINNVOLL  — offene Handlungen (Raum „Jetzt handeln").
 *   3. KANN WARTEN     — Beobachtungen (Raum „Im Blick behalten").
 *   4. BERICHTE        — Chronik/Momente, verlangen nichts.
 *   5. ERLEDIGT        — eingeklappt, keine gleichrangigen Karten mehr.
 *
 * Die Zuordnung baut auf `resolveInboxLane` (docs/INBOX_KONZEPT.md) auf — dieselbe Quelle,
 * die auch die Handeln/Beobachten-Trennung definiert. Diese Datei ist bewusst React-frei,
 * damit die Regel ohne gerenderte Oberfläche prüfbar bleibt.
 */
import type { InboxLaneId } from "@/lib/foundation/inbox-lanes";

export type InboxUrgencyGroupId = "critical" | "today" | "later" | "report" | "resolved";

export type InboxUrgencyItemLike = {
  severity: "critical" | "warning" | "info";
  status?: "open" | "done" | "dismissed";
  lane?: InboxLaneId | null;
};

export type InboxUrgencyGroupMeta = {
  id: InboxUrgencyGroupId;
  title: string;
  /** Tonklasse des Gruppenkopfs — theme-fest, nie die Teamfarbe (F2-Regel). */
  tone: "risk" | "warn" | "neutral";
};

/** Reihenfolge = Render-Reihenfolge: Dringlichstes zuerst, Erledigtes zuletzt (eingeklappt). */
export const INBOX_URGENCY_GROUPS: InboxUrgencyGroupMeta[] = [
  { id: "critical", title: "Kritisch", tone: "risk" },
  { id: "today", title: "Heute sinnvoll", tone: "warn" },
  { id: "later", title: "Kann warten", tone: "neutral" },
  { id: "report", title: "Berichte & Momente", tone: "neutral" },
  { id: "resolved", title: "Erledigt & Ausgeblendet", tone: "neutral" },
];

/**
 * In welche Gruppe gehört dieses Item?
 *
 * Reihenfolge der Prüfungen ist Absicht: Erledigtes zuerst (ein abgehaktes kritisches Item ist
 * erledigt, nicht kritisch), dann die Schwere, dann der Raum. Ohne `lane` (Alt-Mounts, die die
 * Rohdaten selbst zusammenbauen) entscheidet die Schwere allein — kein Item fällt still heraus.
 */
export function resolveInboxUrgencyGroup(item: InboxUrgencyItemLike): InboxUrgencyGroupId {
  if (item.status === "done" || item.status === "dismissed") {
    return "resolved";
  }
  if (item.severity === "critical") {
    return "critical";
  }
  if (item.lane === "report") {
    return "report";
  }
  if (item.lane === "act") {
    return "today";
  }
  if (item.lane === "watch") {
    return "later";
  }
  return item.severity === "warning" ? "today" : "later";
}

/** Alle Items auf die Gruppen verteilen; Reihenfolge innerhalb einer Gruppe bleibt erhalten. */
export function groupInboxItemsByUrgency<T extends InboxUrgencyItemLike>(
  items: T[],
): Record<InboxUrgencyGroupId, T[]> {
  const groups: Record<InboxUrgencyGroupId, T[]> = {
    critical: [],
    today: [],
    later: [],
    report: [],
    resolved: [],
  };
  for (const item of items) {
    groups[resolveInboxUrgencyGroup(item)].push(item);
  }
  return groups;
}

/**
 * Konsequenz-Zeile („Wenn du nichts tust: …") — NUR für Quellen, deren Folge eine belegte
 * Spielregel ist. Alles andere bekommt bewusst keine Zeile: eine erfundene Konsequenz wäre
 * schlimmer als keine. Der Formkarten-Fall braucht keinen Eintrag — seine Beschreibung nennt
 * die Strafpunkte bereits aus den echten Audit-Daten.
 */
const INBOX_CONSEQUENCE_BY_SOURCE: Record<string, string> = {
  // Arena-Readiness blockt den Spieltag-Start ohne bestätigte Einsatzliste (matchdayArenaReadiness).
  lineup_drafts: "der Spieltag kann nicht starten.",
};

export function resolveInboxConsequence(item: InboxUrgencyItemLike & { source?: string | null }): string | null {
  // Nur offene, kritische Items tragen die Zeile — bei fremden Teams (warning) oder erledigten
  // Items stimmt die Aussage nicht mehr.
  if (item.status !== "open" || item.severity !== "critical") {
    return null;
  }
  if (!item.source) {
    return null;
  }
  return INBOX_CONSEQUENCE_BY_SOURCE[item.source] ?? null;
}
