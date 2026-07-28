/**
 * chatbot-templates.js - 问题模板库
 * 按时间/间隔组织提问策略，每个模板包含首发问题、追问链、跳过文案
 */
(function () {
  'use strict';

  // ========== 按时间段组织的问题模板 ==========
  var TIME_TEMPLATES = {
    morning: {
      label: '早上',
      greeting: '早上好！',
      questions: [
        {
          id: 'sleep',
          text: function (name) { return name + '昨晚睡得怎么样？'; },
          module: 'careMedical',
          skipText: '跳过睡眠',
          followUp: function (name) { return '大概睡了几个小时？入睡顺利吗？'; }
        },
        {
          id: 'breakfast',
          text: function (name) { return '早餐吃了吗？胃口怎么样？'; },
          module: 'careMedical',
          skipText: '跳过早餐',
          followUp: function (name) { return '吃了什么？有没有特别喜欢的或拒绝的？'; }
        },
        {
          id: 'morning_plan',
          text: function (name) { return '今天有什么特别的安排吗？'; },
          module: 'workSupport',
          skipText: '跳过计划',
          followUp: function (name) { return '需要我帮你记下来吗？'; }
        }
      ]
    },
    noon: {
      label: '中午',
      greeting: '午饭时间到了！',
      questions: [
        {
          id: 'lunch',
          text: function (name) { return name + '午饭吃得怎么样？'; },
          module: 'careMedical',
          skipText: '跳过午饭',
          followUp: function (name) { return '吃了多少？有没有挑食？'; }
        },
        {
          id: 'morning_activity',
          text: function (name) { return '上午做了什么活动？'; },
          module: 'workSupport',
          skipText: '跳过上午活动',
          followUp: function (name) { return '参与得开心吗？'; }
        },
        {
          id: 'noon_mood',
          text: function (name) { return '上午情绪怎么样？'; },
          module: 'emotionBehavior',
          skipText: '跳过情绪',
          followUp: function (name) { return '有没有特别开心或烦躁的事？'; }
        }
      ]
    },
    evening: {
      label: '傍晚',
      greeting: '晚饭时间到了！',
      questions: [
        {
          id: 'dinner',
          text: function (name) { return name + '今天吃晚饭了吗？'; },
          module: 'careMedical',
          skipText: '跳过晚饭',
          followUp: function (name) { return '吃了什么？胃口和平时比怎么样？'; }
        },
        {
          id: 'afternoon_mood',
          text: function (name) { return '下午情绪怎么样？'; },
          module: 'emotionBehavior',
          skipText: '跳过情绪',
          followUp: function (name) { return '有没有哭闹或者特别开心的事？'; }
        },
        {
          id: 'medication',
          text: function (name) { return '今天按时吃药了吗？'; },
          module: 'careMedical',
          skipText: '跳过用药',
          followUp: function (name) { return '有没有漏服或不适？'; }
        }
      ]
    },
    night: {
      label: '晚上',
      greeting: '一天快结束了~',
      questions: [
        {
          id: 'daily_review',
          text: function (name) { return '今天整体感觉怎么样？'; },
          module: 'emotionBehavior',
          skipText: '跳过回顾',
          followUp: function (name) { return '有什么特别的事想记录下来吗？'; }
        },
        {
          id: 'social',
          text: function (name) { return '今天和谁互动了吗？'; },
          module: 'relationshipMap',
          skipText: '跳过社交',
          followUp: function (name) { return '互动得怎么样？'; }
        },
        {
          id: 'medication_night',
          text: function (name) { return '晚上的药吃了吗？'; },
          module: 'careMedical',
          skipText: '跳过用药',
          followUp: function (name) { return '有没有什么不适？'; }
        },
        {
          id: 'tomorrow',
          text: function (name) { return '明天有什么需要特别注意的吗？'; },
          module: 'workSupport',
          skipText: '跳过明日',
          followUp: function (name) { return '我帮你记在交接便签里？'; }
        }
      ]
    }
  };

  // ========== 按记录间隔组织的策略 ==========
  var INTERVAL_STRATEGIES = {
    recent: {
      maxRounds: 3,
      label: '精简模式'
    },
    standard: {
      maxRounds: 6,
      label: '标准模式'
    },
    full: {
      maxRounds: 10,
      label: '完整模式'
    }
  };

  /**
   * 根据当前时间确定时段
   */
  function getTimePeriod() {
    var hour = new Date().getHours();
    if (hour >= 7 && hour < 10) return 'morning';
    if (hour >= 11 && hour < 13) return 'noon';
    if (hour >= 17 && hour < 20) return 'evening';
    return 'night';
  }

  /**
   * 根据上次记录间隔确定策略
   */
  function getIntervalStrategy(hoursSinceLastRecord) {
    if (hoursSinceLastRecord === null || hoursSinceLastRecord === undefined) return 'full';
    if (hoursSinceLastRecord < 4) return 'recent';
    if (hoursSinceLastRecord < 12) return 'standard';
    return 'full';
  }

  /**
   * 获取当前时段的问题模板
   */
  function getTemplate(hoursSinceLastRecord) {
    var period = getTimePeriod();
    var strategy = getIntervalStrategy(hoursSinceLastRecord);
    var timeTemplate = TIME_TEMPLATES[period];

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