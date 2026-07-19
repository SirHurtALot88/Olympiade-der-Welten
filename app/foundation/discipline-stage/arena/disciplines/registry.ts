// =====================================================================================
// DISCIPLINE FIELD REGISTRY
// =====================================================================================
// Der Host wählt anhand des StagePrimitive die Feld-Komponente aus dieser Registry.
// Jede Disziplin hat GENAU EINE Feld-Datei (arena/disciplines/<primitive>.tsx), die den
// DisciplineFieldProps-Contract erfüllt. So können 19 Fan-out-Agents je 1 Disziplin
// unabhängig (neu-)bauen, ohne sich zu blockieren.
//
// Stand:
//   • track  → bespoke rebuild (Pilot, rAF-Oval-Glide).
//   • alle anderen → STUB, delegiert an FieldSvgInner (Verhalten 1:1 wie vorher).
//   • duelhp → Sonderfall (MiniDmArenaBattle via Host-Early-Return); Eintrag ist ein
//     dokumentierter No-op, damit die Registry total über StagePrimitive bleibt.
// =====================================================================================

import type { StagePrimitive } from "../DisciplineStageNativeArena";
import type { DisciplineField } from "./types";

import TrackField from "./track";
import LanesField from "./lanes";
import TowersField from "./towers";
import StageField from "./stage";
import PlatterField from "./platter";
import LampsField from "./lamps";
import SpybarField from "./spybar";
import KdaField from "./kda";
import DuelhpField from "./duelhp";
import BarbellField from "./barbell";
import SparkbarField from "./sparkbar";
import ThermometerField from "./thermometer";
import PelotonField from "./peloton";
import ParcoursField from "./parcours";
import BumpField from "./bump";
import MountainField from "./mountain";
import CourtField from "./court";
import RinkField from "./rink";
import KlassenField from "./klassen";
import TerritoryField from "./territory";

export const DISCIPLINE_FIELD_REGISTRY: Record<StagePrimitive, DisciplineField> = {
  track: TrackField,
  lanes: LanesField,
  towers: TowersField,
  stage: StageField,
  platter: PlatterField,
  lamps: LampsField,
  spybar: SpybarField,
  kda: KdaField,
  duelhp: DuelhpField,
  barbell: BarbellField,
  sparkbar: SparkbarField,
  thermometer: ThermometerField,
  peloton: PelotonField,
  parcours: ParcoursField,
  bump: BumpField,
  mountain: MountainField,
  court: CourtField,
  rink: RinkField,
  klassen: KlassenField,
  territory: TerritoryField,
};

export function getDisciplineField(primitive: StagePrimitive): DisciplineField {
  return DISCIPLINE_FIELD_REGISTRY[primitive] ?? SparkbarField;
}
