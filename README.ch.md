# AlphaPony

[![English](https://img.shields.io/badge/English-README-111111?style=flat-square)](./README.md)
[![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-README-f5f5f5?style=flat-square&labelColor=111111)](./README.ch.md)

AlphaPony 是一个面向加密资产信号的开源 AI 研究工具，帮助用户集中收集、整理和查看市场相关信息。

它把 6 类分散的信号源汇总到一起，通过语义分析、市场信号分析等定量化基础规则和 AI 大模型摘要，展示研究信号与相关上下文：

- 当前规则信号状态
- 当前 AI 信号状态
- 各信号驱动原因
- 最近事件时间线
- 重要告警与 Telegram 推送

## 免责声明

AlphaPony 仅作为研究和信息整理工具使用，不提供投资、财务、法律、税务或交易建议，也不构成对任何资产的买入、卖出、持有或交易推荐。所有输出均基于已配置的数据源、规则模型和 AI 模型生成，仅供参考。用户应自行完成研究、风险评估并独立承担相关决策责任。

## 核心能力

- 固定跟踪 `BTC`、`ETH`、`SOL`、`BNB`、`XRP`、`DOGE`
- 聚合 `市场`、`新闻`、`社区`、`KOL`、`链上`、`鲸鱼` 六类信号
- 提供规则分、信号状态、信号解释和事件时间线
- 提供中英文双语界面与双语 AI 分析
- 支持告警中心、Telegram 推送和连接测试
- 支持浅色 / 深色模式
- 支持版本检查与基础更新流程

## 页面结构

- 首页看板：总览全部资产的当前信号状态、AI 状态和最近告警
- 资产详情页：查看单资产信号拆解、AI 研究摘要、时间线和告警
- 时间线页：查看单资产或全资产最近事件
- 告警中心：查看告警记录与重要度
- 策略中心：查看信号策略
- 管理页：查看数据源状态，配置 AI 与 Telegram 连接

## 未来发展方向

- 支持多资产信号视图
- 支持历史回放与模拟分析
- 支持更复杂的自定义策略
- 支持可选工作流集成，任何外部操作均由用户自行控制

## 技术栈

- 前端：`Next.js 14`、`React 18`、`TypeScript`
- 后端：`NestJS 11`、`TypeScript`
- 数据库：`PostgreSQL`、`Prisma`

## 开源协议

AlphaPony 基于 [MIT License](./LICENSE) 开源。

## 快速启动

### 方式 A：Docker Compose

最快的自托管方式是使用 Docker Compose 和已经发布到 Docker Hub 的镜像：

```bash
docker compose -f docker-compose.hub.yml up -d
```

这会拉取 `jiuwuwu/alphapony:0.1.0` 并启动 PostgreSQL。如果想从源码本地构建镜像：

```bash
docker compose up --build
```

默认地址：

- 前端：`http://127.0.0.1:3000`
- 后端：`http://127.0.0.1:4000`

Docker 入口脚本会等待 PostgreSQL 就绪、执行 Prisma migration，并且只在数据库为空时写入演示数据。停止服务：

```bash
docker compose down
```

只有在你也想删除 PostgreSQL 数据卷时，才使用 `docker compose down -v`。

如果本机 `3000`、`4000` 或 `5432` 端口已被占用，可以启动前覆盖端口：

```bash
ALPHAPONY_WEB_PORT=3310 ALPHAPONY_API_PORT=4310 ALPHAPONY_POSTGRES_PORT=5433 docker compose -f docker-compose.hub.yml up -d
```

### 方式 B：本地 Node.js

#### 1. 准备环境变量

```bash
cp .env.example .env
```

最小常用变量：

- `DATABASE_URL`
- `API_PORT`
- `API_HOST`
- `API_BASE_URL`
- `WEB_PORT`
- `WEB_HOST`
- `NEXT_PUBLIC_API_BASE_URL`

可选 Telegram 告警变量：

- `TELEGRAM_BOT_TOKEN`：用户自己的 Telegram BotFather Bot Token
- `TELEGRAM_ALERT_CHAT_ID`：用户自己的告警接收 Chat ID

AlphaPony 不内置默认 Telegram Bot。用户可以在 `.env` 中配置 Telegram 告警，也可以在启动后进入管理页配置。

#### 2. 启动数据库

如果本机已安装并运行 PostgreSQL，直接使用你的 `DATABASE_URL` 即可。  
如果想用 Docker 启动项目自带的 PostgreSQL：

```bash
npm run db:up
```

#### 3. 启动应用

```bash
npm run start
```

默认地址：

- 前端：`http://127.0.0.1:3000`
- 后端：`http://127.0.0.1:4000`

首次运行时，启动脚本会自动补齐这些步骤：

- `npm ci`
- 数据库可用性检查
- Prisma Client 生成
- 前后端构建
- 必要时执行 `prisma migrate deploy`

## 常用命令

```bash
npm run start
npm run stop
npm run healthcheck
npm run dev
npm run api:dev
npm run db:up
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
npm run check-update
npm run update
```

## 跨平台运行

当前统一脚本入口适用于：

- `macOS`
- `Linux`
- `Windows`

核心正式运行命令：

- `npm run start`
- `npm run stop`
- `npm run healthcheck`

## Release 与更新

项目支持轻量 release 包，不包含这些大体积目录：

- `node_modules`
- `.next`
- `.next-dev`
- 构建缓存

release 或源码模式都可以统一使用：

```bash
npm run start
```

环境变量查找顺序：

1. `ALPHAPONY_ENV_PATH`
2. `data/env/.env`
3. 项目根目录 `.env`

检查更新与更新命令：

```bash
npm run check-update
npm run update
```

当前版本建议使用的更新清单地址：

```bash
https://github.com/ptansukses-beep/alphapony/releases/download/v0.1.0/latest.json
```

## 发布流程

后续发版建议按这个顺序做：

1. 更新 `package.json` 里的版本号
2. 构建 release 包：

```bash
ALPHAPONY_RELEASE_BASE_URL="https://github.com/ptansukses-beep/alphapony/releases/download/vX.Y.Z" npm run package-release
```

3. 把 `dist/release/` 里的两个文件一起上传到 GitHub Release：

- `alphapony-X.Y.Z-<platform>.zip`
- `latest.json`

4. 运行环境里把更新地址指向：

```bash
ALPHAPONY_UPDATE_MANIFEST_URL=https://github.com/ptansukses-beep/alphapony/releases/download/vX.Y.Z/latest.json
```

## 开发说明

如果你要手动进行开发调试，常用命令如下：

```bash
npm run api:dev
npm run dev
npm run db:seed
npm run prisma:migrate:dev
```
