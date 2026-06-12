import { createServer } from "node:http";
import next from "next";

import { ensureSocketServer } from "@/lib/socket/server";

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
    const httpServer = createServer((req, res) => handle(req, res));
    ensureSocketServer(httpServer);
    httpServer.listen(port, hostname, () => {
      console.log(`Oly Room laeuft auf http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Serverstart fehlgeschlagen", error);
    process.exit(1);
  });
