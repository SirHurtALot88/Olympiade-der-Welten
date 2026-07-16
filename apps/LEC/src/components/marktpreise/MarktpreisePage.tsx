"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MarketComparisonRow } from "@/lib/dashboard/marketComparison";
import { formatEuroCents, formatPercent } from "@/lib/format";
import { AppShell } from "@/components/shell/AppShell";
import { Corridor } from "@/components/dashboard/SortimentTable";
import { MarketPriceForm, type SelectedArticle } from "./MarketPriceForm";
import { MarketComparisonTable } from "./MarketComparisonTable";

const STATUS_TILE: Record<MarketComparisonRow["status"], { cls: string; label: string }> = {
  zu_guenstig: { cls: "p-warn", label: "zu günstig ggü. Markt" },
  im_korridor: { cls: "p-good", label: "im Korridor" },
  zu_teuer: { cls: "p-crit", label: "zu teuer ggü. Markt" },
};

interface Props {
  rows: MarketComparisonRow[];
}

export function MarktpreisePage({ rows }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedArticle | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  const detailRow = rows.find((r) => r.articleId === selectedArticleId) ?? null;

  function handleSelectFromForm(article: SelectedArticle) {
    setSelected(article);
    setSelectedArticleId(article.id);
  }

  function handleSelectFromTable(articleId: string) {
    const row = rows.find((r) => r.articleId === articleId);
    if (row) {
      setSelected({ id: row.articleId, nameRaw: row.nameRaw, setCode: row.setCode, packQty: row.packQty });
      setSelectedArticleId(articleId);
    }
  }

  function handleSaved() {
    router.refresh();
  }

  return (
    <AppShell
      title="Marktpreise"
      subtitle="Cardmarket-Vergleich · Provider B, manuell erfasst"
      footer={<span>{rows.length} Artikel mit erfasstem Marktpreis · eigener VK/EK vs. Cardmarket.</span>}
    >
      <MarketPriceForm onSelect={handleSelectFromForm} selected={selected} onSaved={handleSaved} />

      <section style={{ marginTop: 16, marginBottom: 16 }}>
        {detailRow ? (
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="card">
              <h3>
                Preis-Details <span className="r">{detailRow.nameRaw}</span>
              </h3>
              <div className="price">
                <div className="pricegrid">
                  <div className="pcell">
                    <div className="k">Markt ab</div>
                    <div className="v">{detailRow.marketFrom !== null ? `${formatEuroCents(detailRow.marketFrom)} €` : "—"}</div>
                  </div>
                  <div className="pcell">
                    <div className="k">Markt Trend</div>
                    <div className="v">{detailRow.marketTrend !== null ? `${formatEuroCents(detailRow.marketTrend)} €` : "—"}</div>
                  </div>
                  <div className="pcell">
                    <div className="k">Eigener VK</div>
                    <div className="v">{detailRow.ownVk > 0 ? `${formatEuroCents(detailRow.ownVk)} €` : "—"}</div>
                  </div>
                  <div className="pcell">
                    <div className="k">Eigener EK/Stk</div>
                    <div className="v">{detailRow.ek > 0 ? `${formatEuroCents(detailRow.ek)} €` : "—"}</div>
                  </div>
                </div>
                <div className="calc">
                  <div className="row">
                    <span className="muted">Markt "ab" × Packgröße ({detailRow.packQty}×)</span>
                    <span>
                      {detailRow.marketFrom !== null ? `${formatEuroCents(detailRow.marketFrom * detailRow.packQty)} €` : "—"}
                    </span>
                  </div>
                  <div className="row">
                    <span className="muted">+ Einkaufs-Versand</span>
                    <span>
                      {detailRow.marketEk !== null
                        ? `${formatEuroCents(detailRow.marketEk - detailRow.marketFrom! * detailRow.packQty)} €`
                        : "—"}
                    </span>
                  </div>
                  <div className="row tot">
                    <span>= Markt-EK</span>
                    <span>{detailRow.marketEk !== null ? `${formatEuroCents(detailRow.marketEk)} €` : "—"}</span>
                  </div>
                  <div
                    className="row"
                    style={{
                      color:
                        detailRow.marketEk !== null && detailRow.ek > detailRow.marketEk ? "var(--crit)" : "var(--good)",
                      fontWeight: 700,
                    }}
                  >
                    <span>ggü. eigenem EK/Stk ({formatEuroCents(detailRow.ek)} €)</span>
                    <span>
                      {detailRow.marketEk !== null
                        ? detailRow.ek > detailRow.marketEk
                          ? "EK zu hoch — Nachkauf-/Auslist-Signal"
                          : "EK im Rahmen"
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: "15px 16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, marginBottom: 8 }}>
                  Preis-Korridor <span style={{ color: "var(--faint)" }}>· eigener VK vs. MIN/GUT + Markt-Trend</span>
                </div>
                <Corridor
                  min={detailRow.corridor.min}
                  good={detailRow.corridor.good}
                  vk={detailRow.ownVk}
                  marketValue={detailRow.marketTrend}
                />
              </div>
              <div>
                <span className={`pill ${STATUS_TILE[detailRow.status].cls}`} style={{ fontSize: 12.5, padding: "6px 12px" }}>
                  <span className="dot" />
                  {STATUS_TILE[detailRow.status].label}
                </span>
                {detailRow.deltaPercent !== null && (
                  <span style={{ marginLeft: 10, fontSize: 12, color: "var(--faint)" }}>
                    Δ VK↔Trend: {detailRow.deltaPercent > 0 ? "+" : ""}
                    {formatPercent(detailRow.deltaPercent)}% (±15 % gilt als neutral)
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="card"
            style={{
              padding: "18px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              border: "1px dashed var(--border)",
            }}
          >
            <b>Noch kein Artikel ausgewählt.</b>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              Oben einen Artikel suchen und Preisdaten erfassen, oder unten eine Zeile in der Vergleichstabelle anklicken.
            </span>
          </div>
        )}
      </section>

      <MarketComparisonTable rows={rows} selectedArticleId={selectedArticleId} onSelectRow={handleSelectFromTable} />
    </AppShell>
  );
}
