// @ts-check
/**
 * WORKER-THREAD-EINSTIEG fuer `arena-node-runner.ts` (Quick-Sim, 27.10.).
 *
 * Warum ein eigener Thread: die Motor-Einstiege (`spieleFeldspiel()` usw.) rechnen SYNCHRON —
 * ein Basketball-Duell gut eine Sekunde, ein ganzer Spieltag bis in den zweistelligen
 * Sekundenbereich. Im Hauptthread des Servers (`tsx server.ts`, Next.js + Socket.IO in EINEM
 * Prozess) wuerde das die Ereignisschleife fuer alle Spieler einfrieren. Im Worker blockiert nur
 * der Worker; und ein haengender Lauf laesst sich von aussen hart beenden (`worker.terminate()`),
 * was bei synchronem Code im Hauptthread unmoeglich waere.
 *
 * Protokoll: `workerData = { mockupVerzeichnis, auftrag }`, Antwort genau EINE Nachricht
 * `{ ok: true, ergebnisse, dauerMs }` oder `{ ok: false, fehler }`. Danach endet der Worker.
 */
import { parentPort, workerData } from "node:worker_threads";

import { ladeMotorSkripte, simuliereDuelle, simuliereMiniDmPods } from "./arena-node-motor.mjs";

async function main() {
  if (!parentPort) throw new Error("arena-node-worker: nur als Worker-Thread lauffaehig.");
  const start = performance.now();
  try {
    const { mockupVerzeichnis, auftrag } = workerData;
    const skripte = ladeMotorSkripte(mockupVerzeichnis);
    const ergebnisse = auftrag.art === "miniDm" ? await simuliereMiniDmPods(skripte, auftrag) : await simuliereDuelle(skripte, auftrag);
    parentPort.postMessage({ ok: true, ergebnisse, dauerMs: performance.now() - start });
  } catch (error) {
    parentPort.postMessage({
      ok: false,
      fehler: error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error),
    });
  }
}

void main();
