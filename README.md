# WaiShe（外设）

开源的跨品牌外设统一管理平台：一个轻量本地程序、一个统一网页控制台、按需安装的设备驱动。

> **WaiShe** ("peripherals" in Chinese) is an open-source, local-first manager for PC peripherals across brands. A small background app (Bridge) talks to your devices through installable user-mode drivers, shows battery levels in the system tray, and serves a web dashboard for settings such as DPI and polling rate. Windows first. The project is in the planning stage; documentation is currently in Chinese.

**当前阶段：需求规划。尚无可运行的代码和发行版。**

## 它要解决什么

同时使用多个品牌的外设时，查看电量、调 DPI 这类基础操作要分别打开 Razer Synapse、Logitech G HUB、HyperX NGENUITY 等软件。WaiShe 的目标是把这些各家重复实现的基础能力统一起来：

- 一个入口发现并管理不同品牌、不同类型的外设。
- 不打开网页也能在系统托盘查看所有外设的电量。
- 只安装自己设备需要的驱动。
- 日常使用不依赖厂商软件常驻，也不依赖网络。
- 第三方可在独立仓库开发驱动并通过 Registry 分发。

它不打算复刻任何厂商软件的全部功能。

## 组成

| 组成 | 仓库 | 职责 |
| --- | --- | --- |
| Web Dashboard | `waishe`（本仓库） | 统一的网页控制台，按设备能力渲染界面 |
| Bridge | `waishe-bridge` | 本地常驻程序：设备发现、驱动宿主、后台电量监控、托盘、本地 API |
| Driver SDK | `waishe-driver-sdk` | 驱动接口规范、能力模型、开发与测试工具 |
| Driver Registry | `waishe-driver-registry` | 设备兼容表、驱动索引、验证记录 |
| 驱动 | `driver-razer`、`driver-hyperx` | 各品牌的用户态协议适配，不是内核驱动 |
| 社区规范 | `.github` | 贡献指南、行为准则、安全策略、Issue 与 PR 模板 |

## 首批设备

| 设备 | 首期能力 |
| --- | --- |
| Razer DeathAdder V3 Pro | 电量、DPI、回报率、连接状态 |
| HyperX Cloud III Wireless | 电量、充电状态、连接状态、麦克风静音状态 |

两款设备目前均处于“计划支持，尚未验证”的状态。

## 文档

| 文档 | 内容 |
| --- | --- |
| [需求规格说明](docs/requirements.md) | 编号的功能与非功能需求、首期验收条件、风险、待决事项 |
| [架构概览](docs/architecture.md) | 组件边界、数据模型、关键流程、版本兼容 |
| [路线图](docs/roadmap.md) | M0 至 M4 的范围与退出条件 |
| [参考项目](docs/references.md) | 各参考项目的许可证、可借鉴内容与复用规则 |
| [决策记录](docs/decisions/README.md) | 跨仓库的架构与组织决策 |

接口规范在各自的仓库：

| 规范 | 位置 |
| --- | --- |
| 驱动接口、能力模型 | `waishe-driver-sdk` 仓库 `docs/` |
| 本地 API | `waishe-bridge` 仓库 `docs/local-api.md` |
| 索引与驱动包格式 | `waishe-driver-registry` 仓库 `docs/registry-format.md` |

## 本仓库的范围

- 项目级文档：需求、架构、路线图、决策记录。跨仓库的议题在这里开 Issue。
- Web Dashboard 的源码。技术栈尚未选定（需求待决事项 Q7），代码目录在 M0 之后建立。

## 参与

项目处于规划阶段，现在最有价值的参与方式是评审需求与架构文档，以及提供设备信息。贡献流程见 `.github` 仓库的 `CONTRIBUTING.md`。所有仓库都在 [WaiShe-Project](https://github.com/WaiShe-Project) 组织下。

## 许可证

本仓库采用 [MIT](LICENSE-MIT) 或 [Apache-2.0](LICENSE-APACHE) 双许可，使用者任选其一。各驱动仓库的许可证各不相同，见[决策记录 0002](docs/decisions/0002-licensing.md)。

## 声明

WaiShe 是独立的社区项目，与 Razer、HP、HyperX、Logitech、SteelSeries 及其他任何外设厂商没有关联，也未获其认可或赞助。文中出现的品牌和产品名称是其各自所有者的商标，仅用于指明兼容对象。
