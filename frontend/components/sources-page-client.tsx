"use client";

import { useState } from "react";
import {
  checkForUpdates,
  testAiConfig,
  testTelegramConfig,
  updateAiConfig,
  updateTelegramConfig
} from "@/lib/api";
import type { Dictionary } from "@/lib/i18n";
import type { LocaleCode } from "@/lib/i18n/config";
import type {
  AiConfigResponse,
  SourceConfig,
  TelegramConfigResponse,
  UpdateStatusResponse
} from "@/lib/api-types";

type SourcesPageClientProps = {
  initialSources: SourceConfig[];
  initialAiConfig: AiConfigResponse;
  initialTelegramConfig: TelegramConfigResponse;
  initialUpdateStatus: UpdateStatusResponse;
  locale: LocaleCode;
  dict: Dictionary;
};

function formatAiConnectionStatus(status: string, dict: Dictionary) {
  if (status === "connected" || status === "ok") {
    return dict.common.statusConnected;
  }

  if (status === "error" || status === "missing_api_key") {
    return dict.common.statusDisconnected;
  }

  if (status === "unchecked") {
    return dict.common.statusUnchecked;
  }

  return status || dict.common.statusUnknown;
}

function formatTelegramConnectionStatus(status: string, dict: Dictionary) {
  if (status === "connected" || status === "ok") {
    return dict.common.statusConnected;
  }

  if (status === "error" || status === "missing_config") {
    return dict.common.statusDisconnected;
  }

  if (status === "unchecked") {
    return dict.common.statusUnchecked;
  }

  return status || dict.common.statusUnknown;
}

function formatTestFailure(prefix: string, result: { statusCode?: number; message?: string }, dict: Dictionary) {
  const parts = [`${prefix} ${dict.management.testFailureSuffix}`];

  if (typeof result.statusCode === "number") {
    parts.push(`${dict.management.statusCode} ${result.statusCode}`);
  }

  if (result.message) {
    parts.push(result.message);
  }

  return parts.join("，");
}

function formatSourceType(type: string, locale: LocaleCode) {
  if (locale !== "en-US") {
    return type;
  }

  switch (type.trim()) {
    case "新闻源":
      return "News Sources";
    case "KOL / 社区":
      return "KOL / Community";
    case "市场指标":
      return "Market Metrics";
    case "链上 / 大户":
      return "On-chain / Whales";
    default:
      return type;
  }
}

function formatSourceStatus(status: string, locale: LocaleCode) {
  if (locale !== "en-US") {
    return status;
  }

  switch (status.trim()) {
    case "运行中":
      return "Running";
    case "监控中":
      return "Monitoring";
    default:
      return status;
  }
}

function formatSourceLabel(value: string, locale: LocaleCode) {
  if (locale !== "en-US") {
    return value;
  }

  const exactMap: Record<string, string> = {
    "白名单 KOL + 重点频道": "Whitelisted KOLs + priority channels",
    "价格 / 成交量 / 资金费率 / 持仓量": "Price / volume / funding rate / open interest",
    "净流入流出 / 鲸鱼地址 / 大额转账": "Net inflows/outflows / whale addresses / large transfers",
    "主流财经 / 加密媒体": "Mainstream finance / crypto media",
    "按资产映射": "Mapped by asset",
    "全部首期资产": "All launch assets",
    "BTC / ETH / SOL 为主": "Primarily BTC / ETH / SOL",
    "BTC / ETH / SOL / BNB / XRP / DOGE": "BTC / ETH / SOL / BNB / XRP / DOGE"
  };

  return exactMap[value.trim()] ?? value;
}

export function SourcesPageClient({
  initialSources,
  initialAiConfig,
  initialTelegramConfig,
  initialUpdateStatus,
  locale,
  dict
}: SourcesPageClientProps) {
  const [aiConfig, setAiConfig] = useState(initialAiConfig);
  const [telegramConfig, setTelegramConfig] = useState(initialTelegramConfig);
  const [updateStatus, setUpdateStatus] = useState(initialUpdateStatus);
  const [isEditingAi, setIsEditingAi] = useState(false);
  const [isEditingTelegram, setIsEditingTelegram] = useState(false);
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [telegramMessage, setTelegramMessage] = useState<string | null>(null);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState({
    model: initialAiConfig.model,
    baseUrl: initialAiConfig.baseUrl,
    apiKey: ""
  });
  const [telegramDraft, setTelegramDraft] = useState({
    botToken: "",
    alertChatId: ""
  });

  async function handleAiSave() {
    setIsSavingAi(true);
    setAiMessage(null);
    setAiError(null);

    try {
      const nextConfig = await updateAiConfig({
        model: aiDraft.model,
        provider: aiConfig.provider,
        baseUrl: aiDraft.baseUrl,
        apiKey: aiDraft.apiKey
      });
      setAiConfig(nextConfig);
      setAiDraft((prev) => ({
        ...prev,
        model: nextConfig.model,
        baseUrl: nextConfig.baseUrl,
        apiKey: ""
      }));
      setIsEditingAi(false);
      setAiMessage(dict.management.aiSaveSuccess);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : dict.management.aiSaveFailed);
    } finally {
      setIsSavingAi(false);
    }
  }

  async function handleAiTest() {
    setIsTestingAi(true);
    setAiMessage(null);
    setAiError(null);

    try {
      const result = await testAiConfig();
      const nextStatus =
        result.connectionStatus === "ok"
          ? "connected"
          : result.connectionStatus;
      setAiConfig((prev) => ({
        ...prev,
        connectionStatus: nextStatus
      }));
      if (result.success) {
        setAiMessage(dict.management.aiTestSuccess);
      } else {
        setAiError(formatTestFailure(dict.common.testConnection, result, dict));
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : dict.management.aiTestFailed);
    } finally {
      setIsTestingAi(false);
    }
  }

  async function handleTelegramSave() {
    setIsSavingTelegram(true);
    setTelegramMessage(null);
    setTelegramError(null);

    try {
      const nextConfig = await updateTelegramConfig({
        notificationChannel: "Telegram",
        botToken: telegramDraft.botToken,
        alertChatId: telegramDraft.alertChatId
      });
      setTelegramConfig(nextConfig);
      setTelegramDraft({
        botToken: "",
        alertChatId: ""
      });
      setIsEditingTelegram(false);
      setTelegramMessage(dict.management.telegramSaveSuccess);
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : dict.management.telegramSaveFailed);
    } finally {
      setIsSavingTelegram(false);
    }
  }

  async function handleTelegramTest() {
    setIsTestingTelegram(true);
    setTelegramMessage(null);
    setTelegramError(null);

    try {
      const result = await testTelegramConfig();
      const nextStatus =
        result.connectionStatus === "ok"
          ? "connected"
          : result.connectionStatus;
      setTelegramConfig((prev) => ({
        ...prev,
        connectionStatus: nextStatus
      }));
      if (result.success) {
        setTelegramMessage(dict.management.telegramTestSuccess);
      } else {
        setTelegramError(formatTestFailure("Telegram " + dict.common.testConnection, result, dict));
      }
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : dict.management.telegramTestFailed);
    } finally {
      setIsTestingTelegram(false);
    }
  }

  async function handleUpdateCheck() {
    setIsCheckingUpdates(true);
    setUpdateError(null);

    try {
      const result = await checkForUpdates();
      setUpdateStatus(result);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("alphapony:update-status", { detail: result }));
      }
      if (result.error) {
        setUpdateError(result.error);
      }
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : dict.management.updateCheckFailed);
    } finally {
      setIsCheckingUpdates(false);
    }
  }

  return (
    <main className="page">
      <div className="stack">
        <div className="management-update-row-wrap">
          <div className="management-update-row">
            <span>{dict.management.version} v{updateStatus.currentVersion}</span>
            {updateStatus.status === "available" && updateStatus.latestVersion ? (
              <span>{dict.management.latestVersion} v{updateStatus.latestVersion}</span>
            ) : null}
            <button
              type="button"
              className="management-update-action"
              onClick={() => void handleUpdateCheck()}
              disabled={isCheckingUpdates}
            >
              {isCheckingUpdates ? dict.management.testing : dict.management.checkForUpdates}
            </button>
          </div>
          {updateError ? <div className="inline-feedback inline-feedback-error">{updateError}</div> : null}
        </div>

        <div className="detail-card">
          <div className="section-header-compact" style={{ marginBottom: 12 }}>
            <strong>{dict.management.aiSettings}</strong>
            <div className="cta-row">
              {!isEditingAi ? (
                <>
                  <button
                    type="button"
                    className="button-secondary strategy-action-button"
                    onClick={() => {
                      setAiMessage(null);
                      setAiError(null);
                      setIsEditingAi(true);
                    }}
                  >
                    {dict.common.edit}
                  </button>
                  <button
                    type="button"
                    className="button-secondary strategy-action-button"
                    onClick={() => void handleAiTest()}
                    disabled={isTestingAi}
                  >
                    {isTestingAi ? dict.management.testing : dict.common.testConnection}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="button-secondary strategy-action-button"
                    onClick={() => {
                      setAiDraft({
                        model: aiConfig.model,
                        baseUrl: aiConfig.baseUrl,
                        apiKey: ""
                      });
                      setAiMessage(null);
                      setAiError(null);
                      setIsEditingAi(false);
                    }}
                    disabled={isSavingAi}
                  >
                    {dict.common.cancel}
                  </button>
                  <button
                    type="button"
                    className="button strategy-action-button"
                    onClick={() => void handleAiSave()}
                    disabled={isSavingAi}
                  >
                    {isSavingAi ? dict.common.loading : dict.common.save}
                  </button>
                </>
              )}
            </div>
          </div>
          {aiMessage ? <div className="inline-feedback inline-feedback-success">{aiMessage}</div> : null}
          {aiError ? <div className="inline-feedback inline-feedback-error">{aiError}</div> : null}
          <div className="control-grid">
            <div className="control-row">
              <span>{dict.management.defaultModel}</span>
              {isEditingAi ? (
                <input
                  className="strategy-inline-input"
                  value={aiDraft.model}
                  onChange={(event) => setAiDraft((prev) => ({ ...prev, model: event.target.value }))}
                />
              ) : (
                <strong>{aiConfig.model}</strong>
              )}
            </div>
            <div className="control-row">
              <span>{dict.management.apiBaseUrl}</span>
              {isEditingAi ? (
                <input
                  className="strategy-inline-input"
                  value={aiDraft.baseUrl}
                  onChange={(event) => setAiDraft((prev) => ({ ...prev, baseUrl: event.target.value }))}
                />
              ) : (
                <strong>{aiConfig.baseUrl}</strong>
              )}
            </div>
            <div className="control-row" style={{ alignItems: "flex-start" }}>
              <span>{dict.management.apiKey}</span>
              {isEditingAi ? (
                <div style={{ width: "min(320px, 100%)" }}>
                  <input
                    type="password"
                    className="strategy-inline-input"
                    style={{ width: "100%" }}
                    value={aiDraft.apiKey}
                    placeholder={aiConfig.apiKeyMasked}
                    onChange={(event) => setAiDraft((prev) => ({ ...prev, apiKey: event.target.value }))}
                  />
                  <div className="section-subtitle" style={{ marginTop: 8 }}>
                    {dict.management.keepCurrentApiKey}
                  </div>
                </div>
              ) : (
                <strong>{aiConfig.apiKeyMasked}</strong>
              )}
            </div>
            <div className="control-row">
              <span>{dict.management.connectionStatus}</span>
              <strong>{formatAiConnectionStatus(aiConfig.connectionStatus, dict)}</strong>
            </div>
          </div>
        </div>

        <div className="detail-card">
          <div className="section-header-compact" style={{ marginBottom: 12 }}>
            <strong>{dict.management.telegramSettings}</strong>
            <div className="cta-row">
              {!isEditingTelegram ? (
                <>
                  <button
                    type="button"
                    className="button-secondary strategy-action-button"
                    onClick={() => {
                      setTelegramMessage(null);
                      setTelegramError(null);
                      setIsEditingTelegram(true);
                    }}
                  >
                    {dict.common.edit}
                  </button>
                  <button
                    type="button"
                    className="button-secondary strategy-action-button"
                    onClick={() => void handleTelegramTest()}
                    disabled={isTestingTelegram}
                  >
                    {isTestingTelegram ? dict.management.testing : dict.common.testConnection}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="button-secondary strategy-action-button"
                    onClick={() => {
                      setTelegramDraft({
                        botToken: "",
                        alertChatId: ""
                      });
                      setTelegramMessage(null);
                      setTelegramError(null);
                      setIsEditingTelegram(false);
                    }}
                    disabled={isSavingTelegram}
                  >
                    {dict.common.cancel}
                  </button>
                  <button
                    type="button"
                    className="button strategy-action-button"
                    onClick={() => void handleTelegramSave()}
                    disabled={isSavingTelegram}
                  >
                    {isSavingTelegram ? dict.common.loading : dict.common.save}
                  </button>
                </>
              )}
            </div>
          </div>
          {telegramMessage ? <div className="inline-feedback inline-feedback-success">{telegramMessage}</div> : null}
          {telegramError ? <div className="inline-feedback inline-feedback-error">{telegramError}</div> : null}
          <div className="control-grid">
            <div className="control-row" style={{ alignItems: "flex-start" }}>
              <span>{dict.management.botToken}</span>
              {isEditingTelegram ? (
                <div style={{ width: "min(320px, 100%)" }}>
                  <input
                    type="password"
                    className="strategy-inline-input"
                    style={{ width: "100%" }}
                    value={telegramDraft.botToken}
                    placeholder={telegramConfig.botTokenMasked}
                    onChange={(event) =>
                      setTelegramDraft((prev) => ({ ...prev, botToken: event.target.value }))
                    }
                  />
                  <div className="section-subtitle" style={{ marginTop: 8 }}>
                    {dict.management.keepCurrentBotToken}
                  </div>
                </div>
              ) : (
                <strong>{telegramConfig.botTokenMasked}</strong>
              )}
            </div>
            <div className="control-row" style={{ alignItems: "flex-start" }}>
              <span>{dict.management.alertChatId}</span>
              {isEditingTelegram ? (
                <div style={{ width: "min(320px, 100%)" }}>
                  <input
                    className="strategy-inline-input"
                    style={{ width: "100%" }}
                    value={telegramDraft.alertChatId}
                    placeholder={telegramConfig.alertChatIdMasked}
                    onChange={(event) =>
                      setTelegramDraft((prev) => ({ ...prev, alertChatId: event.target.value }))
                    }
                  />
                  <div className="section-subtitle" style={{ marginTop: 8 }}>
                    {dict.management.keepCurrentAlertChatId}
                  </div>
                </div>
              ) : (
                <strong>{telegramConfig.alertChatIdMasked}</strong>
              )}
            </div>
            <div className="control-row">
              <span>{dict.management.connectionStatus}</span>
              <strong>{formatTelegramConnectionStatus(telegramConfig.connectionStatus, dict)}</strong>
            </div>
          </div>
        </div>

        <div className="detail-card">
          <div className="section-header-compact" style={{ marginBottom: 8 }}>
            <strong>{dict.management.dataSources}</strong>
          </div>
          <div className="stack">
            {initialSources.map((row) => (
              <div key={row.key} className="detail-card">
                <div className="detail-row">
                  <span>{dict.management.type}</span>
                  <strong>{formatSourceType(row.type, locale)}</strong>
                </div>
                <div className="detail-row">
                  <span>{dict.management.status}</span>
                  <span>{formatSourceStatus(row.status, locale)}</span>
                </div>
                <div className="detail-row">
                  <span>{dict.management.source}</span>
                  <strong>{formatSourceLabel(row.source, locale)}</strong>
                </div>
                <div className="detail-row">
                  <span>{dict.management.coverage}</span>
                  <strong>{formatSourceLabel(row.coverage, locale)}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
