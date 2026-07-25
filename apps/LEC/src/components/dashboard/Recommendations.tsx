import type { Recommendation } from "@/lib/dashboard/viewModel";

/** Icon/Chip-Zuordnung je Empfehlungstyp -- wiederverwendet von /empfehlungen. */
export const RECOMMENDATION_ICONS: Record<Recommendation["kind"], { cls: string; icon: string }> = {
  auslisten: { cls: "p-crit", icon: "↓" },
  preis_anpassen: { cls: "p-warn", icon: "€" },
  nachkaufen: { cls: "p-good", icon: "↑" },
  lot_bilden: { cls: "p-mkt", icon: "◧" },
};

export const RECOMMENDATION_CHIPS: Record<Recommendation["kind"], { cls: string; label: string }> = {
  auslisten: { cls: "c-crit", label: "Auslisten" },
  preis_anpassen: { cls: "c-warn", label: "Preis anpassen" },
  nachkaufen: { cls: "c-good", label: "Nachkaufen" },
  lot_bilden: { cls: "c-mkt", label: "Lot bilden" },
};
const ICONS = RECOMMENDATION_ICONS;
const CHIPS = RECOMMENDATION_CHIPS;

interface Props {
  recommendations: Recommendation[];
  /** Gesamtzahl (falls die Liste hier nur ein Ausschnitt ist), fuer den "Alle ansehen"-Teaser. */
  totalCount?: number;
}

export function Recommendations({ recommendations, totalCount }: Props) {
  const showMoreLink = totalCount !== undefined && totalCount > recommendations.length;
  return (
    <div className="card" style={{ padding: "6px 14px 8px" }}>
      <h3 style={{ padding: "12px 4px 6px" }}>
        KI-Empfehlungen <span className="r">regelbasiert · Stufe 1</span>
        {showMoreLink && (
          <a href="/empfehlungen" className="col-reset" style={{ textDecoration: "none", marginLeft: 10 }}>
            Alle {totalCount} ansehen →
          </a>
        )}
      </h3>
      {recommendations.length === 0 && (
        <div style={{ padding: "10px 8px", fontSize: 12.5, color: "var(--faint)" }}>
          Keine Auffälligkeiten in den aktuellen Daten.
        </div>
      )}
      {recommendations.map((rec, i) => {
        const icon = ICONS[rec.kind];
        const chip = CHIPS[rec.kind];
        return (
          <div className="rec" key={rec.id ?? i}>
            <div className={`ico ${icon.cls}`}>{icon.icon}</div>
            <div className="tx">
              <b>{rec.title}</b> <span>{rec.detail}</span>
              <div className="racts">
                <span className={`chip ${chip.cls}`}>{chip.label}</span>
                <span className="eff">{rec.effect}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
