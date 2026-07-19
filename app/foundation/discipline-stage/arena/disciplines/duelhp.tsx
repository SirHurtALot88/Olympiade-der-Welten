// STUB · duelhp (Mini-DM) — SONDERFALL: das "Feld" ist MiniDmArenaBattle, das der Host
// bereits via Early-Return rendert (eigene Reveal-Kopplung über duelMeta). Diese
// Registry-Komponente wird daher nie erreicht; sie existiert nur, damit die Registry
// total über StagePrimitive ist. Fan-out-Agent: die Mini-DM-Optik lebt in
// MiniDmArenaBattle.tsx.
import type { ReactNode } from "react";
import type { DisciplineFieldProps } from "./types";
import FieldSvgInner from "./shared";

export default function DuelhpField(props: DisciplineFieldProps): ReactNode {
  return <FieldSvgInner {...props} />;
}
