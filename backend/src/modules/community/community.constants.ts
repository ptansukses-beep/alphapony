import type { SupportedCommunitySymbol } from "./community.types";

type CommunityRedditFeed = {
  subreddit: string;
  feedType: "hot" | "new";
  symbol?: SupportedCommunitySymbol;
  weight: number;
};

export const COMMUNITY_CACHE_TTL_MS = 10 * 60 * 1000;

export const COMMUNITY_REDDIT_USER_AGENT =
  "alphapony-community-ingestor/0.1";

export const COMMUNITY_REDDIT_FEEDS: CommunityRedditFeed[] = [
  { subreddit: "Bitcoin", feedType: "new", symbol: "BTC", weight: 1.35 },
  { subreddit: "Bitcoin", feedType: "hot", symbol: "BTC", weight: 1.35 },
  { subreddit: "ethereum", feedType: "new", symbol: "ETH", weight: 1.35 },
  { subreddit: "ethereum", feedType: "hot", symbol: "ETH", weight: 1.35 },
  { subreddit: "solana", feedType: "new", symbol: "SOL", weight: 1.35 },
  { subreddit: "solana", feedType: "hot", symbol: "SOL", weight: 1.35 },
  { subreddit: "XRP", feedType: "new", symbol: "XRP", weight: 1.35 },
  { subreddit: "XRP", feedType: "hot", symbol: "XRP", weight: 1.35 },
  { subreddit: "dogecoin", feedType: "new", symbol: "DOGE", weight: 1.35 },
  { subreddit: "dogecoin", feedType: "hot", symbol: "DOGE", weight: 1.35 },
  { subreddit: "CryptoCurrency", feedType: "new", weight: 1 },
  { subreddit: "CryptoCurrency", feedType: "hot", weight: 1.05 },
  { subreddit: "CryptoMarkets", feedType: "new", weight: 1 },
  { subreddit: "CryptoMarkets", feedType: "hot", weight: 1.05 },
  { subreddit: "BitcoinMarkets", feedType: "new", weight: 1.05 },
  { subreddit: "BitcoinMarkets", feedType: "hot", weight: 1.1 },
  { subreddit: "ethfinance", feedType: "new", weight: 1.05 },
  { subreddit: "ethfinance", feedType: "hot", weight: 1.1 }
] as const;

export const COMMUNITY_REDDIT_LIMIT_PER_FEED = 25;

export const COMMUNITY_SYMBOL_ALIASES: Record<SupportedCommunitySymbol, string[]> = {
  BTC: ["bitcoin", "btc"],
  ETH: ["ethereum", "eth"],
  SOL: ["solana", "sol"],
  BNB: ["bnb", "binance coin"],
  XRP: ["xrp", "ripple"],
  DOGE: ["doge", "dogecoin"]
};

export const COMMUNITY_POSITIVE_KEYWORDS = [
  "bullish",
  "breakout",
  "buy",
  "bought",
  "accumulate",
  "accumulation",
  "long",
  "moon",
  "strong",
  "outperform",
  "rebound",
  "pump",
  "rally",
  "recovery",
  "uptrend",
  "upgrade",
  "adoption"
] as const;

export const COMMUNITY_NEGATIVE_KEYWORDS = [
  "bearish",
  "dump",
  "sell",
  "sold",
  "short",
  "crash",
  "breakdown",
  "weak",
  "downtrend",
  "rug",
  "hack",
  "exploit",
  "scam",
  "liquidation",
  "outflow",
  "capitulation",
  "dead"
] as const;
