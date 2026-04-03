export type SignalType =
  | "news"
  | "community"
  | "kol"
  | "market"
  | "onchain"
  | "whale";

export type Direction = "bullish" | "bearish" | "watch";

export type AssetSeed = {
  symbol: string;
  name: string;
  price: string;
  priceChange: string;
  updatedAt: string;
  rule: {
    direction: Direction;
    score: number;
    confidence: string;
    risk: string;
    drivers: string[];
  };
  ai: {
    direction: Direction;
    action: string;
    strength: string;
    confidence: string;
    reasons: string[];
    risks: string[];
  };
  consistency: string;
  signals: Array<{
    type: SignalType;
    label: string;
    direction: Direction;
    score: number;
    confidence: string;
    drivers: string[];
    metrics: Array<{ name: string; value: string }>;
    highlights: Array<{ title: string; href: string }>;
  }>;
  events: Array<{
    time: string;
    type: string;
    title: string;
    summary: string;
    direction: Direction;
  }>;
  alerts: Array<{
    time: string;
    type: string;
    summary: string;
    status: "new" | "sent" | "archived";
  }>;
};

export type RuleTemplate = "aggressive" | "conservative" | "default" | "custom";

export type RuleConfig = {
  template: RuleTemplate;
  weights: Array<{ type: SignalType; label: string; value: number }>;
};

export type SourceConfigSeed = {
  key: string;
  type: string;
  source: string;
  status: string;
  coverage: string;
};

export const baseAssets: AssetSeed[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    price: "$68,234",
    priceChange: "+2.4%",
    updatedAt: "2026-03-25T11:00:00Z",
    rule: {
      direction: "bullish",
      score: 72,
      confidence: "medium",
      risk: "中高",
      drivers: ["市场动量走强", "交易所流入流出异常放大", "鲸鱼地址持续增持"]
    },
    ai: {
      direction: "bullish",
      action: "可考虑买入",
      strength: "中",
      confidence: "中",
      reasons: ["资金面回暖", "链上资金流改善", "KOL 分歧明显下降"],
      risks: ["短线波动率仍高", "宏观风险偏好尚未完全修复"]
    },
    consistency: "规则与 AI 基本一致",
    signals: [
      {
        type: "news",
        label: "新闻信号",
        direction: "bullish",
        score: 18,
        confidence: "medium",
        drivers: ["ETF 相关叙事再升温", "主流媒体情绪回暖"],
        metrics: [
          { name: "高影响新闻", value: "3 条" },
          { name: "情绪倾向", value: "偏多" }
        ],
        highlights: [
          { title: "ETF 叙事再度升温", href: "#" },
          { title: "主流媒体转向偏多表述", href: "#" },
          { title: "宏观预期改善带动市场情绪", href: "#" }
        ]
      },
      {
        type: "community",
        label: "社区信号",
        direction: "watch",
        score: 6,
        confidence: "medium",
        drivers: ["讨论热度升温", "观点分歧仍在"],
        metrics: [
          { name: "热度变化", value: "+14%" },
          { name: "分歧度", value: "中" }
        ],
        highlights: [
          { title: "社区讨论热度连续升高", href: "#" },
          { title: "热点话题从防守转向进攻", href: "#" },
          { title: "分歧主要集中在持续性", href: "#" }
        ]
      },
      {
        type: "kol",
        label: "KOL 信号",
        direction: "bullish",
        score: 14,
        confidence: "medium",
        drivers: ["核心白名单账号偏多增多"],
        metrics: [
          { name: "偏多观点", value: "8 / 12" },
          { name: "一致性", value: "中上" }
        ],
        highlights: [
          { title: "核心白名单账号偏多增多", href: "#" },
          { title: "观点分歧收敛到节奏问题", href: "#" },
          { title: "头部账号转发链上改善信号", href: "#" }
        ]
      },
      {
        type: "market",
        label: "市场信号",
        direction: "bullish",
        score: 31,
        confidence: "high",
        drivers: ["价格突破阶段高点", "成交量同步放大"],
        metrics: [
          { name: "成交量变化", value: "+35%" },
          { name: "资金费率", value: "正向" }
        ],
        highlights: [
          { title: "价格突破阶段高点", href: "#" },
          { title: "成交量与价格同步放大", href: "#" },
          { title: "持仓量继续上升", href: "#" }
        ]
      },
      {
        type: "onchain",
        label: "链上信号",
        direction: "bullish",
        score: 24,
        confidence: "high",
        drivers: ["交易所流出扩大", "稳定币净流入改善"],
        metrics: [
          { name: "交易所净流出", value: "10,500 BTC" },
          { name: "稳定币净流入", value: "$82M" }
        ],
        highlights: [
          { title: "交易所净流出达到阶段高位", href: "#" },
          { title: "稳定币净流入显著改善", href: "#" },
          { title: "活跃地址数继续抬升", href: "#" }
        ]
      },
      {
        type: "whale",
        label: "鲸鱼信号",
        direction: "bullish",
        score: 16,
        confidence: "medium",
        drivers: ["鲸鱼地址 4H 内持续加仓"],
        metrics: [
          { name: "净增持", value: "1,200 BTC" },
          { name: "大额转账", value: "7 笔" }
        ],
        highlights: [
          { title: "鲸鱼地址 4H 内持续加仓", href: "#" },
          { title: "大额转账频率上升", href: "#" },
          { title: "交易所大额提出增加", href: "#" }
        ]
      }
    ],
    events: [
      {
        time: "10:40",
        type: "whale",
        title: "鲸鱼地址加仓 BTC",
        summary: "跟踪地址在 4 小时内累计净增持 1,200 BTC。",
        direction: "bullish"
      }
    ],
    alerts: [
      {
        time: "10:45",
        type: "AI 方向切换",
        summary: "AI 判断由观望切换为偏多。",
        status: "new"
      }
    ]
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    price: "$3,412",
    priceChange: "+1.1%",
    updatedAt: "2026-03-25T11:00:00Z",
    rule: {
      direction: "watch",
      score: 39,
      confidence: "medium",
      risk: "中",
      drivers: ["市场结构改善", "链上活跃度回升", "风险偏好未同步放大"]
    },
    ai: {
      direction: "watch",
      action: "暂不操作",
      strength: "弱",
      confidence: "中",
      reasons: ["偏多线索增多但未形成共振", "趋势延续性待确认"],
      risks: ["资金轮动可能回落", "事件驱动不足"]
    },
    consistency: "规则与 AI 一致偏观望",
    signals: [],
    events: [],
    alerts: []
  },
  {
    symbol: "SOL",
    name: "Solana",
    price: "$181.4",
    priceChange: "+3.8%",
    updatedAt: "2026-03-25T11:00:00Z",
    rule: {
      direction: "bullish",
      score: 66,
      confidence: "medium",
      risk: "中高",
      drivers: ["市场强度领先", "社区热度抬升", "大户活跃度增强"]
    },
    ai: {
      direction: "bullish",
      action: "可考虑买入",
      strength: "中",
      confidence: "中",
      reasons: ["价格表现领先", "资金追逐强势资产"],
      risks: ["短期拥挤度偏高", "回撤可能放大"]
    },
    consistency: "AI 略更激进",
    signals: [],
    events: [],
    alerts: []
  },
  {
    symbol: "BNB",
    name: "BNB",
    price: "$611.7",
    priceChange: "+0.8%",
    updatedAt: "2026-03-25T11:00:00Z",
    rule: {
      direction: "watch",
      score: 28,
      confidence: "medium",
      risk: "中",
      drivers: ["趋势中性", "资金面平稳", "事件驱动有限"]
    },
    ai: {
      direction: "watch",
      action: "暂不操作",
      strength: "弱",
      confidence: "中",
      reasons: ["缺乏明显催化", "风险收益比一般"],
      risks: ["突破延续不足"]
    },
    consistency: "规则与 AI 一致偏观望",
    signals: [],
    events: [],
    alerts: []
  },
  {
    symbol: "XRP",
    name: "XRP",
    price: "$0.71",
    priceChange: "-1.2%",
    updatedAt: "2026-03-25T11:00:00Z",
    rule: {
      direction: "bearish",
      score: -41,
      confidence: "medium",
      risk: "中高",
      drivers: ["资金回流不足", "事件情绪转弱", "趋势破位风险抬升"]
    },
    ai: {
      direction: "bearish",
      action: "可考虑卖出",
      strength: "中",
      confidence: "中",
      reasons: ["趋势结构偏弱", "资金与情绪未见修复"],
      risks: ["突发利好可能反抽"]
    },
    consistency: "规则与 AI 一致偏空",
    signals: [],
    events: [],
    alerts: []
  },
  {
    symbol: "DOGE",
    name: "Dogecoin",
    price: "$0.181",
    priceChange: "+5.6%",
    updatedAt: "2026-03-25T11:00:00Z",
    rule: {
      direction: "bullish",
      score: 58,
      confidence: "medium",
      risk: "高",
      drivers: ["社区热度爆发", "价格弹性强", "大额转账频率上升"]
    },
    ai: {
      direction: "watch",
      action: "谨慎观察",
      strength: "弱",
      confidence: "中",
      reasons: ["情绪驱动明显强于基本面", "追高风险较大"],
      risks: ["波动率过高", "热点退潮快"]
    },
    consistency: "AI 相对规则更谨慎",
    signals: [],
    events: [],
    alerts: []
  }
];

export const baseTemplates: Record<RuleTemplate, RuleConfig> = {
  aggressive: {
    template: "aggressive",
    weights: [
      { type: "news", label: "新闻信号", value: 5 },
      { type: "community", label: "社区信号", value: 10 },
      { type: "kol", label: "KOL 信号", value: 10 },
      { type: "market", label: "市场信号", value: 50 },
      { type: "onchain", label: "链上信号", value: 15 },
      { type: "whale", label: "鲸鱼信号", value: 10 }
    ]
  },
  conservative: {
    template: "conservative",
    weights: [
      { type: "news", label: "新闻信号", value: 55 },
      { type: "community", label: "社区信号", value: 10 },
      { type: "kol", label: "KOL 信号", value: 10 },
      { type: "market", label: "市场信号", value: 10 },
      { type: "onchain", label: "链上信号", value: 10 },
      { type: "whale", label: "鲸鱼信号", value: 5 }
    ]
  },
  default: {
    template: "default",
    weights: [
      { type: "news", label: "新闻信号", value: 5 },
      { type: "community", label: "社区信号", value: 30 },
      { type: "kol", label: "KOL 信号", value: 30 },
      { type: "market", label: "市场信号", value: 10 },
      { type: "onchain", label: "链上信号", value: 10 },
      { type: "whale", label: "鲸鱼信号", value: 15 }
    ]
  },
  custom: {
    template: "custom",
    weights: [
      { type: "news", label: "新闻信号", value: 15 },
      { type: "community", label: "社区信号", value: 10 },
      { type: "kol", label: "KOL 信号", value: 10 },
      { type: "market", label: "市场信号", value: 30 },
      { type: "onchain", label: "链上信号", value: 15 },
      { type: "whale", label: "鲸鱼信号", value: 20 }
    ]
  }
};

export const defaultGlobalAiPromptByLocale = {
  "zh-CN":
    "请结合市场结构、新闻事件、链上资金流和鲸鱼交易行为，输出偏多、偏空或观望判断，并用 2-3 条最关键理由解释。",
  "en-US":
    "Assess the asset using market structure, news events, on-chain capital flows, and whale activity. Return a bullish, bearish, or watch stance with 2-3 key reasons."
} as const;

export const defaultGlobalAiPrompt = defaultGlobalAiPromptByLocale["zh-CN"];

export const baseSourceConfigs: SourceConfigSeed[] = [
  {
    key: "news",
    type: "新闻源",
    source: "主流财经 / 加密媒体",
    status: "运行中",
    coverage: "BTC / ETH / SOL / BNB / XRP / DOGE"
  },
  {
    key: "kol-community",
    type: "KOL / 社区",
    source: "白名单 KOL + 重点频道",
    status: "运行中",
    coverage: "按资产映射"
  },
  {
    key: "market",
    type: "市场指标",
    source: "价格 / 成交量 / 资金费率 / 持仓量",
    status: "运行中",
    coverage: "全部首期资产"
  },
  {
    key: "onchain-whale",
    type: "链上 / 大户",
    source: "净流入流出 / 鲸鱼地址 / 大额转账",
    status: "监控中",
    coverage: "BTC / ETH / SOL 为主"
  }
];

export const baseGlobalConfigs = {
  sources: {
    enabledDataSources: "新闻 / KOL / 市场 / 链上 / 大户 / 风险",
    kolWhitelist: "18 个账号",
    whaleWatchlist: "12 个地址"
  },
  onchainWhaleRules: {
    exchangeFlowThreshold: "10,000 BTC / 4H",
    onchainLargeTransferThreshold: "$5M / 1H",
    whaleTradeThreshold: "$5M / 单笔"
  },
  preferences: {
    language: "中文 / English",
    window: "4H",
    notification: "Telegram"
  },
  alertRules: {
    scoreThreshold: ">= 60 / <= -40",
    aiSwitchReminder: "已开启",
    cooldownMinutes: "30 分钟"
  }
} as const;

export const defaultAiConfig = {
  model: "gpt-4.1",
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKeyMasked: "sk-••••••••••••••••",
  connectionStatus: "unchecked"
} as const;
