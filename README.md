# 拾词 · 英语单词

一个移动端优先的英语背单词 PWA。每天学习一组新词，第二天自动进入复习队列，按艾宾浩斯记忆曲线逐步拉长复习间隔。

在线体验：[https://majestic-gumption-6905bd.netlify.app](https://majestic-gumption-6905bd.netlify.app)

## 功能

- **词典**：内置高考、雅思、托福、四级、六级词库（8,983 个去重词条），支持中文释义、英美音标；发音使用有道词典的标准美音/英音音频（可分别点击 US / UK），音频不可用时回退到 Free Dictionary 音频或浏览器 TTS。词库外单词自动联网查询（有道中文释义 + Free Dictionary 英文释义）。每个词条可展开「词组与例句」，显示常见词组和双语例句（由 Netlify Function 代理有道词典数据，见下文部署说明）。
- **每日新词**：学习未学过的单词，每天目标可设为 5/10/15/20/30/50 个；卡片先回忆、后揭示释义。完成目标后可以点「继续学习」加练任意多组。
- **学习顺序**：可在词库页选择「按顺序」或「乱序」，新词和复习都使用该顺序。
- **收藏单词**：在背单词或查词典时点击书签图标收藏；收藏页集中查看、发音、取消收藏，并支持收藏词专项复习。
- **艾宾浩斯复习**：新词第二天首次复习，之后按 2 / 4 / 7 / 15 / 30 / 60 天逐步拉长；「模糊」提前回来，「忘了」回到更早的节点，逾期单词也会出现在队列中。
- **每日提醒**：在「我的」中设置提醒时间；macOS 原生 App 使用系统通知（App 关闭也能提醒），浏览器版仅在打开时提醒。
- **学习统计**：近 14 天新学/复习曲线、累计表现、连续打卡和各词库完成度。
- **账号与云同步**：使用 Supabase 邮箱账号登录后，进度、收藏、设置和提醒会自动同步到云端，支持多设备。
- **多词库**：高考、雅思、托福、四级、六级；切换词库不会丢失进度，跨词库共享已学状态。
- **离线可用**：安装为 PWA 后，词库、学习和复习完全离线；仅「词库外查词」需要网络。
- **本机存储**：进度保存在浏览器 localStorage，无需账号。

## 快速开始

```bash
npm install
npm run dev
```

打开终端提示的地址（默认 http://localhost:5173）。

词库数据已提交在 `public/data/`，正常情况下无需重新下载。需要更新词库时运行：

```bash
npm run data:fetch
```

脚本通过 GitHub Contents API 下载 `RealKai42/qwerty-learner` 的词库，缓存到 `scripts/.cache/`，然后生成去重词典与各词库的顺序索引。缓存用于避免重复消耗 GitHub API 限额；想强制拉取上游最新版本时，先删除 `scripts/.cache/` 再运行脚本。

## 构建与预览

```bash
npm run build
npm run preview
```

`vite-plugin-pwa` 会生成 `manifest.webmanifest` 和 `sw.js`，预缓存应用与词库数据（约 1.6 MB）。

## 账号与云同步（Supabase）

云同步是可选的；不登录时一切功能仍在本机运行。

> **当前项目已配置**：Supabase 的公开 URL 和 anon key 已写入 `src/config/supabaseConfig.ts`，`user_state` 表也已创建。打开「我的 → 账号与同步」即可注册/登录。若以后更换 Supabase 项目，请用 `.env.local`（优先级更高）或修改该配置文件。

1. 在 [supabase.com](https://supabase.com) 创建一个免费项目。
2. 打开 **SQL Editor**，执行仓库中的 `supabase/schema.sql`（创建 `user_state` 表和行级安全策略）。
3. 打开 **Project Settings → API**，复制 **Project URL** 和 **anon public key**。
4. 在项目根目录创建 `.env.local`（可参考 `env.example`）：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

5. 重新构建 Web 与桌面 App：

```bash
npm run build
npm run app:macos
```

6. 在「我的 → 账号与同步」中注册或登录。首次登录时，如果本机和云端都已有学习数据，App 会弹窗让你选择保留哪一份。

说明：

- **anon key 是公开的客户端密钥**，数据由 Supabase 的行级安全策略保护；绝对不要把 `service_role` key 放进前端。
- 如果要快速测试注册，可在 **Authentication → Providers → Email** 中关闭 Confirm email；开启时注册后需要先点击邮件里的确认链接。
- 登录后本机修改会在约 1 秒后自动上传；换设备时登录同一账号即可拉取云端进度，也可以手动点「立即同步」。
- 多台设备同时离线修改同一账号时，后同步的一端可能覆盖另一端；App 会在检测到双方都有新修改时弹窗让你选择。

## macOS 桌面 App（不经过浏览器）

如果不想在浏览器里打开，可以构建一个原生 WKWebView 窗口：

```bash
npm run build
npm run app:macos
```

脚本会生成 `~/Applications/拾词.app` 和桌面快捷方式 `~/Desktop/拾词.app`。双击打开的是一个原生窗口，不显示浏览器地址栏、标签页或 Chrome 界面；应用会自动检查并启动本地预览服务（复用已运行的实例），也会在「关于」页面中提供版本信息。

- App 依赖 Node/npm 和本项目目录；如果移动了项目位置或升级了 Node，请重新运行 `npm run app:macos`。
- 原生窗口使用独立的 WebKit 存储，和 Chrome 里的 PWA 进度互不相通。
- 关闭原生窗口后，本地服务会继续保留，方便手机通过局域网访问；需要停止时可结束对应的 `vite preview` 进程。

## 在手机上使用

### 同一 Wi-Fi 下临时预览

```bash
npm run dev -- --host
```

手机访问 `http://<电脑局域网 IP>:5173`。可以浏览和正常学习，但没有 HTTPS 时 Service Worker 不会启用，因此不能离线使用。

### 正式使用（推荐）

PWA 的安装与离线能力需要 HTTPS。将 `dist/` 部署到静态托管即可：

- **Vercel / Cloudflare Pages**：构建命令 `npm run build`，输出目录 `dist`。
- **GitHub Pages**：如果部署在子路径，构建时指定 base，例如
  `npm run build -- --base=/word-app/`，然后发布 `dist/`。

### Netlify 部署（含词组/例句函数）

词组的双语例句由 `netlify/functions/word-details.mjs` 提供，需要和站点一起部署。Netlify Drop 只支持静态文件，**不包含 Function**；请使用 Netlify CLI 或 Git 集成：

```bash
npx netlify login
npx netlify link          # 选择现有站点 majestic-gumption-6905bd
npx netlify deploy --prod --build
```

首次部署后，词典服务地址为：

```text
https://<你的站点>/.netlify/functions/word-details?word=abandon
```

客户端在 `src/config/appConfig.ts` 中记录部署域名，原生 App 和局域网预览会通过该地址加载词组/例句；如果更换 Netlify 站点，请同步修改这个文件。

部署后在手机浏览器打开网址，选择「添加到主屏幕」即可获得接近原生 App 的全屏体验。

## 测试

```bash
npm test          # 单元测试：日期、SRS、选择器、reducer、存储、词库完整性、发音 URL
npm run typecheck # TypeScript 类型检查
npm run lint      # oxlint
```

端到端冒烟测试与截图（需要先启动 `npm run preview`）：

```bash
npm run screenshots
```

脚本使用本机 Chrome，覆盖首页、学习、继续学习、收藏与收藏复习、乱序、次日复习（注入逾期数据）、统计、词典本地/在线详情、离线重载和个人页。

## 项目结构

```
public/data/            生成的词典数据
  dictionary.json       去重词典（词条 / 音标 / 释义 / 所属词库）
  lists/*.json          各词库的单词顺序
  meta.json             词库元数据与数据版本
scripts/
  fetch-dictionaries.mjs  词库下载、去重、生成数据
  build-macos-app.sh      构建原生 macOS WKWebView App
  screenshots.mjs         Playwright 冒烟测试
netlify/
  functions/word-details.mjs  有道词组/双语例句代理
desktop/
  main.swift             原生窗口 + 本地服务 + 系统通知
  Info.plist             App 元数据
supabase/
  schema.sql             云同步表与 RLS 策略
env.example              云同步环境变量模板
src/
  lib/date.ts           本地日期工具
  lib/srs.ts            艾宾浩斯间隔算法
  lib/selectors.ts      到期队列、每日目标、顺序/乱序、收藏排序
  lib/storage.ts        localStorage 读写、校验与云端状态规范化
  lib/data.ts           词库数据加载与缓存
  lib/onlineDict.ts     有道 JSONP + Free Dictionary API
  lib/tts.ts            标准美音/英音与 TTS 回退
  lib/reminder.ts       每日提醒与原生桥接
  lib/wordDetails.ts    词组/例句客户端与缓存
  lib/supabase.ts       Supabase 客户端
  state/                AppState reducer + Account 云同步
  pages/                今日 / 词库 / 词典 / 收藏 / 统计 / 我的 / 学习 / 复习
  components/           导航、学习卡片、词组例句、账号面板、通用组件
tests/                  单元测试
```

## 数据来源与授权

- 词库数据来自 [qwerty-learner](https://github.com/RealKai42/qwerty-learner)，上游项目使用 **GPL-3.0**。如果要将词库数据用于其他许可证或商业场景，请自行确认上游及原始词表权利人的授权。
- 在线中文释义由有道词典 suggest 接口提供；英文释义与音频由 [Free Dictionary API](https://dictionaryapi.dev/) 提供；词组和双语例句由 Netlify Function 代理有道 `jsonapi` 提供。在线查询只发送所查单词，不发送账号或学习数据。
- 发音优先使用有道词典的标准美音/英音音频，音频不可用时回退到 Free Dictionary 音频或浏览器 TTS。

## 许可证

本项目以 **GNU General Public License v3.0 only（GPL-3.0-only）** 发布，完整条款见根目录 [LICENSE](LICENSE)。

## 已知限制

- 未登录时，学习数据只保存在当前浏览器或 WebView 中，清理站点数据会丢失进度；登录 Supabase 账号后会同步到云端，可在其他设备恢复。
- 词库外查词以及每个词的「词组与例句」需要网络；有道或 Free Dictionary 不可用时会降级显示或提示重试。离线不影响已缓存词库的学习与复习。
- 暂不支持自定义词库导入。手机端通过 PWA 安装；原生 macOS App 依赖 Node/npm 和本项目目录，移动目录或升级 Node 后需要重新构建。
