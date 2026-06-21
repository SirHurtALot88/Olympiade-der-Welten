import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const normalizedPathname = pathname.trim().replace(/\/+$/, "").toLowerCase();

  if (normalizedPathname === "/foundation" && pathname !== "/foundation") {
    const url = request.nextUrl.clone();
    url.pathname = "/foundation";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
