"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CostSettingsValues } from "@/lib/pricing/costSettings";
import { DEFAULT_COST_SETTINGS } from "@/lib/pricing/costSettings";
import { totalFixedYearly, type PriceStatus, type ShopVolume } from "@/lib/pricing/costEngine";
import { PREVIEW_EXAMPLES, buildCostPreview, deriveCostFacts, type CostPreview } from "@/lib/pricing/costPreview";
import { formatEuroCents } from "@/lib/format";
import { STATUS_PILL } from "@/components/dashboard/SortimentTable";
import { parseGermanNumber } from "@/lib/parsing/number";
import { AppShell } from "@/components/shell/AppShell";
import { ImportHistoryCard, type ImportBatchRow } from "./ImportHistoryCard";

type Unit = "eur" | "percent" | "x" | "count";

interface FieldMeta {
  key: keyof CostSettingsValues;
  label: string;
  unit: Unit;
  /** Abgeleiteter Wert direkt neben dem Eingabefeld (z. B. die jeweils andere Zeitbasis). */
  derived?: (s: CostSettingsValues) => string;
}

interface Group {
  title: string;
  /** Erklaerung unter der Gruppe, rein informativ. */
  note?: (s: CostSettingsValues) => string;
  fields: FieldMeta[];
}

const eur = (v: number) => `${formatEuroCents(v)} €`;

/** Fixkosten-Felder sind JAHRESwerte. Der Monatswert steht daneben, damit ein Monatspreis nicht
 * versehentlich in ein Jahresfeld wandert (95 € im Jahresfeld ist der Fehler, der monatelang
 * unentdeckt blieb). */
const yearlyField = (key: keyof CostSettingsValues, name: string): FieldMeta => ({
  key,
  label: `${name} — € pro JAHR`,
  unit: "eur",
  derived: (s) => `= ${eur(s[key] / 12)} pro Monat`,
});

const GROUPS: Group[] = [
  {
    title: "Einkaufs-Versand",
    note: (s) =>
      `Das Porto fällt je BESTELLUNG an. Einkalkuliert wird nur der eingestellte Anteil: ` +
      `${eur(s.buyShippingUnderFive)} × ${toDisplay(s.buyShippingShareFactor, "percent")} % = ${eur(
        s.buyShippingUnderFive * s.buyShippingShareFactor
      )} je Einheit. Die Staffel „ab 5 Stk“ ist derzeit ungenutzt (der Import rechnet mit 3 Stk je Bestellung).`,
    fields: [
      { key: "buyShippingUnderFive", label: "Bestellporto unter 5 Stk — € je Bestellung", unit: "eur" },
      { key: "buyShippingFive", label: "Bestellporto ab 5 Stk — € je Bestellung", unit: "eur" },
      {
        key: "buyShippingShareFactor",
        label: "Davon einkalkuliert",
        unit: "percent",
        derived: (s) => `→ ${eur(s.buyShippingUnderFive * s.buyShippingShareFactor)} je Einheit (unter 5 Stk)`,
      },
    ],
  },
  {
    title: "Versand & Verpackung — Einzel",
    fields: [
      { key: "shippingSingle", label: "Versand (Brief) — € je Stück", unit: "eur" },
      { key: "packagingSingle", label: "Verpackung — € je Stück", unit: "eur" },
    ],
  },
  {
    title: "Versand & Verpackung — Pack",
    fields: [
      { key: "shippingPack", label: "Versand (Brief) — € je Pack", unit: "eur" },
      { key: "packagingPack", label: "Verpackung — € je Pack", unit: "eur" },
    ],
  },
  {
    title: "Einschreiben (Einwurf)",
    note: (s) =>
      `Ab einem Warenkorb von ${eur(s.registeredThreshold)} geht die Sendung per Einschreiben: ` +
      `der VK trägt dann die vollen ${eur(s.registeredCostPerShipment)}. Darunter wird der Rest der ` +
      `Marken anteilig auf die übrigen Stücke umgelegt.`,
    fields: [
      { key: "registeredCostPerShipment", label: "Kosten je Einschreiben — € je Marke", unit: "eur" },
      { key: "registeredThreshold", label: "Einschreiben ab Warenkorb — €", unit: "eur" },
      {
        key: "registeredStampsPerYear",
        label: "Marken pro JAHR — Stück",
        unit: "count",
        derived: (s) => `= ${eur(s.registeredStampsPerYear * s.registeredCostPerShipment)} Marken-Kosten pro Jahr`,
      },
    ],
  },
  {
    title: "eBay-Gebühren",
    fields: [
      { key: "ebayCommissionFixed", label: "Fixgebühr", unit: "eur" },
      { key: "ebayCommissionRate", label: "Provision", unit: "percent" },
      { key: "ebayCommissionVat", label: "USt. auf Gebühren", unit: "percent" },
      { key: "adFeeRateSingle", label: "Anzeigen Einzel (aktuell)", unit: "percent" },
      { key: "adFeeRateMin", label: "Anzeigen (Basis MIN)", unit: "percent" },
      { key: "adFeeRateGood", label: "Anzeigen (Basis GUT)", unit: "percent" },
    ],
  },
  {
    title: "Fixkosten — alle Felder in € pro JAHR",
    note: (s) =>
      `Summe ALLER Fixkostenfelder ${eur(totalFixedYearly(s))} pro Jahr = ${eur(totalFixedYearly(s) / 12)} pro Monat. ` +
      `Monatspreise × 12 eintragen — nicht den Monatspreis selbst. „Sonstige“ nimmt alle übrigen ` +
      `volumenunabhängigen Jahreskosten aus der EÜR auf (Telekommunikation, AfA, Beiträge/Versicherungen, ` +
      `Steuerberatung, Schuldzinsen, Raumkosten) — Posten ohne eigenes Feld gehören dort hinein, sonst fehlen sie.`,
    fields: [
      yearlyField("fixedYearlyEbayShop", "eBay-Shop"),
      yearlyField("fixedYearlyBillbee", "Billbee"),
      yearlyField("fixedYearlyLexoffice", "Lexoffice"),
      {
        key: "fixedYearlyPackagingLicense",
        label: "Verpackungslizenzen — € pro JAHR",
        unit: "eur",
        derived: (s) => `= ${eur(s.fixedYearlyPackagingLicense / 12)} pro Monat (echte Jahreskosten)`,
      },
      {
        key: "fixedYearlyOther",
        label: "Sonstige Fixkosten laut EÜR — € pro JAHR",
        unit: "eur",
        derived: (s) =>
          `= ${eur(s.fixedYearlyOther / 12)} pro Monat · Telekom 540 + AfA 199 + Beiträge 141 + Steuerberatung 16 + Zinsen 24 + Raumkosten 919`,
      },
    ],
  },
  {
    title: "Margen-Ziele",
    fields: [
      { key: "marginMinMultiplier", label: "MIN-Multiplikator", unit: "x" },
      { key: "marginGoodMultiplier", label: "GUT-Multiplikator", unit: "x" },
    ],
  },
];

function toDisplay(value: number, unit: Unit): string {
  const v = unit === "percent" ? value * 100 : value;
  const rounded = Math.round(v * 1000) / 1000;
  return rounded.toString().replace(".", ",");
}

function fromDisplay(raw: string, unit: Unit): number {
  const v = parseGermanNumber(raw);
  return unit === "percent" ? v / 100 : v;
}

function buildDisplayValues(settings: CostSettingsValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const g of GROUPS) {
    for (const f of g.fields) {
      out[f.key] = toDisplay(settings[f.key], f.unit);
    }
  }
  return out;
}

interface Props {
  costSettings: CostSettingsValues;
  importBatches: (Omit<ImportBatchRow, "createdAt" | "windowFrom" | "windowTo"> & {
    createdAt: string;
    windowFrom: string | null;
    windowTo: string | null;
  })[];
  authEnabled: boolean;
  /** Shopweite 365-Tage-Mengen aus dem letzten Import (null = noch kein Import). */
  shopVolume: ShopVolume | null;
}

export function EinstellungenPage({ costSettings, importBatches, authEnabled, shopVolume }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => buildDisplayValues(costSettings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const parsed = useMemo((): CostSettingsValues => {
    const result = {} as CostSettingsValues;
    for (const g of GROUPS) {
      for (const f of g.fields) {
        result[f.key] = fromDisplay(values[f.key] ?? "0", f.unit);
      }
    }
    return result;
  }, [values]);

  // Live-Vorschau: dieselben Engine-Funktionen und dieselbe Shop-Menge wie Dashboard/Sortiment
  // (siehe lib/pricing/costPreview.ts) -- die Vorschau darf der App nicht widersprechen.
  const previews = useMemo(
    () => PREVIEW_EXAMPLES.map((ex) => buildCostPreview(ex, parsed, shopVolume)),
    [parsed, shopVolume]
  );
  const facts = useMemo(() => deriveCostFacts(parsed, shopVolume), [parsed, shopVolume]);

  function setField(key: string, raw: string) {
    setValues((prev) => ({ ...prev, [key]: raw }));
    setSavedNote(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/costs", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Speichern fehlgeschlagen.");
      }
      setSavedNote("Gespeichert als neue Version (vorherige bleibt in der Historie erhalten).");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/costs", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      if (!res.ok) throw new Error("Zurücksetzen fehlgeschlagen.");
      setValues(buildDisplayValues(DEFAULT_COST_SETTINGS));
      setSavedNote("Auf Konzept-Defaults zurückgesetzt (als neue Version gespeichert).");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Zurücksetzen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } finally {
      setLoggingOut(false);
    }
  }

  const minMarginPct = ((parsed.marginMinMultiplier - 1) / parsed.marginMinMultiplier) * 100;
  const goodMarginPct = ((parsed.marginGoodMultiplier - 1) / parsed.marginGoodMultiplier) * 100;

  return (
    <AppShell
      title="Einstellungen"
      subtitle="Kostensätze der Preis-Engine, Datenstand, Konto"
      footer={<span>Speichern legt immer eine neue Version an — die vorherige bleibt erhalten.</span>}
    >
      <section className="grid-2" style={{ alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {GROUPS.map((g) => (
            <div key={g.title} className="card" style={{ padding: "14px 16px 16px" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{g.title}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {g.fields.map((f) => (
                  <div key={f.key}>
                    <label style={{ fontSize: 11, color: "var(--faint)", fontWeight: 600 }}>
                      {f.label}
                      {f.unit === "percent" && " (%)"}
                      {f.unit === "x" && " (×)"}
                    </label>
                    <input
                      value={values[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      style={{
                        width: "100%",
                        background: "var(--panel2)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--r-sm)",
                        padding: "6px 9px",
                        color: "var(--ink)",
                        font: "inherit",
                        fontSize: 12.5,
                        outline: "none",
                        marginTop: 2,
                      }}
                    />
                    {f.derived && (
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{f.derived(parsed)}</div>
                    )}
                  </div>
                ))}
              </div>
              {g.note && <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--muted)" }}>{g.note(parsed)}</div>}
              {g.title === "Margen-Ziele" && (
                <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--muted)" }}>
                  MIN ≈ {minMarginPct.toFixed(0)} % Gewinnmarge · GUT ≈ {goodMarginPct.toFixed(0)} % Gewinnmarge
                  (Klartext-Ableitung aus den Multiplikatoren).
                </div>
              )}
            </div>
          ))}

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              className="chip c-good"
              disabled={saving}
              onClick={handleSave}
              style={{ padding: "9px 18px", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Speichere …" : "Speichern (neue Version)"}
            </button>
            <button type="button" className="chip" disabled={saving} onClick={handleReset} style={{ padding: "9px 16px" }}>
              Zurücksetzen (Defaults)
            </button>
          </div>
          {error && <div style={{ fontSize: 11.5, color: "var(--crit)" }}>{error}</div>}
          {savedNote && !error && <div style={{ fontSize: 11.5, color: "var(--good)" }}>{savedNote}</div>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <h3>
              Abgeleitete Werte <span className="r">zum Gegenrechnen</span>
            </h3>
            <div className="calc" style={{ margin: "6px 16px 16px" }}>
              <div className="row tot" style={{ fontSize: 15, borderTop: "none", marginTop: 0 }}>
                <span>Fixkosten ALLER Felder pro Jahr</span>
                <span>{eur(facts.fixedYearlyTotal)}</span>
              </div>
              <div className="row">
                <span className="muted">= pro Monat</span>
                <span>{eur(facts.fixedMonthlyTotal)}</span>
              </div>
              <div className="row">
                <span className="muted">Verkaufte Stück, letzte 365 Tage (Import)</span>
                <span>{facts.shopUnits !== null ? facts.shopUnits.toLocaleString("de-DE") : "kein Import"}</span>
              </div>
              <div className="row tot" style={{ fontSize: 15 }}>
                <span>
                  Fixkosten je Stück
                  <div style={{ fontWeight: 500, fontSize: 11, color: "var(--muted)" }}>
                    {facts.fixedPerUnit !== null
                      ? `${eur(facts.fixedYearlyTotal)} ÷ ${facts.shopUnits?.toLocaleString("de-DE")} Stück — gegen die EÜR prüfbar`
                      : "erst nach einem Import berechenbar"}
                  </div>
                </span>
                <span>{facts.fixedPerUnit !== null ? eur(facts.fixedPerUnit) : "—"}</span>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <span className="muted">Einschreiben-Marken pro Jahr</span>
                <span>{eur(facts.registeredYearlyCost)}</span>
              </div>
              <div className="row">
                <span className="muted">Stück ab {eur(parsed.registeredThreshold)} (tragen volle Marke)</span>
                <span>
                  {facts.unitsAtOrAboveThreshold !== null ? facts.unitsAtOrAboveThreshold.toLocaleString("de-DE") : "—"}
                </span>
              </div>
              <div className="row tot">
                <span>Einschreiben je Stück unter der Schwelle</span>
                <span>{facts.registeredRateBelow !== null ? eur(facts.registeredRateBelow) : "—"}</span>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <span className="muted">Einkaufs-Versand je Einheit (unter 5 Stk / ab 5 Stk)</span>
                <span>
                  {eur(facts.buyShippingEffectiveUnderFive)} / {eur(facts.buyShippingEffectiveFive)}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>
              Live-Vorschau <span className="r">unter und über {eur(parsed.registeredThreshold)}</span>
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "6px 16px 16px" }}>
              {previews.map((pv) => (
                <PreviewColumn key={pv.example.label} pv={pv} parsed={parsed} />
              ))}
            </div>
            <div style={{ margin: "0 16px 16px", fontSize: 11, color: "var(--faint)" }}>
              Gleiche Rechnung wie Dashboard und Sortiment: shopweite Fixkosten, Einschreiben nach VK,
              Korridor inkl. Deckungsbeitrags-Grenze.
            </div>
          </div>

          <ImportHistoryCard batches={importBatches} />

          <div className="card" style={{ padding: "15px 16px 16px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>Konto</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
              Zugangsschutz:{" "}
              <span className={authEnabled ? "up" : undefined} style={{ fontWeight: 600 }}>
                {authEnabled ? "aktiv" : "deaktiviert (Entwicklung)"}
              </span>
            </div>
            {authEnabled && (
              <button
                type="button"
                className="chip c-crit"
                disabled={loggingOut}
                onClick={handleLogout}
                style={{ padding: "8px 16px" }}
              >
                {loggingOut ? "Abmelden …" : "Abmelden"}
              </button>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function PreviewColumn({ pv, parsed }: { pv: CostPreview; parsed: CostSettingsValues }) {
  const { example, hk, corridor } = pv;
  const pill = pillFor(pv.status);
  const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;
  return (
    <div className="calc" style={{ margin: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
        {example.label}: EK {eur(example.ek)} · VK {eur(example.vk)}
        <div style={{ fontWeight: 500, fontSize: 11, color: "var(--muted)" }}>
          {example.vk >= parsed.registeredThreshold
            ? `über der Schwelle (${eur(parsed.registeredThreshold)})`
            : `unter der Schwelle (${eur(parsed.registeredThreshold)})`}
        </div>
      </div>
      <div className="row">
        <span className="muted">EK</span>
        <span>{eur(hk.ek)}</span>
      </div>
      <div className="row">
        <span className="muted">+ Einkaufs-Versand ({toDisplay(parsed.buyShippingShareFactor, "percent")} % Porto)</span>
        <span>{eur(hk.buyShipping)}</span>
      </div>
      <div className="row">
        <span className="muted">+ Versand</span>
        <span>{eur(hk.shipping)}</span>
      </div>
      <div className="row">
        <span className="muted">+ Einschreiben</span>
        <span>{eur(hk.registeredMail)}</span>
      </div>
      <div className="row">
        <span className="muted">+ Verpackung</span>
        <span>{eur(hk.packaging)}</span>
      </div>
      <div className="row">
        <span className="muted">+ Fixkosten-Anteil</span>
        <span>{eur(hk.fixedCostShare)}</span>
      </div>
      <div className="row tot">
        <span>= HK Vollkosten</span>
        <span>{eur(hk.total)}</span>
      </div>
      <div className="row">
        <span className="muted">HK ohne Fixkosten</span>
        <span>{eur(pv.hkContribution)}</span>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <span className="muted">eBay-Kosten bei diesem VK</span>
        <span>{eur(corridor.currentVkFees.total)}</span>
      </div>
      <div className="row">
        <span className="muted">Marge vor / nach Fixkosten</span>
        <span>
          {pct(pv.contributionMargin)} / {pct(pv.fullMargin)}
        </span>
      </div>
      <div className="row tot" style={{ color: "var(--crit)" }}>
        <span>Deckungsbeitrags-Grenze (darunter Verlust)</span>
        <span>{eur(corridor.vkContribution)}</span>
      </div>
      <div className="row tot" style={{ color: "var(--good)" }}>
        <span>VK-Preis MIN (× {parsed.marginMinMultiplier.toFixed(2).replace(".", ",")}, Vollkosten)</span>
        <span>{eur(corridor.vkMin)}</span>
      </div>
      <div className="row tot" style={{ color: "var(--accent-ink)" }}>
        <span>VK-Preis GUT (× {parsed.marginGoodMultiplier.toFixed(2).replace(".", ",")}, Vollkosten)</span>
        <span>{eur(corridor.vkGood)}</span>
      </div>
      <div style={{ marginTop: 8 }}>
        <span className={`pill ${pill.cls}`}>
          <span className="dot" />
          {pill.label}
        </span>
      </div>
    </div>
  );
}

function pillFor(status: PriceStatus) {
  return STATUS_PILL[status];
}
