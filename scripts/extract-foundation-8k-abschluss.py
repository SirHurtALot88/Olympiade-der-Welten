#!/usr/bin/env python3
"""Extract FoundationPageClient orchestrator to scope hook; thin parent <=8k."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PARENT = ROOT / "app/foundation/FoundationPageClient.tsx"
SCOPE = ROOT / "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"
EXPORTS = ROOT / "app/foundation/foundation-page-client-exports.ts"
MAPPING = ROOT / "app/foundation/MappingHighlight.tsx"
TEST_HELPER = ROOT / "tests/foundation-orchestrator-source.ts"


def main() -> None:
    text = PARENT.read_text()
    lines = text.splitlines(keepends=True)

    fn_start = None
    for i, line in enumerate(lines):
        if line.startswith("function FoundationPageClientInner("):
            fn_start = i
            break
    if fn_start is None:
        raise SystemExit("FoundationPageClientInner not found")

    export_start = None
    for i in range(fn_start, len(lines)):
        if lines[i] == "export {\n":
            export_start = i
            break
    if export_start is None:
        raise SystemExit("export block not found")

    header = "".join(lines[:fn_start])
    body_lines = lines[fn_start:export_start]
    export_block = "".join(lines[export_start:])

    body = "".join(body_lines)
    body = body.replace(
        "function FoundationPageClientInner({",
        "export function useFoundationShellRouterBodyScope({",
        1,
    )
    body = body.replace(
        "}: FoundationPageClientProps) {",
        "}: FoundationPageClientProps): FoundationShellRouterBodyProps {",
        1,
    )
    body = body.replace(
        "  return <FoundationShellRouterBody {...(foundationShellRouterBodyProps as FoundationShellRouterBodyProps)} />;\n}",
        "  return foundationShellRouterBodyProps as FoundationShellRouterBodyProps;\n}\n",
        1,
    )

    header = header.replace(
        "import {\n  SPECIALIST_WING_VARIANTS,\n  type FacilityId,\n  type SpecialistWingVariant,\n} from \"@/lib/facilities/facility-catalog\";",
        "import {\n  FACILITY_CATALOG,\n  SPECIALIST_WING_VARIANTS,\n  type FacilityId,\n  type SpecialistWingVariant,\n} from \"@/lib/facilities/facility-catalog\";",
        1,
    )
    header = header.replace(
        'import { FoundationShellRouterBody } from "@/app/foundation/FoundationShellRouterBody";\n',
        "",
    )
    header = header.replace(
        'import type { FoundationShellRouterBodyProps } from "@/app/foundation/foundation-shell-router-body-props";\n',
        "",
    )

    scope_imports = (
        'import type { FoundationShellRouterBodyProps } from "@/app/foundation/foundation-shell-router-body-props";\n'
    )
    header = header.replace('"use client";\n', '"use client";\n' + scope_imports, 1)

    # Remove MappingHighlight from barrel — standalone component
    export_block = export_block.replace("  MappingHighlight,\n", "")

    scope_content = header + "\n" + body + "\n" + export_block
    SCOPE.parent.mkdir(parents=True, exist_ok=True)
    SCOPE.write_text(scope_content)

    MAPPING.write_text(
        '''"use client";

type MappingWarning = {
  type: string;
  message: string;
};

export function MappingHighlight({ warning }: { warning: MappingWarning }) {
  return (
    <div className={`mapping-warning mapping-warning-${warning.type}`}>
      <strong>{warning.type}</strong>
      <span>{warning.message}</span>
    </div>
  );
}
'''
    )

    value_names, type_names = parse_exports(export_block)
    exports_lines = [
        '"use client";',
        "",
        "/** Barrel trimmed from FoundationPageClient for FoundationShellRouterBody. */",
        "export {",
    ]
    for name in value_names:
        if name == "MappingHighlight":
            continue
        exports_lines.append(f"  {name},")
    exports_lines.append('} from "@/lib/foundation/tabs/use-foundation-shell-router-body-scope";')
    exports_lines.append('export { MappingHighlight } from "@/app/foundation/MappingHighlight";')
    exports_lines.append("")
    if type_names:
        exports_lines.append("export type {")
        for name in type_names:
            exports_lines.append(f"  {name},")
        exports_lines.append('} from "@/lib/foundation/tabs/foundation-page-types";')
        exports_lines.append("")

    EXPORTS.write_text("\n".join(exports_lines) + "\n")

    parent_content = '''"use client";

import { FoundationShellRouterBody } from "@/app/foundation/FoundationShellRouterBody";
import type { FoundationPageClientProps } from "@/lib/foundation/tabs/foundation-page-types";
import { useFoundationShellRouterBodyScope } from "@/lib/foundation/tabs/use-foundation-shell-router-body-scope";

export {
  setFoundationView,
  syncFoundationViewInUrl,
} from "@/app/foundation/foundation-page-client-exports";

export type {
  DisciplineCategoryFilter,
  FacilityId,
  FoundationView,
  FoundationViewId,
  GameFlowView,
  NewGamePresetId,
  PlayerProfileTabId,
  PlayerTableScope,
  SpecialistWingVariant,
  TeamControlFilter,
  TeamStrategyProfile,
} from "@/app/foundation/foundation-page-client-exports";

export default function FoundationPageClient(props: FoundationPageClientProps) {
  const foundationShellRouterBodyProps = useFoundationShellRouterBodyScope(props);
  return <FoundationShellRouterBody {...foundationShellRouterBodyProps} />;
}
'''
    PARENT.write_text(parent_content)

    shell_path = ROOT / "app/foundation/FoundationShellRouterBody.tsx"
    shell_text = shell_path.read_text()
    shell_text = shell_text.replace(
        '@/app/foundation/FoundationPageClient',
        '@/app/foundation/foundation-page-client-exports',
    )
    shell_path.write_text(shell_text)

    TEST_HELPER.write_text(
        '''import fs from "node:fs/promises";
import path from "node:path";

const defaultRoot = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten";

export async function readFoundationOrchestratorSource(root = defaultRoot): Promise<string> {
  const parent = await fs.readFile(path.join(root, "app/foundation/FoundationPageClient.tsx"), "utf8");
  const scope = await fs.readFile(
    path.join(root, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
    "utf8",
  );
  return `${parent}\\n${scope}`;
}

export async function readFoundationSurfaceSource(root = defaultRoot): Promise<string> {
  const orchestrator = await readFoundationOrchestratorSource(root);
  const shell = await fs.readFile(path.join(root, "app/foundation/FoundationShellRouterBody.tsx"), "utf8");
  return `${orchestrator}\\n${shell}`;
}
'''
    )

    print("parent lines:", len(parent_content.splitlines()))
    print("scope lines:", len(scope_content.splitlines()))


def parse_exports(export_block: str) -> tuple[list[str], list[str]]:
    value_match = re.search(r"export \{([^}]+)\};", export_block, re.DOTALL)
    type_match = re.search(r"export type \{([^}]+)\};", export_block, re.DOTALL)
    value_names = []
    type_names = []
    if value_match:
        value_names = [n.strip() for n in value_match.group(1).split(",") if n.strip()]
    if type_match:
        type_names = [n.strip() for n in type_match.group(1).split(",") if n.strip()]
    return value_names, type_names


if __name__ == "__main__":
    main()
