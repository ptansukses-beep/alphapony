# AlphaPony 曝光与发布计划

本文档用于记录 AlphaPony 在 GitHub 之外做信息发布、社区曝光和开发者生态分发时的参考路线。

## 对外定位

推荐统一使用以下定位：

- 中文：面向加密资产信号的开源 AI 研究工具
- English: open-source AI research tool for crypto asset signals

对外文案应强调：

- 收集、整理和展示市场相关信号
- 聚合 Market、News、Community、KOL、On-chain、Whale 等多类信息源
- 提供规则信号状态、AI 研究摘要、事件时间线和告警
- 开源、自托管、可审计、可扩展

避免使用以下表达：

- 投资助手
- 正确投资决策
- 稳定收益、持续收益、提高收益
- 买入/卖出建议
- 自动下单、自动交易
- guaranteed return
- investment advice
- buy/sell recommendation

必须保留的风险提示：

> AlphaPony is a research and information tool only. It does not provide investment, financial, legal, tax, or trading advice, and it does not recommend buying, selling, holding, or trading any asset.

中文口径：

> AlphaPony 仅作为研究和信息整理工具使用，不提供投资、财务、法律、税务或交易建议，也不构成对任何资产的买入、卖出、持有或交易推荐。

## 推荐发布顺序

### 1. 完善基础材料

目标：让用户第一次看到项目时能快速理解、试用和判断是否值得关注。

需要准备：

- README 中英文说明
- 免责声明
- 开源协议
- 项目截图
- 30 秒 demo GIF 或短视频
- 清晰的一句话 tagline
- GitHub Release 或可下载版本
- 基础安装和启动说明

推荐 tagline：

```text
AlphaPony is an open-source AI research tool for crypto asset signals.
```

中文 tagline：

```text
AlphaPony 是一个面向加密资产信号的开源 AI 研究工具。
```

### 2. Product Hunt 和 Hacker News

目标：获得早期用户、开发者反馈和第一波外部流量。

Product Hunt 准备项：

- 产品名称：AlphaPony
- Tagline：Open-source AI research tool for crypto asset signals
- 简短介绍：说明它如何聚合市场、新闻、社区、链上和鲸鱼信号
- 截图：至少 3 张，覆盖首页看板、资产详情、告警/时间线
- Demo：优先使用 30 秒 GIF 或短视频
- 链接：GitHub、README、Release 下载地址
- 评论区首评：解释为什么做、适合谁、明确 not financial advice

Hacker News 准备项：

- 标题建议：

```text
Show HN: AlphaPony - An open-source AI research tool for crypto asset signals
```

- 内容重点：
  - 说明这是可运行的开源项目，不是纯宣传页
  - 说明聚合了哪些信号源
  - 说明 AI 只做研究摘要，不提供交易建议
  - 邀请技术反馈，例如数据源、规则引擎、自托管体验

注意：

- 不要拉票
- 不要承诺收益
- 不要把输出描述为交易建议
- 发布前复查平台最新规则

Product Hunt 可复制文案：

```text
Product name:
AlphaPony

Tagline:
Open-source AI research tool for crypto asset signals

Short description:
AlphaPony is a self-hosted AI research assistant that helps users collect and review crypto market signals across market data, news, community activity, KOL updates, on-chain context, whale activity, alerts, and timelines.

Launch post / maker comment:
Hi Product Hunt,

We built AlphaPony as an open-source, self-hosted AI research tool for crypto asset signals.

Crypto research often means jumping between market dashboards, news feeds, community channels, on-chain explorers, whale trackers, and personal notes. AlphaPony brings those signals into one dashboard, adds rule-based signal status, and uses AI to summarize context for research workflows.

What it includes:
- Market, news, community, KOL, on-chain, and whale signal views
- Asset detail pages and event timelines
- Alert center and configurable signal rules
- Self-hosted Docker setup
- MIT-licensed source code

This is a research and information tool only. It does not provide financial advice, investment advice, trading advice, or any recommendation to buy, sell, or hold any asset.

We would appreciate feedback on the self-hosting flow, signal organization, and what integrations would be most useful next.

GitHub:
https://github.com/ptansukses-beep/alphapony

Docker:
docker compose -f docker-compose.hub.yml up -d
```

Product Hunt 中文备注：

```text
发布时不要把 AlphaPony 描述成投资工具、交易助手或收益工具。更稳妥的口径是 open-source/self-hosted AI research tool，并在首评里明确 not financial advice。
```

Hacker News Show HN 可复制文案：

```text
Title:
Show HN: AlphaPony - An open-source AI research tool for crypto asset signals

Post:
Hi HN,

I built AlphaPony, an open-source, self-hosted AI research tool for crypto asset signals.

The goal is to reduce the amount of context-switching involved in crypto research. Instead of checking separate tools for market data, news, community activity, KOL updates, on-chain context, whale activity, alerts, and timelines, AlphaPony organizes those signals into one local dashboard.

It includes:

- A Next.js frontend and NestJS backend
- PostgreSQL and Prisma
- Docker Compose setup
- Market, news, community, KOL, on-chain, and whale signal modules
- Rule-based signal status
- AI-generated research summaries
- Asset detail pages, timelines, and alerts

It is MIT licensed and can be run locally:

git clone https://github.com/ptansukses-beep/alphapony.git
cd alphapony
docker compose -f docker-compose.hub.yml up -d

Frontend: http://127.0.0.1:3000
Backend: http://127.0.0.1:4000

Important note: AlphaPony is a research and information tool only. It does not provide financial advice, investment advice, trading advice, or buy/sell/hold recommendations.

I would appreciate feedback on the architecture, the self-hosting flow, and which data integrations would be most useful next.
```

Show HN 发布备注：

```text
HN 更看重能运行、能看源码、能讨论技术实现。发帖时不要放营销口吻，不要拉票，不要承诺收益。标题用 Show HN 格式即可。
```

### 3. 技术内容平台

目标：用文章解释项目背景、架构和实现，获得搜索流量和开发者信任。

英文平台：

- DEV.to
- Hashnode
- Medium

中文平台：

- 掘金
- 知乎
- SegmentFault
- CSDN
- 开源中国

文章选题：

```text
How we built an open-source AI research tool for crypto asset signals
```

中文标题：

```text
我们如何构建一个面向加密资产信号的开源 AI 研究工具
```

文章结构建议：

- 为什么做 AlphaPony
- 它解决什么信息分散问题
- 六类信号源如何组织
- 规则信号和 AI 摘要如何配合
- 为什么选择开源和自托管
- 如何本地启动
- 风险提示：仅作为研究工具，不提供投资建议

### 4. 软件发现目录和 AI 工具目录

目标：获取长期目录流量和工具发现流量。

优先尝试：

- SaaSHub
- AlternativeTo
- Futurepedia
- There's An AI For That

提交前需要准备：

- 统一 tagline
- 简短描述
- 项目截图
- GitHub 链接
- 官网或 README 链接
- 开源协议信息
- 明确 not financial advice

目录描述建议：

```text
AlphaPony is an open-source, self-hosted AI research tool that helps users collect and review crypto asset signals across market, news, community, KOL, on-chain, and whale data sources. It is for research and information only and does not provide investment or trading advice.
```

### 5. 开发者生态分发

目标：让开发者更容易安装、集成和传播。

可以后续做：

- npm：`alphapony-cli` 或 `@alphapony/sdk`
- Docker Hub：自托管镜像
- Homebrew Tap：macOS CLI 安装
- PyPI：仅在有 Python SDK 或 Python CLI 时发布

当前项目是 Node.js / Next.js / NestJS 技术栈，不建议为了曝光强行发布到 PyPI。更合理的方式是后续单独做 Python SDK，例如：

```bash
pip install alphapony
```

但前提是它真的提供 Python API client、数据读取工具或 CLI。

## 当前完成状态

| 步骤 | 状态 | 说明 |
|---|---|---|
| README 中英文基础介绍 | 已完成 | 已改成 AI 研究工具和信号整理口径 |
| 免责声明 | 已完成 | README 中英文均已加入不提供投资/交易建议说明 |
| 开源协议 | 已完成 | 已使用 MIT License |
| GitHub 发布 | 已完成 | README、LICENSE 和 license 元数据已推送到 GitHub |
| Release 包 | 已完成 | GitHub Release `v0.1.0` 已包含 zip 包和 `latest.json` |
| 截图 | 已完成 | 用户已在本地准备 3-5 张截图，未纳入仓库 |
| 20-30 秒 demo GIF/短视频 | 已完成 | 用户已在本地准备 demo 素材，未纳入仓库 |
| Product Hunt | 待发布 | 文案已准备，实际发布需要登录 Product Hunt |
| Hacker News Show HN | 待发布 | 文案已准备，实际发布需要登录 Hacker News |
| DEV/Hashnode/Medium 文章 | 未开始 | 需要准备英文长文 |
| 掘金/知乎/SegmentFault/CSDN/开源中国文章 | 未开始 | 需要准备中文长文 |
| SaaSHub/AlternativeTo/AI 工具目录 | 未开始 | 需要截图、描述和链接 |
| npm 包 | 未开始 | 需要先定义 CLI 或 SDK |
| Docker 镜像 | 已完成 | 已发布 `jiuwuwu/alphapony:0.1.0` 和 `jiuwuwu/alphapony:latest` |
| Docker Hub 信息页 | 已完成 | 用户已补充 short description 和 overview |
| Homebrew Tap | 未开始 | 需要先有 CLI 或可安装包 |
| PyPI 包 | 不建议现在做 | 当前没有 Python SDK/CLI |

## 下一步建议

当前基础材料已经具备，可以进入发布阶段：

1. 用本文档里的 Product Hunt 文案创建 Product Hunt launch。
2. 用本文档里的 Show HN 文案发布 Hacker News。
3. 发布后把 Product Hunt / HN 链接同步到 X、LinkedIn、Telegram、Discord。
4. 基于 Product Hunt 和 Show HN 文案扩展英文长文，发布到 DEV.to / Hashnode / Medium。
5. 基于同一内容写中文版本，发布到掘金 / 知乎 / SegmentFault / CSDN / 开源中国。
6. 再提交 SaaSHub、AlternativeTo 和 AI 工具目录。

发布时优先使用以下链接：

```text
GitHub:
https://github.com/ptansukses-beep/alphapony

GitHub Release:
https://github.com/ptansukses-beep/alphapony/releases/tag/v0.1.0

Docker Hub:
https://hub.docker.com/r/jiuwuwu/alphapony

Docker image:
jiuwuwu/alphapony:0.1.0
```
