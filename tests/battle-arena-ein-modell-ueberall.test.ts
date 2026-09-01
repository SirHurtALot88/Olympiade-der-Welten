/**
 * GEFORDERT (Chris, 01.09.): „Sorge dafür, dass die Vorschau der Charaktere überall gleich
 * ist — im Preview der Diszi, Einsatzliste, Arena, und unter der Battle Arena wo ich drauf
 * gucken kann. Das muss ÜBERALL das gleiche Modell sein, jeder Spieler darf nur EIN
 * aktuelles Modell haben."
 *
 * VORGESCHICHTE: PR #706/#709 fanden vier Charaktere (Krag'Zul, Rhyx'Tal, Lava Golem,
 * Tidesprinter), bei denen `public/mockups/battle-mode.engine.js` zwei UNABHAENGIGE
 * Bauplaene je Spieler fuehrte — `BAU` (liest `zeichneSprite()` fuer die animierte Arena)
 * und `B_FIGUR` (las `figur()`/`figurKlein()`, also Kader-Karte/Aufstellungs-Board, IMMER
 * ZUERST und komplett unabhaengig von `BAU`, s. der historische Kommentar vor `BAU` in der
 * Engine-Datei). Wo `B_FIGUR` fuer einen Charakter veraltet war, zeigte die Kader-/
 * Aufstellungskarte einen ANDEREN Charakter als die Arena — genau das Gegenteil von "einem
 * Modell".
 *
 * Der vollstaendige Abgleich aller 13 je in `B_FIGUR` gefuehrten Eintraege (die vier oben
 * plus neun weitere: King Arlen Morgolor, Draco, Cassandra, Seraph-11, Krolach, Johanna,
 * Greenkraut, Jorund, Ralazar the Balanced — per figurProbe/renderProbe nebeneinander-
 * gestellt, s. PR-Beschreibung) fand mehrere weitere klare Widersprueche (u.a. Seraph-11:
 * silberner gefluegelter Roboter in B_FIGUR gegen Alien-mit-Fell-und-Kapuze in BAU;
 * Ralazar the Balanced: heller Mystiker mit Stab gegen olivhaeutige dunkle Plattenruestung).
 * Fuer KEINEN der 13 Faelle war `B_FIGUR` die einzige Quelle eines Standbilds — jeder hatte
 * (oder bekam) eine vollstaendige `BAU`-Zeile. Die Entscheidung (s. Kommentar vor `BAU` in
 * der Engine-Datei): `B_FIGUR` ist ERSATZLOS GESTRICHEN, nicht nur um die widerspruechlichen
 * Eintraege bereinigt. `figur()` liest jetzt strukturell nur noch `BAU`/`BAU_STD` — denselben
 * Bauplan, den `zeichneSprite()` fuer die Arena liest.
 *
 * WAS DIESER TEST ABSICHERT: dass diese zweite Tabelle nicht still zurueckkehrt (unter dem
 * alten oder einem neuen Namen) und dass `figur()` strukturell nachweisbar nur `BAU` liest —
 * ein Verhaltens-/Struktur-Test statt eines Bildvergleichs, weil `battle-mode.engine.js`
 * nicht ausserhalb eines Browsers ausgefuehrt werden kann (dieselbe Grenze wie in den
 * anderen `tests/battle-arena-*.test.ts`-Dateien: Quelltext lesen und die selbststaendigen
 * Teile isoliert ausfuehren/pruefen, statt die Logik hier nachzubauen).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const QUELLTEXT = readFileSync(join(process.cwd(), "public/mockups/battle-mode.engine.js"), "utf8");

/**
 * Schneidet ein Objekt-Literal `const <name>={...};` aus dem Quelltext — klammertief und
 * string-bewusst, damit verschachtelte `{`/`}` (BAU ist mehrere tausend Zeilen tief
 * verschachtelt: Ebenenlisten, `effekt:{...}`) und `}`-Zeichen innerhalb von String-Werten
 * (z. B. Namen mit Sonderzeichen) nicht vorzeitig das Ende markieren.
 */
function schneideObjektLiteral(name: string): string {
  const anker = `const ${name}=`;
  const start = QUELLTEXT.indexOf(anker);
  expect(start, `"${anker}" nicht in battle-mode.engine.js gefunden`).toBeGreaterThan(-1);
  const klammerStart = QUELLTEXT.indexOf("{", start);
  expect(klammerStart, `Oeffnende Klammer von ${name} nicht gefunden`).toBeGreaterThan(-1);

  // Die vielen erklaerenden Kommentare MITTEN im Objekt-Literal (jede Zeile dieser Datei
  // traegt welche, oft mit Apostrophen wie "Chris' Fund" oder Namen wie "Krag'Zul") muessen
  // von echtem Code unterschieden werden — sonst haelt der Scanner einen Kommentar-Apostroph
  // faelschlich fuer den Start eines String-Literals und verliert die Klammer-Tiefe.
  let tiefe = 0;
  let inString: '"' | "'" | null = null;
  let inZeilenkommentar = false;
  let inBlockkommentar = false;
  for (let i = klammerStart; i < QUELLTEXT.length; i += 1) {
    const zeichen = QUELLTEXT[i];
    const naechstes = QUELLTEXT[i + 1];
    const vorher = QUELLTEXT[i - 1];

    if (inZeilenkommentar) {
      if (zeichen === "\n") inZeilenkommentar = false;
      continue;
    }
    if (inBlockkommentar) {
      if (zeichen === "*" && naechstes === "/") { inBlockkommentar = false; i += 1; }
      continue;
    }
    if (inString) {
      if (zeichen === inString && vorher !== "\\") inString = null;
      continue;
    }
    if (zeichen === "/" && naechstes === "/") { inZeilenkommentar = true; i += 1; continue; }
    if (zeichen === "/" && naechstes === "*") { inBlockkommentar = true; i += 1; continue; }
    if (zeichen === '"' || zeichen === "'") {
      inString = zeichen;
      continue;
    }
    if (zeichen === "{") tiefe += 1;
    else if (zeichen === "}") {
      tiefe -= 1;
      if (tiefe === 0) return QUELLTEXT.slice(klammerStart, i + 1);
    }
  }
  throw new Error(`Schliessende Klammer von ${name} nicht gefunden (Tiefe blieb bei ${tiefe}).`);
}

/** Wertet ein ausgeschnittenes Objekt-Literal aus (reine Daten: Strings/Zahlen/Arrays/Objekte). */
function ladeObjektLiteral<T>(quelle: string): T {
  // eslint-disable-next-line no-new-func -- bewusst: fuehrt den ECHTEN Objekt-Literal-Text aus
  // der ausgelieferten Datei aus, wie die uebrigen tests/battle-arena-*.test.ts-Dateien es
  // fuer GEGENFELD & Co. schon tun (s. battle-arena-heal-attribution.test.ts).
  return new Function(`"use strict"; return (${quelle});`)();
}

/**
 * Die 13 Charakternamen, die historisch je einen `B_FIGUR`-Eintrag hatten (vier davon schon
 * vor dieser Aenderung entfernt, PR #706/#709; die restlichen neun jetzt, s. Kommentar oben).
 * Fixe Namensliste bewusst statt "alle 2.984 Spieler pruefen" — die Garantie, die dieser Test
 * geben soll, ist "es gibt keine zweite Tabelle mehr", nicht "BAU ist fuer jeden Namen
 * vollstaendig" (das ist Sache anderer Tests/der Bildbefund-Dokumentation in
 * lib/battle/subclass-archetypes.ts). Dass ausgerechnet diese 13 weiterhin eine echte
 * BAU-Zeile haben, ist die konkrete Regressionsgefahr: kaeme B_FIGUR zurueck, waeren exakt
 * sie wieder die ersten Kandidaten fuer einen Bauplan-Widerspruch.
 */
const EHEMALIGE_B_FIGUR_NAMEN = [
  "Krag'Zul",
  "Rhyx'Tal",
  "Lava Golem",
  "Tidesprinter",
  "King Arlen Morgolor",
  "Draco",
  "Cassandra",
  "Seraph-11",
  "Krolach",
  "Johanna",
  "Greenkraut",
  "Jorund",
  "Ralazar the Balanced",
] as const;

describe("Battle Arena · ein Charakter, ein Modell (Chris, 01.09.)", () => {
  it("kennt keine B_FIGUR-Tabelle mehr — keine zweite Quelle, aus der eine Vorschau lesen koennte", () => {
    // Der staerkste, einfachste Schutz: der Bezeichner selbst darf nirgends mehr auftauchen
    // (weder als Deklaration noch als Kommentar-Verweis auf eine WIEDER eingefuehrte Tabelle
    // dieses Namens). Historische Kommentare, die die STREICHUNG selbst beschreiben (Vorher/
    // Nachher-Erzaehlung), sind hier ausdruecklich gewollt und werden unten separat erlaubt.
    const treffer = [...QUELLTEXT.matchAll(/B_FIGUR/g)];
    // Jeder verbliebene Treffer muss aus der erklaerenden Kopfzeile/den Kommentaren stammen,
    // die die Streichung selbst dokumentieren — niemals aus einer neuen Deklaration
    // (`const B_FIGUR=`) oder einem Laufzeit-Zugriff (`B_FIGUR[`).
    expect(QUELLTEXT).not.toMatch(/const\s+B_FIGUR\s*=/);
    expect(QUELLTEXT).not.toMatch(/B_FIGUR\s*\[/);
    // Es darf also Treffer geben (Kommentare), aber keiner davon darf einer der beiden
    // verbotenen Formen entsprechen — oben bereits geprueft. Diese Zeile haelt zusaetzlich
    // fest, dass ueberhaupt noch etwas Kommentar-Kontext da ist (die Streichung ist
    // dokumentiert, nicht kommentarlos verschwunden).
    expect(treffer.length).toBeGreaterThan(0);
  });

  it("figur() liest fuer den Bauplan strukturell nur BAU/BAU_STD, keine andere Namens-Tabelle", () => {
    const start = QUELLTEXT.indexOf("function figur(p){");
    expect(start, "figur(p){...} nicht gefunden").toBeGreaterThan(-1);
    // figurKlein() ruft figur() nur noch mit anderer CSS-Groesse auf (s. Kommentar dort) —
    // die naechste Funktionsgrenze reicht deshalb als Ende.
    const ende = QUELLTEXT.indexOf("\n  function figurKlein(", start);
    expect(ende, "Ende von figur() (vor figurKlein) nicht gefunden").toBeGreaterThan(start);
    const funktionsText = QUELLTEXT.slice(start, ende);

    // JEDER Zugriff der Form `GROSSNAME[p.n]` (Bauplan-Nachschlag ueber den Spielernamen) MUSS
    // auf BAU zeigen. Ein zweiter Treffer hier waere exakt die Regression: eine neue Tabelle,
    // die figur() vor BAU liest.
    const nachschlaege = [...funktionsText.matchAll(/\b([A-Z][A-Z0-9_]*)\[p\.n\]/g)].map((m) => m[1]);
    expect(nachschlaege.length).toBeGreaterThan(0);
    expect(new Set(nachschlaege)).toEqual(new Set(["BAU"]));

    // Und dieser eine Zugriff faellt auf BAU_STD zurueck, statt bei einem unbekannten Namen
    // ohne Bauplan dazustehen.
    expect(funktionsText).toContain("BAU[p.n]||BAU_STD");
  });

  it("BAU traegt fuer alle 13 ehemaligen B_FIGUR-Charaktere weiterhin eine echte Zeile", () => {
    const bauQuelle = schneideObjektLiteral("BAU");
    const bau = ladeObjektLiteral<Record<string, { kopf?: string; vollbild?: string; reiherMech?: boolean }>>(bauQuelle);

    for (const name of EHEMALIGE_B_FIGUR_NAMEN) {
      const eintrag = bau[name];
      expect(eintrag, `BAU["${name}"] fehlt — B_FIGUR waere fuer diesen Charakter die einzige Quelle gewesen`).toBeDefined();
      // Ein echter Bauplan ist ein VOLLBILD-Eintrag (Kreaturen ohne kopf/body), ein echter
      // Kopftyp, oder eine prozedurale Sonderroutine wie b.reiherMech (Seraph-11, s.
      // zeichneReiherMech) — alle drei schliessen den stillen BAU_STD-Nachfall aus, der
      // (unbemerkt) exakt denselben Effekt haette wie ein fehlender Eintrag.
      expect(Boolean(eintrag!.kopf || eintrag!.vollbild || eintrag!.reiherMech), `BAU["${name}"] hat weder kopf noch vollbild noch reiherMech`).toBe(true);
    }
  });

  it("kaderFigur() (Kader-Vorschau in der echten Aufstellungs-Ansicht) ruft dieselbe figur()-Funktion, keine eigene Zeichenroutine", () => {
    const start = QUELLTEXT.indexOf("function kaderFigur(");
    expect(start, "kaderFigur(...) nicht gefunden").toBeGreaterThan(-1);
    const ende = QUELLTEXT.indexOf("\n  }\n", start);
    expect(ende, "Ende von kaderFigur() nicht gefunden").toBeGreaterThan(start);
    const funktionsText = QUELLTEXT.slice(start, ende);
    expect(funktionsText).toMatch(/\bfigur\s*\(/);
    // Keine eigene B_-Tabelle, kein eigener bHol/zeichneSprite-Aufruf hier — nur figur().
    expect(funktionsText).not.toContain("B_FIGUR");
    expect(funktionsText).not.toContain("zeichneSprite(");
  });
});
