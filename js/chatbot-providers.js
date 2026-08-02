/**
 * chatbot-providers.js - 对话系统提供者注册中心
 *
 * 策略模式：定义 Classifier / QuestionProvider / AnalysisProvider 三个接口，
 * 当前使用本地关键词引擎实现，未来可替换为 LLM 实现。
 *
 * 接口契约：
 *
 * Classifier {
 *   classify(text: string) → [{ sentence, module, confidence }]
 *   getModuleName(moduleKey: string) → string
 *   getModuleIcon(moduleKey: string) → string
 * }
 *
 * QuestionProvider {
 *   getTemplate(hoursSinceLastRecord: number|null) → { period, strategy, greeting, questions, maxRounds }
 *   getQuickButtons() → [{ id, label, module, text }]
 * }
 *
 * AnalysisProvider {
 *   generateDailySummary(date, records, recentRecords) → { date, summary, alerts, recordCount, moduleCounts }
 *   generateWeeklyReport(startDate, endDate, records) → { startDate, endDate, totalRecords, modules }
 *   generateMonthlyReport(year, month, records) → { type, year, month, ...weeklyReport }
 *   detectAnomalies(todayRecords, recentRecords) → [string]
 * }
 */
(function () {
  'use strict';

  var _registry = {
    classifier: null,
    questionProvider: null,
    analysisProvider: null
  };

  var _providers = {};

  /**
   * 注册提供者
   * @param {string} name - 提供者名称（如 'keyword', 'llm-openai', 'llm-local'）
   * @param {object} provider - 提供者实现
   */
  function register(name, provider) {
    _providers[name] = provider;
  }

  /**
   * 切换到指定提供者
   * @param {string} role - 'classifier' | 'questionProvider' | 'analysisProvider'
   * @param {string} name - 提供者名称
   */
  function switchProvider(role, name) {
    if (!_providers[name]) {
      console.warn('ChatbotProviders: 提供者 "' + name + '" 未注册');
      return false;
    }
    _registry[role] = _providers[name];
    return true;
  }

  /**
   * 获取当前分类器
   */
  function getClassifier() {
    return _registry.classifier;
  }

  /**
   * 获取当前问题提供者
   */
  function getQuestionProvider() {
    return _registry.questionProvider;
  }

  /**
   * 获取当前分析提供者
   */
  function getAnalysisProvider() {
    return _registry.analysisProvider;
  }

  /**
   * 列出所有已注册的提供者
   */
  function listProviders() {
    return Object.keys(_providers);
  }

  // ========== 暴露全局接口 ==========
  window.ChatbotProviders = {
    register: register,
    switchProvider: switchProvider,
    getClassifier: getClassifier,
    getQuestionProvider: getQuestionProvider,
    getAnalysisProvider: getAnalysisProvider,
    listProviders: listProviders
  };

  // ========== 智谱 AI 提供者注册 ==========
  // 延迟注册，等待 ZhipuClient 和 ChatbotTemplates 就绪
  function _registerZhipuProvider() {
    if (!window.ZhipuClient || !window.ChatbotTemplates) {
      setTimeout(_registerZhipuProvider, 200);
      return;
    }

    // 初始化 API Key（优先级：localStorage > Electron 环境变量）
    var apiKey = '';
    try {
      // 1. 尝试从 localStorage 读取
      apiKey = localStorage.getItem('zhipu_api_key') || '';
      // 2. 尝试从 Electron 环境变量读取
      if (!apiKey && window.electronAPI && window.electronAPI.getEnv) {
        apiKey = window.electronAPI.getEnv('ZHIPU_API_KEY') || '';
      }
    } catch (e) {
      console.warn('ChatbotProviders: 无法读取 API Key 配置', e);
    }

    if (apiKey) {
      window.ZhipuClient.init({ apiKey: apiKey });
      console.log('ChatbotProviders: 智谱 API Key 已配置');
    } else {
      console.log('ChatbotProviders: 未配置 API Key，对话将使用本地关键词引擎');
    }

    var keywordClassifier = window.ChatbotClassifier;
    var keywordTemplates = window.ChatbotTemplates;

    var zhipuProvider = {
      name: 'zhipu',

      // Classifier: 优先用 AI 分类，降级到关键词
      classify: function (text) {
        if (window.ZhipuClient.isAvailable()) {
          return window.ZhipuClient.classify(text);
        }
        // 降级到关键词分类
        if (keywordClassifier) {
          return keywordClassifier.classify(text);
        }
        return [];
      },

      getModuleName: function (moduleKey) {
        if (keywordClassifier) return keywordClassifier.getModuleName(moduleKey);
        return moduleKey;
      },

      getModuleIcon: function (moduleKey) {
        if (keywordClassifier) return keywordClassifier.getModuleIcon(moduleKey);
        return '📝';
      },

      // QuestionProvider: 优先用 AI 生成对话，降级到模板
      getTemplate: function (hoursSinceLastRecord) {
        if (keywordTemplates) {
          return keywordTemplates.getTemplate(hoursSinceLastRecord);
        }
        return { greeting: '你好！今天想记录什么？', questions: [], maxRounds: 20 };
      },

      getQuickButtons: function () {
        if (keywordTemplates) return keywordTemplates.getQuickButtons();
        return [];
      }
    };

    register('zhipu', zhipuProvider);

    // 检测代理可用性，然后决定是否切换到智谱
    window.ZhipuClient.checkProxy().then(function (proxyOk) {
      if (proxyOk) {
        switchProvider('classifier', 'zhipu');
        switchProvider('questionProvider', 'zhipu');
        console.log('ChatbotProviders: 已切换到智谱 AI 提供者（服务端代理）');
      } else if (window.ZhipuClient.isAvailable()) {
        switchProvider('classifier', 'zhipu');
        switchProvider('questionProvider', 'zhipu');
        console.log('ChatbotProviders: 已切换到智谱 AI 提供者（客户端直连）');
      } else {
        console.log('ChatbotProviders: 未配置 API Key，使用本地关键词引擎');
      }
    });
  }

  // 等待 DOM 和脚本就绪后注册
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _registerZhipuProvider);
  } else {
    _registerZhipuProvider();
  }
})();