export async function refreshMaterializedSeasonDerivations(input: {
  saveId: string;
  materialize?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const params = new URLSearchParams({
    saveId: input.saveId,
  });
  if (input.materialize) {
    params.set("materialize", "1");
  }

  try {
    const response = await fetch(`/api/season/warmup-derivations?${params.toString()}`, {
      method: "POST",
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !payload.ok) {
      return { ok: false, error: payload.error ?? `warmup_http_${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "warmup_failed",
    };
  }
}
