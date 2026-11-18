import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

// Chris 18.11.: „Wenn ich links in die Navigation reinhover, verschieben sich alle Icons — das darf nicht passieren!“
// Die pixelgenaue Messung macht `scripts/messe-schiene-hover.mjs` (Browser). Dieser Vertrag hält die Bauweise fest,
// aus der die Stabilität folgt: der Kopfblock liegt UNTER den Icons, und das Ausklappen ändert kein Maß darüber.
describe("Icon-Schiene: Ausklappen verschiebt keine Icons", () => {
  it("rendert Spielstände / Oly Manager / Team-Wahl als Menü am Wappen, nicht im Fluss über den Icons", async () => {
    const tsx = await fs.readFile(path.join(root, "app/foundation/shell/FoundationSidebar.tsx"), "utf8");
    const css = await fs.readFile(path.join(root, "components/foundation/broadcast/rahmen.css"), "utf8");
    const kopf = tsx.indexOf('className="foundation-rail-head"');
    const gruppen = tsx.indexOf("{navGroups.map(");
    expect(kopf).toBeGreaterThan(-1);
    expect(kopf).toBeLessThan(gruppen);
    // Nur die breite Seitenleiste (ohne Schiene) zeigt den Block weiterhin oben im Fluss.
    expect(tsx).toContain("{!rail ? brandBlock : null}");
    expect(tsx.slice(kopf, tsx.indexOf('className="foundation-rail-menue"'))).not.toContain("foundation-sidebar-brand");
    // Das Menü nimmt keine Höhe ein: absolut, nur nach Klick auf das Wappen.
    expect(css).toMatch(/\.foundation-rail-menue\[data-offen="1"\] \{\s*display: grid;\s*position: absolute;/);
    expect(css).toMatch(/\.foundation-rail-menue \{\s*display: none;/);
  });

  it("hält Innenabstand, Kopfhöhe, Zeilenhöhe und Gruppenabstand in allen Schienen-Zuständen gleich", async () => {
    const css = await fs.readFile(path.join(root, "components/foundation/broadcast/rahmen.css"), "utf8");
    const block = css.slice(css.indexOf("Ausklappen verschiebt NICHTS"));
    // Ein Selektor für ALLE Zustände ([data-rail] ohne Wert), kein getrenntes Maß für open/pinned.
    expect(block).toMatch(/\.foundation-sidebar\[data-rail\] \{\s*padding: 10px 9px;/);
    expect(block).toMatch(/\.foundation-rail-head \{[^}]*grid-template-rows: 44px 34px;/);
    expect(block).toMatch(/\[data-rail\] \.foundation-sidebar-group-label \{\s*display: none;/);
    expect(block).toMatch(/\[data-rail\] \.foundation-sidebar-item \{[^}]*height: 40px;/);
    expect(block).toMatch(/\[data-rail\] \.foundation-sidebar-group \+ \.foundation-sidebar-group \{\s*margin-top: 4px;/);
    // Der Ziehgriff schiebt das Icon im ausgeklappten Zustand nicht nach rechts.
    expect(block).toMatch(/\[data-rail="open"\] \.foundation-sidebar-drag-handle,[^{]*\{\s*position: absolute;/);
    // Kein Scrollbalken-Streifen, der die Breite (und damit die Beschriftung) verändert.
    expect(block).toContain("scrollbar-gutter: auto");
  });
});
