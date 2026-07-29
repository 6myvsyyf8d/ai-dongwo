# P0 关键 Bug 修复 Spec

## Why

根据 [路线图 P0](.trae/specs/project-review-and-roadmap/tasks.md) 梳理的两个 P0 阻塞型 Bug 直接影响用户核心体验：
1. **T1 交接任务状态切换失败**：点击「待处理」按钮无响应，无法将任务标记为已完成，直接削弱交接工作流的闭环能力。
2. **C4 档案卡片显示最旧记录**：家长首页的档案卡片展示的是时间最早的记录而非最新，严重误导用户了解孩子近况。

## What Changes

- **修复 T1**：定位交接任务按钮点击无响应的根因并修复，确保点击后状态正确切换（pending ↔ done）并立即反映到 UI。
- **验证 C4**：确认档案卡片使用 `records[0]` 取最新记录的代码已正确生效（排查到 [app.js:818](file:///Users/jinjun/Desktop/开发/参赛/ai-dongwo/js/app.js#L818) 已用 `records[0]`，需要加自动化测试验证）。
- **补充回归测试**：在 `test_all_roles.py` 中新增针对两个 bug 的断言。

## Impact

- Affected specs: 项目汇总与后续路线图（P0）
- Affected code:
  - [app.js](file:///Users/jinjun/Desktop/开发/参赛/ai-dongwo/js/app.js)：交接任务绑定逻辑 L1515-L1537，档案卡片 L814-L826
  - [storage.js](file:///Users/jinjun/Desktop/开发/参赛/ai-dongwo/js/storage.js)：`updateHandoverTask` L1020-L1032
  - [test_all_roles.py](file:///Users/jinjun/Desktop/开发/参赛/ai-dongwo/test_all_roles.py)：补充断言

## ADDED Requirements

### Requirement: 交接任务状态切换闭环
系统 SHALL 在用户点击交接任务的状态按钮时，正确调用 `Storage.updateHandoverTask()` 更新存储层状态并通过 `showDashboard({})` 重渲染首页，用户能立即看到状态变更。

#### Scenario: 待处理切换为已完成
- **GIVEN** 用户在首页看到一条 status=pending 的交接任务，按钮显示「待处理」
- **WHEN** 用户点击该按钮
- **THEN** `Storage.updateHandoverTask(youthId, taskId, {status: 'done'})` 返回 true
- **AND** 首页重新渲染后，该任务按钮显示「已完成」并带上 `.done` class

#### Scenario: 已完成切换回待处理
- **GIVEN** 用户在首页看到一条 status=done 的交接任务，按钮显示「已完成」
- **WHEN** 用户点击该按钮
- **THEN** 状态切换为 pending，按钮显示「待处理」

### Requirement: 档案卡片展示最新记录
系统 SHALL 在家长/老师首页的档案卡片摘要中，展示该心青年**最新一条**记录的文本，而不是最旧一条。

#### Scenario: 新录入记录立刻出现在档案卡片
- **GIVEN** 某心青年已有 N 条记录（按 `recordedAt` 降序，`records[0]` 为最新）
- **WHEN** 渲染档案卡片
- **THEN** 卡片摘要文本等于 `records[0].content.text` 的前 30 字

### Requirement: 两个 bug 的自动化断言
系统 SHALL 在多角色 E2E 测试中覆盖这两个场景，防止回归。

#### Scenario: Playwright 断言切换
- **WHEN** 小明保姆登录，点击第一条 pending 任务按钮
- **THEN** 1 秒后按钮文本从「待处理」变为「已完成」

## MODIFIED Requirements

无。

## REMOVED Requirements

无。
