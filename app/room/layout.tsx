export const runtime = "nodejs";

import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { isAuthEnabled } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";

export default async function RoomLayout({ children }: { children: ReactNode }) {
  if (isAuthEnabled()) {
    const user = await getSessionUser();
    if (!user) {
      redirect("/login");
    }
  }

  return children;
}
