import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { searchArticles } from "@/lib/pipeline/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") ?? "";
  const results = await searchArticles(prisma, query);
  return NextResponse.json({ results });
}
