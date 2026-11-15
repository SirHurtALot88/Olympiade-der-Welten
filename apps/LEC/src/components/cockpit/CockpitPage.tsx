import type { CockpitViewModel } from "@/lib/cockpit/viewModel";
import type { CostSettingsValues } from "@/lib/pricing/costSettings";
import { BetriebszahlenCard } from "@/components/einstellungen/BetriebszahlenCard";
import { AppShell } from "@/components/shell/AppShell";
import { WindowSwitch } from "./WindowSwitch";
import { KpiRow } from "./KpiRow";
import { BridgeCard } from "./BridgeCard";
import { GuardrailsCard } from "./GuardrailsCard";
import { TempoCard } from "./TempoCard";
import { DistributionCard } from "./DistributionCard";
import { CapitalCard } from "./CapitalCard";
import { dateDe, eur, pct } from "./format";

/** Zusammenbau der Cockpit-Seite (Server Component). Reihenfolge = COCKPIT_V2_KONZEPT §3. */
export function CockpitPage({ vm, costSettings }: { vm: CockpitViewModel; costSettings: CostSettingsValues }) {
  const latestImport = vm.imports.reduce<Date | null>((acc, i) => (i.createdAt && (!acc || i.createdAt > acc) ? i.createdAt : acc), null);
  return (
    <AppShell
      title="Finanzen"
      subtitle={
        <>
          {vm.totals.articles.toLocaleString("de-DE")} Kartenartikel · {vm.totals.active.toLocaleString("de-DE")} aktiv · Datenstand{" "}
          {dateDe(latestImport)}
        </>
      }
      topbarRight={<WindowSwitch current={vm.window} />}
      footer={
        <>
          <span className="ck-status">
            {vm.imports.length === 0 ? (
              <span>Noch kein Import — alle Module leer.</span>
            ) : (
              vm.imports.map((i) => (
                <span key={i.kind} title={i.fileName ?? undefined}>
                  <b>{i.label}</b> {dateDe(i.createdAt)}
                  {i.windowFrom && i.windowTo ? ` (${dateDe(i.windowFrom)}–${dateDe(i.windowTo)})` : ""}
                </span>
              ))
            )}
          </span>
          <span>Fixkosten {eur(vm.fixedYearly)}/Jahr aus den aktiven Kostensätzen · Planwerte aus src/lib/cockpit/planwerte.ts</span>
        </>
      }
    >
      <KpiRow vm={vm} />

      <div className="ck-grid">
        <BridgeCard bridge={vm.bridge} windowLabel={vm.windowLabel} />
        <GuardrailsCard guardrails={vm.guardrails} planwerte={vm.planwerte} />
      </div>

      <div className="ck-grid">
        <TempoCard bands={vm.bands} />
      </div>

      <div className="ck-grid">
        <DistributionCard
          title="Sortimentsgesundheit"
          scope="Klassen · alle Artikel · Umsatz 365 T"
          distribution={vm.classes}
          classPrefix="ck-k"
          linkBase="/sortiment?klasse="
          note="Klassen aus der regelbasierten Einstufung (Velocity 30/90/365 T, Momentum, DB II). Ladenhüter = 0 Verkäufe in 365 T trotz Historie oder Bestand."
        />
        <DistributionCard
          title="Marge auf eigenen EK"
          scope="Dein VK gegen deinen EK plus Kosten · aktive Artikel"
          distribution={vm.priceStatus}
          classPrefix="ck-p"
          note={`Rechnet mit deinem eigenen Einkaufspreis; das Urteil „zu günstig / zu teuer“ im Sortiment rechnet mit dem Marktwert. Aktueller Listen-VK gegen die Zielspanne: ${pct(vm.corridor.minMargin)} (Minimum) bis ${pct(vm.corridor.goodMargin)} (Optimum) Deckungsbeitrags-Marge vor Fixkosten, gerechnet mit dem EK des Artikels, mindestens 4,99 €. „Kein EK“ = ohne Einkaufspreis ist keine Spanne berechenbar — der Anteil zeigt, wie viel vom Sortiment preislich blind ist.`}
        />
      </div>

      <div className="ck-grid">
        <CapitalCard capital={vm.capital} planwerte={vm.planwerte} />
      </div>

      <details className="ck-card" style={{ marginTop: 14 }}>
        <summary style={{ cursor: "pointer", padding: "12px 16px", fontWeight: 700, fontSize: 13 }}>Betriebszahlen je Jahr · 2022 bis 2026</summary>
        <BetriebszahlenCard settings={costSettings} />
      </details>
    </AppShell>
  );
}
