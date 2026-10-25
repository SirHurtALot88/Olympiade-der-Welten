/**
 * Duenner Client fuer die Billbee-REST-API (https://app.billbee.io/api/v1).
 *
 * Zugang (nur in der Server-Umgebung, nie im Repo):
 *   BILLBEE_API_KEY   Entwickler-Schluessel (Header X-Billbee-Api-Key)
 *   BILLBEE_USER      Billbee-Login (E-Mail), HTTP Basic
 *   BILLBEE_PASSWORD  API-Passwort aus Billbee: Einstellungen > Billbee API
 *
 * Billbee drosselt (HTTP 429, Header Retry-After): der Client wartet und wiederholt,
 * und haelt zwischen zwei Abrufen einen Mindestabstand.
 */

export const BILLBEE_BASE_URL = "https://app.billbee.io/api/v1";

export interface BillbeeConfig {
  apiKey: string;
  user: string;
  password: string;
  baseUrl: string;
}

/** Null, solange nicht alle drei Werte gesetzt sind (dann ist die Anbindung schlicht aus). */
export function billbeeConfigFromEnv(env: Record<string, string | undefined> = process.env): BillbeeConfig | null {
  const apiKey = env.BILLBEE_API_KEY?.trim();
  const user = env.BILLBEE_USER?.trim();
  const password = env.BILLBEE_PASSWORD?.trim();
  if (!apiKey || !user || !password) return null;
  return { apiKey, user, password, baseUrl: env.BILLBEE_BASE_URL?.trim() || BILLBEE_BASE_URL };
}

export interface BillbeePage<T> {
  Paging?: { Page?: number; TotalPages?: number; TotalRows?: number; PageSize?: number };
  Data?: T[];
  ErrorMessage?: string | null;
  ErrorCode?: number | null;
}

export class BillbeeError extends Error {
  constructor(
    message: string,
    readonly status: number | null
  ) {
    super(message);
  }
}

export interface ClientOptions {
  fetchFn?: typeof fetch;
  /** Mindestabstand zwischen zwei Abrufen (Billbee: ca. 2 Abrufe je Sekunde). */
  minGapMs?: number;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class BillbeeClient {
  private last = 0;
  private readonly fetchFn: typeof fetch;
  private readonly minGapMs: number;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly config: BillbeeConfig,
    opts: ClientOptions = {}
  ) {
    this.fetchFn = opts.fetchFn ?? fetch;
    this.minGapMs = opts.minGapMs ?? 600;
    this.maxRetries = opts.maxRetries ?? 4;
    this.sleep = opts.sleep ?? defaultSleep;
  }

  private authHeader(): string {
    return "Basic " + Buffer.from(`${this.config.user}:${this.config.password}`).toString("base64");
  }

  async get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(this.config.baseUrl.replace(/\/$/, "") + path);
    for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));

    for (let attempt = 0; ; attempt++) {
      const wait = this.last + this.minGapMs - Date.now();
      if (wait > 0) await this.sleep(wait);
      this.last = Date.now();

      const res = await this.fetchFn(url, {
        headers: { Authorization: this.authHeader(), "X-Billbee-Api-Key": this.config.apiKey, Accept: "application/json" },
      });
      if (res.ok) return (await res.json()) as T;

      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < this.maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await this.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1500 * 2 ** attempt);
        continue;
      }
      const hint =
        res.status === 400
          ? " (meist ein ungueltiger oder fehlender API-Schluessel)"
          : res.status === 401
          ? " (Benutzer, API-Passwort oder API-Schluessel stimmen nicht)"
          : res.status === 403
            ? " (API-Zugriff fuer dieses Konto nicht freigeschaltet)"
            : "";
      throw new BillbeeError(`Billbee antwortet mit HTTP ${res.status} auf ${path}${hint}`, res.status);
    }
  }

  /** Alle Seiten einer Listen-Abfrage; folgt Paging.TotalPages. */
  async getAll<T>(path: string, params: Record<string, string | number | undefined> = {}, pageSize = 250, maxPages = 400): Promise<T[]> {
    const out: T[] = [];
    let totalPages = 1;
    for (let page = 1; page <= totalPages && page <= maxPages; page++) {
      const body = await this.get<BillbeePage<T>>(path, { ...params, page, pageSize });
      if (body.ErrorMessage) throw new BillbeeError(`Billbee: ${body.ErrorMessage}`, null);
      out.push(...(body.Data ?? []));
      totalPages = body.Paging?.TotalPages ?? 1;
    }
    return out;
  }
}
