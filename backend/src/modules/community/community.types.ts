export const SUPPORTED_COMMUNITY_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE"] as const;

export type SupportedCommunitySymbol = (typeof SUPPORTED_COMMUNITY_SYMBOLS)[number];

export type CommunityDirection = "bullish" | "bearish" | "watch";

export type CommunityPost = {
  id: string;
  source: "reddit" | "telegram";
  subreddit: string;
  feedType: "hot" | "new";
  title: string;
  body: string;
  url: string;
  permalink: string;
  publishedAt: string;
  score: number;
  numComments: number;
  upvoteRatio: number | null;
  matchedSymbols: SupportedCommunitySymbol[];
  sourceWeight: number;
};

export type CommunitySignalEvaluation = {
  symbol: SupportedCommunitySymbol;
  score: number;
  direction: CommunityDirection;
  biasLevel:
    | "super_bearish"
    | "strong_bearish"
    | "weak_bearish"
    | "watch"
    | "weak_bullish"
    | "strong_bullish"
    | "super_bullish";
  confidence: string;
  drivers: string[];
  metrics: Array<{ name: string; value: string }>;
  highlights: Array<{ title: string; href: string; publishedAt?: string; score?: number }>;
};
