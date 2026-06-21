import FoundationPageClient from "@/app/foundation/FoundationPageClient";

export const dynamic = "force-dynamic";

type FoundationPageProps = {
  searchParams?: Promise<{
    source?: string;
    team?: string;
    saveId?: string;
    saveMode?: string;
  }>;
};

export default async function FoundationPage({ searchParams }: FoundationPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const source = resolvedSearchParams?.source;
  const team = resolvedSearchParams?.team;
  const saveId = resolvedSearchParams?.saveId;
  const initialReadSource = source === "prisma" ? "prisma" : "sqlite";

  return (
    <FoundationPageClient
      initialReadSource={initialReadSource}
      initialSelectedTeamId={team ?? null}
      initialSaveId={saveId ?? null}
      initialPersistenceState={null}
    />
  );
}
