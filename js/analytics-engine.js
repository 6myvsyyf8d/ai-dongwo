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

  // 标签权重（优先使用 tags 字段评分，更精确）
  var TAG_WEIGHTS = {
    // 情绪行为模块
    '愉悦': 2, '兴奋': 1.5, '平静': 1, '配合': 1,
    '低落': -2, '焦虑': -1.5, '易怒': -2, '抗拒': -1,
    // 沟通与表达模块
    '主动表达': 1.5, '清晰': 1, '辅助沟通': 0.5,
    '被动回应': 0, '模糊': -0.5, '肢体语言': 0,
    // 照护医疗模块
    '按时服药': 1, '睡眠良好': 1, '食欲正常': 1,
    '拒绝服药': -2, '睡眠不佳': -1.5, '身体不适': -2,
    // 工作支持模块
    '独立完成': 2, '完成质量高': 1.5, '专注': 1, '速度正常': 1,
    '需要协助': -0.5, '分心': -1, '需要提示': 0
  };

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

    // 今日用药状态
    var medicationStatus = _getDailyMedicationStatus(youthId, date);

    // 今日亮点（正向引导）
    var highlights = _getDailyHighlights(todayRecords);

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
      shareText: shareText,
      medicationStatus: medicationStatus,
      highlights: highlights
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

    // 情绪数据新鲜度信息
    var emotionDataInfo = _calcEmotionDataInfo(emotionTrend, dayKeys, weekRecords);

    // 照护统计
    var careStats = _calcCareStats(byDay, dayKeys);

    // 各模块趋势
    var moduleTrends = _calcModuleTrends(weekRecords, dayKeys);

    // 周报概览
    var middleGaps = _detectMiddleGaps(byDay, dayKeys, 2);
    var gapText = '';
    if (middleGaps.length > 0) {
      gapText = ' ⚠️（存在中间断档：' + middleGaps.map(function (g) {
        return g.start.substring(5) + '~' + g.end.substring(5) + ' 连续 ' + g.length + ' 天';
      }).join('；') + '）';
    } else if (recordDays < 7) {
      gapText = ' ⚠️（' + (7 - recordDays) + ' 天断档）';
    } else {
      gapText = ' ✅（无断档）';
    }
    var overview = '本周共记录 ' + weekRecords.length + ' 条，日均 ' + Math.round(weekRecords.length / 7) + ' 条，覆盖 ' +
      Object.keys(_countByModule(weekRecords)).length + ' 个模块。记录天数：' + recordDays + '/7 天' + gapText;

    // 情绪趋势总结
    var emotionSummary = _summarizeEmotionTrend(emotionTrend);

    // 提醒
    var alerts = [];
    if (recordDays < 7) alerts.push('本周有 ' + (7 - recordDays) + ' 天没有记录，建议保持每日记录习惯');
    if (middleGaps.length > 0) {
      for (var gi = 0; gi < middleGaps.length; gi++) {
        alerts.push('⚠️ ' + middleGaps[gi].start.substring(5) + ' 至 ' + middleGaps[gi].end.substring(5) +
          ' 连续 ' + middleGaps[gi].length + ' 天无记录，存在中间断档');
      }
    }
    var lowModules = _findLowModules(moduleTrends);
    if (lowModules.length > 0) {
      alerts.push('以下模块本周记录偏少：' + lowModules.map(function (m) { return m.label; }).join('、'));
    }

    // 分享文本
    var shareText = _generateWeeklyShareText(overview, emotionSummary, careStats, moduleTrends, alerts);

    // 环比对比（vs 上周）
    var comparison = _calcWeekComparison(youthId, weekStart, weekEnd);

    return {
      weekStart: weekStart,
      weekEnd: weekEnd,
      totalRecords: weekRecords.length,
      recordDays: recordDays,
      overview: overview,
      emotionTrend: emotionTrend,
      emotionSummary: emotionSummary,
      emotionDataInfo: emotionDataInfo,
      careStats: careStats,
      moduleTrends: moduleTrends,
      alerts: alerts,
      shareText: shareText,
      comparison: comparison
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

    // 情绪数据新鲜度信息
    var emotionDataInfo = _calcEmotionDataInfo(emotionTrend, dayKeys, monthRecords);

    // 跨模块关联
    var crossLinks = _findCrossModuleLinks(byDay, dayKeys);

    // 照护统计
    var careStats = _calcCareStats(byDay, dayKeys);

    // 月度概览
    var middleGaps = _detectMiddleGaps(byDay, dayKeys, 3);
    var monthGapText = '';
    if (middleGaps.length > 0) {
      monthGapText = ' ⚠️（存在中间断档：最长 ' + Math.max.apply(null, middleGaps.map(function (g) { return g.length; })) + ' 天）';
    } else if (recordDays < totalDays) {
      monthGapText = ' ⚠️（' + (totalDays - recordDays) + ' 天断档）';
    } else {
      monthGapText = ' ✅（无断档）';
    }
    var overview = '本月共记录 ' + monthRecords.length + ' 条，日均 ' +
      (monthRecords.length / totalDays).toFixed(1) + ' 条，覆盖 ' +
      Object.keys(_countByModule(monthRecords)).length + ' 个模块。记录天数：' + recordDays + '/' + totalDays + ' 天' + monthGapText;

    // 情绪趋势总结
    var emotionSummary = _summarizeEmotionTrendMonthly(emotionTrend);

    // 月度总结
    var shareText = _generateMonthlyShareText(overview, emotionSummary, crossLinks, monthRecords);

    // 环比对比（vs 上月）
    var comparison = _calcMonthComparison(youthId, monthStart, monthEnd);

    // 同比对比（vs 去年同月）
    var yearComparison = _calcYearComparison(youthId, monthStart, monthEnd);

    return {
      monthStart: monthStart,
      monthEnd: monthEnd,
      totalRecords: monthRecords.length,
      recordDays: recordDays,
      totalDays: totalDays,
      overview: overview,
      emotionTrend: emotionTrend,
      emotionSummary: emotionSummary,
      emotionDataInfo: emotionDataInfo,
      crossModuleLinks: crossLinks,
      careStats: careStats,
      shareText: shareText,
      comparison: comparison,
      yearComparison: yearComparison
    };
  }

  /**
   * 异常检测（增强版）
   * 包含：静态阈值检测 + 趋势变化检测 + 基线对比 + 周模式识别
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

    // === 1. 静态阈值检测 ===
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

    // === 2. 趋势变化检测：最近3天 vs 前4天 ===
    var trendAlerts = _detectTrendChanges(byDay, sortedDays);
    for (var t = 0; t < trendAlerts.length; t++) {
      alerts.push(trendAlerts[t]);
    }

    // === 3. 基线对比：最近7天 vs 历史基线（最近30天，排除最近7天） ===
    var baselineAlerts = _detectBaselineDeviation(byDay, sortedDays);
    for (var b = 0; b < baselineAlerts.length; b++) {
      alerts.push(baselineAlerts[b]);
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
      var tags = (records[i].content && records[i].content.tags) || [];
      var text = (records[i].content && records[i].content.text) || '';

      // 优先使用标签权重评分
      if (tags.length > 0) {
        for (var j = 0; j < tags.length; j++) {
          var w = TAG_WEIGHTS[tags[j]];
          if (w !== undefined) {
            score += w;
            hasData = true;
          }
        }
      } else {
        // 无标签时 fallback 到文本关键词匹配
        for (var k = 0; k < POSITIVE_KEYWORDS.length; k++) {
          if (text.indexOf(POSITIVE_KEYWORDS[k]) > -1) { score += 1; hasData = true; break; }
        }
        for (var k = 0; k < NEGATIVE_KEYWORDS.length; k++) {
          if (text.indexOf(NEGATIVE_KEYWORDS[k]) > -1) { score -= 1; hasData = true; break; }
        }
      }
    }
    return hasData ? score : null;
  }

  /**
   * 计算情绪数据新鲜度信息
   * 返回有效数据天数、总天数、最近一条情绪记录距今天数
   */
  function _calcEmotionDataInfo(emotionTrend, dayKeys, records) {
    var validDays = 0;
    for (var i = 0; i < emotionTrend.length; i++) {
      if (emotionTrend[i].score !== null) validDays++;
    }

    var lastDate = '';
    for (var j = 0; j < records.length; j++) {
      if (records[j].module !== 'emotionBehavior') continue;
      var d = (records[j].recordedAt || '').substring(0, 10);
      if (d > lastDate) lastDate = d;
    }

    var daysAgo = null;
    if (lastDate) {
      var today = Utils.formatDate(new Date());
      var diffMs = new Date(today + 'T00:00:00').getTime() - new Date(lastDate + 'T00:00:00').getTime();
      daysAgo = Math.round(diffMs / 86400000);
    }

    return {
      validDays: validDays,
      totalDays: dayKeys.length,
      lastDate: lastDate,
      daysAgo: daysAgo
    };
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
      var hasPositive = _hasPositiveContent(dayRecords);
      if (hasPositive) socialPosMatch++;
    }
    if (socialPosCount >= 3) {
      links.push('有社交互动的日子，积极情绪出现概率高 ' + Math.round(socialPosMatch / socialPosCount * 100) + '%');
    }

    return links;
  }

  /**
   * 周环比对比：计算上周数据并与本周对比
   */
  function _calcWeekComparison(youthId, weekStart, weekEnd) {
    var prevWeekStart = _addDaysToStr(weekStart, -7);
    var prevWeekEnd = _addDaysToStr(weekEnd, -7);
    var allRecords = Storage.getRecords(youthId);

    var thisWeekRecords = allRecords.filter(function (r) {
      var d = (r.recordedAt || '').substring(0, 10);
      return d >= weekStart && d <= weekEnd;
    });
    var prevWeekRecords = allRecords.filter(function (r) {
      var d = (r.recordedAt || '').substring(0, 10);
      return d >= prevWeekStart && d <= prevWeekEnd;
    });

    var thisEmotion = _avgEmotion(thisWeekRecords);
    var prevEmotion = _avgEmotion(prevWeekRecords);

    var thisDays = _countDays(thisWeekRecords);
    var prevDays = _countDays(prevWeekRecords);

    return {
      prevWeekStart: prevWeekStart,
      prevWeekEnd: prevWeekEnd,
      recordCount: { current: thisWeekRecords.length, previous: prevWeekRecords.length },
      emotionAvg: { current: thisEmotion, previous: prevEmotion },
      recordDays: { current: thisDays, previous: prevDays }
    };
  }

  /**
   * 月环比对比
   */
  function _calcMonthComparison(youthId, monthStart, monthEnd) {
    var parts = monthStart.split('-');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (m === 1) { y--; m = 12; } else { m--; }
    var prevMonthStart = y + '-' + String(m).padStart(2, '0') + '-01';
    var prevLastDay = new Date(y, m, 0).getDate();
    var prevMonthEnd = prevMonthStart.substring(0, 7) + '-' + String(prevLastDay).padStart(2, '0');

    var allRecords = Storage.getRecords(youthId);

    var thisMonthRecords = allRecords.filter(function (r) {
      var d = (r.recordedAt || '').substring(0, 10);
      return d >= monthStart && d <= monthEnd;
    });
    var prevMonthRecords = allRecords.filter(function (r) {
      var d = (r.recordedAt || '').substring(0, 10);
      return d >= prevMonthStart && d <= prevMonthEnd;
    });

    var thisEmotion = _avgEmotion(thisMonthRecords);
    var prevEmotion = _avgEmotion(prevMonthRecords);

    var thisDays = _countDays(thisMonthRecords);
    var prevDays = _countDays(prevMonthRecords);

    return {
      prevMonthStart: prevMonthStart,
      prevMonthEnd: prevMonthEnd,
      recordCount: { current: thisMonthRecords.length, previous: prevMonthRecords.length },
      emotionAvg: { current: thisEmotion, previous: prevEmotion },
      recordDays: { current: thisDays, previous: prevDays }
    };
  }

  /**
   * 同比对比：今年本月 vs 去年同月
   */
  function _calcYearComparison(youthId, monthStart, monthEnd) {
    var parts = monthStart.split('-');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var prevY = y - 1;
    var prevMonthStart = prevY + '-' + String(m).padStart(2, '0') + '-01';
    var prevLastDay = new Date(prevY, m, 0).getDate();
    var prevMonthEnd = prevMonthStart.substring(0, 7) + '-' + String(prevLastDay).padStart(2, '0');

    var allRecords = Storage.getRecords(youthId);

    var thisMonthRecords = allRecords.filter(function (r) {
      var d = (r.recordedAt || '').substring(0, 10);
      return d >= monthStart && d <= monthEnd;
    });
    var prevYearRecords = allRecords.filter(function (r) {
      var d = (r.recordedAt || '').substring(0, 10);
      return d >= prevMonthStart && d <= prevMonthEnd;
    });

    var thisEmotion = _avgEmotion(thisMonthRecords);
    var prevEmotion = _avgEmotion(prevYearRecords);

    var thisDays = _countDays(thisMonthRecords);
    var prevDays = _countDays(prevYearRecords);

    return {
      prevMonthStart: prevMonthStart,
      prevMonthEnd: prevMonthEnd,
      yearLabel: prevY + '年' + m + '月',
      recordCount: { current: thisMonthRecords.length, previous: prevYearRecords.length },
      emotionAvg: { current: thisEmotion, previous: prevEmotion },
      recordDays: { current: thisDays, previous: prevDays }
    };
  }

  function _avgEmotion(records) {
    if (records.length === 0) return null;
    var total = 0;
    var count = 0;
    for (var i = 0; i < records.length; i++) {
      var tags = (records[i].content && records[i].content.tags) || [];
      if (tags.length > 0) {
        for (var j = 0; j < tags.length; j++) {
          var w = TAG_WEIGHTS[tags[j]];
          if (w !== undefined) { total += w; count++; }
        }
      }
    }
    return count > 0 ? parseFloat((total / count).toFixed(1)) : null;
  }

  function _countDays(records) {
    var days = {};
    for (var i = 0; i < records.length; i++) {
      var d = (records[i].recordedAt || '').substring(0, 10);
      days[d] = true;
    }
    return Object.keys(days).length;
  }

  function _addDaysToStr(dateStr, days) {
    var d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return Utils.formatDate(d);
  }

  function _checkConsecutiveDays(byDay, sortedDays, threshold, checkFn) {
    if (sortedDays.length < threshold) return false;
    var lastDays = sortedDays.slice(-threshold);
    for (var i = 0; i < lastDays.length; i++) {
      if (!checkFn(byDay[lastDays[i]] || [])) return false;
    }
    return true;
  }

  /**
   * 检测中间断档（滑动窗口）
   * 找出日期范围内连续无记录的天数段（排除末尾断档，末尾断档由 recordGap 检测处理）
   * @param {object} byDay - 按天分组的记录
   * @param {string[]} dayKeys - 完整日期范围数组
   * @param {number} minGapLen - 最小断档长度（默认 2 天）
   * @returns {Array} 中间断档列表 [{ start, length, end }]
   */
  function _detectMiddleGaps(byDay, dayKeys, minGapLen) {
    minGapLen = minGapLen || 2;
    var gaps = [];
    var gapStart = null;
    var gapLen = 0;

    for (var i = 0; i < dayKeys.length; i++) {
      var hasRecord = byDay[dayKeys[i]] && byDay[dayKeys[i]].length > 0;
      if (!hasRecord) {
        if (gapStart === null) gapStart = i;
        gapLen++;
      } else {
        // 遇到有记录的天，结束当前断档判断
        if (gapLen >= minGapLen) {
          gaps.push({
            start: dayKeys[gapStart],
            length: gapLen,
            end: dayKeys[gapStart + gapLen - 1]
          });
        }
        gapStart = null;
        gapLen = 0;
      }
    }
    // 末尾断档不纳入"中间断档"（由末尾断档检测处理）
    return gaps;
  }

  /**
   * 趋势变化检测：比较最近3天与前4天的情绪变化
   */
  function _detectTrendChanges(byDay, sortedDays) {
    var alerts = [];
    if (sortedDays.length < 7) return alerts;

    var recent3 = sortedDays.slice(-3);
    var prev4 = sortedDays.slice(-7, -3);

    // 情绪评分比较
    var recentMoodScores = [];
    var prevMoodScores = [];
    for (var i = 0; i < recent3.length; i++) {
      var dayRecords = byDay[recent3[i]] || [];
      for (var j = 0; j < dayRecords.length; j++) {
        if (dayRecords[j].module === 'emotionBehavior') {
          var tags = (dayRecords[j].content && dayRecords[j].content.tags) || [];
          for (var k = 0; k < tags.length; k++) {
            var w = TAG_WEIGHTS[tags[k]];
            if (w !== undefined) recentMoodScores.push(w);
          }
        }
      }
    }
    for (var i = 0; i < prev4.length; i++) {
      var dayRecords = byDay[prev4[i]] || [];
      for (var j = 0; j < dayRecords.length; j++) {
        if (dayRecords[j].module === 'emotionBehavior') {
          var tags = (dayRecords[j].content && dayRecords[j].content.tags) || [];
          for (var k = 0; k < tags.length; k++) {
            var w = TAG_WEIGHTS[tags[k]];
            if (w !== undefined) prevMoodScores.push(w);
          }
        }
      }
    }

    if (recentMoodScores.length > 0 && prevMoodScores.length > 0) {
      var recentAvg = recentMoodScores.reduce(function(a, b) { return a + b; }, 0) / recentMoodScores.length;
      var prevAvg = prevMoodScores.reduce(function(a, b) { return a + b; }, 0) / prevMoodScores.length;
      var diff = recentAvg - prevAvg;

      if (diff < -1.0) {
        alerts.push({ type: 'mood_drop', text: '近3天情绪明显下降（较前4天下降 ' + Math.abs(diff).toFixed(1) + '）', module: 'emotionBehavior' });
      } else if (diff > 1.0) {
        alerts.push({ type: 'mood_rise', text: '近3天情绪明显回升（较前4天上升 ' + diff.toFixed(1) + '）', module: 'emotionBehavior' });
      }
    }

    // 记录频率比较
    var recentCount = 0;
    var prevCount = 0;
    for (var i = 0; i < recent3.length; i++) {
      recentCount += (byDay[recent3[i]] || []).length;
    }
    for (var i = 0; i < prev4.length; i++) {
      prevCount += (byDay[prev4[i]] || []).length;
    }
    var recentDaily = recentCount / 3;
    var prevDaily = prevCount / 4;
    if (prevDaily > 0 && recentDaily < prevDaily * 0.3) {
      alerts.push({ type: 'record_drop', text: '近3天记录量骤降（日均 ' + recentDaily.toFixed(1) + ' vs 前4天日均 ' + prevDaily.toFixed(1) + '）', module: 'global' });
    }

    return alerts;
  }

  /**
   * 基线对比：最近7天 vs 历史基线（近30天排除最近7天）
   */
  function _detectBaselineDeviation(byDay, sortedDays) {
    var alerts = [];
    if (sortedDays.length < 14) return alerts;

    var last7 = sortedDays.slice(-7);
    var baseline = sortedDays.slice(-30, -7);
    if (baseline.length < 7) return alerts;

    // 记录频率基线对比
    var last7Count = 0;
    var last7Days = 0;
    for (var i = 0; i < last7.length; i++) {
      var dayRecords = byDay[last7[i]];
      if (dayRecords && dayRecords.length > 0) {
        last7Count += dayRecords.length;
        last7Days++;
      }
    }
    var baselineCount = 0;
    var baselineDays = 0;
    for (var i = 0; i < baseline.length; i++) {
      var dayRecords = byDay[baseline[i]];
      if (dayRecords && dayRecords.length > 0) {
        baselineCount += dayRecords.length;
        baselineDays++;
      }
    }

    if (baselineDays > 0) {
      var last7Avg = last7Days > 0 ? last7Count / last7Days : 0;
      var baselineAvg = baselineCount / baselineDays;

      if (baselineAvg > 0 && last7Avg < baselineAvg * 0.3) {
        alerts.push({ type: 'baseline_low', text: '近7天记录频率显著低于历史基线（日均 ' + last7Avg.toFixed(1) + ' vs 基线 ' + baselineAvg.toFixed(1) + '）', module: 'global' });
      }
    }

    return alerts;
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

    parts.push('📅 ' + date + ' 日记摘要');
    parts.push('');

    for (var i = 0; i < modules.length; i++) {
      var key = modules[i].key;
      var status = moduleStatuses[key];
      if (status && status.hasRecords) {
        hasContent = true;
        var samples = status.samples.join('、');
        parts.push(modules[i].icon + ' ' + modules[i].label + '（' + status.count + '条）');
        if (samples) parts.push('  ' + samples);
      }
    }

    if (!hasContent) return date + ' 暂无记录。';

    parts.push('');
    if (alerts.length > 0) {
      parts.push('⚠️ 提醒：' + alerts.map(function (a) { return a.text; }).join('；'));
    } else {
      parts.push('✅ 今日无异常。');
    }
    return parts.join('\n');
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
    var text = '📊 月度总结\n\n';
    text += overview + '\n\n';
    text += '情绪趋势：' + emotionSummary + '\n\n';

    if (crossLinks.length > 0) {
      text += '跨模块关联发现：\n';
      for (var i = 0; i < crossLinks.length; i++) {
        text += '  • ' + crossLinks[i] + '\n';
      }
      text += '\n';
    }

    text += '总结：\n' + _generateNarrativeSummary(records, emotionSummary, crossLinks);
    return text;
  }

  function _generateNarrativeSummary(records, emotionSummary, crossLinks) {
    var parts = [];
    parts.push(emotionSummary + '。');

    var moduleCounts = _countByModule(records);
    var moduleKeys = Object.keys(moduleCounts);
    if (moduleKeys.length > 0) {
      parts.push('本月共覆盖 ' + moduleKeys.length + ' 个模块，总计 ' + records.length + ' 条记录');
    }

    if (crossLinks.length > 0) {
      parts.push(crossLinks.join('；'));
    }

    return parts.join('。');
  }

  /**
   * 获取今日用药状态
   */
  function _getDailyMedicationStatus(youthId, date) {
    var allRecords = Storage.getRecords(youthId);
    var todayRecords = allRecords.filter(function (r) {
      return (r.recordedAt || '').indexOf(date) === 0;
    });

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

  /**
   * 获取今日亮点（正向引导）
   * 扫描当日记录中的正向标签，按模块聚合为亮点条目
   */
  var HIGHLIGHT_RULES = {
    emotionBehavior: {
      icon: '😊',
      tags: {
        '愉悦': '情绪愉悦',
        '兴奋': '情绪积极兴奋',
        '平静': '情绪平静稳定',
        '配合': '配合度高'
      }
    },
    communicationGuide: {
      icon: '💬',
      tags: {
        '主动表达': '主动表达',
        '清晰': '表达清晰'
      }
    },
    careMedical: {
      icon: '💊',
      tags: {
        '按时服药': '按时服药',
        '睡眠良好': '睡眠良好',
        '食欲正常': '食欲正常'
      }
    },
    workSupport: {
      icon: '💼',
      tags: {
        '独立完成': '独立完成任务',
        '完成质量高': '工作完成质量高',
        '专注': '工作专注',
        '速度正常': '工作速度正常'
      }
    }
  };

  function _getDailyHighlights(todayRecords) {
    var moduleHits = {};
    var moduleLabels = {
      emotionBehavior: '情绪行为',
      communicationGuide: '沟通表达',
      careMedical: '照护医疗',
      workSupport: '工作生活'
    };

    for (var i = 0; i < todayRecords.length; i++) {
      var r = todayRecords[i];
      var rule = HIGHLIGHT_RULES[r.module];
      if (!rule) continue;
      var tags = (r.content && r.content.tags) || [];
      for (var j = 0; j < tags.length; j++) {
        var label = rule.tags[tags[j]];
        if (!label) continue;
        if (!moduleHits[r.module]) moduleHits[r.module] = { icon: rule.icon, labels: [] };
        if (moduleHits[r.module].labels.indexOf(label) === -1) {
          moduleHits[r.module].labels.push(label);
        }
      }
    }

    var highlights = [];
    var moduleOrder = ['emotionBehavior', 'communicationGuide', 'careMedical', 'workSupport'];
    for (var k = 0; k < moduleOrder.length; k++) {
      var key = moduleOrder[k];
      if (moduleHits[key]) {
        highlights.push({
          icon: moduleHits[key].icon,
          text: moduleHits[key].labels.join('、'),
          category: key
        });
      }
    }

    var count = highlights.length;
    var encouragement = '';
    if (count === 1) encouragement = '继续保持，每天一点小进步';
    else if (count === 2) encouragement = '今天有多项亮点，表现稳定';
    else if (count >= 3) encouragement = '今天亮点满满，值得记录的一天';

    return {
      highlights: highlights,
      encouragement: encouragement,
      count: count
    };
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