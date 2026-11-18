"use client";

import { useEffect, useRef, useState } from "react";

import type { TransfermarktFreeAgentItem, TransfermarktReadResult } from "@/lib/market/transfermarkt-read-service";
import {
  appendRoomContextToParams,
  withRoomContextBody,
  type FoundationRoomContext,
} from "@/lib/room/foundation-room-context-client";
import { formatMarketPreviewError } from "@/lib/room/parse-room-write-context";

const SEITE = 250;

type FeedAntwort = TransfermarktReadResult & { error?: string };

export type MarktFeed = {
  items: TransfermarktFreeAgentItem[];
  total: number;
  teamContext: TransfermarktReadResult["teamContext"];
  busy: boolean;
  /** Der Rest des Pools wird noch in einem Zug nachgeholt. */
  nachladen: boolean;
  fehler: string | null;
};

function istAbbruch(fehler: unknown) {
  return fehler instanceof DOMException && fehler.name === "AbortError";
}

/**
 * Markt-Feed: erste Seite sofort, der Rest des Pools in EINEM Aufruf (`fullPool`) — dieselbe Strategie wie die alte
 * Seite (Messung dort: 13 Aufrufe/55 s gegen 2 Aufrufe). Sortieren und Filtern rechnen im Client über den ganzen Pool.
 */
export function useMarktFeed(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
  source: "sqlite" | "prisma";
  bereit: boolean;
  suche: string;
  neuLaden: number;
  roomContext: FoundationRoomContext | null | undefined;
}): MarktFeed {
  const { saveId, seasonId, teamId, source, bereit, suche, neuLaden, roomContext } = input;
  const [zustand, setZustand] = useState<MarktFeed>({
    items: [],
    total: 0,
    teamContext: null,
    busy: true,
    nachladen: false,
    fehler: null,
  });
  const roomRef = useRef(roomContext ?? null);
  roomRef.current = roomContext ?? null;
  const cacheRef = useRef(new Map<string, FeedAntwort>());
  const tokenRef = useRef(neuLaden);

  useEffect(() => {
    if (!bereit || !teamId || !saveId || saveId === "loading-save" || seasonId === "loading") return;
    if (tokenRef.current !== neuLaden) {
      tokenRef.current = neuLaden;
      cacheRef.current.clear();
    }
    const schluessel = `${saveId}:${seasonId}:${teamId}:${suche.trim()}`;
    const treffer = cacheRef.current.get(schluessel);
    if (treffer) {
      setZustand({ items: treffer.items, total: treffer.total, teamContext: treffer.teamContext, busy: false, nachladen: false, fehler: null });
      return;
    }

    const abbruch = new AbortController();
    let beendet = false;
    const parameter = (extra: Record<string, string>) =>
      appendRoomContextToParams(
        new URLSearchParams({
          saveId,
          seasonId,
          source,
          teamId,
          ...(suche.trim() ? { search: suche.trim() } : {}),
          ...extra,
        }),
        roomRef.current,
      );
    async function hole(extra: Record<string, string>) {
      const antwort = await fetch(`/api/transfermarkt/free-agents?${parameter(extra).toString()}`, {
        cache: "no-store",
        signal: abbruch.signal,
      });
      const daten = (await antwort.json()) as FeedAntwort;
      if (!antwort.ok || daten.error) throw new Error(daten.error ?? "Transfermarkt konnte nicht geladen werden.");
      return daten;
    }

    async function laden() {
      setZustand((alt) => ({ ...alt, busy: true, fehler: null }));
      try {
        const erste = await hole({ limit: String(SEITE), offset: "0" });
        if (beendet) return;
        const restOffen = Boolean(erste.hasMore && erste.returned > 0);
        setZustand({ items: erste.items, total: erste.total, teamContext: erste.teamContext, busy: false, nachladen: restOffen, fehler: null });
        if (!restOffen) {
          cacheRef.current.set(schluessel, erste);
          return;
        }
        let voll: FeedAntwort;
        try {
          voll = await hole({ fullPool: "true" });
        } catch {
          // Prisma-Referenzpfad: kein fullPool, hartes Limit. Dann Seiten sammeln, ohne Zwischenstände zu zeigen.
          const gesammelt = [...erste.items];
          const gesehen = new Set(gesammelt.map((item) => item.playerId));
          let offset = erste.returned;
          let weiter: boolean = restOffen;
          let letzte = erste;
          while (weiter) {
            const seite = await hole({ limit: String(SEITE), offset: String(offset) });
            if (beendet) return;
            for (const item of seite.items) {
              if (!gesehen.has(item.playerId)) {
                gesehen.add(item.playerId);
                gesammelt.push(item);
              }
            }
            letzte = seite;
            offset += seite.returned;
            weiter = Boolean(seite.hasMore && seite.returned > 0);
          }
          voll = { ...letzte, items: gesammelt } as FeedAntwort;
        }
        if (beendet) return;
        cacheRef.current.set(schluessel, voll);
        setZustand({ items: voll.items, total: voll.total, teamContext: voll.teamContext, busy: false, nachladen: false, fehler: null });
      } catch (fehler) {
        if (beendet || istAbbruch(fehler)) return;
        setZustand({
          items: [],
          total: 0,
          teamContext: null,
          busy: false,
          nachladen: false,
          fehler: formatMarketPreviewError(fehler instanceof Error ? fehler.message : null) ?? "Transfermarkt konnte nicht geladen werden.",
        });
      }
    }
    void laden();
    return () => {
      beendet = true;
      abbruch.abort();
    };
  }, [bereit, saveId, seasonId, teamId, source, suche, neuLaden]);

  return zustand;
}

/** Schreibkontext (Raum, Team, Steuerung) für POSTs — wie bisher, die Identität bestimmt der Server. */
export function schreibKontext<T extends Record<string, unknown>>(
  body: T,
  input: { teamId: string; controlMode: string | null; roomContext: FoundationRoomContext | null | undefined },
) {
  return withRoomContextBody(
    { ...body, activeManagerTeamId: input.teamId, controlMode: input.controlMode },
    input.roomContext ?? null,
  );
}

export async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<{ ok: boolean; daten: T }> {
  const antwort = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const daten = (await antwort.json()) as T;
  return { ok: antwort.ok, daten };
}
