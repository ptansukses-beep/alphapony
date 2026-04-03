"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/lib/i18n";
import type { Direction, RuleTemplate, StrategyConfigResponse } from "@/lib/api-types";
import { ASSET_OPTIONS, type AssetSymbol } from "@/lib/constants";
import { getStrategyConfig, updateGlobalConfig, updateRuleTemplate, updateRuleWeights } from "@/lib/api";
import { aiToBiasLevel, biasLevelClassName, biasLevelLabel, directionClassName, scoreToBiasLevel, signalAbbreviation, signalLabel, sortSignalsForDisplay } from "@/lib/format";

type StrategyPageClientProps = {
  initialConfig: StrategyConfigResponse;
  locale: "zh-CN" | "en-US";
  dict: Dictionary;
};

function directionScoreClass(direction: Direction) {
  return directionClassName(direction);
}

export function StrategyPageClient({ initialConfig, locale, dict }: StrategyPageClientProps) {
  const router = useRouter();
  const [activeSymbol, setActiveSymbol] = useState<AssetSymbol>(initialConfig.symbol as AssetSymbol);
  const [config, setConfig] = useState(initialConfig);
  const [isSystemPromptExpanded, setIsSystemPromptExpanded] = useState(false);
  const [draftRuleTemplate, setDraftRuleTemplate] = useState<RuleTemplate>(initialConfig.ruleStrategy.template);
  const [draftRuleWeights, setDraftRuleWeights] = useState(initialConfig.ruleStrategy.weights);
  const [isEditingCustomWeights, setIsEditingCustomWeights] = useState(false);
  const [isSavingRuleStrategy, setIsSavingRuleStrategy] = useState(false);
  const [editingGlobalSection, setEditingGlobalSection] = useState<string | null>(null);
  const [draftGlobalConfig, setDraftGlobalConfig] = useState(initialConfig.globalConfigs);
  const [savingGlobalSection, setSavingGlobalSection] = useState<string | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const templateLabelMap: Record<RuleTemplate, string> = {
    aggressive: dict.strategy.templateMarket,
    conservative: dict.strategy.templateNews,
    default: dict.strategy.templateCommunityKol,
    custom: dict.strategy.templateCustom
  };

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      setIsLoadingConfig(true);
      setErrorMessage(null);

      try {
        const nextConfig = await getStrategyConfig(activeSymbol);

        if (cancelled) {
          return;
        }

        setConfig(nextConfig);
        setIsSystemPromptExpanded(false);
        setDraftRuleTemplate(nextConfig.ruleStrategy.template);
        setDraftRuleWeights(nextConfig.ruleStrategy.weights);
        setIsEditingCustomWeights(false);
        setDraftGlobalConfig(nextConfig.globalConfigs);
        setEditingGlobalSection(null);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : dict.strategy.loadConfigFailed);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConfig(false);
        }
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, [activeSymbol]);

  const activeAsset = useMemo(
    () => ASSET_OPTIONS.find((asset) => asset.symbol === activeSymbol) ?? ASSET_OPTIONS[0],
    [activeSymbol]
  );
  const previewRuleBiasLevel = scoreToBiasLevel(config.preview.ruleScore);
  const previewAiBiasLevel = aiToBiasLevel(config.preview.aiDirection);
  const systemPromptText =
    config.promptStrategy.systemPromptTextByLocale?.[locale]
    ?? config.promptStrategy.systemPromptText;
  const normalizedDraftWeights = useMemo(() => {
    const total = draftRuleWeights.reduce((sum, item) => sum + Math.max(0, Number(item.value) || 0), 0);

    if (total <= 0) {
      return draftRuleWeights.map((item) => ({ ...item, normalizedValue: 0 }));
    }

    let remaining = 100;
    return draftRuleWeights.map((item, index) => {
      const baseValue = Math.max(0, Number(item.value) || 0);
      const normalizedValue = index === draftRuleWeights.length - 1
        ? remaining
        : Math.round((baseValue / total) * 100);
      remaining -= normalizedValue;

      return {
        ...item,
        normalizedValue
      };
    });
  }, [draftRuleWeights]);
  const isCustomEditing = draftRuleTemplate === "custom" && isEditingCustomWeights;
  const hasPendingCustomWeightChanges = useMemo(() => {
    if (!isCustomEditing) {
      return false;
    }

    const savedWeights = JSON.stringify(config.ruleStrategy.weights);
    const draftWeights = JSON.stringify(draftRuleWeights);
    return savedWeights !== draftWeights;
  }, [config.ruleStrategy.weights, draftRuleWeights, isCustomEditing]);

  function syncConfig(nextConfig: StrategyConfigResponse) {
    setConfig(nextConfig);
    setDraftRuleTemplate(nextConfig.ruleStrategy.template);
    setDraftRuleWeights(nextConfig.ruleStrategy.weights);
    setIsEditingCustomWeights(false);
    setDraftGlobalConfig(nextConfig.globalConfigs);
  }

  async function handleRuleStrategySave() {
    setIsSavingRuleStrategy(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const nextConfig = await updateRuleWeights(activeSymbol, draftRuleWeights);
      syncConfig(nextConfig);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dict.strategy.saveWeightsFailed);
    } finally {
      setIsSavingRuleStrategy(false);
    }
  }

  async function handlePresetTemplateChange(template: Exclude<RuleTemplate, "custom">) {
    setIsSavingRuleStrategy(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const nextConfig = await updateRuleTemplate(activeSymbol, template);
      syncConfig(nextConfig);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dict.strategy.switchTemplateFailed);
    } finally {
      setIsSavingRuleStrategy(false);
    }
  }

  function startGlobalEdit(section: keyof StrategyConfigResponse["globalConfigs"]) {
    setDraftGlobalConfig(config.globalConfigs);
    setEditingGlobalSection(section);
  }

  async function handleGlobalSave(section: keyof StrategyConfigResponse["globalConfigs"]) {
    setSavingGlobalSection(section);
    setErrorMessage(null);

    try {
      const updated = await updateGlobalConfig(section, draftGlobalConfig[section]);
      setConfig((prev) => ({
        ...prev,
        globalConfigs: {
          ...prev.globalConfigs,
          [section]: updated.config
        }
      }));
      setEditingGlobalSection(null);
      setFeedbackMessage(dict.strategy.globalConfigSaved);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dict.strategy.globalConfigSaveFailed);
    } finally {
      setSavingGlobalSection(null);
    }
  }

  function renderConfigRows(
    section: keyof StrategyConfigResponse["globalConfigs"],
    labels: Array<{ key: string; label: string }>
  ) {
    const isEditing = editingGlobalSection === section;
    const values = (isEditing ? draftGlobalConfig : config.globalConfigs)[section];

    return (
      <>
        <div className="section-header-compact">
          <h3 style={{ margin: 0 }}>
            {section === "sources"
              ? dict.strategy.dataSourcesWatchlist
              : section === "onchainWhaleRules"
                ? dict.strategy.onchainWhaleRules
                : section === "preferences"
                  ? dict.strategy.preferences
                  : dict.strategy.alertRules}
          </h3>
          {isEditing ? (
            <div className="cta-row">
              <button
                type="button"
                className="text-link-subtle text-button strategy-inline-edit"
                onClick={() => {
                  setDraftGlobalConfig(config.globalConfigs);
                  setEditingGlobalSection(null);
                }}
              >
                {dict.common.cancel}
              </button>
              <button
                type="button"
                className="text-link-subtle text-button strategy-inline-edit"
                onClick={() => void handleGlobalSave(section)}
                disabled={savingGlobalSection === section}
              >
                {dict.common.save}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="text-link-subtle text-button strategy-inline-edit"
              onClick={() => startGlobalEdit(section)}
            >
              {dict.common.edit}
            </button>
          )}
        </div>
        <div className="control-grid">
          {labels.map((item) => (
            <div key={item.key} className="control-row">
              <span>{item.label}</span>
              {isEditing ? (
                <input
                  className="strategy-inline-input"
                  value={values[item.key] ?? ""}
                  onChange={(event) =>
                    setDraftGlobalConfig((prev) => ({
                      ...prev,
                      [section]: {
                        ...prev[section],
                        [item.key]: event.target.value
                      }
                    }))
                  }
                />
              ) : (
                <strong>{values[item.key]}</strong>
              )}
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <main className="page">
      <section className="panel section">
        <div className="section-header-compact">
          <div>
            <h1 className="page-title">{dict.strategy.title}</h1>
            <p className="page-subtitle">{dict.strategy.subtitle}</p>
          </div>
        </div>
        <div className="strategy-layout">
          <div className="workbench-shell">
            {feedbackMessage ? <div className="inline-feedback inline-feedback-success">{feedbackMessage}</div> : null}
            {errorMessage ? <div className="inline-feedback inline-feedback-error">{errorMessage}</div> : null}
            <div className="strategy-block strategy-switcher-block">
              <div className="section-header-compact" style={{ marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{dict.strategy.currentAsset}</h3>
                </div>
                {isLoadingConfig ? <span className="text-link-subtle">{dict.common.loading}</span> : null}
              </div>
              <div className="asset-tabs">
                {ASSET_OPTIONS.map((asset) => (
                  <button
                    key={asset.symbol}
                    type="button"
                    className={asset.symbol === activeSymbol ? "asset-tab-active" : "asset-tab"}
                    onClick={() => {
                      setFeedbackMessage(null);
                      setActiveSymbol(asset.symbol);
                    }}
                    aria-pressed={asset.symbol === activeSymbol}
                    disabled={isLoadingConfig}
                  >
                    {asset.symbol}
                  </button>
                ))}
              </div>
            </div>

              <div className="strategy-main-grid">
              <div className="strategy-block strategy-equal-card">
                <div className="section-header">
                  <div>
                    <h3 style={{ margin: 0 }}>{dict.strategy.signalWeightTitle}</h3>
                    <p className="section-subtitle">{dict.strategy.signalWeightSubtitle}</p>
                  </div>
                </div>
                <div className="asset-tabs" style={{ marginBottom: 14 }}>
                  {(Object.keys(templateLabelMap) as RuleTemplate[]).map((template) => (
                    <button
                      key={template}
                      type="button"
                      className={draftRuleTemplate === template ? "asset-tab-active" : "asset-tab"}
                      onClick={() => {
                        setFeedbackMessage(null);
                        if (template === "custom") {
                          setDraftRuleTemplate("custom");
                          setDraftRuleWeights(config.ruleStrategy.template === "custom" ? config.ruleStrategy.weights : config.ruleStrategy.weights);
                          setIsEditingCustomWeights(true);
                          return;
                        }

                        setIsEditingCustomWeights(false);
                        void handlePresetTemplateChange(template);
                      }}
                      disabled={isSavingRuleStrategy}
                    >
                      {templateLabelMap[template]}
                    </button>
                  ))}
                </div>
                <div className="strategy-template-line">
                  <span className="editor-badge">
                    {dict.strategy.savedTemplate} {templateLabelMap[config.ruleStrategy.template]}
                  </span>
                  {isCustomEditing ? (
                    <span className="text-link-subtle">
                      {dict.strategy.editingCustom}
                    </span>
                  ) : null}
                </div>
                <div className="control-grid">
                  {(draftRuleTemplate === "custom" ? normalizedDraftWeights : draftRuleWeights.map((item) => ({ ...item, normalizedValue: item.value }))).map((weight) => (
                    <div key={weight.type} className="control-row">
                      <span className="strategy-weight-label">
                        <span>{signalLabel(weight.type, locale, weight.label)}</span>
                      </span>
                      <div className="strategy-weight-control">
                        {draftRuleTemplate === "custom" ? (
                          <>
                            <input
                              type="number"
                              min={0}
                              className="strategy-inline-input strategy-weight-input"
                              value={draftRuleWeights.find((item) => item.type === weight.type)?.value ?? 0}
                              onChange={(event) => {
                                const nextValue = Number(event.target.value);
                                setDraftRuleWeights((prev) =>
                                  prev.map((item) =>
                                    item.type === weight.type
                                      ? {
                                          ...item,
                                          value: Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0
                                        }
                                      : item
                                  )
                                );
                              }}
                            />
                            <strong className="strategy-weight-value">{weight.normalizedValue}%</strong>
                          </>
                        ) : (
                          <>
                            <div className="weight-bar">
                              <div
                                className="weight-fill"
                                style={{ width: `${weight.value}%` }}
                              />
                            </div>
                            <strong className="strategy-weight-value">{weight.value}%</strong>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {draftRuleTemplate === "custom" ? (
                  <>
                    <p className="section-subtitle" style={{ marginTop: 10 }}>
                      {dict.strategy.relativeWeightHint}
                    </p>
                    <div className="cta-row" style={{ marginTop: 14 }}>
                      <button
                        type="button"
                        className="button-secondary strategy-action-button"
                        onClick={() => {
                          setDraftRuleTemplate(config.ruleStrategy.template);
                          setDraftRuleWeights(config.ruleStrategy.weights);
                          setIsEditingCustomWeights(false);
                        }}
                        disabled={isSavingRuleStrategy}
                      >
                        {dict.common.cancel}
                      </button>
                      <button
                        type="button"
                        className="button strategy-action-button"
                        onClick={() => void handleRuleStrategySave()}
                        disabled={!hasPendingCustomWeightChanges || isSavingRuleStrategy}
                      >
                        {isSavingRuleStrategy ? dict.common.loading : dict.common.save}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="workbench-preview strategy-equal-card">
                <div className="kicker">{dict.strategy.previewTitle}</div>
                <h3 style={{ margin: "8px 0 12px" }}>
                  {activeAsset.symbol} · {activeAsset.name}
                </h3>
                <div className="control-grid">
                  <div className="control-row">
                    <span>{dict.strategy.currentTemplate}</span>
                    <strong>{templateLabelMap[config.ruleStrategy.template]}</strong>
                  </div>
                  <div className="control-row">
                    <span>{dict.strategy.ruleComposite}</span>
                    <strong className={biasLevelClassName(previewRuleBiasLevel)}>
                      {config.preview.ruleScore > 0
                        ? `+${config.preview.ruleScore}`
                        : config.preview.ruleScore}
                    </strong>
                  </div>
                  <div className="control-row">
                    <span>{dict.strategy.ruleDirection}</span>
                    <strong className={biasLevelClassName(previewRuleBiasLevel)}>
                      {biasLevelLabel(previewRuleBiasLevel, locale)}
                    </strong>
                  </div>
                  <div className="control-row">
                    <span>{dict.home.aiDecision}</span>
                    <strong className={biasLevelClassName(previewAiBiasLevel)}>
                      {biasLevelLabel(previewAiBiasLevel, locale)}
                    </strong>
                  </div>
                </div>
                <div className="strategy-preview-signals">
                  <div className="score-label">{dict.strategy.signalDistribution}</div>
                  <div className="mini-signal-grid">
                    {sortSignalsForDisplay(config.preview.signalScores).map((signal) => (
                      <div key={signal.type} className="mini-signal">
                        <span
                          className={`mini-signal-label ${biasLevelClassName(signal.biasLevel)}`}
                        >
                          {signalAbbreviation(signal.type, locale)}
                        </span>
                        <span
                          className={`mini-signal-score ${biasLevelClassName(signal.biasLevel)}`}
                        >
                          {(signal.weightedScore ?? signal.score) > 0
                            ? `+${signal.weightedScore ?? signal.score}`
                            : signal.weightedScore ?? signal.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

              <div className="strategy-block">
                <div className="section-header">
                  <div>
                  <h3 style={{ margin: 0 }}>{dict.strategy.promptTitle}</h3>
                  <p className="section-subtitle">{dict.strategy.promptSubtitle}</p>
                  </div>
                </div>
                <div className="strategy-prompt-section">
                <div className="score-label">{dict.strategy.systemPrompt}</div>
                <div className={isSystemPromptExpanded ? "strategy-prompt-plain strategy-prompt-plain-expanded" : "strategy-prompt-plain"}>
                  {systemPromptText}
                </div>
                <div className="detail-actions-row">
                  <button
                    type="button"
                    className="text-link-subtle text-button"
                    onClick={() => setIsSystemPromptExpanded((prev) => !prev)}
                  >
                    {isSystemPromptExpanded ? dict.common.collapse : dict.strategy.expandMore}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}
