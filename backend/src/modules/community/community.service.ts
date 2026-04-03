import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { SignalChangeService } from "../database/signal-change.service";
import { COMMUNITY_CACHE_TTL_MS } from "./community.constants";
import { CommunityRedditProvider } from "./community-reddit.provider";
import { CommunityRuleService } from "./community-rule.service";
import { CommunityTelegramProvider } from "./community-telegram.provider";
import {
  CommunitySignalEvaluation,
  SUPPORTED_COMMUNITY_SYMBOLS,
  SupportedCommunitySymbol
} from "./community.types";

@Injectable()
export class CommunityService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommunityService.name);
  private cache:
    | { expiresAt: number; data: Map<SupportedCommunitySymbol, CommunitySignalEvaluation> }
    | null = null;
  private inFlight: Promise<Map<SupportedCommunitySymbol, CommunitySignalEvaluation>> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly communityRedditProvider: CommunityRedditProvider,
    private readonly communityTelegramProvider: CommunityTelegramProvider,
    private readonly communityRuleService: CommunityRuleService,
    private readonly signalChangeService: SignalChangeService
  ) {}

  onModuleInit() {
    void this.refreshInBackground();
    this.refreshTimer = setInterval(() => {
      void this.refreshInBackground();
    }, COMMUNITY_CACHE_TTL_MS);
  }

  onModuleDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async getSignalEvaluation(symbol: SupportedCommunitySymbol) {
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

    void this.refreshInBackground();
    return new Map<SupportedCommunitySymbol, CommunitySignalEvaluation>();
  }

  private async refreshInBackground() {
    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = (async () => {
      try {
        const [redditPosts, telegramPosts] = await Promise.all([
          this.communityRedditProvider.fetchPosts(),
          this.communityTelegramProvider.fetchPosts()
        ]);
        const posts = [...redditPosts, ...telegramPosts];

        if (posts.length === 0 && this.cache) {
          this.logger.warn("Community refresh returned no posts; keeping previous cache");
          this.extendCache();
          return this.cache.data;
        }

        const evaluations = new Map<SupportedCommunitySymbol, CommunitySignalEvaluation>();

        for (const symbol of SUPPORTED_COMMUNITY_SYMBOLS) {
          const symbolPosts = posts.filter((post) => post.matchedSymbols.includes(symbol));
          evaluations.set(symbol, this.communityRuleService.evaluate(symbol, symbolPosts));
        }

        this.cache = {
          expiresAt: Date.now() + COMMUNITY_CACHE_TTL_MS,
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

        return new Map<SupportedCommunitySymbol, CommunitySignalEvaluation>();
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
      expiresAt: Date.now() + COMMUNITY_CACHE_TTL_MS
    };
  }
}
