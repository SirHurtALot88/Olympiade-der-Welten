import FoundationPageClient from "@/app/foundation/FoundationPageClient";
import { normalizeFoundationViewParam } from "@/lib/foundation/foundation-view-routing";
import { loadFoundationInitialPersistenceState } from "@/lib/persistence/foundation-state-read";
import { isAuthEnabled } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FoundationPageProps = {
  searchParams?: Promise<{
    source?: string;
    team?: string;
    saveId?: string;
    saveMode?: string;
    view?: string;
  }>;
};

export default async function FoundationPage({ searchParams }: FoundationPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const source = resolvedSearchParams?.source;
  const team = resolvedSearchParams?.team;
  const saveId = resolvedSearchParams?.saveId;
  const initialView = normalizeFoundationViewParam(resolvedSearchParams?.view);
  const initialReadSource = source === "prisma" ? "prisma" : "sqlite";

  // Identitaets-Verdrahtung (Phase 1, nur bei OLY_AUTH_ENABLED=1): die echte
  // Owner-ID der eingeloggten Person seedet activeOwnerId im Client-State, statt
  // dass jeder Browser auf den hartcodierten Chris-Default zurueckfaellt.
  const initialActiveOwnerId = isAuthEnabled() ? ((await getSessionUser())?.ownerId ?? null) : null;

  const initialPersistenceState =
    initialReadSource === "sqlite"
      ? loadFoundationInitialPersistenceState({
          saveId,
          saveMode: resolvedSearchParams?.saveMode,
          // Per-user active-save scoping: resolve THIS session's active save (auth on),
          // otherwise null -> unchanged global active-save behavior.
          ownerId: initialActiveOwnerId,
        })
      : null;

  return (
    <FoundationPageClient
      initialReadSource={initialReadSource}
      initialSelectedTeamId={team ?? null}
      initialSaveId={saveId ?? null}
      initialView={initialView}
      initialPersistenceState={initialPersistenceState}
      initialActiveOwnerId={initialActiveOwnerId}
    />
  );
}
