export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { listenRoute } from "@/lib/kartenschmiede/routen";

export const GET = listenRoute("karten");
