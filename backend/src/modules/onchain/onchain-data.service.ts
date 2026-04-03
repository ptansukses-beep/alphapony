import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AppDataService } from "../database/app-data.service";
import { SignalChangeService } from "../database/signal-change.service";
import { MarketDataService } from "../market/market-data.service";
import {
  EVM_ONCHAIN_CONFIG,
  ONCHAIN_CACHE_TTL_MS,
  SOLANA_ONCHAIN_CONFIG,
  SUPPORTED_EVM_ONCHAIN_SYMBOLS,
  SUPPORTED_ONCHAIN_SYMBOLS,
  SupportedEvmOnchainSymbol,
  XRP_ONCHAIN_CONFIG
} from "./onchain.constants";
import { OnchainEvmProvider } from "./onchain-evm.provider";
import { OnchainRuleService } from "./onchain-rule.service";
import { OnchainSolanaProvider } from "./onchain-solana.provider";
import { OnchainXrpProvider } from "./onchain-xrp.provider";
import {
  OnchainSymbolConfig,
  OnchainAggregate,
  OnchainSignalEvaluation,
  RawTrackedTransfer,
  WhaleSignalEvaluation
} from "./onchain.types";

type CacheEntry = {
  expiresAt: number;
  onchainSignals: Map<string, OnchainSignalEvaluation>;
  whaleSignals: Map<string, WhaleSignalEvaluation>;
};

@Injectable()
export class OnchainDataService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OnchainDataService.name);
  private cache: CacheEntry | null = null;
  private inFlight: Promise<CacheEntry> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly appDataService: AppDataService,
    private readonly signalChangeService: SignalChangeService,
    private readonly marketDataService: MarketDataService,
    private readonly onchainEvmProvider: OnchainEvmProvider,
    private readonly onchainSolanaProvider: OnchainSolanaProvider,
    private readonly onchainXrpProvider: OnchainXrpProvider,
    private readonly onchainRuleService: OnchainRuleService
  ) {}

  onModuleInit() {
    void this.refreshInBackground();
    this.refreshTimer = setInterval(() => {
      void this.refreshInBackground();
    }, ONCHAIN_CACHE_TTL_MS);
  }

  onModuleDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async getOnchainEvaluation(symbol: string) {
    const cache = await this.getOrBuildCache();
    return cache.onchainSignals.get(symbol) ?? null;
  }

  async getWhaleEvaluation(symbol: string) {
    const cache = await this.getOrBuildCache();
    return cache.whaleSignals.get(symbol) ?? null;
  }

  async getSignalEvaluations() {
    const cache = await this.getOrBuildCache();
    return {
      onchainSignals: cache.onchainSignals,
      whaleSignals: cache.whaleSignals
    };
  }

  private async getOrBuildCache() {
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
      expiresAt: 0,
      onchainSignals: new Map(),
      whaleSignals: new Map()
    };
  }

  private async refreshInBackground() {
    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = (async () => {
      try {
        const marketSnapshots = await this.marketDataService.getSnapshots();
        const fallbackAssets = await this.appDataService.listDashboardAssets();
        const priceBySymbol = Object.fromEntries(
          [...marketSnapshots.values()].map((snapshot) => [snapshot.symbol, this.parsePrice(snapshot.price)])
        );
        fallbackAssets.forEach((asset) => {
          if (!priceBySymbol[asset.symbol]) {
            priceBySymbol[asset.symbol] = this.parsePrice(asset.price);
          }
        });

        const [evmResult, solResult, xrpResult] = await Promise.allSettled([
          this.withTimeout(this.onchainEvmProvider.getTransfers(priceBySymbol), 35_000),
          this.withTimeout(this.onchainSolanaProvider.getTransfers(priceBySymbol), 15_000),
          this.withTimeout(this.onchainXrpProvider.getTransfers(priceBySymbol), 10_000)
        ]);

        const evmTransfers =
          evmResult.status === "fulfilled" ? evmResult.value : new Map<string, RawTrackedTransfer[]>();
        const solTransfers = solResult.status === "fulfilled" ? solResult.value : [];
        const xrpTransfers = xrpResult.status === "fulfilled" ? xrpResult.value : [];
        const onchainSignals = new Map<string, OnchainSignalEvaluation>();
        const whaleSignals = new Map<string, WhaleSignalEvaluation>();
        const transferMap = new Map<string, RawTrackedTransfer[]>(
          [...evmTransfers.entries(), ["SOL", solTransfers], ["XRP", xrpTransfers]]
        );

        for (const symbol of SUPPORTED_ONCHAIN_SYMBOLS) {
          const aggregate = this.toAggregate(symbol, transferMap.get(symbol) ?? []);
          if (
            aggregate.largeTransferCount === 0 &&
            aggregate.whaleTransferCount === 0 &&
            aggregate.exchangeInflowUsd === 0 &&
            aggregate.exchangeOutflowUsd === 0
          ) {
            continue;
          }

          onchainSignals.set(symbol, this.onchainRuleService.evaluateOnchain(aggregate));
          whaleSignals.set(symbol, this.onchainRuleService.evaluateWhale(aggregate));
        }

        if (
          evmResult.status === "rejected" &&
          solResult.status === "rejected" &&
          xrpResult.status === "rejected" &&
          this.cache
        ) {
          this.logger.warn("All onchain providers failed; keeping previous cache");
          this.extendCache();
          return this.cache;
        }

        this.cache = {
          expiresAt: Date.now() + ONCHAIN_CACHE_TTL_MS,
          onchainSignals,
          whaleSignals
        };

        this.signalChangeService.markDirty([
          ...new Set([...onchainSignals.keys(), ...whaleSignals.keys()])
        ]);

        this.logger.log(
          `refresh statuses evm=${evmResult.status} sol=${solResult.status} xrp=${xrpResult.status} cachedOnchain=${[...onchainSignals.entries()].map(([symbol, value]) => `${symbol}:${value.score}`).join(",") || "none"} cachedWhale=${[...whaleSignals.entries()].map(([symbol, value]) => `${symbol}:${value.score}`).join(",") || "none"}`
        );

        return this.cache;
      } catch (error) {
        this.logger.warn(error instanceof Error ? error.message : String(error));
        if (this.cache) {
          this.extendCache();
          return this.cache;
        }

        return {
          expiresAt: Date.now() + ONCHAIN_CACHE_TTL_MS,
          onchainSignals: new Map(),
          whaleSignals: new Map()
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
      expiresAt: Date.now() + ONCHAIN_CACHE_TTL_MS
    };
  }

  private toAggregate(
    symbol: typeof SUPPORTED_ONCHAIN_SYMBOLS[number],
    transfers: RawTrackedTransfer[]
  ): OnchainAggregate {
    const config = this.getConfig(symbol);
    const hasExchangeCoverage = transfers.some((item) => item.touchesExchange);
    const largeTransfers = transfers.filter(
      (item) => item.amountUsd >= config.transferThresholdUsd
    );
    const inferredWhaleTransfers = largeTransfers.filter((item) => {
      if (item.amountUsd < config.whaleTradeThresholdUsd) {
        return false;
      }

      if (!hasExchangeCoverage) {
        return item.touchesWhale;
      }

      return item.touchesExchange && (
        (!item.fromExchange && !item.fromWhale) ||
        (!item.toExchange && !item.toWhale)
      );
    });
    const weightedLargeTransfers = largeTransfers.map((item) => ({
      item,
      timeWeight: this.onchainTimeWeight(item.timestamp)
    }));
    const exchangeInflowUsd = weightedLargeTransfers
      .filter((entry) => entry.item.isExchangeInflow)
      .reduce((sum, entry) => sum + entry.item.amountUsd * entry.timeWeight, 0);
    const exchangeOutflowUsd = weightedLargeTransfers
      .filter((entry) => entry.item.isExchangeOutflow)
      .reduce((sum, entry) => sum + entry.item.amountUsd * entry.timeWeight, 0);
    const whaleNetUsd = weightedLargeTransfers.reduce((sum, entry) => {
      const { item, timeWeight } = entry;
      if (!hasExchangeCoverage) {
        if (item.toWhale && !item.fromWhale) return sum + item.amountUsd * timeWeight;
        if (item.fromWhale && !item.toWhale) return sum - item.amountUsd * timeWeight;
        return sum;
      }

      const effectiveToWhale =
        item.toWhale || (item.fromExchange && !item.toExchange);
      const effectiveFromWhale =
        item.fromWhale || (item.toExchange && !item.fromExchange);

      if (effectiveToWhale && !effectiveFromWhale) return sum + item.amountUsd * timeWeight;
      if (effectiveFromWhale && !effectiveToWhale) return sum - item.amountUsd * timeWeight;
      return sum;
    }, 0);
    const whaleBuyUsd = weightedLargeTransfers
      .filter(({ item }) => hasExchangeCoverage ? item.fromExchange && (item.toWhale || !item.toExchange) : item.toWhale && !item.fromWhale)
      .reduce((sum, entry) => sum + entry.item.amountUsd * entry.timeWeight, 0);
    const whaleSellUsd = weightedLargeTransfers
      .filter(({ item }) => hasExchangeCoverage ? (item.fromWhale || !item.fromExchange) && item.toExchange : item.fromWhale && !item.toWhale)
      .reduce((sum, entry) => sum + entry.item.amountUsd * entry.timeWeight, 0);
    const whaleAddresses = new Set(
      largeTransfers.flatMap((item) => {
        if (!hasExchangeCoverage) {
          return [
            ...(item.fromWhale ? [item.from] : []),
            ...(item.toWhale ? [item.to] : [])
          ];
        }

        return [
          ...(item.fromWhale || (item.toExchange && !item.fromExchange) ? [item.from] : []),
          ...(item.toWhale || (item.fromExchange && !item.toExchange) ? [item.to] : [])
        ];
      })
    );
    const weightedWhaleAddresses = new Map<string, number>();
    weightedLargeTransfers.forEach(({ item, timeWeight }) => {
      const addresses = !hasExchangeCoverage
        ? [
            ...(item.fromWhale ? [item.from] : []),
            ...(item.toWhale ? [item.to] : [])
          ]
        : [
            ...(item.fromWhale || (item.toExchange && !item.fromExchange) ? [item.from] : []),
            ...(item.toWhale || (item.fromExchange && !item.toExchange) ? [item.to] : [])
          ];

      for (const address of addresses) {
        weightedWhaleAddresses.set(address, Math.max(weightedWhaleAddresses.get(address) ?? 0, timeWeight));
      }
    });

    return {
      symbol,
      transferThresholdUsd: config.transferThresholdUsd,
      exchangeFlowThresholdUsd: config.exchangeFlowThresholdUsd,
      whaleTradeThresholdUsd: config.whaleTradeThresholdUsd,
      exchangeInflowUsd,
      exchangeOutflowUsd,
      exchangeNetflowUsd: exchangeOutflowUsd - exchangeInflowUsd,
      largeTransferCount: weightedLargeTransfers.reduce((sum, entry) => sum + entry.timeWeight, 0),
      largeTransferUsd: weightedLargeTransfers.reduce((sum, entry) => sum + entry.item.amountUsd * entry.timeWeight, 0),
      whaleNetUsd,
      whaleBuyUsd,
      whaleSellUsd,
      whaleTransferCount: inferredWhaleTransfers.reduce(
        (sum, item) => sum + this.onchainTimeWeight(item.timestamp),
        0
      ),
      whaleAddressCount: weightedWhaleAddresses.size > 0
        ? [...weightedWhaleAddresses.values()].reduce((sum, weight) => sum + weight, 0)
        : whaleAddresses.size,
      sampledTransfers: (inferredWhaleTransfers.length > 0 ? inferredWhaleTransfers : largeTransfers).slice(0, 10)
    };
  }

  private parsePrice(value: string) {
    return Number(value.replace(/[$,%]/g, "").replace(/,/g, ""));
  }

  private getConfig(symbol: typeof SUPPORTED_ONCHAIN_SYMBOLS[number]): OnchainSymbolConfig {
    if ((SUPPORTED_EVM_ONCHAIN_SYMBOLS as readonly string[]).includes(symbol)) {
      return EVM_ONCHAIN_CONFIG[symbol as SupportedEvmOnchainSymbol];
    }
    if (symbol === "SOL") {
      return SOLANA_ONCHAIN_CONFIG;
    }
    return XRP_ONCHAIN_CONFIG;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number) {
    return Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), ms);
      })
    ]);
  }

  private onchainTimeWeight(timestamp: string) {
    const ageHours = Math.max(0, (Date.now() - new Date(timestamp).getTime()) / 3_600_000);

    if (ageHours <= 6) {
      return 1;
    }

    if (ageHours <= 24) {
      return 0.78;
    }

    if (ageHours <= 72) {
      return 0.5;
    }

    return 0.25;
  }
}
