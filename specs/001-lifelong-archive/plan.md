# Implementation Plan: AI懂我 - 全生涯数据灯塔

**Branch**: `001-lifelong-archive` | **Date**: 2026-07-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-lifelong-archive/spec.md`

## Summary

为心智障碍者构建全生涯动态支持档案系统——"数据灯塔"。核心功能包括：以身份证号为唯一主键的终身档案创建、二维码档案码生成、6 种角色的差异化记录采集、3 分钟速读卡自动生成与打印、记录时间轴与分类检索、对话式信息采集、以及政府宏观趋势看板。

技术方案采用纯前端单页应用（原生 HTML/CSS/JS + localStorage），按模块拆分为 14 个独立 JS 文件，通过全局命名空间和接口契约实现模块解耦，为后续服务端迁移预留数据结构扩展空间。

## Technical Context

**Language/Version**: JavaScript ES6+ (原生，无框架)

**Primary Dependencies**: qrcode.js (二维码), Chart.js 4.x (图表), html2pdf.js (PDF 导出)

**Storage**: localStorage (JSON 序列化，按实体类型分 key)

**Testing**: 手动测试清单（P0 核心功能），浏览器 DevTools

**Target Platform**: 现代浏览器（Chrome/Edge/Safari 最新两个版本）

**Project Type**: web-app (纯前端单页应用)

**Performance Goals**: 速读卡生成 < 3s；1000+ 条记录时间轴加载 < 2s；100+ 档案政府看板聚合 < 5s

**Constraints**: 无服务端依赖、离线可用、单文件部署、WCAG 2.1 AA 基础无障碍

**Scale/Scope**: 预估 14 个 JS 模块，每个 < 300 行；10 个 CSS 文件；7 个核心实体；6 大档案模块

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check (Phase 0)

| 原则 | 状态 | 说明 |
|------|------|------|
| I. 数据灯塔 | PASS | 所有技术决策均围绕"让照护不断层，让决策有依据" |
| II. 心青年中心 + 临时接入者 | PASS | 档案码 + 权限令牌双重机制确保数据跟人走 |
| III. 核心功能优先 | PASS | P0（档案码/记录/速读卡）优先实现，P2（看板）模拟 |
| IV. 数据主权与终身档案 | PASS | 权限模型实现 6 阶段生命周期；脱敏看板零接触 |
| V. 轻量与可维护 | PASS | 保持原生技术栈，模块化拆分文件 |

### Post-Design Check (Phase 1)

| 原则 | 状态 | 说明 |
|------|------|------|
| I. 数据灯塔 | PASS | data-model 以 YouthProfile 为核心，所有实体服务于心青年照护 |
| II. 心青年中心 + 临时接入者 | PASS | AccessGrant 实现临时接入；身份证号主键防止机构劫持 |
| III. 核心功能优先 | PASS | quickstart 8 步开发顺序严格按 P0→P1→P2 排列 |
| IV. 数据主权与终身档案 | PASS | 完整生命周期状态机（7 状态）；visibilityLevel 三级可见性；脱敏不可逆 |
| V. 轻量与可维护 | PASS | 14 个 JS 文件均 < 300 行；4 个接口契约确保模块解耦；无新增第三方库 |

**Gate Result**: ALL PASS — 可以进入 Phase 2 任务拆分

## Project Structure

### Documentation (this feature)

```text
specs/001-lifelong-archive/
├── plan.md              # 本文件
├── research.md          # Phase 0: 技术决策记录（8 项决策）
├── data-model.md        # Phase 1: 数据模型（7 实体 + 6 模块子模型）
├── quickstart.md        # Phase 1: 快速开始指南（8 步开发顺序）
├── contracts/           # Phase 1: 模块接口契约
│   ├── README.md         # 契约概览
│   ├── storage-interface.md   # storage.js 接口
│   ├── state-interface.md     # state.js 接口
│   ├── permissions-interface.md # permissions.js 接口
│   └── quickcard-interface.md  # quickcard.js 接口
├── checklists/
│   └── requirements.md   # 需求质量检查清单
└── tasks.md             # Phase 2 输出（由 $speckit-tasks 生成）
```

### Source Code (repository root)

```text
ai-dongwo/
├── index.html                  # 主入口页面
├── css/
│   ├── main.css                # 全局样式、变量、重置
│   ├── auth.css                # 登录/注册页样式
│   ├── profile.css             # 档案详情页样式
│   ├── records.css             # 记录采集页样式
│   ├── quickcard.css           # 速读卡样式（含打印）
│   ├── timeline.css            # 时间轴样式
│   ├── chatbot.css             # 对话采集样式
│   ├── charts.css              # 图表样式
│   └── government.css          # 政府看板样式
├── js/
│   ├── app.js                  # 主入口：路由、初始化、导航
│   ├── state.js                # AppState 全局状态管理
│   ├── storage.js              # 数据存储层（localStorage 抽象）
│   ├── utils.js                # 工具函数（UUID生成、日期格式化等）
│   ├── auth.js                 # 登录/注册/角色管理
│   ├── profile.js              # 心青年档案 CRUD
│   ├── archive-code.js         # 档案码生成、解析、打印
│   ├── records.js              # 多角色记录采集
│   ├── quickcard.js            # 速读卡生成与打印
│   ├── timeline.js             # 时间轴与分类检索
│   ├── chatbot.js              # 对话式信息采集
│   ├── permissions.js          # 角色权限管理
│   ├── charts.js               # 数据可视化（情绪曲线/雷达图）
│   └── government.js           # 政府看板（脱敏聚合）
├── assets/
│   ├── icons/                  # SVG 图标
│   └── fonts/                  # 字体文件
├── .specify/                   # Spec Kit 配置
├── .trae/                      # TRAE 工作流配置
└── specs/                      # 需求与设计文档
```

**Structure Decision**: 采用单页应用结构（Option 1 变体）。项目为纯前端应用，无后端，`js/` 目录下按功能模块拆分 14 个文件，通过全局命名空间（`Storage`、`AppState`、`Permissions`、`QuickCard`）暴露接口，由 `app.js` 统一初始化和路由管理。

## Complexity Tracking

> 无 Constitution 违规需记录。

## Artifacts Generated

| 制品 | 阶段 | 文件 | 说明 |
|------|------|------|------|
| 技术决策 | Phase 0 | research.md | 8 项技术决策，含替代方案和实现说明 |
| 数据模型 | Phase 1 | data-model.md | 7 个核心实体 + 6 个模块子模型，含 JSON Schema、关系图、存储布局、验证规则 |
| 快速开始 | Phase 1 | quickstart.md | 8 步开发顺序，含技术要点代码片段和测试数据 |
| 接口契约 | Phase 1 | contracts/ | 4 个核心模块的接口定义（Storage、AppState、Permissions、QuickCard） |
| 实施计划 | Phase 1 | plan.md（本文件） | 技术上下文、Constitution 检查、项目结构 |
