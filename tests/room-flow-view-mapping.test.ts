import { describe, expect, it } from "vitest";

import { ROOM_FLOW_STEPS, mapRoomFlowViewToFoundationViewId, type RoomFlowView } from "@/lib/room/room-flow-controller";
import { FOUNDATION_VIEW_IDS, normalizeFoundationViewParam } from "@/lib/foundation/foundation-view-routing";

// `RoomFlowView` (Room-Flow-Domäne) und `FoundationViewId` (Shell-Routing) sind zwei
// unabhaengige Typen. Diese Liste haelt ALLE `RoomFlowView`-Werte explizit fest: kommt ein
// neuer Wert im Union-Typ hinzu, ohne dass diese Liste (und `ROOM_FLOW_VIEW_TO_FOUNDATION_VIEW`
// in `room-flow-controller.ts`) mitgezogen wird, faellt das schon beim `tsc --noEmit` auf
// (`Record<RoomFlowView, FoundationViewId>` erzwingt Vollstaendigkeit) — dieser Test prueft
// zusaetzlich das RUNTIME-Verhalten aller bekannten Werte.
const ALL_ROOM_FLOW_VIEWS: RoomFlowView[] = [
  "teams",
  "market",
  "training",
  "trainingV2",
  "lineup",
  "matchdayArena",
  "season",
  "cockpit",
];

describe("RoomFlowView → FoundationViewId Mapping", () => {
  it("bildet jeden RoomFlowView-Wert auf eine gueltige FoundationViewId ab", () => {
    for (const view of ALL_ROOM_FLOW_VIEWS) {
      const mapped = mapRoomFlowViewToFoundationViewId(view);
      expect(mapped).toBeTruthy();
      expect(FOUNDATION_VIEW_IDS).toContain(mapped);
    }
  });

  it("stimmt mit der Legacy-Aufloesung von `?view=`-Query-Params ueberein (normalizeFoundationViewParam)", () => {
    // `RoomPageClient.buildFoundationHref` haengt `roomFlowButton.targetView` roh als `?view=`
    // an — genau DAS loest `normalizeFoundationViewParam` beim Laden von `/foundation` schon
    // heute auf. Die Auto-Navigation in der Shell darf hiervon nicht abweichen, sonst landet
    // ein Deep-Link auf einer anderen View als die Auto-Navigation fuer denselben Schritt.
    for (const view of ALL_ROOM_FLOW_VIEWS) {
      expect(mapRoomFlowViewToFoundationViewId(view)).toBe(normalizeFoundationViewParam(view));
    }
  });

  it("deckt jeden in ROOM_FLOW_STEPS tatsaechlich verwendeten targetView ab", () => {
    for (const step of ROOM_FLOW_STEPS) {
      expect(() => mapRoomFlowViewToFoundationViewId(step.targetView)).not.toThrow();
      expect(mapRoomFlowViewToFoundationViewId(step.targetView)).toBeTruthy();
    }
  });

  it("bildet die konkreten, im Spiel genutzten Ziele wie erwartet ab", () => {
    expect(mapRoomFlowViewToFoundationViewId("teams")).toBe("teams");
    expect(mapRoomFlowViewToFoundationViewId("market")).toBe("marketV2");
    expect(mapRoomFlowViewToFoundationViewId("training")).toBe("trainingCompact");
    expect(mapRoomFlowViewToFoundationViewId("trainingV2")).toBe("trainingV2");
    expect(mapRoomFlowViewToFoundationViewId("lineup")).toBe("lineup");
    expect(mapRoomFlowViewToFoundationViewId("matchdayArena")).toBe("matchdayArena");
    expect(mapRoomFlowViewToFoundationViewId("season")).toBe("seasonV2");
    expect(mapRoomFlowViewToFoundationViewId("cockpit")).toBe("cockpit");
  });
});
