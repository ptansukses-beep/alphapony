import { AlertsFeed } from "@/components/alerts-feed";
import { getAlerts } from "@/lib/api";
import { getDictionary } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const locale = getServerLocale();
  const dict = getDictionary(locale);
  const alerts = await getAlerts(50, 0);

  return (
    <main className="page">
      <section className="panel section">
        <div className="section-header-compact">
          <div>
            <h1 className="page-title">{dict.alerts.title}</h1>
            <p className="page-subtitle">{dict.alerts.subtitle}</p>
          </div>
        </div>
        <AlertsFeed initialItems={alerts.items} initialTotal={alerts.total} locale={locale} dict={dict} />
      </section>
    </main>
  );
}
