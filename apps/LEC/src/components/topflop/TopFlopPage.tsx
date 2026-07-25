"use client";

import { useMemo, useState } from "react";
import type { SaleWindowKey } from "@/lib/parsing/date";
import type { ArticleAggregate } from "@/lib/dashboard/viewModel";
import { buildTopFlop, type ClassByArticleId } from "@/lib/dashboard/topFlop";
import { AppShell } from "@/components/shell/AppShell";
import { RankList } from "./RankList";
import { formatEuro } from "@/lib/format";

const WINDOW_ORDER: { key: SaleWindowKey; label: string }[] = [
  { key: "30", label: "30 T" },
  { key: "90", label: "90 T" },
  { key: "365", label: "365 T" },
];

interface Props {
  articles: ArticleAggregate[];
  classByArticleId: ClassByArticleId;
}

export function TopFlopPage({ articles, classByArticleId }: Props) {
  const [window, setWindow] = useState<SaleWindowKey>("90");

  const result = useMemo(
    () => buildTopFlop(articles, classByArticleId, window),
    [articles, classByArticleId, window]
  );

  const windowLabel = WINDOW_ORDER.find((w) => w.key === window)?.label ?? window;

  return (
    <AppShell
      title="Top / Flop"
      subtitle="Top-Seller, Margen-Champions, Low-Runner und Ladenhüter auf einen Blick"
      topbarRight={
        <div className="seg">
          {WINDOW_ORDER.map((w) => (
            <button key={w.key} type="button" className={window === w.key ? "on" : undefined} onClick={() => setWindow(w.key)}>
              {w.label}
            </button>
          ))}
        </div>
      }
      footer={
        <span>
          Top-Seller/Margen-Champions: {windowLabel} · Low-Runner/Ladenhüter: fensterunabhängig
          (Lebenszeit-Kennzahlen).
        </span>
      }
    >
      <section className="grid-2">
        <RankList
          title="Top-Seller"
          subtitle={`Top 10 Umsatz · ${windowLabel}`}
          accentVar="--good"
          items={result.topSeller}
          emptyText={`Noch keine Verkäufe im ${windowLabel}-Fenster.`}
        />
        <RankList
          title="Margen-Champions"
          subtitle={`Top 10 DB II % · ${windowLabel} · ab 3 Stk`}
          accentVar="--accent"
          items={result.marginChampions}
          emptyText="Keine Artikel mit ausreichend Verkäufen in diesem Fenster."
        />
        <RankList
          title="Low-Runner"
          subtitle="Schlechteste DB II % · Lebenszeit"
          accentVar="--crit"
          items={result.lowRunner}
          emptyText="Keine Verlust-Artikel gefunden."
        />
        <RankList
          title="Ladenhüter"
          subtitle="0 Verkäufe in 365 T trotz Historie"
          accentVar="--warn"
          items={result.ladenhueter}
          headerNote={`≈ € ${formatEuro(result.ladenhueterBoundCapital)} gebunden · ${result.ladenhueterCount} Artikel`}
          emptyText="Keine Ladenhüter gefunden."
        />
      </section>
    </AppShell>
  );
}
