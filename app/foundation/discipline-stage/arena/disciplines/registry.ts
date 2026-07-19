// =====================================================================================
// DISCIPLINE FIELD REGISTRY
// =====================================================================================
// Der Host wählt die Feld-Komponente aus dieser Registry. Primär über den StagePrimitive;
// wenn sich MEHRERE Disziplinen ein Primitive teilen (parcours: takeshi+football,
// klassen: speed-schach+tennis, stage: eiskunstlauf+showcase), gewinnt eine
// disciplineId-spezifische Feld-Datei, damit jede dieser Disziplinen ihre eigene 1:1-Optik
// bekommt. So können Fan-out-Agents je 1 Disziplin unabhängig (neu-)bauen, ohne sich zu
// blockieren.
//
// Auflösungsreihenfolge in getDisciplineField(primitive, disciplineId):
//   1. DISCIPLINE_ID_FIELD_REGISTRY[disciplineId]  (bespoke, für geteilte Primitives)
//   2. DISCIPLINE_FIELD_REGISTRY[primitive]        (Standard: 1 Primitive = 1 Feld)
//   3. SparkbarField                                (Fallback)
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
import TakeshiField from "./takeshi";
import FootballField from "./football";
import SchachField from "./schach";
import TennisField from "./tennis";
import EiskunstField from "./eiskunst";
import ShowcaseField from "./showcase";

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

// Bespoke Felder für Disziplinen, die sich ein Primitive teilen. Der Key ist die
// disciplineId (siehe NATIVE_PRIMITIVE in DisciplineStageArena.tsx). Wird von den
// Wellen-Agents befüllt, sobald die jeweilige 1:1-Datei existiert.
export const DISCIPLINE_ID_FIELD_REGISTRY: Record<string, DisciplineField> = {
  // parcours (geteilt): Takeshi = Burg-Parcours, Football = Flutlicht-Rasen.
  "takeshis-castle": TakeshiField,
  football: FootballField,
  // klassen (geteilt): Speed-Schach = Elo-Klassen-Brett, Tennis = Setzköpfe-Court.
  "speed-schach": SchachField,
  tennis: TennisField,
  // stage (geteilt): Eiskunstlauf = Eis-Kür, Showcase = Theater-Bühne.
  eiskunstlauf: EiskunstField,
  showcase: ShowcaseField,
};

export function getDisciplineField(
  primitive: StagePrimitive,
  disciplineId?: string,
): DisciplineField {
  if (disciplineId && DISCIPLINE_ID_FIELD_REGISTRY[disciplineId]) {
    return DISCIPLINE_ID_FIELD_REGISTRY[disciplineId]!;
  }
  return DISCIPLINE_FIELD_REGISTRY[primitive] ?? SparkbarField;
}
