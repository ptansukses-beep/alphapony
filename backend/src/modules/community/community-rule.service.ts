import { Injectable } from "@nestjs/common";
import { scoreCommunitySentiment, communityScoreToBiasLevel, communityScoreToDirection } from "./community.utils";
import type { CommunityPost, CommunitySignalEvaluation, SupportedCommunitySymbol } from "./community.types";

@Injectable()
export class CommunityRuleService {
  evaluate(symbol: SupportedCommunitySymbol, posts: CommunityPost[]): CommunitySignalEvaluation {
    let weightedSentiment = 0;
    let weightedActivity = 0;
    let positivePosts = 0;
    let negativePosts = 0;

    const ranked = posts
      .map((post) => {
        const ageHours = (Date.now() - new Date(post.publishedAt).getTime()) / 3_600_000;
        const timeWeight = ageHours <= 6 ? 1 : ageHours <= 24 ? 0.72 : ageHours <= 72 ? 0.45 : 0.22;
        const interactionWeight = Math.min(1.8, 0.55 + (post.score + post.numComments * 1.5) / 180);
        const sentiment = scoreCommunitySentiment(`${post.title}\n${post.body}`);
        const totalWeight = post.sourceWeight * timeWeight * interactionWeight;

        if (sentiment.net > 0) positivePosts += 1;
        if (sentiment.net < 0) negativePosts += 1;

        weightedSentiment += sentiment.net * 11 * totalWeight;
        weightedActivity += totalWeight;

        return {
          post,
          totalWeight,
          sentiment
        };
      })
      .sort((left, right) => right.totalWeight - left.totalWeight);

    const averageSentiment = weightedActivity > 0 ? weightedSentiment / weightedActivity : 0;
    const activityBoost = Math.min(22, Math.max(0, ranked.length - 2) * 2.5 + Math.min(weightedActivity, 10));
    const score =
      Math.abs(averageSentiment) < 6
        ? Math.round(averageSentiment)
        : Math.round(averageSentiment + Math.sign(averageSentiment) * activityBoost);
    const clampedScore = Math.max(-100, Math.min(100, score));
    const direction = communityScoreToDirection(clampedScore);
    const topTopics = this.pickTopics(ranked.map(({ post }) => post));

    return {
      symbol,
      score: clampedScore,
      direction,
      biasLevel: communityScoreToBiasLevel(clampedScore),
      confidence:
        ranked.length >= 8 || Math.abs(clampedScore) >= 45
          ? "high"
          : ranked.length >= 4 || Math.abs(clampedScore) >= 20
            ? "medium"
            : "low",
      drivers: this.pickDrivers(direction, positivePosts, negativePosts, ranked.length, weightedActivity, topTopics),
      metrics: [
        { name: "帖子数量", value: `${ranked.length} 条` },
        { name: "热度权重", value: weightedActivity.toFixed(1) },
        { name: "偏多 / 偏空帖子", value: `${positivePosts} / ${negativePosts}` },
        { name: "平均情绪", value: averageSentiment.toFixed(1) }
      ],
      highlights: ranked.slice(0, 10).map(({ post, sentiment }) => ({
        title: `${post.source === "telegram" ? "[Telegram]" : `[r/${post.subreddit}]`} ${post.title}`,
        href: post.permalink || post.url,
        publishedAt: post.publishedAt,
        score: Math.max(-100, Math.min(100, Math.round(sentiment.net * 18)))
      }))
    };
  }

  private pickDrivers(
    direction: "bullish" | "bearish" | "watch",
    positivePosts: number,
    negativePosts: number,
    totalPosts: number,
    weightedActivity: number,
    topTopics: string[]
  ) {
    const activityDriver =
      weightedActivity >= 24
        ? "社区讨论热度显著放大"
        : weightedActivity >= 12
          ? "社区讨论热度处于活跃区间"
          : "社区讨论热度相对有限";
    const topicDriver = topTopics.length > 0 ? `讨论焦点集中在 ${topTopics.join("、")}` : "讨论主题较分散";

    if (direction === "bullish") {
      return [
        `偏多 / 偏空帖子为 ${positivePosts} / ${negativePosts}，情绪偏多`,
        totalPosts >= 6 ? activityDriver : "社区样本量有限，但方向偏多",
        topicDriver
      ];
    }

    if (direction === "bearish") {
      return [
        `偏多 / 偏空帖子为 ${positivePosts} / ${negativePosts}，情绪偏空`,
        totalPosts >= 6 ? activityDriver : "社区样本量有限，但方向偏空",
        topicDriver
      ];
    }

    return [
      `偏多 / 偏空帖子为 ${positivePosts} / ${negativePosts}，整体接近平衡`,
      totalPosts >= 6 ? activityDriver : "社区样本量有限，暂未形成明显方向",
      topicDriver
    ];
  }

  private pickTopics(posts: CommunityPost[]) {
    const topicCounts = new Map<string, number>();
    const rules: Array<{ topic: string; keywords: string[] }> = [
      { topic: "ETF", keywords: ["etf"] },
      { topic: "监管", keywords: ["sec", "regulation", "lawsuit", "government"] },
      { topic: "安全事件", keywords: ["hack", "exploit", "security"] },
      { topic: "网络升级", keywords: ["upgrade", "network", "fork"] },
      { topic: "价格波动", keywords: ["dump", "pump", "dip", "breakout", "crash"] },
      { topic: "宏观风险", keywords: ["tariff", "war", "inflation", "rates", "fed"] }
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
