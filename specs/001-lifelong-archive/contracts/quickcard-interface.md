# Contract: Quickcard Interface (quickcard.js)

**Module**: `js/quickcard.js`
**Global Object**: `window.QuickCard`
**Purpose**: 3 分钟速读卡生成与打印。从心青年档案中自动提取关键信息，渲染为 A4 单页速读卡，支持打印和 PDF 导出。

---

## API Reference

### `QuickCard.generate(youthId)`

生成指定心青年的速读卡数据。

```typescript
function generate(youthId: string): QuickCardData | null
```

| 返回值 | 类型 | 说明 |
|--------|------|------|
| data | QuickCardData \| null | 速读卡提取数据，权限不足或档案不存在时返回 null |

**QuickCardData 结构**：
```typescript
{
  name: string,                    // 心青年姓名
  age: number,                     // 当前年龄
  gender: string,                  // 性别
  archiveCodeId: string,           // 档案码 ID
  communicationMethods: string[],  // 沟通方式（最多 5 条）
  behaviorRedLines: {              // 行为红线（最多 5 条，按 severity 降序）
    description: string,
    trigger: string | null,
    response: string,
    severity: 'high' | 'medium' | 'low'
  }[],
  emergencyContacts: {             // 急救联系人
    name: string,
    phone: string,
    relation: string
  }[],
  recentMoodTrend: {               // 近 7 天情绪趋势
    date: string,
    mood: string,
    note: string | null
  }[],
  recentAlerts: string[],          // 近期注意事项（过敏 + 近 3 天异常）
  generatedAt: string              // 生成时间
}
```

**提取算法**（参考 research.md 决策 4）：

1. **沟通方式**：从 `modules.communicationGuide.preferredMethods` 提取，最多 5 条
2. **行为红线**：从 `modules.emotionBehavior.behaviorRedLines` 提取，按 severity 排序（high > medium > low），最多 5 条。若不足 3 条，从近 7 天 `recordType: 'observation'` 且 `tags` 包含 '红线' 的记录补充
3. **急救联系人**：从 `emergencyContacts` 取全部
4. **近期情绪趋势**：从 `modules.emotionBehavior.emotionTrend` 取最近 7 天数据点
5. **近期注意事项**：
   - `modules.careMedical.allergies` 全部加入
   - `modules.careMedical.medications` 中 `startDate` 在近 30 天内的加入
   - 近 3 天 `recordType: 'daily_care'` 中 `tags` 包含 '异常' 或 '注意' 的加入

**权限检查**：
- 志愿者查看时：仅返回 `safety_only` 级别的信息（不显示用药详情、医疗记录）
- 照护者查看时：同志愿者，额外显示自己录入的护理记录相关注意事项
- 家长/老师/心青年本人：返回完整信息

---

### `QuickCard.render(data, container)`

将速读卡数据渲染到 DOM 容器。

```typescript
function render(data: QuickCardData, container: HTMLElement): void
```

**行为**：
1. 清空 container
2. 创建速读卡 DOM 结构（参考 research.md 模板布局）
3. 如果数据中有 `recentMoodTrend`，使用 Chart.js 渲染迷你情绪曲线

---

### `QuickCard.print(container)`

打印速读卡（A4 单页）。

```typescript
function print(container: HTMLElement): void
```

**行为**：
1. 调用 `window.print()`
2. CSS `@media print` 规则确保速读卡单页输出，隐藏其他页面元素

---

### `QuickCard.exportPDF(container)`

导出速读卡为 PDF。

```typescript
async function exportPDF(container: HTMLElement): Promise<Blob>
```

**行为**：使用 `html2pdf.js` 将 container 内容转换为 PDF Blob。

**实现**：
```javascript
async function exportPDF(container) {
  return html2pdf()
    .set({
      margin: [10, 10, 10, 10],
      filename: `速读卡_${data.name}_${data.generatedAt.slice(0,10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    })
    .from(container)
    .outputPdf('blob');
}
```
