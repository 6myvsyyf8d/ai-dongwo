# AI懂我 - 心智障碍者动态支持档案 Code Wiki

## 项目概述

**项目名称**：AI懂我 - 心智障碍者动态支持档案  
**版本**：v2.0 - 多角色协同记录系统  
**技术栈**：纯前端 HTML5 + CSS3 + JavaScript (ES5)  
**数据持久化**：localStorage  
**外部依赖**：Chart.js (图表), html2pdf.js (PDF导出)

**项目定位**：为心智障碍者（心青年）提供动态、可视化的支持档案系统，支持多角色（家长、老师、护理员、志愿者、心青年本人）协同记录和查看信息，包含速读卡、情绪支持、沟通指南等核心功能。

---

## 项目结构

```
├── index.html          # 主页面结构（SPA容器）
├── css/
│   └── style.css        # 全局样式（响应式、组件样式）
├── js/
│   └── app.js          # 主应用脚本（所有功能模块）
└── 功能截图和过程截图（SessionID）/  # 项目文档截图
```

---

## 核心模块详解

### 1. 数据定义层

位置：[app.js](file:///Users/jinjun/.trae-cn/worktrees/交互式HTML文件和截图（session）-AI懂我-心智障碍者动态支持档案/feat-generate-code-wiki-doc-zczqQg/js/app.js#L28-L285)

定义了小雨（虚拟案例）的所有基础数据：

| 数据对象 | 用途 | 关键字段 |
|---------|------|---------|
| `basicInfo` | 基本信息 | name, age, gender, intro, communication |
| `likesList` | 喜欢的事物 | icon, title, desc |
| `dislikesList` | 不喜欢的事物 | icon, title, desc |
| `communicationGuide` | 沟通说明书 | best(推荐), caution(注意), avoid(避免) |
| `emotionSupport` | 情绪与行为支持 | triggers(触发), warnings(预警), soothing(安抚), crisis(危机) |
| `careInfo` | 照护与医疗提醒 | allergy, medicine, checkup, special, sleep |
| `workInfo` | 工作支持 | canDo, needSupport, avoid |
| `dailyRoutine` | 日常作息时间轴 | time, title, activity, support, risk, reminder |
| `relationsInfo` | 关系地图 | core(核心圈), daily(日常圈), avoid(避免) |
| `quickCardVersions` | 速读卡多版本配置 | standard, teacher, volunteer, institution |

---

### 2. 角色系统

位置：[app.js](file:///Users/jinjun/.trae-cn/worktrees/交互式HTML文件和截图（session）-AI懂我-心智障碍者动态支持档案/feat-generate-code-wiki-doc-zczqQg/js/app.js#L293-L345)

#### 2.1 角色配置（ROLES）

| 角色key | 角色名称 | 权限(canAdd) | 颜色标识 |
|--------|---------|-------------|---------|
| `self` | 心青年本人 | mood, note | #4A90D9 |
| `parent` | 家长/照护人 | care, communication, emotion, note | #52C41A |
| `teacher` | 机构老师 | activity, communication, emotion, note | #FAAD14 |
| `caregiver` | 护理员 | care, communication, emotion, note | #722ED1 |
| `volunteer` | 志愿者 | accompany, emotion, note | #13C2C2 |

#### 2.2 记录类型配置（RECORD_TYPES）

| 类型key | 名称 | 图标 | 字段 |
|--------|------|------|-----|
| `mood` | 心情记录 | 💭 | mood, content |
| `care` | 照护记录 | 🏥 | title, content |
| `activity` | 活动记录 | 🎯 | title, content |
| `communication` | 沟通观察 | 💬 | content |
| `emotion` | 情绪事件 | 😊 | emotion_type, content |
| `accompany` | 陪伴记录 | 🤝 | content |
| `note` | 一般备注 | 📝 | title, content |

#### 2.3 隐私分级（privacyLevels）

| 隐私等级 | 说明 | 可见角色 |
|---------|------|---------|
| A | 仅家长可见 | self, parent |
| B | 家长+机构+老师 | self, parent, teacher, caregiver |
| C | 家长+机构+老师+志愿者 | 全部角色 |
| D | 所有人可见 | 全部角色 |

---

### 3. 数据层 - DataStore

位置：[app.js](file:///Users/jinjun/.trae-cn/worktrees/交互式HTML文件和截图（session）-AI懂我-心智障碍者动态支持档案/feat-generate-code-wiki-doc-zczqQg/js/app.js#L700-L970)

封装了所有 localStorage 操作，提供统一的数据接口：

#### 核心方法

| 方法 | 功能 | 参数 | 返回值 |
|------|------|------|-------|
| `init()` | 初始化数据 | 无 | 完整数据对象 |
| `load()` | 加载数据 | 无 | 数据对象或null |
| `save(data)` | 保存数据 | data: Object | 无 |
| `getRecords()` | 获取所有记录 | 无 | Array\<Record\> |
| `addRecord(record)` | 添加记录 | record: Object | 新记录对象 |
| `deleteRecord(id)` | 删除记录 | id: string | boolean |
| `getCurrentUser()` | 获取当前用户 | 无 | User对象或null |
| `setCurrentUser(user)` | 设置当前用户 | user: Object | 无 |
| `registerUser(name, role, pin)` | 注册新用户 | name, role, pin | {success, user, isNew} |
| `findUserByNameAndPin(name, pin)` | 查找用户 | name, pin | User对象或null |
| `getTasks()` | 获取所有任务 | 无 | Array\<Task\> |
| `updateTaskCheckin(taskId, date, status, note)` | 更新任务打卡 | taskId, date, status, note | boolean |
| `getEvents()` | 获取所有日程 | 无 | Array\<Event\> |
| `getEventsByDate(dateStr)` | 获取指定日期日程 | dateStr: string | Array\<Event\> |

#### 数据结构

```javascript
{
  version: 5,                    // 数据版本号
  currentUser: {                 // 当前登录用户
    id: 'u_xxx',
    name: '小雨',
    role: 'self',
    pin: '1111',
    avatar: '👦',
    createdAt: '2026-07-21'
  },
  users: [...],                  // 用户列表
  records: [...],                // 记录列表
  tasks: [...],                  // 任务列表
  events: [...]                  // 日程列表
}
```

---

### 4. 路由系统

位置：[app.js](file:///Users/jinjun/.trae-cn/worktrees/交互式HTML文件和截图（session）-AI懂我-心智障碍者动态支持档案/feat-generate-code-wiki-doc-zczqQg/js/app.js#L1015-L1146)

基于 Hash 路由实现 SPA 页面切换：

#### 路由映射（routeMap）

| Hash | 页面ID | 功能 |
|------|--------|------|
| `#home` | home | 首页 |
| `#life` | life | 我喜欢的生活 |
| `#communication` | communication | 沟通说明书 |
| `#emotion` | emotion | 情绪与行为支持 |
| `#care` | care | 照护与医疗提醒 |
| `#work` | work | 工作支持 |
| `#relations` | relations | 关系地图 |
| `#timeline` | timeline | 记录时间轴 |
| `#collect` | collect | 对话式采集 |
| `#login` | login | 登录/注册 |
| `#profile` | profile | 个人中心 |
| `#charts` | charts | 数据可视化 |
| `#tasks` | tasks | 每日任务 |
| `#calendar` | calendar | 日程日历 |

#### 核心函数

| 函数 | 功能 |
|------|------|
| `initRouter()` | 初始化路由，监听 hashchange |
| `handleRouteChange()` | 处理路由变化 |
| `navigateTo(pageName)` | 导航到指定页面 |
| `renderPage(pageName)` | 根据页面名调用渲染函数 |

---

### 5. 页面渲染模块

位置：[app.js](file:///Users/jinjun/.trae-cn/worktrees/交互式HTML文件和截图（session）-AI懂我-心智障碍者动态支持档案/feat-generate-code-wiki-doc-zczqQg/js/app.js#L1586-L2865)

每个页面都有对应的渲染函数：

| 函数 | 页面 | 主要功能 |
|------|------|---------|
| `renderHome()` | 首页 | Hero区、今日重点、最新动态、导航卡片、FAB按钮 |
| `renderLife()` | 我喜欢的生活 | 双列卡片展示喜欢/不喜欢事物 |
| `renderCommunication()` | 沟通说明书 | 三段式卡片（推荐/注意/避免） |
| `renderEmotion()` | 情绪与行为 | 流程图+彩色卡片（触发→预警→安抚→危机） |
| `renderCare()` | 照护与医疗 | 过敏警告、隐私分级的照护信息 |
| `renderWork()` | 工作支持 | 三栏布局（能做/需要支持/避免） |
| `renderRelations()` | 关系地图 | CSS圆圈定位的可视化关系图 |
| `renderTimeline()` | 时间轴 | 照护档案+动态记录+静态作息参考 |
| `renderProfile()` | 个人中心 | 用户信息、权限展示、功能入口 |
| `renderTasks()` | 每日任务 | 进度统计、任务列表、本周打卡 |
| `renderCalendar()` | 日程日历 | 月份导航、日历网格、事件详情 |
| `renderCharts()` | 数据可视化 | 统计卡片、Chart.js图表 |

---

### 6. 用户认证系统

位置：[app.js](file:///Users/jinjun/.trae-cn/worktrees/交互式HTML文件和截图（session）-AI懂我-心智障碍者动态支持档案/feat-generate-code-wiki-doc-zczqQg/js/app.js#L1156-L1454)

#### 登录流程

1. 用户选择已有账号或手动输入姓名
2. 输入PIN码（4-6位数字）
3. 调用 `doLogin()` → `DataStore.findUserByNameAndPin()`
4. 设置当前用户 → 更新导航栏 → 跳转首页

#### 注册流程

1. 选择角色（步骤1）
2. 输入姓名和PIN码（步骤2）
3. 调用 `doRegister()` → `DataStore.registerUser()`
4. 自动登录并跳转首页

#### 核心函数

| 函数 | 功能 |
|------|------|
| `renderRoleSelect()` | 渲染登录/注册页面 |
| `populateLoginSelect()` | 填充登录下拉菜单 |
| `startRegisterStep2(roleKey)` | 进入注册步骤2 |
| `doRegister()` | 执行注册 |
| `doLogin()` | 执行登录 |
| `logout()` | 退出登录 |
| `updateNavBar()` | 更新导航栏用户信息 |

---

### 7. 记录系统

位置：[app.js](file:///Users/jinjun/.trae-cn/worktrees/交互式HTML文件和截图（session）-AI懂我-心智障碍者动态支持档案/feat-generate-code-wiki-doc-zczqQg/js/app.js#L1821-L2133)

#### 添加记录流程

1. 点击FAB按钮 → `openAddRecordModal()`
2. 选择记录类型（根据角色权限过滤）→ `renderAddRecordStep1()`
3. 填写表单 → `renderAddRecordStep2()`
4. 保存 → `saveRecord()` → `DataStore.addRecord()`

#### 记录数据结构

```javascript
{
  id: 'uuid',
  type: 'mood',           // 记录类型
  title: '',              // 标题（可选）
  content: '',            // 内容
  mood: 'happy',          // 心情（mood类型）
  emotion_type: '焦虑',   // 情绪类型（emotion类型）
  author: '小雨',         // 作者姓名
  authorRole: 'self',     // 作者角色
  authorId: 'u_xxx',      // 作者ID
  authorAvatar: '👦',     // 作者头像
  date: '2026-07-21',     // 日期
  time: '09:30'           // 时间
}
```

---

### 8. 速读卡模块

位置：[app.js](file:///Users/jinjun/.trae-cn/worktrees/交互式HTML文件和截图（session）-AI懂我-心智障碍者动态支持档案/feat-generate-code-wiki-doc-zczqQg/js/app.js#L2941-L3099)

支持多版本速读卡切换：

| 版本key | 适用对象 | 特点 |
|--------|---------|------|
| `standard` | 家长/法定支持人 | 完整信息，包含紧急联系人 |
| `teacher` | 机构老师 | 教学相关，安全红线 |
| `volunteer` | 志愿者 | 简化版，三条核心规则 |
| `institution` | 机构管理人员 | 概况版，就业方向 |

#### 核心函数

| 函数 | 功能 |
|------|------|
| `openQuickCard()` | 打开速读卡弹窗 |
| `closeQuickCard()` | 关闭速读卡弹窗 |
| `renderVersionTabs()` | 渲染版本切换标签 |
| `switchVersion(versionName)` | 切换速读卡版本 |
| `renderQuickCardContent(versionName)` | 渲染速读卡内容 |
| `printQuickCard()` | 打印速读卡 |

---

### 9. 对话式采集模块

位置：[app.js](file:///Users/jinjun/.trae-cn/worktrees/交互式HTML文件和截图（session）-AI懂我-心智障碍者动态支持档案/feat-generate-code-wiki-doc-zczqQg/js/app.js#L3176-L3387)

通过预设脚本与用户对话，自动归类采集到的信息：

#### 对话流程（chatScript）

| 步骤 | 问题 | 归类标签 |
|------|------|---------|
| 0 | 欢迎语 | 基本信息 |
| 1 | 姓名和年龄 | 基本信息 |
| 2 | 喜欢做什么 | 兴趣爱好 |
| 3 | 不喜欢什么 | 不喜欢的事物 |
| 4 | 食物过敏/医疗事项 | 医疗安全 |
| 5 | 沟通方式 | 沟通方式 |
| 6 | 情绪波动情况 | 情绪行为 |
| 7 | 重要照顾者 | 支持网络 |
| 8 | 完成提示 | - |

#### 核心函数

| 函数 | 功能 |
|------|------|
| `renderCollectPage()` | 渲染对话采集页面 |
| `startChatConversation()` | 开始对话流程 |
| `sendNextAIMessage()` | 发送下一条AI消息 |
| `addMessage(role, text)` | 添加消息气泡 |
| `showOptions(options)` | 显示预设选项按钮 |
| `handleUserSelection(selectedText)` | 处理用户选择 |
| `categorizeMessage(step, text)` | AI实时归类 |

---

### 10. 每日任务模块

位置：[app.js](file:///Users/jinjun/.trae-cn/worktrees/交互式HTML文件和截图（session）-AI懂我-心智障碍者动态支持档案/feat-generate-code-wiki-doc-zczqQg/js/app.js#L3569-L3735)

#### 任务数据结构

```javascript
{
  id: 'task_1',
  title: '起床洗漱',
  icon: '🪥',
  category: 'daily',           // daily/therapy/work/social
  time: '08:30',
  difficulty: 'easy',          // easy/medium/hard
  supportTip: '提醒时间即可',
  isActive: true,
  createdAt: '2026-07-21',
  checkins: [                  // 打卡记录
    { date: '2026-07-21', time: '08:35', status: 'done', note: '' }
  ]
}
```

#### 核心函数

| 函数 | 功能 |
|------|------|
| `renderTasks()` | 渲染任务页面 |
| `bindTaskEvents(today)` | 绑定任务事件 |
| `showAddTaskModal()` | 显示添加任务弹窗 |
| `submitNewTask()` | 提交新任务 |

---

### 11. 日程日历模块

位置：[app.js](file:///Users/jinjun/.trae-cn/worktrees/交互式HTML文件和截图（session）-AI懂我-心智障碍者动态支持档案/feat-generate-code-wiki-doc-zczqQg/js/app.js#L3738-L3920)

#### 日程数据结构

```javascript
{
  id: 'evt_m_0',
  title: '机构晨检',
  type: 'medical',              // medical/activity/meeting/reminder/custom
  icon: '🏥',
  date: '2026-07-01',
  time: '08:00',
  endTime: '08:30',
  description: '月初健康检查',
  recurring: 'daily',           // daily/weekly/monthly/yearly/none
  priority: 'high',             // high/medium/low
  color: '#F5222D',
  author: '妈妈',
  authorRole: 'parent',
  createdAt: '2026-07-21'
}
```

#### 核心函数

| 函数 | 功能 |
|------|------|
| `renderCalendar()` | 渲染日历页面 |
| `bindCalendarEvents()` | 绑定日历事件 |
| `showAddEventModal()` | 显示添加日程弹窗 |
| `submitNewEvent()` | 提交新日程 |

---

### 12. 数据可视化模块

位置：[app.js](file:///Users/jinjun/.trae-cn/worktrees/交互式HTML文件和截图（session）-AI懂我-心智障碍者动态支持档案/feat-generate-code-wiki-doc-zczqQg/js/app.js#L3982-L4035)

使用 Chart.js 生成三个图表：

| 图表 | ID | 类型 | 用途 |
|------|-----|------|------|
| 心情趋势图 | `chart-mood-trend` | 折线图 | 展示近30天心情变化 |
| 记录类型分布图 | `chart-type-dist` | 饼图 | 各类型记录占比 |
| 情绪事件分布图 | `chart-emotion-bar` | 柱状图 | 各情绪类型统计 |

---

### 13. 导出与打印模块

位置：[app.js](file:///Users/jinjun/.trae-cn/worktrees/交互式HTML文件和截图（session）-AI懂我-心智障碍者动态支持档案/feat-generate-code-wiki-doc-zczqQg/js/app.js#L3930-L3980)

使用 html2pdf.js 实现PDF导出：

```javascript
var ExportModule = {
  exportToPDF(elementId, filename)    // 导出指定元素为PDF
  exportRecords()                      // 导出所有记录为PDF
};
```

---

### 14. 隐私分级模块

位置：[app.js](file:///Users/jinjun/.trae-cn/worktrees/交互式HTML文件和截图（session）-AI懂我-心智障碍者动态支持档案/feat-generate-code-wiki-doc-zczqQg/js/app.js#L3102-L3174)

通过 `data-privacy` 属性标记元素，根据当前角色控制可见性：

```javascript
function applyPrivacy(roleName) {
  // 获取允许的隐私级别
  var allowedLevels = privacyLevels[roleName];
  // 遍历所有带隐私标记的元素
  var privacyElements = document.querySelectorAll('[data-privacy]');
  // 根据权限显示或隐藏
}
```

---

## 应用状态管理

位置：[app.js](file:///Users/jinjun/.trae-cn/worktrees/交互式HTML文件和截图（session）-AI懂我-心智障碍者动态支持档案/feat-generate-code-wiki-doc-zczqQg/js/app.js#L976-L1011)

```javascript
var appState = {
  currentUser: null,           // 当前登录用户
  currentPage: 'home',         // 当前页面
  currentRole: 'parent',       // 当前角色
  currentQuickCardVersion: 'standard',  // 当前速读卡版本
  chatState: {                 // 对话采集状态
    currentStep: 0,
    messages: [],
    categories: [],
    profileName: '小雨'
  }
};
```

---

## 工具函数

位置：[app.js](file:///Users/jinjun/.trae-cn/worktrees/交互式HTML文件和截图（session）-AI懂我-心智障碍者动态支持档案/feat-generate-code-wiki-doc-zczqQg/js/app.js#L3391-L3405)

| 函数 | 功能 |
|------|------|
| `generateUUID()` | 生成唯一ID |
| `generateUserId()` | 生成用户ID |
| `getTodayString()` | 获取今天日期字符串（YYYY-MM-DD） |
| `getNowTimeString()` | 获取当前时间字符串（HH:MM） |
| `formatDateDisplay(dateStr)` | 格式化日期显示（今天/昨天/完整日期） |
| `showToast(message)` | 显示轻量提示 |

---

## 初始化流程

位置：[app.js](file:///Users/jinjun/.trae-cn/worktrees/交互式HTML文件和截图（session）-AI懂我-心智障碍者动态支持档案/feat-generate-code-wiki-doc-zczqQg/js/app.js#L3539-L3645)

```
DOMContentLoaded
  → initApp()
    → DataStore.init()           // 初始化数据存储
    → 加载当前用户
    → updateNavBar()             // 更新导航栏
    → bindGlobalEvents()         // 绑定全局事件
    → initRouter()               // 初始化路由
    → applyPrivacy(currentRole)  // 应用隐私设置
```

---

## 示例用户账号

项目预置了5个示例用户，可直接登录测试：

| 姓名 | 角色 | PIN码 | 头像 |
|------|------|-------|------|
| 小雨 | 心青年本人 | 1111 | 👦 |
| 妈妈 | 家长/照护人 | 2222 | 👩 |
| 李老师 | 机构老师 | 3333 | 👩‍🏫 |
| 张阿姨 | 护理员 | 4444 | 👵 |
| 小王 | 志愿者 | 5555 | 👷 |

---

## 运行方式

### 开发环境

```bash
# 方式1：使用Python本地服务器
python -m http.server 8080

# 方式2：使用Node.js本地服务器
npx serve .

# 方式3：直接打开index.html（部分功能可能受限）
```

### 访问地址

打开浏览器访问 `http://localhost:8080`

### 注意事项

1. 数据存储在浏览器 localStorage 中，清除浏览器数据会导致数据丢失
2. 需要网络连接加载 Chart.js 和 html2pdf.js 外部依赖
3. 推荐使用现代浏览器（Chrome、Firefox、Safari）

---

## 功能亮点

1. **多角色协同**：支持5种角色协同记录，权限分级管理
2. **隐私保护**：基于角色的隐私分级系统，敏感信息按需展示
3. **速读卡**：多版本速读卡支持打印，便于分享给不同角色
4. **对话式采集**：AI辅助信息采集，自动归类
5. **数据可视化**：Chart.js图表展示心情趋势和记录统计
6. **响应式设计**：适配桌面端和移动端
7. **离线可用**：纯前端实现，无需后端服务

---

## 代码规范

- 使用 ES5 语法，兼容性好
- 模块化设计，每个功能模块独立封装
- 事件委托模式，减少内存占用
- localStorage 数据持久化，版本管理
- 完整的注释说明，便于维护