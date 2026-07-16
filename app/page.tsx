import { redirect } from "next/navigation";

import HomePageClient from "@/app/HomePageClient";
import { isAuthEnabled } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HomePage() {
  if (isAuthEnabled()) {
    const user = await getSessionUser();
    if (!user) {
      redirect("/login");
    }
  }

  return <HomePageClient authEnabled={isAuthEnabled()} />;
}
