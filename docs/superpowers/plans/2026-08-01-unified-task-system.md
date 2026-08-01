# Unified Task System + Analytics Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复分析页 P0/P1 问题 + 构建统一任务系统（参考 Outlook/Monday.com 设计）

**Architecture:** 分析页改动集中在 analytics-engine.js（计算层）和 analytics-ui.js（渲染层）；任务系统改动集中在 storage.js（数据层）和 app.js（UI 层），复用现有 CSS 变量体系

**Tech Stack:** Vanilla JS, localStorage, Chart.js, CSS Custom Properties

---

## P0 — 立即修复（4 tasks）

### Task 1: 日报增加"今日用药"独立卡片

**Files:**
- Modify: `js/analytics-engine.js:40-113`
- Modify: `js/analytics-ui.js:23-80` (renderHealthCard)
- Modify: `js/analytics-ui.js` (_renderDailyTab)

**Overview:** 在 dailySummary 返回数据中增加 medication 状态，日报 UI 增加独立用药卡片。

- [ ] **Step 1: analytics-engine.js — dailySummary 增加用药状态**

在 `dailySummary` 函数中，`return` 之前添加用药检测逻辑。找到 `var shareText = _generateDailyShareText(...)` 这一行，在其上方插入：

```javascript
    // 今日用药状态
    var medicationStatus = _getDailyMedicationStatus(youthId, date);
```

在 `return` 对象中增加 `medicationStatus` 字段：

```javascript
    return {
      date: date,
      recordCount: todayRecords.length,
      moduleCounts: moduleCounts,
      moduleDetails: moduleDetails,
      moduleStatuses: moduleStatuses,
      alerts: alerts,
      lastRecordTime: lastRecordTime,
      shareText: shareText,
      medicationStatus: medicationStatus
    };
```

在文件末尾（`_generateDailyShareText` 函数之后）添加新函数：

```javascript
  /**
   * 获取今日用药状态
   */
  function _getDailyMedicationStatus(youthId, date) {
    var allRecords = Storage.getRecords(youthId);
    var todayRecords = allRecords.filter(function (r) {
      return (r.recordedAt || '').indexOf(date) === 0;
    });

    // 从 careMedical 模块中查找用药相关记录
    var medRecords = todayRecords.filter(function (r) {
      return r.module === 'careMedical';
    });

    var hasMedication = false;
    var medDetails = [];

    for (var i = 0; i < medRecords.length; i++) {
      var tags = (medRecords[i].content && medRecords[i].content.tags) || [];
      if (tags.indexOf('按时服药') !== -1) {
        hasMedication = true;
        medDetails.push({ status: 'taken', text: '已按时服药' });
      } else if (tags.indexOf('拒绝服药') !== -1) {
        hasMedication = true;
        medDetails.push({ status: 'refused', text: '拒绝服药' });
      }
      // 也检查文本内容
      var text = (medRecords[i].content && medRecords[i].content.text) || '';
      if (text.indexOf('药') !== -1 && medDetails.length === 0) {
        hasMedication = true;
        medDetails.push({ status: 'recorded', text: '有用药记录' });
      }
    }

    return {
      hasMedication: hasMedication,
      details: medDetails
    };
  }
```

- [ ] **Step 2: 暴露 _getDailyMedicationStatus 到公共 API**

在 analytics-engine.js 的 return 对象中添加：

```javascript
    _getDailyMedicationStatus: _getDailyMedicationStatus
```

- [ ] **Step 3: analytics-ui.js — renderHealthCard 增加用药卡片**

在 `renderHealthCard` 函数中，`footerHtml` 之前添加用药卡片 HTML。找到 `var footerHtml = '<div class="health-card-footer">'` 这一行，在其上方插入：

```javascript
    // 用药状态卡片
    var medHtml = '';
    if (summary.medicationStatus && summary.medicationStatus.hasMedication) {
      var medStatusClass = 'health-med-normal';
      var medIcon = '💊';
      var medText = '有用药记录';
      for (var mi = 0; mi < summary.medicationStatus.details.length; mi++) {
        var d = summary.medicationStatus.details[mi];
        if (d.status === 'taken') {
          medStatusClass = 'health-med-ok';
          medIcon = '✅';
          medText = '已按时服药';
        } else if (d.status === 'refused') {
          medStatusClass = 'health-med-warn';
          medIcon = '⚠️';
          medText = '拒绝服药';
        }
      }
      medHtml = '<div class="health-med-card ' + medStatusClass + '">' +
        '<span class="health-med-icon">' + medIcon + '</span>' +
        '<span class="health-med-text">' + medText + '</span>' +
      '</div>';
    } else {
      medHtml = '<div class="health-med-card health-med-none">' +
        '<span class="health-med-icon">💊</span>' +
        '<span class="health-med-text">今日无用药记录</span>' +
      '</div>';
    }
```

将 `medHtml` 插入到 `statusRows` 和 `alertHtml` 之间（在 `alertHtml` 之前）：

```javascript
    // 在 return 中，将 medHtml 放在 statusRows 后面
    return '<div class="health-card">' +
      // ... 其他内容 ...
      statusRows +
      medHtml +
      alertHtml +
      footerHtml +
    '</div>';
```

- [ ] **Step 4: analytics-ui.js — _renderDailyTab 日报也增加用药卡片**

在 `_renderDailyTab` 函数中，找到日模块状态渲染之后、异常预警之前的位置，插入用药卡片。找到 `// 异常预警` 注释，在其上方插入：

```javascript
      // 今日用药
      if (report.medicationStatus) {
        var mds = report.medicationStatus;
        if (mds.hasMedication) {
          html += '<div class="analytics-card medication-card">' +
            '<div class="analytics-card-title">💊 今日用药</div>';
          for (var mi = 0; mi < mds.details.length; mi++) {
            var d = mds.details[mi];
            var icon = d.status === 'taken' ? '✅' : d.status === 'refused' ? '⚠️' : '📝';
            html += '<div class="medication-item">' + icon + ' ' + Utils.escapeHtml(d.text) + '</div>';
          }
          html += '</div>';
        } else {
          html += '<div class="analytics-card medication-card">' +
            '<div class="analytics-card-title">💊 今日用药</div>' +
            '<div class="analytics-empty" style="padding:8px;"><span style="font-size:13px;color:var(--color-text-tertiary);">今日暂无用药记录</span></div>' +
          '</div>';
        }
      }
```

- [ ] **Step 5: css/main.css — 用药卡片样式**

在文件末尾添加：

```css
/* 用药状态卡片 */
.health-med-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-lg);
  margin-bottom: 8px;
  font-size: var(--font-size-sm);
}
.health-med-ok { background: rgba(168, 201, 160, 0.1); border: 1px solid rgba(168, 201, 160, 0.2); }
.health-med-warn { background: rgba(212, 135, 123, 0.1); border: 1px solid rgba(212, 135, 123, 0.2); }
.health-med-normal { background: rgba(94, 106, 210, 0.08); border: 1px solid rgba(94, 106, 210, 0.15); }
.health-med-none { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }
.health-med-icon { font-size: 18px; }
.health-med-text { color: var(--color-text-primary); font-weight: var(--font-weight-medium); }
.medication-card { border-left: 3px solid var(--color-primary); }
.medication-item { padding: 6px 0; font-size: var(--font-size-sm); color: var(--color-text-primary); }
```

- [ ] **Step 6: 更新 index.html 版本号**

```html
<link rel="stylesheet" href="css/main.css?v=20260801-3">
<script src="js/analytics-engine.js?v=20260801-3"></script>
<script src="js/analytics-ui.js?v=20260801-3"></script>
```

- [ ] **Step 7: 启动服务器验证**

```bash
npx serve -l 8080
```

打开 http://localhost:8080，登录后检查首页和日报是否显示用药卡片。

- [ ] **Step 8: Commit**

```bash
git add js/analytics-engine.js js/analytics-ui.js css/main.css index.html
git commit -m "feat: 日报增加今日用药独立卡片"
```

---

### Task 2: 情绪趋势图添加正常范围参考线

**Files:**
- Modify: `js/analytics-ui.js` — `_renderWeeklyEmotionChart`, `_renderMonthlyEmotionChart`

**Overview:** 在 Chart.js 折线图中添加 ±0 参考线（通过 annotation 或自定义插件），帮助用户直观判断情绪偏离。

- [ ] **Step 1: 创建 Chart.js 参考线插件**

在 `js/analytics-ui.js` 文件顶部（`_chartInstances` 定义之后）添加自定义插件：

```javascript
  // Chart.js 自定义插件：绘制 y=0 参考线
  var _zeroLinePlugin = {
    id: 'zeroLine',
    afterDraw: function (chart) {
      var ctx = chart.ctx;
      var yScale = chart.scales['y'];
      if (!yScale) return;
      var zeroY = yScale.getPixelForValue(0);
      // 只在线在可视范围内时绘制
      if (zeroY < yScale.top || zeroY > yScale.bottom) return;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(chart.chartArea.left, zeroY);
      ctx.lineTo(chart.chartArea.right, zeroY);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.restore();
    }
  };
```

- [ ] **Step 2: 注册插件到所有情绪图表**

修改 `_renderWeeklyEmotionChart` 和 `_renderMonthlyEmotionChart` 中的 Chart 构造函数，在 `options` 同级添加 `plugins` 字段：

```javascript
  _chartInstances.weeklyEmotion = new Chart(canvas, {
    type: 'line',
    data: { ... },
    options: { ... },
    plugins: [_zeroLinePlugin]
  });
```

同样修改 `_renderMonthlyEmotionChart`：

```javascript
  _chartInstances.monthlyEmotion = new Chart(canvas, {
    type: 'line',
    data: { ... },
    options: { ... },
    plugins: [_zeroLinePlugin]
  });
```

- [ ] **Step 3: 更新版本号并验证**

```bash
# 更新 index.html 中 analytics-ui.js 版本号
npx serve -l 8080
```

- [ ] **Step 4: Commit**

```bash
git add js/analytics-ui.js index.html
git commit -m "feat: 情绪趋势图添加正常范围参考线(y=0虚线)"
```

---

### Task 3: 月报信息精简

**Files:**
- Modify: `js/analytics-ui.js:428-580` (_renderMonthlyTab)

**Overview:** 将月报 11 个 section 合并为 4 大块：概览+对比 → 图表区 → AI解读+照护 → 记录列表。减少滚动疲劳。

- [ ] **Step 1: 重构 _renderMonthlyTab 的渲染顺序**

当前顺序（11 个 section）：
1. 概览+AI解读
2. 环比
3. 同比
4. 情绪趋势图
5. 跨模块关联
6. 模块柱状图
7. 雷达图
8. 照护统计
9. 月度总结
10. 时间线洞察
11. 记录列表

新顺序（4 大块）：
**Block 1: 概览+对比**
**Block 2: 图表（情绪+模块+雷达）**
**Block 3: AI解读+照护+总结**
**Block 4: 记录列表**

修改 `_renderMonthlyTab` 中的 HTML 拼接顺序。找到 `// 概览 + AI 解读` 部分，改为只渲染概览卡片（不含AI解读）。将 AI 解读移到 block 3。

具体修改：在 `_renderMonthlyTab` 中重写渲染逻辑。

```javascript
// Block 1: 概览 + 对比（合并）
html += '<div class="analytics-card">' +
  '<div class="analytics-card-title">📋 月度概览</div>' +
  '<div class="monthly-stats-grid">' +
    '<div class="monthly-stat-card">' +
      '<div class="monthly-stat-value">' + report.totalRecords + '</div>' +
      '<div class="monthly-stat-label">总记录</div>' +
    '</div>' +
    '<div class="monthly-stat-card">' +
      '<div class="monthly-stat-value">' + (report.totalRecords / report.totalDays).toFixed(1) + '</div>' +
      '<div class="monthly-stat-label">日均</div>' +
    '</div>' +
    '<div class="monthly-stat-card">' +
      '<div class="monthly-stat-value">' + report.recordDays + '/' + report.totalDays + '</div>' +
      '<div class="monthly-stat-label">记录天数</div>' +
    '</div>' +
    '<div class="monthly-stat-card">' +
      '<div class="monthly-stat-value">' + moduleCount + '</div>' +
      '<div class="monthly-stat-label">覆盖模块</div>' +
    '</div>' +
  '</div>' +
'</div>';

// 环比 + 同比合并到概览下方
if (report.comparison) {
  html += _renderComparisonCard(report.comparison, 'month');
}
if (report.yearComparison && report.yearComparison.recordCount.previous > 0) {
  html += _renderComparisonCard(report.yearComparison, 'year', report.yearComparison.yearLabel);
}

// Block 2: 图表区（情绪趋势 + 模块分布 + 雷达图 — 合并到一个卡片组）
html += '<div class="analytics-card-group">' +
  '<div class="analytics-card-group-title">📊 数据可视化</div>';

html += '<div class="analytics-card">' +
  '<div class="analytics-card-title">🌊 ' + report.totalDays + '天情绪趋势</div>' +
  '<div class="analytics-chart-wrapper" style="height:280px;"><canvas id="monthly-emotion-chart"></canvas></div>' +
  '<div class="analytics-chart-summary">' + Utils.escapeHtml(report.emotionSummary) + '</div>' +
'</div>';

html += '<div class="analytics-card">' +
  '<div class="analytics-card-title">📊 模块记录分布</div>' +
  '<div class="analytics-chart-wrapper" style="height:200px;"><canvas id="monthly-module-chart"></canvas></div>' +
'</div>';

html += '<div class="analytics-card">' +
  '<div class="analytics-card-title">🎯 能力评估雷达</div>' +
  '<div class="analytics-chart-wrapper" style="height:280px;"><canvas id="monthly-radar-chart"></canvas></div>' +
'</div>';

html += '</div>'; // end 图表区

// Block 3: AI解读 + 跨模块 + 照护 + 总结（合并）
var insightsHtml2 = _generateMonthlyInsights(report, youth.id, _currentMonthStart, monthEnd);
html += '<div class="analytics-card-group">' +
  '<div class="analytics-card-group-title">🤖 AI 解读与照护</div>';

html += '<div class="analytics-card">' +
  '<div class="analytics-insights-section">' +
    insightsHtml2 +
  '</div>' +
'</div>';

if (report.crossModuleLinks.length > 0) {
  html += '<div class="analytics-card">' +
    '<div class="analytics-card-title">🔗 跨模块关联发现</div>' +
    report.crossModuleLinks.map(function (link) {
      return '<div class="analytics-link-item">🔗 ' + Utils.escapeHtml(link) + '</div>';
    }).join('') +
  '</div>';
}

// 照护统计
var mcs = report.careStats;
if (mcs) {
  html += '<div class="analytics-card">' +
    '<div class="analytics-card-title">💊 照护统计</div>' +
    '<div class="analytics-care-grid">' +
      '<div class="analytics-care-item"><span class="analytics-care-icon">🍽️</span><span class="analytics-care-label">饮食正常</span><span class="analytics-care-value">' + mcs.dietNormal + '/' + mcs.totalDays + ' 天</span></div>' +
      '<div class="analytics-care-item"><span class="analytics-care-icon">💤</span><span class="analytics-care-label">睡眠充足</span><span class="analytics-care-value">' + mcs.sleepGood + '/' + mcs.totalDays + ' 天</span></div>' +
      '<div class="analytics-care-item"><span class="analytics-care-icon">💊</span><span class="analytics-care-label">用药准时</span><span class="analytics-care-value">' + mcs.medOnTime + '/' + mcs.totalDays + ' 天</span></div>' +
    '</div>' +
  '</div>';
}

html += '<div class="analytics-card">' +
  '<div class="analytics-card-title">📝 月度总结（可分享）</div>' +
  '<div class="analytics-share-text">' + Utils.escapeHtml(report.shareText).replace(/\n/g, '<br>') + '</div>' +
  '<button class="analytics-share-btn" id="btn-copy-share">📋 复制分享文本</button>' +
'</div>';

html += '</div>'; // end AI解读与照护

// Block 4: 记录列表（时间线洞察 + 原始记录）
html += _renderTimelineInsights(youth.id, 30);
html += _renderRecordsSectionHtml();
```

> 注意：之前的时间线洞察在 `if (report.totalRecords === 0)` 分支外，现在也移到 block 4 统一处理。

- [ ] **Step 2: css/analytics.css — 卡片组样式**

添加：

```css
/* 卡片组 */
.analytics-card-group {
  margin-bottom: 24px;
}
.analytics-card-group-title {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 0 8px 4px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 12px;
}
```

- [ ] **Step 3: 验证**

```bash
npx serve -l 8080
```

- [ ] **Step 4: Commit**

```bash
git add js/analytics-ui.js css/analytics.css index.html
git commit -m "refactor: 月报精简为4大块(概览/图表/AI解读/记录)"
```

---

### Task 4: 统一任务数据模型 + 迁移

**Files:**
- Modify: `js/storage.js` — 新增 ai_dongwo_tasks key, CRUD, 迁移函数

**Overview:** 在 storage.js 中定义新的 Task schema，添加 CRUD 操作，编写旧数据迁移函数。

- [ ] **Step 1: 添加新存储 key**

在 `js/storage.js` 的 KEYS 对象中添加：

```javascript
var KEYS = {
  // ... existing keys ...
  HANDOVER_TASKS: 'ai_dongwo_handover_tasks',
  TASKS: 'ai_dongwo_tasks',  // 新增：统一任务存储
  // ...
};
```

- [ ] **Step 2: 添加 Task CRUD 函数**

在 `deleteHandoverTask` 函数之后，添加新的统一任务 CRUD：

```javascript
  // ==================== Unified Task (新) ====================

  /**
   * 获取心青年的所有任务
   */
  function getTasks(youthId) {
    var tasks = get(KEYS.TASKS) || {};
    return tasks[youthId] || [];
  }

  /**
   * 添加任务
   * @param {string} youthId
   * @param {object} task - { taskType, assigneeId, content, category, dueTime, recurrence?, handoverFrom?, handoverTo? }
   */
  function addTask(youthId, task) {
    var tasks = get(KEYS.TASKS) || {};
    if (!tasks[youthId]) tasks[youthId] = [];
    if (!task.id) task.id = Utils.generateUUID();
    if (!task.status) task.status = 'todo';
    if (!task.createdAt) task.createdAt = Utils.formatDateTime();
    if (!task.updatedAt) task.updatedAt = Utils.formatDateTime();
    tasks[youthId].push(task);
    set(KEYS.TASKS, tasks);
    return { success: true, task: task };
  }

  /**
   * 更新任务
   */
  function updateTask(youthId, taskId, updates) {
    var tasks = get(KEYS.TASKS) || {};
    var list = tasks[youthId] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === taskId) {
        Object.assign(list[i], updates);
        list[i].updatedAt = Utils.formatDateTime();
        if (updates.status === 'done' && !list[i].completedAt) {
          list[i].completedAt = Utils.formatDateTime();
        }
        set(KEYS.TASKS, tasks);
        return true;
      }
    }
    return false;
  }

  /**
   * 删除任务
   */
  function deleteTask(youthId, taskId) {
    var tasks = get(KEYS.TASKS) || {};
    var list = tasks[youthId] || [];
    tasks[youthId] = list.filter(function (t) { return t.id !== taskId; });
    set(KEYS.TASKS, tasks);
    return true;
  }

  /**
   * 迁移旧交接任务到新模型
   * 将 ai_dongwo_handover_tasks 数据转换为新 schema 写入 ai_dongwo_tasks
   */
  function migrateHandoverTasks() {
    var oldData = get(KEYS.HANDOVER_TASKS) || {};
    var newData = get(KEYS.TASKS) || {};
    var migrated = 0;

    for (var youthId in oldData) {
      if (!oldData.hasOwnProperty(youthId)) continue;
      var oldTasks = oldData[youthId];
      if (!newData[youthId]) newData[youthId] = [];

      // 检查是否已迁移（避免重复）
      var existingIds = {};
      for (var ei = 0; ei < newData[youthId].length; ei++) {
        existingIds[newData[youthId][ei]._oldId] = true;
      }

      for (var i = 0; i < oldTasks.length; i++) {
        var ot = oldTasks[i];
        if (existingIds[ot.id]) continue;

        var newTask = {
          id: Utils.generateUUID(),
          _oldId: ot.id,           // 保留旧 ID 用于去重
          youthId: youthId,
          taskType: 'handover',
          assigneeId: ot.toUserId,
          assigneeRole: ot.toRole,
          content: ot.content,
          category: 'handover',
          status: ot.status === 'done' ? 'done' : 'todo',
          dueTime: null,
          handoverFrom: { userId: ot.fromUserId, role: ot.fromRole },
          handoverTo: { userId: ot.toUserId, role: ot.toRole },
          targetType: ot.targetType,
          createdAt: ot.createdAt,
          updatedAt: ot.updatedAt,
          completedAt: ot.status === 'done' ? ot.updatedAt : null
        };
        newData[youthId].push(newTask);
        migrated++;
      }
    }

    set(KEYS.TASKS, newData);
    console.log('交接任务迁移完成：' + migrated + ' 条');
    return migrated;
  }
```

- [ ] **Step 3: 在初始化时调用迁移**

在 `initTestData` 函数中，种子数据初始化之后调用迁移。找到 `_initHandoverSeedIfNeeded(profiles, accounts)` 调用，在其后添加：

```javascript
    _initHandoverSeedIfNeeded(profiles, accounts);
    migrateHandoverTasks(); // 迁移旧数据到新模型
```

- [ ] **Step 4: 暴露新 API**

在 `storage.js` 的 return 对象中添加：

```javascript
    // Unified Task
    getTasks: getTasks,
    addTask: addTask,
    updateTask: updateTask,
    deleteTask: deleteTask,
    migrateHandoverTasks: migrateHandoverTasks,
```

- [ ] **Step 5: 验证**

打开浏览器控制台，执行：
```javascript
Storage.migrateHandoverTasks();
Storage.getTasks('<youth-id>');
```
检查返回的任务数据是否包含新字段。

- [ ] **Step 6: Commit**

```bash
git add js/storage.js
git commit -m "feat: 统一任务数据模型，新增 ai_dongwo_tasks 存储及迁移"
```

---

## P1 — 本周推进（5 tasks）

### Task 5: 日报增加"今日亮点"正向引导
### Task 6: 照护统计改为进度条+百分比
### Task 7: 情绪评分添加数据新鲜度标记
### Task 8: 任务 CRUD + 规律任务引擎
### Task 9: 任务创建表单（三种类型）

---

## P2 — 下轮迭代（5 tasks）

### Task 10: 关系地图模块纳入首页速报
### Task 11: 断档检测覆盖中间断档
### Task 12: 照护者看板视图（Kanban）
### Task 13: 心青年今日清单视图
### Task 14: 替换旧交接任务 UI

---

## P3 — 后续完善（4 tasks）

### Task 15: 情绪评分扩展多模块
### Task 16: 照护检测精细化
### Task 17: 种子数据更新
### Task 18: 任务完成率统计集成