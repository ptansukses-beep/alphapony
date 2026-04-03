import { SourcesPageClient } from "@/components/sources-page-client";
import { getAiConfig, getSources, getTelegramConfig, getUpdateStatus } from "@/lib/api";
import { getDictionary } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const locale = getServerLocale();
  const dict = getDictionary(locale);
  const [sources, aiConfig, telegramConfig, updateStatus] = await Promise.all([
    getSources(),
    getAiConfig(),
    getTelegramConfig(),
    getUpdateStatus()
  ]);

  return (
    <SourcesPageClient
      initialSources={sources.items}
      initialAiConfig={aiConfig}
      initialTelegramConfig={telegramConfig}
      initialUpdateStatus={updateStatus}
      locale={locale}
      dict={dict}
    />
  );
}
