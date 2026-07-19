// STUB · lanes — aktuelle Feld-Darstellung 1:1 aus dem Host, delegiert an FieldSvgInner.
// Fan-out-Agent: hier die bespoke Feld-Optik/Bewegung für "lanes" bauen (Contract:
// DisciplineFieldProps). Der Host bleibt Wahrheit (Score/Reveal/Ladder/Ticker).
import type { ReactNode } from "react";
import type { DisciplineFieldProps } from "./types";
import FieldSvgInner from "./shared";

export default function LanesField(props: DisciplineFieldProps): ReactNode {
  return <FieldSvgInner {...props} />;
}
