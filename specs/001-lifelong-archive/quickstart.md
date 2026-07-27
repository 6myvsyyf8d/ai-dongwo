# Quickstart: AI懂我 - 全生涯数据灯塔

**Feature**: 001-lifelong-archive
**Date**: 2026-07-25
**Target Audience**: 开发者（实现阶段参考）
**Prerequisites**: 已阅读 [spec.md](./spec.md) 和 [research.md](./research.md)

---

## 项目概述

AI懂我是一款面向心智障碍者全生涯照护的动态支持档案系统。为每一个心青年建一座"数据灯塔"——让照护不断层，让决策有依据。

当前版本（v1.x）为纯前端单页应用，使用原生 HTML/CSS/JS + localStorage 存储，无服务端依赖。

---

## 技术栈

| 类别 | 选型 | 版本 |
|------|------|------|
| 标记语言 | HTML5 | - |
| 样式 | CSS3 | - |
| 脚本 | 原生 JavaScript (ES6+) | - |
| 存储 | localStorage (JSON) | - |
| 二维码 | qrcode.js | latest |
| 图表 | Chart.js | 4.x |
| PDF 导出 | html2pdf.js | latest |
| 字体 | Noto Sans SC / Noto Serif SC | latest |

> **不引入任何前端框架**（React/Vue/Angular），符合 Constitution v2.0.0 原则 V。

---

## 项目文件结构

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
    └── 001-lifelong-archive/
        ├── spec.md
        ├── plan.md
        ├── research.md
        ├── data-model.md
        ├── quickstart.md
        └── contracts/
```

---

## 核心模块开发顺序

按 Constitution 原则 III（核心功能优先），建议按以下顺序实现：

### Step 1: 基础设施（1-2 天）

| 任务 | 文件 | 说明 |
|------|------|------|
| 全局状态 | `js/state.js` | 定义 AppState 对象，管理当前用户、当前档案、UI 状态 |
| 存储层 | `js/storage.js` | 封装 localStorage CRUD，提供统一读写接口 |
| 工具函数 | `js/utils.js` | UUID v4 生成、日期格式化、PIN 哈希（SHA-256）、身份证号校验 |
| 路由系统 | `js/app.js` | 基于 hash 的 SPA 路由，页面切换逻辑 |

**关键接口**：
```javascript
// storage.js
const Storage = {
  get(key) → JSON | null,
  set(key, value) → void,
  remove(key) → void,
  getProfiles() → { [youthId]: YouthProfile },
  saveProfile(profile) → void,
  getRecords(youthId) → RecordEntry[],
  addRecord(youthId, record) → void,
  // ... 完整接口见 contracts/storage-interface.md
};

// state.js
const AppState = {
  currentUser: null,       // UserAccount
  currentYouth: null,     // YouthProfile
  currentPage: 'login',   // 当前页面路由
  // ... 详见 contracts/
};
```

### Step 2: 认证与档案创建（2-3 天）— P0

| 任务 | 文件 | 对应需求 |
|------|------|----------|
| 角色注册 | `js/auth.js` | FR-002: 6 种角色注册 |
| PIN 登录 | `js/auth.js` | FR-002: PIN 码认证 |
| 档案创建 | `js/profile.js` | FR-001: 身份证号主键、终身档案 |
| 档案码生成 | `js/archive-code.js` | FR-001: 二维码档案码 |
| 档案码打印 | `js/archive-code.js` | 实体卡片打印支持 |

**测试数据**（虚构人物）：
```javascript
// 测试心青年
const TEST_YOUTH = {
  name: "小雨",
  gender: "female",
  birthDate: "1998-03-15",
  idNumber: "210202199803152048"  // 虚构身份证号
};

// 测试家长
const TEST_PARENT = {
  name: "王妈妈",
  role: "parent",
  pin: "123456"
};
```

### Step 3: 多角色记录采集（2-3 天）— P0

| 任务 | 文件 | 对应需求 |
|------|------|----------|
| 记录录入表单 | `js/records.js` | FR-003: 多角色录入 |
| 模块分类 | `js/records.js` | FR-012: 6 大模块结构化存储 |
| 角色时间戳 | `js/records.js` | FR-003: 自动标注角色和时间 |
| 权限检查 | `js/permissions.js` | FR-006: 角色权限差异化 |
| 授权管理 | `js/permissions.js` | 家长授权老师/照护者/志愿者访问 |

### Step 4: 速读卡生成（1-2 天）— P0

| 任务 | 文件 | 对应需求 |
|------|------|----------|
| 信息提取算法 | `js/quickcard.js` | FR-004: 自动提取关键信息 |
| 模板渲染 | `js/quickcard.js` | A4 单页布局 |
| 打印支持 | `js/quickcard.js` + `css/quickcard.css` | FR-005: 可打印速读卡 |

**速读卡提取规则**：
1. 沟通方式：从 `communicationGuide.preferredMethods` 提取，最多 5 条
2. 行为红线：从 `emotionBehavior.behaviorRedLines` 提取，按 severity 排序，最多 5 条
3. 急救联系人：从 `emergencyContacts` 提取
4. 近期情绪趋势：从 `emotionBehavior.emotionTrend` 取最近 7 天
5. 近期注意事项：从 `careMedical` 提取过敏/用药 + 最近 3 天的 daily_care 记录

### Step 5: 时间轴与检索（1-2 天）— P1

| 任务 | 文件 | 对应需求 |
|------|------|----------|
| 时间轴展示 | `js/timeline.js` | FR-010: 按时间倒序 |
| 筛选功能 | `js/timeline.js` | FR-010: 按角色/模块/时间筛选 |
| 虚拟滚动 | `js/timeline.js` | SC-009: 1000+ 条记录性能 |

### Step 6: 对话式采集（1-2 天）— P1

| 任务 | 文件 | 对应需求 |
|------|------|----------|
| 引导问题模板 | `js/chatbot.js` | FR-011: AI 引导提问 |
| 关键词分类 | `js/chatbot.js` | research.md 决策 5 |
| 实时归类面板 | `js/chatbot.js` | spec.md US7: 实时显示分类结果 |

### Step 7: 数据可视化（1 天）— P2

| 任务 | 文件 | 对应需求 |
|------|------|----------|
| 情绪曲线 | `js/charts.js` | FR-015: Chart.js 折线图 |
| 能力雷达图 | `js/charts.js` | FR-015: Chart.js 雷达图 |
| 行为趋势 | `js/charts.js` | FR-015: 统计图表 |

### Step 8: 政府看板（1 天）— P2

| 任务 | 文件 | 对应需求 |
|------|------|----------|
| 聚合统计 | `js/government.js` | FR-013: 脱敏聚合 |
| 看板 UI | `js/government.js` | FR-013: 年龄分布/需求/缺口 |
| 零接触验证 | `js/government.js` | FR-014: 禁止钻取个体 |

---

## 关键技术要点

### UUID v4 生成（前端无依赖）

```javascript
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
```

### PIN 哈希（SHA-256）

```javascript
async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'ai-dongwo-salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### 身份证号校验

```javascript
function validateIdNumber(id) {
  const pattern = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
  if (!pattern.test(id)) return false;
  // 校验位验证（标准 GB 11643-1999）
  const weights = [7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2];
  const checks = '10X98765432';
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += parseInt(id[i]) * weights[i];
  return checks[sum % 11] === id[17].toUpperCase();
}
```

### 二维码生成

```javascript
// 使用 qrcode.js
function generateArchiveQR(youthId, hmacToken) {
  const url = `${window.location.origin}/archive/${youthId}?token=${hmacToken}`;
  return QRCode.toDataURL(url, { width: 256, margin: 2 });
}
```

---

## 本地开发

### 启动方式

由于是纯前端应用，无需构建步骤：

```bash
# 方式 1: 直接打开
open index.html

# 方式 2: 本地服务器（推荐，支持 SPA 路由）
cd ai-dongwo
python3 -m http.server 8080
# 或使用 VS Code Live Server 插件
```

### 测试数据初始化

在浏览器控制台执行：

```javascript
// 初始化测试数据（开发环境）
await Storage.initTestData();
```

`storage.js` 应提供 `initTestData()` 方法，创建虚构测试人物（小雨、小明等）及其档案。

---

## Constitution 合规检查清单

开发过程中，每个模块上线前需确认：

- [ ] 功能回答了"这束光照亮了哪个照护断层？"（原则 I）
- [ ] 心青年是数据中心，其他角色是临时接入者（原则 II）
- [ ] UI 文案无标签化/歧视性表述（原则 IV）
- [ ] 数据主权机制正确（权限回收、脱敏处理）（原则 IV）
- [ ] 未引入新的第三方库（或已评估必要性）（原则 V）
- [ ] 新代码文件 < 300 行（原则 V）

---

## 下一步

完成 Phase 1 设计后，运行 `$speckit-tasks` 生成具体的开发任务清单（tasks.md）。
