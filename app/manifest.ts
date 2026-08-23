import type { MetadataRoute } from "next";

/**
 * INSTALLIERBAR — die Olympiade laeuft im eigenen Fenster, ohne Adressleiste.
 *
 * Chris: „von mir aus browser aber installierbar machen ohne leiste oben etc das faende ich geil".
 *
 * Genau das leistet `display: "standalone"`: Browser und Betriebssystem bieten die Seite dann
 * zur Installation an, danach startet sie mit eigenem Icon im Dock bzw. Startmenue und OHNE
 * Adress- und Tableiste. Am Code des Spiels aendert sich dadurch nichts — es ist dieselbe
 * Anwendung, nur anders eingerahmt.
 *
 * Bewusst KEIN Service Worker. Der waere der naechste Schritt (Offline-Betrieb), bringt hier
 * aber wenig: die Olympiade ist ohne Server ohnehin nicht spielbar, weil der Spielstand auf
 * dem Server liegt. Ein Service Worker haette vor allem den bekannten Nachteil, dass er alte
 * Fassungen zaeh im Cache haelt — bei einem Spiel, das laufend deployt wird, ist das ein
 * Risiko ohne Gegenwert.
 *
 * `start_url` zeigt auf `/foundation`, weil das die eigentliche Anwendung ist. Wer die
 * installierte Fassung startet, will nicht auf der Startseite landen, sondern im Spiel.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Olympiade der Welten",
    short_name: "Olympiade",
    description: "Manager-Spiel der Olympiade der Welten — solo oder online zu zweit.",
    start_url: "/foundation",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0B1018",
    theme_color: "#0B1018",
    lang: "de",
    categories: ["games", "sports"],
    icons: [
      { src: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // `maskable` traegt einen eigenen Rand, damit Android das Icon beschneiden kann, ohne
      // dass das Motiv angeschnitten wird.
      { src: "/app-icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
