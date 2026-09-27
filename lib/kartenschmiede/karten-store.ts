import fs from "node:fs";
import path from "node:path";

/**
 * Gespeicherte Karten der Kartenschmiede: eine JSON-Datei je Karte, je Sammlung ein Ordner.
 * Liegt neben der SQLite im Volume (auf Hetzner /app/data/persistence/kartenschmiede) und
 * übersteht damit jeden Neubau des Containers.
 */
export const MAX_KARTE_BYTES = 8 * 1024 * 1024;
const ID_MUSTER = /^[a-z0-9-]{8,64}$/i;

export type KartenEintrag = {
  id: string;
  name: string;
  points: number;
  tier: number;
  role: string;
  gespeichertVon: string | null;
  vorschau: string | null;
  updatedAt: string;
};

type Gespeichert = { karte: Record<string, unknown>; vorschau: string | null; updatedAt: string; gespeichertVon?: string | null };

export function kartenVerzeichnis(): string {
  if (process.env.KARTENSCHMIEDE_DIR) return process.env.KARTENSCHMIEDE_DIR;
  const sqlite = process.env.OLY_APP_SQLITE_PATH;
  const basis = sqlite ? path.dirname(sqlite) : path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "persistence");
  return path.join(basis, "kartenschmiede");
}

export const istGueltigeKartenId = (id: string) => ID_MUSTER.test(id);
const besitzerOrdner = (besitzer: string) => path.join(kartenVerzeichnis(), besitzer.replace(/[^a-z0-9_-]/gi, "_") || "lokal");
const datei = (besitzer: string, id: string) => {
  if (!istGueltigeKartenId(id)) throw new Error("ungueltige_karten_id");
  return path.join(besitzerOrdner(besitzer), `${id}.json`);
};

const text = (wert: unknown, max = 200) => (typeof wert === "string" ? wert.slice(0, max) : "");
const vorschauOk = (wert: unknown) =>
  typeof wert === "string" && wert.startsWith("data:image/") && wert.length < 200_000 ? wert : null;

export function listeKarten(besitzer: string): KartenEintrag[] {
  const ordner = besitzerOrdner(besitzer);
  if (!fs.existsSync(ordner)) return [];
  return fs
    .readdirSync(ordner)
    .filter(name => name.endsWith(".json"))
    .map(name => {
      try {
        const inhalt = JSON.parse(fs.readFileSync(path.join(ordner, name), "utf8")) as Gespeichert;
        const k = inhalt.karte;
        return {
          id: name.slice(0, -5),
          name: text(k.name) || "Ohne Namen",
          points: Number(k.points) || 0,
          tier: Math.min(6, Math.max(1, Number(k.tier) || 1)),
          role: text(k.role, 20) || "enemy",
          gespeichertVon: inhalt.gespeichertVon ?? null,
          vorschau: inhalt.vorschau ?? null,
          updatedAt: inhalt.updatedAt,
        };
      } catch {
        return null;
      }
    })
    .filter((e): e is KartenEintrag => e !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function ladeKarte(besitzer: string, id: string): Record<string, unknown> | null {
  const pfad = datei(besitzer, id);
  if (!fs.existsSync(pfad)) return null;
  return (JSON.parse(fs.readFileSync(pfad, "utf8")) as Gespeichert).karte;
}

export function speichereKarte(besitzer: string, id: string, karte: unknown, vorschau: unknown, wer: string | null = null): KartenEintrag {
  if (!karte || typeof karte !== "object" || Array.isArray(karte)) throw new Error("karte_fehlt");
  const pfad = datei(besitzer, id);
  const inhalt: Gespeichert = {
    karte: { ...(karte as Record<string, unknown>), id },
    vorschau: vorschauOk(vorschau),
    updatedAt: new Date().toISOString(),
    gespeichertVon: wer,
  };
  const json = JSON.stringify(inhalt);
  if (Buffer.byteLength(json) > MAX_KARTE_BYTES) throw new Error("karte_zu_gross");
  fs.mkdirSync(path.dirname(pfad), { recursive: true });
  // Erst in eine Nachbardatei schreiben, dann umbenennen: Ein Absturz mittendrin hinterlässt keine halbe Karte.
  const temp = `${pfad}.${process.pid}.tmp`;
  fs.writeFileSync(temp, json);
  fs.renameSync(temp, pfad);
  return listeKarten(besitzer).find(e => e.id === id)!;
}

export function loescheKarte(besitzer: string, id: string): boolean {
  const pfad = datei(besitzer, id);
  if (!fs.existsSync(pfad)) return false;
  fs.unlinkSync(pfad);
  return true;
}
