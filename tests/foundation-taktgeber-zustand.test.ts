import { describe, expect, it } from "vitest";

import { bestimmeTaktgeberZustand } from "@/app/foundation/shell/FoundationTaktgeber";
import type { FoundationActivityItem } from "@/lib/foundation/foundation-activity-types";

const laufend: FoundationActivityItem = { id: "a", label: "KI stellt auf", tone: "running", progressPct: 40 };
const fertig: FoundationActivityItem = { id: "b", label: "Fertig", tone: "success" };

describe("Taktgeber-Zustände (App-Rahmen 18.11.)", () => {
  it("läuft hat Vorrang vor allem anderen", () => {
    expect(bestimmeTaktgeberZustand("is-blocked", [laufend])).toBe("laeuft");
    expect(bestimmeTaktgeberZustand("is-ready", [fertig, laufend])).toBe("laeuft");
  });
  it("blockierter Schritt: zu", () => {
    expect(bestimmeTaktgeberZustand("is-blocked", [])).toBe("zu");
    expect(bestimmeTaktgeberZustand("is-blocked", [fertig])).toBe("zu");
  });
  it("alles bereit: weiter; Warnung: bereit", () => {
    expect(bestimmeTaktgeberZustand("is-ready", [])).toBe("weiter");
    expect(bestimmeTaktgeberZustand("is-warning", [])).toBe("bereit");
  });
});
