# 对话式记录系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现以 AI 对话为核心的记录采集系统，家长通过聊天式交互完成碎片化记录，AI 自动分类到 5 大模块，并生成每日回顾与周报。

**Architecture:** 五个独立 JS 模块按依赖关系分层：`chatbot-classifier.js`（关键词分类引擎）→ `chatbot-templates.js`（问题模板库）→ `chatbot.js`（对话引擎 + UI 渲染）→ `chatbot-analysis.js`（数据分析层）。`chatbot.css` 负责全部样式。所有模块通过 `window.ChatbotClassifier`、`window.ChatbotTemplates`、`window.ChatbotEngine`、`window.ChatbotAnalysis` 暴露全局接口，`chatbot.js` 作为主入口挂载到 `index.html` 已有的 `#collect` 页面。

**Tech Stack:** 纯前端 JavaScript（ES6+）、CSS3、Web Speech API、localStorage

---

## 文件结构

| 文件 | 类型 | 职责 |
|------|------|------|
| `js/chatbot-classifier.js` | 新建 | 关键词分类引擎：中文词库 + 句子拆分 + 模块匹配 + 置信度计算 |
| `js/chatbot-templates.js` | 新建 | 问题模板库：按时间/间隔组织提问策略，问题+追问链 |
| `js/chatbot.js` | 新建 | 对话引擎 + UI：状态管理、对话流控制、语音输入、DOM 渲染 |
| `css/chatbot.css` | 新建 | 聊天界面全部样式：气泡、归类面板、语音按钮、快捷按钮、响应式 |
| `js/chatbot-analysis.js` | 新建 | 数据分析层：每日回顾、异常检测、周报/月报生成 |
| `index.html` | 修改 | 引入 `chatbot.css`、`chatbot-classifier.js`、`chatbot-templates.js`、`chatbot.js`、`chatbot-analysis.js`；增强 `#collect` 区域的输入和按钮结构 |

---

### Task 1: 关键词分类引擎 — `js/chatbot-classifier.js`

**Files:**
- Create: `js/chatbot-classifier.js`

**职责**：接收用户输入文本，按标点拆分为句子，基于关键词匹配将每个句子分类到对应模块，返回分类结果及置信度。

- [ ] **Step 1: 编写分类引擎模块**

```javascript
// js/chatbot-classifier.js
'use strict';

/**
 * 关键词分类引擎
 * 将用户输入文本按句子拆分，匹配关键词，归类到 5 大模块
 * 暴露 window.ChatbotClassifier 全局对象
 */
(function () {
  // ========== 模块关键词词典 ==========
  const MODULE_KEYWORDS = {
    communicationGuide: [
      '表达困难', '不听指令', '特殊习惯', '沟通方式', '说不清楚',
      '主动说话', '谢谢', '打招呼', '不愿说话', '不理人', '听不懂',
      '说话', '沟通', '表达', '交流', '理解', '指令'
    ],
    emotionBehavior: [
      '情绪', '烦躁', '开心', '哭', '发脾气', '攻击', '尖叫',
      '安静', '平稳', '低落', '焦虑', '兴奋', '生气', '难过',
      '情绪稳定', '情绪波动', '哭了', '笑了', '闹', '冲动',
      '自伤', '伤人', '破坏', '情绪好', '情绪差'
    ],
    careMedical: [
      '吃饭', '饮食', '喝水', '食欲', '睡眠', '睡觉', '吃药',
      '医院', '看病', '医生', '过敏', '发烧', '排便', '大便',
      '小便', '药', '病', '疼', '痛', '午睡', '入睡', '失眠',
      '胃口', '饭量', '体温', '咳嗽', '感冒', '吐', '腹泻',
      '疫苗', '体检', '复诊', '剂量', '服药', '用药'
    ],
    workSupport: [
      '工作', '烘焙', '打扫', '任务', '完成', '尝试', '学习',
      '培训', '上班', '庇护工场', '手工', '技能', '练习',
      '活动', '参与', '帮忙', '协助', '独立完成', '需要辅助',
      '就业', '实习', '志愿者活动'
    ],
    relationshipMap: [
      '朋友', '想去', '喜欢', '愿望', '一起玩', '社交', '互动',
      '陪伴', '见面', '关系', '认识', '新朋友', '同伴', '交往',
      '参加', '聚会', '出游', '拜访', '做客', '打电话', '视频'
    ]
  };

  // ========== 句式修正规则 ==========
  // 否定句式修正：如"没有哭"不应匹配到情绪模块
  const NEGATION_PATTERNS = [
    /没有(哭|闹|发脾气|攻击|尖叫|伤人|自伤)/,
    /没(哭|闹|病|发烧|吐|腹泻)/,
    /不(吃饭|喝水|吃药|睡觉|说话)/
  ];

  /**
   * 按标点符号拆分句子
   * @param {string} text
   * @returns {string[]}
   */
  function splitSentences(text) {
    return text
      .split(/[，,。！!？?；;、\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * 检查句子是否为否定句式
   * @param {string} sentence
   * @returns {boolean}
   */
  function isNegation(sentence) {
    return NEGATION_PATTERNS.some(pattern => pattern.test(sentence));
  }

  /**
   * 计算句子与某模块的匹配分数
   * @param {string} sentence
   * @param {string[]} keywords
   * @returns {number} 0-1
   */
  function matchScore(sentence, keywords) {
    let score = 0;
    let matchCount = 0;
    for (const kw of keywords) {
      if (sentence.includes(kw)) {
        matchCount++;
        // 长关键词权重更高
        score += kw.length;
      }
    }
    // 归一化：匹配加权分 / 最大可能分
    const maxPossible = keywords.length * 3;
    return Math.min(score / maxPossible, 1);
  }

  /**
   * 分类单个句子
   * @param {string} sentence
   * @returns {{ module: string, confidence: number, isNegated: boolean }}
   */
  function classifySentence(sentence) {
    const negated = isNegation(sentence);
    let bestModule = null;
    let bestScore = 0;

    for (const [module, keywords] of Object.entries(MODULE_KEYWORDS)) {
      const score = matchScore(sentence, keywords);
      if (score > bestScore) {
        bestScore = score;
        bestModule = module;
      }
    }

    // 阈值：低于 0.02 视为无法分类
    if (bestScore < 0.02) {
      return { module: null, confidence: 0, isNegated: negated };
    }

    return {
      module: bestModule,
      confidence: Math.round(bestScore * 100) / 100,
      isNegated: negated
    };
  }

  /**
   * 分类完整文本（主入口）
   * @param {string} text - 用户输入文本
   * @returns {Array<{sentence: string, module: string|null, confidence: number}>}
   */
  function classify(text) {
    const sentences = splitSentences(text);
    return sentences.map(sentence => {
      const result = classifySentence(sentence);
      return {
        sentence: sentence,
        module: result.module,
        confidence: result.confidence
      };
    });
  }

  /**
   * 获取模块中文名
   * @param {string} moduleKey
   * @returns {string}
   */
  function getModuleName(moduleKey) {
    const names = {
      communicationGuide: '沟通说明书',
      emotionBehavior: '情绪与行为',
      careMedical: '照护与医疗',
      workSupport: '工作与生活',
      relationshipMap: '关系地图'
    };
    return names[moduleKey] || '待分类';
  }

  /**
   * 获取模块图标
   * @param {string} moduleKey
   * @returns {string}
   */
  function getModuleIcon(moduleKey) {
    const icons = {
      communicationGuide: '💬',
      emotionBehavior: '😊',
      careMedical: '🍽',
      workSupport: '🔧',
      relationshipMap: '👥'
    };
    return icons[moduleKey] || '📝';
  }

  // ========== 暴露全局接口 ==========
  window.ChatbotClassifier = {
    classify: classify,
    splitSentences: splitSentences,
    getModuleName: getModuleName,
    getModuleIcon: getModuleIcon
  };
})();
```

- [ ] **Step 2: 验证分类引擎**

在浏览器控制台运行以下测试，确认分类结果正确：

```javascript
// 测试 1: 饮食分类
ChatbotClassifier.classify('晚饭吃了半碗米饭和青菜，肉没怎么动')
// 期望: [{sentence: '晚饭吃了半碗米饭和青菜', module: 'careMedical', confidence: >0},
//         {sentence: '肉没怎么动', module: 'careMedical', confidence: >0}]

// 测试 2: 情绪分类
ChatbotClassifier.classify('情绪还行，没有哭闹')
// 期望: 第一句 → emotionBehavior, 第二句 → isNegated 为 true

// 测试 3: 多模块混合
ChatbotClassifier.classify('今天烘焙很开心，吃了很多饭')
// 期望: 烘焙 → workSupport, 吃了很多饭 → careMedical

// 测试 4: 无法分类
ChatbotClassifier.classify('今天天气不错')
// 期望: module 为 null, confidence 为 0
```

- [ ] **Step 3: 提交**

```bash
git add js/chatbot-classifier.js
git commit -m "feat: add chatbot keyword classifier engine"
```

---

### Task 2: 问题模板库 — `js/chatbot-templates.js`

**Files:**
- Create: `js/chatbot-templates.js`

**职责**：按时间段和记录间隔组织 AI 提问模板，每个模板包含首发问题、追问链、跳过文案。

- [ ] **Step 1: 编写模板库模块**

```javascript
// js/chatbot-templates.js
'use strict';

/**
 * 对话问题模板库
 * 按时间/间隔组织提问策略
 * 暴露 window.ChatbotTemplates 全局对象
 */
(function () {
  // ========== 按时间段组织的问题模板 ==========
  const TIME_TEMPLATES = {
    morning: {
      label: '早上',
      greeting: '早上好！',
      questions: [
        {
          id: 'sleep',
          text: (name) => `${name}昨晚睡得怎么样？`,
          module: 'careMedical',
          skipText: '跳过睡眠',
          followUp: (name) => `大概睡了几个小时？入睡顺利吗？`
        },
        {
          id: 'breakfast',
          text: (name) => `早餐吃了吗？胃口怎么样？`,
          module: 'careMedical',
          skipText: '跳过早餐',
          followUp: (name) => `吃了什么？有没有特别喜欢的或拒绝的？`
        },
        {
          id: 'morning_plan',
          text: (name) => `今天有什么特别的安排吗？`,
          module: 'workSupport',
          skipText: '跳过计划',
          followUp: (name) => `需要我帮你记下来吗？`
        }
      ]
    },
    noon: {
      label: '中午',
      greeting: '午饭时间到了！',
      questions: [
        {
          id: 'lunch',
          text: (name) => `${name}午饭吃得怎么样？`,
          module: 'careMedical',
          skipText: '跳过午饭',
          followUp: (name) => `吃了多少？有没有挑食？`
        },
        {
          id: 'morning_activity',
          text: (name) => `上午做了什么活动？`,
          module: 'workSupport',
          skipText: '跳过上下午活动',
          followUp: (name) => `参与得开心吗？`
        },
        {
          id: 'noon_mood',
          text: (name) => `上午情绪怎么样？`,
          module: 'emotionBehavior',
          skipText: '跳过情绪',
          followUp: (name) => `有没有特别开心或烦躁的事？`
        }
      ]
    },
    evening: {
      label: '傍晚',
      greeting: '晚饭时间到了！',
      questions: [
        {
          id: 'dinner',
          text: (name) => `${name}今天吃晚饭了吗？`,
          module: 'careMedical',
          skipText: '跳过晚饭',
          followUp: (name) => `吃了什么？胃口和平时比怎么样？`
        },
        {
          id: 'afternoon_mood',
          text: (name) => `下午情绪怎么样？`,
          module: 'emotionBehavior',
          skipText: '跳过情绪',
          followUp: (name) => `有没有哭闹或者特别开心的事？`
        },
        {
          id: 'medication',
          text: (name) => `今天按时吃药了吗？`,
          module: 'careMedical',
          skipText: '跳过用药',
          followUp: (name) => `有没有漏服或不适？`
        }
      ]
    },
    night: {
      label: '晚上',
      greeting: '一天快结束了~',
      questions: [
        {
          id: 'daily_review',
          text: (name) => `今天整体感觉怎么样？`,
          module: 'emotionBehavior',
          skipText: '跳过回顾',
          followUp: (name) => `有什么特别的事想记录下来吗？`
        },
        {
          id: 'social',
          text: (name) => `今天和谁互动了吗？`,
          module: 'relationshipMap',
          skipText: '跳过社交',
          followUp: (name) => `互动得怎么样？`
        },
        {
          id: 'medication_night',
          text: (name) => `晚上的药吃了吗？`,
          module: 'careMedical',
          skipText: '跳过用药',
          followUp: (name) => `有没有什么不适？`
        },
        {
          id: 'tomorrow',
          text: (name) => `明天有什么需要特别注意的吗？`,
          module: 'workSupport',
          skipText: '跳过明日',
          followUp: (name) => `我帮你记在交接便签里？`
        }
      ]
    }
  };

  // ========== 按记录间隔组织的策略 ==========
  const INTERVAL_STRATEGIES = {
    recent: {    // < 4 小时
      maxRounds: 3,
      label: '精简模式',
      sections: ['food', 'mood']  // 只问变化
    },
    standard: {  // 4-12 小时
      maxRounds: 6,
      label: '标准模式',
      sections: ['food', 'mood', 'medication']
    },
    full: {      // > 12 小时
      maxRounds: 10,
      label: '完整模式',
      sections: ['food', 'mood', 'medication', 'activity', 'social']
    }
  };

  /**
   * 根据当前时间确定时段
   * @returns {'morning'|'noon'|'evening'|'night'}
   */
  function getTimePeriod() {
    const hour = new Date().getHours();
    if (hour >= 7 && hour < 10) return 'morning';
    if (hour >= 11 && hour < 13) return 'noon';
    if (hour >= 17 && hour < 20) return 'evening';
    return 'night';
  }

  /**
   * 根据上次记录间隔确定策略
   * @param {number|null} hoursSinceLastRecord
   * @returns {'recent'|'standard'|'full'}
   */
  function getIntervalStrategy(hoursSinceLastRecord) {
    if (hoursSinceLastRecord === null || hoursSinceLastRecord === undefined) return 'full';
    if (hoursSinceLastRecord < 4) return 'recent';
    if (hoursSinceLastRecord < 12) return 'standard';
    return 'full';
  }

  /**
   * 获取当前时段的问题模板
   * @param {number|null} hoursSinceLastRecord
   * @returns {object} { greeting, questions, maxRounds }
   */
  function getTemplate(hoursSinceLastRecord) {
    const period = getTimePeriod();
    const strategy = getIntervalStrategy(hoursSinceLastRecord);
    const timeTemplate = TIME_TEMPLATES[period];

    return {
      period: period,
      strategy: strategy,
      greeting: timeTemplate.greeting,
      questions: timeTemplate.questions,
      maxRounds: INTERVAL_STRATEGIES[strategy].maxRounds
    };
  }

  /**
   * 获取快捷按钮列表
   * @returns {Array<{id: string, label: string, module: string}>}
   */
  function getQuickButtons() {
    return [
      { id: 'eat_good', label: '吃饭好', module: 'careMedical', text: '吃饭很好，胃口不错' },
      { id: 'eat_bad', label: '吃饭差', module: 'careMedical', text: '吃饭不太好，没怎么吃' },
      { id: 'mood_good', label: '情绪好', module: 'emotionBehavior', text: '情绪很好，很开心' },
      { id: 'mood_bad', label: '情绪差', module: 'emotionBehavior', text: '情绪不太好，有点烦躁' },
      { id: 'sleep_good', label: '睡得好', module: 'careMedical', text: '昨晚睡得不错' },
      { id: 'sleep_bad', label: '睡得差', module: 'careMedical', text: '昨晚没睡好' },
      { id: 'med_ok', label: '已服药', module: 'careMedical', text: '今天按时吃药了' },
      { id: 'social_ok', label: '有社交', module: 'relationshipMap', text: '今天有社交互动' }
    ];
  }

  // ========== 暴露全局接口 ==========
  window.ChatbotTemplates = {
    getTemplate: getTemplate,
    getTimePeriod: getTimePeriod,
    getIntervalStrategy: getIntervalStrategy,
    getQuickButtons: getQuickButtons
  };
})();
```

- [ ] **Step 2: 验证模板库**

在浏览器控制台运行测试：

```javascript
// 测试时段判断
const template = ChatbotTemplates.getTemplate(2);
console.log(template.period);     // 期望: 当前时段
console.log(template.strategy);   // 期望: 'recent' (2小时前)
console.log(template.maxRounds);  // 期望: 3
console.log(template.questions.length); // 期望: > 0

// 测试快捷按钮
const buttons = ChatbotTemplates.getQuickButtons();
console.log(buttons.length); // 期望: 8
```

- [ ] **Step 3: 提交**

```bash
git add js/chatbot-templates.js
git commit -m "feat: add chatbot question templates (time-based + interval-based)"
```

---

### Task 3: 聊天界面样式 — `css/chatbot.css`

**Files:**
- Create: `css/chatbot.css`

**职责**：聊天窗口、消息气泡、归类面板、语音按钮、快捷按钮、响应式布局的全部样式。

- [ ] **Step 1: 编写聊天界面样式**

```css
/* css/chatbot.css */
/* ========== 对话采集页面布局 ========== */
.chat-layout {
  display: flex;
  gap: 0;
  height: calc(100vh - 80px);
  max-height: 700px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 16px rgba(0,0,0,0.08);
  background: #fff;
}

/* ========== 聊天面板（左侧） ========== */
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-right: 1px solid #e8edf2;
}

.chat-panel-header {
  padding: 14px 20px;
  font-size: 1rem;
  font-weight: 600;
  color: #2D7A7A;
  border-bottom: 1px solid #e8edf2;
  background: #f8fafb;
  flex-shrink: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #fafbfc;
}

/* ========== 消息气泡 ========== */
.chat-bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 0.92rem;
  line-height: 1.55;
  animation: bubbleIn 0.25s ease-out;
  word-break: break-word;
  position: relative;
}

@keyframes bubbleIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.chat-bubble.ai {
  align-self: flex-start;
  background: #f0f4f4;
  color: #2c3e50;
  border-bottom-left-radius: 4px;
}

.chat-bubble.user {
  align-self: flex-end;
  background: #2D7A7A;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.chat-bubble .bubble-time {
  font-size: 0.68rem;
  opacity: 0.6;
  margin-top: 4px;
  text-align: right;
}

.chat-bubble.ai .bubble-time {
  text-align: left;
}

/* ========== 跳过按钮 ========== */
.chat-skip-btn {
  display: inline-block;
  font-size: 0.75rem;
  color: #999;
  cursor: pointer;
  margin-top: 6px;
  padding: 2px 8px;
  border-radius: 10px;
  transition: all 0.15s;
  user-select: none;
}

.chat-skip-btn:hover {
  color: #666;
  background: #e8edf2;
}

/* ========== 输入区域 ========== */
.chat-input-area {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e8edf2;
  background: #fff;
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  border: 1px solid #dde2e8;
  border-radius: 20px;
  padding: 10px 16px;
  font-size: 0.92rem;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
  resize: none;
}

.chat-input:focus {
  border-color: #2D7A7A;
}

.chat-send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: #2D7A7A;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}

.chat-send-btn:hover {
  background: #236b6b;
}

.chat-send-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* ========== 语音按钮 ========== */
.chat-voice-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid #dde2e8;
  background: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
  font-size: 1.1rem;
  color: #666;
}

.chat-voice-btn:hover {
  background: #f0f4f4;
  border-color: #2D7A7A;
}

.chat-voice-btn.recording {
  background: #e74c3c;
  color: #fff;
  border-color: #e74c3c;
  animation: pulse 1.2s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.4); }
  50% { box-shadow: 0 0 0 12px rgba(231, 76, 60, 0); }
}

/* ========== 快捷按钮组 ========== */
.chat-quick-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 16px;
  border-top: 1px solid #e8edf2;
  background: #fafbfc;
  flex-shrink: 0;
}

.chat-quick-btn {
  padding: 5px 12px;
  border-radius: 14px;
  border: 1px solid #dde2e8;
  background: #fff;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  color: #555;
  font-family: inherit;
}

.chat-quick-btn:hover {
  background: #e8f4f4;
  border-color: #2D7A7A;
  color: #2D7A7A;
}

.chat-quick-btn:active {
  background: #2D7A7A;
  color: #fff;
  border-color: #2D7A7A;
}

/* ========== 归类面板（右侧） ========== */
.categorize-panel {
  width: 260px;
  display: flex;
  flex-direction: column;
  background: #fafbfc;
  flex-shrink: 0;
}

.categorize-list {
  padding: 12px;
  overflow-y: auto;
  flex: 1;
}

.categorize-item {
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #e8edf2;
  animation: slideIn 0.3s ease-out;
  cursor: pointer;
  transition: border-color 0.15s;
}

.categorize-item:hover {
  border-color: #2D7A7A;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(12px); }
  to { opacity: 1; transform: translateX(0); }
}

.categorize-item .ci-module {
  font-size: 0.75rem;
  color: #2D7A7A;
  font-weight: 600;
  margin-bottom: 4px;
}

.categorize-item .ci-text {
  font-size: 0.82rem;
  color: #444;
  line-height: 1.4;
}

.categorize-item .ci-confidence {
  font-size: 0.68rem;
  color: #999;
  margin-top: 4px;
}

.categorize-item.uncertain {
  border-color: #f0c040;
  background: #fffef5;
}

.categorize-item.uncertain .ci-module {
  color: #b8860b;
}

/* ========== 确认按钮 ========== */
.categorize-confirm {
  padding: 12px;
  border-top: 1px solid #e8edf2;
  flex-shrink: 0;
}

.categorize-confirm button {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background: #2D7A7A;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
}

.categorize-confirm button:hover {
  background: #236b6b;
}

.categorize-confirm button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* ========== 空状态 ========== */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.empty-state .empty-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
}

.empty-state .empty-text {
  font-size: 0.85rem;
  line-height: 1.5;
}

/* ========== 打字指示器 ========== */
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 10px 14px;
  align-self: flex-start;
}

.typing-indicator span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #999;
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-6px); opacity: 1; }
}

/* ========== 响应式 ========== */
@media (max-width: 768px) {
  .chat-layout {
    flex-direction: column;
    height: calc(100vh - 60px);
    max-height: none;
    border-radius: 0;
  }

  .chat-panel {
    border-right: none;
    border-bottom: 1px solid #e8edf2;
  }

  .categorize-panel {
    width: 100%;
    max-height: 200px;
  }

  .chat-bubble {
    max-width: 90%;
  }

  .chat-quick-buttons {
    padding: 6px 10px;
    gap: 4px;
  }

  .chat-quick-btn {
    font-size: 0.72rem;
    padding: 4px 10px;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add css/chatbot.css
git commit -m "feat: add chatbot UI styles (bubbles, classify panel, voice, quick buttons, responsive)"
```

---

### Task 4: 对话引擎 + UI — `js/chatbot.js`

**Files:**
- Create: `js/chatbot.js`

**职责**：对话状态管理、提问流控制、DOM 渲染（消息气泡、归类面板、快捷按钮）、语音输入、确认保存。作为主入口模块，初始化 `#collect` 页面。

- [ ] **Step 1: 编写对话引擎模块**

```javascript
// js/chatbot.js
'use strict';

/**
 * 对话引擎 + UI 渲染
 * 管理对话状态、消息流、实时归类、确认保存
 * 暴露 window.ChatbotEngine 全局对象
 * 依赖：ChatbotClassifier, ChatbotTemplates
 */
(function () {
  // ========== 对话状态 ==========
  const state = {
    conversationId: null,
    youthName: '心青年',
    messages: [],           // {role, text, time}
    classifiedItems: [],    // {sentence, module, confidence, tempId}
    currentQuestionIndex: 0,
    template: null,
    totalRounds: 0,
    maxRounds: 10,
    isRecording: false,
    recognition: null,
    confirmed: false
  };

  // ========== DOM 引用 ==========
  let chatMessages, chatOptionsArea, categorizeList, confirmBtn;

  /**
   * 初始化对话引擎
   * @param {object} options - { youthName, hoursSinceLastRecord }
   */
  function init(options) {
    options = options || {};
    state.youthName = options.youthName || '心青年';
    state.conversationId = 'conv_' + Date.now();
    state.messages = [];
    state.classifiedItems = [];
    state.currentQuestionIndex = 0;
    state.totalRounds = 0;
    state.confirmed = false;

    // 获取模板
    state.template = window.ChatbotTemplates.getTemplate(options.hoursSinceLastRecord);
    state.maxRounds = state.template.maxRounds;

    // 获取 DOM
    chatMessages = document.getElementById('chat-messages');
    chatOptionsArea = document.getElementById('chat-options-area');
    categorizeList = document.getElementById('categorize-list');
    confirmBtn = document.getElementById('btn-confirm-record');

    // 清空
    if (chatMessages) chatMessages.innerHTML = '';
    if (categorizeList) {
      categorizeList.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-text">对话开始后，AI将实时归类采集到的信息</div></div>';
    }
    if (confirmBtn) confirmBtn.disabled = true;

    // 发送开场白
    addAIMessage(state.template.greeting, 500);
    setTimeout(() => {
      askNextQuestion();
    }, 1000);

    // 渲染快捷按钮
    renderQuickButtons();
    // 绑定发送
    bindSendEvents();
    // 绑定语音
    bindVoiceEvents();
  }

  // ========== 消息渲染 ==========

  function addAIMessage(text, delay) {
    delay = delay || 0;
    setTimeout(() => {
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble ai';
      bubble.innerHTML = text + '<div class="bubble-time">' + formatTime() + '</div>';
      if (chatMessages) chatMessages.appendChild(bubble);
      scrollToBottom();
      state.messages.push({ role: 'ai', text: text, time: new Date().toISOString() });
    }, delay);
  }

  function addUserMessage(text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user';
    bubble.innerHTML = text + '<div class="bubble-time">' + formatTime() + '</div>';
    if (chatMessages) chatMessages.appendChild(bubble);
    scrollToBottom();
    state.messages.push({ role: 'user', text: text, time: new Date().toISOString() });
  }

  function addSkipButton(questionId) {
    const template = state.template;
    const question = template.questions[state.currentQuestionIndex - 1];
    if (!question) return;
    const skipBtn = document.createElement('div');
    skipBtn.className = 'chat-skip-btn';
    skipBtn.textContent = question.skipText || '跳过';
    skipBtn.onclick = function () {
      skipBtn.remove();
      askNextQuestion();
    };
    if (chatMessages) chatMessages.appendChild(skipBtn);
    scrollToBottom();
  }

  function showTyping() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    if (chatMessages) chatMessages.appendChild(indicator);
    scrollToBottom();
  }

  function hideTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  function scrollToBottom() {
    if (chatMessages) {
      setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }, 50);
    }
  }

  // ========== 提问逻辑 ==========

  function askNextQuestion() {
    if (state.totalRounds >= state.maxRounds) {
      endConversation();
      return;
    }

    const questions = state.template.questions;
    if (state.currentQuestionIndex >= questions.length) {
      endConversation();
      return;
    }

    const question = questions[state.currentQuestionIndex];
    state.currentQuestionIndex++;
    state.totalRounds++;

    showTyping();
    setTimeout(() => {
      hideTyping();
      const qText = typeof question.text === 'function'
        ? question.text(state.youthName)
        : question.text;
      addAIMessage(qText);
      addSkipButton(question.id);
    }, 800 + Math.random() * 600);
  }

  function endConversation() {
    showTyping();
    setTimeout(() => {
      hideTyping();
      const count = state.classifiedItems.length;
      if (count > 0) {
        addAIMessage('好的，我已经帮你整理了以上 ' + count + ' 条记录。请确认右侧的归类结果，然后点击「确认以上记录」保存。');
      } else {
        addAIMessage('今天还没记录什么。下次有需要的时候随时找我聊~');
      }
    }, 800);
  }

  // ========== 用户输入处理 ==========

  function handleUserInput(text) {
    if (!text.trim()) return;
    if (state.confirmed) return;

    addUserMessage(text.trim());

    // 分类
    const results = window.ChatbotClassifier.classify(text.trim());
    const validResults = results.filter(r => r.module !== null);

    if (validResults.length > 0) {
      validResults.forEach(r => {
        const tempId = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        state.classifiedItems.push({
          sentence: r.sentence,
          module: r.module,
          confidence: r.confidence,
          tempId: tempId
        });
        renderClassifiedItem(r.sentence, r.module, r.confidence, tempId);
      });
      updateConfirmButton();
    }

    // 继续下一个问题
    setTimeout(() => askNextQuestion(), 600);
  }

  function handleQuickButton(btnData) {
    if (state.confirmed) return;
    addUserMessage(btnData.text);
    const tempId = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    state.classifiedItems.push({
      sentence: btnData.text,
      module: btnData.module,
      confidence: 1.0,
      tempId: tempId
    });
    renderClassifiedItem(btnData.text, btnData.module, 1.0, tempId);
    updateConfirmButton();
    setTimeout(() => askNextQuestion(), 400);
  }

  // ========== 归类面板渲染 ==========

  function renderClassifiedItem(sentence, module, confidence, tempId) {
    if (!categorizeList) return;
    // 移除空状态
    const emptyState = categorizeList.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const item = document.createElement('div');
    item.className = 'categorize-item' + (confidence < 0.1 ? ' uncertain' : '');
    item.dataset.tempId = tempId;
    item.innerHTML =
      '<div class="ci-module">' + window.ChatbotClassifier.getModuleIcon(module) +
      ' ' + window.ChatbotClassifier.getModuleName(module) + '</div>' +
      '<div class="ci-text">' + escapeHtml(sentence) + '</div>' +
      (confidence < 0.5
        ? '<div class="ci-confidence">置信度: ' + Math.round(confidence * 100) + '% — 点击可修改分类</div>'
        : '');

    // 点击切换模块
    item.onclick = function () {
      showModulePicker(item, tempId);
    };

    categorizeList.appendChild(item);
  }

  function showModulePicker(itemEl, tempId) {
    const modules = [
      { key: 'communicationGuide', name: '沟通说明书', icon: '💬' },
      { key: 'emotionBehavior', name: '情绪与行为', icon: '😊' },
      { key: 'careMedical', name: '照护与医疗', icon: '🍽' },
      { key: 'workSupport', name: '工作与生活', icon: '🔧' },
      { key: 'relationshipMap', name: '关系地图', icon: '👥' }
    ];

    const picker = document.createElement('div');
    picker.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;';
    modules.forEach(m => {
      const btn = document.createElement('button');
      btn.textContent = m.icon + ' ' + m.name;
      btn.style.cssText = 'padding:3px 8px;font-size:0.7rem;border:1px solid #dde2e8;border-radius:10px;background:#fff;cursor:pointer;font-family:inherit;';
      btn.onclick = function (e) {
        e.stopPropagation();
        // 更新数据
        const item = state.classifiedItems.find(i => i.tempId === tempId);
        if (item) {
          item.module = m.key;
          item.confidence = 1.0;
        }
        // 更新 DOM
        itemEl.querySelector('.ci-module').innerHTML = m.icon + ' ' + m.name;
        itemEl.classList.remove('uncertain');
        const confEl = itemEl.querySelector('.ci-confidence');
        if (confEl) confEl.remove();
        picker.remove();
      };
      picker.appendChild(btn);
    });
    itemEl.appendChild(picker);
  }

  function updateConfirmButton() {
    if (confirmBtn) {
      confirmBtn.disabled = state.classifiedItems.length === 0;
      confirmBtn.textContent = '✓ 确认以上记录（' + state.classifiedItems.length + ' 条）';
    }
  }

  // ========== 确认保存 ==========

  function confirmAndSave() {
    if (state.confirmed) return;
    if (state.classifiedItems.length === 0) return;

    state.confirmed = true;

    // 触发自定义事件，由外部 storage 层处理保存
    const event = new CustomEvent('chatbot:confirm', {
      detail: {
        conversationId: state.conversationId,
        items: state.classifiedItems.map(item => ({
          sentence: item.sentence,
          module: item.module,
          confidence: item.confidence
        })),
        timestamp: new Date().toISOString()
      }
    });
    document.dispatchEvent(event);

    // 禁用输入
    const inputEl = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    if (inputEl) inputEl.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = '✓ 已保存';
      confirmBtn.style.background = '#27ae60';
    }

    addAIMessage('记录已保存！你可以在首页看到今天的回顾。');
  }

  // ========== 快捷按钮 ==========

  function renderQuickButtons() {
    const area = document.getElementById('chat-quick-buttons');
    if (!area) return;
    area.innerHTML = '';
    const buttons = window.ChatbotTemplates.getQuickButtons();
    buttons.forEach(btn => {
      const el = document.createElement('button');
      el.className = 'chat-quick-btn';
      el.textContent = btn.label;
      el.onclick = function () { handleQuickButton(btn); };
      area.appendChild(el);
    });
  }

  // ========== 发送绑定 ==========

  function bindSendEvents() {
    const inputEl = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    if (!inputEl || !sendBtn) return;

    sendBtn.onclick = function () {
      handleUserInput(inputEl.value);
      inputEl.value = '';
    };

    inputEl.onkeydown = function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleUserInput(inputEl.value);
        inputEl.value = '';
      }
    };
  }

  // ========== 语音输入 ==========

  function bindVoiceEvents() {
    const voiceBtn = document.getElementById('chat-voice-btn');
    if (!voiceBtn) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      voiceBtn.style.display = 'none';
      return;
    }

    voiceBtn.onmousedown = function () {
      startRecording(voiceBtn, SpeechRecognition);
    };
    voiceBtn.onmouseup = function () {
      stopRecording(voiceBtn);
    };
    voiceBtn.onmouseleave = function () {
      if (state.isRecording) stopRecording(voiceBtn);
    };

    // 触摸事件
    voiceBtn.ontouchstart = function (e) {
      e.preventDefault();
      startRecording(voiceBtn, SpeechRecognition);
    };
    voiceBtn.ontouchend = function (e) {
      e.preventDefault();
      stopRecording(voiceBtn);
    };
  }

  function startRecording(voiceBtn, SpeechRecognition) {
    if (state.isRecording) return;
    state.isRecording = true;
    voiceBtn.classList.add('recording');
    voiceBtn.textContent = '🔴';

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = function (event) {
      const text = event.results[0][0].transcript;
      handleUserInput(text);
    };

    recognition.onerror = function () {
      stopRecording(voiceBtn);
    };

    recognition.onend = function () {
      stopRecording(voiceBtn);
    };

    state.recognition = recognition;
    recognition.start();
  }

  function stopRecording(voiceBtn) {
    if (!state.isRecording) return;
    state.isRecording = false;
    voiceBtn.classList.remove('recording');
    voiceBtn.textContent = '🎤';
    if (state.recognition) {
      state.recognition.stop();
      state.recognition = null;
    }
  }

  // ========== 工具函数 ==========

  function formatTime() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ========== 暴露全局接口 ==========
  window.ChatbotEngine = {
    init: init,
    handleUserInput: handleUserInput,
    confirmAndSave: confirmAndSave,
    getState: function () { return state; }
  };
})();
```

- [ ] **Step 2: 提交**

```bash
git add js/chatbot.js
git commit -m "feat: add chatbot engine with conversation flow, UI rendering, voice input, and quick buttons"
```

---

### Task 5: 数据分析层 — `js/chatbot-analysis.js`

**Files:**
- Create: `js/chatbot-analysis.js`

**职责**：从 `RecordEntry` 数据中计算每日回顾、异常检测、周报/月报生成。暴露 `window.ChatbotAnalysis` 全局对象。

- [ ] **Step 1: 编写数据分析模块**

```javascript
// js/chatbot-analysis.js
'use strict';

/**
 * 数据分析层
 * 每日回顾、异常检测、周报/月报生成
 * 暴露 window.ChatbotAnalysis 全局对象
 */
(function () {
  // ========== 异常阈值配置 ==========
  const THRESHOLDS = {
    appetiteDecline: 3,      // 连续 N 天食欲下降
    moodLow: 2,              // 连续 N 天情绪低谷
    medicationRate: 0.8,     // 用药准时率低于 80%
    sleepShort: 2,           // 连续 N 天睡眠 < 6 小时
    recordGap: 24            // 超过 N 小时无记录
  };

  // ========== 每日回顾 ==========

  /**
   * 生成每日回顾
   * @param {string} date - YYYY-MM-DD
   * @param {Array} records - 当日 RecordEntry 数组
   * @param {Array} recentRecords - 近 7 天 RecordEntry 数组（用于趋势判断）
   * @returns {{ summary: string, alerts: string[] }}
   */
  function generateDailySummary(date, records, recentRecords) {
    const moduleCounts = {};
    const moduleDetails = {};

    records.forEach(r => {
      const mod = r.module;
      if (!moduleCounts[mod]) {
        moduleCounts[mod] = 0;
        moduleDetails[mod] = [];
      }
      moduleCounts[mod]++;
      if (r.content && r.content.text) {
        moduleDetails[mod].push(r.content.text);
      }
    });

    // 构建摘要
    const parts = [];
    for (const [mod, count] of Object.entries(moduleCounts)) {
      const modName = window.ChatbotClassifier
        ? window.ChatbotClassifier.getModuleName(mod)
        : mod;
      const detailSamples = (moduleDetails[mod] || []).slice(0, 2).join('、');
      parts.push(modName + ' ' + count + ' 条（' + detailSamples + '）');
    }

    const summary = parts.length > 0
      ? '今日记录：' + parts.join('；') + '。'
      : '今日暂无记录。';

    // 异常检测
    const alerts = detectAnomalies(records, recentRecords);

    return {
      date: date,
      summary: summary,
      alerts: alerts,
      recordCount: records.length,
      moduleCounts: moduleCounts
    };
  }

  /**
   * 异常检测
   * @param {Array} todayRecords
   * @param {Array} recentRecords - 近 7 天
   * @returns {string[]}
   */
  function detectAnomalies(todayRecords, recentRecords) {
    const alerts = [];

    // 按天分组
    const byDay = groupByDay(recentRecords);

    // 1. 食欲连续下降
    if (checkAppetiteDecline(byDay)) {
      alerts.push('近 ' + THRESHOLDS.appetiteDecline + ' 天食欲评分连续下降，建议关注饮食情况。');
    }

    // 2. 情绪低谷
    if (checkMoodLow(byDay)) {
      alerts.push('近 ' + THRESHOLDS.moodLow + ' 天出现情绪低谷，建议关注情绪触发因素。');
    }

    // 3. 用药准时率
    if (checkMedicationRate(byDay)) {
      alerts.push('近 7 天用药准时率低于 ' + Math.round(THRESHOLDS.medicationRate * 100) + '%，请注意按时用药。');
    }

    // 4. 睡眠不足
    if (checkSleepShort(byDay)) {
      alerts.push('连续 ' + THRESHOLDS.sleepShort + ' 天睡眠不足 6 小时，建议关注睡眠质量。');
    }

    // 5. 记录间隔
    if (todayRecords.length === 0 && recentRecords.length > 0) {
      const lastRecord = recentRecords[recentRecords.length - 1];
      const hoursSince = (Date.now() - new Date(lastRecord.recordedAt).getTime()) / 3600000;
      if (hoursSince > THRESHOLDS.recordGap) {
        alerts.push('已超过 ' + THRESHOLDS.recordGap + ' 小时没有记录，别忘了记录今天的情况哦。');
      }
    }

    return alerts;
  }

  // ========== 周报/月报 ==========

  /**
   * 生成周报
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @param {Array} records - 该周所有 RecordEntry
   * @returns {Array<{module, moduleName, summary, trend, suggestion}>}
   */
  function generateWeeklyReport(startDate, endDate, records) {
    const modules = ['communicationGuide', 'emotionBehavior', 'careMedical', 'workSupport', 'relationshipMap'];
    const byDay = groupByDay(records);
    const days = Object.keys(byDay).sort();

    const report = modules.map(mod => {
      const modRecords = records.filter(r => r.module === mod);
      const modName = window.ChatbotClassifier
        ? window.ChatbotClassifier.getModuleName(mod)
        : mod;

      // 摘要
      const summary = buildModuleSummary(mod, modRecords);

      // 趋势（对比前一周）
      const trend = calculateTrend(mod, records, days);

      // 建议
      const suggestion = generateSuggestion(mod, trend, modRecords);

      return {
        module: mod,
        moduleName: modName,
        summary: summary,
        trend: trend,
        suggestion: suggestion
      };
    });

    return {
      startDate: startDate,
      endDate: endDate,
      totalRecords: records.length,
      modules: report
    };
  }

  /**
   * 生成月报（结构与周报相同，时间跨度不同）
   */
  function generateMonthlyReport(year, month, records) {
    const startDate = year + '-' + String(month).padStart(2, '0') + '-01';
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = year + '-' + String(month).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');

    const report = generateWeeklyReport(startDate, endDate, records);
    report.type = 'monthly';
    report.year = year;
    report.month = month;
    return report;
  }

  // ========== 辅助函数 ==========

  function groupByDay(records) {
    const byDay = {};
    records.forEach(r => {
      const day = (r.recordedAt || '').substring(0, 10);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(r);
    });
    return byDay;
  }

  function checkAppetiteDecline(byDay) {
    const days = Object.keys(byDay).sort().slice(-THRESHOLDS.appetiteDecline);
    if (days.length < THRESHOLDS.appetiteDecline) return false;
    // 简化的食欲检测：查找包含"差""不好""没吃"的饮食记录
    let declineCount = 0;
    for (const day of days) {
      const foodRecords = (byDay[day] || []).filter(r =>
        r.module === 'careMedical' && r.content && r.content.text
      );
      const hasBad = foodRecords.some(r => {
        const t = r.content.text;
        return t.includes('差') || t.includes('不好') || t.includes('没吃') || t.includes('没怎么');
      });
      if (hasBad) declineCount++;
    }
    return declineCount >= THRESHOLDS.appetiteDecline;
  }

  function checkMoodLow(byDay) {
    const days = Object.keys(byDay).sort().slice(-THRESHOLDS.moodLow);
    if (days.length < THRESHOLDS.moodLow) return false;
    let lowCount = 0;
    for (const day of days) {
      const moodRecords = (byDay[day] || []).filter(r =>
        r.module === 'emotionBehavior' && r.content && r.content.text
      );
      const hasLow = moodRecords.some(r => {
        const t = r.content.text;
        return t.includes('低落') || t.includes('烦躁') || t.includes('哭') ||
               t.includes('发脾气') || t.includes('情绪差');
      });
      if (hasLow) lowCount++;
    }
    return lowCount >= THRESHOLDS.moodLow;
  }

  function checkMedicationRate(byDay) {
    const days = Object.keys(byDay).sort().slice(-7);
    if (days.length < 3) return false;
    let totalDays = 0;
    let missedDays = 0;
    for (const day of days) {
      const medRecords = (byDay[day] || []).filter(r =>
        r.module === 'careMedical' && r.content && r.content.text &&
        (r.content.text.includes('药') || r.content.text.includes('服药'))
      );
      if (medRecords.length > 0) {
        totalDays++;
        const missed = medRecords.some(r => {
          const t = r.content.text;
          return t.includes('没吃') || t.includes('漏') || t.includes('忘');
        });
        if (missed) missedDays++;
      }
    }
    if (totalDays === 0) return false;
    return (totalDays - missedDays) / totalDays < THRESHOLDS.medicationRate;
  }

  function checkSleepShort(byDay) {
    const days = Object.keys(byDay).sort().slice(-THRESHOLDS.sleepShort);
    if (days.length < THRESHOLDS.sleepShort) return false;
    // 简化：查找"睡眠"相关的负面记录
    let shortCount = 0;
    for (const day of days) {
      const sleepRecords = (byDay[day] || []).filter(r =>
        r.module === 'careMedical' && r.content && r.content.text &&
        (r.content.text.includes('睡眠') || r.content.text.includes('睡觉') || r.content.text.includes('睡'))
      );
      const hasShort = sleepRecords.some(r => {
        const t = r.content.text;
        return t.includes('没睡好') || t.includes('失眠') || t.includes('睡眠差') ||
               t.includes('睡得差') || t.includes('睡得不好');
      });
      if (hasShort) shortCount++;
    }
    return shortCount >= THRESHOLDS.sleepShort;
  }

  function buildModuleSummary(module, records) {
    if (records.length === 0) return '本周无记录';
    const texts = records.map(r => (r.content && r.content.text) || '').filter(t => t);
    if (texts.length === 0) return '本周 ' + records.length + ' 条记录';
    // 取前 2 条有代表性的
    const samples = texts.slice(-3).join('；');
    return '共 ' + records.length + ' 条记录。' + (samples.length > 50 ? samples.substring(0, 50) + '...' : samples);
  }

  function calculateTrend(module, records, days) {
    if (records.length < 3 || days.length < 3) return '→ 数据不足';
    // 简化：对比前后半段记录数
    const mid = Math.floor(days.length / 2);
    const firstHalf = records.filter(r => (r.recordedAt || '').substring(0, 10) <= days[mid]);
    const secondHalf = records.filter(r => (r.recordedAt || '').substring(0, 10) > days[mid]);
    const diff = secondHalf.length - firstHalf.length;
    if (diff > 2) return '↑ 增加';
    if (diff < -2) return '↓ 减少';
    return '→ 稳定';
  }

  function generateSuggestion(module, trend, records) {
    if (trend === '↓ 减少' && module === 'emotionBehavior') {
      return '建议关注情绪触发因素，增加正向互动';
    }
    if (trend === '↓ 减少' && module === 'careMedical') {
      return '建议增加照护记录频率，确保信息完整';
    }
    if (trend === '↑ 增加' && module === 'emotionBehavior') {
      return '情绪记录增多，如有异常请及时关注';
    }
    if (trend === '→ 稳定') return '—';
    return '';
  }

  // ========== 暴露全局接口 ==========
  window.ChatbotAnalysis = {
    generateDailySummary: generateDailySummary,
    generateWeeklyReport: generateWeeklyReport,
    generateMonthlyReport: generateMonthlyReport,
    detectAnomalies: detectAnomalies,
    THRESHOLDS: THRESHOLDS
  };
})();
```

- [ ] **Step 2: 验证分析模块**

在浏览器控制台运行测试：

```javascript
// 模拟记录数据
const testRecords = [
  { module: 'careMedical', content: { text: '晚饭吃了半碗米饭，胃口不太好' }, recordedAt: '2026-07-27T19:30:00' },
  { module: 'emotionBehavior', content: { text: '情绪还行，没有哭闹' }, recordedAt: '2026-07-27T19:31:00' },
  { module: 'careMedical', content: { text: '按时吃药了' }, recordedAt: '2026-07-27T20:00:00' }
];

// 测试每日回顾
const summary = ChatbotAnalysis.generateDailySummary('2026-07-27', testRecords, testRecords);
console.log(summary.summary); // 期望: 包含模块名称和记录数
console.log(summary.alerts);   // 期望: 数组

// 测试周报
const weekly = ChatbotAnalysis.generateWeeklyReport('2026-07-21', '2026-07-27', testRecords);
console.log(weekly.totalRecords); // 期望: 3
console.log(weekly.modules.length); // 期望: 5
```

- [ ] **Step 3: 提交**

```bash
git add js/chatbot-analysis.js
git commit -m "feat: add chatbot analysis layer (daily summary, anomaly detection, weekly/monthly reports)"
```

---

### Task 6: 更新 `index.html` — 引入模块并增强对话页面

**Files:**
- Modify: `index.html`

**职责**：在 `</body>` 前引入所有新模块；在 `#collect` 区域内添加输入框、语音按钮、快捷按钮区域、确认按钮。

- [ ] **Step 1: 添加脚本引入和增强 HTML**

在 `index.html` 中：

1. 在 `</body>` 前，`<script src="js/app.js"></script>` 之前添加：
```html
<script src="js/chatbot-classifier.js"></script>
<script src="js/chatbot-templates.js"></script>
<script src="js/chatbot.js"></script>
<script src="js/chatbot-analysis.js"></script>
```

2. 在 `<head>` 中，`<link rel="stylesheet" href="css/style.css">` 之后添加：
```html
<link rel="stylesheet" href="css/chatbot.css">
```

3. 在 `#collect` 区域的 `chat-panel` 内，`<div class="chat-messages" id="chat-messages"></div>` 之后，`<div id="chat-options-area"></div>` 之前，添加：
```html
<div class="chat-quick-buttons" id="chat-quick-buttons"></div>
<div class="chat-input-area">
  <button class="chat-voice-btn" id="chat-voice-btn" title="按住说话">🎤</button>
  <input class="chat-input" type="text" id="chat-input" placeholder="打字或按住说话...">
  <button class="chat-send-btn" id="chat-send-btn" title="发送">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8l12-6-6 12-2-6-4-0z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
</div>
```

4. 在 `#categorize-list` 之后，`</div>` (categorize-panel) 之前，添加：
```html
<div class="categorize-confirm">
  <button id="btn-confirm-record" disabled>✓ 确认以上记录</button>
</div>
```

- [ ] **Step 2: 验证页面结构**

在浏览器中打开 `index.html`，登录后切换到「对话式信息采集」页面，确认：
- 聊天窗口显示正常
- 底部有输入框、语音按钮、发送按钮
- 底部有快捷按钮组
- 右侧有归类面板和确认按钮

- [ ] **Step 3: 绑定确认按钮事件**

在 `js/chatbot.js` 已有的初始化逻辑中，确认按钮 `#btn-confirm-record` 的 `onclick` 已绑定到 `window.ChatbotEngine.confirmAndSave`。在 `index.html` 中额外添加一个初始化脚本：

```html
<script>
// 在页面切换到 #collect 时初始化对话引擎
document.addEventListener('DOMContentLoaded', function () {
  var confirmBtn = document.getElementById('btn-confirm-record');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
      if (window.ChatbotEngine) {
        window.ChatbotEngine.confirmAndSave();
      }
    });
  }
});
</script>
```

- [ ] **Step 4: 提交**

```bash
git add index.html
git commit -m "feat: integrate chatbot modules into index.html with enhanced UI"
```

---

### Task 7: 端到端验证

- [ ] **Step 1: 功能测试清单**

在浏览器中完成以下验证：

1. **对话启动**：进入对话采集页面，AI 应自动发送开场白
2. **文字输入**：输入"晚饭吃了半碗米饭"，按回车，确认消息气泡显示，右侧归类面板出现照护与医疗分类
3. **快捷按钮**：点击「吃饭好」按钮，确认自动发送并归类
4. **跳过**：点击 AI 消息下方的「跳过」按钮，确认跳到下一个问题
5. **分类修改**：点击归类面板中的条目，确认弹出模块选择器，可切换分类
6. **确认保存**：点击「确认以上记录」，确认按钮变绿，输入框禁用
7. **语音输入**（Chrome）：按住麦克风按钮说话，松开后确认文本发送
8. **轮次上限**：完成 10 轮对话后，确认 AI 自动结束并提示确认
9. **每日回顾**：在控制台调用 `ChatbotAnalysis.generateDailySummary(...)` 确认返回正确摘要
10. **周报**：在控制台调用 `ChatbotAnalysis.generateWeeklyReport(...)` 确认返回 5 个模块的报告

- [ ] **Step 2: 提交（如有修复）**

```bash
git add -A
git commit -m "fix: end-to-end testing fixes for chatbot system"
```