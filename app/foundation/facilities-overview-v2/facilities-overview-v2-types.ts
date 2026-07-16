export type FacilitiesOverviewV2Snapshot = {
  facilityId: string;
  label: string;
  description: string;
  level: number;
  maxLevel: number;
  upkeep: number | null;
  effectDescription: string;
};

export type FacilitiesOverviewV2ClientProps = {
  teamName: string;
  teamCode: string;
  balance: number | null;
  facilityBudget: number | null;
  facilities: FacilitiesOverviewV2Snapshot[];
  boardMessage: string;
};
