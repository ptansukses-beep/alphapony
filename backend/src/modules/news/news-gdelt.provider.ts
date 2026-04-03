import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  NEWS_GDELT_PRESETS,
  NEWS_SYMBOL_ALIASES,
  SupportedNewsSymbol
} from "./news.constants";
import { ListNewsOptions, NewsItem } from "./news.types";
import {
  canonicalUrl,
  categoryLabel,
  classifyNewsCategory,
  detectSymbols,
  stripHtml,
  uniqueNewsKey
} from "./news.utils";

type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  sourcecountry?: string;
  language?: string;
  domain?: string;
  socialimage?: string;
};

@Injectable()
export class NewsGdeltProvider {
  private readonly logger = new Logger(NewsGdeltProvider.name);
  private readonly queryCache = new Map<
    string,
    { expiresAt: number; staleUntil: number; data: NewsItem[] }
  >();
  private rateLimitedUntil = 0;
  private readonly queryCacheTtlMs = 30 * 60 * 1000;
  private readonly queryStaleTtlMs = 2 * 60 * 60 * 1000;
  private readonly interQueryDelayMs = 12_000;
  private readonly rateLimitCooldownMs = 90_000;
  private lastQueryAt = 0;
  private requestQueue = Promise.resolve();

  constructor(private readonly configService: ConfigService) {}

  async fetchNews(options: ListNewsOptions) {
    const presetQueries = this.buildQueries(options.symbol, options.category);
    const maxPerQuery = this.maxPerQuery(options, presetQueries.length);
    const allItems: NewsItem[] = [];

    for (const { category, query } of presetQueries) {
      const items = await this.fetchQuery(query, category, maxPerQuery);
      allItems.push(...items);
    }

    return allItems;
  }

  private async fetchQuery(
    query: string,
    category: NonNullable<ListNewsOptions["category"]>,
    maxPerQuery: number
  ) {
    const url = new URL(this.endpoint);
    url.searchParams.set("query", query);
    url.searchParams.set("mode", "artlist");
    url.searchParams.set("format", "json");
    url.searchParams.set("sort", "datedesc");
    url.searchParams.set("maxrecords", String(maxPerQuery));
    const cacheKey = url.toString();
    const cached = this.queryCache.get(cacheKey);

    if (Date.now() < this.rateLimitedUntil) {
      if (cached && cached.staleUntil > Date.now()) {
        return cached.data;
      }

      return [];
    }

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const payload = await this.enqueueRequest(async () => {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(25_000),
            headers: {
              "user-agent": "alphapony-news-ingestor/0.1"
            }
          });

          if (response.status === 429) {
            this.rateLimitedUntil = Date.now() + this.rateLimitCooldownMs;
            throw new Error("GDELT rate limited with 429");
          }

          if (!response.ok) {
            throw new Error(`GDELT request failed: ${response.status}`);
          }

          const responseText = await response.text();
          const contentType = response.headers.get("content-type") ?? "";
          return this.parsePayload(responseText, contentType, query, category, attempt + 1);
        });

        const items = (payload.articles ?? [])
          .map<NewsItem | null>((article) => {
            if (!article.url || !article.title) {
              return null;
            }

            const summary = stripHtml(article.socialimage);
            const text = `${article.title} ${summary}`;
            const itemCategory = classifyNewsCategory(text, category);

            return {
              id: uniqueNewsKey(article.title, article.url),
              title: article.title.trim(),
              url: canonicalUrl(article.url),
              source: article.domain ?? "GDELT",
              sourceType: "gdelt",
              publishedAt: this.toIsoString(article.seendate),
              summary,
              category: itemCategory,
              categoryLabel: categoryLabel(itemCategory),
              symbols: detectSymbols(text),
              language: article.language ?? article.sourcecountry
            };
          })
          .filter((item): item is NewsItem => Boolean(item));

        this.queryCache.set(cacheKey, {
          expiresAt: Date.now() + this.queryCacheTtlMs,
          staleUntil: Date.now() + this.queryStaleTtlMs,
          data: items
        });

        return items;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const errorName = error instanceof Error ? error.name : "UnknownError";
        const errorCause =
          error instanceof Error && "cause" in error
            ? String((error as Error & { cause?: unknown }).cause ?? "")
            : "";

        if (message.includes("429")) {
          this.logger.warn(message);
          if (cached && cached.staleUntil > Date.now()) {
            return cached.data;
          }
          return [];
        }

        if (attempt === 2) {
          this.logger.warn(
            `GDELT fetch failed [category=${category}] [attempt=${attempt + 1}] [query=${query}] [error=${errorName}] [message=${message}]${errorCause ? ` [cause=${errorCause}]` : ""}`
          );
          if (cached && cached.staleUntil > Date.now()) {
            return cached.data;
          }
          return [];
        }

        await this.delay((attempt + 1) * 1000);
      }
    }

    return [];
  }

  private get endpoint() {
    return (
      this.configService.get<string>("GDELT_API_BASE_URL") ??
      "https://api.gdeltproject.org/api/v2/doc/doc"
    );
  }

  private buildQueries(symbol?: SupportedNewsSymbol, category?: ListNewsOptions["category"]) {
    const queries: Array<{ category: NonNullable<ListNewsOptions["category"]>; query: string }> = [];

    const addPreset = (presetCategory: NonNullable<ListNewsOptions["category"]>, queryText: string) => {
      if (!category || category === presetCategory) {
        queries.push({ category: presetCategory, query: queryText });
      }
    };

    addPreset("macro_politics", NEWS_GDELT_PRESETS.macro_politics);
    addPreset("macro_finance", NEWS_GDELT_PRESETS.macro_finance);
    addPreset("crypto_industry", NEWS_GDELT_PRESETS.crypto_industry);

    if (symbol && (!category || category === "asset_specific")) {
      const aliases = NEWS_SYMBOL_ALIASES[symbol].map((alias) => this.formatSearchTerm(alias)).join(" OR ");
      queries.push({
        category: "asset_specific",
        query: `(${aliases}) AND (crypto OR token OR blockchain OR market OR etf OR network OR upgrade OR exchange)`
      });
    }

    if (!symbol && category === "asset_specific") {
      return [];
    }

    return queries;
  }

  private toIsoString(value?: string) {
    if (!value) {
      return new Date().toISOString();
    }

    const compact = value.replace(" ", "T");
    const parsed = new Date(compact);

    if (Number.isNaN(parsed.getTime())) {
      return new Date().toISOString();
    }

    return parsed.toISOString();
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private maxPerQuery(options: ListNewsOptions, queryCount: number) {
    const base = Math.max(2, Math.ceil(options.limit / Math.max(queryCount, 1)));

    if (options.symbol || options.category === "asset_specific") {
      return Math.min(base, 4);
    }

    return Math.min(base, 4);
  }

  private async enqueueRequest<T>(task: () => Promise<T>) {
    const run = async () => {
      const diff = Date.now() - this.lastQueryAt;
      if (diff < this.interQueryDelayMs) {
        await this.delay(this.interQueryDelayMs - diff);
      }

      this.lastQueryAt = Date.now();
      return task();
    };

    const queued = this.requestQueue.then(run, run);
    this.requestQueue = queued.then(
      () => undefined,
      () => undefined
    );

    return queued;
  }

  private parsePayload(
    responseText: string,
    contentType: string,
    query: string,
    category: NonNullable<ListNewsOptions["category"]>,
    attempt: number
  ) {
    const trimmed = responseText.trim();

    if (!trimmed) {
      throw new Error("GDELT returned empty response body");
    }

    const isJson =
      contentType.includes("application/json") || trimmed.startsWith("{") || trimmed.startsWith("[");

    if (!isJson) {
      const preview = trimmed.slice(0, 160).replace(/\s+/g, " ");
      this.logger.warn(
        `GDELT non-JSON response [category=${category}] [attempt=${attempt}] [query=${query}] [contentType=${contentType || "unknown"}] [preview=${preview}]`
      );
      throw new Error("GDELT returned non-JSON response");
    }

    try {
      return JSON.parse(trimmed) as { articles?: GdeltArticle[] };
    } catch (error) {
      const preview = trimmed.slice(0, 160).replace(/\s+/g, " ");
      this.logger.warn(
        `GDELT invalid JSON payload [category=${category}] [attempt=${attempt}] [query=${query}] [preview=${preview}]`
      );
      throw error;
    }
  }

  private formatSearchTerm(term: string) {
    const normalized = term.trim();
    if (!normalized) {
      return normalized;
    }

    return normalized.includes(" ") ? `"${normalized}"` : normalized;
  }
}
