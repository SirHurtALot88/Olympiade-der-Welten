import LegacyLineupLabClient from "@/app/foundation/legacy-lineup-lab/LegacyLineupLabClient";

type LegacyLineupLabPageProps = {
  searchParams?: Promise<{
    source?: string;
  }>;
};

export default async function LegacyLineupLabPage({ searchParams }: LegacyLineupLabPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const source = resolvedSearchParams?.source === "prisma" ? "prisma" : "sqlite";

  return <LegacyLineupLabClient initialSource={source} />;
}
