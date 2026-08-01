/**
 * DAS EINSAMMELN DER CHANGELOG-QUELLEN — der Dateisystem-Teil, getrennt von `changelog.ts`,
 * damit der Spiel-Reiter die reine Logik importieren kann, ohne `node:fs` mitzuschleppen.
 *
 * Benutzt vom Generator (`npm run changelog:bauen`) und von den Tests. Die Luecken werden
 * mitgeliefert statt verschluckt: ein gemergter Fix ohne brauchbaren Eintrag soll im
 * Generator-Lauf SICHTBAR fehlen — genau wie bei `npm run bugs:tabelle`.
 */
import fs from "node:fs";
import path from "node:path";

import { listBugReports } from "@/lib/bug-report/bug-report-service";
import { BUG_TRIAGE_DIR, parseTriage } from "@/lib/bug-report/bug-report-triage";
import {
  changelogAusTriage,
  parseChangelogEintrag,
  sortiereChangelog,
  type ChangelogEintrag,
} from "@/lib/changelog/changelog";

export const CHANGELOG_DIR = path.join(process.cwd(), "data", "changelog");
/** Von Hand gepflegte Eintraege — fuer Aenderungen ohne Bug-Meldung. */
export const CHANGELOG_EINTRAEGE_FILE = path.join(CHANGELOG_DIR, "eintraege.json");
/** Die generierte Datei, die der Reiter im Spiel liest. */
export const CHANGELOG_GENERATED_FILE = path.join(CHANGELOG_DIR, "CHANGELOG.json");

export type ChangelogSammlung = {
  /** Fertig sortiert, neueste zuerst. */
  eintraege: ChangelogEintrag[];
  /** Notizen auf `gebaut`/`erledigt`, aus denen KEIN Eintrag wurde — die mahnt der Generator an. */
  luecken: Array<{ reportId: string; grund: string }>;
  /** Gepflegte Eintraege, die beim Lesen herausgefallen sind (Datum oder Text unbrauchbar). */
  verworfeneGepflegte: number;
};

/**
 * Die Seite kommt aus der Rohmeldung, nicht aus der Notiz — die Rohmeldung haelt fest, wo der
 * Melder wirklich stand. Gleiche Rangfolge wie in `scripts/bug-reports-table.ts` (`formatWo`).
 */
function seiteAusRohmeldung(reportId: string, reports: ReturnType<typeof listBugReports>): string | null {
  const report = reports.find((kandidat) => kandidat.reportId === reportId);
  if (!report) return null;
  return report.page?.label ?? report.page?.view ?? report.view ?? null;
}

function leseGepflegteEintraege(): { eintraege: ChangelogEintrag[]; verworfen: number } {
  if (!fs.existsSync(CHANGELOG_EINTRAEGE_FILE)) return { eintraege: [], verworfen: 0 };
  let roh: unknown;
  try {
    roh = JSON.parse(fs.readFileSync(CHANGELOG_EINTRAEGE_FILE, "utf8"));
  } catch {
    // Eine kaputte JSON-Datei liefert null Eintraege statt eines Absturzes — der Generator
    // meldet die Verwerfung, damit die Datei repariert wird, statt still zu verschwinden.
    return { eintraege: [], verworfen: 1 };
  }
  const liste = typeof roh === "object" && roh !== null ? (roh as Record<string, unknown>).eintraege : null;
  if (!Array.isArray(liste)) return { eintraege: [], verworfen: 0 };
  const eintraege: ChangelogEintrag[] = [];
  let verworfen = 0;
  for (const eintrag of liste) {
    const geparst = parseChangelogEintrag(eintrag);
    if (geparst) {
      // Gepflegte Eintraege sind per Definition Quelle "gepflegt", auch wenn jemand in die
      // Datei etwas anderes schreibt — die Herkunft ist keine Angabe, sondern eine Tatsache.
      eintraege.push({ ...geparst, quelle: "gepflegt" });
    } else {
      verworfen += 1;
    }
  }
  return { eintraege, verworfen };
}

/** Sammelt beide Quellen ein und fuehrt sie zusammen — die Kernarbeit des Generators. */
export function sammleChangelog(): ChangelogSammlung {
  const reports = listBugReports(500);
  const eintraege: ChangelogEintrag[] = [];
  const luecken: ChangelogSammlung["luecken"] = [];

  // Direkt ueber die Triage-Ablage statt ueber die Rohmeldungen: es gibt Notizen ohne Rohmeldung
  // (Zuruf im Gespraech statt Flagge), und deren Fixes gehoeren genauso in den Changelog.
  const triageDateien = fs.existsSync(BUG_TRIAGE_DIR)
    ? fs
        .readdirSync(BUG_TRIAGE_DIR)
        .filter((name) => name.endsWith(".md"))
        .sort()
    : [];

  for (const datei of triageDateien) {
    const reportId = datei.replace(/\.md$/, "");
    let triage;
    try {
      triage = parseTriage(reportId, fs.readFileSync(path.join(BUG_TRIAGE_DIR, datei), "utf8"), datei);
    } catch {
      // Eine unlesbare Notiz darf den Lauf nicht reissen — aber sie ist eine Luecke, kein Rauschen.
      luecken.push({ reportId, grund: "Notiz nicht lesbar" });
      continue;
    }
    const ergebnis = changelogAusTriage(triage, seiteAusRohmeldung(reportId, reports));
    if (ergebnis.art === "eintrag") eintraege.push(ergebnis.eintrag);
    if (ergebnis.art === "luecke") luecken.push({ reportId, grund: ergebnis.grund });
  }

  const gepflegte = leseGepflegteEintraege();
  eintraege.push(...gepflegte.eintraege);

  return {
    eintraege: sortiereChangelog(eintraege),
    luecken,
    verworfeneGepflegte: gepflegte.verworfen,
  };
}
