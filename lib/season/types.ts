export type SeasonModulePlaceholder = {
  status: "planned";
};

export type PrizeMoneyRow = {
  rank: number;
  basis: number;
  percent: number;
  diff: number;
  seasonShare: number;
  totalPrizeMoney: number;
};

export type SponsorPlacementRow = {
  rankDelta: number;
  placement: number;
  percent: number;
};

export type TeamPrizeSummaryRow = {
  teamId: string;
  teamName: string;
  place: number;
  startPlace: number;
  rankDiff: number;
  salary: number;
  cash: number;
  transfers: number;
  basis: number;
  sponsorSeason: number;
  placementBonus: number;
  sponsorTotal: number;
  profitLoss: number;
  cashForecast: number;
  cashTotal: number;
};
