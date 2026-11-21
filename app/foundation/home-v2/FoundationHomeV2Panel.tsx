"use client";

import dynamic from "next/dynamic";

import type { ManagerOfficeClientProps } from "@/app/foundation/home-v2/ManagerOfficeClient";
import type { OfficeModernProps } from "@/app/foundation/office/OfficeModern";
import type { HomeV2ClientProps } from "@/app/foundation/home-v2/home-v2-types";
import FoundationPanelSkeleton from "@/components/foundation/FoundationPanelSkeleton";

const HomeV2Client = dynamic(() => import("@/app/foundation/home-v2/HomeV2Client"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton variant="homeV2" label="Home wird geladen…" />,
});

const ManagerOfficeClient = dynamic(
  () => import("@/app/foundation/home-v2/ManagerOfficeClient").then((mod) => mod.ManagerOfficeClient),
  {
    ssr: false,
    loading: () => <FoundationPanelSkeleton label="Office wird geladen…" />,
  },
);

const OfficeModern = dynamic(() => import("@/app/foundation/office/OfficeModern"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton label="Office wird geladen…" />,
});

export type FoundationHomeV2PanelProps = {
  active: boolean;
  tab: "overview" | "office";
  overview: HomeV2ClientProps;
  office: ManagerOfficeClientProps;
  /** Office im Broadcast-Stil (21.11). Fehlt es, bleibt die bisherige Ansicht (Kapitän, Front Office) allein stehen. */
  officeModern?: Omit<OfficeModernProps, "kabine">;
};

export default function FoundationHomeV2Panel({ active, tab, overview, office, officeModern }: FoundationHomeV2PanelProps) {
  if (!active) {
    return null;
  }

  return (
    <section className="panel foundation-home-v2-panel" id="foundation-home-v2" data-testid="foundation-home-v2">
      {tab === "overview" ? <HomeV2Client {...overview} /> : null}
      {tab === "office" && officeModern ? (
        <OfficeModern {...officeModern} kabine={<ManagerOfficeClient {...office} ohneVorstandBlock />} />
      ) : null}
      {tab === "office" && !officeModern ? <ManagerOfficeClient {...office} /> : null}
    </section>
  );
}
