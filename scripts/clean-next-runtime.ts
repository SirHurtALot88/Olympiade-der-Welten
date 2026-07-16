import { execFileSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;
    const [key, inlineValue] = current.slice(2).split("=", 2);
    if (inlineValue != null) {
      args.set(key, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
      continue;
    }
    args.set(key, "true");
  }

  return {
    port: Number(args.get("port") ?? process.env.PORT ?? "3000"),
  };
}

function getProjectDir() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptDir, "..");
}

function getListeningPids(port: number) {
  try {
    const output = execFileSync("lsof", ["-ti", `tcp:${port}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!output) {
      return [];
    }
    return output
      .split("\n")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function terminatePortProcesses(port: number) {
  const pids = getListeningPids(port);
  if (pids.length === 0) {
    console.log(`next-clean: no listener on port ${port}`);
    return;
  }

  console.log(`next-clean: stopping listeners on port ${port}: ${pids.join(", ")}`);
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // ignore already-dead processes
    }
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (getListeningPids(port).length === 0) {
      console.log(`next-clean: port ${port} released after SIGTERM`);
      return;
    }
    await wait(250);
  }

  const lingering = getListeningPids(port);
  if (lingering.length === 0) {
    return;
  }

  console.log(`next-clean: forcing shutdown on port ${port}: ${lingering.join(", ")}`);
  for (const pid of lingering) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // ignore already-dead processes
    }
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (getListeningPids(port).length === 0) {
      console.log(`next-clean: port ${port} released after SIGKILL`);
      return;
    }
    await wait(250);
  }

  throw new Error(`Port ${port} is still occupied after cleanup.`);
}

async function removeBuildDirs(projectDir: string) {
  for (const dirName of [".next", ".next-dev", ".turbo"]) {
    const fullPath = path.join(projectDir, dirName);
    await rm(fullPath, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    }).catch(() => undefined);
    console.log(`next-clean: removed ${dirName}`);
  }
}

async function main() {
  const { port } = parseArgs(process.argv.slice(2));
  const projectDir = getProjectDir();

  process.chdir(projectDir);
  await terminatePortProcesses(port);
  await removeBuildDirs(projectDir);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
