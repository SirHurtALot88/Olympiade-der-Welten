import { createServer } from "node:http";
import next from "next";

import { ensureSocketServer } from "@/lib/socket/server";
import { startOnlineSaveAutoExport } from "@/lib/persistence/online-save-auto-export";
import { rehydrateRuntimeRoomsFromPersistence } from "@/lib/room/room-store";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

const app = next({
  dev,
  hostname,
  port,
  turbo: false,
  turbopack: false,
});
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    // Stufe 0.1 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Befund B1): VOR ensureSocketServer, damit
    // Raeume aus der Ablage schon im Speicher stehen, bevor der erste Client verbindet — sonst
    // faende ein rejoinRoom() in der ersten Sekunde nach dem Neustart nichts.
    const { restored, alreadyPresent } = rehydrateRuntimeRoomsFromPersistence();
    console.log(`Room-Rehydrierung: ${restored} Raum/Raeume aus der Ablage geladen, ${alreadyPresent} bereits im Speicher.`);

    const httpServer = createServer((req, res) => handle(req, res));
    ensureSocketServer(httpServer);
    httpServer.listen(port, hostname, () => {
      console.log(`Oly Room laeuft auf http://localhost:${port}`);
      // Hält data/online-saves/ im Hintergrund aktuell (und pusht optional nach GitHub),
      // damit die Saves "online" und überall zugänglich bleiben. Env-gesteuert, siehe Modul.
      startOnlineSaveAutoExport();
    });
  })
  .catch((error) => {
    console.error("Serverstart fehlgeschlagen", error);
    process.exit(1);
  });
