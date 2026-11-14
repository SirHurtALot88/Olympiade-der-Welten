import type { SortimentRow } from "./viewModel";

/**
 * Aufgaben-Reiter (UX_VORSCHLAEGE.md Nr. 5, Chris 14.11.2026): feste Filter fuer das Tagesgeschaeft, mit Zaehler, per Adresse
 * (?aufgabe=...) aufrufbar. Dashboard-Zeile "Heute" und Sortiment-Reiter nutzen dieselbe Zaehlung.
 */
export type TaskKey = "alle" | "nachbestellen" | "preis" | "auslisten" | "markiert" | "daten" | "aufraeumen";

export const TASKS: { key: TaskKey; label: string; hint: string }[] = [
  { key: "alle", label: "Alle", hint: "Alle aktiven Artikel mit den Standardfiltern." },
  { key: "nachbestellen", label: "Nachbestellen", hint: "Nachbestellen fällig: Mindestbestand erreicht, ausverkauft mit Verkaufstempo oder Reichweite unter 1,5 Monaten. Zurückgestellte zählen nicht." },
  { key: "preis", label: "Preis ändern", hint: "Dein VK liegt unter (zu günstig) oder über (zu teuer) der Zielspanne. Artikel mit Bestand." },
  { key: "auslisten", label: "Auslisten", hint: "Maßnahme laut Sortiment-Status: Preis senken, Auslaufen lassen oder Auslisten." },
  { key: "markiert", label: "Markiert", hint: "Von dir zum Auslisten vorgemerkt." },
  { key: "daten", label: "Daten prüfen", hint: "Zahlen, denen du nicht trauen kannst: EK fehlt bei Bestand oder Verkauf in 365 Tagen; Verlust trotz mindestens 3 Verkäufen; EK über 150 % vom Marktwert (meist ein Tippfehler im EK)." },
  { key: "aufraeumen", label: "Aufräumen", hint: "Bei eBay beendet, aber in Billbee noch geführt; doppelt angelegt; Name passt nicht zum Set-Code." },
];

export const isTaskKey = (v: string | null | undefined): v is TaskKey => TASKS.some((t) => t.key === v);

type TaskRow = Pick<SortimentRow, "articleId" | "active" | "hidden" | "stock" | "reorderDue" | "market" | "lifecycle" | "delistMarkedAt" | "ebayEndedAt" | "codeName"> & Partial<Pick<SortimentRow, "ekMissing" | "ek" | "dbIIPercent" | "windows">>;

const isCleanup = (r: TaskRow, dupIds: ReadonlySet<string>) => (r.active && !!r.ebayEndedAt) || dupIds.has(r.articleId) || r.codeName?.mismatch === true;

/** Daten pruefen (UX_KONZEPT_GESAMT.md, Entscheidungen 14.11.): EK fehlt bei Bestand oder Verkauf, Verlust trotz Verkaeufen, EK weit ueber Marktwert. */
function isDataIssue(r: TaskRow): boolean {
  const sold365 = r.windows?.["365"]?.qty ?? 0;
  if (r.ekMissing) return r.stock > 0 || sold365 > 0;
  if (sold365 >= 3 && (r.dbIIPercent ?? 0) < 0) return true;
  const value = r.market?.value;
  return value != null && value > 0 && (r.ek ?? 0) > value * 1.5;
}

/** Gehoert die Zeile zur Aufgabe? `dupIds`: Artikel, die zu einer Doppelt-Gruppe gehoeren. Ausgeblendete zaehlen nie. */
export function matchesTask(task: TaskKey, r: TaskRow, dupIds: ReadonlySet<string>): boolean {
  if (r.hidden) return false;
  switch (task) {
    case "alle":
      return true;
    case "nachbestellen":
      return r.reorderDue === true;
    case "preis":
      return r.active && r.stock > 0 && !!r.market?.rated && (r.market.status === "zu_guenstig" || r.market.status === "zu_teuer");
    case "auslisten":
      return r.active && r.stock > 0 && !!r.lifecycle;
    case "markiert":
      return !!r.delistMarkedAt;
    case "aufraeumen":
      return isCleanup(r, dupIds);
    case "daten":
      return r.active && !isCleanup(r, dupIds) && isDataIssue(r);
  }
}

export function taskCounts(rows: ReadonlyArray<TaskRow>, dupIds: ReadonlySet<string>): Record<TaskKey, number> {
  const out: Record<TaskKey, number> = { alle: 0, nachbestellen: 0, preis: 0, auslisten: 0, markiert: 0, daten: 0, aufraeumen: 0 };
  for (const r of rows) {
    if (r.hidden) continue;
    for (const t of TASKS) if (t.key !== "alle" && matchesTask(t.key, r, dupIds)) out[t.key]++;
    if (r.active) out.alle++;
  }
  return out;
}
