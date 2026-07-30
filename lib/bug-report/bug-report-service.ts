/**
 * BUG-MELDUNGEN AUS DEM SPIEL — Ablage und Anreicherung.
 *
 * Die Flagge oben rechts schickt eine Meldung hierher. Der Sinn ist nicht, einen Text zu sammeln,
 * sondern den ZUSTAND festzuhalten, in dem der Fehler auftrat: Ohne Saison, Spieltag, aktives Team
 * und Ansicht ist eine Meldung wie "das hier ist kaputt" nicht nachstellbar — genau daran sind in
 * diesem Projekt schon mehrere Diagnosen gescheitert (der Formkarten-Fall liess sich nur ueber
 * Screenshots rekonstruieren, weil der Spielstand fehlte).
 *
 * Die Meldungen landen als JSON unter `data/bug-reports/`. Dieser Ordner wird ins Repo committet,
 * damit sie ueberall lesbar sind — derselbe Weg wie bei `data/online-saves/`.
 */
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_ACTIVE_OWNER_ID, resolveOwnerDisplayLabel } from "@/lib/foundation/team-control-settings";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

export const BUG_REPORTS_DIR = path.join(process.cwd(), "data", "bug-reports");

export type BugReportInput = {
  /** Freitext des Melders. Darf leer sein — der Zustand ist der eigentliche Inhalt. */
  note?: string | null;
  /**
   * Ansicht aus dem `?view=`-Parameter. Praezise, aber NICHT immer da: Seiten ausserhalb der
   * Foundation-Shell (Login, Cockpit, Startseite) haben den Parameter nicht. Deshalb reichen
   * `path` und `pageTitle` daneben — zusammen ist die Seite immer benennbar.
   */
  view?: string | null;
  /** Pfad ohne Query. Immer vorhanden, auch wo `view` fehlt. */
  path?: string | null;
  /** Titel des Dokuments beim Klick — sagt oft mehr als der Pfad. */
  pageTitle?: string | null;
  url?: string | null;
  userAgent?: string | null;
  viewport?: { width: number; height: number } | null;
  /** Zeitpunkt beim Klick. Ohne Angabe stempelt der Server. */
  clientTime?: string | null;
};

export type BugReportReporter = {
  /** Owner-ID aus der Session, oder der lokale Benutzer, wenn der Login aus ist. */
  ownerId: string;
  /** Klarname zum Anzeigen ("Chris", "Franky"). */
  label: string;
  /**
   * `true`, wenn die Identitaet aus einer echten Session kommt. Bei ausgeschaltetem Login ist
   * sie erschlossen (es sitzt genau einer an der Tastatur) — das muss unterscheidbar bleiben,
   * sonst liest sich eine Annahme wie eine Feststellung.
   */
  fromSession: boolean;
};

export type BugReportRecord = BugReportInput & {
  reportId: string;
  createdAt: string;
  /** WER gemeldet hat. Ohne das laesst sich bei einer Rueckfrage niemand ansprechen. */
  reporter: BugReportReporter;
  /** Aus dem aktiven Spielstand ergaenzt — das ist der Teil, der die Meldung nachstellbar macht. */
  game: {
    saveId: string | null;
    saveName: string | null;
    seasonId: string | null;
    seasonYear: number | null;
    currentMatchday: number | null;
    matchdayId: string | null;
    matchdayStatus: string | null;
    activeTeamIds: string[];
  } | null;
};

/** Kurze, sortierbare Id: Zeitstempel zuerst, damit `ls` chronologisch ist. */
function buildReportId(now: Date) {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `bug-${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Zustand des aktiven Spielstands. Bewusst tolerant: laeuft die Meldung ausserhalb eines Spiels
 * (Login-Seite, kein Save aktiv), bleibt `game` null — eine Meldung ohne Spielkontext ist immer noch
 * besser als keine.
 */
function collectGameContext(): BugReportRecord["game"] {
  try {
    const persistence = createPersistenceService();
    const active = persistence.getActiveSave();
    if (!active) return null;
    const full = persistence.getSaveById(active.saveId);
    const gameState = full?.gameState ?? null;
    return {
      saveId: active.saveId,
      saveName: active.name ?? null,
      seasonId: gameState?.season?.id ?? null,
      seasonYear: gameState?.season?.year ?? null,
      currentMatchday: gameState?.season?.currentMatchday ?? null,
      matchdayId: gameState?.matchdayState?.matchdayId ?? null,
      matchdayStatus: gameState?.matchdayState?.status ?? null,
      // Der Steuerungsmodus steht in `seasonState.teamControlSettings`, NICHT auf dem Team-Objekt —
      // `team.controlMode` ist in gespeicherten Staenden leer. Der erste Versuch las von dort und
      // lieferte stillschweigend eine leere Liste: gemessen an einem echten Spielstand kam 0 statt 1
      // heraus. "manual" ist der vom Menschen gefuehrte Modus (die drei sind manual|ai|passive).
      activeTeamIds: Object.values(gameState?.seasonState?.teamControlSettings ?? {})
        .filter((setting) => setting?.controlMode === "manual")
        .map((setting) => setting.teamId),
    };
  } catch {
    // Eine kaputte Anreicherung darf die Meldung nicht verschlucken — genau dann will man sie ja.
    return null;
  }
}

/**
 * Wer meldet. `ownerId` kommt aus der Session — die gibt es nur bei eingeschaltetem Login.
 *
 * Ohne Login sitzt trotzdem genau ein Mensch an der Tastatur, und den kennt das
 * Team-Control-System als `DEFAULT_ACTIVE_OWNER_ID`. Der Fallback erfindet also niemanden.
 * `fromSession: false` haelt fest, dass es erschlossen und nicht belegt ist — bei zwei
 * Spielern auf einer gemeinsamen Instanz waere die Annahme sonst still falsch.
 */
export function resolveBugReportReporter(sessionOwnerId: string | null | undefined): BugReportReporter {
  const ownerId = sessionOwnerId ?? DEFAULT_ACTIVE_OWNER_ID;
  return {
    ownerId,
    label: resolveOwnerDisplayLabel(ownerId) ?? ownerId,
    fromSession: Boolean(sessionOwnerId),
  };
}

/**
 * Ein Satz, der die Seite benennt — fuer Listen und Uebersichten.
 *
 * Reihenfolge nach Aussagekraft: die Ansicht ist am praezisesten, der Titel am lesbarsten,
 * der Pfad der verlaesslichste Rueckfall. "unbekannte Seite" statt eines leeren Strings,
 * damit in einer Liste nicht offenbleibt, ob die Angabe fehlt oder nur leer ist.
 */
export function formatBugReportPage(record: Pick<BugReportRecord, "view" | "path" | "pageTitle">): string {
  const parts = [record.view, record.pageTitle, record.path].filter((part): part is string => Boolean(part?.trim()));
  if (parts.length === 0) return "unbekannte Seite";
  const [primary, ...rest] = parts;
  return rest.length > 0 ? `${primary} (${rest[rest.length - 1]})` : primary;
}

export function saveBugReport(
  input: BugReportInput & { sessionOwnerId?: string | null },
): { reportId: string; file: string; record: BugReportRecord } {
  const now = new Date();
  const { sessionOwnerId, ...reportInput } = input;
  const record: BugReportRecord = {
    ...reportInput,
    note: (reportInput.note ?? "").trim() || null,
    reportId: buildReportId(now),
    createdAt: now.toISOString(),
    reporter: resolveBugReportReporter(sessionOwnerId),
    game: collectGameContext(),
  };
  fs.mkdirSync(BUG_REPORTS_DIR, { recursive: true });
  const file = path.join(BUG_REPORTS_DIR, `${record.reportId}.json`);
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return { reportId: record.reportId, file, record };
}

export function listBugReports(limit = 50): BugReportRecord[] {
  if (!fs.existsSync(BUG_REPORTS_DIR)) return [];
  return fs
    .readdirSync(BUG_REPORTS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, limit)
    .flatMap((name) => {
      try {
        return [JSON.parse(fs.readFileSync(path.join(BUG_REPORTS_DIR, name), "utf8")) as BugReportRecord];
      } catch {
        return [];
      }
    });
}
