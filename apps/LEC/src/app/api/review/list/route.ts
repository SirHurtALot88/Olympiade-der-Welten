import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { listOpenReviewItems } from "@/lib/pipeline/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await listOpenReviewItems(prisma);
  return NextResponse.json({ items });
}
