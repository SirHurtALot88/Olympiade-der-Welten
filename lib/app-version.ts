/**
 * Versions- und Build-Metadaten für das kleine Badge in der Foundation-
 * Sidebar (neben "Oly Manager", siehe app/foundation/shell/FoundationSidebar.tsx).
 *
 * APP_VERSION wird bewusst NICHT aus package.json importiert: Diese Datei
 * wird von einer "use client"-Komponente eingebunden, und ein Import von
 * package.json würde die gesamte Datei (inkl. des Felds `name`) ins
 * Client-Bundle ziehen. Stattdessen ist die Versionsnummer hier hart
 * hinterlegt — tests/app-version.test.ts stellt sicher, dass sie nie
 * unbemerkt von package.json abweicht.
 *
 * Der Build-Stempel (Datum + Commit-SHA) kommt zur Build-Zeit über
 * NEXT_PUBLIC_*-Env-Vars rein, injiziert von Dockerfile /
 * deploy/hetzner/docker-compose.yml / deploy/hetzner/auto-deploy.sh /
 * scripts/deploy-hetzner-with-backup.sh. Next.js inlined NEXT_PUBLIC_*-Vars
 * beim Build; in `npm run dev` oder bei einem Build ohne gesetzte Args sind
 * sie schlicht nicht vorhanden — dann zeigt die Badge nur die Version plus
 * einen unmissverständlichen "dev"-Hinweis, nie eine erfundene Zeitangabe
 * oder einen leeren/"undefined"-Wert.
 */
import { formatGermanDate, formatGermanDateTime } from "@/lib/utils/format-datetime";

export const APP_VERSION = "0.4.79";

/**
 * NEXT_PUBLIC_OLY_BUILD_SHA wird als VOLLER Commit-SHA erwartet (nicht
 * bereits gekürzt). Die Kurzform für die kompakte Badge wird hier im Client
 * abgeleitet, damit sowohl das kompakte Badge (kurz) als auch der
 * Hover-Titel (voll) bedient werden, ohne zwei separate Env-Vars zu
 * brauchen.
 */
const RAW_BUILD_SHA = process.env.NEXT_PUBLIC_OLY_BUILD_SHA?.trim() || null;
const RAW_BUILD_DATE = process.env.NEXT_PUBLIC_OLY_BUILD_DATE?.trim() || null;

export const APP_BUILD_SHA: string | null = RAW_BUILD_SHA;
export const APP_BUILD_DATE: string | null = RAW_BUILD_DATE;
export const APP_BUILD_SHA_SHORT: string | null = RAW_BUILD_SHA ? RAW_BUILD_SHA.slice(0, 7) : null;

export interface AppVersionBadge {
  /** Kompakter Text fürs Badge selbst (Sidebar ist schmal). */
  compact: string;
  /** Ausführlicher Text fürs title-Attribut (voller SHA, voller Zeitstempel). */
  title: string;
  /** true, wenn kein echter Build-Stempel vorhanden war (dev/lokaler Build). */
  isDev: boolean;
}

/**
 * Der Build-Stempel wird als ISO-8601-UTC gespeichert (so setzt ihn das
 * Deploy-Skript), aber ANGEZEIGT wird deutsche Ortszeit (MEZ/MESZ) — beide
 * Spieler sitzen in Deutschland, und eine UTC-Anzeige hat hier schon einmal
 * für Verwirrung gesorgt (2 Stunden Versatz zur Wirklichkeit). Wir nutzen
 * dafür denselben gemeinsamen Formatierer wie die Spielstands-Zeitstempel,
 * damit die Anzeige im ganzen Spiel konsistent bleibt; er setzt die Zeitzone
 * explizit und ist damit auf Server, Browser und in CI identisch (keine
 * Hydration-Abweichung).
 */
function parseBuildDate(iso: string): Date | null {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Liefert Anzeige- und Hover-Text für die Sidebar-Badge. Fällt sauber auf
 * einen "dev"-Zustand zurück, wenn Build-SHA/-Datum fehlen oder unlesbar
 * sind — niemals ein leeres Badge, ein "undefined" oder ein erfundener
 * Platzhalter-Stempel.
 */
export function getAppVersionBadge(): AppVersionBadge {
  const devFallback = (reason: string): AppVersionBadge => ({
    compact: `v${APP_VERSION} · dev`,
    title: `Oly Manager Version ${APP_VERSION} — kein Build-Stempel (${reason})`,
    isDev: true,
  });

  if (!APP_BUILD_SHA || !APP_BUILD_DATE) {
    return devFallback("lokale Entwicklung oder Build ohne Metadaten");
  }

  const parsedDate = parseBuildDate(APP_BUILD_DATE);
  if (!parsedDate) {
    return devFallback(`Build-Datum unlesbar: ${APP_BUILD_DATE}`);
  }

  const compactDate = formatGermanDate(parsedDate, { day: "2-digit", month: "2-digit" });
  const shortSha = APP_BUILD_SHA_SHORT ?? APP_BUILD_SHA;

  return {
    compact: `v${APP_VERSION} · ${compactDate} · ${shortSha}`,
    title:
      `Oly Manager Version ${APP_VERSION} · Build ${formatGermanDateTime(parsedDate)} (deutsche Zeit)` +
      ` · Commit ${APP_BUILD_SHA}`,
    isDev: false,
  };
}
