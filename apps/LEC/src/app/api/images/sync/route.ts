import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getImageSyncState } from "@/lib/images/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function counts() {
  const [total, withImage, ebay, ygo] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { imageFile: { not: null } } }),
    prisma.article.count({ where: { imageFile: { not: null }, imageMatchedBy: { in: ["item_id", "name", "alias"] } } }),
    prisma.article.count({ where: { imageFile: { not: null }, imageMatchedBy: "set_code" } }),
  ]);
  return { total, withImage, ebay, ygo };
}

export async function GET() {
  return NextResponse.json({ ...getImageSyncState(), counts: await counts() });
}
