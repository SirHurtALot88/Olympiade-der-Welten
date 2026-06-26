"use client";

import dynamic from "next/dynamic";

import type { ManagerOfficeClientProps } from "@/app/foundation/home-v2/ManagerOfficeClient";
import type { HomeV2ClientProps } from "@/app/foundation/home-v2/home-v2-types";

const HomeV2Client = dynamic(() => import("@/app/foundation/home-v2/HomeV2Client"), {
  ssr: false,
  loading: () => <p className="foundation-view-loading">Home wird geladen …</p>,
});

const ManagerOfficeClient = dynamic(
  () => import("@/app/foundation/home-v2/ManagerOfficeClient").then((mod) => mod.ManagerOfficeClient),
  {
    ssr: false,
    loading: () => <p className="foundation-view-loading">Office wird geladen …</p>,
  },
);

export type FoundationHomeV2PanelProps = {
  active: boolean;
  tab: "overview" | "office";
  overview: HomeV2ClientProps;
  office: ManagerOfficeClientProps;
};

export default function FoundationHomeV2Panel({ active, tab, overview, office }: FoundationHomeV2PanelProps) {
  if (!active) {
    return null;
  }

  return (
    <section className="panel foundation-home-v2-panel" id="foundation-home-v2">
      {tab === "overview" ? <HomeV2Client {...overview} /> : null}
      {tab === "office" ? <ManagerOfficeClient {...office} /> : null}
    </section>
  );
}
