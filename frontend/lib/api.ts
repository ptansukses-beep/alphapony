import type {
  AiConfigResponse,
  AlertsResponse,
  AssetDetail,
  DashboardAssetsResponse,
  SourceConfig,
  SourcesResponse,
  TelegramConfigResponse,
  TimelineResponse,
  StrategyConfigResponse,
  UpdateStatusResponse
} from "@/lib/api-types";

function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";
  }

  return process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? "8000");
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      },
      cache: "no-store",
      signal: controller.signal
    });
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") {
      throw new Error(`API request timed out after ${timeoutMs}ms: ${path}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let details = "";

    try {
      details = await response.text();
    } catch {
      details = "";
    }

    throw new Error(
      details || `API request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

export function getDashboardAssets() {
  return request<DashboardAssetsResponse>("/api/dashboard/assets");
}

export function getAssetDetail(symbol: string) {
  return request<AssetDetail>(`/api/assets/${symbol}/detail`);
}

export function recomputeAssetAi(symbol: string) {
  return request<{
    skipped: boolean;
    symbol: string;
    direction?: string;
    biasLevel?: string;
    score?: number;
    action?: string;
    confidence?: string;
    summary?: string;
    updatedAt?: string;
    basedOnSnapshotAt?: string;
  }>(`/api/assets/${symbol}/ai/recompute`, {
    method: "POST"
  });
}

export function getStrategyConfig(symbol: string) {
  return request<StrategyConfigResponse>(`/api/strategy/config?symbol=${symbol}`);
}

export function updateRuleTemplate(symbol: string, template: string) {
  return request<StrategyConfigResponse>("/api/strategy/rule-template", {
    method: "PUT",
    body: JSON.stringify({ symbol, template })
  });
}

export function updateRuleWeights(
  symbol: string,
  weights: Array<{ type: string; label: string; value: number }>
) {
  return request<StrategyConfigResponse>("/api/strategy/rule-weights", {
    method: "PUT",
    body: JSON.stringify({ symbol, weights })
  });
}

export function updatePrompt(promptText: string) {
  return request<{ scope: "global"; promptText: string }>("/api/strategy/prompt", {
    method: "PUT",
    body: JSON.stringify({ promptText })
  });
}

export function updateGlobalConfig(section: string, config: Record<string, string>) {
  return request<{ section: string; config: Record<string, string> }>(`/api/strategy/global/${section}`, {
    method: "PUT",
    body: JSON.stringify({ config })
  });
}

export function getSources() {
  return request<SourcesResponse>("/api/management/sources");
}

export function updateSource(
  key: string,
  payload: { source?: string; status?: string; coverage?: string }
) {
  return request<SourceConfig>(`/api/management/sources/${key}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function getAiConfig() {
  return request<AiConfigResponse>("/api/management/ai-config");
}

export function getTelegramConfig() {
  return request<TelegramConfigResponse>("/api/management/telegram-config");
}

export function getUpdateStatus() {
  return request<UpdateStatusResponse>("/api/management/update-status");
}

export function checkForUpdates() {
  return request<UpdateStatusResponse>("/api/management/update-status/check", {
    method: "POST"
  });
}

export function updateTelegramConfig(payload: {
  notificationChannel: string;
  botToken: string;
  alertChatId: string;
}) {
  return request<TelegramConfigResponse>("/api/management/telegram-config", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function updateLanguagePreference(language: string) {
  return request<{ language: string }>("/api/management/preferences/language", {
    method: "PUT",
    body: JSON.stringify({ language })
  });
}

export function testTelegramConfig() {
  return request<{ success: boolean; connectionStatus: string; statusCode?: number; message?: string }>(
    "/api/management/telegram-config/test",
    {
      method: "POST"
    }
  );
}

export function updateAiConfig(payload: {
  model: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
}) {
  return request<AiConfigResponse>("/api/management/ai-config", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function testAiConfig() {
  return request<{ success: boolean; connectionStatus: string; statusCode?: number; message?: string }>(
    "/api/management/ai-config/test",
    {
      method: "POST"
    }
  );
}

export function getAlerts(limit?: number, offset?: number) {
  const params = new URLSearchParams();
  if (typeof limit === "number") {
    params.set("limit", String(limit));
  }
  if (typeof offset === "number" && offset > 0) {
    params.set("offset", String(offset));
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return request<AlertsResponse>(`/api/alerts${query}`);
}

export function getAssetTimeline(symbol: string, signal?: string, limit?: number, offset?: number) {
  const params = new URLSearchParams();
  if (signal) {
    params.set("signal", signal);
  }
  if (typeof limit === "number") {
    params.set("limit", String(limit));
  }
  if (typeof offset === "number" && offset > 0) {
    params.set("offset", String(offset));
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return request<TimelineResponse>(`/api/assets/${symbol}/timeline${query}`);
}
