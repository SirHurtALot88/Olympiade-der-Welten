import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com", "127.0.0.1", "localhost"],
  experimental: {
    proxyClientMaxBodySize: "64mb",
    workerThreads: true,
  },
  typescript: {
    tsconfigPath: "tsconfig.next.json",
  },
  // Kompression macht in Produktion Caddy (`encode zstd gzip`, deploy/hetzner/Caddyfile), nicht Next:
  // Next kann nur gzip, Caddy zusaetzlich zstd (~12 % kleiner bei battle-mode.engine.js, 11,0 statt
  // 12,5 MB). Caddy fasst Antworten mit vorhandenem Content-Encoding NICHT an -- Next muss hier also
  // aus sein, sonst kaeme nie zstd beim Browser an. Lokal (`npm run dev`/`start` ohne Caddy) bleiben
  // Antworten unkomprimiert, das ist ueber localhost egal.
  compress: false,
  // Cache-Policy fuer public/-Dateien. Next liefert sie sonst mit max-age=0 aus -> bei JEDEM Reload
  // eine bedingte Anfrage je Datei (beim Arena-Start ~244 Sprites). Die Dateien sind NICHT per Hash
  // versioniert: Sprites/Szenen werden bei Reworks unter gleichem Namen ersetzt. Deshalb nur kurz
  // frisch (1 h) + 1 Tag stale-while-revalidate, nie `immutable`/lange max-age. ETag-Revalidierung
  // bleibt, ein getauschtes Bild ist spaetestens nach ~1 h (plus ein Reload) sichtbar.
  async headers() {
    const kurzFrisch = "public, max-age=3600, stale-while-revalidate=86400";
    return [
      {
        source: "/:dir(portraits|team-logos)/:path*",
        headers: [{ key: "Cache-Control", value: kurzFrisch }],
      },
      {
        source: "/:dir(sprites|szenen|class-icons|discipline-icons|race-icons|app-icons|fonts|sound)/:path*",
        headers: [{ key: "Cache-Control", value: kurzFrisch }],
      },
      // Arena-Motor und Co. (battle-mode.engine/figuren/kulissen/rezepte.js, .css, .html): bei jedem
      // Deploy neu, gleicher Dateiname. `no-cache` = speichern erlaubt, aber vor jeder Nutzung per
      // ETag/If-None-Match revalidieren (304 ohne Body). Bewusst KEIN max-age: ein Motor-Stand, der
      // nicht zu rezepte.js/figuren.js passt, waere ein Laufzeitfehler.
      {
        source: "/mockups/:path*",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
