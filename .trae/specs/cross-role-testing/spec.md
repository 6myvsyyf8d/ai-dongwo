# 多角色交叉测试 Spec

## Why
当前测试脚本 `test_all_roles.py` 只验证每个角色独立登录和基础页面渲染，未覆盖跨角色数据共享场景。用户反馈"测试用户只有 2 个"，经排查实际 10 个测试账号均完整存在，但测试脚本未覆盖所有账号和交叉场景。需要扩展测试脚本，覆盖多角色交叉交互（如家长录入→老师查看→照护者安全卡→心青年本人查看），确保数据隔离和共享逻辑正确。

## What Changes
- 扩展 `test_all_roles.py`：从 6 角色测试扩展为 10 账号全量测试
- 新增交叉场景测试：家长录入记录 → 其他角色查看记录可见性
- 新增交接任务测试：创建交接任务 → 接收方查看并切换状态
- 新增底部导航验证：所有角色导航项完整性检查
- 新增分析页验证：家长主页健康速报卡片、分析页日报/周报/月报 Tab

## Impact
- Affected specs: 无（纯测试增强）
- Affected code: `test_all_roles.py`

## ADDED Requirements

### Requirement: 全量账号登录测试
系统 SHALL 支持 10 个测试账号全部通过快速登录验证。

#### Scenario: 所有账号登录成功
- **WHEN** 使用快速登录依次点击每个账号
- **THEN** 每个账号均成功进入对应主页，无 JS 错误

### Requirement: 跨角色记录可见性测试
系统 SHALL 确保不同角色对同一心青年的记录具有正确的可见性（full vs safety_only）。

#### Scenario: 家长录入记录后志愿者查看
- **WHEN** 家长为小明录入一条 visibilityLevel=safety_only 的记录
- **THEN** 志愿者登录后仅能看到该记录，看不到 visibilityLevel=full 的记录

#### Scenario: 老师录入记录后家长查看
- **WHEN** 老师为小明录入一条记录
- **THEN** 小明爸爸登录后能看到该记录

### Requirement: 交接任务跨角色测试
系统 SHALL 支持跨角色创建和切换交接任务状态。

#### Scenario: 创建交接任务并切换状态
- **WHEN** 小明爸爸创建一条交接任务给小明保姆
- **THEN** 小明保姆登录后能看到该任务，点击切换状态后任务状态变更

### Requirement: 底部导航完整性
系统 SHALL 确保所有角色（除 government）底部导航显示正确的 6 个导航项。

#### Scenario: 非政府角色导航验证
- **WHEN** 任意非 government 角色登录
- **THEN** 底部导航显示：主页、记录、分析、档案、对话、管理

### Requirement: 分析页功能验证
系统 SHALL 确保家长主页健康速报卡片正确渲染，分析页日报/周报/月报 Tab 正常切换。

#### Scenario: 家长主页健康速报
- **WHEN** 小明爸爸登录
- **THEN** 主页显示"今日健康速报"卡片，包含 5 模块状态

#### Scenario: 分析页 Tab 切换
- **WHEN** 点击底部导航"分析"图标
- **THEN** 显示日报/周报/月报三个 Tab，默认选中日报，可正常切换