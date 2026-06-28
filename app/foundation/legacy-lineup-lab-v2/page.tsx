import LegacyLineupLabClient from "@/app/foundation/legacy-lineup-lab/LegacyLineupLabClient";

export const dynamic = "force-dynamic";

type LegacyLineupLabV2PageProps = {
  searchParams?: Promise<{
    source?: string;
  }>;
};

export default async function LegacyLineupLabV2Page({ searchParams }: LegacyLineupLabV2PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const source = resolvedSearchParams?.source === "prisma" ? "prisma" : "sqlite";

  return (
    <main className="page-shell">
      <LegacyLineupLabClient initialSource={source} uiVariant="focusV2" />
    </main>
  );
}
