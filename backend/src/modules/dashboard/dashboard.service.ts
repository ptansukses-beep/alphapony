import { Injectable } from "@nestjs/common";
import { CommunityService } from "../community/community.service";
import { AppDataService } from "../database/app-data.service";
import { KolService } from "../kol/kol.service";
import { MarketDataService } from "../market/market-data.service";
import { NewsService } from "../news/news.service";
import { OnchainDataService } from "../onchain/onchain-data.service";
import { getLocalizedRuleDriverItem } from "../shared/signal-localization";

function scoreToBiasLevel(score: number) {
  if (score <= -75) {
    return "super_bearish";
  }

  if (score <= -45) {
    return "strong_bearish";
  }

  if (score <= -15) {
    return "weak_bearish";
  }

  if (score < 15) {
    return "watch";
  }

  if (score < 45) {
    return "weak_bullish";
  }

  if (score < 75) {
    return "strong_bullish";
  }

  return "super_bullish";
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly appDataService: AppDataService,
    private readonly marketDataService: MarketDataService,
    private readonly newsService: NewsService,
    private readonly communityService: CommunityService,
    private readonly kolService: KolService,
    private readonly onchainDataService: OnchainDataService
  ) {}

  async getAssets() {
    const [items, marketSnapshots, marketSignals, newsSignals, communitySignals, kolSignals, onchainEvaluations, trackedAssets] = await Promise.all([
      this.appDataService.listDashboardAssets(),
      this.marketDataService.getSnapshots(),
      this.marketDataService.getSignalEvaluations(),
      this.newsService.getSignalEvaluations(),
      this.communityService.getSignalEvaluations(),
      this.kolService.getSignalEvaluations(),
      this.onchainDataService.getSignalEvaluations(),
      this.appDataService.listTrackedAssets()
    ]);
    const weightsBySymbolEntries = await Promise.all(
      trackedAssets.map(async (asset) => [asset.symbol, await this.appDataService.getSignalWeights(asset.symbol)] as const)
    );
    const weightsBySymbol = new Map(weightsBySymbolEntries);

    const updatedAt = items.reduce<string | null>((latest, item) => {
      const itemUpdatedAt =
        "analysisUpdatedAt" in item && typeof item.analysisUpdatedAt === "string"
          ? item.analysisUpdatedAt
          : null;

      if (!itemUpdatedAt) {
        return latest;
      }

      if (!latest) {
        return itemUpdatedAt;
      }

      return new Date(itemUpdatedAt).getTime() > new Date(latest).getTime()
        ? itemUpdatedAt
        : latest;
    }, null);

    return {
      updatedAt: updatedAt ?? new Date().toISOString(),
      items: items.map((item) => {
        const market = marketSnapshots.get(item.symbol);
        const marketSignal = marketSignals.get(item.symbol);
        const newsSignal = newsSignals.get(item.symbol as Parameters<typeof newsSignals.get>[0]);
        const communitySignal = communitySignals.get(item.symbol as Parameters<typeof communitySignals.get>[0]);
        const kolSignal = kolSignals.get(item.symbol as Parameters<typeof kolSignals.get>[0]);
        const onchainSignal = onchainEvaluations.onchainSignals.get(item.symbol);
        const whaleSignal = onchainEvaluations.whaleSignals.get(item.symbol);

        const signalScores = item.signalScores.map((signal) =>
          signal.type === "market" && marketSignal
            ? {
                ...signal,
                score: marketSignal.score,
                direction: marketSignal.direction,
                biasLevel: marketSignal.biasLevel
              }
            : signal.type === "news" && newsSignal
              ? {
                  ...signal,
                  score: newsSignal.score,
                  direction: newsSignal.direction,
                  biasLevel: newsSignal.biasLevel
                }
              : signal.type === "community" && communitySignal
                ? {
                    ...signal,
                    score: communitySignal.score,
                    direction: communitySignal.direction,
                    biasLevel: communitySignal.biasLevel
                  }
              : signal.type === "kol" && kolSignal
                ? {
                    ...signal,
                    score: kolSignal.score,
                    direction: kolSignal.direction,
                    biasLevel: kolSignal.biasLevel
                  }
                : signal.type === "onchain" && onchainSignal
                  ? {
                      ...signal,
                      score: onchainSignal.score,
                      direction: onchainSignal.direction,
                      biasLevel: onchainSignal.biasLevel
                    }
                  : signal.type === "whale" && whaleSignal
                    ? {
                        ...signal,
                        score: whaleSignal.score,
                        direction: whaleSignal.direction,
                        biasLevel: whaleSignal.biasLevel
                      }
                    : signal
        );
        const weights = weightsBySymbol.get(item.symbol) ?? new Map();
        const weightedSignalScores = signalScores.map((signal) => {
          const weightedScore = Math.round((signal.score * (weights.get(signal.type) ?? 0)) / 100);

          return {
            ...signal,
            weightedScore,
            biasLevel: scoreToBiasLevel(weightedScore)
          };
        });
        const computedRule = this.computeRuleSummary(weightedSignalScores);

        return {
          ...item,
          name: market?.name ?? item.name,
          price: market?.price || item.price,
          priceChange: market?.priceChange || item.priceChange,
          aiScore: item.aiScore,
          ruleScore: computedRule.score,
          ruleDirection: computedRule.direction,
          briefNote: computedRule.briefNote,
          briefNoteItem: getLocalizedRuleDriverItem(computedRule.briefNote),
          signalScores: weightedSignalScores
        };
      })
    };
  }

  private computeRuleSummary(
    weightedSignals: Array<{ type: string; weightedScore: number }>
  ) {
    const score = weightedSignals.reduce((sum, signal) => sum + signal.weightedScore, 0);
    const direction = score > 0 ? "bullish" : score < 0 ? "bearish" : "watch";
    const absoluteScore = Math.abs(score);
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
    const topSignal = [...weightedSignals]
      .sort((left, right) => Math.abs(right.weightedScore) - Math.abs(left.weightedScore))
      .find((signal) => signal.weightedScore !== 0);

    return {
      score,
      direction,
      risk,
      briefNote: topSignal
        ? `${this.signalLabel(topSignal.type)}${topSignal.weightedScore > 0 ? "支撑" : "拖累"}整体判断`
        : "当前暂无额外提醒。"
    };
  }

  private signalLabel(type: string) {
    switch (type) {
      case "news":
        return "新闻信号";
      case "community":
        return "社区信号";
      case "kol":
        return "KOL 信号";
      case "market":
        return "市场信号";
      case "onchain":
        return "链上信号";
      case "whale":
        return "鲸鱼信号";
      default:
        return type;
    }
  }
}
