# Unified Task System + Analytics Improvements — Design

**Date:** 2026-08-01
**Status:** Approved
**Context:** 整合分析页改进 + 统一任务系统，共 18 个任务

---

## Overview

两个并行的改进方向：
1. **分析页改进**（10 项）：基于审视报告，修复日报/周报/月报的可用性问题
2. **统一任务系统**（8 项）：参考 Outlook/Monday.com，将交接任务与心青年常规任务统一管理

---

## 1. Unified Task Data Model

### 1.1 Task Schema

```json
{
  "id": "uuid",
  "youthId": "uuid",
  "taskType": "routine | handover | adhoc",
  "assigneeId": "uuid (youth or caregiver)",
  "assigneeRole": "youth | caregiver",
  "content": "string",
  "category": "medication | meal | hygiene | activity | learning | handover | other",
  "status": "todo | in_progress | done",
  "recurrence": {
    "pattern": "daily | weekly | custom",
    "daysOfWeek": [1, 3, 5],
    "timeOfDay": "08:00"
  },
  "dueTime": "ISO datetime or time string",
  "handoverFrom": { "userId": "uuid", "role": "string" },
  "handoverTo": { "userId": "uuid", "role": "string" },
  "createdAt": "ISO datetime",
  "updatedAt": "ISO datetime",
  "completedAt": "ISO datetime | null"
}
```

### 1.2 Task Types

| Type | Description | recurrence | handoverFrom/To |
|------|-------------|------------|-----------------|
| `routine` | 心青年规律性任务 | required | null |
| `handover` | 照护者交接任务 | null | required |
| `adhoc` | 临时一次性任务 | null | null |

### 1.3 Status Flow

```
todo → in_progress → done
```

- `routine` tasks auto-generate daily instances with `todo` status
- `handover` tasks keep existing `pending` → `done` as `todo` → `done`
- `adhoc` tasks follow full flow

### 1.4 Recurrence Engine

- `daily`: generate instance every day with `dueTime`
- `weekly`: generate on specific days of week
- `custom`: generate on specified weekdays (e.g., [1,3,5] = Mon/Wed/Fri)
- Generated instances are separate records with `parentTaskId` linking back to template

### 1.5 Storage

- New key: `ai_dongwo_tasks` → `{ [youthId]: Task[] }`
- Old key: `ai_dongwo_handover_tasks` — migrated, then deprecated
- Migration: read old data, map to new schema, write to new key

---

## 2. Analytics Page Improvements

### P0 Items

1. **日报用药卡片** — `_renderDailySummary` 中增加独立用药状态卡片
2. **情绪趋势参考线** — Chart.js 添加 `annotation` 插件或手动绘制 ±0 参考线
3. **月报精简** — 合并 section 为 4 大块

### P1 Items

4. **今日亮点** — 扫描当日正向标签，生成鼓励文案
5. **照护进度条** — 将 `3/7 天` 改为 progress bar
6. **数据新鲜度** — 显示"基于最近 N 天数据"

### P2 Items

7. **关系地图入首页** — 速报增加 relationshipMap 卡片
8. **断档检测修复** — 滑动窗口检测中间断档

### P3 Items

9. **多模块情绪评分** — 扩展 `_calcEmotionScore` 到沟通、工作模块
10. **照护检测精细化** — 区分程度差异

---

## 3. Task UI Views

### 3.1 Caregiver Kanban View
- 3 columns: todo / in_progress / done
- Cards with: type badge, category tag, assignee, due time
- Click status button to advance state

### 3.2 Youth Today View
- Simple list with large emoji icons
- Progress bar at top
- Time-ordered tasks
- Large tap targets for completion toggle

### 3.3 Task Creation Form
- Unified form with task type selector
- `routine`: show recurrence config (pattern + time + weekdays)
- `handover`: show handover person selector
- `adhoc`: show due time + category only

---

## 4. Implementation Order

P0 → P1 → P2 → P3. Each phase verified before proceeding.

### Files to modify:
- `js/storage.js` — data model, CRUD, migration
- `js/app.js` — task UI, form, views
- `js/analytics-engine.js` — emotion scoring, anomaly detection
- `js/analytics-ui.js` — chart rendering, summary cards
- `css/main.css` — new styles for task views
- `css/analytics.css` — chart styles, progress bars
- `index.html` — version bump