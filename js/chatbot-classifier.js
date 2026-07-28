/**
 * chatbot-classifier.js - 关键词分类引擎
 * 将用户输入文本按句子拆分，匹配关键词，归类到 5 大模块
 * 依赖：Modules（modules.js）
 */
(function () {
  'use strict';

  // ========== 句式修正规则 ==========
  var NEGATION_PATTERNS = [
    /没有(哭|闹|发脾气|攻击|尖叫|伤人|自伤)/,
    /没(哭|闹|病|发烧|吐|腹泻)/,
    /不(吃饭|喝水|吃药|睡觉|说话)/
  ];

  /**
   * 按标点符号拆分句子
   */
  function splitSentences(text) {
    return text
      .split(/[，,。！!？?；;、\n]+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
  }

  /**
   * 检查句子是否为否定句式
   */
  function isNegation(sentence) {
    return NEGATION_PATTERNS.some(function (p) { return p.test(sentence); });
  }

  /**
   * 计算句子与某模块的匹配分数
   */
  function matchScore(sentence, keywords) {
    var score = 0;
    for (var i = 0; i < keywords.length; i++) {
      if (sentence.indexOf(keywords[i]) > -1) {
        score += keywords[i].length;
      }
    }
    var maxPossible = keywords.length * 3;
    return Math.min(score / maxPossible, 1);
  }

  /**
   * 分类单个句子
   */
  function classifySentence(sentence) {
    var negated = isNegation(sentence);
    var bestModule = null;
    var bestScore = 0;
    var keywords = window.Modules ? window.Modules.MODULE_KEYWORDS : {};

    for (var mod in keywords) {
      if (!keywords.hasOwnProperty(mod)) continue;
      var score = matchScore(sentence, keywords[mod]);
      if (score > bestScore) {
        bestScore = score;
        bestModule = mod;
      }
    }

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
   */
  function classify(text) {
    var sentences = splitSentences(text);
    return sentences.map(function (sentence) {
      var result = classifySentence(sentence);
      return {
        sentence: sentence,
        module: result.module,
        confidence: result.confidence
      };
    });
  }

  /**
   * 获取模块中文名
   */
  function getModuleName(moduleKey) {
    var names = {
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
   */
  function getModuleIcon(moduleKey) {
    var icons = {
      communicationGuide: '💬',
      emotionBehavior: '🌊',
      careMedical: '💊',
      workSupport: '💼',
      relationshipMap: '🗺️'
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