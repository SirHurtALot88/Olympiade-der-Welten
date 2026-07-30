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

import { createPersistenceService } from "@/lib/persistence/persistence-service";

export const BUG_REPORTS_DIR = path.join(process.cwd(), "data", "bug-reports");

export type BugReportInput = {
  /** Freitext des Melders. Darf leer sein — der Zustand ist der eigentliche Inhalt. */
  note?: string | null;
  /** Seite/Ansicht, auf der die Flagge geklickt wurde (Client kennt das genauer als der Server). */
  view?: string | null;
  url?: string | null;
  userAgent?: string | null;
  viewport?: { width: number; height: number } | null;
  /** Zeitpunkt beim Klick. Ohne Angabe stempelt der Server. */
  clientTime?: string | null;
};

export type BugReportRecord = BugReportInput & {
  reportId: string;
  createdAt: string;
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

export function saveBugReport(input: BugReportInput): { reportId: string; file: string; record: BugReportRecord } {
  const now = new Date();
  const record: BugReportRecord = {
    ...input,
    note: (input.note ?? "").trim() || null,
    reportId: buildReportId(now),
    createdAt: now.toISOString(),
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
