export type Direction = "bullish" | "bearish" | "watch";
export type BiasLevel =
  | "super_bearish"
  | "strong_bearish"
  | "weak_bearish"
  | "watch"
  | "weak_bullish"
  | "strong_bullish"
  | "super_bullish";

export type SignalMetric = {
  name: string;
  value: string;
  nameKey?: string;
  valueKey?: string;
  valueParams?: Record<string, string | number>;
};

export type SignalHighlight = {
  title: string;
  href: string;
  publishedAt?: string;
  score?: number;
  titleKey?: string;
  titleParams?: Record<string, string | number>;
};

export type SignalItem = {
  type: string;
  label: string;
  labelKey?: string;
  direction: Direction;
  biasLevel?: BiasLevel;
  score: number;
  weight?: number;
  weightedScore?: number;
  confidence: string;
  confidenceKey?: "high" | "medium" | "low";
  drivers: string[];
  driverItems?: Array<{
    textKey: string;
    textParams?: Record<string, string | number>;
  } | null>;
  metrics: SignalMetric[];
  highlights: SignalHighlight[];
};

export type DashboardSignal = {
  type: string;
  score: number;
  weightedScore?: number;
  direction: Direction;
  biasLevel?: BiasLevel;
};

export type DashboardAsset = {
  symbol: string;
  name: string;
  price: string;
  priceChange: string;
  ruleScore: number;
  ruleDirection: Direction;
  aiDirection?: Direction;
  aiScore?: number;
  aiBiasLevel?: BiasLevel;
  aiAvailable: boolean;
  signalScores: DashboardSignal[];
  briefNote: string;
  briefNoteItem?: {
    textKey: string;
    textParams?: Record<string, string | number>;
  } | null;
};

export type DashboardAssetsResponse = {
  updatedAt: string;
  items: DashboardAsset[];
};

export type AssetDetail = {
  symbol: string;
  name: string;
  price: string;
  priceChange: string;
  window?: string;
  rule: {
    direction: Direction;
    score: number;
    confidence: string;
    confidenceKey?: "high" | "medium" | "low";
    risk: string;
    riskKey?: "high" | "medium_high" | "medium";
    drivers: string[];
    driverItems?: Array<{
      textKey: string;
      textParams?: Record<string, string | number>;
    } | null>;
  };
  ai: {
    available: boolean;
    direction?: Direction;
    biasLevel?: BiasLevel;
    score?: number;
    action?: string;
    actionKey?: string;
    strength?: string;
    strengthKey?: "high" | "medium" | "low";
    confidence?: string;
    confidenceKey?: "high" | "medium" | "low";
    summary?: string;
    reasons: string[];
    risks: string[];
    localizedText?: {
      sourceLocale: "zh-CN" | "en-US";
      availableLocales: Array<"zh-CN" | "en-US">;
      summaryByLocale: Partial<Record<"zh-CN" | "en-US", string>>;
      reasonsByLocale: Partial<Record<"zh-CN" | "en-US", string[]>>;
      risksByLocale: Partial<Record<"zh-CN" | "en-US", string[]>>;
    };
    updatedAt?: string;
    basedOnSnapshotAt?: string;
  };
  consistency: string;
  consistencyKey?: string;
  consistencyItems?: Array<{
    textKey: string;
    textParams?: Record<string, string | number>;
  }>;
  signals: SignalItem[];
  events: Array<{
    time: string;
    type: string;
    typeKey?: string;
    title: string;
    titleKey?: string;
    titleParams?: Record<string, string | number>;
    summary?: string;
    summaryItems?: Array<{
      textKey: string;
      textParams?: Record<string, string | number>;
    } | null>;
    direction: Direction;
    href?: string;
    score?: number;
  }>;
  latestSignalStates?: Array<{
    signalType: string;
    direction: Direction;
    biasLevel: BiasLevel;
    score: number;
    confidence: string;
    drivers: string[];
    driverItems?: Array<{
      textKey: string;
      textParams?: Record<string, string | number>;
    } | null>;
    metrics: SignalMetric[];
    updatedAt: string;
    lastChangedAt: string;
  }>;
  alerts: Array<{
    time: string;
    type: string;
    summary: string;
    status: string;
    typeKey?: string;
    summaryKey?: string;
    summaryParams?: Record<string, string | number | boolean | null>;
  }>;
};

export type RuleTemplate = "aggressive" | "conservative" | "default" | "custom";

export type StrategyConfigResponse = {
  symbol: string;
  ruleStrategy: {
    template: RuleTemplate;
    weights: Array<{
      type: string;
      label: string;
      value: number;
    }>;
  };
  promptStrategy: {
    scope: "global";
    promptText: string;
    systemPromptText: string;
    promptTextByLocale: Record<"zh-CN" | "en-US", string>;
    systemPromptTextByLocale: Record<"zh-CN" | "en-US", string>;
  };
  globalConfigs: {
    sources: Record<string, string>;
    onchainWhaleRules: Record<string, string>;
    preferences: Record<string, string>;
    alertRules: Record<string, string>;
  };
  preview: {
    ruleScore: number;
    ruleDirection: Direction;
    aiDirection: Direction;
    signalScores: DashboardSignal[];
  };
};

export type SourceConfig = {
  key: string;
  type: string;
  source: string;
  status: string;
  coverage: string;
};

export type SourcesResponse = {
  items: SourceConfig[];
};

export type AiConfigResponse = {
  model: string;
  provider: string;
  baseUrl: string;
  apiKeyMasked: string;
  connectionStatus: string;
};

export type TelegramConfigResponse = {
  botTokenMasked: string;
  alertChatIdMasked: string;
  notificationChannel: string;
  alertsEnabled: boolean;
  connectionStatus: string;
};

export type UpdateStatusResponse = {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  status: "not_configured" | "up_to_date" | "available" | "failed" | "checking";
  lastCheckedAt: string | null;
  error: string | null;
};

export type AlertsResponse = {
  total: number;
  items: Array<{
    id: string;
    asset: string;
    type: string;
    summary: string;
    status: string;
    timestamp: string;
    typeKey?: string;
    summaryKey?: string;
    severity?: "high" | "medium" | "low";
    summaryParams?: Record<string, string | number | boolean | null>;
  }>;
};

export type TimelineResponse = {
  symbol: string;
  signalType: string | null;
  total: number;
  items: Array<{
    time: string;
    assetSymbol: string;
    assetName: string;
    type: string;
    typeKey?: string;
    title: string;
    titleKey?: string;
    titleParams?: Record<string, string | number>;
    summary?: string;
    summaryItems?: Array<{
      textKey: string;
      textParams?: Record<string, string | number>;
    } | null>;
    direction: Direction;
    href?: string;
    score?: number;
  }>;
};
