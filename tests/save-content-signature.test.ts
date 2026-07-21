import { describe, expect, it } from "vitest";

import { latestRecordSignature } from "@/lib/persistence/save-content-signature";

describe("latestRecordSignature", () => {
  it("keys on count + last record id/timestamp (append-only)", () => {
    const base = [
      { id: "a", createdAt: "2026-01-01T00:00:00Z" },
      { id: "b", createdAt: "2026-01-02T00:00:00Z" },
    ];
    const sig = latestRecordSignature(base);
    expect(sig).toBe("2:b:2026-01-02T00:00:00Z");
  });

  it("changes when a record is appended", () => {
    const before = latestRecordSignature([{ id: "a", createdAt: "2026-01-01T00:00:00Z" }]);
    const after = latestRecordSignature([
      { id: "a", createdAt: "2026-01-01T00:00:00Z" },
      { id: "b", createdAt: "2026-01-02T00:00:00Z" },
    ]);
    expect(before).not.toBe(after);
  });

  it("returns the empty sentinel for no records", () => {
    expect(latestRecordSignature(undefined)).toBe("0:");
    expect(latestRecordSignature([])).toBe("0:");
  });
});
