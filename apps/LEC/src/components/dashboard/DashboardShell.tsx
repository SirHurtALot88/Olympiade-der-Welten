"use client";

import { useState } from "react";
import type { DashboardViewModel } from "@/lib/dashboard/viewModel";
import type { SaleWindowKey } from "@/lib/parsing/date";
import { Sidebar } from "./Sidebar";
import { KpiRow } from "./KpiRow";
import { MoversPanels } from "./MoversPanels";
import { SortimentTable } from "./SortimentTable";
import { OperatingQuotas } from "./OperatingQuotas";
import { Recommendations } from "./Recommendations";
import { CardmarketPlaceholder } from "./CardmarketPlaceholder";

interface Props {
  viewModel: DashboardViewModel;
}

export function DashboardShell({ viewModel }: Props) {
  const [selectedWindow, setSelectedWindow] = useState<SaleWindowKey>("90");

  return (
    <div className="app">
      <Sidebar />
      <main>
        <div className="topbar">
          <div>
            <h1>Cockpit</h1>
            <div className="sub">Was läuft — und was Kapital bindet</div>
          </div>
          <div className="spacer" />
        </div>

        <KpiRow
          windows={viewModel.windows}
          selected={selectedWindow}
          onSelect={setSelectedWindow}
          deadCapital={viewModel.deadCapital}
        />

        <MoversPanels good={viewModel.moversGood} bad={viewModel.moversBad} />

        <SortimentTable rows={viewModel.sortiment} />

        <section className="grid-2">
          <CardmarketPlaceholder />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <OperatingQuotas quotas={viewModel.quotas} />
            <Recommendations recommendations={viewModel.recommendations} />
          </div>
        </section>

        <footer>
          <span className="tag">Live</span>
          <span>
            Datenbasis: {viewModel.totals.cardArticleCount} Kartenartikel · Billbee 30/90/365T/Lebenszeit ·
            eBay-Report
          </span>
          <span>Alle Zahlen serverseitig aus den importierten Exporten berechnet.</span>
        </footer>
      </main>
    </div>
  );
}
