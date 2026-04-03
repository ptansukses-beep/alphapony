import type { KolAuthorTier, SupportedKolSymbol } from "./kol.types";

type KolAccountConfig = {
  username: string;
  weight: number;
  symbol?: SupportedKolSymbol;
  tier: KolAuthorTier;
};

export const KOL_CACHE_TTL_MS = 10 * 60 * 1000;

export const KOL_SYMBOL_ALIASES: Record<SupportedKolSymbol, string[]> = {
  BTC: ["bitcoin", "btc"],
  ETH: ["ethereum", "eth"],
  SOL: ["solana", "sol"],
  BNB: ["bnb", "binance coin"],
  XRP: ["xrp", "ripple"],
  DOGE: ["doge", "dogecoin"]
};

export const KOL_POSITIVE_KEYWORDS = [
  "bullish",
  "long",
  "buy",
  "accumulate",
  "breakout",
  "up only",
  "strong",
  "outperform",
  "rebound",
  "rally",
  "adoption",
  "approval"
] as const;

export const KOL_NEGATIVE_KEYWORDS = [
  "bearish",
  "short",
  "sell",
  "dump",
  "breakdown",
  "weak",
  "downtrend",
  "risk-off",
  "overvalued",
  "hack",
  "exploit",
  "lawsuit"
] as const;

export const DEFAULT_NITTER_BASE_URLS = [
  "https://nitter.net",
  "https://nitter.poast.org",
  "https://xcancel.com",
  "https://twitt.re"
] as const;

export const KOL_FETCH_CONCURRENCY = 4;
export const KOL_WATCHLIST_BATCH_SIZE = 4;
export const KOL_INSTANCE_RETRY_COUNT = 1;

export const DEFAULT_CORE_KOL_ACCOUNTS: readonly KolAccountConfig[] = [
  { username: "VitalikButerin", weight: 1.4, symbol: "ETH", tier: "core" },
  { username: "brian_armstrong", weight: 1.25, tier: "core" },
  { username: "aantonop", weight: 1.2, symbol: "BTC", tier: "core" },
  { username: "ErikVoorhees", weight: 1.2, tier: "core" },
  { username: "rektcapital", weight: 1.2, symbol: "BTC", tier: "core" },
  { username: "saylor", weight: 1.45, symbol: "BTC", tier: "core" },
  { username: "AltcoinSherpa", weight: 1.3, tier: "core" },
  { username: "balajis", weight: 1.2, tier: "core" },
  { username: "APompliano", weight: 1.2, symbol: "BTC", tier: "core" },
  { username: "defiignas", weight: 1.1, symbol: "ETH", tier: "core" },
  { username: "lookonchain", weight: 1.2, tier: "core" },
  { username: "cz_binance", weight: 1.35, symbol: "BNB", tier: "core" },
  { username: "bgarlinghouse", weight: 1.15, symbol: "XRP", tier: "core" },
  { username: "BillyM2k", weight: 1.1, symbol: "DOGE", tier: "core" },
  { username: "cobie", weight: 1.15, tier: "core" },
  { username: "elonmusk", weight: 1.5, tier: "core" },
  { username: "realDonaldTrump", weight: 1.35, tier: "core" }
] as const;

export const DEFAULT_WATCHLIST_KOL_ACCOUNTS: readonly KolAccountConfig[] = [
  { username: "whale_alert", weight: 1.1, tier: "watchlist" },
  { username: "WatcherGuru", weight: 1.05, tier: "watchlist" },
  { username: "BitcoinMagazine", weight: 1.05, symbol: "BTC", tier: "watchlist" },
  { username: "sassal0x", weight: 1.15, symbol: "ETH", tier: "watchlist" },
  { username: "EricBalchunas", weight: 1.05, symbol: "BTC", tier: "watchlist" },
  { username: "blknoiz06", weight: 1.2, symbol: "SOL", tier: "watchlist" },
  { username: "hasufl", weight: 1.1, symbol: "ETH", tier: "watchlist" },
  { username: "StaniKulechov", weight: 1.1, symbol: "ETH", tier: "watchlist" },
  { username: "SatoshiLite", weight: 1.05, tier: "watchlist" },
  { username: "Ripple", weight: 1.05, symbol: "XRP", tier: "watchlist" },
  { username: "cb_doge", weight: 1.05, symbol: "DOGE", tier: "watchlist" }
] as const;

export const DEFAULT_KOL_ACCOUNTS: readonly KolAccountConfig[] = [
  ...DEFAULT_CORE_KOL_ACCOUNTS,
  ...DEFAULT_WATCHLIST_KOL_ACCOUNTS
] as const;
