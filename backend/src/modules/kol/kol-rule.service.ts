import { Injectable } from "@nestjs/common";
import { kolScoreToBiasLevel, kolScoreToDirection, scoreKolSentiment } from "./kol.utils";
import type { KolPost, KolSignalEvaluation, SupportedKolSymbol } from "./kol.types";

@Injectable()
export class KolRuleService {
  evaluate(symbol: SupportedKolSymbol, posts: KolPost[]): KolSignalEvaluation {
    let weightedSentiment = 0;
    let weightedActivity = 0;
    let positivePosts = 0;
    let negativePosts = 0;
    const distinctAuthors = new Set<string>();
    const coreAuthors = new Set<string>();
    let corePosts = 0;

    const ranked = posts
      .map((post) => {
        const ageHours = (Date.now() - new Date(post.publishedAt).getTime()) / 3_600_000;
        const timeWeight = ageHours <= 6 ? 1 : ageHours <= 24 ? 0.78 : ageHours <= 72 ? 0.5 : 0.25;
        const sentiment = scoreKolSentiment(`${post.title}\n${post.body}`);
        const totalWeight = post.authorWeight * timeWeight;

        distinctAuthors.add(post.author);
        if (post.authorTier === "core") {
          coreAuthors.add(post.author);
          corePosts += 1;
        }
        if (sentiment.net > 0) positivePosts += 1;
        if (sentiment.net < 0) negativePosts += 1;

        weightedSentiment += sentiment.net * 16 * totalWeight;
        weightedActivity += totalWeight;

        return {
          post,
          totalWeight,
          sentiment
        };
      })
      .sort((left, right) => right.totalWeight - left.totalWeight);

    const averageSentiment = weightedActivity > 0 ? weightedSentiment / weightedActivity : 0;
    const consensusBoost = Math.min(18, Math.max(0, distinctAuthors.size - 1) * 2);
    const score =
      Math.abs(averageSentiment) < 6
        ? Math.round(averageSentiment)
        : Math.round(averageSentiment + Math.sign(averageSentiment) * consensusBoost);
    const clampedScore = Math.max(-100, Math.min(100, score));
    const direction = kolScoreToDirection(clampedScore);
    const topTopics = this.pickTopics(ranked.map(({ post }) => post));

    return {
      symbol,
      score: clampedScore,
      direction,
      biasLevel: kolScoreToBiasLevel(clampedScore),
      confidence:
        distinctAuthors.size >= 4 || Math.abs(clampedScore) >= 45
          ? "high"
          : distinctAuthors.size >= 2 || Math.abs(clampedScore) >= 20
          ? "medium"
            : "low",
      drivers: this.pickDrivers(
        direction,
        distinctAuthors.size,
        coreAuthors.size,
        positivePosts,
        negativePosts,
        topTopics
      ),
      metrics: [
        { name: "KOL 帖子数", value: `${ranked.length} 条` },
        { name: "活跃作者数", value: `${distinctAuthors.size} 个` },
        { name: "核心 / 观察名单", value: `${corePosts} / ${Math.max(0, ranked.length - corePosts)}` },
        { name: "偏多 / 偏空观点", value: `${positivePosts} / ${negativePosts}` },
        { name: "平均情绪", value: averageSentiment.toFixed(1) }
      ],
      highlights: ranked.slice(0, 10).map(({ post, sentiment }) => ({
        title: `[@${post.author}] ${post.title}`,
        href: post.url,
        publishedAt: post.publishedAt,
        score: Math.max(-100, Math.min(100, Math.round(sentiment.net * 20)))
      }))
    };
  }

  private pickDrivers(
    direction: "bullish" | "bearish" | "watch",
    authors: number,
    coreAuthors: number,
    positivePosts: number,
    negativePosts: number,
    topTopics: string[]
  ) {
    const consensusDriver =
      coreAuthors >= 2
        ? `${coreAuthors} 个核心作者参与，出现同向信号`
        : authors >= 3
          ? `${authors} 个活跃作者参与，但核心作者一致性一般`
          : "活跃作者数量有限";
    const topicDriver = topTopics.length > 0 ? `高权重讨论集中在 ${topTopics.join("、")}` : "讨论主题较分散";

    if (direction === "bullish") {
      return [
        `偏多 / 偏空观点为 ${positivePosts} / ${negativePosts}，观点偏多`,
        consensusDriver,
        topicDriver
      ];
    }

    if (direction === "bearish") {
      return [
        `偏多 / 偏空观点为 ${positivePosts} / ${negativePosts}，观点偏空`,
        consensusDriver,
        topicDriver
      ];
    }

    return [
      `偏多 / 偏空观点为 ${positivePosts} / ${negativePosts}，整体接近平衡`,
      consensusDriver,
      topicDriver
    ];
  }

  private pickTopics(posts: KolPost[]) {
    const topicCounts = new Map<string, number>();
    const rules: Array<{ topic: string; keywords: string[] }> = [
      { topic: "ETF", keywords: ["etf"] },
      { topic: "资金流", keywords: ["inflow", "outflow", "flows"] },
      { topic: "宏观风险", keywords: ["fed", "rates", "inflation", "tariff", "war"] },
      { topic: "安全事件", keywords: ["hack", "exploit", "security"] },
      { topic: "监管", keywords: ["sec", "lawsuit", "regulation"] },
      { topic: "网络升级", keywords: ["upgrade", "network", "fork"] }
    ];

    for (const post of posts) {
      const text = `${post.title}\n${post.body}`.toLowerCase();
      for (const rule of rules) {
        if (rule.keywords.some((keyword) => text.includes(keyword))) {
          topicCounts.set(rule.topic, (topicCounts.get(rule.topic) ?? 0) + 1);
        }
      }
    }

    return [...topicCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 2)
      .map(([topic]) => topic);
  }
}
