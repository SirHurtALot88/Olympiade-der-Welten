"use client";

import { useSyncExternalStore } from "react";

/**
 * Ein einziger offener Spieler-Drawer (Kurzprofil) für die ganze App (Chris 18.11.: „alle Listen öffnen ihn“).
 * Die Listen rufen über `openPlayerDrawerById` nur `oeffneSpielerKurzprofil`; `SpielerKurzprofilHost` zeichnet ihn.
 * Bewusst kein React-Zustand in der Shell: Dutzende Aufrufer bleiben unverändert, und die Shell rendert beim Öffnen nicht neu.
 */
export type SpielerKurzprofilAnfrage = { playerId: string; activePlayerId?: string | null };

let aktuell: SpielerKurzprofilAnfrage | null = null;
const hoerer = new Set<() => void>();

function melde() {
  for (const rueckruf of hoerer) rueckruf();
}

export function oeffneSpielerKurzprofil(anfrage: SpielerKurzprofilAnfrage): void {
  aktuell = { playerId: anfrage.playerId, activePlayerId: anfrage.activePlayerId ?? null };
  melde();
}

export function schliesseSpielerKurzprofil(): void {
  if (aktuell == null) return;
  aktuell = null;
  melde();
}

export function leseSpielerKurzprofilAnfrage(): SpielerKurzprofilAnfrage | null {
  return aktuell;
}

function abonniere(rueckruf: () => void) {
  hoerer.add(rueckruf);
  return () => {
    hoerer.delete(rueckruf);
  };
}

export function useSpielerKurzprofilAnfrage(): SpielerKurzprofilAnfrage | null {
  return useSyncExternalStore(abonniere, leseSpielerKurzprofilAnfrage, () => null);
}
