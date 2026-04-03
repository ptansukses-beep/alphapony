import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { SignalChangeService } from "../database/signal-change.service";
import {
  NEWS_CACHE_TTL_MS,
  NEWS_DEFAULT_LIMIT,
  SUPPORTED_NEWS_SYMBOLS,
  SupportedNewsSymbol
} from "./news.constants";
import { NewsGuardianProvider } from "./news-guardian.provider";
import { NewsRuleService } from "./news-rule.service";
import { NewsGdeltProvider } from "./news-gdelt.provider";
import { NewsRssProvider } from "./news-rss.provider";
import { ListNewsOptions, NewsItem, NewsResponse, NewsSignalEvaluation } from "./news.types";

@Injectable()
export class NewsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NewsService.name);
  private readonly signalRefreshBatchSize = 2;
  private readonly cache = new Map<string, { expiresAt: number; data: NewsResponse }>();
  private readonly inFlight = new Map<string, Promise<NewsResponse>>();
  private signalCache:
    | {
        expiresAt: number;
        data: Map<SupportedNewsSymbol, NewsSignalEvaluation>;
      }
    | null = null;
  private signalInFlight: Promise<Map<SupportedNewsSymbol, NewsSignalEvaluation>> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private nextSignalBatchIndex = 0;

  constructor(
    private readonly newsGdeltProvider: NewsGdeltProvider,
    private readonly newsRssProvider: NewsRssProvider,
    private readonly newsGuardianProvider: NewsGuardianProvider,
    private readonly newsRuleService: NewsRuleService,
    private readonly signalChangeService: SignalChangeService
  ) {}

  onModuleInit() {
    void this.refreshSignalsInBackground();
    this.refreshTimer = setInterval(() => {
      void this.refreshSignalsInBackground();
    }, NEWS_CACHE_TTL_MS);
  }

  onModuleDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async listNews(options: {
    symbol?: SupportedNewsSymbol;
    category?: ListNewsOptions["category"];
    limit?: number;
  }) {
    const normalized: ListNewsOptions = {
      symbol: options.symbol,
      category: options.category,
      limit: options.limit ?? NEWS_DEFAULT_LIMIT
    };

    const cacheKey = JSON.stringify(normalized);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    if (cached) {
      void this.refreshListInBackground(cacheKey, normalized);
      return cached.data;
    }

    if (!this.inFlight.has(cacheKey)) {
      void this.refreshListInBackground(cacheKey, normalized);
    }

    return {
      updatedAt: new Date().toISOString(),
      query: normalized,
      items: [],
      sources: {
        gdelt: 0,
        rss: 0,
        guardian: 0
      }
    };
  }

  async getSignalEvaluation(symbol: SupportedNewsSymbol) {
    const now = Date.now();

    if (this.signalCache && this.signalCache.expiresAt > now) {
      return this.signalCache.data.get(symbol) ?? null;
    }

    if (this.signalCache?.data.has(symbol)) {
      void this.refreshSignalsInBackground();
      return this.signalCache.data.get(symbol) ?? null;
    }

    return this.buildSignalEvaluationForSymbol(symbol);
  }

  async getSignalEvaluations() {
    const now = Date.now();

    if (this.signalCache && this.signalCache.expiresAt > now) {
      return this.signalCache.data;
    }

    if (this.signalCache) {
      void this.refreshSignalsInBackground();
      return this.signalCache.data;
    }

    void this.refreshSignalsInBackground();
    return new Map<SupportedNewsSymbol, NewsSignalEvaluation>();
  }

  private async getFreshListForSignal(options: {
    symbol?: SupportedNewsSymbol;
    category?: ListNewsOptions["category"];
    limit?: number;
  }) {
    const normalized: ListNewsOptions = {
      symbol: options.symbol,
      category: options.category,
      limit: options.limit ?? NEWS_DEFAULT_LIMIT
    };
    const cacheKey = JSON.stringify(normalized);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    return this.refreshListInBackground(cacheKey, normalized);
  }

  private async getFastListForSignal(options: {
    symbol?: SupportedNewsSymbol;
    category?: ListNewsOptions["category"];
    limit?: number;
  }) {
    const normalized: ListNewsOptions = {
      symbol: options.symbol,
      category: options.category,
      limit: options.limit ?? NEWS_DEFAULT_LIMIT
    };
    const cacheKey = JSON.stringify(normalized);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    void this.refreshListInBackground(cacheKey, normalized);

    const [rssItems, guardianItems] = await Promise.all([
      this.newsRssProvider.fetchNews(normalized),
      this.newsGuardianProvider.fetchNews(normalized)
    ]);

    const mergedItems = this.mergeItems([...rssItems, ...guardianItems], normalized.symbol, normalized.category).slice(
      0,
      normalized.limit
    );

    return {
      updatedAt: new Date().toISOString(),
      query: normalized,
      items: mergedItems,
      sources: {
        gdelt: 0,
        rss: rssItems.length,
        guardian: guardianItems.length
      }
    };
  }

  private async refreshListInBackground(cacheKey: string, normalized: ListNewsOptions) {
    const current = this.inFlight.get(cacheKey);
    if (current) {
      return current;
    }

    const task = (async () => {
      try {
        const [gdeltItems, rssItems, guardianItems] = await Promise.all([
          this.newsGdeltProvider.fetchNews(normalized),
          this.newsRssProvider.fetchNews(normalized),
          this.newsGuardianProvider.fetchNews(normalized)
        ]);

        const mergedItems = this.mergeItems(
          [...gdeltItems, ...rssItems, ...guardianItems],
          normalized.symbol,
          normalized.category
        ).slice(0, normalized.limit);

        const response: NewsResponse = {
          updatedAt: new Date().toISOString(),
          query: normalized,
          items: mergedItems,
          sources: {
            gdelt: gdeltItems.length,
            rss: rssItems.length,
            guardian: guardianItems.length
          }
        };

        const previous = this.cache.get(cacheKey);
        if (mergedItems.length === 0 && previous) {
          this.cache.set(cacheKey, {
            ...previous,
            expiresAt: Date.now() + NEWS_CACHE_TTL_MS
          });
          return previous.data;
        }

        this.cache.set(cacheKey, {
          expiresAt: Date.now() + NEWS_CACHE_TTL_MS,
          data: response
        });

        return response;
      } catch (error) {
        this.logger.warn(error instanceof Error ? error.message : String(error));
        const previous = this.cache.get(cacheKey);
        if (previous) {
          this.cache.set(cacheKey, {
            ...previous,
            expiresAt: Date.now() + NEWS_CACHE_TTL_MS
          });
          return previous.data;
        }

        return {
          updatedAt: new Date().toISOString(),
          query: normalized,
          items: [],
          sources: {
            gdelt: 0,
            rss: 0,
            guardian: 0
          }
        };
      }
    })();

    this.inFlight.set(cacheKey, task);

    try {
      return await task;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  private async refreshSignalsInBackground() {
    if (this.signalInFlight) {
      return this.signalInFlight;
    }

    this.signalInFlight = (async () => {
      try {
        const globalResponse = await this.getFreshListForSignal({ limit: 18 });
        const existingEntries = this.signalCache ? [...this.signalCache.data.entries()] : [];
        const entryMap = new Map<SupportedNewsSymbol, NewsSignalEvaluation>(existingEntries);
        const batchSymbols = this.nextSignalBatchSymbols();

        for (const symbol of batchSymbols) {
          const assetSpecificResponse = await this.getFreshListForSignal({
            symbol,
            category: "asset_specific",
            limit: 8
          });
          const mergedItems = this.filterSignalItemsForSymbol(
            symbol,
            this.mergeSignalItems(globalResponse.items, assetSpecificResponse.items)
          ).slice(0, 12);
          entryMap.set(symbol, this.newsRuleService.evaluate(symbol, mergedItems));
        }

        const data = new Map<SupportedNewsSymbol, NewsSignalEvaluation>();

        for (const symbol of SUPPORTED_NEWS_SYMBOLS) {
          const existing = entryMap.get(symbol);
          if (existing) {
            data.set(symbol, existing);
          }
        }

        if (data.size === 0 && this.signalCache) {
          this.extendSignalCache();
          return this.signalCache.data;
        }

        this.signalCache = {
          expiresAt: Date.now() + NEWS_CACHE_TTL_MS,
          data
        };

        this.signalChangeService.markDirty([...data.keys()]);

        return data;
      } catch (error) {
        this.logger.warn(error instanceof Error ? error.message : String(error));
        if (this.signalCache) {
          this.extendSignalCache();
          return this.signalCache.data;
        }

        return new Map<SupportedNewsSymbol, NewsSignalEvaluation>();
      }
    })();

    try {
      return await this.signalInFlight;
    } finally {
      this.signalInFlight = null;
    }
  }

  private async buildSignalEvaluationForSymbol(symbol: SupportedNewsSymbol) {
    const globalResponse = await this.getFastListForSignal({ limit: 18 });
    const assetSpecificResponse = await this.getFastListForSignal({
      symbol,
      category: "asset_specific",
      limit: 8
    });
    const mergedItems = this.filterSignalItemsForSymbol(
      symbol,
      this.mergeSignalItems(globalResponse.items, assetSpecificResponse.items)
    ).slice(0, 12);

    return this.newsRuleService.evaluate(symbol, mergedItems);
  }

  private extendSignalCache() {
    if (!this.signalCache) {
      return;
    }

    this.signalCache = {
      ...this.signalCache,
      expiresAt: Date.now() + NEWS_CACHE_TTL_MS
    };
  }

  private nextSignalBatchSymbols() {
    if (!this.signalCache) {
      return [...SUPPORTED_NEWS_SYMBOLS];
    }

    const symbols: SupportedNewsSymbol[] = [];

    for (let offset = 0; offset < this.signalRefreshBatchSize; offset += 1) {
      const index = (this.nextSignalBatchIndex + offset) % SUPPORTED_NEWS_SYMBOLS.length;
      symbols.push(SUPPORTED_NEWS_SYMBOLS[index]);
    }

    this.nextSignalBatchIndex =
      (this.nextSignalBatchIndex + this.signalRefreshBatchSize) % SUPPORTED_NEWS_SYMBOLS.length;

    return symbols;
  }

  private mergeSignalItems(...groups: NewsItem[][]) {
    const deduped = new Map<string, NewsItem>();

    groups.flat().forEach((item) => {
      if (!deduped.has(item.id)) {
        deduped.set(item.id, item);
      }
    });

    return [...deduped.values()].sort(
      (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
    );
  }

  private filterSignalItemsForSymbol(symbol: SupportedNewsSymbol, items: NewsItem[]) {
    return items.filter((item) => {
      if (item.category !== "asset_specific") {
        return true;
      }

      if (item.symbols.length === 0) {
        return true;
      }

      return item.symbols.includes(symbol);
    });
  }

  private mergeItems(
    items: NewsItem[],
    symbol?: SupportedNewsSymbol,
    category?: ListNewsOptions["category"]
  ) {
    const deduped = new Map<string, NewsItem>();

    items.forEach((item) => {
      if (category && item.category !== category) {
        return;
      }

      if (symbol && item.symbols.length > 0 && !item.symbols.includes(symbol)) {
        return;
      }

      if (!deduped.has(item.id)) {
        deduped.set(item.id, item);
      }
    });

    return [...deduped.values()].sort(
      (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
    );
  }
}
