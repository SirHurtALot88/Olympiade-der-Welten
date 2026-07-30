/**
 * DAS TICKETSYSTEM MUSS VERLAESSLICHER SEIN ALS DAS GEDAECHTNIS DES AGENTEN.
 *
 * Zwei Zusicherungen tragen das ganze System:
 *
 * 1. EINE NUMMER BLEIBT. Wer "Nr. 3" sagt, meint naechste Woche noch dieselbe Meldung. Naheliegend
 *    waere gewesen, nach Datum durchzunummerieren — das bricht beim ersten Nachzuegler, und aus
 *    "Nr. 3" wird stillschweigend etwas anderes.
 * 2. "ERLEDIGT" MUSS MAN SICH VERDIENEN. Ein Fix galt bereits einmal als behoben und wirkte nicht
 *    (der angestossene Reload wurde von einem Zwischenspeicher verschluckt). Eine Tabelle, die in so
 *    einem Fall "erledigt" sagt, nimmt die Meldung aus dem Blick, waehrend der Fehler weiterlaeuft.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({ getActiveSave: () => null, getSaveById: () => null }),
}));

let workdir = "";
let cwdSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), "bug-tickets-test-"));
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(workdir);
});

afterEach(() => {
  cwdSpy?.mockRestore();
  fs.rmSync(workdir, { recursive: true, force: true });
  vi.resetModules();
});

async function importModules() {
  const service = await import("@/lib/bug-report/bug-report-service");
  const tickets = await import("@/lib/bug-report/bug-report-tickets");
  const triage = await import("@/lib/bug-report/bug-report-triage");
  return { ...service, ...tickets, ...triage };
}

describe("Ticket-Nummern — einmal vergeben, nie verschoben", () => {
  it("vergibt nach Eingang und faengt bei 1 an", async () => {
    const { assignTicketNumbers } = await importModules();
    const { registry } = assignTicketNumbers({}, [
      { reportId: "bug-b", createdAt: "2026-07-30T14:24:00Z" },
      { reportId: "bug-a", createdAt: "2026-07-30T14:10:00Z" },
    ]);
    expect(registry).toEqual({ "1": "bug-a", "2": "bug-b" });
  });

  /**
   * DER KERN. Eine aeltere Meldung taucht NACHTRAEGLICH auf — der Spiegel-Branch wird per
   * Force-Push ueberschrieben, und lokal gespielte Meldungen koennen spaeter nachcommittet werden.
   * Wuerde neu nach Datum sortiert, bekaeme sie die 1 und schoebe alles weitere um eins. Jede Notiz
   * und jedes Gespraech, das sich auf eine Nummer bezog, zeigte danach ins Leere.
   */
  it("ein Nachzuegler bekommt die naechste freie Nummer, nicht die chronologisch richtige", async () => {
    const { assignTicketNumbers } = await importModules();
    const bestehend = { "1": "bug-b", "2": "bug-c" };
    const { registry, assigned } = assignTicketNumbers(bestehend, [
      { reportId: "bug-b", createdAt: "2026-07-30T14:24:00Z" },
      { reportId: "bug-c", createdAt: "2026-07-30T14:31:00Z" },
      // Aelter als beide — und bekommt trotzdem die 3.
      { reportId: "bug-a", createdAt: "2026-07-30T09:00:00Z" },
    ]);
    expect(registry["1"]).toBe("bug-b");
    expect(registry["2"]).toBe("bug-c");
    expect(registry["3"]).toBe("bug-a");
    expect(assigned).toEqual([{ nummer: 3, reportId: "bug-a" }]);
  });

  it("ein zweiter Lauf ueber denselben Meldungen vergibt nichts neu", async () => {
    const { assignTicketNumbers } = await importModules();
    const first = assignTicketNumbers({}, [{ reportId: "bug-a", createdAt: "2026-07-30T14:10:00Z" }]);
    const second = assignTicketNumbers(first.registry, [{ reportId: "bug-a", createdAt: "2026-07-30T14:10:00Z" }]);
    expect(second.assigned).toEqual([]);
    expect(second.registry).toEqual(first.registry);
  });

  /** Ein von Hand kaputt editierter Eintrag darf nicht das ganze Register kippen. */
  it("liest ein teilweise kaputtes Register tolerant", async () => {
    const { BUG_TICKETS_FILE, readTicketRegistry, BUG_REPORTS_DIR } = await importModules();
    fs.mkdirSync(BUG_REPORTS_DIR, { recursive: true });
    fs.writeFileSync(BUG_TICKETS_FILE, JSON.stringify({ "1": "bug-a", zwei: "bug-b", "3": null }), "utf8");
    expect(readTicketRegistry()).toEqual({ "1": "bug-a" });
  });
});

/**
 * DER FEHLER, DEN ICH MIR BEIM BAUEN SELBST EINGEBAUT HABE.
 *
 * Das Register `tickets.json` liegt im selben Ordner wie die Meldungen. Der Filter stand auf
 * `.json`, also las die Liste das Register als Meldung mit — und der Generator vergab prompt eine
 * Ticket-Nummer an `undefined`. Aufgefallen ist es nur, weil der erste Lauf "Neue Nummer 7 →
 * undefined" ausgab.
 */
describe("Die Meldungsliste liest nur Meldungen", () => {
  it("uebergeht das Nummern-Register im selben Ordner", async () => {
    const { saveBugReport, listBugReports, writeTicketRegistry } = await importModules();
    saveBugReport({ note: "echte Meldung" });
    writeTicketRegistry({ "1": "bug-irgendwas" });
    const listed = listBugReports(50);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.note).toBe("echte Meldung");
  });
});

describe("Status — 'erledigt' muss belegt sein", () => {
  /**
   * DER RIEGEL. Ohne `bestaetigt:` faellt `erledigt` auf `gebaut` zurueck. Sonst genuegte ein
   * Merge, damit eine Meldung aus der Uebersicht verschwindet — auch wenn der Fix nichts bewirkt.
   */
  it("stuft 'erledigt' ohne Beleg auf 'gebaut' zurueck", async () => {
    const { parseTriage } = await importModules();
    const ohne = parseTriage("bug-a", "status: erledigt\ntitel: X\n\nText.", "x.md");
    expect(ohne.status).toBe("gebaut");

    const mit = parseTriage("bug-a", "status: erledigt\ntitel: X\nbestaetigt: Franky, live 31.07.\n\nText.", "x.md");
    expect(mit.status).toBe("erledigt");
    expect(mit.bestaetigt).toBe("Franky, live 31.07.");
  });

  it("liest die neuen Ergebnisfelder", async () => {
    const { parseTriage } = await importModules();
    const parsed = parseTriage(
      "bug-a",
      "status: gebaut\ntitel: X\nergebnis: Cache entwertet\npr: #264\ncommit: abc1234\ngemergt: 30.07.\n\nBefund.",
      "x.md",
    );
    expect(parsed.ergebnis).toBe("Cache entwertet");
    expect(parsed.pr).toBe("#264");
    expect(parsed.commit).toBe("abc1234");
    expect(parsed.gemergt).toBe("30.07.");
    // Der Kopf darf nicht im Fliesstext landen — sonst steht er in der Tabelle doppelt.
    expect(parsed.body).toBe("Befund.");
  });

  /** Die Luecken sind der Grund, warum die Tabelle abgeleitet ist: man SIEHT sie. */
  it("benennt fehlende Angaben, statt sie zu verschweigen", async () => {
    const { parseTriage, findTriageGaps } = await importModules();
    const gebautOhneAlles = parseTriage("bug-a", "status: gebaut\ntitel: X\n\nText.", "x.md");
    expect(findTriageGaps(gebautOhneAlles)).toEqual([
      "kein PR angegeben",
      "kein Ergebnis angegeben",
      "Wirkung nicht bestaetigt",
    ]);

    const vollstaendig = parseTriage(
      "bug-a",
      "status: erledigt\ntitel: X\nergebnis: gefixt\npr: #1\nbestaetigt: live geprueft\n\nText.",
      "x.md",
    );
    expect(findTriageGaps(vollstaendig)).toEqual([]);
  });

  it("ein abgelehntes Ticket braucht eine Begruendung", async () => {
    const { parseTriage, findTriageGaps } = await importModules();
    const parsed = parseTriage("bug-a", "status: abgelehnt\ntitel: X\n\nText.", "x.md");
    expect(findTriageGaps(parsed)).toContain("kein Ergebnis angegeben");
  });
});
