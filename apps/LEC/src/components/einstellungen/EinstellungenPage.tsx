"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CostSettingsValues } from "@/lib/pricing/costSettings";
import { DEFAULT_COST_SETTINGS } from "@/lib/pricing/costSettings";
import { computeHk, computePriceCorridor } from "@/lib/pricing/costEngine";
import { parseGermanNumber } from "@/lib/parsing/number";
import { AppShell } from "@/components/shell/AppShell";
import { ImportHistoryCard, type ImportBatchRow } from "./ImportHistoryCard";

type Unit = "eur" | "percent" | "x";

interface FieldMeta {
  key: keyof CostSettingsValues;
  label: string;
  unit: Unit;
}

interface Group {
  title: string;
  fields: FieldMeta[];
}

const GROUPS: Group[] = [
  {
    title: "Einkaufs-Versand",
    fields: [
      { key: "buyShippingUnderFive", label: "< 5 Stk (€ / Menge)", unit: "eur" },
      { key: "buyShippingFive", label: "≥ 5 Stk bzw. Pack (€ / Menge)", unit: "eur" },
    ],
  },
  {
    title: "Versand & Verpackung — Einzel",
    fields: [
      { key: "shippingSingle", label: "Versand (Brief)", unit: "eur" },
      { key: "registeredSingle", label: "Prio / Einschreiben", unit: "eur" },
      { key: "packagingSingle", label: "Verpackung", unit: "eur" },
    ],
  },
  {
    title: "Versand & Verpackung — Pack",
    fields: [
      { key: "shippingPack", label: "Versand (Brief)", unit: "eur" },
      { key: "registeredPack", label: "Prio / Einschreiben", unit: "eur" },
      { key: "packagingPack", label: "Verpackung", unit: "eur" },
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
    title: "Fixkosten p. a.",
    fields: [
      { key: "fixedYearlyEbayShop", label: "eBay-Shop", unit: "eur" },
      { key: "fixedYearlyBillbee", label: "Billbee", unit: "eur" },
      { key: "fixedYearlyLexoffice", label: "Lexoffice", unit: "eur" },
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
}

export function EinstellungenPage({ costSettings, importBatches, authEnabled }: Props) {
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

  // Live-Vorschau: Beispielrechnung 0,59 € Cardmarket-"ab" x 3er-Pack (KONZEPT §7.2/§7.3).
  const preview = useMemo(() => {
    const exampleEk = 0.59 * 3;
    const hk = computeHk({ ek: exampleEk, kind: "pack", packSize: 3, fixedCostPerUnit: 0 }, parsed);
    const corridor = computePriceCorridor(hk.total, hk.total, parsed);
    return { exampleEk, hk, corridor };
  }, [parsed]);

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
                  </div>
                ))}
              </div>
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
              Live-Vorschau <span className="r">0,59 € × 3er-Pack</span>
            </h3>
            <div className="calc" style={{ margin: "6px 16px 16px" }}>
              <div className="row">
                <span className="muted">EK (0,59 € × 3)</span>
                <span>{preview.exampleEk.toFixed(2)} €</span>
              </div>
              <div className="row">
                <span className="muted">+ Einkaufs-Versand</span>
                <span>{preview.hk.buyShipping.toFixed(2)} €</span>
              </div>
              <div className="row">
                <span className="muted">+ Versand + Prio/Einschreiben + Verpackung</span>
                <span>{(preview.hk.shipping + preview.hk.registeredMail + preview.hk.packaging).toFixed(2)} €</span>
              </div>
              <div className="row tot">
                <span>= HK (Selbstkosten)</span>
                <span>{preview.hk.total.toFixed(2)} €</span>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <span className="muted">eBay-Kosten bei VK = HK (Provision + Anzeigen)</span>
                <span>{preview.corridor.currentVkFees.total.toFixed(2)} €</span>
              </div>
              <div className="row tot" style={{ color: "var(--good)" }}>
                <span>VK-Preis MIN (× {parsed.marginMinMultiplier.toFixed(2)})</span>
                <span>{preview.corridor.vkMin.toFixed(2)} €</span>
              </div>
              <div className="row tot" style={{ color: "var(--accent-ink)" }}>
                <span>VK-Preis GUT (× {parsed.marginGoodMultiplier.toFixed(2)})</span>
                <span>{preview.corridor.vkGood.toFixed(2)} €</span>
              </div>
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
