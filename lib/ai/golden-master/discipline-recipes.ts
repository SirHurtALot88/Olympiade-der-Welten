export const RETOOL_DISCIPLINE_RECIPES_VERSION = "aiSNP_needsCore.v22_0_direct_clean_axis_fix";

export const RETOOL_DISCIPLINE_AXIS = {
  tdm: "pow",
  mini_dm: "pow",
  gewichtheben: "pow",
  hockey: "pow",
  breaking: "pow",
  staffel: "spe",
  time_trial: "spe",
  spurt: "spe",
  climbing: "spe",
  fechten: "spe",
  schach: "men",
  takeshi: "men",
  tennis: "men",
  i_spy: "men",
  wettessen: "men",
  basketball: "soc",
  football: "soc",
  battlefield: "soc",
  eiskunst: "soc",
  showcase: "soc",
} as const;

export const RETOOL_AXIS_COLOR = {
  pow: "red",
  spe: "green",
  men: "blue",
  soc: "yellow",
} as const;

export type RetoolDisciplineAxisKey = keyof typeof RETOOL_DISCIPLINE_AXIS;
export type RetoolAxisColorKey = keyof typeof RETOOL_AXIS_COLOR;

// Open question:
// The original Retool source also contains dynamic helpers like normalizeSharesSoft(),
// buildPreviewContext(), and makeDisziNeed(). Those are intentionally not ported here.
// This module only carries the static recipe/config parts that are visible 1:1 in the extract.
