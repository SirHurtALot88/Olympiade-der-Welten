import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { spawn } from "node:child_process";

const projectRoot = path.resolve(__dirname, "..");
loadEnvConfig(projectRoot);

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Missing Prisma CLI arguments.");
  process.exit(1);
}

const prismaBin = path.join(projectRoot, "node_modules", ".bin", "prisma");
const child = spawn(prismaBin, args, {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

