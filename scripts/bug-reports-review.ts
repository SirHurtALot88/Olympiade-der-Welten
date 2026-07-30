/**
 * DIE MELDUNGEN VORLEGEN — `npm run bugs:review`.
 *
 * Zweck ist eine Entscheidungsvorlage, keine Statistik. Nach jeder Meldung soll genau eine Frage
 * beantwortbar sein: "soll das gefixt werden?". Deshalb steht bei jedem Eintrag der Zustand, in dem
 * der Fehler auftrat (Spielstand, Saison, Spieltag, Seite, Melder) direkt neben dem Befund und dem
 * Loesungsvorschlag des Agenten — und nicht in einer zweiten Datei, die man auch noch aufmachen muss.
 *
 * Sortierung: was noch eine Handlung braucht, steht oben (offen → vorgeprueft → angenommen), danach
 * das Abgehakte. Innerhalb einer Gruppe die neueste Meldung zuerst.
 *
 * Aufrufe:
 *   npm run bugs:review              — offene Vorgaenge (der Normalfall)
 *   npm run bugs:review -- --alle    — auch abgelehnte und erledigte
 *   npm run bugs:review -- --json    — maschinenlesbar, fuer den Agenten
 */
import {
  listBugReports,
  type BugReportRecord,
} from "@/lib/bug-report/bug-report-service";
import {
  OPEN_TRIAGE_STATUSES,
  readTriage,
  type BugTriage,
  type BugTriageStatus,
} from "@/lib/bug-report/bug-report-triage";

type Entry = { report: BugReportRecord; triage: BugTriage | null; status: BugTriageStatus };

/** Reihenfolge der Statusgruppen in der Ausgabe — wer am Zug ist, steht oben. */
const STATUS_ORDER: BugTriageStatus[] = ["vorgeprueft", "offen", "angenommen", "erledigt", "abgelehnt"];

const STATUS_HINT: Record<BugTriageStatus, string> = {
  vorgeprueft: "wartet auf DEINE Entscheidung",
  offen: "noch nicht geprueft — der Agent ist am Zug",
  angenommen: "freigegeben — der Fix ist zu bauen",
  erledigt: "gefixt",
  abgelehnt: "verworfen",
};

function parseArgs(argv: string[]) {
  return {
    alle: argv.includes("--alle") || argv.includes("--all"),
    json: argv.includes("--json"),
  };
}

/** Melder als Klartext. Ohne die Unterscheidung liest sich jede Solo-Meldung wie "unbekannt". */
function formatReporter(report: BugReportRecord): string {
  const reporter = report.reporter;
  if (!reporter) return "unbekannt (Meldung aus der Zeit vor dem Melder-Feld)";
  if (reporter.source === "session") return reporter.displayName ?? reporter.username ?? "angemeldet";
  if (reporter.source === "auth_disabled") return "Login aus (Solo am eigenen Rechner)";
  return "niemand angemeldet";
}

/** Seite als Klartext: lesbares Label wenn vorhanden, sonst der Pfad, sonst die rohe Ansicht. */
function formatPage(report: BugReportRecord): string {
  const page = report.page;
  if (!page) return report.view ?? report.url ?? "unbekannt";
  const parts: string[] = [];
  if (page.label) parts.push(page.label);
  else if (page.view) parts.push(page.view);
  if (page.path) parts.push(page.path);
  if (page.tab) parts.push(`Reiter „${page.tab}“`);
  return parts.length > 0 ? parts.join(" · ") : "unbekannt";
}

function formatGame(report: BugReportRecord): string {
  const game = report.game;
  if (!game) return "kein Spielstand aktiv";
  const parts = [
    game.saveName ?? game.saveId ?? "unbenannter Stand",
    game.seasonYear != null ? `Saison ${game.seasonYear}` : null,
    game.currentMatchday != null ? `Spieltag ${game.currentMatchday}` : null,
    game.matchdayStatus ? `Spieltag ist ${game.matchdayStatus}` : null,
    game.activeTeamIds.length > 0 ? `gefuehrt: ${game.activeTeamIds.join(", ")}` : "kein gefuehrtes Team",
  ];
  return parts.filter(Boolean).join(" · ");
}

function formatLocalTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
}

function collect(): Entry[] {
  // Grosszuegiges Limit: eine uebersehene Meldung ist teurer als eine lange Liste.
  return listBugReports(500).map((report) => {
    const triage = readTriage(report.reportId);
    return { report, triage, status: triage?.status ?? "offen" };
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const all = collect();
  const entries = args.alle ? all : all.filter((entry) => OPEN_TRIAGE_STATUSES.includes(entry.status));

  if (args.json) {
    console.log(JSON.stringify({ total: all.length, shown: entries.length, entries }, null, 2));
    return;
  }

  const counts = STATUS_ORDER.map((status) => `${status}: ${all.filter((e) => e.status === status).length}`);
  console.log("");
  console.log("BUG-MELDUNGEN AUS DEM SPIEL");
  console.log(`${all.length} insgesamt — ${counts.join(" · ")}`);
  console.log("");

  if (all.length === 0) {
    console.log("Keine Meldungen abgelegt.");
    console.log("");
    console.log("Falls doch gemeldet wurde: die Dateien liegen dort, wo GESPIELT wurde.");
    console.log("  Lokal gespielt   → data/bug-reports/ auf deinem Rechner, committen und pushen.");
    console.log("  Auf dem Server   → Branch 'bug-reports' (Cron, siehe deploy/hetzner/push-bug-reports.sh).");
    return;
  }

  if (entries.length === 0) {
    console.log("Nichts offen — alle Meldungen sind entschieden. Mit --alle auch die abgehakten zeigen.");
    return;
  }

  entries.sort((left, right) => {
    const byStatus = STATUS_ORDER.indexOf(left.status) - STATUS_ORDER.indexOf(right.status);
    if (byStatus !== 0) return byStatus;
    return right.report.createdAt.localeCompare(left.report.createdAt);
  });

  let currentStatus: BugTriageStatus | null = null;
  for (const entry of entries) {
    if (entry.status !== currentStatus) {
      currentStatus = entry.status;
      console.log("");
      console.log(`── ${currentStatus.toUpperCase()} — ${STATUS_HINT[currentStatus]} ${"─".repeat(28)}`);
    }
    const { report, triage } = entry;
    console.log("");
    console.log(`  ${triage?.titel ?? report.note ?? "(ohne Beschreibung)"}`);
    console.log(`    Id       ${report.reportId}`);
    console.log(`    Wann     ${formatLocalTime(report.createdAt)}`);
    console.log(`    Wer      ${formatReporter(report)}`);
    console.log(`    Wo       ${formatPage(report)}`);
    console.log(`    Stand    ${formatGame(report)}`);
    if (triage?.schwere) console.log(`    Schwere  ${triage.schwere}`);
    if (report.note && triage?.titel) console.log(`    Gemeldet "${report.note}"`);
    if (triage?.body) {
      console.log("");
      for (const line of triage.body.split("\n")) console.log(`    ${line}`);
    } else {
      console.log(`    Befund   — steht aus —`);
    }
  }

  console.log("");
  console.log("─".repeat(72));
  console.log("Entscheiden: im Beileger data/bug-reports/triage/<Id>.md den Status auf");
  console.log("'angenommen' oder 'abgelehnt' setzen — oder es dem Agenten einfach sagen.");
  console.log("");
}

main();
