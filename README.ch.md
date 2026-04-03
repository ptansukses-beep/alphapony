# AlphaPony

English README: [`README.md`](README.md)  
中文说明：[`README.ch.md`](README.ch.md)

AlphaPony 是加密资产行业的第一个去中心化AI投资助手，旨在让投资者简单、快速的得到正确的投资决策，在加密资产领域不断获得收益。

它把 6 类分散的信号源汇总到一起，通过语义分析、市场信号分析等定量化的基础规则和AI大模型分析、生成买卖方向信号，帮助用户快速做出正确判断：

- 当前规则方向
- 当前 AI 方向
- 各信号驱动原因
- 最近事件时间线
- 重要告警与 Telegram 推送

## 核心能力

- 固定跟踪 `BTC`、`ETH`、`SOL`、`BNB`、`XRP`、`DOGE`
- 聚合 `市场`、`新闻`、`社区`、`KOL`、`链上`、`鲸鱼` 六类信号
- 提供规则分、方向判断、信号解释和事件时间线
- 提供中英文双语界面与双语 AI 分析
- 支持告警中心、Telegram 推送和连接测试
- 支持浅色 / 深色模式
- 支持版本检查与基础更新流程

## 页面结构

- 首页看板：总览全部资产的当前方向、AI 状态和最近告警
- 资产详情页：查看单资产信号拆解、AI 结论、时间线和告警
- 时间线页：查看单资产或全资产最近事件
- 告警中心：查看告警记录与重要度
- 策略中心：查看信号策略
- 管理页：查看数据源状态，配置 AI 与 Telegram 连接

## 未来发展方向

- 支持多资产组合分析
- 支持数据回测与模拟交易
- 支持更复杂的自定义策略
- 支持自动下单与交易

## 技术栈

- 前端：`Next.js 14`、`React 18`、`TypeScript`
- 后端：`NestJS 11`、`TypeScript`
- 数据库：`PostgreSQL`、`Prisma`

## 快速启动

### 1. 准备环境变量

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

### 2. 启动数据库

如果本机已安装并运行 PostgreSQL，直接使用你的 `DATABASE_URL` 即可。  
如果想用 Docker 启动项目自带的 PostgreSQL：

```bash
npm run db:up
```

### 3. 启动应用

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

## 开发说明

如果你要手动进行开发调试，常用命令如下：

```bash
npm run api:dev
npm run dev
npm run db:seed
npm run prisma:migrate:dev
```
