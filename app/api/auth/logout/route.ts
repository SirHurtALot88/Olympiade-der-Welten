export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { clearSession } from "@/lib/auth/session";

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
