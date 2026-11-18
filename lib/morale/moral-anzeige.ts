/**
 * MORAL-ANZEIGE (18.11., Chris: "Moral NICHT als Herz, sondern als Smiley mit Farbe von gruen bis rot
 * plus Zahl"). Reine Funktionen, keine Importe: Stufe, Wort und Farbe aus dem Wert 0..100, dieselben
 * fuenf Stufen wie `getVisibleMood` in `player-morale-service.ts` (80/60/40/20), damit Wort und
 * Gesicht nie voneinander abweichen.
 *
 * Farbskala = die Ampelfarben der Broadcast-Tokens (`--bc-warn` #ff6058, `--bc-acht` #f3b54a,
 * `--bc-gut` #62d394), stetig interpoliert: 0 rot, 50 bernstein, 100 gruen.
 */
export type MoralStufe = "sehr_zufrieden" | "zufrieden" | "neutral" | "unzufrieden" | "veraergert";

export const MORAL_STUFEN: ReadonlyArray<{ id: MoralStufe; ab: number; wort: string }> = [
  { id: "sehr_zufrieden", ab: 80, wort: "sehr zufrieden" },
  { id: "zufrieden", ab: 60, wort: "zufrieden" },
  { id: "neutral", ab: 40, wort: "neutral" },
  { id: "unzufrieden", ab: 20, wort: "unzufrieden" },
  { id: "veraergert", ab: 0, wort: "verärgert" },
];

const ROT: [number, number, number] = [0xff, 0x60, 0x58];
const BERNSTEIN: [number, number, number] = [0xf3, 0xb5, 0x4a];
const GRUEN: [number, number, number] = [0x62, 0xd3, 0x94];

export function klemmeMoral(wert: number | null | undefined): number {
  return typeof wert === "number" && Number.isFinite(wert) ? Math.max(0, Math.min(100, wert)) : 50;
}

export function moralStufe(wert: number | null | undefined): { id: MoralStufe; wort: string; index: number } {
  const w = klemmeMoral(wert);
  const gefunden = MORAL_STUFEN.findIndex((s) => w >= s.ab);
  const index = gefunden < 0 ? MORAL_STUFEN.length - 1 : gefunden;
  return { id: MORAL_STUFEN[index].id, wort: MORAL_STUFEN[index].wort, index };
}

/** Farbe als `#rrggbb`, stetig rot -> bernstein -> gruen. */
export function moralFarbe(wert: number | null | undefined): string {
  const w = klemmeMoral(wert);
  const [von, nach, t] = w < 50 ? [ROT, BERNSTEIN, w / 50] : [BERNSTEIN, GRUEN, (w - 50) / 50];
  const kanal = (i: number) => Math.round(von[i] + (nach[i] - von[i]) * t);
  return `#${[0, 1, 2].map((i) => kanal(i).toString(16).padStart(2, "0")).join("")}`;
}

/** Mundkruemmung -1 (Mundwinkel unten) .. +1 (Mundwinkel oben), stetig. */
export function moralMund(wert: number | null | undefined): number {
  return Math.max(-1, Math.min(1, (klemmeMoral(wert) - 50) / 50));
}
