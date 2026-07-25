import { NextResponse } from "next/server";

/** Health-Check fuer Deploy/Monitoring (analog zur Oly), immer oeffentlich erreichbar. */
export async function GET() {
  return NextResponse.json({ status: "ok", service: "lec-cockpit" }, { status: 200 });
}
