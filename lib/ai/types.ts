export type AiNeedSummary = {
  teamId: string;
  rosterCount: number;
  rosterGap: number;
  budgetPressure: number;
  upkeepPressure: number;
  axisDeficits: {
    pow: number;
    spe: number;
    men: number;
    soc: number;
  };
  uncoveredNeedAxes: Array<"pow" | "spe" | "men" | "soc">;
  topNeedDisciplineIds: string[];
  overallNeedScore: number;
};

export type AiTransferIntent = {
  teamId: string;
  listingId: string;
  score: number;
  action: "buy" | "watch" | "skip";
};

export type AiTurnResult = {
  teamId: string;
  summary: string;
  needs: AiNeedSummary;
  transferIntents: AiTransferIntent[];
};
