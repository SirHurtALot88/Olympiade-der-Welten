"use client";

import { useState } from "react";
import type { DashboardViewModel } from "@/lib/dashboard/viewModel";
import type { SaleWindowKey } from "@/lib/parsing/date";
import { AppShell } from "@/components/shell/AppShell";
import { KpiRow } from "./KpiRow";
import { MoversPanels } from "./MoversPanels";
import { SortimentTable } from "./SortimentTable";
import { OperatingQuotas } from "./OperatingQuotas";
import { Recommendations } from "./Recommendations";
import { CardmarketPlaceholder } from "./CardmarketPlaceholder";

interface Props {
  viewModel: DashboardViewModel;
}

const SORTIMENT_PREVIEW_LIMIT = 8;

export function DashboardShell({ viewModel }: Props) {
  const [selectedWindow, setSelectedWindow] = useState<SaleWindowKey>("90");

  return (
    <AppShell
      title="Cockpit"
      subtitle="Was läuft — und was Kapital bindet"
      footer={
        <>
          <span>
            Datenbasis: {viewModel.totals.cardArticleCount} Kartenartikel · Billbee 30/90/365T/Lebenszeit ·
            eBay-Report
          </span>
          <span>Alle Zahlen serverseitig aus den importierten Exporten berechnet.</span>
        </>
      }
    >
      <KpiRow
        windows={viewModel.windows}
        selected={selectedWindow}
        onSelect={setSelectedWindow}
        deadCapital={viewModel.deadCapital}
      />

      <MoversPanels good={viewModel.moversGood} bad={viewModel.moversBad} />

      <SortimentTable
        rows={viewModel.sortiment}
        limit={SORTIMENT_PREVIEW_LIMIT}
        headerExtra={
          <a className="col-reset" href="/sortiment" style={{ textDecoration: "none" }}>
            Alle {viewModel.sortiment.length} ansehen →
          </a>
        }
      />

      <section className="grid-2">
        <CardmarketPlaceholder />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <OperatingQuotas quotas={viewModel.quotas} />
          <Recommendations
            recommendations={viewModel.recommendations.slice(0, 4)}
            totalCount={viewModel.recommendations.length}
          />
        </div>
      </section>
    </AppShell>
  );
}
