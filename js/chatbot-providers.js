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
})();