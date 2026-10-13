import type { CockpitViewModel } from "@/lib/cockpit/viewModel";
import { AppShell } from "@/components/shell/AppShell";
import { WindowSwitch } from "./WindowSwitch";
import { KpiRow } from "./KpiRow";
import { BridgeCard } from "./BridgeCard";
import { GuardrailsCard } from "./GuardrailsCard";
import { TempoCard } from "./TempoCard";
import { DistributionCard } from "./DistributionCard";
import { MoversCard } from "./MoversCard";
import { CapitalCard } from "./CapitalCard";
import { dateDe, eur } from "./format";

/** Zusammenbau der Cockpit-Seite (Server Component). Reihenfolge = COCKPIT_V2_KONZEPT §3. */
export function CockpitPage({ vm }: { vm: CockpitViewModel }) {
  const latestImport = vm.imports.reduce<Date | null>((acc, i) => (i.createdAt && (!acc || i.createdAt > acc) ? i.createdAt : acc), null);
  return (
    <AppShell
      title="Cockpit"
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
          title="Preis-Ampel"
          scope="aktive Artikel · Listen-VK vs. Korridor"
          distribution={vm.priceStatus}
          classPrefix="ck-p"
          note="Aktueller Listen-VK gegen den Vollkosten-Korridor (MIN 25 % / GUT 35 %). „Kein EK“ = ohne Einkaufspreis ist kein Korridor berechenbar — der Anteil zeigt, wie viel vom Sortiment preislich blind ist."
        />
      </div>

      <div className="ck-grid">
        <MoversCard movers={vm.movers} windowLabel={vm.windowLabel} />
      </div>

      <div className="ck-grid">
        <CapitalCard capital={vm.capital} planwerte={vm.planwerte} />
      </div>
    </AppShell>
  );
}
