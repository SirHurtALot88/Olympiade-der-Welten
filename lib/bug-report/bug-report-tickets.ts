/**
 * TICKET-NUMMERN — kurz, stabil, und das einzige Stueck gepflegter Zustand im Ticketsystem.
 *
 * Die Meldungs-Id ist `bug-2026-07-30T14-10-27-776Z-7ysypt`. Damit kann man arbeiten, aber nicht
 * reden. Chris will „Nr. 3" sagen koennen, und „Nr. 3" muss naechste Woche noch dieselbe Meldung
 * sein.
 *
 * WARUM EIN REGISTER STATT ABLEITUNG. Naheliegend waere: nach Datum sortieren, durchnummerieren.
 * Das bricht beim ersten Nachzuegler — eine Meldung, die spaeter dazukommt (der Spiegel-Branch wird
 * per Force-Push ueberschrieben, und Chris kann lokal gespielte Meldungen nachcommitten), schiebt
 * alle spaeteren Nummern um eins. Aus „Nr. 3" wird stillschweigend eine andere Sache, und jede
 * Notiz, jeder Commit, jedes Gespraech, das sich darauf bezog, zeigt ins Leere.
 *
 * WARUM APPEND-ONLY. Das Register ist die einzige Datei, an der sich zwei gleichzeitige Laeufe
 * treffen. Weil nur angehaengt wird und die Vergabe deterministisch ist (naechste freie Nummer,
 * Neuzugaenge nach `createdAt`), ist der Konflikt harmlos: Wer als Zweiter pusht, holt neu, sieht
 * die inzwischen vergebenen Nummern und vergibt nur noch fuer wirklich Unvergebenes. Kein Sperren
 * noetig, und eine Umnummerierung ist gar nicht erst moeglich.
 *
 * Das Register liegt BEWUSST NICHT auf dem Spiegel-Branch `bug-reports` — den ueberschreibt der
 * Server-Cron mit einem elternlosen Force-Push, und damit waeren alle Nummern regelmaessig weg.
 */
import fs from "node:fs";
import path from "node:path";

import { BUG_REPORTS_DIR } from "@/lib/bug-report/bug-report-service";

export const BUG_TICKETS_FILE = path.join(BUG_REPORTS_DIR, "tickets.json");

/** Nummer → Meldungs-Id. Nummern als Text, weil JSON-Schluessel Text sind. */
export type BugTicketRegistry = Record<string, string>;

export function readTicketRegistry(): BugTicketRegistry {
  if (!fs.existsSync(BUG_TICKETS_FILE)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(BUG_TICKETS_FILE, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    // Tolerant lesen: ein von Hand kaputt editierter Eintrag darf nicht das ganze Register kippen.
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([key, value]) => /^\d+$/.test(key) && typeof value === "string" && value.length > 0,
      ) as Array<[string, string]>,
    );
  } catch {
    return {};
  }
}

/**
 * Vergibt Nummern an alles, was noch keine hat. Bestehende Zuordnungen werden NIE angefasst —
 * auch dann nicht, wenn eine nachtraeglich aufgetauchte Meldung dadurch eine hoehere Nummer bekommt
 * als eine juengere. Stabilitaet schlaegt Chronologie: die Tabelle sortiert ohnehin nach Eingang,
 * die Nummer ist ein Name, kein Rang.
 */
export function assignTicketNumbers(
  registry: BugTicketRegistry,
  reports: Array<{ reportId: string; createdAt: string }>,
): { registry: BugTicketRegistry; assigned: Array<{ nummer: number; reportId: string }> } {
  const known = new Set(Object.values(registry));
  const highest = Object.keys(registry).reduce((max, key) => Math.max(max, Number(key)), 0);

  const fresh = reports
    .filter((report) => !known.has(report.reportId))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.reportId.localeCompare(right.reportId));

  const next: BugTicketRegistry = { ...registry };
  const assigned: Array<{ nummer: number; reportId: string }> = [];
  fresh.forEach((report, index) => {
    const nummer = highest + index + 1;
    next[String(nummer)] = report.reportId;
    assigned.push({ nummer, reportId: report.reportId });
  });

  return { registry: next, assigned };
}

/** Schreibt das Register — nach Nummer sortiert, damit der Diff lesbar bleibt. */
export function writeTicketRegistry(registry: BugTicketRegistry): void {
  fs.mkdirSync(BUG_REPORTS_DIR, { recursive: true });
  const sorted = Object.fromEntries(
    Object.entries(registry).sort(([left], [right]) => Number(left) - Number(right)),
  );
  fs.writeFileSync(BUG_TICKETS_FILE, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

/** Meldungs-Id → Nummer, fuer die Anzeige. */
export function buildNumberByReportId(registry: BugTicketRegistry): Map<string, number> {
  return new Map(Object.entries(registry).map(([nummer, reportId]) => [reportId, Number(nummer)]));
}
