# WaiShe Dashboard

WaiShe 的网页控制台。它是纯静态资源：构建产物由 `waishe-bridge` 内嵌，并在 `http://127.0.0.1:27463/` 同源提供（ADR-0004）。Dashboard 只通过本地 API 与 Bridge 交互，接口契约见 `waishe-bridge` 仓库的 `docs/local-api.md`（API 0.1）。

技术选型：Preact + TypeScript（strict）+ Vite，纯 CSS（自定义属性，按 `prefers-color-scheme` 切换明暗），不引入 UI 框架与 CSS 框架。页面不发起任何外部网络请求（无外部字体、CDN、统计），离线可用。

## 脚本

需要 Node 20.19+ 或 22.12+。

| 命令 | 作用 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run mock` | 启动模拟 Bridge（`mock/server.mjs`，仅用 Node 内置模块），默认端口 27463，可用环境变量 `PORT` 修改 |
| `npm run dev` | 启动 Vite 开发服务器，`/api` 与 `/auth` 代理到 `http://127.0.0.1:27463`；可用环境变量 `WAISHE_API_TARGET` 修改代理目标 |
| `npm run build` | 构建到 `dist/`（资源使用相对路径） |
| `npm run typecheck` | TypeScript 类型检查 |

### 本地开发

1. 一个终端运行 `npm run mock`，另一个终端运行 `npm run dev`。
2. 浏览器先打开 `http://localhost:5173/auth?code=dev` 取得会话 Cookie（模拟托盘“打开 Dashboard”的一次性授权），随后跳转到首页。加上 `&next=%23%2Fpanel` 则直接进入紧凑面板，与原生设置窗口的登录方式相同。
3. 不带会话直接访问会得到 401，用于检查“请从系统托盘打开”的提示。

也可以先 `npm run build`，再只运行 `npm run mock`，打开 `http://127.0.0.1:27463/auth?code=dev`：模拟服务器同时提供 `dist/`。

### 模拟服务器

内存中的假数据：

- Razer DeathAdder V3 Pro（接收器，电量 89，DPI 800×800，回报率 1000 Hz）
- HyperX Cloud III Wireless（电量 47，未充电，麦克风静音状态只读 + 通知）
- HyperX Pulsefire Haste 2 Wireless（已断开，读数为历史值或不可用，电量按 4 档报告）
- 驱动 `razer`（AGPL-3.0-or-later）与 `hyperx`（MIT），信任层级均为 `local`

事件流每 4 秒模拟一次变化（麦克风静音切换、电量变化），每 15 秒发送保活注释。写入延迟约 200 ms 后返回 `applied`，不满足约束时返回 422 `rejected`。为覆盖通用控件，模拟数据另含几项不在标准目录中的能力（`mouse.lift_off_distance`、`headset.sidetone`、`headset.sleep_timer`），并带测试钩子：

| 写入 | 结果 |
| --- | --- |
| `mouse.lift_off_distance` = 3 | 设备拒绝，`rejected` |
| `mouse.lift_off_distance` 其他值 | `accepted`（无法回读） |
| `headset.sleep_timer` = `30min` | 模拟超时，`failed`，返回重新读取的值 |

开启开发者模式后可上传任意以 ZIP 文件头开头的 `.wsdrv` 文件来模拟安装本地驱动。`/status` 报告正在运行 Razer Synapse（`brand: "Razer"`），因此只有 Razer 设备的详情页会出现“厂商软件可能覆盖设置”的提示。

## 结构

```
dashboard/
├─ index.html
├─ vite.config.ts
├─ mock/server.mjs          模拟 Bridge
└─ src/
   ├─ main.tsx              入口
   ├─ app.tsx               连接状态门（401、Bridge 未运行、版本不兼容）、导航与路由分发
   ├─ router.ts             手写 hash 路由：#/、#/hid、#/device/<id>、#/drivers、#/settings、#/panel
   ├─ styles.css
   ├─ api/                  契约类型与 fetch 封装
   ├─ state/
   │  ├─ store.ts           全局状态与订阅
   │  └─ connection.ts      事件流、基线拉取、退避重连、401 与不可达判定
   ├─ i18n/                 zh-CN.ts（键的来源）、en.ts（同键，类型约束）、格式化工具
   ├─ lib/                  读数解释（实时 / 历史 / 不可用 / 未知）、约束校验
   ├─ components/            通用组件（读数显示、电量、开关、确认框等）
   ├─ capabilities/         按能力描述生成的条目与写入控件
   └─ views/                设备列表、全部 HID 设备、设备详情、驱动、设置、紧凑面板
```

## 约定

- **界面由能力清单生成**（GEN-01）：没有按型号或设备类型写死的页面。认识的能力（`battery.level`、`mouse.dpi` 等）有更合适的展示与文案，其余能力按 `type` 与 `constraint` 使用通用控件，未知标识直接显示原始 ID。
- **读数四态**：`ok` 显示值；`unavailable` 显示“暂时不可用”及原因，有 `lastOk` 时作为历史值附读取时间；`unknown` 显示“未知”。缺失的值不会显示成 0 或默认值。`stale` 为真或设备未连接时，值以弱化样式和“历史值 · 上次读取 …”标出。
- **写入不做乐观更新**：请求进行中控件禁用并显示进度，界面只采用响应或事件中的读数，并显示 `applied` / `accepted` / `rejected` / `failed` 四种结果之一。发送前按约束校验，服务器的 422 仍会被正确展示。
- **紧凑面板** `#/panel`：供 Bridge 原生设置窗口（约 380×520，APP-08）使用，只含设备状态与开机自启、低电量提醒、托盘图标设置，没有导航。
- 新增文案时必须同时修改 `zh-CN.ts` 与 `en.ts`；`en.ts` 的类型保证键完全一致。
