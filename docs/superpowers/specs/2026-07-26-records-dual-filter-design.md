# 记录页双层筛选 — 设计规格

## 背景

当前记录页（`records.js`）只有一层按模块的 Chip 筛选器，所有记录平铺展示。随着记录数量增长，需要增加日期维度来快速定位特定时间段的记录。

## 目标

在现有模块 Chip 筛选基础上，新增日期 Chip 筛选层，两层叠加筛选（AND 逻辑），改动最小，保持 iOS 设计风格。

## 架构

### 数据流

```
records[] → _filter (module + date) → _applyFilter() → DOM 显隐
```

### 组件树

```
记录页
├── 页头（返回 + 标题）
├── 模块 Chip 行（现有，保持不变）
├── 日期 Chip 行（新增）
└── 记录卡片列表（iOS 卡片分组）
    └── 记录行 × N
```

## 详细设计

### 1. 日期 Chip 行

位置：模块 Chip 行正下方，单独一行，可横向滚动。

预设选项：

| 值 | 标签 | 过滤逻辑 |
|---|------|---------|
| `all` | 全部时间 | 不过滤（默认） |
| `today` | 今天 | `recordedAt` 为当天 |
| `yesterday` | 昨天 | `recordedAt` 为昨天 |
| `this_week` | 本周 | `recordedAt` 在本周内（周一到周日） |
| `this_month` | 本月 | `recordedAt` 在本月内 |

样式：与现有模块 Chip 一致（`.filter-chip`），选中态 `active` 复用现有效果。

### 2. 筛选状态扩展

`_filter` 对象新增 `date` 字段：

```js
var _filter = {
  module: 'all',
  date: 'all'   // 新增
};
```

### 3. 筛选逻辑更新

`_applyFilter()` 同时检查 module 和 date 两个条件（AND）：

```js
function _applyFilter() {
  var items = document.querySelectorAll('.record-item');
  for (var i = 0; i < items.length; i++) {
    var module = items[i].getAttribute('data-module');
    var dateStr = items[i].getAttribute('data-date');
    var moduleMatch = _filter.module === 'all' || module === _filter.module;
    var dateMatch = _filter.date === 'all' || _isInDateRange(dateStr, _filter.date);
    items[i].style.display = (moduleMatch && dateMatch) ? '' : 'none';
  }
}
```

### 4. 日期范围判断

新增 `_isInDateRange(dateStr, range)` 工具函数，纯 JS 实现，不依赖外部库：

- `today`：比较年月日
- `yesterday`：当天减 1 天
- `this_week`：获取本周一 00:00，比较 `recordedAt` 是否 >= 周一
- `this_month`：比较年月

### 5. 记录行 DOM 更新

每行 `.record-item` 新增 `data-date` 属性，值为 `recordedAt` 的 ISO 日期部分（`YYYY-MM-DD`），供筛选使用。

### 6. 空状态

当筛选后无结果时，显示空状态提示：「该条件下暂无记录」。

### 7. 交互

- 点击模块 Chip：切换 `_filter.module`，重新应用筛选
- 点击日期 Chip：切换 `_filter.date`，重新应用筛选
- 两层 Chip 同时只有一个 active 选中态
- 筛选不影响列表排序（始终保持时间倒序）

## 不做什么

- 不添加分组折叠
- 不添加摘要面板
- 不改变 FAB 和表单逻辑
- 不改变 iOS 卡片行视觉风格
- 不引入新依赖

## 涉及文件

| 文件 | 改动 |
|------|------|
| `js/records.js` | `_filter` 加 `date` 字段；新增日期 Chip 渲染；扩展 `_applyFilter`；新增 `_isInDateRange`；`_renderRecordItem` 加 `data-date`；`_bindListEvents` 加日期 Chip 事件绑定 |
| `css/records.css` | 可选：日期 Chip 行间距微调（复用现有 `.filter-chip` 样式） |

## 测试要点

1. 默认加载：两个 Chip 行均显示，模块默认「全部」，日期默认「全部时间」
2. 单独筛选模块：选择「情绪与行为」，列表仅显示情绪模块记录，日期 Chip 保持「全部时间」
3. 单独筛选日期：选择「今天」，列表仅显示今天的记录，模块 Chip 保持「全部」
4. 叠加筛选：选择「情绪与行为」+「本周」，列表仅显示本周的情绪模块记录
5. 空结果：筛选无匹配时显示空状态提示
6. 切换回「全部」：任一 Chip 切回「全部」，对应维度停止过滤