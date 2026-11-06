import figurenSpriteIndex from "@/data/generated/figuren-sprites.json";

/**
 * PIXEL-FIGUREN (PixelLab, 80x80-Kanon) — die Spielfiguren als animierte Sprites.
 *
 * Quelle: die Live-PixelLab-API (Stand 02.11.), exportiert nach
 * `public/sprites/figuren/<slug>/` und indiziert in `data/generated/figuren-sprites.json`.
 * Je Figur liegen dort:
 *   - `south.png`, `east.png`, `west.png`, `north.png` — die Grundposen (Rotationen),
 *   - `<name>-south.png`, `<name>-east.png`, optional `<name>-north.png` — je Animation ein
 *     waagerechter Streifen mit `frames` Bildern zu `canvas` x `canvas` px (West = Ost gespiegelt,
 *     wie im PixelLab-Kanon; Nord ist seit 06.11. eine echte Animation, wo vorhanden — fehlt sie
 *     einer aelteren Figur, zeigt der Motor ersatzweise den Ost-Streifen).
 *
 * Zuordnung Spieler -> Figur genau wie bei den Portraits (`public/portraits/README.md`):
 * der Slug ist der Namensteil der Spieler-ID (`player-0001-umbros` -> `umbros`).
 *
 * Neu exportieren (nach neuen Figuren/Animationen in PixelLab): das Export-Skript liest die
 * Live-API, `PIXELLAB_API_KEY=... python3 -I scripts/figuren-sprites-export.py`.
 */

export type FigurAnimationKind = "walk" | "angriff" | "tod" | "treffer";

export type FigurAnimation = {
  /** Dateiname-Stamm, z. B. `walk`, `angriff`, `angriff2`. */
  name: string;
  kind: FigurAnimationKind;
  frames: number;
  dirs: Array<"south" | "east" | "north">;
  /** Woher die Art-Zuordnung stammt (gid/text = aus den Bau-Skripten belegt, heur/frames = geschaetzt). */
  quelle?: string;
};

export type FigurSprite = {
  slug: string;
  pixellabId: string;
  /** Kantenlaenge eines Einzelbilds in px (80 = Kanon; aeltere Figuren 128/168). */
  canvas: number;
  rotationen: Array<"south" | "east" | "west" | "north">;
  animationen: FigurAnimation[];
};

type RawEntry = Omit<FigurSprite, "slug">;

const FIGUREN = figurenSpriteIndex as unknown as Record<string, RawEntry>;
export const FIGUREN_SPRITE_DIR = "/sprites/figuren";

export const FIGUR_ANIMATION_LABEL: Record<FigurAnimationKind, string> = {
  walk: "Gehen",
  angriff: "Aktion",
  tod: "K.o.",
  treffer: "Treffer",
};

function slugFromPlayerId(playerId: string): string | null {
  const match = playerId.toLowerCase().match(/^player-\d+-(.+)$/);
  return match ? match[1]! : null;
}

export function getFigurSpriteBySlug(slug: string): FigurSprite | null {
  const entry = FIGUREN[slug];
  return entry ? { slug, ...entry } : null;
}

export function getFigurSpriteForPlayer(playerId: string | null | undefined): FigurSprite | null {
  if (!playerId) return null;
  const direct = FIGUREN[playerId.toLowerCase()];
  if (direct) return { slug: playerId.toLowerCase(), ...direct };
  const slug = slugFromPlayerId(playerId);
  return slug ? getFigurSpriteBySlug(slug) : null;
}

export function listFigurSprites(): FigurSprite[] {
  return Object.keys(FIGUREN)
    .sort()
    .map((slug) => ({ slug, ...FIGUREN[slug]! }));
}

export function figurPoseUrl(sprite: FigurSprite, dir: "south" | "east" | "west" | "north" = "south"): string {
  const has = sprite.rotationen.includes(dir) ? dir : sprite.rotationen[0] ?? "south";
  return `${FIGUREN_SPRITE_DIR}/${sprite.slug}/${has}.png`;
}

export function figurStripUrl(sprite: FigurSprite, anim: FigurAnimation, dir: "south" | "east" | "north"): string {
  const has = anim.dirs.includes(dir) ? dir : anim.dirs[0] ?? "south";
  return `${FIGUREN_SPRITE_DIR}/${sprite.slug}/${anim.name}-${has}.png`;
}

/** Erste Animation einer Art (oder null). */
export function figurAnimation(sprite: FigurSprite, kind: FigurAnimationKind): FigurAnimation | null {
  return sprite.animationen.find((a) => a.kind === kind) ?? null;
}

/**
 * Abspielreihenfolge fuer "Klick = naechste Animation": Gehen zuerst, dann Aktion, Treffer, K.o.
 * Doppelte Gruppen (Reparatur-Neubauten) werden ausgelassen — es zaehlt die erste je Art.
 */
export function figurAnimationCycle(sprite: FigurSprite): FigurAnimation[] {
  const order: FigurAnimationKind[] = ["walk", "angriff", "treffer", "tod"];
  return order.map((kind) => figurAnimation(sprite, kind)).filter((a): a is FigurAnimation => a !== null);
}
