import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { SignalChangeService } from "../database/signal-change.service";
import { MarketAggregatorProvider } from "./market-aggregator.provider";
import { MarketExchangeProvider } from "./market-exchange.provider";
import { MarketRuleService } from "./market-rule.service";
import type { MarketSignalEvaluation, UnifiedMarketSnapshot } from "./market.types";

type CacheEntry = {
  expiresAt: number;
  snapshots: Map<string, UnifiedMarketSnapshot>;
  signalEvaluations: Map<string, MarketSignalEvaluation>;
};

@Injectable()
export class MarketDataService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketDataService.name);
  private cache: CacheEntry | null = null;
  private inFlight: Promise<CacheEntry> | null = null;
  private readonly cacheTtlMs = 15_000;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly marketExchangeProvider: MarketExchangeProvider,
    private readonly marketAggregatorProvider: MarketAggregatorProvider,
    private readonly marketRuleService: MarketRuleService,
    private readonly signalChangeService: SignalChangeService
  ) {}

  onModuleInit() {
    void this.refreshInBackground();
    this.refreshTimer = setInterval(() => {
      void this.refreshInBackground();
    }, this.cacheTtlMs);
  }

  onModuleDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async getSnapshot(symbol: string): Promise<UnifiedMarketSnapshot | null> {
    const snapshots = await this.getSnapshots();
    return snapshots.get(symbol) ?? null;
  }

  async getSignalEvaluation(symbol: string): Promise<MarketSignalEvaluation | null> {
    const cache = await this.getOrBuildCache();
    return cache.signalEvaluations.get(symbol) ?? null;
  }

  async getSignalEvaluations(): Promise<Map<string, MarketSignalEvaluation>> {
    const cache = await this.getOrBuildCache();
    return cache.signalEvaluations;
  }

  async getSnapshots(): Promise<Map<string, UnifiedMarketSnapshot>> {
    const cache = await this.getOrBuildCache();
    return cache.snapshots;
  }

  private async getOrBuildCache(): Promise<CacheEntry> {
    const now = Date.now();

    if (this.cache && this.cache.expiresAt > now) {
      return this.cache;
    }

    if (this.cache) {
      void this.refreshInBackground();
      return this.cache;
    }

    void this.refreshInBackground();
    return {
      snapshots: new Map(),
      signalEvaluations: new Map(),
      expiresAt: 0
    };
  }

  private async refreshInBackground() {
    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = (async () => {
      try {
        const [exchangeSnapshots, aggregatedSnapshots, signalInputs] = await Promise.all([
          this.marketExchangeProvider.getTickers(),
          this.marketAggregatorProvider.getMarkets(),
          this.marketExchangeProvider.getSignalInputs()
        ]);

        const merged = new Map<string, UnifiedMarketSnapshot>();
        const signalEvaluations = new Map<string, MarketSignalEvaluation>();
        const symbols = new Set([...exchangeSnapshots.keys(), ...aggregatedSnapshots.keys()]);

        for (const symbol of symbols) {
          const exchange = exchangeSnapshots.get(symbol);
          const aggregated = aggregatedSnapshots.get(symbol);

          if (exchange) {
            merged.set(symbol, {
              symbol,
              price: exchange.price,
              priceChange: exchange.priceChange,
              timestamp: exchange.timestamp,
              source: "exchange",
              name: aggregated?.name,
              image: aggregated?.image,
              marketCapRank: aggregated?.marketCapRank
            });
            continue;
          }

          if (aggregated?.price && aggregated.priceChange) {
            merged.set(symbol, {
              symbol,
              price: aggregated.price,
              priceChange: aggregated.priceChange,
              timestamp: aggregated.timestamp,
              source: "aggregated",
              name: aggregated.name,
              image: aggregated.image,
              marketCapRank: aggregated.marketCapRank
            });
          }
        }

        for (const [symbol, input] of signalInputs.entries()) {
          signalEvaluations.set(symbol, this.marketRuleService.evaluate(input));
        }

        if (merged.size === 0 && signalEvaluations.size === 0 && this.cache) {
          this.logger.warn("Market refresh returned no data; keeping previous cache");
          this.extendCache();
          return this.cache;
        }

        this.cache = {
          snapshots: merged,
          signalEvaluations,
          expiresAt: Date.now() + this.cacheTtlMs
        };

        this.signalChangeService.markDirty([...signalEvaluations.keys()]);

        return this.cache;
      } catch (error) {
        this.logger.warn(error instanceof Error ? error.message : String(error));
        if (this.cache) {
          this.extendCache();
          return this.cache;
        }

        return {
          snapshots: new Map(),
          signalEvaluations: new Map(),
          expiresAt: Date.now() + this.cacheTtlMs
        };
      }
    })();

    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private extendCache() {
    if (!this.cache) {
      return;
    }

    this.cache = {
      ...this.cache,
      expiresAt: Date.now() + this.cacheTtlMs
    };
  }
}
