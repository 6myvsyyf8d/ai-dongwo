# 记录页双层筛选 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 records.js 的现有模块 Chip 筛选基础上新增日期 Chip 筛选行，实现 module + date 双层 AND 筛选。

**Architecture:** 纯前端 DOM 操作，不引入新依赖。`_filter` 扩展 `date` 字段，新增 `_isInDateRange()` 工具函数，`_applyFilter()` 同时检查 module 和 date 两个维度。日期 Chip 行复用现有 `.filter-chip` CSS 样式。

**Tech Stack:** Vanilla JS (ES5 兼容), CSS

**Key Date Format:** `recordedAt` 为 ISO 8601 字符串（`Utils.formatDateTime()` 返回 `new Date().toISOString()`），如 `"2026-07-25T08:00:00.000Z"`。

---

## File Structure

| 文件 | 职责 |
|------|------|
| `js/records.js` | 所有逻辑改动：filter 扩展、日期 Chip 渲染、筛选逻辑、事件绑定 |
| `css/records.css` | 日期 Chip 行间距微调（复用现有 filter-chip 样式，仅需加 gap） |

---

### Task 1: `_renderRecordItem` 添加 `data-date` 属性

**Files:**
- Modify: `js/records.js:179` (`.record-item` div 行)

- [ ] **Step 1: 在 `_renderRecordItem` 中为 `.record-item` 添加 `data-date` 属性**

找到第 179 行：
```js
return '<div class="record-item" data-module="' + record.module + '" data-record-id="' + record.id + '">' +
```

替换为：
```js
var dateStr = record.recordedAt ? record.recordedAt.slice(0, 10) : '';
return '<div class="record-item" data-module="' + record.module + '" data-date="' + dateStr + '" data-record-id="' + record.id + '">' +
```

- [ ] **Step 2: 验证 data-date 属性**

在浏览器中打开记录页，检查任一 `.record-item` 元素，确认 `data-date` 属性存在且值为 `YYYY-MM-DD` 格式。

---

### Task 2: 扩展 `_filter` 并添加 `_isInDateRange` 函数

**Files:**
- Modify: `js/records.js:28-30` (`_filter` 定义)
- Modify: `js/records.js:232-242` (`_applyFilter` 之后新增函数)

- [ ] **Step 1: 扩展 `_filter` 对象**

将第 28-30 行：
```js
var _filter = {
  module: 'all'
};
```

替换为：
```js
var _filter = {
  module: 'all',
  date: 'all'
};
```

- [ ] **Step 2: 在 `_applyFilter` 之后添加 `_isInDateRange` 函数**

在 `_applyFilter` 函数（第 242 行 `}` 之后、`_showRecordForm` 之前）插入：

```js
/**
 * 判断日期是否在指定范围内
 * @param {string} dateStr - YYYY-MM-DD 格式的日期字符串
 * @param {string} range - today | yesterday | this_week | this_month
 * @returns {boolean}
 */
function _isInDateRange(dateStr, range) {
  if (!dateStr) return false;

  var now = new Date();
  var d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return false;

  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (range) {
    case 'today':
      return d.getTime() === today.getTime();

    case 'yesterday':
      var yesterday = new Date(today.getTime() - 86400000);
      return d.getTime() === yesterday.getTime();

    case 'this_week': {
      // 本周一 00:00
      var dayOfWeek = today.getDay();
      // getDay(): 0=周日, 所以周一=1, 周日需要特殊处理
      var daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      var monday = new Date(today.getTime() - daysFromMonday * 86400000);
      return d.getTime() >= monday.getTime();
    }

    case 'this_month':
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();

    default:
      return true;
  }
}
```

- [ ] **Step 3: 验证 `_isInDateRange` 逻辑**

在浏览器 Console 中手动测试：
```js
// 假设今天是 2026-07-26
Records._isInDateRange('2026-07-26', 'today')     // → true
Records._isInDateRange('2026-07-25', 'yesterday')  // → true
Records._isInDateRange('2026-07-27', 'this_week')  // → true (周日)
Records._isInDateRange('2026-07-15', 'this_month') // → true
Records._isInDateRange('2026-06-30', 'this_month') // → false
```

注意：`_isInDateRange` 是 IIFE 内部函数，不暴露在 `return` 中。为方便测试，可临时在 return 中加 `_isInDateRange: _isInDateRange`，测试后移除。

---

### Task 3: 扩展 `_applyFilter` 为 AND 逻辑

**Files:**
- Modify: `js/records.js:232-242` (`_applyFilter` 函数)

- [ ] **Step 1: 重写 `_applyFilter`**

将第 232-242 行：
```js
function _applyFilter() {
  var items = document.querySelectorAll('.record-item');
  for (var i = 0; i < items.length; i++) {
    var module = items[i].getAttribute('data-module');
    if (_filter.module === 'all' || module === _filter.module) {
      items[i].style.display = '';
    } else {
      items[i].style.display = 'none';
    }
  }
}
```

替换为：
```js
function _applyFilter() {
  var items = document.querySelectorAll('.record-item');
  var visibleCount = 0;
  for (var i = 0; i < items.length; i++) {
    var module = items[i].getAttribute('data-module');
    var dateStr = items[i].getAttribute('data-date');
    var moduleMatch = _filter.module === 'all' || module === _filter.module;
    var dateMatch = _filter.date === 'all' || _isInDateRange(dateStr, _filter.date);
    if (moduleMatch && dateMatch) {
      items[i].style.display = '';
      visibleCount++;
    } else {
      items[i].style.display = 'none';
    }
  }
  // 空状态处理
  var emptyEl = document.getElementById('filter-empty-state');
  if (visibleCount === 0) {
    if (!emptyEl) {
      var listEl = document.getElementById('record-list');
      if (listEl) {
        var div = document.createElement('div');
        div.id = 'filter-empty-state';
        div.className = 'empty-state';
        div.innerHTML = '<div class="empty-state-icon">🔍</div><div class="empty-state-title">该条件下暂无记录</div>';
        listEl.parentNode.insertBefore(div, listEl);
        listEl.style.display = 'none';
      }
    }
  } else {
    if (emptyEl) {
      emptyEl.parentNode.removeChild(emptyEl);
    }
    var listEl = document.getElementById('record-list');
    if (listEl) {
      listEl.style.display = '';
    }
  }
}
```

- [ ] **Step 2: 验证前确认 `_isInDateRange` 已定义**

确保 `_isInDateRange` 函数在 `_applyFilter` 之前定义（Task 2 已将函数放在 `_applyFilter` 之后但在 `_showRecordForm` 之前，但 `_applyFilter` 是在 `_bindListEvents` 中绑定的，调用时机在 `_isInDateRange` 定义之后）。

---

### Task 4: 渲染日期 Chip 行

**Files:**
- Modify: `js/records.js:93-101` (filter bar 渲染)

- [ ] **Step 1: 在模块 Chip 行下方添加日期 Chip 行**

在 `_renderRecordList` 中，将第 93-101 行的 filterHtml 改为：

```js
// 模块筛选 Chip 行
var filterHtml = '<div class="records-filter-bar">' +
  '<div class="filter-chip active" data-module="all">全部</div>';
for (var i = 0; i < Modules.MODULES.length; i++) {
  filterHtml += '<div class="filter-chip" data-module="' + Modules.MODULES[i].key + '">' +
    '<span class="filter-chip-icon">' + Modules.MODULES[i].icon + '</span>' + Modules.MODULES[i].label +
  '</div>';
}
filterHtml += '</div>';

// 日期筛选 Chip 行（新增）
filterHtml += '<div class="records-filter-bar records-filter-bar--date">' +
  '<div class="filter-chip date-chip active" data-date="all">全部时间</div>' +
  '<div class="filter-chip date-chip" data-date="today">今天</div>' +
  '<div class="filter-chip date-chip" data-date="yesterday">昨天</div>' +
  '<div class="filter-chip date-chip" data-date="this_week">本周</div>' +
  '<div class="filter-chip date-chip" data-date="this_month">本月</div>' +
'</div>';
```

- [ ] **Step 2: 添加 CSS 间距**

在 `css/records.css` 的 `.records-filter-bar` 样式块后添加：

```css
/* 日期筛选行 — 顶部间距 */
.records-filter-bar--date {
  padding-top: 0;
  padding-bottom: var(--spacing-md);
}
```

- [ ] **Step 3: 验证日期 Chip 行渲染**

打开记录页，确认模块 Chip 行下方出现日期 Chip 行，包含「全部时间」「今天」「昨天」「本周」「本月」五个选项，「全部时间」默认选中。

---

### Task 5: 更新 `_bindListEvents` 以支持日期 Chip

**Files:**
- Modify: `js/records.js:207-218` (chip 事件绑定)

- [ ] **Step 1: 分离模块 Chip 和日期 Chip 的事件绑定**

将第 207-218 行：
```js
// 筛选
var chips = document.querySelectorAll('.filter-chip');
for (var i = 0; i < chips.length; i++) {
  chips[i].addEventListener('click', function () {
    for (var j = 0; j < chips.length; j++) {
      chips[j].classList.remove('active');
    }
    this.classList.add('active');
    _filter.module = this.getAttribute('data-module');
    _applyFilter();
  });
}
```

替换为：
```js
// 模块筛选 Chip
var moduleChips = document.querySelectorAll('.records-filter-bar:not(.records-filter-bar--date) .filter-chip');
for (var i = 0; i < moduleChips.length; i++) {
  moduleChips[i].addEventListener('click', function () {
    for (var j = 0; j < moduleChips.length; j++) {
      moduleChips[j].classList.remove('active');
    }
    this.classList.add('active');
    _filter.module = this.getAttribute('data-module');
    _applyFilter();
  });
}

// 日期筛选 Chip
var dateChips = document.querySelectorAll('.records-filter-bar--date .filter-chip');
for (var i = 0; i < dateChips.length; i++) {
  dateChips[i].addEventListener('click', function () {
    for (var j = 0; j < dateChips.length; j++) {
      dateChips[j].classList.remove('active');
    }
    this.classList.add('active');
    _filter.date = this.getAttribute('data-date');
    _applyFilter();
  });
}
```

- [ ] **Step 2: 验证两层 Chip 独立切换**

在浏览器中：
1. 点击模块 Chip「情绪与行为」，确认该 Chip 高亮，日期 Chip 保持「全部时间」高亮
2. 点击日期 Chip「今天」，确认该 Chip 高亮，模块 Chip 保持「情绪与行为」高亮
3. 两层 Chip 各自独立切换，互不影响

---

### Task 6: 端到端验证

**Files:**
- 无新文件（验证现有改动）

- [ ] **Step 1: 默认加载**

打开记录页，确认：
- 模块 Chip 行：默认选中「全部」
- 日期 Chip 行：默认选中「全部时间」
- 所有记录可见

- [ ] **Step 2: 单独模块筛选**

点击「情绪与行为」模块 Chip，确认：
- 列表仅显示 `data-module="emotionBehavior"` 的记录
- 日期 Chip 保持「全部时间」

- [ ] **Step 3: 单独日期筛选**

点击「全部」模块 Chip，再点击「今天」日期 Chip，确认：
- 列表仅显示当天记录的记录
- 模块 Chip 保持「全部」

- [ ] **Step 4: 叠加筛选**

点击「情绪与行为」+「本周」，确认：
- 列表仅显示本周的情绪模块记录
- 其他记录被隐藏

- [ ] **Step 5: 空结果**

选择一个不可能有结果的组合（如选一个没有记录的模块 + 一个没有记录的日期范围），确认：
- 显示空状态提示「该条件下暂无记录」
- 空状态图标为 🔍

- [ ] **Step 6: 切换回「全部」**

任一 Chip 切回「全部」/「全部时间」，确认该维度停止过滤，列表恢复可见。

- [ ] **Step 7: 新增记录后筛选正常**

点击 FAB 新增一条记录，提交后返回列表页，确认：
- 筛选状态保持
- 新记录如果符合筛选条件则可见

- [ ] **Step 8: 提交**

```bash
cd /Users/jinjun/Desktop/开发/参赛/ai-dongwo
git add js/records.js css/records.css
git commit -m "feat: 记录页新增日期 Chip 双层筛选（module + date AND 逻辑）"
```