import { NextResponse, type NextRequest } from "next/server";
import { prisma, resolveImageDir } from "@/lib/db/client";
import { getImageSyncState, startImageSync } from "@/lib/images/runner";

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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const started = startImageSync(prisma, resolveImageDir(), { force: body?.force === true });
  return NextResponse.json({ started, ...getImageSyncState(), counts: await counts() }, { status: started ? 202 : 200 });
}
