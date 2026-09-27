import fs from "node:fs";
import path from "node:path";

/**
 * Baut die Kartenschmiede als EINE HTML-Seite zusammen: Schriften und Beispielbilder als data-URIs,
 * html-to-image, Regeln und Oberfläche inline. Eine einzige Datei ist Absicht: Der PNG-Export
 * (html-to-image) braucht Schriften und Bilder ohnehin eingebettet, und dieselbe Seite läuft so
 * auch als eigenständige Datei ohne Server.
 */
const QUELLE = path.join(/*turbopackIgnore: true*/ process.cwd(), "apps", "kartenschmiede");

const SCHRIFTEN: Array<[familie: string, datei: string, gewicht: number, stil: "normal" | "italic"]> = [
  ["Grenze", "grenze-latin-600-normal.woff2", 600, "normal"],
  ["Grenze", "grenze-latin-700-normal.woff2", 700, "normal"],
  ["Grenze", "grenze-latin-800-normal.woff2", 800, "normal"],
  ["Grenze Gotisch", "grenze-gotisch-latin-700-normal.woff2", 700, "normal"],
  ["Barlow Condensed", "barlow-condensed-latin-500-normal.woff2", 500, "normal"],
  ["Barlow Condensed", "barlow-condensed-latin-600-normal.woff2", 600, "normal"],
  ["Barlow Condensed", "barlow-condensed-latin-700-normal.woff2", 700, "normal"],
  ["Barlow Condensed", "barlow-condensed-latin-800-normal.woff2", 800, "normal"],
  ["Alegreya", "alegreya-latin-400-normal.woff2", 400, "normal"],
  ["Alegreya", "alegreya-latin-400-italic.woff2", 400, "italic"],
];

const BILDER: Record<string, string> = {
  werwolf: "werwolf-mini.jpg",
  sporenhuelle: "sporenhuelle-mini.jpg",
  einheit1: "einheit-1.jpg",
  einheit2: "einheit-2.jpg",
  einheit3: "einheit-3.jpg",
  einheit4: "einheit-4.jpg",
  einheit5: "einheit-5.jpg",
  einheit6: "einheit-6.jpg",
  einheit7: "einheit-7.jpg",
  einheit8: "einheit-8.jpg",
};

const lies = (...teile: string[]) => fs.readFileSync(path.join(QUELLE, ...teile));
const alsDataUri = (typ: string, daten: Buffer) => `data:${typ};base64,${daten.toString("base64")}`;
/** Inline-Skripte dürfen kein "</script" enthalten, sonst endet der Block vorzeitig. */
const skript = (code: string) => `<script>${code.replace(/<\/script/gi, "<\\/script")}</script>`;

export type KartenschmiedeModus = "server" | "eigenstaendig";

export function baueKartenschmiedeSeite(modus: KartenschmiedeModus): { kopf: string; rumpf: string } {
  const vorlage = lies("seite.html").toString("utf8");
  const schriften = SCHRIFTEN.map(
    ([familie, datei, gewicht, stil]) =>
      `@font-face{font-family:"${familie}";font-style:${stil};font-weight:${gewicht};font-display:swap;` +
      `src:url(${alsDataUri("font/woff2", lies("fonts", datei))}) format("woff2");}`,
  ).join("\n");
  const bilder = Object.fromEntries(
    Object.entries(BILDER).map(([schluessel, datei]) => [schluessel, alsDataUri("image/jpeg", lies("assets", datei))]),
  );
  const skripte = [
    skript(lies("vendor", "html-to-image.js").toString("utf8")),
    skript(`window.KARTENSCHMIEDE_BILDER=${JSON.stringify(bilder)};window.KARTENSCHMIEDE_SERVER=${modus === "server"};`),
    skript(lies("regeln.js").toString("utf8")),
    skript(lies("faehigkeiten.js").toString("utf8")),
    skript(lies("app.js").toString("utf8")),
    skript(lies("gruppe.js").toString("utf8")),
  ].join("\n");

  const seite = vorlage.replace("{{FONTS}}", () => schriften).replace("{{SKRIPTE}}", () => skripte);
  const trenner = seite.indexOf("</style>") + "</style>".length;
  return { kopf: seite.slice(0, trenner), rumpf: seite.slice(trenner) };
}

let zwischenspeicher: string | null = null;

/** Vollständiges HTML-Dokument für die Route /kartenschmiede. */
export function kartenschmiedeDokument(): string {
  if (zwischenspeicher && process.env.NODE_ENV === "production") return zwischenspeicher;
  const { kopf, rumpf } = baueKartenschmiedeSeite("server");
  const dokument =
    `<!doctype html><html lang="de"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` +
    `<style>[hidden]{display:none!important}body{margin:0}img{max-width:100%}</style>${kopf}</head>` +
    `<body>${rumpf}</body></html>`;
  zwischenspeicher = dokument;
  return dokument;
}
