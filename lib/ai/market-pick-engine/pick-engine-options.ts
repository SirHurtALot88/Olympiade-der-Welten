export type PickEngineMode = "s1_draft" | "market_preseason";

export type PickEngineOptions = {
  mode: PickEngineMode;
  premiumFirst: boolean;
  draftSeed?: string | null;
};
