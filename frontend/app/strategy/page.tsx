import { StrategyPageClient } from "@/components/strategy-page-client";
import { getStrategyConfig } from "@/lib/api";
import { getDictionary } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function StrategyPage() {
  const locale = getServerLocale();
  const dict = getDictionary(locale);
  const initialConfig = await getStrategyConfig("BTC");

  return <StrategyPageClient initialConfig={initialConfig} locale={locale} dict={dict} />;
}
