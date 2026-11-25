/**
 * Gewichte des Jahresplans je Vertragsform (eine Quelle fuer Unterschrift, Buyout und Vertragswert).
 * `balanced` = alle Jahre gleich; `front_loaded` / `back_loaded` = Schritt bis 20 % je Jahr um die Laufzeitmitte, Summe bleibt.
 * 5 Jahre front: 1,4 / 1,2 / 1,0 / 0,8 / 0,6 (x Jahresmittel). Reine Funktion, keine Importe ausser dem Typ.
 */
import type { ContractShape } from "@/lib/data/olyDataTypes";

export function buildShapeWeights(contractLength: number, shape: ContractShape): number[] {
  if (contractLength <= 1) {
    return [1];
  }

  if (shape === "balanced") {
    return Array.from({ length: contractLength }, () => 1);
  }

  const step = Math.min(0.2, 0.8 / Math.max(1, contractLength - 1));
  const midpoint = (contractLength - 1) / 2;

  return Array.from({ length: contractLength }, (_, index) => {
    const signedDistance = midpoint - index;
    const delta = signedDistance * step;
    const weight = shape === "front_loaded" ? 1 + delta : 1 - delta;
    return Math.max(0.2, Number(weight.toFixed(4)));
  });
}
