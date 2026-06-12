import fs from "node:fs";
import path from "node:path";

const EXPECTED_PACKAGE_NAME = "baue-einen-lokalen-web-app-prototyp";

export function assertOlyProjectRoot(cwd = process.cwd()) {
  if (process.env.OLY_APP_DISABLE_PROJECT_ROOT_GUARD === "true") {
    return;
  }

  const packageJsonPath = path.join(cwd, "package.json");
  const foundationPath = path.join(cwd, "app", "foundation", "FoundationPageClient.tsx");

  if (!fs.existsSync(packageJsonPath) || !fs.existsSync(foundationPath)) {
    throw new Error(`Oly project root guard blocked cwd=${cwd}. Run this from the Oly app project root.`);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as { name?: string };
  if (packageJson.name !== EXPECTED_PACKAGE_NAME) {
    throw new Error(
      `Oly project root guard blocked cwd=${cwd}. Expected package ${EXPECTED_PACKAGE_NAME}, got ${packageJson.name ?? "unknown"}.`,
    );
  }
}
