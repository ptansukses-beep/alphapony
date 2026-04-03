export const SUPPORTED_MARKET_ASSETS = [
  { symbol: "BTC", binanceSymbol: "BTC/USDT", coinGeckoId: "bitcoin" },
  { symbol: "ETH", binanceSymbol: "ETH/USDT", coinGeckoId: "ethereum" },
  { symbol: "SOL", binanceSymbol: "SOL/USDT", coinGeckoId: "solana" },
  { symbol: "BNB", binanceSymbol: "BNB/USDT", coinGeckoId: "binancecoin" },
  { symbol: "XRP", binanceSymbol: "XRP/USDT", coinGeckoId: "ripple" },
  { symbol: "DOGE", binanceSymbol: "DOGE/USDT", coinGeckoId: "dogecoin" }
] as const;

export type SupportedMarketSymbol = (typeof SUPPORTED_MARKET_ASSETS)[number]["symbol"];
