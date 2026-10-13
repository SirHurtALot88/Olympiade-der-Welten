/** Next.js-Startpunkt. Der Node-Teil liegt getrennt, damit der Edge-Build kein node:fs sieht. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
