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
//
// PERF (#Arena-Erstlade-Gewicht): Pro Spieltag läuft genau EINE der 20 Disziplinen —
// welches Primitive das ist, steht schon fest, bevor die Bühne aufgeht (Spielplan/
// Dropdown-Vorauswahl in DisciplineStageArena.tsx). Die anderen ~19 Feld-Dateien
// (zusammen ~10.000 Zeilen) wurden vorher trotzdem STATISCH importiert und liefen damit
// bei JEDEM Arena-Erstbild mit, obwohl sie in dieser Sitzung nie gebraucht werden — das
// ist kein "später nachladen" (wie die view-Panels in FoundationShellRouterBody.tsx),
// sondern "nie laden" für alle bis auf eine. Jede Feld-Datei kommt daher jetzt über
// next/dynamic (ssr:false, wie im Rest der App — die Arena rendert ohnehin nur
// client-seitig, siehe FoundationDisciplineStageHost). `loading` bleibt bewusst leer
// (kein Spinner-Flash über dem Spielfeld): das Feld setzt still ein, sobald sein Chunk
// da ist, während Kopf/Dropdown/Mutatoren der Bühne (Host-Chrome) längst stehen.
//
// Damit der Wechsel Disziplin 1 → Disziplin 2 mitten in einem laufenden Spieltag NIE
// einen Ladeframe zeigt, preloadet DisciplineStageArena.tsx die jeweils NICHT aktive
// Spieltags-Disziplin im Hintergrund, sobald der Spielplan bekannt ist (siehe
// preloadDisciplineField unten) — der Chunk liegt so längst im Browser-Cache, bevor er
// gebraucht wird.
// =====================================================================================

import dynamic from "next/dynamic";

import type { StagePrimitive } from "../DisciplineStageNativeArena";
import type { DisciplineField } from "./types";

type FieldLoader = () => Promise<{ default: DisciplineField }>;

// Rohe Lademodul-Funktionen — dieselbe Referenz treibt sowohl die dynamic()-gewrappte
// Render-Komponente unten ALS AUCH preloadDisciplineField() (das den Chunk vorab anstößt,
// ohne die Suspense-Umhüllung von dynamic() zu benutzen). Webpack dedupliziert den
// eigentlichen Chunk-Request über beide Aufrufer hinweg — ein Preload wärmt also exakt
// den Chunk, den die spätere Render-Komponente nachher braucht.
const FIELD_LOADERS: Record<StagePrimitive, FieldLoader> = {
  track: () => import("./track"),
  lanes: () => import("./lanes"),
  towers: () => import("./towers"),
  stage: () => import("./stage"),
  platter: () => import("./platter"),
  lamps: () => import("./lamps"),
  spybar: () => import("./spybar"),
  kda: () => import("./kda"),
  duelhp: () => import("./duelhp"),
  barbell: () => import("./barbell"),
  sparkbar: () => import("./sparkbar"),
  // thermometer-Primitive existiert nur noch als Geometrie-Key für Breaking Point; das
  // alte Schmerz-Thermometer-Feld ist gelöscht. Fällt hier BreakingField ein (statt des
  // Thermometers), falls je direkt aufs Primitive statt auf die disciplineId aufgelöst wird.
  thermometer: () => import("./breaking"),
  peloton: () => import("./peloton"),
  parcours: () => import("./parcours"),
  bump: () => import("./bump"),
  mountain: () => import("./mountain"),
  court: () => import("./court"),
  rink: () => import("./rink"),
  klassen: () => import("./klassen"),
  territory: () => import("./territory"),
};

// Bespoke Lademodul-Funktionen für Disziplinen, die sich ein Primitive teilen. Der Key ist
// die disciplineId (siehe NATIVE_PRIMITIVE in DisciplineStageArena.tsx). Wird von den
// Wellen-Agents befüllt, sobald die jeweilige 1:1-Datei existiert.
const DISCIPLINE_ID_FIELD_LOADERS: Record<string, FieldLoader> = {
  // parcours (geteilt): Takeshi = Burg-Parcours, Football = Flutlicht-Rasen.
  "takeshis-castle": () => import("./takeshi"),
  football: () => import("./football"),
  // klassen (geteilt): Speed-Schach = Elo-Klassen-Brett, Tennis = Setzköpfe-Court.
  "speed-schach": () => import("./schach"),
  tennis: () => import("./tennis"),
  // stage (geteilt): Eiskunstlauf = Eis-Kür, Showcase = Theater-Bühne.
  eiskunstlauf: () => import("./eiskunst"),
  showcase: () => import("./showcase"),
  // thermometer-Primitive überschrieben: Breaking Point = lila Survival-Cypher (nach innen
  // zum SURVIVOR), NICHT das Schmerz-Thermometer.
  breaking: () => import("./breaking"),
};

function loadableField(loader: FieldLoader): DisciplineField {
  // next/dynamic() liefert allgemein ComponentType<P> (Klassen- ODER Funktionskomponente);
  // jede Feld-Datei exportiert aber immer eine Funktionskomponente (Contract in types.ts),
  // der Cast macht das für den Compiler explizit.
  return dynamic(loader, { ssr: false }) as DisciplineField;
}

export const DISCIPLINE_FIELD_REGISTRY: Record<StagePrimitive, DisciplineField> = {
  track: loadableField(FIELD_LOADERS.track),
  lanes: loadableField(FIELD_LOADERS.lanes),
  towers: loadableField(FIELD_LOADERS.towers),
  stage: loadableField(FIELD_LOADERS.stage),
  platter: loadableField(FIELD_LOADERS.platter),
  lamps: loadableField(FIELD_LOADERS.lamps),
  spybar: loadableField(FIELD_LOADERS.spybar),
  kda: loadableField(FIELD_LOADERS.kda),
  duelhp: loadableField(FIELD_LOADERS.duelhp),
  barbell: loadableField(FIELD_LOADERS.barbell),
  sparkbar: loadableField(FIELD_LOADERS.sparkbar),
  thermometer: loadableField(FIELD_LOADERS.thermometer),
  peloton: loadableField(FIELD_LOADERS.peloton),
  parcours: loadableField(FIELD_LOADERS.parcours),
  bump: loadableField(FIELD_LOADERS.bump),
  mountain: loadableField(FIELD_LOADERS.mountain),
  court: loadableField(FIELD_LOADERS.court),
  rink: loadableField(FIELD_LOADERS.rink),
  klassen: loadableField(FIELD_LOADERS.klassen),
  territory: loadableField(FIELD_LOADERS.territory),
};

export const DISCIPLINE_ID_FIELD_REGISTRY: Record<string, DisciplineField> = Object.fromEntries(
  Object.entries(DISCIPLINE_ID_FIELD_LOADERS).map(([disciplineId, loader]) => [disciplineId, loadableField(loader)]),
);

export function getDisciplineField(
  primitive: StagePrimitive,
  disciplineId?: string,
): DisciplineField {
  if (disciplineId && DISCIPLINE_ID_FIELD_REGISTRY[disciplineId]) {
    return DISCIPLINE_ID_FIELD_REGISTRY[disciplineId]!;
  }
  return DISCIPLINE_FIELD_REGISTRY[primitive] ?? DISCIPLINE_FIELD_REGISTRY.sparkbar;
}

/**
 * Stößt den Chunk-Download für ein Feld an, OHNE es zu rendern — dieselbe Auflösung wie
 * getDisciplineField (disciplineId schlägt primitive). Für Aufrufer, die schon wissen,
 * welche Disziplin GLEICH drankommt (z. B. die nicht-aktive Spieltags-Disziplin während
 * die aktive noch läuft), und damit dem Nutzer keinen Ladeframe beim Wechsel zeigen wollen.
 * Rein additiv/best-effort: Fehler beim Vorabladen werden geschluckt, der eigentliche
 * Render-Versuch (getDisciplineField) holt den Chunk im Fehlerfall einfach noch einmal.
 */
export function preloadDisciplineField(primitive: StagePrimitive, disciplineId?: string): void {
  const loader =
    (disciplineId && DISCIPLINE_ID_FIELD_LOADERS[disciplineId]) || FIELD_LOADERS[primitive];
  if (!loader) return;
  loader().catch(() => {
    // Best effort — ein gescheiterter Preload blockiert nichts, der spätere echte
    // Render-Versuch holt den Chunk erneut.
  });
}
