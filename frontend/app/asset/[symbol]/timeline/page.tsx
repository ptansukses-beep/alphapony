import Link from "next/link";
import { AssetSwitcher } from "@/components/asset-switcher";
import { Section } from "@/components/section";
import { TimelineFeed } from "@/components/timeline-feed";
import { getAssetTimeline } from "@/lib/api";
import { getDictionary } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n/server";
import { signalLabel } from "@/lib/format";
import { ASSET_OPTIONS } from "@/lib/constants";
type AssetTimelinePageProps = {
  params: { symbol: string };
  searchParams?: { signal?: string };
};

export const dynamic = "force-dynamic";

export default async function AssetTimelinePage({
  params,
  searchParams
}: AssetTimelinePageProps) {
  const locale = getServerLocale();
  const dict = getDictionary(locale);
  const normalizedSymbol = params.symbol.toUpperCase();
  const signalType = searchParams?.signal;
  const isAllAssets = normalizedSymbol === "ALL";
  const timeline = await getAssetTimeline(normalizedSymbol, signalType, 50, 0);
  const currentAsset = ASSET_OPTIONS.find((asset) => asset.symbol === normalizedSymbol) ?? null;
  const signalTitle = signalType
    ? signalLabel(timeline.items[0]?.typeKey ?? signalType, locale, timeline.items[0]?.type ?? signalType)
    : null;
  const pageTitle = signalTitle ? `${signalTitle} ${dict.timeline.allData}` : dict.timeline.allEvents;
  const subtitle = signalType
    ? dict.timeline.subtitleForSignal
    : isAllAssets
      ? dict.timeline.subtitleAllAssets
      : dict.timeline.subtitleSingleAsset;
  const titleName = isAllAssets ? dict.common.all : currentAsset?.name ?? normalizedSymbol;
  const backHref = isAllAssets ? "/" : `/asset/${normalizedSymbol}`;
  const backLabel = isAllAssets ? dict.common.backHome : dict.common.backDetail;

  return (
    <main className="page">
      <section className="panel section">
        <div className="section-header-compact">
          <div>
            <div className="detail-title-block">
              <div className="detail-title-row">
                <AssetSwitcher
                  activeSymbol={isAllAssets ? "ALL" : normalizedSymbol}
                  destination="timeline"
                  includeAll
                  signalType={signalType}
                  dict={dict}
                />
                <span className="detail-name">{titleName}</span>
              </div>
              <div className="page-subtitle">{pageTitle}</div>
            </div>
          </div>
          <div className="cta-row">
            <Link href={backHref} className="button-secondary">
              {backLabel}
            </Link>
          </div>
        </div>
      </section>

      <Section title={pageTitle} subtitle={subtitle}>
        <TimelineFeed
          symbol={normalizedSymbol}
          signalType={signalType}
          initialItems={timeline.items}
          initialTotal={timeline.total}
          locale={locale}
          dict={dict}
        />
      </Section>
    </main>
  );
}
