# 参考项目

| 项 | 内容 |
| --- | --- |
| 事实核对日期 | 2026-11-14 |
| 核对方式 | 读取各项目 GitHub 仓库页与 README；个别项目读取了源码文件头，已在表中注明 |

许可证与实现语言决定了每个项目能以什么方式被参考。下表中的许可证是核对当日的状态，移植任何代码前必须重新确认。

## 1. 使用原则

1. WaiShe 不以合并参考项目源码为目标。优先复用的是协议知识、设计思路和测试方法。
2. 协议事实（报文格式、命令编号）本身不是可版权的表达，但照着某份源码逐段改写属于衍生作品，须遵守其许可证。
3. 移植或改写代码时：保留原版权声明，在对应驱动仓库的 `PROVENANCE.md` 中登记来源文件、提交哈希和许可证。
4. 许可证不明或不兼容的项目只能阅读其文档和观察其行为，不复制代码。
5. 许可证策略见 [ADR-0002](decisions/0002-licensing.md)。

## 2. 总览

| 项目 | 许可证 | 语言 | 可移植代码 | 主要参考价值 |
| --- | --- | --- | --- | --- |
| [OpenMouse](https://github.com/OpenMouse-Project/openmouse) | AGPL-3.0 | TypeScript | 仅进入 AGPL 兼容的仓库 | 产品形态、Dashboard、设备界面 |
| [OpenMouse Bridge](https://github.com/OpenMouse-Project/OpenMouse-Bridge) | `Cargo.toml` 声明 MIT；仓库无 LICENSE 文件，GitHub 未识别出许可证 | Rust | 授权状态不明确，暂不复制 | 本地程序形态、托盘、回环 API、来源白名单 |
| [OpenMouse mouse-protocol](https://github.com/OpenMouse-Project/mouse-protocol) | AGPL-3.0 | TypeScript | 仅进入 AGPL 兼容的仓库 | Razer 等鼠标协议、抓包与硬件证据规范 |
| [OpenMouse keyboard-protocol](https://github.com/OpenMouse-Project/keyboard-protocol) | 未核对 | TypeScript | 核对后再定 | 键盘协议、能力差异 |
| [HyperBatteryMonitor](https://github.com/davidsantanaalves/HyperBatteryMonitor) | MIT | C#（.NET 10、WinForms） | 可以，保留版权声明 | HyperX 耳机协议、接口探测、重连处理 |
| [BatteryMonitor](https://github.com/JKWTCN/BatteryMonitor) | MIT | C++（Qt 6） | 可以，保留版权声明 | 多来源电量聚合、沙箱化插件、验证状态分级 |
| [libratbag](https://github.com/libratbag/libratbag) | MIT | C | 可以，保留版权声明 | 驱动抽象、设备数据文件与驱动代码分离 |
| [OpenRGB](https://github.com/CalcProgrammer1/OpenRGB) | GPL-2.0（是否含“或更高版本”未核对） | C++ | 核对后再定 | 多厂商适配器组织、社区维护模式 |
| [ClickSync](https://github.com/Nuitfanee/ClickSync) | GPL-2.0（是否含“或更高版本”未核对） | JavaScript | 确认前视为与 AGPL-3.0 不兼容，不复制 | 标准键抽象、能力开关驱动界面、Razer 与厂商软件冲突的说明 |

## 3. 逐项说明

### 3.1 OpenMouse

- 浏览器内控制台，基于 WebHID。协议实现在独立的 `@openmouse/protocol` 包中。
- 值得借鉴：界面只显示驱动实际实现的控件；明确声明“型号被识别不等于硬件认证”；对无法回读的写入如实说明。
- 与 WaiShe 的结构差异见[架构第 8 节](architecture.md#8-与-openmouse-的架构差异)。

### 3.2 OpenMouse Bridge

README 中与 WaiShe 直接相关的做法：

- 以登录用户身份运行，不是提权的 Windows 服务，原因是托盘和通知需要用户会话。
- HTTP API 只绑定 `127.0.0.1`，并强制来源白名单，CORS 与 WebSocket 升级都检查。
- 每 5 分钟读取一次电量；超过 12 分钟的读数标为“上次已知”而非实时。
- 低电量通知有阈值和冷却时间。
- 日志不记录 HID 报文内容和完整序列号。
- 更新从 GitHub Release 下载，校验 SHA-256，默认不自动更新。
- 明确写出“选中配置不等于硬件写入成功”。

技术栈（`Cargo.toml`）：axum、hidapi、tray-icon、notify-rust、tokio、reqwest。可作为 M0 选型的起点。

### 3.3 OpenMouse mouse-protocol

- 编解码与传输分离：纯编解码入口不依赖 WebHID。
- 仓库内有 `captures/` 目录保存各设备的抓包与硬件测试记录；设备目录带 `verified` 字段区分实机验证与仅识别。
- 包含 `razer`、`razer-v4`、`razer-devices` 等入口，是 Razer 驱动的主要协议来源之一。
- 其 `CONTRIBUTING.md` 规定了硬件证据要求，WaiShe 的贡献指南参考了这一做法。

### 3.4 HyperBatteryMonitor

- 首期 HyperX 驱动最重要的参考。README 标明 Cloud III Wireless 支持电量、充电、麦克风静音，且由维护者实机检查过。
- 值得借鉴：用电量应答来验证候选控制接口，记住可用接口，重连后重新验证。
- 提到部分接收器在充电时电量读数偏高，说明电量曲线需要按接收器校准。
- 其历史代码参考过另一个项目，声明保存在它的 `THIRD_PARTY_NOTICES.md` 中。移植时需一并处理。

### 3.5 BatteryMonitor

- 按数据来源拆分 Provider：BLE、经典蓝牙、XInput、各品牌 HID。
- 用沙箱化的 QuickJS 运行 JS 插件扩展 HID 设备：插件没有文件、网络、进程访问，只能向匹配的设备收发报文。这与 WaiShe 的 DRV-06 是同一思路，是 ADR-0003 的备选方案之一。
- 兼容表分“已验证”“理论支持，未验证”“部分验证”三档。
- 提供 WebSocket JSON-RPC 接口供外部工具读取电量。

### 3.6 libratbag

- 设备以数据文件描述（型号、标识、所用驱动），驱动代码按协议族组织。WaiShe 的“设备表优先于代码分支”（DRV-08）来自这一思路。

### 3.7 OpenRGB

- 参考其多厂商适配器的目录组织与社区贡献流程。功能范围（RGB）不在 WaiShe 首期内。

### 3.8 ClickSync

- 用“标准键”统一不同品牌的读写，界面按能力开关显示或隐藏控件。
- 写入策略：回读、增量写入、防抖、失败后回读纠偏。
- README 提示使用 Razer 鼠标前需完全退出雷云，否则配置可能被覆盖。这是需求 CFG-04 与风险 R2 的依据。

## 4. 规划过程中新发现的参考

以下项目不在初稿列表中，是核对首批设备信息时查到的。

| 项目 | 许可证 | 用途 |
| --- | --- | --- |
| [openrazer](https://github.com/openrazer/openrazer) | GPL-2.0-or-later（已读取 `driver/razermouse_driver.h` 文件头） | Linux 上的 Razer 驱动。提供了 DeathAdder V3 Pro 的 USB 产品 ID，是 Razer 协议的另一个来源 |
| [HaloBattery](https://github.com/HeyOkay/HaloBattery) | 未核对 | 其 `docs/protocols.md` 记录了多款耳机的电量协议线索，含 Cloud III Wireless，但该条目自述未经实机验证 |
| [HyperHeadset](https://github.com/LennardKittner/HyperHeadset) | 未核对 | HyperX 耳机的命令行与托盘工具，被 HaloBattery 引为 Cloud III Wireless 协议的来源 |

## 5. 待核对

- OpenMouse keyboard-protocol、HaloBattery、HyperHeadset 的许可证。
- OpenRGB 与 ClickSync 的 GPL-2.0 是否带“或更高版本”。
- OpenMouse Bridge 的授权状态：建议向其维护者确认，或等待仓库补充 LICENSE 文件。
