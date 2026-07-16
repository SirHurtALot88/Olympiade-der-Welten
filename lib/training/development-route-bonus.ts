import type { PlayerDevelopmentRouteSuggestion } from "@/lib/progression/player-potential-service";

const ROUTE_AXIS_MAP: Record<Exclude<PlayerDevelopmentRouteSuggestion, "BALANCED" | "RECOVERY">, "pow" | "spe" | "men" | "soc"> = {
  POW: "pow",
  SPE: "spe",
  MEN: "men",
  SOC: "soc",
};

export function getDevelopmentRouteBonusMultiplier(
  route: PlayerDevelopmentRouteSuggestion,
  trainingFocusAxis?: "pow" | "spe" | "men" | "soc" | null,
): number {
  if (!trainingFocusAxis || route === "BALANCED" || route === "RECOVERY") {
    return 1;
  }
  const routeAxis = ROUTE_AXIS_MAP[route as keyof typeof ROUTE_AXIS_MAP];
  if (!routeAxis) return 1;
  return routeAxis === trainingFocusAxis ? 1.08 : 1;
}

export function formatDevelopmentRouteLabel(route: PlayerDevelopmentRouteSuggestion) {
  if (route === "BALANCED") return "Ausgewogen";
  if (route === "RECOVERY") return "Recovery";
  return route;
}
