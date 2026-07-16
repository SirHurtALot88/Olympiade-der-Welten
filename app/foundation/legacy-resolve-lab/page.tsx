import LegacyResolveLabClient from "@/app/foundation/legacy-resolve-lab/LegacyResolveLabClient";

export const dynamic = "force-dynamic";

type LegacyResolveLabPageProps = {
  searchParams?: Promise<{
    source?: string;
    saveId?: string;
    seasonId?: string;
    matchdayId?: string;
  }>;
};

export default async function LegacyResolveLabPage({ searchParams }: LegacyResolveLabPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <LegacyResolveLabClient
      initialParams={{
        source: resolvedSearchParams?.source === "prisma" ? "prisma" : "sqlite",
        saveId: resolvedSearchParams?.saveId?.trim() || undefined,
        seasonId: resolvedSearchParams?.seasonId?.trim() || undefined,
        matchdayId: resolvedSearchParams?.matchdayId?.trim() || undefined,
      }}
    />
  );
}
