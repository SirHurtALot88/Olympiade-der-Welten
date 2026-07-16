import type { ImportSummary } from "@/lib/pipeline/runImport";
import type { OpenReviewItem } from "@/lib/pipeline/review";

export type { ImportSummary, OpenReviewItem };

export interface ArticleSearchResult {
  id: string;
  nameRaw: string;
  setCode: string | null;
}
