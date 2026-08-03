/**
 * chatbot-analysis.js - 数据分析层
 * 每日回顾、异常检测、周报/月报生成
 * 暴露 window.ChatbotAnalysis 全局对象
 */
(function () {
  'use strict';

  // ========== 异常阈值配置 ==========
  var THRESHOLDS = {
    appetiteDecline: 3,
    moodLow: 2,
    medicationRate: 0.8,
    sleepShort: 2,
    recordGap: 24
  };

  /**
   * 生成每日回顾
   */
  function generateDailySummary(date, records, recentRecords) {
    var moduleCounts = {};
    var moduleDetails = {};

    (records || []).forEach(function (r) {
      var mod = r.module;
      if (!moduleCounts[mod]) {
        moduleCounts[mod] = 0;
        moduleDetails[mod] = [];
      }
      moduleCounts[mod]++;
      if (r.content && r.content.text) {
        moduleDetails[mod].push(r.content.text);
      }
    });

    var parts = [];
    for (var mod in moduleCounts) {
      if (!moduleCounts.hasOwnProperty(mod)) continue;
      var modName = window.ChatbotClassifier
        ? window.ChatbotClassifier.getModuleName(mod)
        : mod;
      var detailSamples = (moduleDetails[mod] || []).slice(0, 2).join('、');
      parts.push(modName + ' ' + moduleCounts[mod] + ' 条（' + detailSamples + '）');
    }

    var summary = parts.length > 0
      ? '今日记录：' + parts.join('；') + '。'
      : '今日暂无记录。';

    var alerts = detectAnomalies(records, recentRecords);

    return {
      date: date,
      summary: summary,
      alerts: alerts,
      recordCount: (records || []).length,
      moduleCounts: moduleCounts
    };
  }

  /**
   * 异常检测
   */
  function detectAnomalies(todayRecords, recentRecords) {
    var alerts = [];
    var byDay = groupByDay(recentRecords || []);

    if (checkAppetiteDecline(byDay)) {
      alerts.push('近 ' + THRESHOLDS.appetiteDecline + ' 天食欲评分连续下降，建议关注饮食情况。');
    }

    if (checkMoodLow(byDay)) {
      alerts.push('近 ' + THRESHOLDS.moodLow + ' 天出现情绪低谷，建议关注情绪触发因素。');
    }

    if (checkMedicationRate(byDay)) {
      alerts.push('近 7 天用药准时率低于 ' + Math.round(THRESHOLDS.medicationRate * 100) + '%，请注意按时用药。');
    }

    if (checkSleepShort(byDay)) {
      alerts.push('连续 ' + THRESHOLDS.sleepShort + ' 天睡眠不足，建议关注睡眠质量。');
    }

    if ((todayRecords || []).length === 0 && (recentRecords || []).length > 0) {
      var lastRecord = recentRecords[recentRecords.length - 1];
      var hoursSince = (Date.now() - new Date(lastRecord.recordedAt).getTime()) / 3600000;
      if (hoursSince > THRESHOLDS.recordGap) {
        alerts.push('已超过 ' + THRESHOLDS.recordGap + ' 小时没有记录，别忘了记录今天的情况哦。');
      }
    }

    return alerts;
  }

  /**
   * 生成周报
   */
  function generateWeeklyReport(startDate, endDate, records) {
    var modules = ['communicationGuide', 'emotionBehavior', 'careMedical', 'workSupport'];
    var byDay = groupByDay(records || []);
    var days = Object.keys(byDay).sort();

    var report = modules.map(function (mod) {
      var modRecords = (records || []).filter(function (r) { return r.module === mod; });
      var modName = window.ChatbotClassifier
        ? window.ChatbotClassifier.getModuleName(mod)
        : mod;

      var summary = buildModuleSummary(mod, modRecords);
      var trend = calculateTrend(mod, modRecords, days);
      var suggestion = generateSuggestion(mod, trend, modRecords);

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
      totalRecords: (records || []).length,
      modules: report
    };
  }

  /**
   * 生成月报
   */
  function generateMonthlyReport(year, month, records) {
    var startDate = year + '-' + String(month).padStart(2, '0') + '-01';
    var lastDay = new Date(year, month, 0).getDate();
    var endDate = year + '-' + String(month).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');

    var report = generateWeeklyReport(startDate, endDate, records);
    report.type = 'monthly';
    report.year = year;
    report.month = month;
    return report;
  }

  // ========== 辅助函数 ==========
  function groupByDay(records) {
    var byDay = {};
    (records || []).forEach(function (r) {
      var day = (r.recordedAt || '').substring(0, 10);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(r);
    });
    return byDay;
  }

  function checkAppetiteDecline(byDay) {
    var days = Object.keys(byDay).sort().slice(-THRESHOLDS.appetiteDecline);
    if (days.length < THRESHOLDS.appetiteDecline) return false;
    var declineCount = 0;
    for (var i = 0; i < days.length; i++) {
      var day = days[i];
      var foodRecords = (byDay[day] || []).filter(function (r) {
        return r.module === 'careMedical' && r.content && r.content.text;
      });
      var hasBad = foodRecords.some(function (r) {
        var t = r.content.text;
        return t.indexOf('差') > -1 || t.indexOf('不好') > -1 || t.indexOf('没吃') > -1 || t.indexOf('没怎么') > -1;
      });
      if (hasBad) declineCount++;
    }
    return declineCount >= THRESHOLDS.appetiteDecline;
  }

  function checkMoodLow(byDay) {
    var days = Object.keys(byDay).sort().slice(-THRESHOLDS.moodLow);
    if (days.length < THRESHOLDS.moodLow) return false;
    var lowCount = 0;
    for (var i = 0; i < days.length; i++) {
      var day = days[i];
      var moodRecords = (byDay[day] || []).filter(function (r) {
        return r.module === 'emotionBehavior' && r.content && r.content.text;
      });
      var hasLow = moodRecords.some(function (r) {
        var t = r.content.text;
        return t.indexOf('低落') > -1 || t.indexOf('烦躁') > -1 || t.indexOf('哭') > -1 ||
               t.indexOf('发脾气') > -1 || t.indexOf('情绪差') > -1;
      });
      if (hasLow) lowCount++;
    }
    return lowCount >= THRESHOLDS.moodLow;
  }

  function checkMedicationRate(byDay) {
    var days = Object.keys(byDay).sort().slice(-7);
    if (days.length < 3) return false;
    var totalDays = 0;
    var missedDays = 0;
    for (var i = 0; i < days.length; i++) {
      var day = days[i];
      var medRecords = (byDay[day] || []).filter(function (r) {
        return r.module === 'careMedical' && r.content && r.content.text &&
          (r.content.text.indexOf('药') > -1 || r.content.text.indexOf('服药') > -1);
      });
      if (medRecords.length > 0) {
        totalDays++;
        var missed = medRecords.some(function (r) {
          var t = r.content.text;
          return t.indexOf('没吃') > -1 || t.indexOf('漏') > -1 || t.indexOf('忘') > -1;
        });
        if (missed) missedDays++;
      }
    }
    if (totalDays === 0) return false;
    return (totalDays - missedDays) / totalDays < THRESHOLDS.medicationRate;
  }

  function checkSleepShort(byDay) {
    var days = Object.keys(byDay).sort().slice(-THRESHOLDS.sleepShort);
    if (days.length < THRESHOLDS.sleepShort) return false;
    var shortCount = 0;
    for (var i = 0; i < days.length; i++) {
      var day = days[i];
      var sleepRecords = (byDay[day] || []).filter(function (r) {
        return r.module === 'careMedical' && r.content && r.content.text &&
          (r.content.text.indexOf('睡眠') > -1 || r.content.text.indexOf('睡觉') > -1 || r.content.text.indexOf('睡') > -1);
      });
      var hasShort = sleepRecords.some(function (r) {
        var t = r.content.text;
        return t.indexOf('没睡好') > -1 || t.indexOf('失眠') > -1 || t.indexOf('睡眠差') > -1 ||
               t.indexOf('睡得差') > -1 || t.indexOf('睡得不好') > -1;
      });
      if (hasShort) shortCount++;
    }
    return shortCount >= THRESHOLDS.sleepShort;
  }

  function buildModuleSummary(module, records) {
    if (records.length === 0) return '本周无记录';
    var texts = records.map(function (r) { return (r.content && r.content.text) || ''; }).filter(function (t) { return t; });
    if (texts.length === 0) return '本周 ' + records.length + ' 条记录';
    var samples = texts.slice(-3).join('；');
    return '共 ' + records.length + ' 条记录。' + (samples.length > 50 ? samples.substring(0, 50) + '...' : samples);
  }

  function calculateTrend(module, records, days) {
    if (records.length < 3 || days.length < 3) return '→ 数据不足';
    var mid = Math.floor(days.length / 2);
    var firstHalf = records.filter(function (r) { return (r.recordedAt || '').substring(0, 10) <= days[mid]; });
    var secondHalf = records.filter(function (r) { return (r.recordedAt || '').substring(0, 10) > days[mid]; });
    var diff = secondHalf.length - firstHalf.length;
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

  /**
   * 生成周报概览文本
   */
  function generateWeeklyOverview(report) {
    var totalDays = Object.keys(report.modules[0] ? report.modules[0] : {}).length;
    var parts = [];
    parts.push('本周共记录 ' + report.totalRecords + ' 条');
    for (var i = 0; i < report.modules.length; i++) {
      var m = report.modules[i];
      if (m.summary.indexOf('本周无记录') === -1) {
        parts.push(m.moduleName + ' ' + m.trend);
      }
    }
    return parts.join('，') + '。';
  }

  /**
   * 生成分享文本（日报）
   */
  function toDailyShareText(dailySummary, youthName) {
    var name = youthName || '心青年';
    if (!dailySummary || dailySummary.recordCount === 0) {
      return name + '今天暂无记录。';
    }
    var lines = [];
    lines.push(name + '今天整体状态：');
    lines.push(dailySummary.summary);
    if (dailySummary.alerts && dailySummary.alerts.length > 0) {
      lines.push('⚠️ 提醒：' + dailySummary.alerts.join('；'));
    } else {
      lines.push('今天没有异常情况。');
    }
    return lines.join('\n');
  }

  /**
   * 生成分享文本（周报）
   */
  function toWeeklyShareText(report, youthName) {
    var name = youthName || '心青年';
    var lines = [];
    lines.push('📊 ' + name + ' 本周回顾（' + (report.startDate || '') + ' ~ ' + (report.endDate || '') + '）');
    lines.push('共记录 ' + report.totalRecords + ' 条，覆盖 ' + report.modules.filter(function (m) { return m.summary.indexOf('本周无记录') === -1; }).length + ' 个模块。');
    lines.push('');
    for (var i = 0; i < report.modules.length; i++) {
      var m = report.modules[i];
      lines.push(m.moduleName + '：' + m.summary + ' | 趋势：' + m.trend);
      if (m.suggestion && m.suggestion !== '—') {
        lines.push('  → ' + m.suggestion);
      }
    }
    return lines.join('\n');
  }

  /**
   * 生成分享文本（月报）
   */
  function toMonthlyShareText(report, youthName) {
    var name = youthName || '心青年';
    var lines = [];
    lines.push('📅 ' + name + ' ' + (report.year || '') + '年' + (report.month || '') + '月总结');
    lines.push('共记录 ' + report.totalRecords + ' 条。');
    lines.push('');
    for (var i = 0; i < report.modules.length; i++) {
      var m = report.modules[i];
      lines.push(m.moduleName + '：' + m.summary + ' | 趋势：' + m.trend);
    }
    return lines.join('\n');
  }

  /**
   * 跨模块关联分析（用于月报）
   * 分析两个模块之间的潜在关联模式
   */
  function crossModuleLinks(records) {
    var links = [];
    var byDay = groupByDay(records || []);
    var days = Object.keys(byDay).sort();

    if (days.length < 7) return links;

    // 关联规则1：睡眠不足 → 次日情绪波动
    var sleepMoodCount = 0;
    var sleepMoodMatch = 0;
    for (var i = 1; i < days.length; i++) {
      var prevDayRecords = byDay[days[i - 1]] || [];
      var currDayRecords = byDay[days[i]] || [];

      var prevBadSleep = prevDayRecords.some(function (r) {
        return r.module === 'careMedical' && r.content && r.content.text &&
          (r.content.text.indexOf('没睡好') > -1 || r.content.text.indexOf('失眠') > -1 || r.content.text.indexOf('睡眠差') > -1);
      });
      var currBadMood = currDayRecords.some(function (r) {
        return r.module === 'emotionBehavior' && r.content && r.content.text &&
          (r.content.text.indexOf('低落') > -1 || r.content.text.indexOf('烦躁') > -1 || r.content.text.indexOf('哭') > -1 || r.content.text.indexOf('发脾气') > -1);
      });

      if (prevBadSleep) {
        sleepMoodCount++;
        if (currBadMood) sleepMoodMatch++;
      }
    }
    if (sleepMoodCount >= 2 && sleepMoodMatch / sleepMoodCount >= 0.5) {
      links.push({
        type: 'sleep_mood',
        description: '睡眠不足的日子，次日情绪波动概率增加 ' + Math.round(sleepMoodMatch / sleepMoodCount * 100) + '%',
        strength: sleepMoodMatch / sleepMoodCount >= 0.7 ? 'strong' : 'moderate'
      });
    }

    // 关联规则2：社交互动日 → 积极情绪
    var socialDays = 0;
    var socialPositiveDays = 0;
    for (var d = 0; d < days.length; d++) {
      var dayRecs = byDay[days[d]] || [];
      var hasSocial = dayRecs.some(function (r) {
        return r.content && r.content.text &&
          (r.content.text.indexOf('社交') > -1 || r.content.text.indexOf('互动') > -1 || r.content.text.indexOf('朋友') > -1);
      });
      var hasPositive = dayRecs.some(function (r) {
        return r.module === 'emotionBehavior' && r.content && r.content.text &&
          (r.content.text.indexOf('开心') > -1 || r.content.text.indexOf('平稳') > -1 || r.content.text.indexOf('情绪好') > -1 || r.content.text.indexOf('很好') > -1);
      });
      if (hasSocial) {
        socialDays++;
        if (hasPositive) socialPositiveDays++;
      }
    }
    if (socialDays >= 2 && socialPositiveDays / socialDays >= 0.5) {
      links.push({
        type: 'social_mood',
        description: '有社交互动的日子，积极情绪出现概率更高（' + Math.round(socialPositiveDays / socialDays * 100) + '%）',
        strength: socialPositiveDays / socialDays >= 0.7 ? 'strong' : 'moderate'
      });
    }

    // 关联规则3：活动日 → 食欲和睡眠更好
    var activityDays = 0;
    var activityGoodDays = 0;
    for (var ad = 0; ad < days.length; ad++) {
      var aRecs = byDay[days[ad]] || [];
      var hasActivity = aRecs.some(function (r) {
        return r.module === 'workSupport' && r.content && r.content.text &&
          (r.content.text.indexOf('活动') > -1 || r.content.text.indexOf('完成') > -1 || r.content.text.indexOf('参与') > -1);
      });
      var hasGoodRoutine = aRecs.some(function (r) {
        return r.module === 'careMedical' && r.content && r.content.text &&
          (r.content.text.indexOf('好') > -1 || r.content.text.indexOf('正常') > -1 || r.content.text.indexOf('不错') > -1) &&
          !(r.content.text.indexOf('不好') > -1 || r.content.text.indexOf('差') > -1);
      });
      if (hasActivity) {
        activityDays++;
        if (hasGoodRoutine) activityGoodDays++;
      }
    }
    if (activityDays >= 2 && activityGoodDays / activityDays >= 0.5) {
      links.push({
        type: 'activity_routine',
        description: '有活动的日子，食欲和睡眠质量更好',
        strength: activityGoodDays / activityDays >= 0.7 ? 'strong' : 'moderate'
      });
    }

    return links;
  }

  /**
   * 生成日记分享文本（简洁版）
   */
  function toDiaryText(dailySummary, youthName) {
    var name = youthName || '心青年';
    if (!dailySummary || dailySummary.recordCount === 0) {
      return name + '今天暂无记录。';
    }
    return name + '今天整体状态不错。' + dailySummary.summary + (dailySummary.alerts && dailySummary.alerts.length > 0 ? ' ⚠️' + dailySummary.alerts.join('；') : ' 今天没有异常情况。');
  }

  // ========== 暴露全局接口（向后兼容） ==========
  window.ChatbotAnalysis = {
    generateDailySummary: generateDailySummary,
    generateWeeklyReport: generateWeeklyReport,
    generateMonthlyReport: generateMonthlyReport,
    detectAnomalies: detectAnomalies,
    generateWeeklyOverview: generateWeeklyOverview,
    crossModuleLinks: crossModuleLinks,
    toDailyShareText: toDailyShareText,
    toWeeklyShareText: toWeeklyShareText,
    toMonthlyShareText: toMonthlyShareText,
    toDiaryText: toDiaryText,
    groupByDay: groupByDay,
    THRESHOLDS: THRESHOLDS
  };

  // ========== 注册为 AnalysisProvider 提供者 ==========
  if (window.ChatbotProviders) {
    window.ChatbotProviders.register('keyword-analysis', {
      generateDailySummary: generateDailySummary,
      generateWeeklyReport: generateWeeklyReport,
      generateMonthlyReport: generateMonthlyReport,
      detectAnomalies: detectAnomalies,
      generateWeeklyOverview: generateWeeklyOverview,
      crossModuleLinks: crossModuleLinks,
      toDailyShareText: toDailyShareText,
      toWeeklyShareText: toWeeklyShareText,
      toMonthlyShareText: toMonthlyShareText,
      toDiaryText: toDiaryText
    });
    window.ChatbotProviders.switchProvider('analysisProvider', 'keyword-analysis');
  }
})();