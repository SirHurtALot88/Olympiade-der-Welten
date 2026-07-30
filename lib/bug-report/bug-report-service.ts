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

import { getFoundationBreadcrumb } from "@/lib/foundation/foundation-breadcrumb";
import { normalizeFoundationViewParam, type FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

export const BUG_REPORTS_DIR = path.join(process.cwd(), "data", "bug-reports");

export type BugReportInput = {
  /** Freitext des Melders. Darf leer sein — der Zustand ist der eigentliche Inhalt. */
  note?: string | null;
  /** Seite/Ansicht, auf der die Flagge geklickt wurde (Client kennt das genauer als der Server). */
  view?: string | null;
  /** Pfad ohne Query, z. B. "/foundation". Traegt die Ansichten, die KEIN `?view=` haben. */
  path?: string | null;
  /** Unter-Reiter innerhalb einer Ansicht (`?tab=`) — sonst landet man beim Nachstellen daneben. */
  tab?: string | null;
  /**
   * Dokumenttitel beim Klick. Die Nav-Konfiguration kennt nur die Foundation-Ansichten; auf Login,
   * Startseite und Online-Raum bleibt `label` sonst leer und es steht nur der nackte Pfad da.
   */
  pageTitle?: string | null;
  url?: string | null;
  userAgent?: string | null;
  viewport?: { width: number; height: number } | null;
  /** Zeitpunkt beim Klick. Ohne Angabe stempelt der Server. */
  clientTime?: string | null;
  /** Wer gemeldet hat. Kommt aus dem Session-Cookie und wird NUR von der Route gesetzt. */
  reporter?: BugReportReporter | null;
};

/**
 * Wer die Meldung abgesetzt hat.
 *
 * `source` ist kein Beiwerk: ohne sie ist ein leerer Name nicht deutbar. "Login ist aus" (Solo am
 * eigenen Rechner — es GIBT keinen Benutzer) und "niemand angemeldet" (Login an, Meldung von der
 * Login-Seite) sehen im Feld `username` identisch aus, verlangen beim Nachstellen aber Verschiedenes.
 */
export type BugReportReporter = {
  username: string | null;
  displayName: string | null;
  /** Owner-Id aus dem Team-Control-System — damit laesst sich "sein" Team im Save finden. */
  ownerId: string | null;
  source: "session" | "auth_disabled" | "not_logged_in";
};

/** Die Seite, auf der geklickt wurde — maschinenlesbar UND als Klartext. */
export type BugReportPage = {
  path: string | null;
  view: string | null;
  tab: string | null;
  /**
   * Lesbarer Name, z. B. "Spieltag · Arena". Kommt aus der Navigations-Konfiguration
   * (`getFoundationBreadcrumb`) statt aus einer zweiten, handgepflegten Liste — sonst driftet die
   * Beschriftung in der Meldung von der im Spiel weg, und die Meldung zeigt auf eine Ansicht, die so
   * gar nicht mehr heisst.
   */
  label: string | null;
};

export type BugReportRecord = BugReportInput & {
  reportId: string;
  createdAt: string;
  /** Immer gesetzt — auch wenn niemand angemeldet ist (dann mit Begruendung in `source`). */
  reporter: BugReportReporter;
  /** Immer gesetzt — die Seite ist neben dem Spielstand die zweite Haelfte der Nachstellbarkeit. */
  page: BugReportPage;
  /** Aus dem aktiven Spielstand ergaenzt — das ist der Teil, der die Meldung nachstellbar macht. */
  game: {
    saveId: string | null;
    saveName: string | null;
    /**
     * Woher der Spielstand kam: `"url"` = der, den der Melder offen hatte (belegt);
     * `"active"` = Notnagel ueber den global aktiven Spielstand, weil die URL keinen bekannten
     * `saveId` trug. Ohne diese Angabe laesst sich ein irrefuehrender Kontext nicht von einem
     * belegten unterscheiden.
     */
    saveSource: "url" | "active";
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

/** Ohne Angabe der Route: nicht raten, sondern als unbekannt stehen lassen. */
const UNKNOWN_REPORTER: BugReportReporter = {
  username: null,
  displayName: null,
  ownerId: null,
  source: "not_logged_in",
};

/**
 * Baut aus Pfad und Query die Seite, auf der geklickt wurde.
 *
 * `view` allein reicht nicht: die Ansichten ausserhalb von `/foundation` (Login, Startseite, der
 * Online-Raum) haben gar keinen `?view=`-Parameter — dort war das Feld bisher schlicht `null`, und
 * die Meldung sagte nicht mehr, als dass irgendwo etwas kaputt ist. Der Pfad schliesst diese Luecke.
 *
 * Der Alias-Schritt ueber `normalizeFoundationViewParam` ist noetig, weil dieselbe Ansicht unter
 * mehreren Schreibweisen in der URL steht (`season`, `season-v2`, `seasonV2`). Ohne ihn faende die
 * Nav-Suche das Label nur bei der kanonischen Variante.
 *
 * Fehlt die Ansicht in der Nav-Konfiguration — auf Login, Startseite und Online-Raum gibt es sie dort
 * gar nicht —, tritt der Dokumenttitel ein. Sonst bliebe das Label auf genau den Seiten leer, auf
 * denen der `?view=`-Parameter ebenfalls fehlt, und die Meldung sagte nur noch "irgendwo unter /login".
 */
function resolvePage(input: BugReportInput): BugReportPage {
  const view = input.view?.trim() || null;
  const normalized = normalizeFoundationViewParam(view);
  const breadcrumb = normalized ? getFoundationBreadcrumb(normalized as FoundationViewId) : null;
  return {
    path: input.path?.trim() || null,
    view,
    tab: input.tab?.trim() || null,
    label: breadcrumb ? `${breadcrumb.group} · ${breadcrumb.view}` : input.pageTitle?.trim() || null,
  };
}

/** Der `saveId`-Parameter aus der URL, die der Melder offen hatte. */
function readSaveIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get("saveId")?.trim() || null;
  } catch {
    // Auch ein relativer Pfad soll noch etwas hergeben.
    const match = /[?&]saveId=([^&#]+)/.exec(url);
    return match ? decodeURIComponent(match[1]!) : null;
  }
}

/**
 * Zustand des Spielstands, den der MELDER vor sich hatte. Bewusst tolerant: laeuft die Meldung
 * ausserhalb eines Spiels (Login-Seite, kein Save aktiv), bleibt `game` null — eine Meldung ohne
 * Spielkontext ist immer noch besser als keine.
 *
 * Warum die URL Vorrang hat: die erste Fassung nahm `getActiveSave()`, also den GLOBAL aktiven
 * Spielstand. Das ist bei zwei Spielern auf einer Instanz regelmaessig ein anderer als der, in dem
 * gemeldet wurde. Genau das ist passiert — in zwei der ersten drei echten Meldungen trug die URL
 * `saveId=…8d7mdx`, waehrend der Bericht den Zustand von `…h0z7cl` beschrieb (ein Spielstand, den
 * ein anderer Spieler 10 Minuten zuvor angelegt hatte). Der Bericht beschrieb damit eine andere
 * Partie als die gemeldete: falsche Saison, falscher Spieltag, falsches gefuehrtes Team. Das ist
 * schlimmer als gar kein Kontext, weil es glaubwuerdig aussieht.
 *
 * `saveSource` haelt fest, woher die Zuordnung kam — sonst laesst sich spaeter nicht mehr sagen, ob
 * der Kontext belegt oder nur der beste verfuegbare Notnagel war.
 */
function collectGameContext(url: string | null | undefined): BugReportRecord["game"] {
  try {
    const persistence = createPersistenceService();
    const urlSaveId = readSaveIdFromUrl(url);
    const fromUrl = urlSaveId ? persistence.getSaveById(urlSaveId) : null;
    const active = fromUrl ? null : persistence.getActiveSave();
    if (!fromUrl && !active) return null;

    const saveId = fromUrl ? urlSaveId! : active!.saveId;
    const full = fromUrl ?? persistence.getSaveById(saveId);
    const gameState = full?.gameState ?? null;
    return {
      saveId,
      saveName: (fromUrl ? (full?.name ?? null) : (active!.name ?? null)) ?? null,
      // "url" = der Spielstand, den der Melder offen hatte (belegt).
      // "active" = Notnagel: die URL trug keinen (oder keinen bekannten) saveId.
      saveSource: fromUrl ? "url" : "active",
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
    reporter: input.reporter ?? UNKNOWN_REPORTER,
    page: resolvePage(input),
    game: collectGameContext(input.url),
  };
  fs.mkdirSync(BUG_REPORTS_DIR, { recursive: true });
  const file = path.join(BUG_REPORTS_DIR, `${record.reportId}.json`);
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return { reportId: record.reportId, file, record };
}

/**
 * Signatur ueber die abgelegten Meldungen — die Aenderungserkennung fuer den Auto-Export
 * (`lib/persistence/online-save-auto-export.ts`), der die Meldungen ins Repo mitnimmt.
 *
 * Warum die Meldungen eine EIGENE Signatur brauchen und nicht an der Save-Signatur mitlaufen: der
 * Export-Zyklus bricht ab, wenn sich kein Save bewegt hat, und danach ein zweites Mal, wenn der
 * Save-Export nichts geaendert hat. Eine Meldung von einer Seite, auf der man nicht spielt (Login,
 * Startseite, Online-Raum), haette den Rechner damit nie verlassen — und das ist genau die Lage,
 * in der man meldet.
 *
 * Dateinamen genuegen: eine Meldung wird geschrieben und nie wieder veraendert. Die Vorpruefungen
 * liegen als `.md` im Unterordner `triage/` und zaehlen bewusst NICHT mit — sonst schoebe jede
 * Statusaenderung einen Commit an, ohne dass eine neue Meldung vorliegt.
 */
export function computeBugReportSignature(): string {
  try {
    if (!fs.existsSync(BUG_REPORTS_DIR)) return "";
    return fs
      .readdirSync(BUG_REPORTS_DIR)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .join("|");
  } catch {
    // Eine unlesbare Ablage darf den Auto-Export nicht zum Absturz bringen — er laeuft im Timer.
    return "";
  }
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
