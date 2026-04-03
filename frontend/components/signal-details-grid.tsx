"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Dictionary } from "@/lib/i18n";
import type { LocaleCode } from "@/lib/i18n/config";
import {
  formatAbsoluteTime,
  formatSignalDriver,
  formatSignalHighlightTitle,
  formatSignalMetricLabel,
  formatSignalMetricValue,
  biasLevelClassName,
  biasLevelLabel,
  confidenceLabel,
  formatRelativeTime,
  signalLabel,
  scoreToBiasLevel
} from "@/lib/format";
import type { SignalItem } from "@/lib/api-types";

type SignalDetailsGridProps = {
  assetSymbol: string;
  signals: SignalItem[];
  locale: LocaleCode;
  dict: Dictionary;
};

function isValidExternalHref(href?: string) {
  if (!href) {
    return false;
  }

  const trimmed = href.trim();
  return Boolean(trimmed) && trimmed !== "#";
}

function SignalCard({
  assetSymbol,
  dict,
  locale,
  signal
}: {
  assetSymbol: string;
  signal: SignalItem;
  locale: LocaleCode;
  dict: Dictionary;
}) {
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const visibleItems = expanded ? signal.highlights.slice(0, 10) : signal.highlights.slice(0, 3);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="detail-card">
      <div className="signal-card-head">
        <div>
          <h3 className="signal-card-title">{signalLabel(signal.labelKey ?? signal.type, locale, signal.label)}</h3>
        </div>
        <div className="status-line">
          <span className={`status-strong ${biasLevelClassName(signal.biasLevel)}`}>
            {biasLevelLabel(signal.biasLevel, locale)}
          </span>
          <span className={`status-strong ${biasLevelClassName(signal.biasLevel)}`}>
            {signal.score > 0 ? `+${signal.score}` : signal.score}
          </span>
          {typeof signal.weightedScore === "number" ? (
            <span className="status-weighted">
              <span className="status-weighted-label">{dict.common.scoreWeighted}</span>
              <span
                className={`status-weighted-score ${biasLevelClassName(scoreToBiasLevel(signal.weightedScore))}`}
              >
                {signal.weightedScore > 0 ? `+${signal.weightedScore}` : signal.weightedScore}
              </span>
            </span>
          ) : null}
          <span className="status-muted">{dict.common.confidence} {confidenceLabel(signal.confidenceKey ?? signal.confidence, locale)}</span>
        </div>
      </div>

      <div className="grid-two">
        <div className="event-card">
          <div className="kicker">{dict.asset.mainDrivers}</div>
          <ol className="summary-list">
            {signal.drivers.map((driver, index) => (
              <li key={`${driver}-${index}`}>{formatSignalDriver(driver, locale, signal.driverItems?.[index] ?? undefined)}</li>
            ))}
          </ol>
        </div>
        <div className="event-card">
          <div className="kicker">{dict.asset.keyMetrics}</div>
          <div className="mini-metrics">
            {signal.metrics.map((metric) => (
              <div key={metric.name} className="mini-metric">
                <span>{formatSignalMetricLabel(metric, locale)}</span>
                <strong>{formatSignalMetricValue(metric, locale)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="kicker">{dict.common.data}</div>
        <div className="link-list">
          {visibleItems.map((item) => {
            const hasLink = isValidExternalHref(item.href);

            const content = (
              <>
                <div className="link-row-copy">
                  <span className="link-row-title">
                    {typeof item.score === "number" ? (
                      <span
                        className={`highlight-score ${biasLevelClassName(scoreToBiasLevel(item.score))}`}
                      >
                        {item.score > 0 ? `+${item.score}` : item.score}
                      </span>
                    ) : null}
                    {formatSignalHighlightTitle(item, locale)}
                  </span>
                  {item.publishedAt ? (
                    <span className="link-row-time">
                      {mounted ? formatRelativeTime(item.publishedAt, locale) : formatAbsoluteTime(item.publishedAt, locale)}
                    </span>
                  ) : null}
                </div>
                {hasLink ? <strong className="link-row-arrow">›</strong> : null}
              </>
            );

            if (!hasLink) {
              return (
                <div key={`${item.title}-${item.publishedAt ?? "no-time"}`} className="link-row">
                  {content}
                </div>
              );
            }

            return (
              <a
                key={`${item.title}-${item.href}`}
                href={item.href}
                className="link-row"
                target="_blank"
                rel="noreferrer"
              >
                {content}
              </a>
            );
          })}
        </div>
        {signal.highlights.length > 3 ? (
          <div className="detail-actions-row">
            <button
              type="button"
            className="text-link-subtle text-button"
            onClick={() => setExpanded((value) => !value)}
          >
              {expanded ? dict.common.collapse : dict.common.more}
            </button>
            <Link
              href={`/asset/${assetSymbol}/timeline?signal=${signal.type}`}
              className="text-link-subtle"
            >
              {dict.common.all}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SignalDetailsGrid({ assetSymbol, signals, locale, dict }: SignalDetailsGridProps) {
  const leftColumn = signals.filter((_, index) => index % 2 === 0);
  const rightColumn = signals.filter((_, index) => index % 2 === 1);

  return (
    <div className="grid-two signal-columns">
      <div className="stack">
        {leftColumn.map((signal) => (
          <SignalCard key={signal.type} assetSymbol={assetSymbol} signal={signal} locale={locale} dict={dict} />
        ))}
      </div>
      <div className="stack">
        {rightColumn.map((signal) => (
          <SignalCard key={signal.type} assetSymbol={assetSymbol} signal={signal} locale={locale} dict={dict} />
        ))}
      </div>
    </div>
  );
}
