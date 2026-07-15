export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { isAuthEnabled } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
  // Bei deaktiviertem Login immer {user: null} - kein Cookie-Parsing noetig,
  // Auth-OFF-Pfad bleibt unveraendert.
  if (!isAuthEnabled()) {
    return NextResponse.json({ user: null });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: { username: user.username, displayName: user.displayName, ownerId: user.ownerId },
  });
}
