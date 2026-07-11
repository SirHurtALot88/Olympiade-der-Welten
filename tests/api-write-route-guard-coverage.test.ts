import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  API_WRITE_ROUTE_ALLOWLIST,
  API_WRITE_ROUTE_GUARD_REQUIRED,
  isAllowlistedApiWriteRoute,
} from "@/lib/room/api-write-route-policy";

const API_ROOT = path.join(process.cwd(), "app/api");
const MUTATING_METHOD_PATTERN = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/g;
const GUARD_IMPORT_PATTERN = /authorizeServerRoomWrite/;
const GUARD_CALL_PATTERN = /authorizeServerRoomWrite\s*\(/;

function listRouteFiles(dir: string, prefix = ""): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry);
    const relative = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(absolute).isDirectory()) {
      files.push(...listRouteFiles(absolute, relative));
      continue;
    }
    if (entry === "route.ts") {
      files.push(relative.replace(/\/route\.ts$/, ""));
    }
  }

  return files.sort();
}

function readMutatingMethods(routePath: string) {
  const source = readFileSync(path.join(API_ROOT, routePath, "route.ts"), "utf8");
  const methods = new Set<string>();
  for (const match of source.matchAll(MUTATING_METHOD_PATTERN)) {
    methods.add(match[1]);
  }
  return { source, methods: [...methods].sort() };
}

describe("api write route guard coverage", () => {
  it("points allowlist and guard-required entries at existing route files", () => {
    const routePaths = new Set(listRouteFiles(API_ROOT));
    const missingPaths = [...API_WRITE_ROUTE_ALLOWLIST, ...API_WRITE_ROUTE_GUARD_REQUIRED]
      .map((entry) => entry.routePath)
      .filter((routePath) => !routePaths.has(routePath));

    expect(missingPaths).toEqual([]);
  });

  it("requires authorizeServerRoomWrite on guarded routes", () => {
    const missingGuard: string[] = [];

    for (const entry of API_WRITE_ROUTE_GUARD_REQUIRED) {
      const { source } = readMutatingMethods(entry.routePath);
      if (!GUARD_IMPORT_PATTERN.test(source) || !GUARD_CALL_PATTERN.test(source)) {
        missingGuard.push(entry.routePath);
      }
    }

    expect(missingGuard).toEqual([]);
  });

  it("requires authorizeServerRoomWrite on all non-allowlisted mutating routes", () => {
    const routePaths = listRouteFiles(API_ROOT);
    const unguarded: string[] = [];

    for (const routePath of routePaths) {
      const { source, methods } = readMutatingMethods(routePath);
      if (methods.length === 0) {
        continue;
      }

      const allAllowlisted = methods.every((method) => isAllowlistedApiWriteRoute(routePath, method));
      if (allAllowlisted) {
        continue;
      }

      if (!GUARD_IMPORT_PATTERN.test(source) || !GUARD_CALL_PATTERN.test(source)) {
        unguarded.push(routePath);
      }
    }

    expect(unguarded).toEqual([]);
  });

  it("keeps allowlist entries unique", () => {
    const keys = API_WRITE_ROUTE_ALLOWLIST.map((entry) => `${entry.routePath}:${entry.methods.join(",")}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
