import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

type BuildManifest = {
  pages?: Record<string, string[]>;
};

type PrerenderManifest = {
  routes?: Record<string, unknown>;
  dynamicRoutes?: Record<string, unknown>;
};

const require = createRequire(import.meta.url);

function getProjectDir() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptDir, "..");
}

function buildPagesManifestFallback() {
  return {
    "/_app": require.resolve("next/dist/pages/_app.js"),
    "/_document": require.resolve("next/dist/pages/_document.js"),
  };
}

async function readJsonIfPresent<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function readTextIfPresent(filePath: string): Promise<string | null> {
  try {
    return (await readFile(filePath, "utf8")).trim();
  } catch {
    return null;
  }
}

function buildClientBuildManifestSource(manifest: BuildManifest) {
  const pages = manifest.pages ?? {};
  const clientManifest = {
    __rewrites: {
      afterFiles: [],
      beforeFiles: [],
      fallback: [],
    },
    ...pages,
    sortedPages: Object.keys(pages).sort((left, right) => left.localeCompare(right)),
  };

  return `self.__BUILD_MANIFEST = ${JSON.stringify(clientManifest, null, 2)};self.__BUILD_MANIFEST_CB && self.__BUILD_MANIFEST_CB()`;
}

function buildSsgManifestSource(manifest: PrerenderManifest) {
  const routeKeys = new Set<string>([
    ...Object.keys(manifest.routes ?? {}),
    ...Object.keys(manifest.dynamicRoutes ?? {}),
  ]);

  return `self.__SSG_MANIFEST = new Set(${JSON.stringify(Array.from(routeKeys).sort((left, right) => left.localeCompare(right)))});self.__SSG_MANIFEST_CB && self.__SSG_MANIFEST_CB()`;
}

async function ensureClientStaticManifests(projectDir: string) {
  const distDir = path.join(projectDir, ".next");
  const buildId = await readTextIfPresent(path.join(distDir, "BUILD_ID"));
  if (!buildId) {
    return;
  }

  const buildManifest = await readJsonIfPresent<BuildManifest>(path.join(distDir, "build-manifest.json"));
  const prerenderManifest = await readJsonIfPresent<PrerenderManifest>(path.join(distDir, "prerender-manifest.json"));
  if (!buildManifest || !prerenderManifest) {
    return;
  }

  const staticDir = path.join(distDir, "static", buildId);
  await mkdir(staticDir, { recursive: true });

  await writeFile(
    path.join(staticDir, "_buildManifest.js"),
    buildClientBuildManifestSource(buildManifest),
    "utf8",
  );
  await writeFile(
    path.join(staticDir, "_ssgManifest.js"),
    buildSsgManifestSource(prerenderManifest),
    "utf8",
  );
}

async function ensureServerManifestFile(filePath: string, fallbackValue: unknown, options?: { requireAlternate?: boolean }) {
  const existing = await readJsonIfPresent<unknown>(filePath);
  if (existing) {
    return;
  }

  const alternateServerPath = filePath.replace(`${path.sep}server${path.sep}`, `${path.sep}server 2${path.sep}`);
  const alternate = await readJsonIfPresent<unknown>(alternateServerPath);
  if (!alternate && options?.requireAlternate) {
    return;
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(alternate ?? fallbackValue, null, 2), "utf8");
}

async function ensureServerBuildManifests(projectDir: string, options: { includeAppPaths?: boolean } = {}) {
  const distDir = path.join(projectDir, ".next");
  const serverDir = path.join(distDir, "server");
  await ensureServerManifestFile(path.join(serverDir, "pages-manifest.json"), buildPagesManifestFallback());
  if (options.includeAppPaths) {
    await ensureServerManifestFile(path.join(serverDir, "app-paths-manifest.json"), {});
  }
  await ensureServerManifestFile(path.join(serverDir, "middleware-manifest.json"), {
    version: 3,
    middleware: {},
    functions: {},
    sortedMiddleware: [],
  });
  await ensureServerManifestFile(path.join(serverDir, "next-font-manifest.json"), {
    pages: {},
    app: {},
    appUsingSizeAdjust: false,
    pagesUsingSizeAdjust: false,
  });
  await ensureServerManifestFile(path.join(serverDir, "server-reference-manifest.json"), {
    node: {},
    edge: {},
    encryptionKey: "",
  });
}

async function ensureKnownAppTraceFallbacks(projectDir: string) {
  const serverDir = path.join(projectDir, ".next", "server");
  const traceFallback = {
    version: 1,
    files: [],
  };
  const appDir = path.join(projectDir, "app");
  const tracePaths = new Set<string>([
    path.join(serverDir, "app", "_not-found", "page.js.nft.json"),
    path.join(serverDir, "pages", "_app.js.nft.json"),
    path.join(serverDir, "pages", "_build-compat.js.nft.json"),
    path.join(serverDir, "pages", "_document.js.nft.json"),
    path.join(serverDir, "pages", "_error.js.nft.json"),
    path.join(serverDir, "pages", "build-compat.js.nft.json"),
  ]);

  async function visit(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    await Promise.all(
      entries.map(async (entry) => {
        const absolutePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await visit(absolutePath);
          return;
        }
        const match = /^(page|route)\.(tsx?|jsx?)$/.exec(entry.name);
        if (!match) return;
        const kind = match[1];
        const relativeDir = path.relative(appDir, dir);
        tracePaths.add(path.join(serverDir, "app", relativeDir, `${kind}.js.nft.json`));
      }),
    );
  }

  await visit(appDir);
  await Promise.all(
    Array.from(tracePaths).map((tracePath) => ensureServerManifestFile(tracePath, traceFallback)),
  );
}

async function removeStaleTypeScriptBuildInfo(projectDir: string) {
  const distDir = path.join(projectDir, ".next");
  await rm(path.join(distDir, "cache", ".tsbuildinfo"), { force: true }).catch(() => undefined);
}

async function main() {
  const projectDir = getProjectDir();
  process.chdir(projectDir);
  await removeStaleTypeScriptBuildInfo(projectDir);

  const nextBin = path.join(projectDir, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "build", "--webpack"], {
    cwd: projectDir,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PRIVATE_BUILD_WORKER: "0",
    },
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode === 0) {
    await ensureClientStaticManifests(projectDir);
    await ensureServerBuildManifests(projectDir, { includeAppPaths: true });
    await ensureKnownAppTraceFallbacks(projectDir);
  }

  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
