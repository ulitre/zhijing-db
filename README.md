# 知径 DB

面向《数据库原理》的多智能体个性化学习系统。项目采用 Expo/React Native Web、Node.js、LangGraph.js、PostgreSQL 和 DeepSeek，交付 Android APK 与 Web 版本。

## 当前状态

项目已具备可运行纵向闭环：客户端、共享契约、45 节点课程图谱、个性化算法、LangGraph 多智能体编排、DeepSeek 可选接入、PostgreSQL 适配和隔离 sql.js Worker。没有配置 DeepSeek 或 PostgreSQL 时，系统自动使用可重复的本地演示数据，便于测试和录屏。

## 本地启动

要求 Node.js 22.13+ 与 pnpm 11。

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/client/.env.example apps/client/.env
pnpm install
pnpm dev:api
pnpm dev:client
```

客户端默认访问 `http://localhost:8787`。真机调试时需把 `EXPO_PUBLIC_API_URL` 改成电脑的局域网地址。

## 安全约束

- DeepSeek Key 与数据库连接串只能配置在 API 服务端。
- `EXPO_PUBLIC_*` 会进入客户端包，禁止放置任何密钥。
- SQL 教学沙箱与业务 PostgreSQL 完全隔离。
- 演示账号与试用数据均使用虚构或匿名标识。

详细设计、测试、来源和 AI Coding 说明位于 [`docs`](./docs/)。

正式部署使用 Railway API、Vercel Web 和 EAS Build APK；配置与部署步骤见 [`docs/06-部署与交付.md`](./docs/06-部署与交付.md)。

