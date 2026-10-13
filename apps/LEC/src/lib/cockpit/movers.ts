import type { SaleWindowKey } from "../parsing/date";
import type { ArticleAggregate, ClassifiedArticle } from "../dashboard/viewModel";

/**
 * Mover-Listen fuer das gewaehlte Fenster (COCKPIT_V2_KONZEPT §4 Modul 11).
 * Identitaet traegt der Name (und das Kartenbild), nicht die Farbe.
 */
export interface MoverEntry {
  articleId: string;
  nameRaw: string;
  setCode: string | null;
  revenue: number;
  qty: number;
  dbII: number;
  dbIIPercent: number;
  /** Fuer die relative Balkenlaenge innerhalb der Liste (0..1, Platz 1 = 1). */
  relative: number;
  /** `/api/article-image/<id>?v=<guid>` oder null -> Platzhalter. */
  imageUrl: string | null;
  /** Nur bei "faellt_ab": Ø Stk/Monat 90 T vs. 365 T. */
  velocity?: { perMonth90: number; perMonth365: number };
}

export interface ArticleImageRef {
  imageFile: string | null;
  imageGuid: string | null;
}

export type ImageMap = ReadonlyMap<string, ArticleImageRef>;

export function imageUrlFor(articleId: string, images: ImageMap): string | null {
  const ref = images.get(articleId);
  if (!ref || !ref.imageFile) return null;
  return `/api/article-image/${encodeURIComponent(articleId)}${ref.imageGuid ? `?v=${encodeURIComponent(ref.imageGuid)}` : ""}`;
}

export interface Movers {
  window: SaleWindowKey;
  /** Top-Umsatz im Fenster, nur Artikel mit positivem DB II. */
  running: MoverEntry[];
  /** Negativster DB II (absolut) im Fenster. */
  braking: MoverEntry[];
  /** Klasse "faellt_ab" (fensterunabhaengig), sortiert nach 365-T-Umsatz. */
  fading: MoverEntry[];
}

const LIMIT = 6;

function toEntry(a: ArticleAggregate, window: SaleWindowKey, images: ImageMap): Omit<MoverEntry, "relative"> {
  const w = a.windows[window];
  const revenue = w?.revenue ?? 0;
  const dbII = w?.dbII ?? 0;
  return {
    articleId: a.articleId,
    nameRaw: a.nameRaw,
    setCode: a.setCode,
    revenue,
    qty: w?.qty ?? 0,
    dbII,
    dbIIPercent: revenue > 0 ? dbII / revenue : 0,
    imageUrl: imageUrlFor(a.articleId, images),
  };
}

function withRelative(entries: Omit<MoverEntry, "relative">[], measure: (e: Omit<MoverEntry, "relative">) => number): MoverEntry[] {
  const top = entries.length > 0 ? Math.abs(measure(entries[0])) : 0;
  return entries.map((e) => ({ ...e, relative: top > 0 ? Math.abs(measure(e)) / top : 0 }));
}

export function buildMovers(
  articles: ArticleAggregate[],
  classified: ClassifiedArticle[],
  window: SaleWindowKey,
  images: ImageMap
): Movers {
  const running = withRelative(
    articles
      .filter((a) => (a.windows[window]?.qty ?? 0) > 0 && (a.windows[window]?.dbII ?? 0) > 0)
      .sort((a, b) => (b.windows[window]?.revenue ?? 0) - (a.windows[window]?.revenue ?? 0))
      .slice(0, LIMIT)
      .map((a) => toEntry(a, window, images)),
    (e) => e.revenue
  );

  const braking = withRelative(
    articles
      .filter((a) => (a.windows[window]?.qty ?? 0) > 0 && (a.windows[window]?.dbII ?? 0) < 0)
      .sort((a, b) => (a.windows[window]?.dbII ?? 0) - (b.windows[window]?.dbII ?? 0))
      .slice(0, LIMIT)
      .map((a) => toEntry(a, window, images)),
    (e) => e.dbII
  );

  const fading = withRelative(
    classified
      .filter((c) => c.articleClass === "faellt_ab")
      .sort((a, b) => (b.article.windows["365"]?.revenue ?? 0) - (a.article.windows["365"]?.revenue ?? 0))
      .slice(0, LIMIT)
      .map((c) => ({
        ...toEntry(c.article, "365", images),
        velocity: {
          perMonth90: (c.article.windows["90"]?.qty ?? 0) / 3,
          perMonth365: (c.article.windows["365"]?.qty ?? 0) / 12,
        },
      })),
    (e) => e.revenue
  );

  return { window, running, braking, fading };
}
