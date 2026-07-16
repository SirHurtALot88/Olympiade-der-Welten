import type { SaleWindowKey } from "../parsing/date";
import type { ArticleClass } from "../pricing/classification";
import type { ArticleAggregate, ClassifiedArticle } from "./viewModel";

/** Eine Zeile einer Top/Flop-Rangliste -- generischer Baustein fuer `RankList` (PAGES_CONCEPT §2). */
export interface RankItem {
  articleId: string;
  nameRaw: string;
  setCode: string | null;
  /** Numerischer Wert, der die Balkenlaenge (relativ zu Platz 1) bestimmt. */
  barValue: number;
  /** Formatierter Hauptwert (z. B. "€ 151" oder "38 %"). */
  valueLabel: string;
  meta: string[];
  fallingBadge?: boolean;
}

export interface TopFlopResult {
  window: SaleWindowKey;
  topSeller: RankItem[];
  marginChampions: RankItem[];
  lowRunner: RankItem[];
  ladenhueter: RankItem[];
  ladenhueterCount: number;
  ladenhueterBoundCapital: number;
}

function pct(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function shortName(name: string): string {
  return name.replace(/^Yu-Gi-Oh!\s*/i, "");
}

/** Kompakte, JSON-serialisierbare Klassifikations-Zuordnung (fuer den Client-Uebergang). */
export type ClassByArticleId = Record<string, ArticleClass>;

export function classifiedToRecord(classified: ClassifiedArticle[]): ClassByArticleId {
  const record: ClassByArticleId = {};
  for (const c of classified) record[c.article.articleId] = c.articleClass;
  return record;
}

/**
 * Baut die vier Top/Flop-Ranglisten fuer ein gewaehltes Fenster (PAGES_CONCEPT §2):
 * Top-Seller + Margen-Champions sind fensterabhaengig, Low-Runner + Ladenhueter
 * bewusst fensterunabhaengig (Lebenszeit-Kennzahlen, siehe KONZEPT §2 Bundle-Falle).
 */
export function buildTopFlop(
  articles: ArticleAggregate[],
  classByArticleId: ClassByArticleId,
  window: SaleWindowKey
): TopFlopResult {
  const classByArticle = new Map(Object.entries(classByArticleId)) as Map<string, ArticleClass>;

  const topSellerSource = articles
    .filter((a) => (a.windows[window]?.revenue ?? 0) > 0)
    .sort((a, b) => (b.windows[window]?.revenue ?? 0) - (a.windows[window]?.revenue ?? 0))
    .slice(0, 10);
  const topSeller: RankItem[] = topSellerSource.map((a) => {
    const w = a.windows[window]!;
    return {
      articleId: a.articleId,
      nameRaw: shortName(a.nameRaw),
      setCode: a.setCode,
      barValue: w.revenue,
      valueLabel: `€ ${w.revenue.toFixed(0)}`,
      meta: [`${w.qty} Stk`, `DB II ${(pct(w.dbII, w.revenue) * 100).toFixed(0)} %`],
      fallingBadge: classByArticle.get(a.articleId) === "faellt_ab",
    };
  });

  const marginChampionsSource = articles
    .filter((a) => (a.windows[window]?.qty ?? 0) >= 3)
    .sort((a, b) => pct(b.windows[window]!.dbII, b.windows[window]!.revenue) - pct(a.windows[window]!.dbII, a.windows[window]!.revenue))
    .slice(0, 10);
  const marginChampions: RankItem[] = marginChampionsSource.map((a) => {
    const w = a.windows[window]!;
    const dbIIPct = pct(w.dbII, w.revenue);
    return {
      articleId: a.articleId,
      nameRaw: shortName(a.nameRaw),
      setCode: a.setCode,
      barValue: dbIIPct,
      valueLabel: `${(dbIIPct * 100).toFixed(0)} %`,
      meta: [`${w.qty} Stk`, `€ ${w.revenue.toFixed(0)} Umsatz`],
    };
  });

  const lowRunnerSource = articles
    .filter((a) => (a.windows.all?.qty ?? 0) > 0 && (a.windows.all?.dbII ?? 0) < 0)
    .sort((a, b) => pct(a.windows.all!.dbII, a.windows.all!.revenue) - pct(b.windows.all!.dbII, b.windows.all!.revenue))
    .slice(0, 10);
  const lowRunner: RankItem[] = lowRunnerSource.map((a) => {
    const w = a.windows.all!;
    return {
      articleId: a.articleId,
      nameRaw: shortName(a.nameRaw),
      setCode: a.setCode,
      barValue: Math.abs(pct(w.dbII, w.revenue)),
      valueLabel: `${(pct(w.dbII, w.revenue) * 100).toFixed(0)} %`,
      meta: [`${w.qty} Stk verkauft`, `DB II € ${w.dbII.toFixed(0)}`],
    };
  });

  const allLadenhueter = articles.filter((a) => classByArticle.get(a.articleId) === "ladenhueter");
  const ladenhueterBoundCapital = allLadenhueter.reduce((sum, a) => sum + (a.windows.all?.ek ?? 0), 0);
  const ladenhueterSource = [...allLadenhueter]
    .sort((a, b) => (b.windows.all?.ek ?? 0) - (a.windows.all?.ek ?? 0))
    .slice(0, 10);
  const ladenhueter: RankItem[] = ladenhueterSource.map((a) => {
    const ek = a.windows.all?.ek ?? 0;
    return {
      articleId: a.articleId,
      nameRaw: shortName(a.nameRaw),
      setCode: a.setCode,
      barValue: ek,
      valueLabel: `€ ${ek.toFixed(0)} gebunden`,
      meta: [`${a.windows.all?.qty ?? 0} Stk verkauft (Lebenszeit)`, "0 Verk. in 365 T"],
    };
  });

  return {
    window,
    topSeller,
    marginChampions,
    lowRunner,
    ladenhueter,
    ladenhueterCount: allLadenhueter.length,
    ladenhueterBoundCapital,
  };
}
