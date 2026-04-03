export const SUPPORTED_NEWS_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE"] as const;

export type SupportedNewsSymbol = (typeof SUPPORTED_NEWS_SYMBOLS)[number];

export const NEWS_CACHE_TTL_MS = 10 * 60 * 1000;

export const NEWS_DEFAULT_LIMIT = 24;
export const NEWS_MAX_LIMIT = 48;

export const NEWS_CATEGORY_LABELS = {
  macro_politics: "政治大事件",
  macro_finance: "金融事件",
  crypto_industry: "币圈行业事件",
  asset_specific: "单币种事件"
} as const;

export const NEWS_SYMBOL_ALIASES: Record<SupportedNewsSymbol, string[]> = {
  BTC: ["bitcoin", "btc", "比特币"],
  ETH: ["ethereum", "eth", "以太坊"],
  SOL: ["solana", "sol", "索拉纳"],
  BNB: ["bnb", "binance coin", "币安币"],
  XRP: ["xrp", "ripple", "瑞波"],
  DOGE: ["dogecoin", "doge", "狗狗币"]
};

export const NEWS_RSS_FEEDS = [
  {
    key: "coindesk",
    source: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    category: "crypto_industry"
  },
  {
    key: "cointelegraph",
    source: "Cointelegraph",
    url: "https://cointelegraph.com/rss",
    category: "crypto_industry"
  },
  {
    key: "the-block",
    source: "The Block",
    url: "https://www.theblock.co/rss.xml",
    category: "crypto_industry"
  },
  {
    key: "ethereum-blog",
    source: "Ethereum Blog",
    url: "https://blog.ethereum.org/en/feed.xml",
    category: "asset_specific"
  },
  {
    key: "fed",
    source: "Federal Reserve",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    category: "macro_finance"
  },
  {
    key: "sec",
    source: "SEC",
    url: "https://www.sec.gov/news/pressreleases.rss",
    category: "macro_politics"
  }
] as const;

export const NEWS_GDELT_PRESETS = {
  macro_politics:
    '(crypto OR bitcoin OR cryptocurrency OR blockchain) AND (election OR war OR sanctions OR tariff OR government OR regulation OR geopolitical)',
  macro_finance:
    '(crypto OR bitcoin OR ethereum) AND ("Federal Reserve" OR "interest rate" OR inflation OR CPI OR ETF OR liquidity OR recession OR treasury)',
  crypto_industry:
    '(crypto OR bitcoin OR ethereum OR solana OR bnb OR xrp OR dogecoin) AND (exchange OR hack OR approval OR lawsuit OR upgrade OR partnership OR stablecoin)'
} as const;

export const NEWS_GUARDIAN_PRESETS = {
  macro_politics:
    '("crypto" OR bitcoin OR ethereum) AND (regulation OR government OR election OR sanctions OR congress OR politics)',
  macro_finance:
    '("crypto" OR bitcoin OR ethereum) AND ("interest rates" OR inflation OR cpi OR etf OR market OR recession OR liquidity)'
} as const;

export const CRYPTO_KEYWORDS = [
  "crypto",
  "bitcoin",
  "ethereum",
  "solana",
  "dogecoin",
  "xrp",
  "ripple",
  "binance",
  "blockchain",
  "stablecoin",
  "web3",
  "token"
];

export const MACRO_POLITICS_KEYWORDS = [
  "election",
  "government",
  "regulation",
  "regulator",
  "sanction",
  "tariff",
  "war",
  "conflict",
  "congress",
  "white house",
  "ministry",
  "cabinet",
  "policy"
];

export const MACRO_FINANCE_KEYWORDS = [
  "federal reserve",
  "fed",
  "interest rate",
  "cpi",
  "inflation",
  "jobs report",
  "etf",
  "liquidity",
  "bond",
  "yield",
  "treasury",
  "recession",
  "bank",
  "gdp"
];

export const NEWS_POSITIVE_KEYWORDS = [
  "approval",
  "approve",
  "inflow",
  "buy",
  "bought",
  "bullish",
  "rebound",
  "recovery",
  "partnership",
  "launch",
  "upgrade",
  "adoption",
  "accumulation",
  "surge",
  "record high",
  "growth",
  "expands",
  "gain",
  "rally",
  "holding"
];

export const NEWS_NEGATIVE_KEYWORDS = [
  "hack",
  "exploit",
  "lawsuit",
  "reject",
  "rejection",
  "delay",
  "outflow",
  "sell",
  "sold",
  "bearish",
  "decline",
  "drop",
  "slump",
  "crash",
  "liquidation",
  "sanction",
  "investigation",
  "fraud",
  "attack",
  "wrong way",
  "moved to exchanges",
  "moved another",
  "security breach"
];
