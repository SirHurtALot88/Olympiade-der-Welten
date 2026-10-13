import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { prisma, resolveImageDir } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liefert das abgelegte Kartenbild eines Artikels aus dem Volume (login-geschuetzt). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await prisma.article.findUnique({ where: { id }, select: { imageFile: true } });
  // Dateiname kommt aus der DB, nie aus der URL — kein Pfad-Ausbruch moeglich.
  if (!article?.imageFile || path.basename(article.imageFile) !== article.imageFile) {
    return new NextResponse(null, { status: 404 });
  }
  try {
    const buf = await readFile(path.join(resolveImageDir(), article.imageFile));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": "image/jpeg",
        // Die URL traegt die Bildkennung (?v=...), aendert sich also mit dem Bild.
        "cache-control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
