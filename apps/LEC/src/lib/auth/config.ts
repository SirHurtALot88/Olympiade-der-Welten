/**
 * Zugangsschutz-Konfiguration (Single-User "Chris"), analog zum OLY_AUTH-
 * Muster der Oly. Kein OAuth, keine Nutzerverwaltung -- ein Passwort reicht,
 * da die App reine Geschaeftsdaten eines Einzelunternehmers zeigt.
 *
 * Regeln:
 * - In Produktion (NODE_ENV=production) ist der Gate IMMER an.
 * - In Dev/Test ist er per Default AUS, kann aber ueber LEC_AUTH_ENABLED=1
 *   testweise angeschaltet werden.
 * - Ist der Gate an, aber LEC_PASSWORD/LEC_AUTH_SECRET fehlen, gilt die App
 *   als "misconfigured" und sperrt sich komplett (fail closed) -- kein
 *   unsicherer Default, der versehentlich offen bliebe.
 */
export interface AuthConfig {
  enabled: boolean;
  misconfigured: boolean;
  password: string | null;
  secret: string | null;
}

export function getAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const isProduction = env.NODE_ENV === "production";
  const enabled = isProduction || env.LEC_AUTH_ENABLED === "1";

  const password = env.LEC_PASSWORD && env.LEC_PASSWORD.length > 0 ? env.LEC_PASSWORD : null;
  const secret = env.LEC_AUTH_SECRET && env.LEC_AUTH_SECRET.length > 0 ? env.LEC_AUTH_SECRET : null;

  return {
    enabled,
    misconfigured: enabled && (!password || !secret),
    password,
    secret,
  };
}
