"use client";

import { useSaisonstandLook } from "@/lib/season/saisonstand-look";
import SeasonStandingsV2Client, {
  type SeasonStandingsV2ClientProps,
} from "@/app/foundation/season-v2/SeasonStandingsV2Client";

export type FoundationSeasonV2PanelProps = {
  active: boolean;
} & SeasonStandingsV2ClientProps;

export default function FoundationSeasonV2Panel({ active, ...clientProps }: FoundationSeasonV2PanelProps) {
  const [look] = useSaisonstandLook();
  if (!active) {
    return null;
  }

  return (
    <section className={`panel foundation-season-v2-panel${look === "modern" ? " foundation-season-v2-panel--bc" : ""}`} id="foundation-season-v2" data-testid="foundation-season-v2">
      <SeasonStandingsV2Client {...clientProps} />
    </section>
  );
}
