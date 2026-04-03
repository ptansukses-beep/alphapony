# AlphaPony

语言入口：

- 中文说明：[`README.md`](README.md)
- English README: [`README.en.md`](README.en.md)

AlphaPony 是一个面向加密资产研究与盘中监控的分析工作台，当前技术栈为：

- `Next.js` 前端
- `NestJS` 后端
- `PostgreSQL` + `Prisma`

当前产品聚焦 6 个固定跟踪资产，帮助用户快速判断：

- 当前规则方向
- 当前 AI 方向
- 各信号驱动原因
- 最近事件
- 最近告警

当前支持资产：

- `BTC`
- `ETH`
- `SOL`
- `BNB`
- `XRP`
- `DOGE`

## 当前产品范围

当前页面：

- 首页看板
- 单资产详情页
- 单资产时间线页
- 全资产时间线页
- 告警中心
- 策略中心
- 管理页

当前信号类型：

- 市场
- 新闻
- 社区
- KOL
- 链上
- 鲸鱼

当前主要能力：

- 基于规则的打分与信号聚合
- 中英文双语 AI 分析结果
- 严格按最新快照对齐的 AI 可用性判断
- Telegram 告警发送
- 中文 / 英文切换
- 浅色 / 深色主题

## 跨平台运行

当前核心脚本入口已经统一改成 Node 版本，目标平台为：

- `macOS`
- `Linux`
- `Windows`

当前统一跨平台命令：

- `npm run start`
- `npm run stop`
- `npm run healthcheck`
- `npm run setup`
- `npm run prisma:generate`
- `npm run prisma:migrate:deploy`
- `npm run check-update`
- `npm run update`
- `npm run package-release`
- `npm run db:backup`
- `npm run api:start`
- `npm run web:start`

仍然依赖宿主机外部环境的命令：

- `npm run db:up` 需要 `docker compose`
- `npm run db:backup` 需要 `pg_dump`，或者需要可访问 Docker 中的 PostgreSQL

## 技术栈

- 前端：`Next.js 14`、`React 18`、`TypeScript`
- 后端：`NestJS 11`、`TypeScript`
- 数据库：`PostgreSQL`、`Prisma`

## 本地开发

### 1. 准备环境变量

复制示例文件：

```bash
cp .env.example .env
```

当前最小常用变量：

- `DATABASE_URL`
- `API_PORT`
- `API_HOST`
- `API_BASE_URL`
- `WEB_PORT`
- `WEB_HOST`
- `NEXT_PUBLIC_API_BASE_URL`
- `ALPHAPONY_UPDATE_MANIFEST_URL`
- `ALPHAPONY_RELEASE_BASE_URL`
- `ALPHAPONY_SKIP_DB_BACKUP`

### 2. 启动 PostgreSQL

```bash
npm run db:up
```

### 3. 启动应用

```bash
npm run start
```

首次运行时，`start` 会自动补齐：

- `npm ci`
- 数据库可用性检查
- Prisma Client 生成
- 前后端构建
- 优先尝试连接 `DATABASE_URL`
- 如果数据库不可用且本机有 Docker，会自动执行 `docker compose up -d postgres`
- 如果配置了 `DATABASE_URL`，会自动执行正式迁移

### 4. 开发模式常用命令

如果你要单独开发或调试，也可以手动执行：

```bash
npm run prisma:migrate:dev
npm run db:seed
npm run api:dev
npm run dev
```

默认地址：

- 前端：`http://127.0.0.1:3000`
- 后端：`http://127.0.0.1:4000`

## 可用脚本

根目录脚本：

```bash
npm run dev
npm run build
npm run start
npm run stop
npm run healthcheck
npm run check-update
npm run update
npm run package-release
npm run lint
npm run api:dev
npm run api:build
npm run api:start
npm run web:build
npm run web:start
npm run db:up
npm run db:backup
npm run prisma:generate
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
npm run db:seed
```

## Release 运行约定

正式运行和后续 release 更新，统一按下面的 env 查找顺序：

1. 环境变量 `ALPHAPONY_ENV_PATH` 指向的文件
2. `data/env/.env`
3. 项目根目录 `.env`

推荐 release 包使用：

- `data/env/.env` 保存运行配置
- 首次运行直接执行 `npm run start`，缺失依赖或构建产物时会自动补齐
- `npm run prisma:migrate:deploy` 执行正式数据库迁移
- `npm run start` 作为统一正式启动入口
- `npm run stop` 作为统一停止入口
- `npm run healthcheck` 作为统一健康检查入口
- `npm run check-update` 检查远端 manifest 中是否有新版本
- `npm run db:backup` 执行数据库备份
- `npm run update` 执行基础更新流程：备份、停服务、构建、正式迁移、重启、健康检查
- `npm run package-release` 生成当前版本的 zip 包和 `dist/release/latest.json`

如果直接运行源码，继续使用根目录 `.env` 也可以。

轻量 release 包默认不包含 `node_modules`、`.next`、`.next-dev` 和构建缓存。用户下载后默认只需要：

```bash
npm run start
```

如果目标机器上已经装好 Node.js 和 npm，这条命令会自动完成首次初始化。

启动脚本会自动补齐：

- `npm ci`
- 数据库可用性检查
- Prisma Client 生成
- 前后端构建
- 必要时执行 `prisma migrate deploy`

如果你明确想提前做一次完整初始化，也仍然可以手动执行：

```bash
npm run setup
```

远端更新约定：

- `ALPHAPONY_UPDATE_MANIFEST_URL` 指向远端 `latest.json`
- `latest.json` 至少包含：

```json
{
  "version": "0.1.0",
  "url": "https://example.com/alphapony-0.1.0-darwin-arm64.zip",
  "sha256": "..."
}
```

更新顺序现在是：

1. 下载并校验新包
2. 备份数据库
3. 停服务
4. 覆盖程序文件
5. 执行正式迁移
6. 重启并做健康检查

如果某些环境里暂时没有 `pg_dump` 且也无法访问 Docker，可手动设置：

```bash
ALPHAPONY_SKIP_DB_BACKUP=1 npm run update
```

默认仍然建议保留数据库备份。

## 构建

前端生产构建：

```bash
npm run build -w frontend
```

后端生产构建：

```bash
npm run build -w backend
```

## 运行说明

当前刷新行为：

- 首页在页面可见时每 `15s` 自动刷新
- 详情页在 AI 不可用时每 `15s` 自动刷新

当前数据刷新周期：

- 市场：`15s`
- 新闻：`10m`
- 社区：`10m`
- KOL：`10m`
- 链上 / 鲸鱼：`5m`

当前 AI 规则：

- 只有当 AI 与最新分析快照对齐时，才视为可用
- AI 请求带有超时与重试保护
- 已开启定时重算与快照变更重算
