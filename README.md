# 知径 DB

面向《数据库原理》的多智能体个性化学习系统。项目采用 Expo/React Native Web、Node.js、LangGraph.js、PostgreSQL 和 DeepSeek，交付 Android APK 与 Web 版本。

## 当前状态

项目已具备可运行纵向闭环：客户端、共享契约、45 节点课程图谱、个性化算法、LangGraph 多智能体编排、DeepSeek 可选接入、PostgreSQL 适配和隔离 sql.js Worker。没有配置 DeepSeek 或 PostgreSQL 时，系统自动使用可重复的本地演示数据，便于测试和录屏。

## 本地启动

要求 Node.js 22.13+ 与 pnpm 11。

```powershell
Copy-Item apps/api/.env.example apps/api/.env
pnpm install
pnpm env:local
pnpm dev:api
pnpm dev:client
```

客户端本地访问 `http://localhost:8787`。真机调试时需把 `EXPO_PUBLIC_API_URL` 改成电脑的局域网地址。

## 环境切换

`apps/client/.env` 已被忽略，不能再用 `git checkout --` 还原。根目录提供幂等切换脚本：

```powershell
pnpm env:local   # 备份当前生产地址，并切到 http://localhost:8787
pnpm env:prod    # 从 apps/client/.env.prod.bak 恢复生产地址（随后删除备份）
```

- 首次 `env:local` 会生成 `apps/client/.env.prod.bak`；该文件不入库。
- `env:prod` 默认恢复为 `https://zhijing-db-api-production.up.railway.app`，可用 `PROD_API_URL` 覆盖；`env:local` 可用 `LOCAL_API_URL` 覆盖。
- 交付构建前必须先执行 `pnpm env:prod`，再用 `pnpm check:delivery` 确认导出包包含生产 HTTPS API 且不含 localhost。
- Node.js 版本由根目录 `.nvmrc` / `.node-version` 固定为 22.x，对齐 `engines: ">=22.13.0 <23"`。

## 安全约束

- DeepSeek Key 与数据库连接串只能配置在 API 服务端。
- `EXPO_PUBLIC_*` 会进入客户端包，禁止放置任何密钥。
- SQL 教学沙箱与业务 PostgreSQL 完全隔离。
- 演示账号与试用数据均使用虚构或匿名标识。

详细设计、测试、来源和 AI Coding 说明位于 [`docs`](./docs/)。

正式部署使用 Railway API、Vercel Web 和 EAS Build APK；配置与部署步骤见 [`docs/06-部署与交付.md`](./docs/06-部署与交付.md)。

