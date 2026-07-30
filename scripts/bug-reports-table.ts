/**
 * DIE TICKET-TABELLE — `npm run bugs:tabelle`.
 *
 * Erzeugt `data/bug-reports/TICKETS.md` aus Rohmeldung + Triage-Notiz + Nummern-Register. Die
 * Tabelle wird IMMER vollstaendig neu geschrieben und nie von Hand gepflegt.
 *
 * WARUM ABGELEITET UND NICHT GEPFLEGT. Die beiden Fehlerarten sind nicht gleich schlimm. Einer
 * abgeleiteten Tabelle, deren Quelle jemand nicht nachgezogen hat, sieht man die Luecke an
 * („Ergebnis: —" bei Status `gebaut`), und der Generator mahnt sie sogar an. Eine gepflegte
 * Tabelle, die ein Lauf vergisst, behauptet stattdessen etwas Plausibles und Falsches.
 *
 * Das ist keine Theorie: Nach einem einzigen Tag Betrieb lagen fuer die Sponsoren-Meldung bereits
 * ZWEI unabhaengige Fixes im Repo (#268 aus einer anderen Sitzung und einer aus dieser), weil
 * niemand sehen konnte, dass die Sache schon bearbeitet wurde. Genau diese Doppelarbeit soll die
 * Tabelle verhindern — und sie kann es nur, wenn man ihr trauen kann.
 *
 * Aufrufe:
 *   npm run bugs:tabelle            — schreibt TICKETS.md und vergibt fehlende Nummern
 *   npm run bugs:tabelle -- --check — schreibt nichts, Exit 1 bei Abweichung (fuer den 30-Min-Lauf)
 */
import fs from "node:fs";
import path from "node:path";

import { BUG_REPORTS_DIR, listBugReports, type BugReportRecord } from "@/lib/bug-report/bug-report-service";
import {
  assignTicketNumbers,
  buildNumberByReportId,
  readTicketRegistry,
  writeTicketRegistry,
} from "@/lib/bug-report/bug-report-tickets";
import {
  BUG_TRIAGE_STATUSES,
  findTriageGaps,
  readTriage,
  type BugTriage,
  type BugTriageStatus,
} from "@/lib/bug-report/bug-report-triage";

const TABLE_FILE = path.join(BUG_REPORTS_DIR, "TICKETS.md");

const STATUS_LABEL: Record<BugTriageStatus, string> = {
  offen: "offen",
  vorgeprueft: "vorgeprüft",
  angenommen: "angenommen",
  gebaut: "gebaut ⚠",
  abgelehnt: "abgelehnt",
  erledigt: "erledigt",
};

function formatEingang(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMelder(report: BugReportRecord): string {
  const reporter = report.reporter;
  if (!reporter) return "—";
  if (reporter.source === "session") return reporter.displayName ?? reporter.username ?? "angemeldet";
  return reporter.source === "auth_disabled" ? "Solo" : "—";
}

function formatWo(report: BugReportRecord): string {
  return report.page?.label ?? report.page?.view ?? report.view ?? report.page?.path ?? "—";
}

/**
 * Der Titel kommt vom Pruefer, solange es einen gibt — sonst der Freitext des Melders, und der
 * steht dann in Anfuehrungszeichen. So sieht man auf einen Blick, ob hier schon jemand hingeschaut
 * hat oder ob noch der rohe Zuruf steht.
 */
function formatTitel(report: BugReportRecord, triage: BugTriage | null): string {
  if (triage?.titel) return escapeCell(triage.titel);
  if (report.note) return `„${escapeCell(report.note)}"`;
  return "(ohne Beschreibung)";
}

function formatErgebnis(triage: BugTriage | null): string {
  if (!triage) return "—";
  const gaps = findTriageGaps(triage);
  const parts: string[] = [];
  if (triage.ergebnis) parts.push(escapeCell(triage.ergebnis));
  if (triage.pr) parts.push(`PR ${escapeCell(triage.pr)}`);
  if (triage.commit) parts.push(`\`${escapeCell(triage.commit)}\``);
  if (triage.bestaetigt) parts.push(`bestätigt: ${escapeCell(triage.bestaetigt)}`);
  // Die Luecken stehen MIT in der Zelle. Eine Tabelle, die eine offene Stelle verschweigt, ist
  // wieder genau die gepflegte Tabelle, die wir nicht wollten.
  if (gaps.length > 0) parts.push(`**${gaps.join(", ")}**`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

/** Senkrechte Striche und Zeilenumbrueche wuerden die Markdown-Tabelle zerlegen. */
function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function buildTable(reports: BugReportRecord[], numberByReportId: Map<string, number>, generatedAt: string): string {
  const rows = reports
    .map((report) => ({ report, triage: readTriage(report.reportId) }))
    .sort((left, right) => left.report.createdAt.localeCompare(right.report.createdAt));

  const counts = BUG_TRIAGE_STATUSES.map((status) => {
    const total = rows.filter((row) => (row.triage?.status ?? "offen") === status).length;
    return `${STATUS_LABEL[status].replace(" ⚠", "")}: ${total}`;
  }).join(" · ");

  const lines = [
    "# Tickets — Bug-Meldungen aus dem Spiel",
    "",
    "> **GENERIERT — nicht von Hand editieren.** Diese Datei entsteht aus `data/bug-reports/*.json`,",
    "> `data/bug-reports/triage/*.md` und `tickets.json`. Wer hier etwas ändert, verliert es beim",
    "> nächsten `npm run bugs:tabelle`. Der Stand einer Meldung wird in ihrer Triage-Notiz gepflegt.",
    "",
    `${rows.length} Meldungen — ${counts}`,
    "",
    "| Nr | Eingang | Von | Wo | Titel | Status | Ergebnis |",
    "|---:|---|---|---|---|---|---|",
  ];

  for (const { report, triage } of rows) {
    const nummer = numberByReportId.get(report.reportId);
    const status = triage?.status ?? "offen";
    const nummerCell = nummer
      ? `[${nummer}](triage/${report.reportId}.md)`
      : `[—](triage/${report.reportId}.md)`;
    lines.push(
      `| ${nummerCell} | ${formatEingang(report.createdAt)} | ${formatMelder(report)} | ${escapeCell(
        formatWo(report),
      )} | ${formatTitel(report, triage)} | ${STATUS_LABEL[status]} | ${formatErgebnis(triage)} |`,
    );
  }

  lines.push(
    "",
    "**`gebaut ⚠`** heißt: Der Fix ist gemergt, die Wirkung im laufenden Spiel aber noch nicht belegt.",
    "Erst ein `bestaetigt:` in der Triage-Notiz macht daraus `erledigt`. Diese Unterscheidung gibt es,",
    "weil ein Fix schon einmal als behoben galt und nicht wirkte — der Reload, den er anstieß, wurde",
    "von einem Zwischenspeicher verschluckt.",
    "",
    "Details je Ticket: die Nummer verlinkt auf die Triage-Notiz. Volltext: `npm run bugs:review`.",
    "",
    `_Erzeugt: ${generatedAt}_`,
    "",
  );

  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");

  const reports = listBugReports(500);
  const registryBefore = readTicketRegistry();
  const { registry, assigned } = assignTicketNumbers(registryBefore, reports);

  // Beim Pruefen wird NICHT vergeben — sonst haette ein reiner Lesevorgang einen Nebeneffekt.
  const effectiveRegistry = checkOnly ? registryBefore : registry;
  const numberByReportId = buildNumberByReportId(effectiveRegistry);

  const existing = fs.existsSync(TABLE_FILE) ? fs.readFileSync(TABLE_FILE, "utf8") : "";
  // Der Zeitstempel wuerde jeden Vergleich scheitern lassen — deshalb wird beim Vergleich der
  // Zeitstempel der VORHANDENEN Datei uebernommen. Sonst produzierte jeder Lauf einen Leer-Commit.
  const existingStamp = /_Erzeugt: (.+)_/.exec(existing)?.[1] ?? "";
  const stamp = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
  const nextForCompare = buildTable(reports, numberByReportId, existingStamp);

  if (checkOnly) {
    const unchanged = existing === nextForCompare && assigned.length === 0;
    if (unchanged) {
      console.log("TICKETS.md ist auf Stand.");
      return;
    }
    console.log("TICKETS.md weicht ab — `npm run bugs:tabelle` ausfuehren.");
    if (assigned.length > 0) {
      console.log(`  ${assigned.length} Meldung(en) ohne Ticket-Nummer.`);
    }
    process.exitCode = 1;
    return;
  }

  if (assigned.length > 0) {
    writeTicketRegistry(registry);
    for (const entry of assigned) console.log(`Neue Nummer ${entry.nummer} → ${entry.reportId}`);
  }

  // Unveraendert? Dann die Datei NICHT anfassen — ein neuer Zeitstempel allein ist kein Grund fuer
  // einen Commit, und ein Lauf alle 30 Minuten wuerde die Historie sonst zumuellen.
  if (existing === nextForCompare && assigned.length === 0) {
    console.log("TICKETS.md unveraendert — nichts geschrieben.");
    return;
  }

  fs.writeFileSync(TABLE_FILE, buildTable(reports, buildNumberByReportId(registry), stamp), "utf8");
  console.log(`TICKETS.md geschrieben — ${reports.length} Meldungen.`);

  const withGaps = reports
    .map((report) => ({ report, triage: readTriage(report.reportId) }))
    .filter((row) => row.triage && findTriageGaps(row.triage).length > 0);
  if (withGaps.length > 0) {
    console.log("");
    console.log("Offene Stellen in den Notizen:");
    for (const row of withGaps) {
      const nummer = buildNumberByReportId(registry).get(row.report.reportId) ?? "—";
      console.log(`  Nr ${nummer}: ${findTriageGaps(row.triage!).join(", ")}`);
    }
  }
}

main();
