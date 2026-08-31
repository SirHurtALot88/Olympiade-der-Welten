/**
 * GEMELDET (Chris, `ihcjoz`, Seite „Spieltag · Battle Arena", 25.08.): „die tooltips im end
 * screen von Schaden Erlitten und IMP funktionieren nicht man soll sehen wie es sich zusammen
 * setzt". Ein frueherer Lauf (PR #675) fand dazu „kein Bug im Quelltext auffindbar, nicht auf
 * Verdacht gefixt" — das war eine reine Quelltext-Lektuere, keine Laufzeit-Reproduktion.
 *
 * IM BROWSER NACHGESTELLT (Playwright, echter Maus-Hover, TDM bis zum Endscreen durchgespielt):
 * die Zelle liefert beim Hover korrekt Titel UND Aufschluesselung — `tipOn`/`impZerlegung`
 * bauen nicht-leeren Text, `gegenZaehler` traegt die Adresse korrekt ein (wie schon in #675 fuer
 * die Heilung belegt). Der Bug liegt NICHT in den Daten, sondern in der Platzierung der
 * Tooltip-Box selbst:
 *
 * URSACHE, belegt in `public/mockups/battle-mode.engine.js`: `tipBox` haengte bisher an
 * `document.body`. Saemtliche Regeln in `battle-mode.css` stehen aber unter dem Selektor
 * `.oly-battle-arena .tipbox` (dieselbe Kapselung wie ueberall in dieser Datei — siehe den
 * FARBWURZEL-Befund fuer die Canvas-Farben ein paar hundert Zeilen weiter unten in derselben
 * Datei, identisches Muster). Ein Kind von `document.body` ist dort NIE ein Nachfahre von
 * `.oly-battle-arena`:
 *   - standalone haengt das `<script>` HINTER, nicht IN, das `.oly-battle-arena`-Div (siehe
 *     `public/mockups/battle-mode.html`);
 *   - eingebettet haengt `FoundationBattleArenaHost.tsx` das `<script>` als GESCHWISTER von
 *     `.oly-battle-arena` ein (`container.innerHTML = huelle.markup; ... container.appendChild(script)`),
 *     ebenfalls nicht als Kind.
 * Die Box blieb dadurch komplett unstyled (`position:static` statt `absolute`, kein
 * Hintergrund, keine Farbe) und landete unsichtbar ganz unten im Seitenfluss — nachgemessen per
 * Playwright: `getComputedStyle(tipBox).position` war `"static"`, `getBoundingClientRect()` lag
 * weit ausserhalb des Viewports. Die gesetzten `style.top`/`style.left` blieben dabei
 * wirkungslos, weil sie ohne `position:absolute` nichts bewirken — exakt das Bild, das Chris als
 * „funktioniert nicht" beschreibt: der Hover loest aus, aber es erscheint nichts sichtbares.
 *
 * FIX: `tipBox` haengt jetzt am naechsten `.oly-battle-arena`-Vorfahren (`TIPWURZEL`), mit
 * `document.body` als Rueckfall, falls die Klasse einmal fehlen sollte — exakt dasselbe Muster
 * wie beim FARBWURZEL-Fix (`cv.closest(".oly-battle-arena")||document.body`).
 *
 * GEGENPROBE: mit der alten Fassung (`document.body.appendChild(tipBox)`) waere `isDescendant`
 * unten `false` und `position` `"static"` — per Playwright vor dem Fix tatsaechlich beobachtet
 * (Screenshot: die Aufschluesselung erscheint unstyled ganz am Seitenende statt als Box am
 * Mauszeiger).
 *
 * WARUM DIESE DATEI KEIN GEWOEHNLICHER IMPORT-TEST IST. `battle-mode.engine.js` ist ein
 * einziges grosses IIFE fuer den Browser (kein ES-Modul, ~12700 Zeilen), das beim Laden sofort
 * auf `document` zugreift. Dieser Test liest den ECHTEN Quelltext der betroffenen Zeilen aus
 * der Datei und fuehrt ihn gegen ein minimales Fake-DOM aus, statt die Logik nachzubauen — eine
 * Nachbildung wuerde nur beweisen, dass MEINE Kopie stimmt, nicht die im Spiel ausgelieferte.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const QUELLTEXT = readFileSync(join(process.cwd(), "public/mockups/battle-mode.engine.js"), "utf8");

/** Minimales Fake-DOM-Element: nur was TIPWURZEL/tipBox-Setup wirklich braucht. */
type FakeNode = {
  tagName: string;
  className: string;
  hidden: boolean;
  parentElement: FakeNode | null;
  children: FakeNode[];
  style: Record<string, string>;
  appendChild(child: FakeNode): void;
};
function fakeNode(tag: string): FakeNode {
  return {
    tagName: tag,
    className: "",
    hidden: false,
    parentElement: null,
    children: [],
    style: {},
    appendChild(child: FakeNode) {
      this.children.push(child);
      child.parentElement = this;
    },
  };
}

/**
 * Schneidet die TIPWURZEL/tipBox-Verdrahtung aus dem echten Quelltext und fuehrt sie gegen ein
 * Fake-`document` aus. `document.querySelector` und `document.createElement` sind die einzigen
 * DOM-APIs, die dieser Ausschnitt benutzt.
 */
function fuehreTipboxSetupAus(arenaVorhanden: boolean): { tipBox: FakeNode; tipwurzel: FakeNode } {
  const startAnker = "const TIPWURZEL=document.querySelector(\".oly-battle-arena\")||document.body;";
  const start = QUELLTEXT.indexOf(startAnker);
  expect(start, "TIPWURZEL-Zeile nicht in battle-mode.engine.js gefunden").toBeGreaterThan(-1);
  const endAnker = "TIPWURZEL.appendChild(tipBox);";
  const endIdx = QUELLTEXT.indexOf(endAnker, start);
  expect(endIdx, "TIPWURZEL.appendChild(tipBox) nicht gefunden").toBeGreaterThan(-1);
  const quelle = QUELLTEXT.slice(start, endIdx + endAnker.length);

  const body = fakeNode("BODY");
  const arena = arenaVorhanden ? fakeNode("DIV") : null;
  if (arena) arena.className = "oly-battle-arena";
  const fakeDocument = {
    querySelector: (sel: string) => (sel === ".oly-battle-arena" ? arena : null),
    createElement: (tag: string) => fakeNode(tag),
    body,
  };

  // eslint-disable-next-line no-new-func -- bewusst: fuehrt den ECHTEN Quelltext aus, siehe Kopfkommentar.
  const laeufer = new Function("document", `"use strict"; ${quelle}\nreturn { tipBox, tipwurzel: TIPWURZEL };`);
  return laeufer(fakeDocument);
}

describe("Battle Arena · Endscreen-Tooltip (ERL/IMP) haengt in seiner eigenen CSS-Kapsel", () => {
  it("haengt die Tooltip-Box an .oly-battle-arena, nicht an document.body", () => {
    const { tipBox, tipwurzel } = fuehreTipboxSetupAus(true);
    expect(tipwurzel.className).toBe("oly-battle-arena");
    expect(tipBox.parentElement).toBe(tipwurzel);
    expect(tipBox.className).toBe("tipbox");
    // Die Regel `.oly-battle-arena.oly-battle-arena .tipbox{...}` in battle-mode.css matcht nur
    // Nachfahren von `.oly-battle-arena` — mit diesem Elternteil greift sie jetzt.
    expect(tipwurzel.children).toContain(tipBox);
  });

  it("faellt auf document.body zurueck, wenn .oly-battle-arena einmal fehlt (kein Verhalten wird schlechter)", () => {
    const { tipBox, tipwurzel } = fuehreTipboxSetupAus(false);
    expect(tipwurzel.tagName).toBe("BODY");
    expect(tipBox.parentElement).toBe(tipwurzel);
  });

  it("beginnt hidden, wie vor dem Fix", () => {
    const { tipBox } = fuehreTipboxSetupAus(true);
    expect(tipBox.hidden).toBe(true);
  });

  it("dieselbe Kapselungs-Regel wie beim Canvas-Farb-Fix (FARBWURZEL) — kein Einzelfall", () => {
    // Gegenprobe, dass der Fix konsistent mit dem einzigen anderen Vorkommen dieses Musters in
    // der Datei ist, statt eine eigene, abweichende Loesung zu erfinden.
    expect(QUELLTEXT).toContain('const FARBWURZEL=cv.closest(".oly-battle-arena")||document.body;');
  });
});
