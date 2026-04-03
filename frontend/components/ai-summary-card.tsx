"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recomputeAssetAi } from "@/lib/api";
import { formatAiAction, formatAiConfidence, formatAiStrength, getAiReasonsText, getAiRisksText, getAiSummaryText } from "@/lib/ai";
import type { AssetDetail } from "@/lib/api-types";
import type { LocaleCode } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n";
import {
  biasLevelClassName,
  biasLevelLabel,
  formatAbsoluteTime,
  scoreToBiasLevel
} from "@/lib/format";

type AiSummaryCardProps = {
  symbol: string;
  ai: AssetDetail["ai"];
  locale: LocaleCode;
  dict: Dictionary;
};

function formatSignedScore(score: number) {
  return score > 0 ? `+${score}` : String(score);
}

export function AiSummaryCard({ symbol, ai, locale, dict }: AiSummaryCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const aiBiasLevel = ai.available ? ai.biasLevel ?? scoreToBiasLevel(ai.score ?? 0) : "watch";
  const aiSummary = getAiSummaryText(ai, locale);
  const aiReasons = getAiReasonsText(ai, locale);
  const aiRisks = getAiRisksText(ai, locale);

  function handleRecompute() {
    setError(null);

    startTransition(async () => {
      try {
        await recomputeAssetAi(symbol);
        router.refresh();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : dict.asset.aiRecomputeFailed);
      }
    });
  }

  return (
    <div className="panel summary-card ai-summary-card">
      <div className="ai-summary-topbar">
        <div className={`signal-tag ${ai.available ? biasLevelClassName(aiBiasLevel) : "state-unavailable-tag"}`}>
          {dict.home.aiDecision}
        </div>
        <button
          type="button"
          className="button-secondary ai-recompute-button"
          onClick={handleRecompute}
          disabled={isPending}
        >
          {isPending ? dict.common.recomputing : `${dict.common.recompute} AI`}
        </button>
      </div>
      <div className={`summary-value summary-headline ${ai.available ? biasLevelClassName(aiBiasLevel) : "state-unavailable"}`}>
        <span className="summary-prefix">{ai.available ? biasLevelLabel(aiBiasLevel, locale) : dict.common.unavailable}</span>
        <span>{ai.available && typeof ai.score === "number" ? formatSignedScore(ai.score) : null}</span>
      </div>
      {ai.available ? (
        <>
          <div className="summary-meta">
            {[
              `${dict.common.direction} ${biasLevelLabel(aiBiasLevel, locale)}`,
              `${dict.asset.advice} ${formatAiAction(ai, locale)}`,
              `${dict.asset.strength} ${formatAiStrength(ai, locale)}`,
              `${dict.common.confidence} ${formatAiConfidence(ai, locale)}`
            ].map((item) => (
              <span key={item} className="meta-pill">
                {item}
              </span>
            ))}
          </div>
          <p className="ai-summary-text">{aiSummary}</p>
          <ol className="summary-list">
            {aiReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ol>
          {aiRisks.length > 0 ? (
            <div className="ai-risks">
              {aiRisks.map((risk) => (
                <span key={risk} className="meta-pill">
                  {dict.common.risk} {risk}
                </span>
              ))}
            </div>
          ) : null}
          <div className="ai-summary-footer">
            <div className="ai-summary-times">
              {ai.updatedAt ? <span>{dict.asset.aiUpdatedAt} {formatAbsoluteTime(ai.updatedAt, locale)}</span> : null}
              {ai.basedOnSnapshotAt ? <span>{dict.asset.snapshotUpdatedAt} {formatAbsoluteTime(ai.basedOnSnapshotAt, locale)}</span> : null}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="summary-meta">
            <span className="meta-pill state-unavailable-pill">{dict.asset.aiUnavailable}</span>
          </div>
          <p className="ai-summary-text">{dict.asset.aiUnavailableSummary}</p>
        </>
      )}
      {error ? <p className="ai-summary-error">{error}</p> : null}
    </div>
  );
}
