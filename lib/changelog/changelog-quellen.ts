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
  dedupliziereChangelog,
  parseChangelogEintrag,
  sortiereChangelog,
  type ChangelogEintrag,
} from "@/lib/changelog/changelog";

export const CHANGELOG_DIR = path.join(process.cwd(), "data", "changelog");
/**
 * Von Hand gepflegte Eintraege — fuer Aenderungen ohne Bug-Meldung. EINE DATEI PRO EINTRAG.
 *
 * WARUM EIN VERZEICHNIS UND KEINE SAMMELDATEI: vorher haengte jeder PR seinen Eintrag ans Ende
 * desselben JSON-Arrays. Bei einem Dutzend PRs an einem Tag kollidiert damit jeder PR mit jedem
 * anderen, der zeitgleich offen ist — ein rein mechanischer Konflikt ohne inhaltliche Bedeutung,
 * der aber jedes Mal einen Rebase und einen neuen CI-Lauf (~20 Minuten) kostet. Da `main` sich
 * schneller bewegt als die CI laeuft, verlor ein PR dieses Rennen auch mal dreimal
 * hintereinander. Zwei PRs fassen nie dieselbe Datei an, wenn jeder Eintrag seine eigene hat.
 *
 * Dateiname frei waehlbar, sinnvoll ist `<datum>-pr<nummer>.json`. Gelesen wird in
 * Dateinamen-Reihenfolge, damit der Lauf reproduzierbar bleibt.
 */
export const CHANGELOG_EINTRAEGE_DIR = path.join(CHANGELOG_DIR, "eintraege");
/**
 * Die frueher genutzte Sammeldatei. Wird WEITERHIN gelesen, damit ein PR, der noch gegen den alten
 * Stand geschrieben wurde, seinen Eintrag nicht still verliert. Der Generator mahnt, was hier noch
 * liegt — leer soll sie sein, nicht verboten.
 */
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
  /**
   * Wie viele Eintraege noch in der alten Sammeldatei `eintraege.json` lagen. Sie zaehlen normal
   * mit — aber solange dort etwas liegt, kollidieren PRs wieder an derselben Zeile, und genau das
   * soll der Generator sichtbar anmahnen statt es stillschweigend hinzunehmen.
   */
  ausSammeldatei: number;
  /**
   * Eintraege, die es in den Changelog geschafft haben, aber OHNE Gewichtung dastehen — der
   * Reiter zeigt sie als "ohne Einstufung", der Generator mahnt sie an. Eine eigene Liste neben
   * `luecken`, weil dort nur steht, was GANZ fehlt; hier steht, was da ist, aber unsortiert bleibt.
   */
  ohneGewicht: Array<{ kennung: string; grund: string }>;
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

type GepflegteQuelle = { eintraege: ChangelogEintrag[]; verworfen: number; ausSammeldatei: number };

/**
 * Ein Roh-Eintrag → ein geprueftes Ergebnis. Gepflegte Eintraege sind per Definition Quelle
 * "gepflegt", auch wenn jemand etwas anderes hineinschreibt — die Herkunft ist keine Angabe,
 * sondern eine Tatsache.
 */
function nimmGepflegten(roh: unknown, ziel: ChangelogEintrag[]): boolean {
  const geparst = parseChangelogEintrag(roh);
  if (!geparst) return false;
  ziel.push({ ...geparst, quelle: "gepflegt" });
  return true;
}

/** Die neue Quelle: ein Eintrag pro Datei in `data/changelog/eintraege/`. */
function leseEintragsDateien(ziel: ChangelogEintrag[]): number {
  if (!fs.existsSync(CHANGELOG_EINTRAEGE_DIR)) return 0;
  let verworfen = 0;
  const dateien = fs
    .readdirSync(CHANGELOG_EINTRAEGE_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();
  for (const datei of dateien) {
    let roh: unknown;
    try {
      roh = JSON.parse(fs.readFileSync(path.join(CHANGELOG_EINTRAEGE_DIR, datei), "utf8"));
    } catch {
      // Eine kaputte Datei kostet genau ihren eigenen Eintrag, nicht den Lauf — und wird gemeldet.
      verworfen += 1;
      continue;
    }
    // Eine Datei darf auch mehrere Eintraege tragen (Array), muss aber nicht — der Normalfall ist
    // ein einzelnes Objekt. Beides zu erlauben kostet nichts und erspart eine Stolperfalle.
    const kandidaten = Array.isArray(roh) ? roh : [roh];
    for (const kandidat of kandidaten) {
      if (!nimmGepflegten(kandidat, ziel)) verworfen += 1;
    }
  }
  return verworfen;
}

/** Die alte Sammeldatei — bleibt lesbar, damit aeltere Zweige ihren Eintrag nicht verlieren. */
function leseSammeldatei(ziel: ChangelogEintrag[]): { verworfen: number; gelesen: number } {
  if (!fs.existsSync(CHANGELOG_EINTRAEGE_FILE)) return { verworfen: 0, gelesen: 0 };
  let roh: unknown;
  try {
    roh = JSON.parse(fs.readFileSync(CHANGELOG_EINTRAEGE_FILE, "utf8"));
  } catch {
    // Eine kaputte JSON-Datei liefert null Eintraege statt eines Absturzes — der Generator
    // meldet die Verwerfung, damit die Datei repariert wird, statt still zu verschwinden.
    return { verworfen: 1, gelesen: 0 };
  }
  const liste = typeof roh === "object" && roh !== null ? (roh as Record<string, unknown>).eintraege : null;
  if (!Array.isArray(liste)) return { verworfen: 0, gelesen: 0 };
  let verworfen = 0;
  let gelesen = 0;
  for (const eintrag of liste) {
    if (nimmGepflegten(eintrag, ziel)) gelesen += 1;
    else verworfen += 1;
  }
  return { verworfen, gelesen };
}

function leseGepflegteEintraege(): GepflegteQuelle {
  const eintraege: ChangelogEintrag[] = [];
  // Verzeichnis zuerst: bei gleichem Tag und Satz gewinnt in `dedupliziereChangelog` der zuerst
  // gelistete Eintrag — und das soll der aus der neuen Ablage sein, nicht ein Rest aus der alten.
  const verworfenDateien = leseEintragsDateien(eintraege);
  const sammeldatei = leseSammeldatei(eintraege);
  return {
    eintraege,
    verworfen: verworfenDateien + sammeldatei.verworfen,
    ausSammeldatei: sammeldatei.gelesen,
  };
}

/** Sammelt beide Quellen ein und fuehrt sie zusammen — die Kernarbeit des Generators. */
export function sammleChangelog(): ChangelogSammlung {
  const reports = listBugReports(500);
  const eintraege: ChangelogEintrag[] = [];
  const luecken: ChangelogSammlung["luecken"] = [];
  const ohneGewicht: ChangelogSammlung["ohneGewicht"] = [];

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
    if (ergebnis.art === "eintrag") {
      eintraege.push(ergebnis.eintrag);
      if (ergebnis.eintrag.gewicht === null) {
        // Zwei verschiedene Mahnungen, weil zwei verschiedene Handgriffe folgen: eine unlesbare
        // Zeile wird korrigiert, eine fehlende ergaenzt (oder wenigstens `schwere:` gesetzt).
        ohneGewicht.push({
          kennung: reportId,
          grund: triage.gewicht ? "gewicht:-Zeile unlesbar" : "weder gewicht:- noch schwere:-Zeile",
        });
      }
    }
    if (ergebnis.art === "luecke") luecken.push({ reportId, grund: ergebnis.grund });
  }

  const gepflegte = leseGepflegteEintraege();
  eintraege.push(...gepflegte.eintraege);
  for (const eintrag of gepflegte.eintraege) {
    if (eintrag.gewicht === null) {
      ohneGewicht.push({
        kennung: eintrag.pr ?? eintrag.text.slice(0, 60),
        grund: "kein (lesbares) gewicht-Feld im gepflegten Eintrag",
      });
    }
  }

  return {
    // Erst sortieren, dann dedupe: bei gleichem Tag und Satz gewinnt so der zuerst gelistete
    // (Triage vor gepflegt, Dateinamens-Reihenfolge) — deterministisch statt zufaellig.
    eintraege: dedupliziereChangelog(sortiereChangelog(eintraege)),
    luecken,
    verworfeneGepflegte: gepflegte.verworfen,
    ausSammeldatei: gepflegte.ausSammeldatei,
    ohneGewicht,
  };
}
