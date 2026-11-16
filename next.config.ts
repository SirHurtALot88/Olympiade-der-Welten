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
  // Kompression bleibt bei Next (compress: true = Standard, gzip -6). Ein Versuch mit Caddy
  // (`encode zstd gzip`, Next aus) lieferte live GROESSERE Antworten: battle-mode.engine.js 14,1 MB (gzip) bzw.
  // 13,9 MB (zstd) gegenueber 12,5 MB bei Nexts gzip (gemessen 16.11. gegen den Live-Server). Die echte Loesung
  // fuer die Ladegroesse ist, die base64-Sprites aus der engine.js auszulagern (Task #165, Paket 3).
  compress: true,
  // Cache-Policy fuer public/-Dateien. Next liefert sie sonst mit max-age=0 aus -> bei JEDEM Reload
  // eine bedingte Anfrage je Datei (beim Arena-Start ~244 Sprites). Die Dateien sind NICHT per Hash
  // versioniert: Sprites/Szenen werden bei Reworks unter gleichem Namen ersetzt. Deshalb nur kurz
  // frisch (1 h) + 1 Tag stale-while-revalidate, nie `immutable`/lange max-age (einzige Ausnahme:
  // /mockups/engine-bilder/, inhaltsadressiert, s. unten). ETag-Revalidierung
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
      // AUSGELAGERTE ENGINE-BILDER (Task #165, Performance-Paket 3): die einzige Ausnahme vom "nie
      // immutable" oben. scripts/lagere-engine-bilder-aus.mjs benennt jede Datei nach ihrem Inhalts-
      // Hash (engine-bilder/<sha256[0..12]>.png) -- ein geaendertes Bild bekommt einen NEUEN Namen
      // und damit eine neue URL im (no-cache) Motor, eine alte URL aendert ihren Inhalt nie. Darf
      // deshalb ein Jahr ohne Revalidierung im Cache bleiben. MUSS nach /mockups/:path* stehen: Next
      // wendet alle passenden Regeln an, bei gleichem Header gewinnt die spaetere.
      {
        source: "/mockups/engine-bilder/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
