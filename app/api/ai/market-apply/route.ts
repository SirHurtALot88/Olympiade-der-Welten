export const dynamic = "force-dynamic";

import { POST as postMarketPlanApply } from "@/app/api/ai/market-plan-apply/route";

export async function POST(request: Request) {
  return postMarketPlanApply(request);
}
