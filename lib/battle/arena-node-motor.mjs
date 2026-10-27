// @ts-check
/**
 * ARENA-MOTOR OHNE CHROMIUM (Quick-Sim, 27.10.) — fuehrt `public/mockups/battle-mode.rezepte.js` +
 * `battle-mode.engine.js` in einem `node:vm`-Kontext aus, mit einer schlanken Nachbildung genau
 * der Browser-Teile, die der Motor beim Laden und Simulieren anfasst.
 *
 * WARUM DAS GEHT (gemessen, nicht vermutet — Task #212, 27.10.): der Motor ist zwar an DOM/Canvas
 * gekoppelt (`new Image()`, `document.createElement("canvas")` schon beim Laden, s.
 * arena-headless-runner.ts Kopfkommentar), die SIMULATION selbst liest aber nichts aus dem DOM,
 * was sie nicht auch ohne Browser bekaeme: kein `Math.random()` im Wertungspfad, eine eigene,
 * simulationsgebundene Uhr (`jetztMs()`/`sondenAktiv`) statt `performance.now()`, und jede
 * Pixelmessung (`hoehenKorrektur()`, `blattSpanne()`, `sandsackHandFarbe()`) hat einen
 * dokumentierten Rueckfall fuer "Bild nicht geladen". 293 von 296 Testduellen waren bytegleich
 * zu Chromium; die drei Abweichungen (Basketball) liegen ab der 12. Nachkommastelle — V8 in
 * Chromium und V8 in Node sind verschiedene Versionen.
 *
 * DIESE DATEI IST BEWUSST REINES JAVASCRIPT (ESM), KEIN TYPESCRIPT: sie laeuft im Worker-Thread
 * (`arena-node-worker.mjs`), und der muss in JEDER Umgebung ohne Transpiler ladbar sein — unter
 * `tsx server.ts` (Produktion), unter Vitest und unter `node` direkt. Typen kommen ueber JSDoc,
 * `@ts-check` prueft sie, sobald TypeScript die Datei ueber einen Import sieht.
 *
 * AUFBAU DER NACHBILDUNG — drei Klassen von Objekten, nach ihrem Einfluss auf die Wertung:
 *
 *  1. WERTUNGSRELEVANT ODER POTENZIELL WERTUNGSRELEVANT, deshalb ECHT nachgebildet:
 *     - Leinwand (`NachgebildeteLeinwand`): echte `width`/`height` (Haupt-Leinwand `#cv` 1240x470
 *       wie in battle-mode.html), ein 2D-Kontext mit echten `Uint8ClampedArray`-Pixelpuffern.
 *       `getImageData()` liefert die echte Puffergroesse, `putImageData()`/`clearRect()` schreiben
 *       wirklich in den Puffer. Rasterisiert wird NICHT (`drawImage`/`fillRect`/`fill`/`stroke`/
 *       `fillText` sind No-ops) — Pixelmessungen sehen also eine leere Leinwand, genau den Zustand
 *       "Sprite-Blatt noch nicht/gar nicht geladen", fuer den der Motor an jeder Messstelle einen
 *       Rueckfall hat (Hoehenkorrektur 1, Hantel-Standardkoerper, Standard-Hautfarbe).
 *     - Bild (`NachgebildetesBild`): verhaelt sich wie ein Bild, dessen Laden FEHLGESCHLAGEN ist
 *       (`complete: true`, alle Masse 0, `decode()` lehnt ab) — ein echter Browserzustand, den
 *       der Motor bereits behandelt. Das entspricht der Benchmark-Messung (Task #212).
 *     - Zeitgeber: echte `setTimeout`/`setInterval`, aber je Kontext mitgezaehlt und beim
 *       Aufraeumen vollstaendig geloescht (kein Zeitgeber ueberlebt einen Lauf).
 *       `requestAnimationFrame` wird angenommen, aber nie ausgeloest — der Live-Zeichen-Loop
 *       laeuft nicht; die Produktions-Einstiege (`spieleFeldspiel()` usw.) rechnen synchron und
 *       sichern/restaurieren ihren Zustand selbst (`M.zurueck(g)`).
 *     - `localStorage`: echter In-Memory-Speicher (`getItem` eines fehlenden Schluessels ist
 *       `null`, wie in einem frischen Chromium-Profil).
 *
 *  2. REINE ANZEIGE (HUD, Overlays, Ton, Layout): jedes `document.getElementById(...)`, jedes
 *     Nicht-Canvas-Element, `Audio`, `AudioContext`, `getComputedStyle` usw. Diese Teile erreichen
 *     die Wertung nicht; sie bekommen einen "Leerlauf-Knoten" (`leerlaufKnoten()`): ein Objekt, das
 *     jede Eigenschaft und jeden Aufruf annimmt, geschriebene Werte wieder hergibt und sonst
 *     neutral (0 / leer) antwortet. Das ist die robuste Wahl gegenueber einem Teil-DOM: der Motor
 *     hat ueber 230 `getElementById`-Stellen, und jede neue Anzeige-Zeile darin wuerde ein
 *     explizites Teil-DOM brechen, ohne dass sich an der Wertung etwas aendert.
 *
 *  3. JS-INTRINSICS (Math, JSON, Array, ...): kommen aus dem vm-Kontext selbst — mit EINER
 *     gemessenen Ausnahme: `Math.sin`/`Math.cos`/`Math.pow` liefern in Node 22 (V8 12.4, fdlibm)
 *     andere letzte Bits als in Chromium 141 (V8 14.1, glibc), und im Feldspiel waechst so ein Bit
 *     ueber die Positionsrechnung bis in die Boxscore. Diese drei ersetzt
 *     `arena-node-chromium-mathe.mjs` im Kontext durch eine Nachbildung der Chromium-Algorithmen
 *     (sin/cos bitgleich, pow bis auf seltene FMA-Grenzfaelle, s. dort).
 *
 * Ein-/Ausgabe ueber Realm-Grenzen: der Kader geht als JSON-Text hinein und wird IM Kontext
 * geparst (genau wie Playwright ihn serialisiert in die Seite reicht) — dadurch gehoeren alle
 * Kader-Objekte dem Kontext-Realm, `instanceof Array` im Motor bleibt wahr. Ergebnisse kommen
 * ueber `structuredClone` heraus (behaelt NaN/undefined, anders als JSON).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { installiereChromiumMathe } from "./arena-node-chromium-mathe.mjs";

/** Die Haupt-Leinwand von battle-mode.html (`<canvas id="cv" width="1240" height="470">`). */
export const HAUPT_LEINWAND = Object.freeze({ id: "cv", breite: 1240, hoehe: 470 });

/** Fenstermasse, mit denen der Motor rechnet, wenn er nach dem Viewport fragt (nur Layout). */
const FENSTER = Object.freeze({ breite: 1240, hoehe: 800 });

/**
 * Wie lange (in Ereignisschleifen-Runden) auf `window.__arena` gewartet wird. Heute setzt der
 * Motor es synchron am Ende seines Ladens, sobald `__olyArenaKader` vorliegt — die Schleife ist
 * nur die Absicherung, falls er dort einmal ein `await` bekommt.
 */
const MAX_BEREIT_RUNDEN = 1000;

// ---------------------------------------------------------------------------------------------
// 2. LEERLAUF-KNOTEN (reine Anzeige)
// ---------------------------------------------------------------------------------------------

/**
 * Ein Objekt, das jede Eigenschaft, jeden Aufruf und jedes `new` annimmt. Geschriebene Werte
 * werden gespeichert und wieder gelesen (`el.textContent = "x"; el.textContent === "x"`),
 * ungeschriebene Eigenschaften liefern einen (je Name gemerkten) weiteren Leerlauf-Knoten, und
 * als Zahl/Text gelesen ist ein Knoten 0. `then` ist absichtlich `undefined` (sonst haelt jedes
 * `await knoten` den Knoten fuer ein Promise), Iteration liefert nichts.
 *
 * @returns {any}
 */
export function leerlaufKnoten() {
  /** @type {Map<PropertyKey, unknown>} */
  const speicher = new Map();
  const ziel = function leerlauf() {};
  return new Proxy(ziel, {
    get(_ziel, schluessel) {
      if (speicher.has(schluessel)) return speicher.get(schluessel);
      if (schluessel === Symbol.toPrimitive) return () => 0;
      if (schluessel === Symbol.iterator) return function* leer() {};
      if (schluessel === "then") return undefined;
      if (schluessel === "length") return 0;
      if (typeof schluessel === "symbol") return undefined;
      const kind = leerlaufKnoten();
      speicher.set(schluessel, kind);
      return kind;
    },
    set(_ziel, schluessel, wert) {
      speicher.set(schluessel, wert);
      return true;
    },
    has() {
      return true;
    },
    deleteProperty(_ziel, schluessel) {
      speicher.delete(schluessel);
      return true;
    },
    apply() {
      return leerlaufKnoten();
    },
    construct() {
      return leerlaufKnoten();
    },
  });
}

/**
 * Haengt an ein konkretes Objekt einen Leerlauf-Rueckfall: bekannte Eigenschaften (die der Klasse
 * bzw. selbst geschriebene) gelten unveraendert, jede UNBEKANNTE wird zu einem Leerlauf-Knoten.
 * So bleiben Leinwand/Kontext echt, ohne bei einer unbekannten Anzeige-Methode zu werfen.
 *
 * @template {object} T
 * @param {T} objekt
 * @returns {T}
 */
function mitLeerlaufRueckfall(objekt) {
  /** @type {Map<PropertyKey, unknown>} */
  const rueckfall = new Map();
  // Gebundene Methoden je Funktion gemerkt: der Motor ruft Zeichenbefehle in Schleifen auf, ein
  // neues `bind()` je Zugriff waere unnoetiger GC-Druck (genau der kostete den naiven
  // Benchmark-Ansatz 250-500 ms je Instanz, Task #212).
  /** @type {WeakMap<Function, Function>} */
  const gebunden = new WeakMap();
  return new Proxy(objekt, {
    get(ziel, schluessel) {
      if (schluessel in ziel) {
        const wert = Reflect.get(ziel, schluessel, ziel);
        if (typeof wert !== "function") return wert;
        const gemerkt = gebunden.get(wert);
        if (gemerkt) return gemerkt;
        const methode = wert.bind(ziel);
        gebunden.set(wert, methode);
        return methode;
      }
      if (typeof schluessel === "symbol" || schluessel === "then") return undefined;
      if (!rueckfall.has(schluessel)) rueckfall.set(schluessel, leerlaufKnoten());
      return rueckfall.get(schluessel);
    },
    set(ziel, schluessel, wert) {
      return Reflect.set(ziel, schluessel, wert, ziel);
    },
  });
}

// ---------------------------------------------------------------------------------------------
// 1. LEINWAND, 2D-KONTEXT, BILD (echt nachgebildet)
// ---------------------------------------------------------------------------------------------

/**
 * @param {number} wert
 * @returns {number}
 */
function ganzzahligNichtNegativ(wert) {
  const zahl = Math.trunc(Number(wert));
  return Number.isFinite(zahl) && zahl > 0 ? zahl : 0;
}

/** `ImageData` wie im Browser: `data` ist ein `Uint8ClampedArray` der Laenge `breite*hoehe*4`. */
export class NachgebildeteBilddaten {
  /**
   * @param {number} breite
   * @param {number} hoehe
   * @param {Uint8ClampedArray} [daten]
   */
  constructor(breite, hoehe, daten) {
    this.width = ganzzahligNichtNegativ(breite);
    this.height = ganzzahligNichtNegativ(hoehe);
    this.data = daten ?? new Uint8ClampedArray(this.width * this.height * 4);
    this.colorSpace = "srgb";
  }
}

/**
 * Der 2D-Kontext einer `NachgebildeteLeinwand`. Pixel kommen nur ueber `putImageData()` in den
 * Puffer und nur ueber `clearRect()` wieder heraus — Zeichenbefehle rasterisieren nicht (s.
 * Dateikopf, Klasse 1). Der Puffer wird erst beim ersten Schreiben angelegt; eine nie
 * beschriebene Leinwand liest sich als vollstaendig transparent, wie im Browser.
 */
export class Nachgebildeter2dKontext {
  /** @param {NachgebildeteLeinwand} leinwand */
  constructor(leinwand) {
    /** Die echte Leinwand (Puffer, Masse) — fuer die Pixelbefehle unten. */
    this.leinwand = leinwand;
    /** Was der Motor als `ctx.canvas` liest: die Aussenansicht mit Leerlauf-Rueckfall. */
    this.canvas = leinwand.aussenansicht;
    this.fillStyle = "#000000";
    this.strokeStyle = "#000000";
    this.globalAlpha = 1;
    this.globalCompositeOperation = "source-over";
    this.lineWidth = 1;
    this.lineCap = "butt";
    this.lineJoin = "miter";
    this.font = "10px sans-serif";
    this.textAlign = "start";
    this.textBaseline = "alphabetic";
    this.imageSmoothingEnabled = true;
    this.shadowBlur = 0;
    this.shadowColor = "rgba(0, 0, 0, 0)";
    this.shadowOffsetX = 0;
    this.shadowOffsetY = 0;
    this.filter = "none";
  }

  /**
   * @param {number} sx
   * @param {number} sy
   * @param {number} sw
   * @param {number} sh
   */
  getImageData(sx, sy, sw, sh) {
    const breite = ganzzahligNichtNegativ(sw);
    const hoehe = ganzzahligNichtNegativ(sh);
    const ergebnis = new NachgebildeteBilddaten(breite, hoehe);
    const puffer = this.leinwand.pixelPuffer;
    if (!puffer) return ergebnis;
    const lw = this.leinwand.width;
    const lh = this.leinwand.height;
    const x0 = Math.trunc(Number(sx)) || 0;
    const y0 = Math.trunc(Number(sy)) || 0;
    for (let y = 0; y < hoehe; y += 1) {
      const qy = y0 + y;
      if (qy < 0 || qy >= lh) continue;
      for (let x = 0; x < breite; x += 1) {
        const qx = x0 + x;
        if (qx < 0 || qx >= lw) continue;
        const q = (qy * lw + qx) * 4;
        const z = (y * breite + x) * 4;
        ergebnis.data[z] = puffer[q];
        ergebnis.data[z + 1] = puffer[q + 1];
        ergebnis.data[z + 2] = puffer[q + 2];
        ergebnis.data[z + 3] = puffer[q + 3];
      }
    }
    return ergebnis;
  }

  /**
   * @param {number | { width: number; height: number }} breiteOderVorlage
   * @param {number} [hoehe]
   */
  createImageData(breiteOderVorlage, hoehe) {
    if (typeof breiteOderVorlage === "object" && breiteOderVorlage) {
      return new NachgebildeteBilddaten(breiteOderVorlage.width, breiteOderVorlage.height);
    }
    return new NachgebildeteBilddaten(Number(breiteOderVorlage), Number(hoehe));
  }

  /**
   * @param {{ width: number; height: number; data: ArrayLike<number> }} bild
   * @param {number} dx
   * @param {number} dy
   */
  putImageData(bild, dx, dy) {
    if (!bild || !bild.data) return;
    const lw = this.leinwand.width;
    const lh = this.leinwand.height;
    if (lw === 0 || lh === 0) return;
    const puffer = this.leinwand.pufferAnlegen();
    const x0 = Math.trunc(Number(dx)) || 0;
    const y0 = Math.trunc(Number(dy)) || 0;
    const bw = ganzzahligNichtNegativ(bild.width);
    const bh = ganzzahligNichtNegativ(bild.height);
    for (let y = 0; y < bh; y += 1) {
      const zy = y0 + y;
      if (zy < 0 || zy >= lh) continue;
      for (let x = 0; x < bw; x += 1) {
        const zx = x0 + x;
        if (zx < 0 || zx >= lw) continue;
        const q = (y * bw + x) * 4;
        const z = (zy * lw + zx) * 4;
        puffer[z] = bild.data[q];
        puffer[z + 1] = bild.data[q + 1];
        puffer[z + 2] = bild.data[q + 2];
        puffer[z + 3] = bild.data[q + 3];
      }
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   */
  clearRect(x, y, w, h) {
    const puffer = this.leinwand.pixelPuffer;
    if (!puffer) return;
    const lw = this.leinwand.width;
    const lh = this.leinwand.height;
    const x0 = Math.max(0, Math.trunc(Number(x)) || 0);
    const y0 = Math.max(0, Math.trunc(Number(y)) || 0);
    const x1 = Math.min(lw, x0 + ganzzahligNichtNegativ(w));
    const y1 = Math.min(lh, y0 + ganzzahligNichtNegativ(h));
    for (let zy = y0; zy < y1; zy += 1) puffer.fill(0, (zy * lw + x0) * 4, (zy * lw + x1) * 4);
  }

  /** @param {string} text */
  measureText(text) {
    void text;
    return {
      width: 0,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: 0,
      actualBoundingBoxAscent: 0,
      actualBoundingBoxDescent: 0,
      fontBoundingBoxAscent: 0,
      fontBoundingBoxDescent: 0,
    };
  }

  getTransform() {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }

  isPointInPath() {
    return false;
  }

  isPointInStroke() {
    return false;
  }

  getLineDash() {
    return [];
  }

  createLinearGradient() {
    return mitLeerlaufRueckfall({ addColorStop() {} });
  }

  createRadialGradient() {
    return mitLeerlaufRueckfall({ addColorStop() {} });
  }

  createConicGradient() {
    return mitLeerlaufRueckfall({ addColorStop() {} });
  }

  createPattern() {
    return mitLeerlaufRueckfall({ setTransform() {} });
  }
}

/** Zeichen- und Zustandsbefehle ohne Pixelwirkung (s. Dateikopf, Klasse 1). */
const ZEICHENBEFEHLE_OHNE_PIXELWIRKUNG = [
  "save", "restore", "scale", "rotate", "translate", "transform", "setTransform", "resetTransform",
  "beginPath", "closePath", "moveTo", "lineTo", "bezierCurveTo", "quadraticCurveTo", "arc", "arcTo",
  "ellipse", "rect", "roundRect", "fill", "stroke", "clip", "fillRect", "strokeRect", "fillText",
  "strokeText", "drawImage", "setLineDash", "drawFocusIfNeeded", "reset",
];
for (const befehl of ZEICHENBEFEHLE_OHNE_PIXELWIRKUNG) {
  Object.defineProperty(Nachgebildeter2dKontext.prototype, befehl, {
    value: function zeichenbefehlOhnePixelwirkung() {},
    writable: true,
    configurable: true,
  });
}

/**
 * `<canvas>`: echte Masse (Setzen von `width`/`height` verwirft den Pixelpuffer, wie im
 * Browser), genau EIN 2D-Kontext je Leinwand. Andere Kontextarten (`webgl`, ...) gibt es nicht —
 * der Motor nutzt ausschliesslich `getContext("2d")`.
 */
export class NachgebildeteLeinwand {
  /**
   * @param {number} [breite]
   * @param {number} [hoehe]
   */
  constructor(breite = 300, hoehe = 150) {
    this.tagName = "CANVAS";
    this.nodeName = "CANVAS";
    this.nodeType = 1;
    this.style = leerlaufKnoten();
    this.dataset = {};
    /** @type {Uint8ClampedArray | null} */
    this.pixelPuffer = null;
    /** @type {any} */
    this.kontext2d = null;
    this.breiteIntern = ganzzahligNichtNegativ(breite);
    this.hoeheIntern = ganzzahligNichtNegativ(hoehe);
    /**
     * Die Aussenansicht dieser Leinwand (mit Leerlauf-Rueckfall, s. `neueLeinwand()`) — das, was
     * `kontext.canvas` zurueckgeben muss, damit auch dort unbekannte Anzeige-Eigenschaften nicht
     * `undefined` sind.
     * @type {any}
     */
    this.aussenansicht = this;
  }

  get width() {
    return this.breiteIntern;
  }

  set width(wert) {
    this.breiteIntern = ganzzahligNichtNegativ(wert);
    this.pixelPuffer = null;
  }

  get height() {
    return this.hoeheIntern;
  }

  set height(wert) {
    this.hoeheIntern = ganzzahligNichtNegativ(wert);
    this.pixelPuffer = null;
  }

  pufferAnlegen() {
    if (!this.pixelPuffer) this.pixelPuffer = new Uint8ClampedArray(this.breiteIntern * this.hoeheIntern * 4);
    return this.pixelPuffer;
  }

  /** @param {string} art */
  getContext(art) {
    if (String(art).toLowerCase() !== "2d") return null;
    if (!this.kontext2d) this.kontext2d = mitLeerlaufRueckfall(new Nachgebildeter2dKontext(this));
    return this.kontext2d;
  }

  toDataURL() {
    return "data:,";
  }

  getBoundingClientRect() {
    return { x: 0, y: 0, left: 0, top: 0, right: this.width, bottom: this.height, width: this.width, height: this.height };
  }

  addEventListener() {}

  removeEventListener() {}

  /** @param {string} name @param {string} wert */
  setAttribute(name, wert) {
    if (name === "width") this.width = Number(wert);
    else if (name === "height") this.height = Number(wert);
  }
}

/** @returns {any} */
function neueLeinwand() {
  const leinwand = new NachgebildeteLeinwand();
  leinwand.aussenansicht = mitLeerlaufRueckfall(leinwand);
  return leinwand.aussenansicht;
}

/**
 * `new Image()` als Bild, dessen Laden fehlgeschlagen ist (s. Dateikopf, Klasse 1): `complete`
 * wahr, alle Masse 0. `onload`/`onerror` werden gespeichert, aber nie ausgeloest — der Motor
 * liest die Masse synchron und faellt bei 0 auf seine Standardwerte zurueck.
 */
export class NachgebildetesBild {
  /**
   * @param {number} [breite]
   * @param {number} [hoehe]
   */
  constructor(breite, hoehe) {
    void breite;
    void hoehe;
    this.src = "";
    this.complete = true;
    this.width = 0;
    this.height = 0;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    /** @type {string | null} */
    this.crossOrigin = null;
    this.decoding = "auto";
    this.loading = "eager";
    /** @type {unknown} */
    this.onload = null;
    /** @type {unknown} */
    this.onerror = null;
    this.style = leerlaufKnoten();
  }

  decode() {
    return Promise.reject(new Error("arena-node-motor: Bilder werden ohne Browser nicht geladen."));
  }

  addEventListener() {}

  removeEventListener() {}

  setAttribute() {}
}

// ---------------------------------------------------------------------------------------------
// DOKUMENT, FENSTER, KONTEXT
// ---------------------------------------------------------------------------------------------

/** In-Memory-`Storage` wie `localStorage` in einem frischen Browserprofil. */
class SpeicherNachbildung {
  constructor() {
    /** @type {Map<string, string>} */
    this.eintraege = new Map();
  }

  get length() {
    return this.eintraege.size;
  }

  /** @param {number} index */
  key(index) {
    return [...this.eintraege.keys()][index] ?? null;
  }

  /** @param {string} schluessel */
  getItem(schluessel) {
    const wert = this.eintraege.get(String(schluessel));
    return wert === undefined ? null : wert;
  }

  /** @param {string} schluessel @param {unknown} wert */
  setItem(schluessel, wert) {
    this.eintraege.set(String(schluessel), String(wert));
  }

  /** @param {string} schluessel */
  removeItem(schluessel) {
    this.eintraege.delete(String(schluessel));
  }

  clear() {
    this.eintraege.clear();
  }
}

/** @returns {any} */
function baueDokument() {
  const hauptLeinwand = neueLeinwand();
  hauptLeinwand.width = HAUPT_LEINWAND.breite;
  hauptLeinwand.height = HAUPT_LEINWAND.hoehe;
  /** @type {Map<string, any>} */
  const elementeNachId = new Map([[HAUPT_LEINWAND.id, hauptLeinwand]]);
  const body = leerlaufKnoten();
  return mitLeerlaufRueckfall({
    readyState: "complete",
    visibilityState: "visible",
    hidden: false,
    body,
    head: leerlaufKnoten(),
    documentElement: leerlaufKnoten(),
    /** @param {string} id */
    getElementById(id) {
      const schluessel = String(id);
      if (!elementeNachId.has(schluessel)) elementeNachId.set(schluessel, leerlaufKnoten());
      return elementeNachId.get(schluessel);
    },
    /** @param {string} tag */
    createElement(tag) {
      return String(tag).toLowerCase() === "canvas" ? neueLeinwand() : leerlaufKnoten();
    },
    createElementNS() {
      return leerlaufKnoten();
    },
    createTextNode() {
      return leerlaufKnoten();
    },
    createDocumentFragment() {
      return leerlaufKnoten();
    },
    querySelector() {
      return leerlaufKnoten();
    },
    querySelectorAll() {
      return [];
    },
    getElementsByClassName() {
      return [];
    },
    getElementsByTagName() {
      return [];
    },
    addEventListener() {},
    removeEventListener() {},
  });
}

/**
 * Legt den vm-Kontext an. GEMESSEN (27.10.): ein klassischer, "kontextifizierter" Kontext
 * (`vm.createContext(objekt)`) leitet JEDEN Zugriff auf eine globale Variable (`Math`, `window`,
 * ...) ueber V8-Interceptors — im Feldspiel, das pro Duell Hunderttausende `Math.*`-Aufrufe macht,
 * kostete das den Faktor 2 gegenueber Chromium (2019 ms statt 922 ms je Basketball-Duell; in
 * einer Mikromessung 2716 ms statt 287 ms). `vm.constants.DONT_CONTEXTIFY` (Node >= 22.8) legt
 * stattdessen ein gewoehnliches globales Objekt an, dessen Zugriffe so schnell sind wie im
 * Hauptkontext. Die Umgebung wird danach auf dieses Objekt kopiert. Aeltere Node-Versionen ohne
 * die Konstante bekommen den klassischen Kontext — langsamer, aber gleich im Ergebnis.
 *
 * @param {Record<string, unknown>} umgebung
 * @returns {vm.Context & Record<string, any>}
 */
function erzeugeKontext(umgebung) {
  const ohneInterceptors = /** @type {{ DONT_CONTEXTIFY?: symbol } | undefined} */ (/** @type {unknown} */ (vm.constants))?.DONT_CONTEXTIFY;
  if (!ohneInterceptors) {
    return /** @type {vm.Context & Record<string, any>} */ (vm.createContext(umgebung, { name: "arena-node-motor" }));
  }
  const fenster = /** @type {vm.Context & Record<string, any>} */ (
    vm.createContext(/** @type {any} */ (ohneInterceptors), { name: "arena-node-motor" })
  );
  for (const [name, wert] of Object.entries(umgebung)) {
    Object.defineProperty(fenster, name, { value: wert, writable: true, configurable: true, enumerable: true });
  }
  return fenster;
}

/**
 * @typedef {object} MotorKontext
 * @property {vm.Context & Record<string, any>} fenster  Der vm-Kontext (globalThis/window des Motors).
 * @property {() => void} aufraeumen  Loescht alle noch offenen Zeitgeber dieses Kontexts.
 */

/**
 * Baut einen frischen vm-Kontext, der fuer den Motor wie ein Browserfenster mit battle-mode.html
 * aussieht. Je Lauf (Batch) genau einer — s. `simuliereDuelle()`.
 *
 * @returns {MotorKontext}
 */
export function baueMotorKontext() {
  /** @type {Set<ReturnType<typeof setTimeout>>} */
  const zeitgeber = new Set();
  let naechsteFrameId = 1;
  const stumm = () => {};
  const leererBildschirm = { width: FENSTER.breite, height: FENSTER.hoehe, availWidth: FENSTER.breite, availHeight: FENSTER.hoehe };

  /** @type {Record<string, unknown>} */
  const umgebung = {
    console: { log: stumm, info: stumm, warn: stumm, error: stumm, debug: stumm, trace: stumm, table: stumm },
    /** @param {(...args: unknown[]) => void} fn @param {number} [ms] @param {...unknown} args */
    setTimeout(fn, ms, ...args) {
      const handle = setTimeout(() => {
        zeitgeber.delete(handle);
        if (typeof fn === "function") fn(...args);
      }, ms);
      zeitgeber.add(handle);
      return handle;
    },
    /** @param {ReturnType<typeof setTimeout>} handle */
    clearTimeout(handle) {
      clearTimeout(handle);
      zeitgeber.delete(handle);
    },
    /** @param {(...args: unknown[]) => void} fn @param {number} [ms] @param {...unknown} args */
    setInterval(fn, ms, ...args) {
      const handle = setInterval(() => {
        if (typeof fn === "function") fn(...args);
      }, ms);
      zeitgeber.add(handle);
      return handle;
    },
    /** @param {ReturnType<typeof setInterval>} handle */
    clearInterval(handle) {
      clearInterval(handle);
      zeitgeber.delete(handle);
    },
    requestAnimationFrame() {
      naechsteFrameId += 1;
      return naechsteFrameId;
    },
    cancelAnimationFrame() {},
    queueMicrotask,
    performance,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    Image: NachgebildetesBild,
    HTMLCanvasElement: NachgebildeteLeinwand,
    ImageData: NachgebildeteBilddaten,
    Audio: leerlaufKnoten(),
    AudioContext: leerlaufKnoten(),
    webkitAudioContext: leerlaufKnoten(),
    Path2D: leerlaufKnoten(),
    ResizeObserver: leerlaufKnoten(),
    MutationObserver: leerlaufKnoten(),
    IntersectionObserver: leerlaufKnoten(),
    HTMLElement: leerlaufKnoten(),
    CustomEvent: leerlaufKnoten(),
    Event: leerlaufKnoten(),
    localStorage: new SpeicherNachbildung(),
    sessionStorage: new SpeicherNachbildung(),
    navigator: leerlaufKnoten(),
    location: leerlaufKnoten(),
    screen: leererBildschirm,
    devicePixelRatio: 1,
    innerWidth: FENSTER.breite,
    innerHeight: FENSTER.hoehe,
    outerWidth: FENSTER.breite,
    outerHeight: FENSTER.hoehe,
    scrollX: 0,
    scrollY: 0,
    /** @param {string} abfrage */
    matchMedia(abfrage) {
      return { matches: false, media: String(abfrage), addEventListener: stumm, removeEventListener: stumm, addListener: stumm, removeListener: stumm };
    },
    getComputedStyle() {
      return leerlaufKnoten();
    },
    addEventListener: stumm,
    removeEventListener: stumm,
    dispatchEvent: () => true,
    postMessage: stumm,
    document: baueDokument(),
  };

  const fenster = erzeugeKontext(umgebung);
  // `window`, `self`, `parent`, `top` zeigen IM Kontext auf dessen eigenes globalThis — so ist
  // `window === globalThis` wahr wie im Browser, und `window.parent === window` (der Motor prueft
  // genau das, bevor er auf eine postMessage-Bruecke wartet) ebenfalls.
  vm.runInContext("globalThis.window = globalThis; globalThis.self = globalThis; globalThis.parent = globalThis; globalThis.top = globalThis;", fenster);
  // Klasse 3 mit EINER Ausnahme: `Math.sin`/`Math.cos`/`Math.pow` rechnen in Node 22 (fdlibm)
  // anders als in Chromium 141 (glibc) -- s. arena-node-chromium-mathe.mjs. Ersetzt NUR im
  // Kontext-`Math`, VOR dem Laden des Motors.
  installiereChromiumMathe(vm.runInContext("Math", fenster));

  return {
    fenster,
    aufraeumen() {
      for (const handle of zeitgeber) {
        clearTimeout(handle);
        clearInterval(handle);
      }
      zeitgeber.clear();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// MOTOR LADEN UND AUFRUFEN
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {object} MotorSkripte
 * @property {vm.Script} rezepte
 * @property {vm.Script} engine
 */

/**
 * Liest und kompiliert die beiden Motor-Dateien EINMAL (je Worker). Danach laufen sie in
 * beliebig vielen Kontexten, ohne neu kompiliert zu werden.
 *
 * @param {string} mockupVerzeichnis  Verzeichnis mit battle-mode.rezepte.js / battle-mode.engine.js.
 * @returns {MotorSkripte}
 */
export function ladeMotorSkripte(mockupVerzeichnis) {
  const rezeptePfad = path.join(mockupVerzeichnis, "battle-mode.rezepte.js");
  const enginePfad = path.join(mockupVerzeichnis, "battle-mode.engine.js");
  return {
    rezepte: new vm.Script(readFileSync(rezeptePfad, "utf8"), { filename: rezeptePfad }),
    engine: new vm.Script(readFileSync(enginePfad, "utf8"), { filename: enginePfad }),
  };
}

/**
 * Setzt einen Fensterwert IM Kontext aus JSON-Text (s. Dateikopf: Kontext-Realm statt Host-Realm).
 *
 * @param {MotorKontext} kontext
 * @param {string} name
 * @param {unknown} wert
 */
function setzeFensterwertAlsJson(kontext, name, wert) {
  kontext.fenster.__olyNodeUebergabe = JSON.stringify(wert);
  vm.runInContext(`window[${JSON.stringify(name)}] = JSON.parse(window.__olyNodeUebergabe); delete window.__olyNodeUebergabe;`, kontext.fenster);
}

/**
 * Wartet auf `window.__arena` (s. `MAX_BEREIT_RUNDEN`).
 *
 * @param {MotorKontext} kontext
 */
async function wartenAufMotor(kontext) {
  for (let runde = 0; runde < MAX_BEREIT_RUNDEN && !kontext.fenster.__arena; runde += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  if (!kontext.fenster.__arena) {
    throw new Error("arena-node-motor: window.__arena wurde nach dem Laden des Motors nicht bereit.");
  }
}

/**
 * Laedt den Motor (neu) in einen Kontext — dasselbe Muster wie das Neu-Einhaengen von
 * `<script src="battle-mode.engine.js">` je Fixture in `arena-headless-runner.ts`: Kader setzen,
 * alte Instanz verwerfen, Engine erneut ausfuehren. Die Rezepte laufen nur beim ersten Mal (im
 * Browser laedt battle-mode.html sie einmal je Seite, das Neu-Einhaengen betrifft nur die Engine).
 *
 * @param {MotorKontext} kontext
 * @param {MotorSkripte} skripte
 * @param {unknown} kader  `window.__olyArenaKader` fuer diese Instanz.
 * @param {boolean} ersterStart
 */
async function ladeMotorInstanz(kontext, skripte, kader, ersterStart) {
  setzeFensterwertAlsJson(kontext, "__olyArenaKader", kader);
  delete kontext.fenster.__arena;
  if (ersterStart) skripte.rezepte.runInContext(kontext.fenster);
  skripte.engine.runInContext(kontext.fenster);
  await wartenAufMotor(kontext);
}

/** Die Motor-Einstiege je Chassis — dieselbe Zuordnung wie `simuliereFixturesImBrowser()`. */
export const MOTOR_EINSTIEG_JE_CHASSIS = Object.freeze({
  feldspiel: "spieleFeldspiel",
  buehneHeben: "spieleBuehneHeben",
  buehneDuell: "spieleBuehneDuell",
  buehneAuftritt: "spieleBuehneAuftritt",
  buehneGauntlet: "spieleBuehneGauntlet",
  bahn: "spieleBahn",
});

/**
 * @typedef {keyof typeof MOTOR_EINSTIEG_JE_CHASSIS} ArenaChassis
 */

/**
 * @typedef {object} DuellAuftrag
 * @property {string} disziplin
 * @property {ArenaChassis} chassis
 * @property {string[]} mutatoren
 * @property {Record<string, number> | undefined} [buehneFlags]
 * @property {Array<{ heim: unknown[]; gast: unknown[]; aufstellung: unknown; seed: number }>} fixtures
 */

/**
 * Simuliert eine Menge Zweier-Duelle EINER Disziplin — Node-Gegenstueck zu
 * `simuliereFixturesImBrowser()` (arena-headless-runner.ts). Liefert je Fixture das ROHE
 * Motor-Ergebnis (bzw. `null`, wenn der Motor `null` liefert), unveraendert; die Zuordnung auf
 * Spieler-IDs/Teams macht der Aufrufer, genau wie beim Chromium-Pfad.
 *
 * @param {MotorSkripte} skripte
 * @param {DuellAuftrag} auftrag
 * @returns {Promise<Array<unknown>>}
 */
export async function simuliereDuelle(skripte, auftrag) {
  const einstieg = MOTOR_EINSTIEG_JE_CHASSIS[auftrag.chassis];
  if (!einstieg) throw new Error(`arena-node-motor: unbekanntes Chassis "${String(auftrag.chassis)}".`);
  const kontext = baueMotorKontext();
  try {
    if (auftrag.buehneFlags) setzeFensterwertAlsJson(kontext, "__olyBuehneFlags", auftrag.buehneFlags);
    /** @type {unknown[]} */
    const ergebnisse = [];
    for (let index = 0; index < auftrag.fixtures.length; index += 1) {
      const fixture = auftrag.fixtures[index];
      await ladeMotorInstanz(
        kontext,
        skripte,
        { heim: fixture.heim, gast: fixture.gast, aufstellung: fixture.aufstellung, mutatoren: auftrag.mutatoren },
        index === 0,
      );
      const motor = kontext.fenster.__arena;
      if (typeof motor[einstieg] !== "function") {
        throw new Error(`arena-node-motor: window.__arena.${einstieg} fehlt.`);
      }
      const roh = motor[einstieg](auftrag.disziplin, fixture.seed);
      ergebnisse.push(roh == null ? null : structuredClone(roh));
    }
    return ergebnisse;
  } finally {
    kontext.aufraeumen();
  }
}

/**
 * @typedef {object} MiniDmAuftrag
 * @property {string[]} mutatoren
 * @property {{ heim: unknown[]; gast: unknown[] }} bootstrap  Irgendein gueltiger Zweier-Kader fuers Laden.
 * @property {Array<{ teams: unknown[][]; seed: number; platzJeTeam: unknown[]; optionen?: { k?: number; formSaat?: number } }>} pods
 */

/**
 * Simuliert Mini-DM-Pods — Node-Gegenstueck zu `simuliereMiniDmFfaPodsImBrowser()`: EIN
 * Motor-Ladevorgang, danach `miniDmFfaEvent()` je Pod (die Kader kommen dort als explizite
 * Argumente, kein Neu-Einhaengen noetig).
 *
 * @param {MotorSkripte} skripte
 * @param {MiniDmAuftrag} auftrag
 * @returns {Promise<Array<unknown>>}
 */
export async function simuliereMiniDmPods(skripte, auftrag) {
  const kontext = baueMotorKontext();
  try {
    await ladeMotorInstanz(
      kontext,
      skripte,
      { heim: auftrag.bootstrap.heim, gast: auftrag.bootstrap.gast, aufstellung: {}, mutatoren: auftrag.mutatoren },
      true,
    );
    const motor = kontext.fenster.__arena;
    if (typeof motor.miniDmFfaEvent !== "function") throw new Error("arena-node-motor: window.__arena.miniDmFfaEvent fehlt.");
    return auftrag.pods.map((pod) => {
      setzeFensterwertAlsJson(kontext, "__olyNodePod", pod);
      const podImKontext = kontext.fenster.__olyNodePod;
      delete kontext.fenster.__olyNodePod;
      const roh = motor.miniDmFfaEvent(podImKontext.teams, podImKontext.seed, podImKontext.platzJeTeam, podImKontext.optionen);
      return roh == null ? null : structuredClone(roh);
    });
  } finally {
    kontext.aufraeumen();
  }
}
