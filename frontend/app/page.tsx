import Link from "next/link";
import { PageAutoRefresh } from "@/components/ai-availability-refresh";
import { HomeAlertsStrip } from "@/components/home-alerts-strip";
import { getAlerts, getDashboardAssets } from "@/lib/api";
import { getDictionary } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n/server";
import { biasLevelClassName, biasLevelLabel, formatDisplayPrice, scoreToBiasLevel, signalAbbreviation, sortSignalsForDisplay } from "@/lib/format";

export const dynamic = "force-dynamic";

function formatSignedScore(score: number) {
  return score > 0 ? `+${score}` : String(score);
}

export default async function HomePage() {
  const locale = getServerLocale();
  const dict = getDictionary(locale);
  const [dashboardResult, alertsResult] = await Promise.allSettled([
    getDashboardAssets(),
    getAlerts(3, 0)
  ]);
  const dashboard =
    dashboardResult.status === "fulfilled"
      ? dashboardResult.value
      : { updatedAt: new Date().toISOString(), items: [] };
  const alerts =
    alertsResult.status === "fulfilled"
      ? alertsResult.value
      : { total: 0, items: [] };

  return (
    <main className="page">
      <PageAutoRefresh enabled intervalMs={15_000} />
      <HomeAlertsStrip
        dict={dict}
        items={alerts.items}
        locale={locale}
        latestLabel={dict.home.latestAlerts}
        importantLabel={dict.home.importantAlerts}
        viewAllLabel={dict.common.all}
      />
      <section className="section-plain">
        {dashboard.items.length === 0 ? (
          <section className="panel section">
            <p className="section-subtitle">{dict.common.noData}</p>
          </section>
        ) : (
        <div className="grid-three">
          {dashboard.items.map((asset) => {
            const ruleBiasLevel = scoreToBiasLevel(asset.ruleScore);

            return (
              <Link
                key={asset.symbol}
                href={`/asset/${asset.symbol}`}
                className="dashboard-card"
              >
                <div className="compact-head">
                  <div>
                    <h3 className="compact-symbol">{asset.symbol}</h3>
                    <div className="compact-name">{asset.name}</div>
                  </div>
                  <div className="compact-market">
                    <div className="compact-price">{formatDisplayPrice(asset.price)}</div>
                    <div
                      className={`compact-change ${asset.priceChange.startsWith("-") ? "bear" : "bull"}`}
                    >
                      {asset.priceChange}
                    </div>
                  </div>
                </div>

                <div className="score-strip">
                  <div className="score-box">
                    <div className="score-label">{dict.home.ruleDecision}</div>
                    <div className={`score-number score-headline ${biasLevelClassName(ruleBiasLevel)}`}>
                      <span className="score-prefix">{biasLevelLabel(ruleBiasLevel, locale)}</span>
                      <span>{formatSignedScore(asset.ruleScore)}</span>
                    </div>
                  </div>
                  <div className="score-box">
                    <div className="score-label">{dict.home.aiDecision}</div>
                    {asset.aiAvailable && typeof asset.aiScore === "number" ? (
                      <div className={`score-number score-headline ${biasLevelClassName(asset.aiBiasLevel)}`}>
                        <span className="score-prefix">{biasLevelLabel(asset.aiBiasLevel, locale)}</span>
                        <span>{formatSignedScore(asset.aiScore)}</span>
                      </div>
                    ) : (
                      <div className="score-number score-headline state-unavailable">
                        <span className="score-prefix">{dict.common.unavailable}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mini-signal-grid">
                  {sortSignalsForDisplay(asset.signalScores).map((signal) => (
                    <div key={signal.type} className="mini-signal">
                      <span
                        className={`mini-signal-label ${biasLevelClassName(signal.biasLevel)}`}
                      >
                        {signalAbbreviation(signal.type, locale)}
                      </span>
                      <span
                        className={`mini-signal-score ${biasLevelClassName(signal.biasLevel)}`}
                      >
                        {formatSignedScore(signal.weightedScore ?? signal.score)}
                      </span>
                    </div>
                  ))}
                </div>

              </Link>
            );
          })}
        </div>
        )}
      </section>
    </main>
  );
}
