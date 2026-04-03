const themes = [
  {
    key: "exchange",
    name: "方案 1",
    title: "冷灰蓝",
    note: "保留工具感和干净结构，用冷白灰和石墨蓝做基础。"
  },
  {
    key: "mint",
    name: "方案 2",
    title: "淡绿色",
    note: "轻薄的薄荷绿底色，适合做稳定、克制、偏增长感的数据产品。"
  },
  {
    key: "sky",
    name: "方案 3",
    title: "浅蓝白",
    note: "更接近你说的浅蓝白方向，整体更轻，几乎不带装饰性。"
  },
  {
    key: "paper",
    name: "方案 4",
    title: "纯白灰",
    note: "接近纯白，但保留一点灰度和边界，避免过曝和廉价感。"
  },
  {
    key: "amber",
    name: "方案 5",
    title: "淡金黄",
    note: "轻微暖金色，不做复古感，只保留一点金融终端的温度。"
  }
] as const;

const cards = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    price: "$68,468",
    change: "+1.4%",
    rule: "+8",
    ai: "弱偏多 +32"
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    price: "$3,412",
    change: "-0.8%",
    rule: "-11",
    ai: "观望 +4"
  },
  {
    symbol: "SOL",
    name: "Solana",
    price: "$182",
    change: "+2.6%",
    rule: "+17",
    ai: "强偏多 +58"
  }
] as const;

export default function ThemeDemoPage() {
  return (
    <main className="page">
      <section className="theme-demo-header">
        <div>
          <p className="theme-demo-kicker">Light Theme Direction</p>
          <h1 className="page-title">浅色模式方向 Demo</h1>
          <p className="page-subtitle">
            下面这几套都按你刚才的方向收窄了，都是偏 B 这种干净工具感，只比较不同的浅色基调。
          </p>
        </div>
      </section>

      <section className="theme-demo-stack">
        {themes.map((theme) => (
          <article key={theme.key} className={`theme-demo-shell theme-demo-${theme.key}`}>
            <div className="theme-demo-topbar">
              <div>
                <div className="theme-demo-chip">{theme.name}</div>
                <h2 className="theme-demo-title">{theme.title}</h2>
              </div>
              <p className="theme-demo-note">{theme.note}</p>
            </div>

            <div className="theme-demo-banner">
              <span className="theme-demo-alert-label">重要告警</span>
              <span className="theme-demo-alert-text">BTC 规则分从 -14 切到 +11，且 AI 已完成重算，建议查看详情。</span>
            </div>

            <div className="theme-demo-grid">
              <div className="theme-demo-column">
                <div className="theme-demo-panel">
                  <div className="theme-demo-panel-head">
                    <div>
                      <div className="theme-demo-section-label">首页卡片</div>
                      <h3>市场总览</h3>
                    </div>
                    <div className="theme-demo-pill">实时中</div>
                  </div>

                  <div className="theme-demo-card-grid">
                    {cards.map((card) => (
                      <div key={card.symbol} className="theme-demo-asset-card">
                        <div className="theme-demo-asset-head">
                          <div>
                            <div className="theme-demo-symbol">{card.symbol}</div>
                            <div className="theme-demo-name">{card.name}</div>
                          </div>
                          <div className="theme-demo-price-wrap">
                            <div className="theme-demo-price">{card.price}</div>
                            <div className={`theme-demo-change ${card.change.startsWith("-") ? "bear" : "bull"}`}>
                              {card.change}
                            </div>
                          </div>
                        </div>

                        <div className="theme-demo-score-row">
                          <div className="theme-demo-score-box">
                            <span>规则</span>
                            <strong>{card.rule}</strong>
                          </div>
                          <div className="theme-demo-score-box">
                            <span>AI</span>
                            <strong>{card.ai}</strong>
                          </div>
                        </div>

                        <div className="theme-demo-signal-row">
                          <span>市 +4</span>
                          <span>新 -1</span>
                          <span>社 +1</span>
                          <span>K 0</span>
                          <span>链 +2</span>
                          <span>鲸 +2</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="theme-demo-column">
                <div className="theme-demo-panel theme-demo-detail-panel">
                  <div className="theme-demo-panel-head">
                    <div>
                      <div className="theme-demo-section-label">详情页块</div>
                      <h3>BTC · AI 判断</h3>
                    </div>
                    <div className="theme-demo-pill">已完成</div>
                  </div>

                  <div className="theme-demo-headline-row">
                    <div className="theme-demo-bias">弱偏多 +32</div>
                    <div className="theme-demo-meta-row">
                      <span>建议 轻仓试多</span>
                      <span>强度 中</span>
                      <span>置信度 中</span>
                    </div>
                  </div>

                  <p className="theme-demo-summary">
                    资金面偏强，但趋势仍属弱修复，短线偏多试探。链上净流出和稳定币流入提供支撑，但均线结构尚未完全翻强。
                  </p>

                  <div className="theme-demo-mini-grid">
                    <div className="theme-demo-mini-panel">
                      <div className="theme-demo-section-label">关键理由</div>
                      <ul>
                        <li>4H MACD 金叉，价格重新回到 EMA20 上方。</li>
                        <li>交易所净流出 10,500 BTC，稳定币净流入 8,200 万美元。</li>
                        <li>鲸鱼净增持 1,200 BTC，短线抛压有所缓和。</li>
                      </ul>
                    </div>
                    <div className="theme-demo-mini-panel">
                      <div className="theme-demo-section-label">最近事件</div>
                      <ul>
                        <li>04:00 市场信号：量能转为缩量</li>
                        <li>03:47 新闻信号：BTC 连跌终结</li>
                        <li>03:46 新闻信号：储备法案再被讨论</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
