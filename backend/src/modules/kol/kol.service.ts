import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AppDataService } from "../database/app-data.service";
import { SignalChangeService } from "../database/signal-change.service";
import { KOL_CACHE_TTL_MS } from "./kol.constants";
import { KolNitterProvider } from "./kol-nitter.provider";
import { KolRuleService } from "./kol-rule.service";
import { KolSignalEvaluation, SUPPORTED_KOL_SYMBOLS, SupportedKolSymbol } from "./kol.types";

@Injectable()
export class KolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KolService.name);
  private cache:
    | { expiresAt: number; data: Map<SupportedKolSymbol, KolSignalEvaluation> }
    | null = null;
  private inFlight: Promise<Map<SupportedKolSymbol, KolSignalEvaluation>> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly appDataService: AppDataService,
    private readonly kolNitterProvider: KolNitterProvider,
    private readonly kolRuleService: KolRuleService,
    private readonly signalChangeService: SignalChangeService
  ) {}

  onModuleInit() {
    void this.refreshInBackground();
    this.refreshTimer = setInterval(() => {
      void this.refreshInBackground();
    }, KOL_CACHE_TTL_MS);
  }

  onModuleDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async getSignalEvaluation(symbol: SupportedKolSymbol) {
    const data = await this.getSignalEvaluations();
    return data.get(symbol) ?? null;
  }

  async getSignalEvaluations() {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.data;
    }

    if (this.cache) {
      void this.refreshInBackground();
      return this.cache.data;
    }

    const restored = await this.restoreCacheFromSnapshots();
    if (restored) {
      void this.refreshInBackground();
      return restored;
    }

    void this.refreshInBackground();
    return new Map<SupportedKolSymbol, KolSignalEvaluation>();
  }

  private async refreshInBackground() {
    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = (async () => {
      try {
        const posts = await this.kolNitterProvider.fetchPosts();

        if (posts.length === 0 && this.cache) {
          this.logger.warn("KOL refresh returned no posts; keeping previous cache");
          this.extendCache();
          return this.cache.data;
        }

        if (posts.length === 0) {
          const restored = await this.restoreCacheFromSnapshots();
          if (restored) {
            this.logger.warn("KOL refresh returned no posts; restored latest snapshot cache");
            return restored;
          }
        }

        const evaluations = new Map<SupportedKolSymbol, KolSignalEvaluation>();

        for (const symbol of SUPPORTED_KOL_SYMBOLS) {
          const symbolPosts = posts.filter((post) => post.matchedSymbols.includes(symbol));
          evaluations.set(symbol, this.kolRuleService.evaluate(symbol, symbolPosts));
        }

        this.cache = {
          expiresAt: Date.now() + KOL_CACHE_TTL_MS,
          data: evaluations
        };

        this.signalChangeService.markDirty([...evaluations.keys()]);

        return evaluations;
      } catch (error) {
        this.logger.warn(error instanceof Error ? error.message : String(error));
        if (this.cache) {
          this.extendCache();
          return this.cache.data;
        }

        return new Map<SupportedKolSymbol, KolSignalEvaluation>();
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
      expiresAt: Date.now() + KOL_CACHE_TTL_MS
    };
  }

  private async restoreCacheFromSnapshots() {
    const restored = await this.appDataService.getLatestKolSignalEvaluations();
    if (restored.size === 0) {
      return null;
    }

    this.cache = {
      expiresAt: Date.now() + KOL_CACHE_TTL_MS,
      data: restored
    };

    return restored;
  }
}
