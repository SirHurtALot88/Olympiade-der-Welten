import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { runImport, type UploadedFile } from "@/lib/pipeline/runImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Dateien sind klein (<1 MB), aber grosszuegig deckeln.
export const maxDuration = 60;

const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25 MB gesamt, sehr grosszuegig

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const billbeeFiles: UploadedFile[] = [];
  let ebayFile: UploadedFile | null = null;
  let totalBytes = 0;

  // "billbee" kann mehrfach vorkommen (30/90/365d), "ebay" hoechstens einmal.
  for (const entry of formData.getAll("billbee")) {
    if (entry instanceof File) {
      const buffer = Buffer.from(await entry.arrayBuffer());
      totalBytes += buffer.byteLength;
      billbeeFiles.push({ name: entry.name, buffer });
    }
  }
  const ebayEntry = formData.get("ebay");
  if (ebayEntry instanceof File && ebayEntry.size > 0) {
    const buffer = Buffer.from(await ebayEntry.arrayBuffer());
    totalBytes += buffer.byteLength;
    ebayFile = { name: ebayEntry.name, buffer };
  }

  if (billbeeFiles.length === 0 && !ebayFile) {
    return NextResponse.json({ error: "no_files" }, { status: 400 });
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  try {
    const summary = await runImport(prisma, { billbeeFiles, ebayFile });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import fehlgeschlagen.";
    return NextResponse.json({ error: "import_failed", message }, { status: 422 });
  }
}
