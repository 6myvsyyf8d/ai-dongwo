/**
 * analytics-engine.js - 数据价值呈现计算引擎
 * 纯计算层，无 DOM 操作，方便后续接入后端 API
 * 依赖：storage.js（读取记录）、chatbot-analysis.js（异常检测阈值）
 */
window.AnalyticsEngine = (function () {
  'use strict';

  // 异常阈值（复用 chatbot-analysis.js 的 THRESHOLDS）
  var THRESHOLDS = {
    appetiteDecline: 3,
    moodLow: 2,
    sleepShort: 2,
    recordGap: 24
  };

  // 情绪关键词
  var POSITIVE_KEYWORDS = ['开心', '高兴', '愉快', '不错', '好', '平稳', '稳定', '平静', '安静', '顺利', '喜欢', '爱'];
  var NEGATIVE_KEYWORDS = ['低落', '烦躁', '哭', '发脾气', '焦虑', '害怕', '生气', '难过', '崩溃', '不好', '差', '拒绝'];

  /**
   * 日报：读取当日所有记录，按模块分组，生成摘要和异常提醒
   */
  function dailySummary(youthId, date) {
    date = date || Utils.formatDate(new Date());
    var allRecords = Storage.getRecords(youthId);
    var todayRecords = allRecords.filter(function (r) {
      return (r.recordedAt || '').indexOf(date) === 0;
    });

    var moduleCounts = {};
    var moduleDetails = {};
    var modules = Modules.MODULES;

    for (var i = 0; i < modules.length; i++) {
      moduleCounts[modules[i].key] = 0;
      moduleDetails[modules[i].key] = [];
    }

    for (var i = 0; i < todayRecords.length; i++) {
      var r = todayRecords[i];
      var mod = r.module;
      if (!moduleCounts[mod]) moduleCounts[mod] = 0;
      moduleCounts[mod]++;
      if (r.content && r.content.text) {
        moduleDetails[mod].push(r.content.text);
      }
    }

    // 各模块状态
    var moduleStatuses = {};
    for (var i = 0; i < modules.length; i++) {
      var key = modules[i].key;
      var count = moduleCounts[key] || 0;
      if (count > 0) {
        var hasNegative = _hasNegativeContent(moduleDetails[key] || []);
        moduleStatuses[key] = {
          count: count,
          hasRecords: true,
          hasNegative: hasNegative,
          status: hasNegative ? 'warning' : 'normal',
          samples: (moduleDetails[key] || []).slice(0, 2)
        };
      } else {
        moduleStatuses[key] = {
          count: 0,
          hasRecords: false,
          hasNegative: false,
          status: 'empty',
          samples: []
        };
      }
    }

    // 异常检测
    var alerts = detectAnomalies(youthId);

    // 最近记录时间
    var lastRecordTime = '';
    if (allRecords.length > 0) {
      lastRecordTime = _relativeTimeText(allRecords[0].recordedAt);
    }

    // 生成日记摘要文本
    var shareText = _generateDailyShareText(moduleStatuses, alerts, date);

    return {
      date: date,
      recordCount: todayRecords.length,
      moduleCounts: moduleCounts,
      moduleDetails: moduleDetails,
      moduleStatuses: moduleStatuses,
      alerts: alerts,
      lastRecordTime: lastRecordTime,
      shareText: shareText
    };
  }

  /**
   * 周报：7 天趋势 + 情绪变化 + 照护统计 + 各模块趋势
   */
  function weeklyReport(youthId, weekStart, weekEnd) {
    var allRecords = Storage.getRecords(youthId);
    var weekRecords = allRecords.filter(function (r) {
      var d = (r.recordedAt || '').substring(0, 10);
      return d >= weekStart && d <= weekEnd;
    });

    // 按天分组
    var byDay = {};
    for (var i = 0; i < weekRecords.length; i++) {
      var day = (weekRecords[i].recordedAt || '').substring(0, 10);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(weekRecords[i]);
    }

    var dayKeys = _getDateRange(weekStart, weekEnd);
    var recordDays = Object.keys(byDay).length;

    // 情绪趋势：每日情绪评分（基于记录内容关键词）
    var emotionTrend = [];
    for (var i = 0; i < dayKeys.length; i++) {
      var dayRecords = byDay[dayKeys[i]] || [];
      emotionTrend.push({
        date: dayKeys[i].substring(5),
        score: _calcEmotionScore(dayRecords),
        count: dayRecords.filter(function (r) { return r.module === 'emotionBehavior'; }).length
      });
    }

    // 照护统计
    var careStats = _calcCareStats(byDay, dayKeys);

    // 各模块趋势
    var moduleTrends = _calcModuleTrends(weekRecords, dayKeys);

    // 周报概览
    var overview = '本周共记录 ' + weekRecords.length + ' 条，日均 ' + Math.round(weekRecords.length / 7) + ' 条，覆盖 ' +
      Object.keys(_countByModule(weekRecords)).length + ' 个模块。记录天数：' + recordDays + '/7 天' +
      (recordDays < 7 ? ' ⚠️（' + (7 - recordDays) + ' 天断档）' : ' ✅（无断档）');

    // 情绪趋势总结
    var emotionSummary = _summarizeEmotionTrend(emotionTrend);

    // 提醒
    var alerts = [];
    if (recordDays < 7) alerts.push('本周有 ' + (7 - recordDays) + ' 天没有记录，建议保持每日记录习惯');
    var lowModules = _findLowModules(moduleTrends);
    if (lowModules.length > 0) {
      alerts.push('以下模块本周记录偏少：' + lowModules.map(function (m) { return m.label; }).join('、'));
    }

    // 分享文本
    var shareText = _generateWeeklyShareText(overview, emotionSummary, careStats, moduleTrends, alerts);

    return {
      weekStart: weekStart,
      weekEnd: weekEnd,
      totalRecords: weekRecords.length,
      recordDays: recordDays,
      overview: overview,
      emotionTrend: emotionTrend,
      emotionSummary: emotionSummary,
      careStats: careStats,
      moduleTrends: moduleTrends,
      alerts: alerts,
      shareText: shareText
    };
  }

  /**
   * 月报：30 天趋势 + 跨模块关联 + 月度总结
   */
  function monthlyReport(youthId, monthStart, monthEnd) {
    var allRecords = Storage.getRecords(youthId);
    var monthRecords = allRecords.filter(function (r) {
      var d = (r.recordedAt || '').substring(0, 10);
      return d >= monthStart && d <= monthEnd;
    });

    var byDay = {};
    for (var i = 0; i < monthRecords.length; i++) {
      var day = (monthRecords[i].recordedAt || '').substring(0, 10);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(monthRecords[i]);
    }

    var dayKeys = _getDateRange(monthStart, monthEnd);
    var totalDays = dayKeys.length;
    var recordDays = Object.keys(byDay).length;

    // 30 天情绪趋势
    var emotionTrend = [];
    for (var i = 0; i < dayKeys.length; i++) {
      var dayRecords = byDay[dayKeys[i]] || [];
      emotionTrend.push({
        date: dayKeys[i].substring(5),
        score: _calcEmotionScore(dayRecords),
        count: dayRecords.filter(function (r) { return r.module === 'emotionBehavior'; }).length
      });
    }

    // 跨模块关联
    var crossLinks = _findCrossModuleLinks(byDay, dayKeys);

    // 月度概览
    var overview = '本月共记录 ' + monthRecords.length + ' 条，日均 ' +
      (monthRecords.length / totalDays).toFixed(1) + ' 条，覆盖 ' +
      Object.keys(_countByModule(monthRecords)).length + ' 个模块。记录天数：' + recordDays + '/' + totalDays + ' 天' +
      (recordDays < totalDays ? ' ⚠️（' + (totalDays - recordDays) + ' 天断档）' : ' ✅（无断档）');

    // 情绪趋势总结
    var emotionSummary = _summarizeEmotionTrendMonthly(emotionTrend);

    // 月度总结
    var shareText = _generateMonthlyShareText(overview, emotionSummary, crossLinks, monthRecords);

    return {
      monthStart: monthStart,
      monthEnd: monthEnd,
      totalRecords: monthRecords.length,
      recordDays: recordDays,
      totalDays: totalDays,
      overview: overview,
      emotionTrend: emotionTrend,
      emotionSummary: emotionSummary,
      crossModuleLinks: crossLinks,
      shareText: shareText
    };
  }

  /**
   * 异常检测
   */
  function detectAnomalies(youthId) {
    var allRecords = Storage.getRecords(youthId);
    var alerts = [];

    // 按天分组
    var byDay = {};
    for (var i = 0; i < allRecords.length; i++) {
      var day = (allRecords[i].recordedAt || '').substring(0, 10);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(allRecords[i]);
    }

    var sortedDays = Object.keys(byDay).sort();

    // 食欲下降检测
    if (_checkConsecutiveDays(byDay, sortedDays, THRESHOLDS.appetiteDecline, _hasAppetiteIssue)) {
      alerts.push({ type: 'appetite', text: '连续 ' + THRESHOLDS.appetiteDecline + ' 天食欲下降', module: 'careMedical' });
    }

    // 情绪低谷检测
    if (_checkConsecutiveDays(byDay, sortedDays, THRESHOLDS.moodLow, _hasMoodIssue)) {
      alerts.push({ type: 'mood', text: '连续 ' + THRESHOLDS.moodLow + ' 天出现情绪低谷', module: 'emotionBehavior' });
    }

    // 睡眠不足检测
    if (_checkConsecutiveDays(byDay, sortedDays, THRESHOLDS.sleepShort, _hasSleepIssue)) {
      alerts.push({ type: 'sleep', text: '连续 ' + THRESHOLDS.sleepShort + ' 天睡眠不足', module: 'careMedical' });
    }

    // 记录断档检测
    if (allRecords.length > 0) {
      var lastRecord = allRecords[0];
      var hoursSince = (Date.now() - new Date(lastRecord.recordedAt).getTime()) / 3600000;
      if (hoursSince > THRESHOLDS.recordGap) {
        alerts.push({ type: 'gap', text: '超过 ' + THRESHOLDS.recordGap + ' 小时无记录', module: 'global' });
      }
    }

    return alerts;
  }

  // ========== 辅助函数 ==========

  function _hasNegativeContent(texts) {
    for (var i = 0; i < texts.length; i++) {
      for (var j = 0; j < NEGATIVE_KEYWORDS.length; j++) {
        if (texts[i].indexOf(NEGATIVE_KEYWORDS[j]) > -1) return true;
      }
    }
    return false;
  }

  function _calcEmotionScore(records) {
    var score = 0;
    var hasData = false;
    for (var i = 0; i < records.length; i++) {
      var text = (records[i].content && records[i].content.text) || '';
      for (var j = 0; j < POSITIVE_KEYWORDS.length; j++) {
        if (text.indexOf(POSITIVE_KEYWORDS[j]) > -1) { score += 1; hasData = true; break; }
      }
      for (var j = 0; j < NEGATIVE_KEYWORDS.length; j++) {
        if (text.indexOf(NEGATIVE_KEYWORDS[j]) > -1) { score -= 1; hasData = true; break; }
      }
    }
    return hasData ? score : null;
  }

  function _calcCareStats(byDay, dayKeys) {
    var dietNormal = 0;
    var sleepGood = 0;
    var medOnTime = 0;
    var totalDays = dayKeys.length;

    for (var i = 0; i < dayKeys.length; i++) {
      var dayRecords = byDay[dayKeys[i]] || [];
      var careRecords = dayRecords.filter(function (r) { return r.module === 'careMedical'; });

      var hasDietIssue = careRecords.some(function (r) {
        var t = (r.content && r.content.text) || '';
        return t.indexOf('食欲差') > -1 || t.indexOf('不吃饭') > -1 || t.indexOf('胃口差') > -1 || t.indexOf('没吃') > -1;
      });
      var hasDietRecord = careRecords.some(function (r) {
        var t = (r.content && r.content.text) || '';
        return t.indexOf('吃') > -1 || t.indexOf('餐') > -1 || t.indexOf('饭') > -1 || t.indexOf('胃口') > -1;
      });

      if (hasDietRecord && !hasDietIssue) dietNormal++;

      var hasSleepIssue = careRecords.some(function (r) {
        var t = (r.content && r.content.text) || '';
        return t.indexOf('没睡好') > -1 || t.indexOf('失眠') > -1 || t.indexOf('睡眠差') > -1;
      });
      var hasSleepRecord = careRecords.some(function (r) {
        var t = (r.content && r.content.text) || '';
        return t.indexOf('睡') > -1;
      });
      if (hasSleepRecord && !hasSleepIssue) sleepGood++;

      var hasMedIssue = careRecords.some(function (r) {
        var t = (r.content && r.content.text) || '';
        return (t.indexOf('没吃') > -1 || t.indexOf('漏') > -1 || t.indexOf('忘') > -1) &&
               (t.indexOf('药') > -1);
      });
      var hasMedRecord = careRecords.some(function (r) {
        var t = (r.content && r.content.text) || '';
        return t.indexOf('药') > -1;
      });
      if (hasMedRecord && !hasMedIssue) medOnTime++;
    }

    return {
      dietNormal: dietNormal,
      sleepGood: sleepGood,
      medOnTime: medOnTime,
      totalDays: totalDays
    };
  }

  function _calcModuleTrends(records, dayKeys) {
    var modules = Modules.MODULES;
    var half = Math.floor(dayKeys.length / 2);
    var firstHalfDays = dayKeys.slice(0, half);
    var secondHalfDays = dayKeys.slice(half);

    return modules.map(function (m) {
      var modRecords = records.filter(function (r) { return r.module === m.key; });
      var firstHalf = modRecords.filter(function (r) {
        return firstHalfDays.indexOf((r.recordedAt || '').substring(0, 10)) > -1;
      }).length;
      var secondHalf = modRecords.filter(function (r) {
        return secondHalfDays.indexOf((r.recordedAt || '').substring(0, 10)) > -1;
      }).length;

      var trend;
      if (modRecords.length === 0) trend = 'empty';
      else if (secondHalf > firstHalf + 1) trend = 'up';
      else if (secondHalf < firstHalf - 1) trend = 'down';
      else trend = 'stable';

      return {
        key: m.key,
        label: m.label,
        icon: m.icon,
        total: modRecords.length,
        trend: trend
      };
    });
  }

  function _countByModule(records) {
    var counts = {};
    for (var i = 0; i < records.length; i++) {
      var mod = records[i].module;
      counts[mod] = (counts[mod] || 0) + 1;
    }
    return counts;
  }

  function _summarizeEmotionTrend(trend) {
    var scores = trend.filter(function (t) { return t.score !== null; }).map(function (t) { return t.score; });
    if (scores.length === 0) return '本周暂无情绪数据';
    var avg = scores.reduce(function (a, b) { return a + b; }, 0) / scores.length;
    if (avg > 0.5) return '本周情绪整体积极，表现良好';
    if (avg < -0.5) return '本周情绪偏低，建议关注情绪触发因素';
    return '本周情绪整体平稳';
  }

  function _summarizeEmotionTrendMonthly(trend) {
    var scores = trend.filter(function (t) { return t.score !== null; }).map(function (t) { return t.score; });
    if (scores.length === 0) return '本月暂无情绪数据';

    var half = Math.floor(scores.length / 2);
    var firstHalf = scores.slice(0, half);
    var secondHalf = scores.slice(half);
    var firstAvg = firstHalf.reduce(function (a, b) { return a + b; }, 0) / firstHalf.length;
    var secondAvg = secondHalf.reduce(function (a, b) { return a + b; }, 0) / secondHalf.length;

    var trendText = '';
    if (secondAvg > firstAvg + 0.3) trendText = '下旬比上旬更好';
    else if (secondAvg < firstAvg - 0.3) trendText = '下旬比上旬有所回落';
    else trendText = '整体平稳';

    var overall = scores.reduce(function (a, b) { return a + b; }, 0) / scores.length;
    if (overall > 0.5) return '本月情绪总体积极，' + trendText;
    if (overall < -0.5) return '本月情绪偏低，' + trendText + '，建议关注';
    return '本月情绪总体平稳，' + trendText;
  }

  function _findLowModules(moduleTrends) {
    return moduleTrends.filter(function (m) {
      return m.trend === 'down' || (m.trend === 'stable' && m.total <= 1);
    });
  }

  function _findCrossModuleLinks(byDay, dayKeys) {
    var links = [];

    // 睡眠不足 → 次日情绪波动
    var sleepMoodCount = 0;
    var sleepMoodMatch = 0;
    for (var i = 1; i < dayKeys.length; i++) {
      var prevDay = dayKeys[i - 1];
      var currDay = dayKeys[i];
      var prevRecords = byDay[prevDay] || [];
      var currRecords = byDay[currDay] || [];

      var prevSleepIssue = _hasSleepIssue(prevRecords);
      var currMoodLow = _hasMoodIssue(currRecords);

      if (prevSleepIssue) {
        sleepMoodCount++;
        if (currMoodLow) sleepMoodMatch++;
      }
    }
    if (sleepMoodCount >= 3) {
      links.push('睡眠不足的日子，次日情绪波动概率增加 ' + Math.round(sleepMoodMatch / sleepMoodCount * 100) + '%');
    }

    // 社交互动 → 积极情绪
    var socialPosCount = 0;
    var socialPosMatch = 0;
    for (var i = 0; i < dayKeys.length; i++) {
      var dayRecords = byDay[dayKeys[i]] || [];
      var hasSocial = dayRecords.some(function (r) { return r.module === 'relationshipMap'; });
      var hasPositive = _hasPositiveContent(dayRecords);
      if (hasSocial) {
        socialPosCount++;
        if (hasPositive) socialPosMatch++;
      }
    }
    if (socialPosCount >= 3) {
      links.push('有社交互动的日子，积极情绪出现概率高 ' + Math.round(socialPosMatch / socialPosCount * 100) + '%');
    }

    return links;
  }

  function _checkConsecutiveDays(byDay, sortedDays, threshold, checkFn) {
    if (sortedDays.length < threshold) return false;
    var lastDays = sortedDays.slice(-threshold);
    for (var i = 0; i < lastDays.length; i++) {
      if (!checkFn(byDay[lastDays[i]] || [])) return false;
    }
    return true;
  }

  function _hasAppetiteIssue(records) {
    return records.some(function (r) {
      var t = (r.content && r.content.text) || '';
      return t.indexOf('食欲差') > -1 || t.indexOf('不吃饭') > -1 || t.indexOf('胃口差') > -1 ||
             t.indexOf('没吃') > -1 || t.indexOf('没怎么吃') > -1;
    });
  }

  function _hasMoodIssue(records) {
    return records.some(function (r) {
      var t = (r.content && r.content.text) || '';
      return t.indexOf('低落') > -1 || t.indexOf('烦躁') > -1 || t.indexOf('哭') > -1 ||
             t.indexOf('发脾气') > -1 || t.indexOf('情绪差') > -1 || t.indexOf('难过') > -1;
    });
  }

  function _hasSleepIssue(records) {
    return records.some(function (r) {
      var t = (r.content && r.content.text) || '';
      return t.indexOf('没睡好') > -1 || t.indexOf('失眠') > -1 || t.indexOf('睡眠差') > -1 ||
             t.indexOf('睡得差') > -1 || t.indexOf('睡得不好') > -1;
    });
  }

  function _hasPositiveContent(records) {
    return records.some(function (r) {
      var t = (r.content && r.content.text) || '';
      for (var i = 0; i < POSITIVE_KEYWORDS.length; i++) {
        if (t.indexOf(POSITIVE_KEYWORDS[i]) > -1) return true;
      }
      return false;
    });
  }

  function _getDateRange(start, end) {
    var dates = [];
    var current = new Date(start + 'T00:00:00');
    var endDate = new Date(end + 'T00:00:00');
    while (current <= endDate) {
      dates.push(Utils.formatDate(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  function _relativeTimeText(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    var now = new Date();
    var diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    return Math.floor(diff / 86400000) + ' 天前';
  }

  // ========== 分享文本生成 ==========

  function _generateDailyShareText(moduleStatuses, alerts, date) {
    var parts = [];
    var modules = Modules.MODULES;
    var hasContent = false;

    for (var i = 0; i < modules.length; i++) {
      var key = modules[i].key;
      var status = moduleStatuses[key];
      if (status && status.hasRecords) {
        hasContent = true;
        var samples = status.samples.join('、');
        parts.push(modules[i].label + '：' + (samples || '有记录'));
      }
    }

    if (!hasContent) return date + ' 暂无记录。';

    var text = date + ' 记录概览：\n' + parts.join('\n');
    if (alerts.length > 0) {
      text += '\n⚠️ 提醒：' + alerts.map(function (a) { return a.text; }).join('；');
    } else {
      text += '\n✅ 今日无异常。';
    }
    return text;
  }

  function _generateWeeklyShareText(overview, emotionSummary, careStats, moduleTrends, alerts) {
    var text = overview + '\n';
    text += '情绪：' + emotionSummary + '\n';
    text += '照护：饮食正常 ' + careStats.dietNormal + '/' + careStats.totalDays + ' 天，' +
      '睡眠充足 ' + careStats.sleepGood + '/' + careStats.totalDays + ' 天，' +
      '用药准时 ' + careStats.medOnTime + '/' + careStats.totalDays + ' 天\n';

    var trendTexts = moduleTrends.map(function (m) {
      var arrow = m.trend === 'up' ? '↑' : m.trend === 'down' ? '↓' : m.trend === 'empty' ? '—' : '→';
      return m.icon + ' ' + m.label + ' ' + arrow + ' (' + m.total + ' 条)';
    });
    text += '模块趋势：' + trendTexts.join(' | ') + '\n';

    if (alerts.length > 0) {
      text += '⚠️ ' + alerts.join('；');
    }
    return text;
  }

  function _generateMonthlyShareText(overview, emotionSummary, crossLinks, records) {
    var text = overview + '\n\n';
    text += '情绪趋势：' + emotionSummary + '\n\n';

    if (crossLinks.length > 0) {
      text += '跨模块关联发现：\n';
      for (var i = 0; i < crossLinks.length; i++) {
        text += '  • ' + crossLinks[i] + '\n';
      }
      text += '\n';
    }

    text += '月度总结：\n' + _generateNarrativeSummary(records, emotionSummary, crossLinks);
    return text;
  }

  function _generateNarrativeSummary(records, emotionSummary, crossLinks) {
    var parts = [];
    parts.push(emotionSummary + '。');

    var moduleCounts = _countByModule(records);
    var modules = Modules.MODULES;
    for (var i = 0; i < modules.length; i++) {
      var count = moduleCounts[modules[i].key] || 0;
      if (count > 0) {
        parts.push(modules[i].label + '共 ' + count + ' 条记录');
      }
    }

    if (crossLinks.length > 0) {
      parts.push(crossLinks.join('；'));
    }

    return parts.join('。');
  }

  // ========== 暴露全局接口 ==========
  return {
    dailySummary: dailySummary,
    weeklyReport: weeklyReport,
    monthlyReport: monthlyReport,
    detectAnomalies: detectAnomalies,
    THRESHOLDS: THRESHOLDS
  };
})();