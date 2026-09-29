import fs from "node:fs";
import path from "node:path";

/**
 * Ablage der Kartenschmiede: eine JSON-Datei je Karte bzw. je Gruppe, dazu eine Datei mit den
 * eigenen Fähigkeiten. Liegt neben der SQLite im Volume (auf Hetzner /app/data/persistence/kartenschmiede)
 * und übersteht damit jeden Neubau des Containers.
 */
export const MAX_EINTRAG_BYTES = 8 * 1024 * 1024;
export const MAX_GRUPPE_BYTES = 40 * 1024 * 1024;
const ID_MUSTER = /^[a-z0-9-]{8,64}$/i;

export type Art = "karten" | "gruppen";

export type KartenEintrag = {
  id: string;
  name: string;
  points: number;
  tier: number;
  role: string;
  gespeichertVon: string | null;
  vorschau: string | null;
  updatedAt: string;
  /** Werte für die Tabelle „Fertige Charaktere“, ohne Artwork */
  werte: KartenWerte;
};
export type KartenWerte = {
  faction: string; praegung: string[]; size: string; quality: string; defense: string; tough: string;
  weapons: string; passives: string; skills: Array<{ id: string; name: string; text: string; tags: string[]; art: string; kosten: unknown }>;
};

function werteVon(inhalt: Record<string, unknown>): KartenWerte {
  const liste = (w: unknown) => (Array.isArray(w) ? w : []);
  return {
    faction: text(inhalt.faction, 80),
    praegung: liste(inhalt.praegung).filter((x): x is string => typeof x === "string").slice(0, 8),
    size: text(String(inhalt.size ?? ""), 10), quality: text(String(inhalt.quality ?? ""), 10),
    defense: text(String(inhalt.defense ?? ""), 10), tough: text(String(inhalt.tough ?? ""), 10),
    weapons: text(inhalt.weapons, 1000), passives: text(inhalt.passives, 400),
    skills: liste(inhalt.skills).slice(0, 20).map((k) => {
      const f = (k ?? {}) as Record<string, unknown>;
      return { id: text(f.id, 80), name: text(f.name, 80), text: text(f.text, 600), art: text(f.art, 40),
        tags: liste(f.tags).filter((x): x is string => typeof x === "string").slice(0, 8), kosten: f.kosten ?? null };
    }),
  };
}

export type GruppenEintrag = { id: string; name: string; mitglieder: number; gespeichertVon: string | null; updatedAt: string };

type Gespeichert = { inhalt: Record<string, unknown>; vorschau: string | null; updatedAt: string; gespeichertVon?: string | null; karte?: Record<string, unknown> };

export function kartenVerzeichnis(): string {
  if (process.env.KARTENSCHMIEDE_DIR) return process.env.KARTENSCHMIEDE_DIR;
  const sqlite = process.env.OLY_APP_SQLITE_PATH;
  const basis = sqlite ? path.dirname(sqlite) : path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "persistence");
  return path.join(basis, "kartenschmiede");
}

export const istGueltigeKartenId = (id: string) => ID_MUSTER.test(id);
const ordnerVon = (sammlung: string, art: Art) =>
  path.join(kartenVerzeichnis(), sammlung.replace(/[^a-z0-9_-]/gi, "_") || "lokal", art === "karten" ? "" : art);
const dateiVon = (sammlung: string, art: Art, id: string) => {
  if (!istGueltigeKartenId(id)) throw new Error("ungueltige_id");
  return path.join(ordnerVon(sammlung, art), `${id}.json`);
};
const text = (wert: unknown, max = 200) => (typeof wert === "string" ? wert.slice(0, max) : "");
const vorschauOk = (wert: unknown) =>
  typeof wert === "string" && wert.startsWith("data:image/") && wert.length < 200_000 ? wert : null;

function schreibeAtomar(pfad: string, json: string) {
  fs.mkdirSync(path.dirname(pfad), { recursive: true });
  // Erst in eine Nachbardatei schreiben, dann umbenennen: Ein Absturz mittendrin hinterlässt keine halbe Datei.
  const temp = `${pfad}.${process.pid}.tmp`;
  fs.writeFileSync(temp, json);
  fs.renameSync(temp, pfad);
}

function liesAlle(sammlung: string, art: Art): Array<{ id: string; daten: Gespeichert }> {
  const ordner = ordnerVon(sammlung, art);
  if (!fs.existsSync(ordner)) return [];
  return fs
    .readdirSync(ordner)
    .filter(name => name.endsWith(".json") && !name.startsWith("_"))
    .flatMap(name => {
      try {
        const daten = JSON.parse(fs.readFileSync(path.join(ordner, name), "utf8")) as Gespeichert;
        // Ältere Karten speicherten ihren Inhalt unter "karte"
        if (!daten.inhalt && daten.karte) daten.inhalt = daten.karte;
        return daten.inhalt ? [{ id: name.slice(0, -5), daten }] : [];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.daten.updatedAt.localeCompare(a.daten.updatedAt));
}

export function listeKarten(sammlung: string): KartenEintrag[] {
  return liesAlle(sammlung, "karten").map(({ id, daten }) => ({
    id,
    name: text(daten.inhalt.name) || "Ohne Namen",
    points: Number(daten.inhalt.points) || 0,
    tier: Math.min(6, Math.max(1, Number(daten.inhalt.tier) || 1)),
    role: text(daten.inhalt.role, 20) || "enemy",
    gespeichertVon: daten.gespeichertVon ?? null,
    vorschau: daten.vorschau ?? null,
    updatedAt: daten.updatedAt,
    werte: werteVon(daten.inhalt),
  }));
}

export function listeGruppen(sammlung: string): GruppenEintrag[] {
  return liesAlle(sammlung, "gruppen").map(({ id, daten }) => ({
    id,
    name: text(daten.inhalt.name) || "Ohne Namen",
    mitglieder: Array.isArray(daten.inhalt.mitglieder) ? daten.inhalt.mitglieder.length : 0,
    gespeichertVon: daten.gespeichertVon ?? null,
    updatedAt: daten.updatedAt,
  }));
}

export function ladeEintrag(sammlung: string, art: Art, id: string): Record<string, unknown> | null {
  const pfad = dateiVon(sammlung, art, id);
  if (!fs.existsSync(pfad)) return null;
  const daten = JSON.parse(fs.readFileSync(pfad, "utf8")) as Gespeichert;
  return daten.inhalt ?? daten.karte ?? null;
}

export function speichereEintrag(sammlung: string, art: Art, id: string, inhalt: unknown, vorschau: unknown, wer: string | null = null) {
  if (!inhalt || typeof inhalt !== "object" || Array.isArray(inhalt)) throw new Error("inhalt_fehlt");
  const pfad = dateiVon(sammlung, art, id);
  const json = JSON.stringify({
    inhalt: { ...(inhalt as Record<string, unknown>), id },
    vorschau: vorschauOk(vorschau),
    updatedAt: new Date().toISOString(),
    gespeichertVon: wer,
  } satisfies Gespeichert);
  if (Buffer.byteLength(json) > (art === "gruppen" ? MAX_GRUPPE_BYTES : MAX_EINTRAG_BYTES)) throw new Error("zu_gross");
  schreibeAtomar(pfad, json);
}

export function loescheEintrag(sammlung: string, art: Art, id: string): boolean {
  const pfad = dateiVon(sammlung, art, id);
  if (!fs.existsSync(pfad)) return false;
  fs.unlinkSync(pfad);
  return true;
}

// ---------- Eigene Katalog-Einträge (Fähigkeiten, Zauber, Gegenstände, Waffen, Fraktionen): eine Liste je Sammlung ----------
export type Faehigkeit = {
  id: string;
  typ: string;
  name: string;
  art: string;
  fuer: string[];
  tags: string[];
  kosten: { typ: "fest" | "prozent"; wert: number };
  text: string;
  quelle: string;
  waffe?: string;
  icon?: string;
};

const faehigkeitenDatei = (sammlung: string) => path.join(ordnerVon(sammlung, "karten"), "_faehigkeiten.json");
const TYPEN = ["faehigkeit", "zauber", "gegenstand", "waffe", "fraktion"];
const slugListe = (wert: unknown, max: number) =>
  Array.isArray(wert) ? wert.map(String).filter(x => /^[a-z0-9-]{2,30}$/.test(x)).slice(0, max) : [];

function pruefeFaehigkeit(roh: unknown): Faehigkeit | null {
  if (!roh || typeof roh !== "object") return null;
  const f = roh as Record<string, unknown>;
  const kosten = (f.kosten ?? {}) as Record<string, unknown>;
  const id = text(f.id, 64);
  if (!/^[a-z0-9-]{2,64}$/.test(id) || !text(f.name)) return null;
  const typ = TYPEN.includes(String(f.typ)) ? String(f.typ) : "faehigkeit";
  const kostenTyp = kosten.typ === "fest" ? "fest" : "prozent";
  const wert = Math.max(-50, Math.min(500, Number(kosten.wert) || 0));
  const fuer = Array.isArray(f.fuer) ? f.fuer.filter((r): r is string => ["hero", "companion", "enemy"].includes(String(r))) : [];
  const eintrag: Faehigkeit = {
    id,
    typ,
    name: text(f.name, 80),
    art: text(f.art, 30) || "Sonderregel",
    fuer: fuer.length ? fuer : ["hero", "companion", "enemy"],
    tags: slugListe(f.tags, 8),
    kosten: { typ: kostenTyp, wert },
    text: text(f.text, 600),
    quelle: text(f.quelle, 40) || "eigen",
  };
  if (typ === "waffe") eintrag.waffe = text(f.waffe, 200);
  if (typ === "fraktion") eintrag.icon = /^[a-z-]{2,20}$/.test(String(f.icon)) ? String(f.icon) : "rune";
  return eintrag;
}

export function ladeFaehigkeiten(sammlung: string): Faehigkeit[] {
  const pfad = faehigkeitenDatei(sammlung);
  if (!fs.existsSync(pfad)) return [];
  try {
    const liste = JSON.parse(fs.readFileSync(pfad, "utf8")) as unknown[];
    return liste.map(pruefeFaehigkeit).filter((x): x is Faehigkeit => x !== null);
  } catch {
    return [];
  }
}

export function speichereFaehigkeiten(sammlung: string, liste: unknown): Faehigkeit[] {
  if (!Array.isArray(liste) || liste.length > 2000) throw new Error("liste_ungueltig");
  const sauber = liste.map(pruefeFaehigkeit).filter((x): x is Faehigkeit => x !== null);
  schreibeAtomar(faehigkeitenDatei(sammlung), JSON.stringify(sauber, null, 1));
  return sauber;
}

// ---------- Kurzformen für Karten (von den ersten Routen und Tests benutzt) ----------
export const ladeKarte = (sammlung: string, id: string) => ladeEintrag(sammlung, "karten", id);
export const loescheKarte = (sammlung: string, id: string) => loescheEintrag(sammlung, "karten", id);
export function speichereKarte(sammlung: string, id: string, karte: unknown, vorschau: unknown, wer: string | null = null): KartenEintrag {
  speichereEintrag(sammlung, "karten", id, karte, vorschau, wer);
  return listeKarten(sammlung).find(e => e.id === id)!;
}
