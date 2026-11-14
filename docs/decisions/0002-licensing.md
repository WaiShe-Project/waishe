# ADR-0002 分层许可证策略

| 项 | 内容 |
| --- | --- |
| 状态 | 已接受 |
| 日期 | 2026-11-14 |
| 决定人 | 项目发起人 |

本文是工程层面的许可证安排，不构成法律意见。

## 背景

WaiShe 要参考的协议实现分布在不同许可证下（详见 [references.md](../references.md)）：

- OpenMouse 及其 mouse-protocol：AGPL-3.0。
- openrazer：GPL-2.0-or-later。
- HyperBatteryMonitor、BatteryMonitor、libratbag：MIT。

移植 copyleft 代码得到的驱动必须沿用兼容的 copyleft 许可证。同时，项目希望第三方驱动的作者能自由选择许可证，并希望核心部分易于被其他项目采用。

## 决定

**核心部分采用宽松许可证，驱动按代码来源各自决定。**

| 仓库 | 许可证 | 说明 |
| --- | --- | --- |
| `waishe` | MIT OR Apache-2.0 | Dashboard 与项目文档 |
| `waishe-bridge` | MIT OR Apache-2.0 | |
| `waishe-driver-sdk` | MIT OR Apache-2.0 | 驱动要链接或依赖它，必须宽松，否则会限制所有驱动的许可证选择 |
| `waishe-driver-registry` | MIT OR Apache-2.0 | 索引工具与数据 |
| `driver-razer` | AGPL-3.0-or-later | 预期移植或参照 OpenMouse（AGPL-3.0）与 openrazer（GPL-2.0-or-later）；后者可升级到 GPL-3.0 后与 AGPL-3.0 组合 |
| `driver-hyperx` | MIT | 预期参照 HyperBatteryMonitor（MIT） |
| `.github` | MIT OR Apache-2.0 | |
| 第三方驱动 | 作者自定，须为 OSI 认可的开源许可证方可被 Registry 收录 | |

“MIT OR Apache-2.0”是 Rust 生态的惯例双许可，使用者任选其一。

## 规则

1. **来源登记。** 每个驱动仓库维护 `PROVENANCE.md`，逐项列出参考或移植的来源、其许可证、对应的文件或提交。没有登记来源的协议代码不合并。
2. **代码流向只能从宽松到 copyleft。** 宽松许可证仓库（Bridge、SDK、Registry、Dashboard、`driver-hyperx`）不得包含移植自 AGPL 或 GPL 项目的代码。需要这类代码的功能必须放在 copyleft 驱动里。
3. **Bridge 安装包不捆绑驱动。** 驱动作为独立的包按需下载，这同时也是产品需求 DRV-01。
4. **Registry 记录并展示每个驱动的许可证**，使用 SPDX 标识符。
5. **保留版权声明。** 移植 MIT 代码时保留原版权与许可声明，包括上游自身携带的第三方声明。
6. **贡献者签署 DCO。** 提交带 `Signed-off-by`，表明有权按仓库许可证贡献该代码。
7. **许可证不明的项目不复制代码。** 目前包括 OpenMouse Bridge（仓库缺少 LICENSE 文件）以及尚未确认是否带“或更高版本”的 GPL-2.0 项目（ClickSync、OpenRGB）。GPL-2.0-only 与 AGPL-3.0 不兼容。

## 备选方案

| 方案 | 未采用的原因 |
| --- | --- |
| 全项目 AGPL-3.0-or-later | 法律关系最简单，但第三方驱动必须 AGPL 兼容，核心部分也难以被宽松许可证项目复用 |
| 全项目宽松许可证，Razer 驱动净室重写 | 无法利用 OpenMouse 已有的 Razer 实现；净室流程对小团队成本高，且难以自证 |
| 暂不决定 | 没有许可证的仓库默认保留所有权利，无法接受外部贡献 |

## 后果

- 宽松许可证的 Bridge 在运行时加载 AGPL 驱动。即使按最保守的理解把二者视为组合作品，MIT 与 Apache-2.0 也都与 AGPL-3.0 兼容，组合后的整体按 AGPL 条款分发即可，Bridge 自身的许可证不变。全部组件均开源，因此不存在无法满足的义务。
- 任何人再分发“Bridge + AGPL 驱动”的捆绑包时，须对整体履行 AGPL 义务。官方不发布这样的捆绑包。
- `driver-razer` 的代码不能反向流入 Bridge 或 SDK。通用逻辑若有价值，须在宽松许可证仓库中独立重写。
- 若日后 `driver-razer` 改为不依赖任何 copyleft 来源的独立实现，可经全体版权人同意后改变许可证。
