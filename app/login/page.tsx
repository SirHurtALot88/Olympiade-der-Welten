export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { redirect } from "next/navigation";

import LoginFormClient from "@/app/login/LoginFormClient";
import { isAuthEnabled } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";

export default async function LoginPage() {
  if (isAuthEnabled()) {
    const user = await getSessionUser();
    if (user) {
      redirect("/");
    }
  }

  return <LoginFormClient />;
}
