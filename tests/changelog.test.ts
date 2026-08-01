/**
 * DER CHANGELOG DARF WEDER LUEGEN NOCH ABSTUERZEN.
 *
 * Zwei Fehlerarten sind hier teuer. Die erste: ein Eintrag fuer etwas, das noch gar nicht gemergt
 * ist — der Changelog verspraeche dann Fixes, die es im Spiel nicht gibt, und genau das Vertrauen,
 * fuer das er gebaut wurde, waere weg. Die zweite: ein kaputter Datensatz reisst den Reiter — eine
 * Notiz ohne `changelog:`-Zeile oder ein Tippfehler in `eintraege.json` muss sauber herausfallen,
 * nicht crashen.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  changelogAusTriage,
  gruppiereChangelogNachDatum,
  normalisiereChangelogDatum,
  parseChangelogDatei,
  sortiereChangelog,
  type ChangelogEintrag,
} from "@/lib/changelog/changelog";
import { parseTriage } from "@/lib/bug-report/bug-report-triage";

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({ getActiveSave: () => null, getSaveById: () => null }),
}));

function eintrag(teil: Partial<ChangelogEintrag>): ChangelogEintrag {
  return { datum: "2026-07-30", seite: null, pr: null, text: "x", quelle: "triage", ...teil };
}

describe("changelog:-Zeile im Triage-Kopf", () => {
  it("liest changelog- und seite-Zeile aus dem Kopf", () => {
    const parsed = parseTriage(
      "bug-1",
      "status: gebaut\ntitel: T\nchangelog: Vorher kaputt, jetzt heil.\nseite: Spieltag · Inbox\n\nBefund.",
      "bug-1.md",
    );
    expect(parsed.changelog).toBe("Vorher kaputt, jetzt heil.");
    expect(parsed.seite).toBe("Spieltag · Inbox");
    // Die neuen Kopfzeilen gehoeren zum Kopf, nicht zum Fliesstext.
    expect(parsed.body).toBe("Befund.");
  });

  it("eine Notiz ohne changelog:-Zeile bleibt vollstaendig lesbar", () => {
    const parsed = parseTriage("bug-2", "status: gebaut\ntitel: T\n\nBefund.", "bug-2.md");
    expect(parsed.changelog).toBeNull();
    expect(parsed.seite).toBeNull();
    expect(parsed.status).toBe("gebaut");
  });
});

describe("changelogAusTriage — nur Gemergtes erscheint", () => {
  const basis = parseTriage(
    "bug-3",
    "status: gebaut\ntitel: T\npr: #273\ngemergt: 2026-07-30\nchangelog: Jetzt anders.\n\nBefund.",
    "bug-3.md",
  );

  it("gebaut mit changelog-Zeile und Datum wird zum Eintrag", () => {
    const ergebnis = changelogAusTriage(basis, "Markt · Transfermarkt");
    expect(ergebnis).toEqual({
      art: "eintrag",
      eintrag: {
        datum: "2026-07-30",
        seite: "Markt · Transfermarkt",
        pr: "#273",
        text: "Jetzt anders.",
        quelle: "triage",
        // Fixes innerhalb einer Version tragen KEINE Versionsnummer — die vergibt der
        // gepflegte Eintrag des jeweiligen grossen Umbaus. Stuende hier ueberall eine,
        // sagte sie nichts mehr aus.
        version: null,
      },
    });
  });

  /** DER KERN: was nicht gemergt ist, hat im Changelog nichts verloren. */
  it("vorgeprueft erscheint nicht — auch mit changelog-Zeile", () => {
    const vorgeprueft = { ...basis, status: "vorgeprueft" as const };
    expect(changelogAusTriage(vorgeprueft, null)).toEqual({ art: "kein-eintrag" });
  });

  it("abgelehnt erscheint nicht", () => {
    const abgelehnt = { ...basis, status: "abgelehnt" as const };
    expect(changelogAusTriage(abgelehnt, null)).toEqual({ art: "kein-eintrag" });
  });

  it("gebaut OHNE changelog-Zeile ist eine Luecke, kein stiller Ausfall", () => {
    const ohneZeile = { ...basis, changelog: null };
    expect(changelogAusTriage(ohneZeile, null)).toEqual({ art: "luecke", grund: "keine changelog:-Zeile" });
  });

  it("gebaut ohne lesbares gemergt-Datum ist eine Luecke", () => {
    const ohneDatum = { ...basis, gemergt: "irgendwann" };
    expect(changelogAusTriage(ohneDatum, null)).toEqual({
      art: "luecke",
      grund: "kein lesbares gemergt:-Datum",
    });
  });

  it("ohne Rohmeldung traegt die seite:-Zeile der Notiz den Ort", () => {
    const mitSeite = { ...basis, seite: "Spieltag · Einsatzliste" };
    const ergebnis = changelogAusTriage(mitSeite, null);
    expect(ergebnis.art).toBe("eintrag");
    if (ergebnis.art === "eintrag") expect(ergebnis.eintrag.seite).toBe("Spieltag · Einsatzliste");
  });
});

describe("Datum, Sortierung, Gruppierung", () => {
  it("versteht ISO- und deutsches Datum, aber raet nicht", () => {
    expect(normalisiereChangelogDatum("2026-07-30")).toBe("2026-07-30");
    expect(normalisiereChangelogDatum("2026-07-30, squash auf main")).toBe("2026-07-30");
    expect(normalisiereChangelogDatum("30.07.2026")).toBe("2026-07-30");
    expect(normalisiereChangelogDatum("3.7.2026")).toBe("2026-07-03");
    expect(normalisiereChangelogDatum("bald")).toBeNull();
    expect(normalisiereChangelogDatum("2026-13-40")).toBeNull();
    expect(normalisiereChangelogDatum(null)).toBeNull();
  });

  it("sortiert neueste zuerst und laesst die Reihenfolge innerhalb eines Tages stehen", () => {
    const sortiert = sortiereChangelog([
      eintrag({ datum: "2026-07-30", text: "a" }),
      eintrag({ datum: "2026-08-01", text: "b" }),
      eintrag({ datum: "2026-07-30", text: "c" }),
    ]);
    expect(sortiert.map((e) => e.text)).toEqual(["b", "a", "c"]);
  });

  it("gruppiert sortierte Eintraege nach Tag", () => {
    const gruppen = gruppiereChangelogNachDatum([
      eintrag({ datum: "2026-08-01", text: "b" }),
      eintrag({ datum: "2026-07-30", text: "a" }),
      eintrag({ datum: "2026-07-30", text: "c" }),
    ]);
    expect(gruppen.map((g) => g.datum)).toEqual(["2026-08-01", "2026-07-30"]);
    expect(gruppen[1].eintraege.map((e) => e.text)).toEqual(["a", "c"]);
  });
});

describe("parseChangelogDatei — der Reiter darf an Datenmuell nicht scheitern", () => {
  it("laesst kaputte Eintraege herausfallen statt zu crashen", () => {
    const eintraege = parseChangelogDatei({
      hinweis: "GENERIERT",
      eintraege: [
        { datum: "2026-07-30", text: "gueltig", seite: "Welt · Sponsoren", pr: "#268" },
        { datum: "kein datum", text: "faellt raus" },
        { datum: "2026-07-30" }, // kein Text
        "kein Objekt",
        null,
      ],
    });
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0].text).toBe("gueltig");
  });

  it("gibt bei voellig fremdem Inhalt eine leere Liste zurueck", () => {
    expect(parseChangelogDatei(null)).toEqual([]);
    expect(parseChangelogDatei("quatsch")).toEqual([]);
    expect(parseChangelogDatei({ eintraege: "keine liste" })).toEqual([]);
  });
});

describe("sammleChangelog — beide Quellen, ein Ergebnis", () => {
  let workdir = "";
  let cwdSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    // Die Module oben sind mit dem ECHTEN cwd geladen — ohne Reset saehe sammleChangelog die
    // richtigen Repo-Daten statt des Test-Verzeichnisses.
    vi.resetModules();
    workdir = fs.mkdtempSync(path.join(os.tmpdir(), "changelog-test-"));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(workdir);
  });

  afterEach(() => {
    cwdSpy?.mockRestore();
    fs.rmSync(workdir, { recursive: true, force: true });
    vi.resetModules();
  });

  /** Die Ablageorte werden beim Import aus process.cwd() gebildet → nach dem Spy neu laden. */
  async function importModules() {
    const service = await import("@/lib/bug-report/bug-report-service");
    const triage = await import("@/lib/bug-report/bug-report-triage");
    const quellen = await import("@/lib/changelog/changelog-quellen");
    return { ...service, ...triage, ...quellen };
  }

  it("fuehrt Triage-Eintraege und gepflegte Eintraege sortiert zusammen", async () => {
    const { saveBugReport, writeTriage, sammleChangelog, CHANGELOG_DIR, CHANGELOG_EINTRAEGE_FILE } =
      await importModules();

    // Quelle 1: eine gemergte Meldung — die Seite kommt aus der Rohmeldung, nicht aus der Notiz.
    const gemeldet = saveBugReport({ note: "Cash bleibt stehen", view: "marketV2" });
    writeTriage({
      reportId: gemeldet.reportId,
      status: "gebaut",
      titel: "Cash-Anzeige",
      pr: "#273",
      gemergt: "2026-07-30",
      changelog: "Der Kontostand aktualisiert sich jetzt sofort.",
      body: "Befund.",
    });

    // Eine noch nicht gemergte Meldung darf NICHT erscheinen — auch nicht mit changelog-Zeile.
    const offen = saveBugReport({ note: "noch offen" });
    writeTriage({
      reportId: offen.reportId,
      status: "vorgeprueft",
      titel: "Offen",
      changelog: "Sollte nirgends auftauchen.",
      body: "Befund.",
    });

    // Quelle 2: ein gepflegter Eintrag ohne Bug-Meldung (Feature) — plus ein kaputter, der
    // herausfallen muss, ohne den Lauf zu reissen.
    fs.mkdirSync(CHANGELOG_DIR, { recursive: true });
    fs.writeFileSync(
      CHANGELOG_EINTRAEGE_FILE,
      JSON.stringify({
        eintraege: [
          { datum: "2026-08-01", seite: "Welt · Lexikon", pr: "#300", text: "Neues Kapitel im Lexikon." },
          { datum: "ohne datum", text: "kaputt" },
        ],
      }),
      "utf8",
    );

    const sammlung = sammleChangelog();
    expect(sammlung.eintraege.map((e) => e.text)).toEqual([
      "Neues Kapitel im Lexikon.",
      "Der Kontostand aktualisiert sich jetzt sofort.",
    ]);
    expect(sammlung.eintraege[0].quelle).toBe("gepflegt");
    expect(sammlung.eintraege[1].seite).toBe("Markt · Transfermarkt");
    expect(sammlung.verworfeneGepflegte).toBe(1);
    // Die vorgepruefte Meldung ist weder Eintrag noch Luecke — an ihr fehlt nichts.
    expect(sammlung.luecken).toEqual([]);
  });

  it("meldet einen gemergten Fix ohne changelog-Zeile als Luecke", async () => {
    const { saveBugReport, writeTriage, sammleChangelog } = await importModules();
    const gemeldet = saveBugReport({ note: "gefixt, aber unsichtbar" });
    writeTriage({
      reportId: gemeldet.reportId,
      status: "gebaut",
      titel: "Ohne Changelog",
      pr: "#280",
      body: "Befund.",
    });

    const sammlung = sammleChangelog();
    expect(sammlung.eintraege).toEqual([]);
    expect(sammlung.luecken).toEqual([{ reportId: gemeldet.reportId, grund: "keine changelog:-Zeile" }]);
  });

  it("laeuft ohne Triage-Ablage und ohne eintraege.json sauber leer durch", async () => {
    const { sammleChangelog } = await importModules();
    const sammlung = sammleChangelog();
    expect(sammlung.eintraege).toEqual([]);
    expect(sammlung.luecken).toEqual([]);
    expect(sammlung.verworfeneGepflegte).toBe(0);
  });
});
