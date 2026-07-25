import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { loadActiveCostSettings, saveCostSettings } from "@/lib/dashboard/queries";
import { DEFAULT_COST_SETTINGS, type CostSettingsValues } from "@/lib/pricing/costSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const costSettings = await loadActiveCostSettings(prisma);
  return NextResponse.json({ costSettings });
}

const NUMERIC_KEYS: (keyof CostSettingsValues)[] = [
  "buyShippingUnderFive",
  "buyShippingFive",
  "shippingSingle",
  "shippingPack",
  "registeredSingle",
  "registeredPack",
  "packagingSingle",
  "packagingPack",
  "fixedYearlyEbayShop",
  "fixedYearlyBillbee",
  "fixedYearlyLexoffice",
  "ebayCommissionRate",
  "ebayCommissionVat",
  "ebayCommissionFixed",
  "adFeeRateSingle",
  "adFeeRateMin",
  "adFeeRateGood",
  "marginMinMultiplier",
  "marginGoodMultiplier",
];

/**
 * Speichert eine NEUE Kostensaetze-Version (PAGES_CONCEPT §5): kein
 * Ueberschreiben, siehe `saveCostSettings`. `reset: true` speichert die
 * Konzept-Defaults als neue Version ("Zuruecksetzen").
 */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (body.reset === true) {
    const saved = await saveCostSettings(prisma, DEFAULT_COST_SETTINGS);
    return NextResponse.json({ ok: true, costSettings: saved });
  }

  const values: Partial<CostSettingsValues> = {};
  for (const key of NUMERIC_KEYS) {
    const raw = body[key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      return NextResponse.json({ error: "invalid_field", field: key }, { status: 400 });
    }
    values[key] = raw;
  }

  try {
    const saved = await saveCostSettings(prisma, values as CostSettingsValues);
    return NextResponse.json({ ok: true, costSettings: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Speichern fehlgeschlagen.";
    return NextResponse.json({ error: "save_failed", message }, { status: 422 });
  }
}
