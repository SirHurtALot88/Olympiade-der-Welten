export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { eintragRouten } from "@/lib/kartenschmiede/routen";

const routen = eintragRouten("spielstaende");
export const GET = routen.GET;
export const PUT = routen.PUT;
export const DELETE = routen.DELETE;
