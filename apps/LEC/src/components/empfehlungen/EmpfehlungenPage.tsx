"use client";

import { useEffect, useMemo, useState } from "react";
import type { Recommendation } from "@/lib/dashboard/viewModel";
import { formatEuro } from "@/lib/format";
import { AppShell } from "@/components/shell/AppShell";
import { RECOMMENDATION_ICONS, RECOMMENDATION_CHIPS } from "@/components/dashboard/Recommendations";

type Kind = Recommendation["kind"];
const KIND_ORDER: Kind[] = ["auslisten", "preis_anpassen", "nachkaufen", "lot_bilden"];
const DISMISSED_KEY = "lec.empfehlungen.dismissed.v1";
const PAGE_SIZE = 100;

interface Kpis {
  boundCapital: number;
  lowRunnerLoss: number;
  givenAwayMargin: number;
  nachkaufCount: number;
}

interface Props {
  recommendations: Recommendation[];
  kpis: Kpis;
}

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
    return Array.isArray(raw) ? new Set(raw) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore */
  }
}

export function EmpfehlungenPage({ recommendations, kpis }: Props) {
  const [kindFilter, setKindFilter] = useState<Set<Kind>>(new Set());
  const [sortMode, setSortMode] = useState<"effekt" | "dringlichkeit">("effekt");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expandedLot, setExpandedLot] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setDismissed(loadDismissed());
  }, []);

  function toggleKind(k: Kind) {
    setKindFilter((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
    setVisibleCount(PAGE_SIZE);
  }

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }

  function resetDismissed() {
    setDismissed(new Set());
    saveDismissed(new Set());
  }

  const visible = useMemo(() => {
    let result = recommendations.filter((r) => !dismissed.has(r.id));
    if (kindFilter.size > 0) result = result.filter((r) => kindFilter.has(r.kind));
    const copy = [...result];
    if (sortMode === "dringlichkeit") {
      copy.sort((a, b) => {
        const kindDiff = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
        if (kindDiff !== 0) return kindDiff;
        return Math.abs(b.effectValue) - Math.abs(a.effectValue);
      });
    }
    // sortMode === "effekt": Reihenfolge aus buildRecommendations() (bereits |€-Effekt| absteigend) beibehalten.
    return copy;
  }, [recommendations, dismissed, kindFilter, sortMode]);

  const hiddenCount = recommendations.length - recommendations.filter((r) => !dismissed.has(r.id)).length;
  const shown = visible.slice(0, visibleCount);

  return (
    <AppShell
      title="Empfehlungen"
      subtitle={`${recommendations.length} Handlungsempfehlungen · regelbasiert, Stufe 1`}
      topbarRight={
        <div className="seg">
          <button type="button" className={sortMode === "effekt" ? "on" : undefined} onClick={() => setSortMode("effekt")}>
            €-Effekt
          </button>
          <button
            type="button"
            className={sortMode === "dringlichkeit" ? "on" : undefined}
            onClick={() => setSortMode("dringlichkeit")}
          >
            Dringlichkeit
          </button>
        </div>
      }
      footer={<span>Regelbasiertes Scoring (KONZEPT §8, Stufe 1) — die KI liefert Erklärung/Priorisierung, die Zahl bleibt die Wahrheit.</span>}
    >
      <section className="grid-kpi">
        <div className="card kpi">
          <div className="lab">
            Gebundenes Kapital <span>· Ladenhüter</span>
          </div>
          <div className="val">
            € <span className="num">{formatEuro(kpis.boundCapital)}</span>
          </div>
        </div>
        <div className="card kpi" style={{ borderColor: "var(--crit)" }}>
          <div className="lab" style={{ color: "var(--crit)" }}>
            Verlust p.a. <span>· Low-Runner</span>
          </div>
          <div className="val" style={{ color: "var(--crit)" }}>
            € <span className="num">{formatEuro(kpis.lowRunnerLoss)}</span>
          </div>
        </div>
        <div className="card kpi" style={{ borderColor: "var(--warn)" }}>
          <div className="lab" style={{ color: "var(--warn)" }}>
            Verschenkte Marge <span>· VK &lt; MIN</span>
          </div>
          <div className="val" style={{ color: "var(--warn)" }}>
            € <span className="num">{kpis.givenAwayMargin.toFixed(2)}</span> <small>/ Stk (Summe)</small>
          </div>
        </div>
        <div className="card kpi" style={{ borderColor: "var(--good)" }}>
          <div className="lab" style={{ color: "var(--good)" }}>
            Nachkauf-Kandidaten
          </div>
          <div className="val" style={{ color: "var(--good)" }}>
            <span className="num">{kpis.nachkaufCount}</span>
          </div>
        </div>
      </section>

      <div className="filterrow">
        {KIND_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            className={`chip ${RECOMMENDATION_CHIPS[k].cls}${kindFilter.has(k) ? " on" : ""}`}
            onClick={() => toggleKind(k)}
          >
            {RECOMMENDATION_CHIPS[k].label}
          </button>
        ))}
        {hiddenCount > 0 && (
          <button type="button" className="chip" onClick={resetDismissed}>
            {hiddenCount} ausgeblendet · zurücksetzen
          </button>
        )}
        <span className="count">
          {visible.length} von {recommendations.length}
        </span>
      </div>

      <section className="card" style={{ padding: "6px 14px 8px" }}>
        {visible.length === 0 && (
          <div style={{ padding: "16px 8px", fontSize: 12.5, color: "var(--faint)" }}>
            Keine Empfehlungen für diesen Filter.
          </div>
        )}
        {shown.map((rec) => {
          const icon = RECOMMENDATION_ICONS[rec.kind];
          const chip = RECOMMENDATION_CHIPS[rec.kind];
          const isLot = rec.kind === "lot_bilden" && rec.items && rec.items.length > 0;
          return (
            <div className="rec" key={rec.id} style={{ alignItems: "flex-start" }}>
              <div className={`ico ${icon.cls}`}>{icon.icon}</div>
              <div className="tx" style={{ flex: 1, minWidth: 0 }}>
                <b>{rec.title}</b> <span>{rec.detail}</span>
                <div className="racts">
                  <span className={`chip ${chip.cls}`}>{chip.label}</span>
                  <span className="eff">{rec.effect}</span>
                  {!isLot && rec.linkQuery && (
                    <a href={`/sortiment?q=${encodeURIComponent(rec.linkQuery)}`} className="chip" style={{ textDecoration: "none" }}>
                      Im Sortiment ansehen →
                    </a>
                  )}
                  {isLot && (
                    <button type="button" className="chip" onClick={() => setExpandedLot((v) => !v)}>
                      {expandedLot ? "Liste einklappen ▲" : "Liste aufklappen ▼"}
                    </button>
                  )}
                  <button type="button" className="chip" onClick={() => dismiss(rec.id)}>
                    Ausblenden
                  </button>
                </div>
                {isLot && expandedLot && (
                  <div
                    style={{
                      marginTop: 10,
                      maxHeight: 320,
                      overflowY: "auto",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--r-sm)",
                    }}
                  >
                    {rec.items!.map((item) => (
                      <div
                        key={item.articleId}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "7px 10px",
                          borderBottom: "1px solid var(--line)",
                          fontSize: 12,
                        }}
                      >
                        <span style={{ minWidth: 0 }}>
                          {item.nameRaw}
                          {item.setCode && <span className="code" style={{ marginLeft: 8 }}>{item.setCode}</span>}
                        </span>
                        <span className="num" style={{ flex: "none", color: "var(--faint)" }}>
                          € {item.boundCapital.toFixed(0)}
                        </span>
                      </div>
                    ))}
                    <div style={{ padding: "8px 10px" }}>
                      <a href="/sortiment?klasse=ladenhueter" style={{ fontSize: 11.5, color: "var(--market)" }}>
                        Vollständige Liste in /sortiment ansehen →
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
      {visibleCount < visible.length && (
        <div className="loadmore">
          <button type="button" className="chip" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
            Mehr laden ({visible.length - visibleCount} weitere)
          </button>
        </div>
      )}
    </AppShell>
  );
}
