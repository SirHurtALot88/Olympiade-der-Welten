import fs from "node:fs/promises";
import path from "node:path";

const defaultRoot = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten";

export async function readFoundationOrchestratorSource(root = defaultRoot): Promise<string> {
  const parent = await fs.readFile(path.join(root, "app/foundation/FoundationPageClient.tsx"), "utf8");
  const scope = await fs.readFile(
    path.join(root, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
    "utf8",
  );
  return `${parent}\n${scope}`;
}

export async function readFoundationSurfaceSource(root = defaultRoot): Promise<string> {
  const orchestrator = await readFoundationOrchestratorSource(root);
  const shell = await fs.readFile(path.join(root, "app/foundation/FoundationShellRouterBody.tsx"), "utf8");
  const router = await fs.readFile(path.join(root, "app/foundation/FoundationShellRouter.tsx"), "utf8");
  return `${orchestrator}\n${shell}\n${router}`;
}
