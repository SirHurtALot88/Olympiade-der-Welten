/**
 * GEMELDET VON CHRIS: „und der preseason markt blockiert info zeile sollte doch komplett weg
 * klappbar sein damit die nicht immer im weg rum hängt"
 *
 * Die Statuszeile steht ganz oben über jeder Seite. Eine Meldung, die tagelang stehen bleibt —
 * etwa ein Preseason-Lauf, der nicht alle Teams geschafft hat —, hängt damit dauerhaft im Weg,
 * ohne dass man etwas dagegen tun kann.
 *
 * Zwei Entscheidungen, die diese Datei absichert:
 *
 *  1. Zugeklappt bleibt ein schmaler Knopf stehen statt gar nichts. Ein Hinweis, der spurlos
 *     verschwindet, ist schlimmer als einer, der Platz braucht: man wüsste nicht mehr, dass es
 *     ihn gibt, und käme nicht mehr an ihn heran.
 *  2. Der Zustand überlebt einen Seitenwechsel (localStorage) — sonst wäre die Zeile nach jedem
 *     Klick wieder da und das Wegklappen sinnlos.
 *
 * Geprüft wird am Quelltext, weil diese Suite keinen DOM hat (kein jsdom, keine
 * testing-library — die übrigen UI-Tests hier arbeiten genauso).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/foundation/shell/FoundationActivityStrip.tsx"),
  "utf8",
);

describe("Statuszeile · wegklappbar", () => {
  it("hat einen Schalter zum Einklappen", () => {
    expect(source).toContain('className="foundation-activity-collapse"');
    expect(source).toContain("onClick={() => setCollapsed(true)}");
  });

  it("lässt sich zugeklappt wieder öffnen — der Hinweis verschwindet nicht spurlos", () => {
    expect(source).toContain('className={`foundation-activity-reopen is-${worstTone}`}');
    expect(source).toContain("onClick={() => setCollapsed(false)}");
  });

  it("nennt zugeklappt die Zahl der Meldungen", () => {
    expect(source).toMatch(/activities\.length === 1 \? "1 Meldung" : `\$\{activities\.length\} Meldungen`/);
  });

  it("zeigt zugeklappt die Tönung der auffälligsten Meldung", () => {
    // Ein Blocker muss auch im schmalen Zustand als solcher erkennbar bleiben — sonst klappt
    // man die Zeile weg und übersieht, dass etwas wirklich hakt.
    expect(source).toMatch(/activities\.some\(\(activity\) => activity\.tone === "blocked"\)[\s\S]*"blocked"/);
  });

  it("merkt sich den Zustand über Neuladen hinweg", () => {
    expect(source).toContain('const ACTIVITY_STRIP_COLLAPSED_KEY = "oly-activity-strip-collapsed"');
    expect(source).toContain("window.localStorage.setItem(ACTIVITY_STRIP_COLLAPSED_KEY");
  });

  it("startet mit false und zieht den gespeicherten Wert erst nach dem Mount nach", () => {
    // Server und erster Client-Render müssen dasselbe liefern; ein direkt aus localStorage
    // initialisierter useState-Startwert gäbe einen Hydration-Fehler.
    expect(source).toContain("const [collapsed, setCollapsed] = useState(false)");
    expect(source).toMatch(/useEffect\(\(\) => \{[\s\S]*getItem\(ACTIVITY_STRIP_COLLAPSED_KEY\)/);
  });

  it("überlebt einen gesperrten localStorage", () => {
    // Privater Modus wirft beim Zugriff — ohne try/catch risse das die ganze Leiste mit.
    expect(source).toMatch(/try \{[\s\S]*localStorage[\s\S]*\} catch \{/);
  });
});
