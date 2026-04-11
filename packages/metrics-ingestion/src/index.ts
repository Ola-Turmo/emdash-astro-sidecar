export interface SearchConsoleQueryRequest {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
  searchType?: 'web' | 'image' | 'video' | 'news' | 'discover' | 'googleNews';
}

export interface SearchConsoleQueryRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

export interface SearchConsoleQueryResponse {
  rows?: SearchConsoleQueryRow[];
  responseAggregationType?: string;
}

export interface CruxQueryRequest {
  origin?: string;
  url?: string;
  formFactor?: 'PHONE' | 'DESKTOP' | 'TABLET' | 'ALL_FORM_FACTORS';
}

export interface CruxQueryResponse {
  record?: Record<string, unknown>;
  urlNormalizationDetails?: Record<string, unknown>;
}

export interface BingWebmasterQueryRequest {
  siteUrl: string;
  startDate: string;
  endDate: string;
}

export interface TelemetryIngestionResult {
  source: 'gsc' | 'crux' | 'bing' | 'indexnow';
  status: 'ingested' | 'skipped' | 'failed';
  detail: Record<string, unknown>;
}

export class GoogleSearchConsoleClient {
  constructor(
    private readonly accessToken: string,
    private readonly baseUrl = 'https://www.googleapis.com/webmasters/v3',
  ) {}

  async querySearchAnalytics(request: SearchConsoleQueryRequest): Promise<SearchConsoleQueryResponse> {
    const encodedSiteUrl = encodeURIComponent(request.siteUrl);
    return httpJson<SearchConsoleQueryResponse>(
      `${this.baseUrl}/sites/${encodedSiteUrl}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          startDate: request.startDate,
          endDate: request.endDate,
          dimensions: request.dimensions ?? ['page'],
          rowLimit: request.rowLimit ?? 100,
          type: request.searchType ?? 'web',
        }),
      },
    );
  }

  async listSitemaps(siteUrl: string): Promise<Record<string, unknown>> {
    const encodedSiteUrl = encodeURIComponent(siteUrl);
    return httpJson<Record<string, unknown>>(`${this.baseUrl}/sites/${encodedSiteUrl}/sitemaps`, {
      headers: {
        authorization: `Bearer ${this.accessToken}`,
      },
    });
  }
}

export class CruxApiClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord',
  ) {}

  async queryRecord(request: CruxQueryRequest): Promise<CruxQueryResponse> {
    return httpJson<CruxQueryResponse>(`${this.baseUrl}?key=${encodeURIComponent(this.apiKey)}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        origin: request.origin,
        url: request.url,
        formFactor: request.formFactor ?? 'ALL_FORM_FACTORS',
      }),
    });
  }
}

export class BingWebmasterClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://ssl.bing.com/webmaster/api.svc/json',
  ) {}

  async getQueryStats(request: BingWebmasterQueryRequest): Promise<Record<string, unknown>> {
    const url = new URL(`${this.baseUrl}/GetQueryStats`);
    url.searchParams.set('apikey', this.apiKey);
    url.searchParams.set('siteUrl', request.siteUrl);
    url.searchParams.set('startDate', request.startDate);
    url.searchParams.set('endDate', request.endDate);

    return httpJson<Record<string, unknown>>(url.toString());
  }

  async getSiteInfo(siteUrl: string): Promise<Record<string, unknown>> {
    const url = new URL(`${this.baseUrl}/GetSiteInfo`);
    url.searchParams.set('apikey', this.apiKey);
    url.searchParams.set('siteUrl', siteUrl);
    return httpJson<Record<string, unknown>>(url.toString());
  }
}

export class IndexNowClient {
  constructor(
    private readonly host: string,
    private readonly key: string,
    private readonly endpoint = 'https://api.indexnow.org/indexnow',
  ) {}

  async submitUrls(urls: string[], keyLocation?: string): Promise<Record<string, unknown>> {
    return httpJson<Record<string, unknown>>(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        host: this.host,
        key: this.key,
        keyLocation: keyLocation ?? `https://${this.host}/${this.key}.txt`,
        urlList: urls,
      }),
    });
  }
}

async function httpJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Telemetry request failed (${response.status}) for ${url}: ${truncate(text)}`);
  }

  if (!text.trim()) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

function truncate(value: string, maxLength = 280): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}
