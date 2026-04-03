import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AiAnalysisService } from "../ai/ai-analysis.service";
import { AlertingService } from "../alerts/alerting.service";
import { AppDataService, PersistedAssetDetail, PersistedDetailSignal } from "../database/app-data.service";
import { PrismaService } from "../database/prisma.service";
import { SignalChangeService } from "../database/signal-change.service";
import { CommunityService } from "../community/community.service";
import { KolService } from "../kol/kol.service";
import { MarketDataService } from "../market/market-data.service";
import { NewsService } from "../news/news.service";
import { OnchainDataService } from "../onchain/onchain-data.service";

type RuleSummary = {
  score: number;
  direction: "bullish" | "bearish" | "watch";
  confidence: string;
  risk: string;
  drivers: string[];
  consistency: string;
  briefNote: string;
};

@Injectable()
export class LiveAnalysisPersistenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LiveAnalysisPersistenceService.name);
  private readonly pendingSymbols = new Set<string>();
  private unsubscribe: (() => void) | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private inFlight: Promise<void> | null = null;

  constructor(
    private readonly aiAnalysisService: AiAnalysisService,
    private readonly signalChangeService: SignalChangeService,
    private readonly alertingService: AlertingService,
    private readonly appDataService: AppDataService,
    private readonly prisma: PrismaService,
    private readonly marketDataService: MarketDataService,
    private readonly newsService: NewsService,
    private readonly communityService: CommunityService,
    private readonly kolService: KolService,
    private readonly onchainDataService: OnchainDataService
  ) {}

  onModuleInit() {
    this.unsubscribe = this.signalChangeService.subscribe((symbols) => {
      symbols.forEach((symbol) => this.pendingSymbols.add(symbol));
      this.scheduleFlush();
    });
  }

  onModuleDestroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushPending();
    }, 1_500);
  }

  private async flushPending() {
    if (this.inFlight || this.pendingSymbols.size === 0) {
      return;
    }

    const symbols = [...this.pendingSymbols];
    this.pendingSymbols.clear();

    this.inFlight = (async () => {
      try {
        const details = await Promise.all(symbols.map((symbol) => this.buildPersistedDetail(symbol)));
        const baselines = await this.prisma.asset.findMany({
          where: {
            symbol: {
              in: symbols
            }
          },
          include: {
            analysisSnapshots: {
              orderBy: {
                createdAt: "desc"
              },
              take: 1,
              include: {
                signalSnapshots: {
                  include: {
                    metrics: {
                      orderBy: {
                        displayOrder: "asc"
                      }
                    }
                  }
                }
              }
            }
          }
        });
        const baselineBySymbol = new Map(
          baselines.map((asset) => {
            const latestAnalysisSnapshot = asset.analysisSnapshots[0] ?? null;

            return [
              asset.symbol,
              {
                assetId: asset.id,
                latestSnapshot: latestAnalysisSnapshot
                  ? {
                      id: latestAnalysisSnapshot.id,
                      createdAt: latestAnalysisSnapshot.createdAt,
                      ruleScore: latestAnalysisSnapshot.ruleScore,
                      ruleDirection: latestAnalysisSnapshot.ruleDirection,
                      aiDirection: latestAnalysisSnapshot.aiDirection,
                      signalSnapshots: latestAnalysisSnapshot.signalSnapshots.map((signal) => ({
                        signalType: signal.signalType,
                        direction: signal.direction,
                        score: signal.score,
                        driversJson: signal.driversJson,
                        highlightsJson: signal.highlightsJson,
                        metricNames: signal.metrics.map((metric) => metric.metricName)
                      }))
                    }
                  : null
              }
            ] as const;
          })
        );
        const { persistedCount, persistedSymbols } = await this.appDataService.persistChangedAssetDetails(details);
        const persistedSymbolSet = new Set(persistedSymbols);
        let alertCount = 0;
        for (const detail of details) {
          const baseline = baselineBySymbol.get(detail.symbol);
          if (!baseline) {
            continue;
          }

          alertCount += await this.alertingService.evaluateAndDispatch({
            assetId: baseline.assetId,
            symbol: detail.symbol,
            detail,
            latestSnapshot: baseline.latestSnapshot,
            now: new Date()
          });
        }
        if (persistedSymbols.length > 0) {
          await this.aiAnalysisService.recomputeForSymbols(persistedSymbols, "snapshot_change");
        }
        await this.aiAnalysisService.recomputeForDirectionSwitches(
          details
            .filter((detail) => !persistedSymbolSet.has(detail.symbol))
            .map((detail) => ({
              symbol: detail.symbol,
              previousDirection: baselineBySymbol.get(detail.symbol)?.latestSnapshot?.ruleDirection ?? null,
              currentDirection: detail.rule.direction
            }))
        );
        this.logger.log(`persisted ${persistedCount} changed live analysis snapshots`);
        if (alertCount > 0) {
          this.logger.log(`created ${alertCount} alerts`);
        }
      } catch (error) {
        if (error instanceof Error) {
          this.logger.warn(error.stack ?? error.message);
        } else {
          this.logger.warn(String(error));
        }
      }
    })();

    try {
      await this.inFlight;
    } finally {
      this.inFlight = null;
      if (this.pendingSymbols.size > 0) {
        this.scheduleFlush();
      }
    }
  }

  private async buildPersistedDetail(symbol: string): Promise<PersistedAssetDetail> {
    const normalizedSymbol = symbol.toUpperCase();
    const [base, market, marketSignal, newsSignal, communitySignal, kolSignal, onchainSignal, whaleSignal, signalWeights] = await Promise.all([
      this.appDataService.getAssetDetail(normalizedSymbol),
      this.marketDataService.getSnapshot(normalizedSymbol),
      this.marketDataService.getSignalEvaluation(normalizedSymbol),
      this.newsService.getSignalEvaluation(normalizedSymbol as Parameters<NewsService["getSignalEvaluation"]>[0]),
      this.communityService.getSignalEvaluation(normalizedSymbol as Parameters<CommunityService["getSignalEvaluation"]>[0]),
      this.kolService.getSignalEvaluation(normalizedSymbol as Parameters<KolService["getSignalEvaluation"]>[0]),
      this.onchainDataService.getOnchainEvaluation(normalizedSymbol),
      this.onchainDataService.getWhaleEvaluation(normalizedSymbol),
      this.appDataService.getSignalWeights(normalizedSymbol)
    ]);

    const signalMap = new Map<string, PersistedDetailSignal>(
      base.signals.map((signal) => [
        signal.type,
        {
          type: signal.type,
          label: signal.label,
          direction: signal.direction,
          score: signal.score,
          confidence: signal.confidence,
          drivers: signal.drivers,
          metrics: signal.metrics,
          highlights: signal.highlights
        }
      ])
    );

    const applySignal = (
      type: string,
      label: string,
      evaluation:
        | {
            direction: "bullish" | "bearish" | "watch";
            score: number;
            confidence: string;
            drivers: string[];
            metrics: Array<{ name: string; value: string }>;
            highlights: Array<{ title: string; href: string; publishedAt?: string; score?: number }>;
          }
        | null
        | undefined
    ) => {
      if (!evaluation) {
        return;
      }

      signalMap.set(type, {
        type,
        label,
        direction: evaluation.direction,
        score: evaluation.score,
        confidence: evaluation.confidence,
        drivers: evaluation.drivers,
        metrics: evaluation.metrics,
        highlights: evaluation.highlights.map((item) => ({
          title: item.title,
          href: item.href,
          publishedAt: item.publishedAt,
          score: item.score ?? evaluation.score
        }))
      });
    };

    applySignal("market", "市场信号", marketSignal);
    applySignal("news", "新闻信号", newsSignal);
    applySignal("community", "社区信号", communitySignal);
    applySignal("kol", "KOL 信号", kolSignal);
    applySignal("onchain", "链上信号", onchainSignal);
    applySignal("whale", "鲸鱼信号", whaleSignal);
    const computedRule = this.buildRuleSummary([...signalMap.values()], signalWeights, base.ai.direction);

    return {
      symbol: normalizedSymbol,
      price: market?.price || base.price,
      priceChange: market?.priceChange || base.priceChange,
      briefNote: computedRule.briefNote,
      window: base.window,
      rule: {
        direction: computedRule.direction,
        score: computedRule.score,
        confidence: computedRule.confidence,
        risk: computedRule.risk,
        drivers: computedRule.drivers
      },
      ai: base.ai,
      consistency: computedRule.consistency,
      signals: [...signalMap.values()]
    };
  }

  private buildRuleSummary(
    signals: PersistedDetailSignal[],
    signalWeights: Map<string, number>,
    aiDirection: PersistedAssetDetail["ai"]["direction"]
  ): RuleSummary {
    const weightedSignals = signals.map((signal) => {
      const weight = signalWeights.get(signal.type) ?? 0;
      const weightedScore = Math.round((signal.score * weight) / 100);

      return {
        ...signal,
        weight,
        weightedScore
      };
    });

    const score = weightedSignals.reduce((sum, signal) => sum + signal.weightedScore, 0);
    const direction: RuleSummary["direction"] = score > 0 ? "bullish" : score < 0 ? "bearish" : "watch";
    const absoluteScore = Math.abs(score);
    const confidence = absoluteScore >= 35 ? "high" : absoluteScore >= 15 ? "medium" : "low";
    const bullishContribution = weightedSignals
      .filter((signal) => signal.weightedScore > 0)
      .reduce((sum, signal) => sum + signal.weightedScore, 0);
    const bearishContribution = weightedSignals
      .filter((signal) => signal.weightedScore < 0)
      .reduce((sum, signal) => sum + Math.abs(signal.weightedScore), 0);
    const risk = bullishContribution > 0 && bearishContribution > 0
      ? Math.abs(bullishContribution - bearishContribution) <= 6
        ? "高"
        : "中高"
      : absoluteScore >= 35
        ? "中"
        : "中高";
    const topSignals = [...weightedSignals]
      .sort((left, right) => Math.abs(right.weightedScore) - Math.abs(left.weightedScore))
      .filter((signal) => signal.weightedScore !== 0)
      .slice(0, 3);
    const drivers = topSignals.length > 0
      ? topSignals.map((signal) =>
          `${signal.label}${signal.weightedScore > 0 ? "支撑" : "拖累"}整体判断（加权 ${signal.weightedScore > 0 ? `+${signal.weightedScore}` : signal.weightedScore}）`
        )
      : ["当前子信号加权分接近中性，整体暂处观望。"];
    const consistency =
      aiDirection === direction
        ? "规则与 AI 基本一致"
        : aiDirection === "watch"
          ? "规则方向更明确，AI 暂时观望"
          : direction === "watch"
            ? "规则暂时观望，AI 方向更明确"
            : "规则与 AI 存在分歧";
    const briefNote = topSignals[0]
      ? `${topSignals[0].label}${topSignals[0].weightedScore > 0 ? "支撑" : "拖累"}整体判断`
      : "当前暂无额外提醒。";

    return {
      score,
      direction,
      confidence,
      risk,
      drivers,
      consistency,
      briefNote
    };
  }
}
