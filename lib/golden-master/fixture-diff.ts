export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type DiffKind =
  | "exact_match"
  | "numeric_delta"
  | "missing_field"
  | "extra_field"
  | "order_mismatch"
  | "value_mismatch";

export type DiffEntry = {
  path: string;
  kind: DiffKind;
  expected?: JsonValue;
  actual?: JsonValue;
  delta?: number;
};

export type CompareOptions = {
  ignoredPaths?: string[];
  toleratedFloatDelta?: number;
};

function isRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shouldIgnore(path: string, ignoredPaths: string[]) {
  return ignoredPaths.some((entry) => path === entry || path.startsWith(`${entry}.`) || path.startsWith(`${entry}[`));
}

function formatPath(parent: string, segment: string) {
  return parent.length === 0 ? segment : `${parent}.${segment}`;
}

function compareArray(path: string, expected: JsonValue[], actual: JsonValue[], options: Required<CompareOptions>, diffs: DiffEntry[]) {
  if (expected.length !== actual.length) {
    diffs.push({
      path,
      kind: expected.length > actual.length ? "missing_field" : "extra_field",
      expected: expected.length,
      actual: actual.length,
    });
  }

  const length = Math.min(expected.length, actual.length);
  for (let index = 0; index < length; index += 1) {
    compareJson(`${path}[${index}]`, expected[index]!, actual[index]!, options, diffs);
  }

  if (expected.length === actual.length) {
    const expectedSerialized = expected.map((item) => JSON.stringify(item));
    const actualSerialized = actual.map((item) => JSON.stringify(item));
    const sameMembers = [...expectedSerialized].sort().join("|") === [...actualSerialized].sort().join("|");
    const sameOrder = expectedSerialized.join("|") === actualSerialized.join("|");
    if (sameMembers && !sameOrder) {
      diffs.push({
        path,
        kind: "order_mismatch",
        expected: expected,
        actual: actual,
      });
    }
  }
}

function compareObject(
  path: string,
  expected: { [key: string]: JsonValue },
  actual: { [key: string]: JsonValue },
  options: Required<CompareOptions>,
  diffs: DiffEntry[],
) {
  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(actual);

  for (const key of expectedKeys) {
    const nextPath = formatPath(path, key);
    if (shouldIgnore(nextPath, options.ignoredPaths)) {
      continue;
    }
    if (!(key in actual)) {
      diffs.push({
        path: nextPath,
        kind: "missing_field",
        expected: expected[key],
      });
      continue;
    }
    compareJson(nextPath, expected[key]!, actual[key]!, options, diffs);
  }

  for (const key of actualKeys) {
    const nextPath = formatPath(path, key);
    if (shouldIgnore(nextPath, options.ignoredPaths)) {
      continue;
    }
    if (!(key in expected)) {
      diffs.push({
        path: nextPath,
        kind: "extra_field",
        actual: actual[key],
      });
    }
  }
}

export function compareJson(
  path: string,
  expected: JsonValue,
  actual: JsonValue,
  options: Required<CompareOptions>,
  diffs: DiffEntry[],
) {
  if (shouldIgnore(path, options.ignoredPaths)) {
    return;
  }

  if (typeof expected === "number" && typeof actual === "number") {
    const delta = Math.abs(expected - actual);
    if (delta > options.toleratedFloatDelta) {
      diffs.push({
        path,
        kind: "numeric_delta",
        expected,
        actual,
        delta,
      });
    }
    return;
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    compareArray(path, expected, actual, options, diffs);
    return;
  }

  if (isRecord(expected) && isRecord(actual)) {
    compareObject(path, expected, actual, options, diffs);
    return;
  }

  if (expected !== actual) {
    diffs.push({
      path,
      kind: "value_mismatch",
      expected,
      actual,
    });
  }
}

export function diffGoldenMaster(expected: JsonValue, actual: JsonValue, options: CompareOptions = {}) {
  const normalized: Required<CompareOptions> = {
    ignoredPaths: options.ignoredPaths ?? [],
    toleratedFloatDelta: options.toleratedFloatDelta ?? 0,
  };
  const diffs: DiffEntry[] = [];
  compareJson("root", expected, actual, normalized, diffs);
  return {
    exactMatch: diffs.length === 0,
    diffs,
  };
}
