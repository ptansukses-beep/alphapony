import Link from "next/link";
import { AiAvailabilityRefresh } from "@/components/ai-availability-refresh";
import { AiSummaryCard } from "@/components/ai-summary-card";
import { AssetSwitcher } from "@/components/asset-switcher";
import { Section } from "@/components/section";
import { SignalDetailsGrid } from "@/components/signal-details-grid";
import { getAssetDetail } from "@/lib/api";
import { formatAlertSummary, formatAlertType } from "@/lib/alerts";
import { getDictionary } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n";
import type { LocaleCode } from "@/lib/i18n/config";
import { getServerLocale } from "@/lib/i18n/server";
import {
  biasLevelClassName,
  biasLevelFromScore,
  biasLevelLabel,
  confidenceLabel,
  formatAbsoluteTime,
  formatDisplayPrice,
  formatSignalDriver,
  formatSignalHighlightTitle,
  formatSummaryItems,
  riskLabel,
  signalLabel,
  scoreToBiasLevel
} from "@/lib/format";

type AssetDetailPageProps = {
  params: { symbol: string };
};

export const dynamic = "force-dynamic";

function formatSignedScore(score?: number) {
  if (typeof score !== "number") {
    return null;
  }

  return score > 0 ? `+${score}` : String(score);
}

function isValidExternalHref(href?: string) {
  if (!href) {
    return false;
  }

  const trimmed = href.trim();
  return Boolean(trimmed) && trimmed !== "#";
}

function alertStatusLabel(status: string, dict: Dictionary, locale: LocaleCode) {
  switch (status.toLowerCase()) {
    case "sent":
      return dict.common.statusSent;
    case "new":
      return dict.common.statusPending;
    default:
      return locale === "en-US" ? status.replace(/_/g, " ") : status;
  }
}

export default async function AssetDetailPage({
  params
}: AssetDetailPageProps) {
  const locale = getServerLocale();
  const dict = getDictionary(locale);
  const { symbol } = params;
  const asset = await getAssetDetail(symbol);
  const filteredSignals = asset.signals;
  const visibleEvents = asset.events.slice(0, 6);
  const visibleAlerts = asset.alerts.slice(0, 6);
  const ruleBiasLevel = scoreToBiasLevel(asset.rule.score);
  const weightedSignals = asset.signals.filter((signal) => typeof signal.weightedScore === "number");

  return (
    <main className="page">
      <AiAvailabilityRefresh enabled={!asset.ai.available} />
      <section className="panel section">
        <div className="section-header-compact">
          <div>
            <div className="detail-title-block">
              <div className="detail-title-row">
                <AssetSwitcher activeSymbol={asset.symbol} dict={dict} />
                <span className="detail-name">{asset.name}</span>
              </div>
              <div className="detail-top-meta">
                <span className="meta-pill">{formatDisplayPrice(asset.price)}</span>
                <span className="meta-pill">{asset.priceChange}</span>
                <span className={`meta-pill ${biasLevelClassName(ruleBiasLevel)}`}>
                  {dict.asset.rule} {biasLevelLabel(ruleBiasLevel, locale)}
                </span>
                <span className={`meta-pill ${asset.ai.available ? biasLevelClassName(asset.ai.biasLevel ?? scoreToBiasLevel(asset.ai.score ?? 0)) : "state-unavailable-pill"}`}>
                  {dict.asset.ai} {asset.ai.available ? biasLevelLabel(asset.ai.biasLevel ?? scoreToBiasLevel(asset.ai.score ?? 0), locale) : dict.common.unavailable}
                </span>
              </div>
            </div>
          </div>
          <div className="cta-row">
            <Link href="/" className="button-secondary">
              {dict.common.backHome}
            </Link>
            <Link href="/strategy" className="button-secondary">
              {dict.asset.backStrategy}
            </Link>
          </div>
        </div>
      </section>

      <div className="detail-summary-grid" style={{ marginTop: 20 }}>
        <div className="panel summary-card rule-summary-card">
          <div className="rule-summary-main">
            <div className={`signal-tag ${biasLevelClassName(ruleBiasLevel)}`}>
              {dict.asset.ruleResult}
            </div>
            <div className={`summary-value summary-headline ${biasLevelClassName(ruleBiasLevel)}`}>
              <span className="summary-prefix">{biasLevelLabel(ruleBiasLevel, locale)}</span>
              <span>{formatSignedScore(asset.rule.score)}</span>
            </div>
            <div className="summary-meta">
              {[
                `${dict.common.direction} ${biasLevelLabel(ruleBiasLevel, locale)}`,
                `${dict.common.confidence} ${confidenceLabel(asset.rule.confidenceKey ?? asset.rule.confidence, locale)}`,
                `${dict.common.window} ${asset.window ?? "4H"}`,
                `${dict.common.risk} ${riskLabel(asset.rule.riskKey ?? asset.rule.risk, locale)}`
              ].map((item) => (
                <span key={item} className="meta-pill">
                  {item}
                </span>
              ))}
            </div>
            {formatSummaryItems(asset.consistency, locale, asset.consistencyItems) ? (
              <p className="summary-note">
                {formatSummaryItems(asset.consistency, locale, asset.consistencyItems)}
              </p>
            ) : null}
            <ol className="summary-list">
              {asset.rule.drivers.map((driver, index) => (
                <li key={`${driver}-${index}`}>
                  {formatSignalDriver(driver, locale, asset.rule.driverItems?.[index] ?? undefined)}
                </li>
              ))}
            </ol>
          </div>
          <div className="rule-summary-side">
            <div className="kicker">{dict.asset.weightedSignals}</div>
            <div className="rule-weighted-grid">
              {weightedSignals.map((signal) => (
                <div key={signal.type} className="rule-weighted-item">
                  <span className="rule-weighted-label">{signalLabel(signal.labelKey ?? signal.type, locale, signal.label)}</span>
                  <strong className={biasLevelClassName(scoreToBiasLevel(signal.weightedScore ?? 0))}>
                    {formatSignedScore(signal.weightedScore) ?? "0"}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <AiSummaryCard symbol={asset.symbol} ai={asset.ai} locale={locale} dict={dict} />
      </div>

      <Section
        title={dict.asset.signalDetailsTitle}
        subtitle={dict.asset.signalDetailsSubtitle}
      >
        {filteredSignals.length > 0 ? (
          <SignalDetailsGrid assetSymbol={asset.symbol} signals={filteredSignals} locale={locale} dict={dict} />
        ) : (
          <div className="detail-card">
            <p className="section-subtitle">
              {dict.asset.noSignals}
            </p>
          </div>
        )}
      </Section>

      <div className="grid-two detail-dual-section">
        <Section
          title={dict.asset.timelineTitle}
          subtitle={dict.asset.timelineSubtitle}
        >
          {asset.events.length > 0 ? (
            <>
              <div className="timeline">
              {visibleEvents.map((event) => (
                <div key={`${event.time}-${event.title}`} className="timeline-item">
                  <div className="timeline-time">{formatAbsoluteTime(event.time, locale)}</div>
                  <div>
                    {(() => {
                      const resolvedBiasLevel = biasLevelFromScore(event.score, event.direction);

                      return (
                        <>
                          <div className="event-meta">
                            {signalLabel(event.typeKey ?? event.type, locale, event.type)} ·{" "}
                            <span className={biasLevelClassName(resolvedBiasLevel)}>
                              {biasLevelLabel(resolvedBiasLevel, locale)}
                            </span>
                            {typeof event.score === "number" ? (
                              <>
                                {" "}·{" "}
                                <span className={biasLevelClassName(resolvedBiasLevel)}>
                                  {formatSignedScore(event.score)}
                                </span>
                              </>
                            ) : null}
                          </div>
                          {isValidExternalHref(event.href) ? (
                            <h3 className="timeline-title">
                              <a href={event.href} target="_blank" rel="noreferrer">
                                {formatSignalHighlightTitle(event, locale)}
                              </a>
                            </h3>
                          ) : (
                            <h3 className="timeline-title">{formatSignalHighlightTitle(event, locale)}</h3>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
              </div>
              {asset.events.length > 6 ? (
                <div className="detail-actions-row">
                  <Link href={`/asset/${asset.symbol}/timeline`} className="text-link-subtle">
                    {dict.common.all}
                  </Link>
                </div>
              ) : null}
            </>
          ) : (
            <div className="detail-card">
              <p className="section-subtitle">{dict.asset.noEvents}</p>
            </div>
          )}
        </Section>

        <Section
          title={dict.asset.alertsTitle}
          subtitle={dict.asset.alertsSubtitle}
        >
          {asset.alerts.length > 0 ? (
            <>
              <div className="timeline">
                {visibleAlerts.map((alert) => {
                  const parsed = formatAlertSummary(alert, locale, dict);

                  return (
                    <div key={`${alert.time}-${alert.type}`} className="timeline-item alert-item">
                      <div className="timeline-time">{formatAbsoluteTime(alert.time, locale)}</div>
                      <div>
                        <div className="alert-meta">
                          {formatAlertType(alert, locale)} · <span className="alert-status">{alertStatusLabel(alert.status, dict, locale)}</span>
                        </div>
                        <h3 className="timeline-title">{parsed.main}</h3>
                        {parsed.price || parsed.priceChange ? (
                          <div className="alert-context-row">
                            {formatDisplayPrice(parsed.price) ? <span className="meta-pill">{dict.common.price} {formatDisplayPrice(parsed.price)}</span> : null}
                            {parsed.priceChange ? <span className="meta-pill">24H {parsed.priceChange}</span> : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              {asset.alerts.length > 6 ? (
                <div className="detail-actions-row">
                  <Link href="/alerts" className="text-link-subtle">
                    {dict.common.all}
                  </Link>
                </div>
              ) : null}
            </>
          ) : (
            <div className="detail-card">
              <p className="section-subtitle">{dict.asset.noAlerts}</p>
            </div>
          )}
        </Section>
      </div>
    </main>
  );
}
