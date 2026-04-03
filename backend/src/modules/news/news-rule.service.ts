import { Injectable } from "@nestjs/common";
import {
  NEWS_NEGATIVE_KEYWORDS,
  NEWS_POSITIVE_KEYWORDS,
  type SupportedNewsSymbol
} from "./news.constants";
import { NewsItem, NewsSignalEvaluation } from "./news.types";
import { normalizeText } from "./news.utils";

const vader: {
  SentimentIntensityAnalyzer: {
    polarity_scores(text: string): { compound: number };
  };
} = require("vader-sentiment");

type ScoredArticle = {
  item: NewsItem;
  score: number;
  reason: string;
  sentiment: "positive" | "negative" | "neutral";
};

@Injectable()
export class NewsRuleService {
  evaluate(symbol: SupportedNewsSymbol, items: NewsItem[]): NewsSignalEvaluation {
    const scoredItems = items.map((item) => this.scoreArticle(item));
    const totalScore = this.clamp(
      Math.round(scoredItems.reduce((sum, item) => sum + item.score, 0)),
      -100,
      100
    );
    const direction = this.toDirection(totalScore);

    const positiveCount = scoredItems.filter((item) => item.sentiment === "positive").length;
    const negativeCount = scoredItems.filter((item) => item.sentiment === "negative").length;
    const assetSpecificCount = items.filter((item) => item.category === "asset_specific").length;

    return {
      symbol,
      score: totalScore,
      direction,
      biasLevel: this.toBiasLevel(totalScore),
      confidence: this.toConfidence(totalScore, items.length),
      drivers: this.pickDrivers(scoredItems, direction),
      metrics: [
        { name: "新闻样本", value: `${items.length} 条` },
        { name: "单币种事件", value: `${assetSpecificCount} 条` },
        { name: "正向 / 负向", value: `${positiveCount} / ${negativeCount}` },
        { name: "最近 24H", value: `${this.countRecentItems(items, 24)} 条` }
      ],
      highlights: this.pickHighlights(scoredItems)
    };
  }

  private scoreArticle(item: NewsItem): ScoredArticle {
    const text = normalizeText(`${item.title} ${item.summary ?? ""}`);
    const vaderScore = vader.SentimentIntensityAnalyzer.polarity_scores(text).compound as number;
    const positiveHits = NEWS_POSITIVE_KEYWORDS.filter((keyword) => text.includes(keyword)).length;
    const negativeHits = NEWS_NEGATIVE_KEYWORDS.filter((keyword) => text.includes(keyword)).length;
    const lexiconDelta = positiveHits - negativeHits;
    const lexiconBoost = this.lexiconBoost(positiveHits, negativeHits);
    const rawSentiment = this.clamp(vaderScore * 28 + lexiconBoost, -35, 35);
    const sentiment =
      rawSentiment > 0 ? "positive" : rawSentiment < 0 ? "negative" : "neutral";
    const baseMagnitude = Math.max(0.8, Math.min(Math.abs(rawSentiment) / 10, 3.2));
    const categoryWeight = this.categoryWeight(item.category);
    const recencyWeight = this.recencyWeight(item.publishedAt);
    const direction = rawSentiment === 0 ? 0 : rawSentiment > 0 ? 1 : -1;
    const score = Math.round(direction * baseMagnitude * 10 * categoryWeight * recencyWeight);
    const signalStrength =
      sentiment === "neutral"
        ? "中性"
        : lexiconDelta !== 0
          ? `VADER + 领域词表`
          : "VADER";

    return {
      item,
      score,
      reason: this.buildReason(item, sentiment, signalStrength),
      sentiment
    };
  }

  private buildReason(
    item: NewsItem,
    sentiment: ScoredArticle["sentiment"],
    signalStrength: string
  ) {
    const prefix =
      item.category === "asset_specific"
        ? "单币种新闻"
        : item.category === "macro_finance"
          ? "宏观金融新闻"
          : item.category === "macro_politics"
            ? "政治事件新闻"
            : "行业新闻";

    if (sentiment === "positive") {
      return `${prefix}偏多，来源 ${item.source}，判断基于 ${signalStrength}`;
    }

    if (sentiment === "negative") {
      return `${prefix}偏空，来源 ${item.source}，判断基于 ${signalStrength}`;
    }

    return `${prefix}中性，来源 ${item.source}，判断基于 ${signalStrength}`;
  }

  private lexiconBoost(positiveHits: number, negativeHits: number) {
    return positiveHits * 4 - negativeHits * 4;
  }

  private categoryWeight(category: NewsItem["category"]) {
    if (category === "asset_specific") {
      return 1.35;
    }

    if (category === "macro_finance") {
      return 1.15;
    }

    if (category === "macro_politics") {
      return 0.95;
    }

    return 1;
  }

  private recencyWeight(publishedAt: string) {
    const ageHours = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / 3_600_000);

    if (ageHours <= 12) {
      return 1.15;
    }

    if (ageHours <= 24) {
      return 1;
    }

    if (ageHours <= 72) {
      return 0.8;
    }

    return 0.6;
  }

  private countRecentItems(items: NewsItem[], hours: number) {
    const threshold = Date.now() - hours * 3_600_000;
    return items.filter((item) => new Date(item.publishedAt).getTime() >= threshold).length;
  }

  private pickDrivers(
    items: ScoredArticle[],
    direction: "bullish" | "bearish" | "watch"
  ) {
    const aligned = items.filter((item) => {
      if (direction === "bullish") {
        return item.score > 0;
      }

      if (direction === "bearish") {
        return item.score < 0;
      }

      return item.score !== 0;
    });

    const ranked = (aligned.length > 0 ? aligned : items)
      .slice()
      .sort((left, right) => Math.abs(right.score) - Math.abs(left.score))
      .slice(0, 6);

    const drivers: string[] = [];
    const seen = new Set<string>();

    for (const item of ranked) {
      const driver = this.toDriver(item);
      if (seen.has(driver)) {
        continue;
      }

      seen.add(driver);
      drivers.push(driver);

      if (drivers.length >= 3) {
        break;
      }
    }

    return drivers.length > 0 ? drivers : ranked.slice(0, 3).map((item) => item.reason);
  }

  private pickHighlights(items: ScoredArticle[]) {
    return items
      .slice()
      .sort((left, right) => Math.abs(right.score) - Math.abs(left.score))
      .slice(0, 10)
      .map((item) => ({
        title: item.item.title,
        href: item.item.url,
        publishedAt: item.item.publishedAt,
        score: item.score
      }));
  }

  private toDirection(score: number): "bullish" | "bearish" | "watch" {
    if (score >= 18) {
      return "bullish";
    }

    if (score <= -18) {
      return "bearish";
    }

    return "watch";
  }

  private toBiasLevel(score: number) {
    if (score <= -75) {
      return "super_bearish" as const;
    }

    if (score <= -45) {
      return "strong_bearish" as const;
    }

    if (score <= -15) {
      return "weak_bearish" as const;
    }

    if (score < 15) {
      return "watch" as const;
    }

    if (score < 45) {
      return "weak_bullish" as const;
    }

    if (score < 75) {
      return "strong_bullish" as const;
    }

    return "super_bullish" as const;
  }

  private toConfidence(score: number, count: number) {
    const value = Math.abs(score);

    if (value >= 60 || (value >= 40 && count >= 6)) {
      return "high";
    }

    if (value >= 25 || count >= 4) {
      return "medium";
    }

    return "low";
  }

  private toDriver(item: ScoredArticle) {
    const categoryLabel =
      item.item.category === "asset_specific"
        ? "单币新闻"
        : item.item.category === "macro_finance"
          ? "宏观金融"
          : item.item.category === "macro_politics"
            ? "政治宏观"
            : "行业新闻";
    const topic = this.inferTopic(item.item);
    const directionLabel =
      item.sentiment === "positive" ? "偏多" : item.sentiment === "negative" ? "偏空" : "中性";

    return `${categoryLabel}${topic ? `聚焦${topic}` : ""}，来源 ${item.item.source}，整体${directionLabel}`;
  }

  private inferTopic(item: NewsItem) {
    const text = normalizeText(`${item.title} ${item.summary ?? ""}`);

    if (text.includes("etf")) {
      return "ETF";
    }

    if (text.includes("federal reserve") || text.includes("interest rate") || text.includes("inflation")) {
      return "利率与通胀";
    }

    if (text.includes("hack") || text.includes("exploit") || text.includes("security")) {
      return "安全事件";
    }

    if (text.includes("lawsuit") || text.includes("regulation") || text.includes("sec")) {
      return "监管事件";
    }

    if (text.includes("upgrade") || text.includes("network")) {
      return "网络升级";
    }

    if (text.includes("exchange")) {
      return "交易所动态";
    }

    if (item.symbols.length > 0) {
      return item.symbols.join("/");
    }

    return "";
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }
}
