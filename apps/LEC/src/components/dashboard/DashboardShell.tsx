"use client";

import { useMemo, useState } from "react";
import type { DashboardViewModel } from "@/lib/dashboard/viewModel";
import type { SaleWindowKey } from "@/lib/parsing/date";
import { AppShell } from "@/components/shell/AppShell";
import { KpiRow } from "./KpiRow";
import { MoversPanels } from "./MoversPanels";
import { OperatingQuotas } from "./OperatingQuotas";
import { TASKS, taskCounts } from "@/lib/dashboard/tasks";
import { findDuplicateGroups } from "@/lib/dashboard/board";

interface Props {
  viewModel: DashboardViewModel;
}


export function DashboardShell({ viewModel }: Props) {
  const [selectedWindow, setSelectedWindow] = useState<SaleWindowKey>("90");
  const counts = useMemo(() => taskCounts(viewModel.sortiment, new Set(findDuplicateGroups(viewModel.sortiment).keys())), [viewModel.sortiment]);

  return (
    <AppShell
      title="Dashboard"
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
      <nav className="today-row" aria-label="Heute zu tun">
        <b>Heute</b>
        {TASKS.filter((t) => t.key !== "alle").map((t) => (
          <a key={t.key} href={`/sortiment?aufgabe=${t.key}`} className={`today-chip${counts[t.key] > 0 ? " todo" : " zero"}`} title={t.hint}>
            {t.label} <i>{counts[t.key] > 0 ? counts[t.key].toLocaleString("de-DE") : "✓"}</i>
          </a>
        ))}
      </nav>

      <KpiRow
        windows={viewModel.windows}
        selected={selectedWindow}
        onSelect={setSelectedWindow}
        deadCapital={viewModel.deadCapital}
      />

      <MoversPanels good={viewModel.moversGood} bad={viewModel.moversBad} />

      <section className="grid-2">
        <OperatingQuotas quotas={viewModel.quotas} />
        <div className="card" style={{ padding: "15px 16px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Weiter</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a className="chip" href="/sortiment" title="Alle Artikel mit Preis-Urteil, Bestand und Verkäufen.">Sortiment ({viewModel.sortiment.length}) →</a>
            <a className="chip" href="/empfehlungen" title="Alle Empfehlungen (EK pflegen, Preise, Kapitalbinder).">Empfehlungen ({viewModel.recommendations.length}) →</a>
            <a className="chip" href="/cockpit" title="Finanzen: Marge, Kapital, Tempo.">Finanzen →</a>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
