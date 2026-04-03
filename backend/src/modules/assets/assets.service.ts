import { Injectable } from "@nestjs/common";
import { CommunityService } from "../community/community.service";
import { AppDataService } from "../database/app-data.service";
import { KolService } from "../kol/kol.service";
import { MarketDataService } from "../market/market-data.service";
import { NewsService } from "../news/news.service";
import { OnchainDataService } from "../onchain/onchain-data.service";
import {
  getLocalizedConsistencyItems,
  getLocalizedDriverItem,
  getLocalizedRuleDriverItem,
  getLocalizedHighlight,
  getLocalizedMetric
} from "../shared/signal-localization";

const SIGNAL_ORDER = ["market", "news", "community", "kol", "onchain", "whale"] as const;
const DETAIL_HIGHLIGHT_LIMIT = 10;

function signalLabelKeyFromType(
  type: string
): "news" | "community" | "kol" | "market" | "onchain" | "whale" | undefined {
  switch (type) {
    case "news":
    case "community":
    case "kol":
    case "market":
    case "onchain":
    case "whale":
      return type;
    default:
      return undefined;
  }
}

function confidenceKeyFromText(confidence: string) {
  switch (confidence.trim().toLowerCase()) {
    case "high":
    case "高":
      return "high" as const;
    case "medium":
    case "中":
      return "medium" as const;
    case "low":
    case "低":
      return "low" as const;
    default:
      return undefined;
  }
}

function riskKeyFromText(risk: string) {
  switch (risk.trim()) {
    case "高":
      return "high" as const;
    case "中高":
      return "medium_high" as const;
    case "中":
      return "medium" as const;
    default:
      return undefined;
  }
}

function consistencyKeyFromText(consistency: string) {
  switch (consistency.trim()) {
    case "规则与 AI 基本一致":
      return "aligned" as const;
    case "规则方向更明确，AI 暂时观望":
      return "rule_clearer_ai_watch" as const;
    case "规则暂时观望，AI 方向更明确":
      return "ai_clearer_rule_watch" as const;
    case "规则与 AI 存在分歧":
      return "divergent" as const;
    default:
      return undefined;
  }
}

function normalizeExternalHref(href?: string | null) {
  if (!href) {
    return "";
  }

  const trimmed = href.trim();
  if (!trimmed || trimmed === "#") {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    if (/^nitter(\.[^/]+)?$/i.test(parsed.hostname)) {
      const segments = parsed.pathname.split("/").filter(Boolean);
      const username = segments[0]?.replace(/^@/, "");
      const statusIndex = segments.findIndex((segment) => segment === "status");
      const statusId = statusIndex >= 0 ? segments[statusIndex + 1] : null;

      if (username && statusId) {
        return `https://x.com/${username}/status/${statusId}`;
      }

      if (username) {
        return `https://x.com/${username}`;
      }
    }

    return trimmed;
  } catch {
    return "";
  }
}

function localizeDrivers(drivers: string[]) {
  return drivers.map((driver) => getLocalizedDriverItem(driver) ?? null);
}

function localizeMetrics(metrics: Array<{ name: string; value: string }>) {
  return metrics.map((metric) => ({
    ...metric,
    ...getLocalizedMetric(metric.name, metric.value)
  }));
}

function localizeHighlights(
  highlights: Array<{ title: string; href: string; publishedAt?: string; score?: number }>,
  defaultScore: number,
  fallbackTime: string
) {
  return highlights.map((item) => ({
    title: item.title,
    href: normalizeExternalHref(item.href),
    publishedAt: item.publishedAt ?? fallbackTime,
    score: item.score ?? defaultScore,
    ...getLocalizedHighlight(item.title)
  }));
}

@Injectable()
export class AssetsService {
  constructor(
    private readonly appDataService: AppDataService,
    private readonly marketDataService: MarketDataService,
    private readonly newsService: NewsService,
    private readonly communityService: CommunityService,
    private readonly kolService: KolService,
    private readonly onchainDataService: OnchainDataService
  ) {}

  async getDetail(symbol: string) {
    const normalizedSymbol = symbol.toUpperCase();
    const generatedAt = new Date().toISOString();
    const [detail, latestAiAnalysis, market, marketSignal, newsSignal, communitySignal, kolSignal, onchainSignal, whaleSignal, recentMarketHighlights, recentMarketTransitions, signalWeights] = await Promise.all([
      this.appDataService.getAssetDetail(normalizedSymbol),
      this.appDataService.getLatestAiAnalysis(normalizedSymbol),
      this.marketDataService.getSnapshot(normalizedSymbol),
      this.marketDataService.getSignalEvaluation(normalizedSymbol),
      this.newsService.getSignalEvaluation(normalizedSymbol as Parameters<NewsService["getSignalEvaluation"]>[0]),
      this.communityService.getSignalEvaluation(normalizedSymbol as Parameters<CommunityService["getSignalEvaluation"]>[0]),
      this.kolService.getSignalEvaluation(normalizedSymbol as Parameters<KolService["getSignalEvaluation"]>[0]),
      this.onchainDataService.getOnchainEvaluation(normalizedSymbol),
      this.onchainDataService.getWhaleEvaluation(normalizedSymbol),
      this.appDataService.getRecentSignalHighlights(normalizedSymbol, "market", 10),
      this.appDataService.getRecentMarketTransitions(normalizedSymbol, 10),
      this.appDataService.getSignalWeights(normalizedSymbol)
    ]);

    const nextSignals = [...detail.signals];
    const eventHighlightsByType = new Map<string, Array<{ title: string; href: string; publishedAt: string; score?: number }>>();
    for (const event of detail.events) {
      const existing = eventHighlightsByType.get(event.type) ?? [];
      existing.push({
        title: event.title,
        href: normalizeExternalHref(event.href),
        publishedAt: event.time,
        score: event.score
      });
      eventHighlightsByType.set(event.type, existing);
    }
    const latestSignalStateByType = new Map(
      (detail.latestSignalStates ?? []).map((item: {
        signalType: string;
        metrics: Array<{ name: string; value: string }>;
        updatedAt: string;
      }) => [item.signalType, item])
    );

    if (newsSignal) {
      const newsIndex = nextSignals.findIndex((signal) => signal.type === "news");
      const newsSignalItem = {
        type: "news",
        label: "新闻信号",
        labelKey: "news" as const,
        direction: newsSignal.direction,
        biasLevel: newsSignal.biasLevel,
        score: newsSignal.score,
        confidence: newsSignal.confidence,
        confidenceKey: confidenceKeyFromText(newsSignal.confidence),
        drivers: newsSignal.drivers,
        driverItems: localizeDrivers(newsSignal.drivers),
        metrics: localizeMetrics(newsSignal.metrics),
        highlights: localizeHighlights(
          newsSignal.highlights.slice(0, DETAIL_HIGHLIGHT_LIMIT),
          newsSignal.score,
          generatedAt
        )
      };
      const storedHighlights = eventHighlightsByType.get("news");
      if (storedHighlights?.length) {
        newsSignalItem.highlights = localizeHighlights(
          storedHighlights.slice(0, DETAIL_HIGHLIGHT_LIMIT).map((item) => ({
            ...item,
            score: typeof item.score === "number" ? item.score : newsSignal.score
          })),
          newsSignal.score,
          generatedAt
        );
      }

      if (newsIndex >= 0) {
        nextSignals[newsIndex] = newsSignalItem;
      } else {
        nextSignals.unshift(newsSignalItem);
      }
    }

    if (communitySignal) {
      const communityIndex = nextSignals.findIndex((signal) => signal.type === "community");
      const communitySignalItem = {
        type: "community",
        label: "社区信号",
        labelKey: "community" as const,
        direction: communitySignal.direction,
        biasLevel: communitySignal.biasLevel,
        score: communitySignal.score,
        confidence: communitySignal.confidence,
        confidenceKey: confidenceKeyFromText(communitySignal.confidence),
        drivers: communitySignal.drivers,
        driverItems: localizeDrivers(communitySignal.drivers),
        metrics: localizeMetrics(communitySignal.metrics),
        highlights: localizeHighlights(
          communitySignal.highlights.slice(0, DETAIL_HIGHLIGHT_LIMIT),
          communitySignal.score,
          generatedAt
        )
      };
      const storedHighlights = eventHighlightsByType.get("community");
      if (storedHighlights?.length) {
        communitySignalItem.highlights = localizeHighlights(
          storedHighlights.slice(0, DETAIL_HIGHLIGHT_LIMIT).map((item) => ({
            ...item,
            score: typeof item.score === "number" ? item.score : communitySignal.score
          })),
          communitySignal.score,
          generatedAt
        );
      }

      if (communityIndex >= 0) {
        nextSignals[communityIndex] = communitySignalItem;
      } else {
        nextSignals.push(communitySignalItem);
      }
    }

    if (kolSignal) {
      const kolIndex = nextSignals.findIndex((signal) => signal.type === "kol");
      const kolSignalItem = {
        type: "kol",
        label: "KOL 信号",
        labelKey: "kol" as const,
        direction: kolSignal.direction,
        biasLevel: kolSignal.biasLevel,
        score: kolSignal.score,
        confidence: kolSignal.confidence,
        confidenceKey: confidenceKeyFromText(kolSignal.confidence),
        drivers: kolSignal.drivers,
        driverItems: localizeDrivers(kolSignal.drivers),
        metrics: localizeMetrics(kolSignal.metrics),
        highlights: localizeHighlights(
          kolSignal.highlights.slice(0, DETAIL_HIGHLIGHT_LIMIT),
          kolSignal.score,
          generatedAt
        )
      };
      const storedHighlights = eventHighlightsByType.get("kol");
      if (storedHighlights?.length) {
        kolSignalItem.highlights = localizeHighlights(
          storedHighlights.slice(0, DETAIL_HIGHLIGHT_LIMIT).map((item) => ({
            ...item,
            score: typeof item.score === "number" ? item.score : kolSignal.score
          })),
          kolSignal.score,
          generatedAt
        );
      }

      if (kolIndex >= 0) {
        nextSignals[kolIndex] = kolSignalItem;
      } else {
        nextSignals.push(kolSignalItem);
      }
    }

    if (onchainSignal) {
      const onchainIndex = nextSignals.findIndex((signal) => signal.type === "onchain");
      const onchainSignalItem = {
        type: "onchain",
        label: "链上信号",
        labelKey: "onchain" as const,
        direction: onchainSignal.direction,
        biasLevel: onchainSignal.biasLevel,
        score: onchainSignal.score,
        confidence: onchainSignal.confidence,
        confidenceKey: confidenceKeyFromText(onchainSignal.confidence),
        drivers: onchainSignal.drivers,
        driverItems: localizeDrivers(onchainSignal.drivers),
        metrics: localizeMetrics(onchainSignal.metrics),
        highlights: localizeHighlights(
          onchainSignal.highlights.slice(0, DETAIL_HIGHLIGHT_LIMIT),
          onchainSignal.score,
          generatedAt
        )
      };
      const storedHighlights = eventHighlightsByType.get("onchain");
      if (storedHighlights?.length) {
        onchainSignalItem.highlights = localizeHighlights(
          storedHighlights.slice(0, DETAIL_HIGHLIGHT_LIMIT).map((item) => ({
            ...item,
            score: typeof item.score === "number" ? item.score : onchainSignal.score
          })),
          onchainSignal.score,
          generatedAt
        );
      }

      if (onchainIndex >= 0) {
        nextSignals[onchainIndex] = onchainSignalItem;
      } else {
        nextSignals.push(onchainSignalItem);
      }
    }

    if (whaleSignal) {
      const whaleIndex = nextSignals.findIndex((signal) => signal.type === "whale");
      const whaleSignalItem = {
        type: "whale",
        label: "鲸鱼信号",
        labelKey: "whale" as const,
        direction: whaleSignal.direction,
        biasLevel: whaleSignal.biasLevel,
        score: whaleSignal.score,
        confidence: whaleSignal.confidence,
        confidenceKey: confidenceKeyFromText(whaleSignal.confidence),
        drivers: whaleSignal.drivers,
        driverItems: localizeDrivers(whaleSignal.drivers),
        metrics: localizeMetrics(whaleSignal.metrics),
        highlights: localizeHighlights(
          whaleSignal.highlights.slice(0, DETAIL_HIGHLIGHT_LIMIT),
          whaleSignal.score,
          generatedAt
        )
      };
      const storedHighlights = eventHighlightsByType.get("whale");
      if (storedHighlights?.length) {
        whaleSignalItem.highlights = localizeHighlights(
          storedHighlights.slice(0, DETAIL_HIGHLIGHT_LIMIT).map((item) => ({
            ...item,
            score: typeof item.score === "number" ? item.score : whaleSignal.score
          })),
          whaleSignal.score,
          generatedAt
        );
      }

      if (whaleIndex >= 0) {
        nextSignals[whaleIndex] = whaleSignalItem;
      } else {
        nextSignals.push(whaleSignalItem);
      }
    }

    if (marketSignal) {
      const marketIndex = nextSignals.findIndex((signal) => signal.type === "market");
      const currentMarketSignal = marketIndex >= 0 ? nextSignals[marketIndex] : null;
      const shouldReplaceMarketSignal = !currentMarketSignal
        || this.isLegacyMarketSignal(currentMarketSignal)
        || this.hasMeaningfulMarketChange(
          {
            direction: marketSignal.direction,
            score: marketSignal.score,
            drivers: marketSignal.drivers
          },
          currentMarketSignal
        );
      const marketSignalItem = {
        type: "market",
        label: "市场信号",
        labelKey: "market" as const,
        direction: marketSignal.direction,
        biasLevel: marketSignal.biasLevel,
        score: marketSignal.score,
        confidence: marketSignal.confidence,
        confidenceKey: confidenceKeyFromText(marketSignal.confidence),
        drivers: marketSignal.drivers,
        driverItems: localizeDrivers(marketSignal.drivers),
        metrics: localizeMetrics(latestSignalStateByType.get("market")?.metrics ?? marketSignal.metrics),
        highlights: localizeHighlights(
          marketSignal.highlights.slice(0, DETAIL_HIGHLIGHT_LIMIT),
          marketSignal.score,
          generatedAt
        )
      };
      const persistedMarketEvents = recentMarketHighlights.map((event) => ({
        title: event.title,
        href: normalizeExternalHref(event.href),
        publishedAt: event.publishedAt ?? generatedAt,
        score: typeof event.score === "number" ? event.score : marketSignal.score
      }));
      const transitionHighlights = recentMarketTransitions.map((event) => ({
        title: event.title,
        href: normalizeExternalHref(event.href),
        publishedAt: event.publishedAt ?? generatedAt,
        score: typeof event.score === "number" ? event.score : marketSignal.score
      }));
      const mergedMarketHighlights = [...marketSignalItem.highlights, ...persistedMarketEvents, ...transitionHighlights];
      const dedupedMarketHighlights = mergedMarketHighlights.filter((item, index, items) => {
        const key = `${item.title}::${item.publishedAt ?? ""}`;
        return items.findIndex((candidate) => `${candidate.title}::${candidate.publishedAt ?? ""}` === key) === index;
      });
      marketSignalItem.highlights = localizeHighlights(
        dedupedMarketHighlights.slice(0, DETAIL_HIGHLIGHT_LIMIT),
        marketSignal.score,
        generatedAt
      );
      const storedHighlights = eventHighlightsByType.get("market");
      if (storedHighlights?.length) {
        marketSignalItem.highlights = localizeHighlights(
          storedHighlights.slice(0, DETAIL_HIGHLIGHT_LIMIT).map((item) => ({
            ...item,
            score: typeof item.score === "number" ? item.score : marketSignal.score
          })),
          marketSignal.score,
          generatedAt
        );
      }

      if (!shouldReplaceMarketSignal) {
        if (marketIndex >= 0) {
          const existing = nextSignals[marketIndex];
          nextSignals[marketIndex] = {
            ...existing,
            metrics: localizeMetrics(latestSignalStateByType.get("market")?.metrics ?? existing.metrics),
            highlights: marketSignalItem.highlights
          };
        }
      } else if (marketIndex >= 0) {
        nextSignals[marketIndex] = marketSignalItem;
      } else {
        nextSignals.unshift(marketSignalItem);
      }
    }

    const normalizedSignals = nextSignals.map((signal) => {
      const normalized = signal.type === "market" ? this.normalizeLegacyMarketSignal(signal) : signal;
      const weight = signalWeights.get(normalized.type);

      return {
        ...normalized,
        labelKey: signalLabelKeyFromType(normalized.type),
        confidenceKey: confidenceKeyFromText(normalized.confidence),
        ...(typeof weight === "number"
          ? {
              weight,
              weightedScore: Math.round((normalized.score * weight) / 100)
            }
          : {})
      };
    });
    const resolvedAi = latestAiAnalysis ?? detail.ai;
    const computedRule = this.buildRuleSummary(normalizedSignals, resolvedAi.direction);

    return {
      ...detail,
      name: market?.name ?? detail.name,
      price: market?.price || detail.price,
      priceChange: market?.priceChange || detail.priceChange,
      rule: {
        ...detail.rule,
        direction: computedRule.direction,
        score: computedRule.score,
        confidence: computedRule.confidence,
        confidenceKey: confidenceKeyFromText(computedRule.confidence),
        risk: computedRule.risk,
        riskKey: riskKeyFromText(computedRule.risk),
        drivers: computedRule.drivers,
        driverItems: computedRule.drivers.map((driver) => getLocalizedRuleDriverItem(driver) ?? null)
      },
      ai: resolvedAi,
      consistency: computedRule.consistency,
      consistencyKey: consistencyKeyFromText(computedRule.consistency),
      consistencyItems: getLocalizedConsistencyItems(computedRule.consistency),
      signals: this.sortSignals(normalizedSignals)
    };
  }

  async getPublicDetail(symbol: string) {
    const normalizedSymbol = symbol.toUpperCase();
    const [detail, baseDetail] = await Promise.all([
      this.getDetail(normalizedSymbol),
      this.appDataService.getAssetDetail(normalizedSymbol)
    ]);
    const publicAi =
      detail.ai.available && detail.ai.basedOnSnapshotAt === baseDetail.ai.basedOnSnapshotAt
        ? {
            ...detail.ai,
            available: true
          }
        : {
            available: false,
            direction: "watch" as const,
            biasLevel: "watch" as const,
            score: 0,
            action: "",
            strength: "",
            confidence: "",
            summary: "",
            updatedAt: undefined,
            basedOnSnapshotAt: undefined,
            reasons: [],
            risks: []
          };
    const computedRule = this.buildRuleSummary(
      detail.signals,
      publicAi.available && publicAi.direction ? publicAi.direction : "watch"
    );

    return {
      ...detail,
      ai: publicAi,
      consistency: computedRule.consistency,
      consistencyKey: consistencyKeyFromText(computedRule.consistency),
      consistencyItems: getLocalizedConsistencyItems(computedRule.consistency),
      rule: {
        ...detail.rule,
        direction: computedRule.direction,
        score: computedRule.score,
        confidence: computedRule.confidence,
        confidenceKey: confidenceKeyFromText(computedRule.confidence),
        risk: computedRule.risk,
        riskKey: riskKeyFromText(computedRule.risk),
        drivers: computedRule.drivers,
        driverItems: computedRule.drivers.map((driver) => getLocalizedRuleDriverItem(driver) ?? null)
      }
    };
  }

  async getTimeline(symbol: string, signal?: string, limit?: number, offset = 0) {
    const normalizedSymbol = symbol.toUpperCase();
    const normalizedLimit = typeof limit === "number" && Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : undefined;
    const normalizedOffset = Number.isFinite(offset) ? Math.max(0, offset) : 0;

    if (signal) {
      return {
        symbol: normalizedSymbol,
        signalType: signal,
        ...await this.appDataService.listTimelineSignalHighlights(
          normalizedSymbol,
          signal,
          normalizedLimit,
          normalizedOffset
        )
      };
    }

    return {
      symbol: normalizedSymbol,
      signalType: null,
      ...await this.appDataService.listTimelineEvents(
        normalizedSymbol,
        normalizedLimit,
        normalizedOffset
      )
    };
  }

  private sortSignals<T extends { type: string }>(signals: T[]) {
    const order = new Map<string, number>(SIGNAL_ORDER.map((type, index) => [type, index]));

    return [...signals].sort((left, right) => {
      const leftIndex = order.get(left.type) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = order.get(right.type) ?? Number.MAX_SAFE_INTEGER;

      return leftIndex - rightIndex;
    });
  }

  private buildRuleSummary(
    signals: Array<{
      label: string;
      weightedScore?: number;
    }>,
    aiDirection: string
  ) {
    const weightedSignals = signals.map((signal) => ({
      ...signal,
      weightedScore: typeof signal.weightedScore === "number" ? signal.weightedScore : 0
    }));
    const score = weightedSignals.reduce((sum, signal) => sum + signal.weightedScore, 0);
    const direction: "bullish" | "bearish" | "watch" =
      score > 0 ? "bullish" : score < 0 ? "bearish" : "watch";
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
    const drivers = [...weightedSignals]
      .sort((left, right) => Math.abs(right.weightedScore) - Math.abs(left.weightedScore))
      .filter((signal) => signal.weightedScore !== 0)
      .slice(0, 3)
      .map((signal) =>
        `${signal.label}${signal.weightedScore > 0 ? "支撑" : "拖累"}整体判断（加权 ${signal.weightedScore > 0 ? `+${signal.weightedScore}` : signal.weightedScore}）`
      );
    const consistency =
      aiDirection === direction
        ? "规则与 AI 基本一致"
        : aiDirection === "watch"
          ? "规则方向更明确，AI 暂时观望"
          : direction === "watch"
            ? "规则暂时观望，AI 方向更明确"
            : "规则与 AI 存在分歧";

    return {
      score,
      direction,
      confidence,
      risk,
      drivers: drivers.length > 0 ? drivers : ["当前子信号加权分接近中性，整体暂处观望。"],
      consistency
    };
  }

  private hasMeaningfulMarketChange(
    current: { direction: string; score: number; drivers: string[] },
    previous: {
      direction: string;
      score: number;
      drivers: string[];
      biasLevel?: string;
    }
  ) {
    if (current.direction !== previous.direction) {
      return true;
    }

    if (this.scoreToBiasLevel(current.score) !== this.scoreToBiasLevel(previous.score)) {
      return true;
    }

    if (Math.abs(current.score - previous.score) >= 8) {
      return true;
    }

    return current.drivers.join("||") !== previous.drivers.join("||");
  }

  private isLegacyMarketSignal(signal: {
    metrics: Array<{ name: string; value: string }>;
    highlights: Array<{ title: string }>;
  }) {
    const metricNames = signal.metrics.map((metric) => metric.name);
    const legacyMetricNames = [
      "EMA20 / EMA60",
      "MACD 柱体",
      "ATR(14)",
      "成交量比",
      "当前结构",
      "均线结构",
      "MACD 状态",
      "量能状态",
      "波动状态"
    ];
    if (legacyMetricNames.some((name) => metricNames.includes(name))) {
      return true;
    }

    return signal.highlights.some((item) =>
      item.title.includes("4H 成交量为近 20 根均量")
      || item.title.includes("ATR/价格比约")
      || item.title.includes("MACD 死叉结构")
      || item.title.includes("MACD 金叉结构")
    );
  }

  private scoreToBiasLevel(score: number) {
    if (score <= -75) return "super_bearish";
    if (score <= -45) return "strong_bearish";
    if (score <= -15) return "weak_bearish";
    if (score < 15) return "watch";
    if (score < 45) return "weak_bullish";
    if (score < 75) return "strong_bullish";
    return "super_bullish";
  }

  private normalizeLegacyMarketSignal<T extends {
    type: string;
    label: string;
    metrics: Array<{ name: string; value: string }>;
    highlights: Array<{ title: string; href: string; publishedAt?: string; score?: number }>;
    drivers: string[];
    score: number;
  }>(signal: T): T {
    if (!this.isLegacyMarketSignal(signal)) {
      return signal;
    }

    const metricMap = new Map(signal.metrics.map((metric) => [metric.name, metric.value]));
    const weakPrice = signal.drivers.some((driver) => driver.includes("价格相对 EMA20偏弱"));
    const bullishPrice = signal.drivers.some((driver) => driver.includes("价格相对 EMA20偏强"));
    const emaStructure = signal.drivers.find((driver) => driver.includes("EMA20"));
    const macdDriver = signal.drivers.find((driver) => driver.includes("MACD"));
    const volumeRatio = metricMap.get("成交量比") ?? "";
    const atr14 = metricMap.get("ATR(14)") ?? "";

    const normalizedMetrics = signal.metrics.map((metric) => {
      if (metric.name === "EMA20 / EMA60") {
        return {
          name: "均线",
          value: emaStructure?.includes("上方") ? "EMA20 > EMA60" : "EMA20 < EMA60"
        };
      }

      if (metric.name === "MACD 柱体") {
        return {
          name: "MACD",
          value: macdDriver?.includes("上方") || macdDriver?.includes("主线位于信号线上方") ? "金叉" : "死叉"
        };
      }

      if (metric.name === "成交量比") {
        return {
          name: "量能",
          value: `${this.volumeLabelFromRatio(volumeRatio)} ${volumeRatio}`
        };
      }

      if (metric.name === "ATR(14)") {
        return {
          name: "波动",
          value: `${this.volatilityLabelFromAtr(atr14)} ${atr14}`
        };
      }

      return metric;
    }).map((metric) => {
      if (metric.name === "24H 涨跌" || metric.name === "4H 涨跌") {
        return metric;
      }

      return metric;
    });

    const withEmaMetric = normalizedMetrics.some((metric) => metric.name === "EMA")
      ? normalizedMetrics
      : [
          normalizedMetrics[0],
          normalizedMetrics[1],
          {
            name: "EMA",
            value: bullishPrice ? "Price > EMA20" : weakPrice ? "Price < EMA20" : "Price ~ EMA20"
          },
          ...normalizedMetrics.slice(2)
        ];

    const finalMetrics = withEmaMetric.map((metric) => {
      if (metric.name === "当前结构") {
        return {
          name: "EMA",
          value: bullishPrice ? "Price > EMA20" : weakPrice ? "Price < EMA20" : "Price ~ EMA20"
        };
      }

      if (metric.name === "均线结构") {
        return {
          name: "均线",
          value: emaStructure?.includes("上方") ? "EMA20 > EMA60" : "EMA20 < EMA60"
        };
      }

      if (metric.name === "MACD 状态") {
        return {
          name: "MACD",
          value: macdDriver?.includes("上方") || macdDriver?.includes("金叉") ? "金叉" : "死叉"
        };
      }

      if (metric.name === "量能状态") {
        return {
          name: "量能",
          value: metric.value.replace(/[()]/g, "")
        };
      }

      if (metric.name === "波动状态") {
        return {
          name: "波动",
          value: metric.value.replace(/[()]/g, "")
        };
      }

      return metric;
    });

    return {
      ...signal,
      metrics: finalMetrics,
      highlights: signal.highlights.slice(0, 1)
    };
  }

  private volumeLabelFromRatio(value: string) {
    const numeric = Number.parseFloat(value);
    if (!Number.isFinite(numeric)) return "量能";
    if (numeric < 0.8) return "缩量";
    if (numeric < 1.1) return "正常量能";
    if (numeric < 1.6) return "放量";
    return "异常放量";
  }

  private volatilityLabelFromAtr(value: string) {
    const numeric = Number.parseFloat(value);
    if (!Number.isFinite(numeric)) return "波动";
    if (numeric <= 0.025) return "低波动";
    if (numeric <= 0.045) return "中性波动";
    if (numeric <= 0.07) return "高波动观察区";
    if (numeric <= 0.1) return "高风险波动";
    return "异常波动";
  }
}
