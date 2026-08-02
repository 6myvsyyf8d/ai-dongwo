/**
 * government.js - 政府宏观趋势看板
 * 仅展示脱敏聚合数据，不涉及个体档案
 */
window.Government = (function () {
  'use strict';

  var _chartInstances = {};

  /**
   * 渲染政府看板
   */
  function renderGovernment(params) {
    // 确认是政府角色
    if (!AppState.currentUser || AppState.currentUser.role !== 'government') {
      App.getContainer().innerHTML = '<div class="page-content"><div class="permission-denied"><div class="permission-denied-icon">🔒</div><div class="permission-denied-title">无访问权限</div><div class="permission-denied-desc">仅政府角色可访问此页面</div></div></div>';
      return;
    }

    _destroyCharts();

    var profiles = Storage.getProfiles();
    var allRecords = Storage.getAllRecords();
    var accounts = Storage.getAccounts();

    // 聚合统计（脱敏）
    var stats = _computeStats(profiles, allRecords, accounts);
    var monthlyReport = _computeMonthlyReport(profiles, allRecords, stats);

    _renderDashboard(stats, monthlyReport);
  }

  /**
   * 月度报告摘要：本月新建档案 / 年龄分布 / Top3 需求 / 资源建议
   * 全部为聚合数据，无个体信息
   */
  function _computeMonthlyReport(profiles, allRecords, stats) {
    var now = new Date();
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. 本月新建档案数
    var newProfilesThisMonth = 0;
    for (var id in profiles) {
      if (profiles[id].createdAt && new Date(profiles[id].createdAt) >= monthStart) {
        newProfilesThisMonth++;
      }
    }

    // 2. Top 3 需求标签：从所有记录的 content.tags 统计频次
    var tagCounts = {};
    for (var youthId in allRecords) {
      var records = allRecords[youthId];
      for (var i = 0; i < records.length; i++) {
        var tags = records[i].content && records[i].content.tags;
        if (Array.isArray(tags)) {
          for (var j = 0; j < tags.length; j++) {
            var tag = tags[j];
            // 排除"红线"安全类标签（不属于需求）
            if (tag && tag !== '红线' && tag !== '安全') {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
          }
        }
      }
    }
    var top3Needs = Object.keys(tagCounts)
      .sort(function (a, b) { return tagCounts[b] - tagCounts[a]; })
      .slice(0, 3)
      .map(function (tag) { return { tag: tag, count: tagCounts[tag] }; });

    // 3. 资源建议：基于 top needs 简单规则映射
    var suggestions = [];
    if (top3Needs.length === 0) {
      suggestions.push('暂无明显需求聚集，建议持续观察记录');
    } else {
      for (var k = 0; k < top3Needs.length; k++) {
        var t = top3Needs[k].tag;
        if (/情绪|焦虑|攻击|易怒/.test(t)) {
          suggestions.push('情绪支持：建议增加心理疏导与情绪调节训练师资');
        } else if (/沟通|语言|表达/.test(t)) {
          suggestions.push('沟通支持：建议配置 AAC 辅助沟通工具与言语治疗师');
        } else if (/就业|工作|技能|职业/.test(t)) {
          suggestions.push('就业支持：建议对接庇护性就业岗位与职业技能培训');
        } else if (/医疗|癫痫|过敏|睡眠/.test(t)) {
          suggestions.push('医疗资源：建议协调专科医生定期巡诊');
        } else if (/社交|友谊|融合/.test(t)) {
          suggestions.push('社交资源：建议组织社区融合活动');
        } else {
          suggestions.push('关注「' + t + '」相关资源配置');
        }
      }
    }

    return {
      monthLabel: now.getFullYear() + '年' + (now.getMonth() + 1) + '月',
      newProfilesThisMonth: newProfilesThisMonth,
      ageGroups: stats.ageGroups,
      top3Needs: top3Needs,
      resourceSuggestions: suggestions
    };
  }

  /**
   * 计算聚合统计
   */
  function _computeStats(profiles, allRecords, accounts) {
    var profileList = [];
    for (var id in profiles) {
      profileList.push(profiles[id]);
    }

    var totalYouths = profileList.length;
    var totalRecords = 0;
    for (var youthId in allRecords) {
      totalRecords += allRecords[youthId].length;
    }

    // 年龄分布
    var ageGroups = { '0-12': 0, '13-17': 0, '18-25': 0, '26-35': 0, '36-50': 0, '50+': 0 };
    var genderCounts = { male: 0, female: 0, other: 0 };
    var lifecycleCounts = {};

    for (var i = 0; i < profileList.length; i++) {
      var p = profileList[i];
      var age = Utils.calculateAge(p.birthDate);

      if (age <= 12) ageGroups['0-12']++;
      else if (age <= 17) ageGroups['13-17']++;
      else if (age <= 25) ageGroups['18-25']++;
      else if (age <= 35) ageGroups['26-35']++;
      else if (age <= 50) ageGroups['36-50']++;
      else ageGroups['50+']++;

      genderCounts[p.gender] = (genderCounts[p.gender] || 0) + 1;
      lifecycleCounts[p.lifeCycleStatus] = (lifecycleCounts[p.lifeCycleStatus] || 0) + 1;
    }

    // 账户角色统计
    var roleCounts = {};
    var totalAccounts = 0;
    for (var accId in accounts) {
      if (accounts[accId].isActive) {
        roleCounts[accounts[accId].role] = (roleCounts[accounts[accId].role] || 0) + 1;
        totalAccounts++;
      }
    }

    // 近30天记录数
    var thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    var recentRecords = 0;
    for (var youthId in allRecords) {
      for (var j = 0; j < allRecords[youthId].length; j++) {
        if (new Date(allRecords[youthId][j].recordedAt) >= thirtyDaysAgo) {
          recentRecords++;
        }
      }
    }

    return {
      totalYouths: totalYouths,
      totalRecords: totalRecords,
      totalAccounts: totalAccounts,
      recentRecords: recentRecords,
      ageGroups: ageGroups,
      genderCounts: genderCounts,
      lifecycleCounts: lifecycleCounts,
      roleCounts: roleCounts
    };
  }

  /**
   * 渲染看板
   */
  function _renderDashboard(stats, monthlyReport) {
    var container = App.getContainer();
    var user = AppState.currentUser;

    container.innerHTML =
      '<div class="page-header">' +
        '<span class="page-title">政府趋势看板</span>' +
      '</div>' +
      '<div class="gov-page">' +
        '<div class="gov-header">' +
          '<div class="gov-title">🏛️ 心青年全生涯数据灯塔</div>' +
          '<div class="gov-subtitle">宏观趋势看板 · ' + Utils.formatDate() + '</div>' +
        '</div>' +
        '<div class="gov-privacy-notice">' +
          '🔒 本看板仅展示脱敏聚合数据，不涉及任何个体档案信息' +
        '</div>' +
        // 统计卡片
        '<div class="gov-stats-grid">' +
          '<div class="gov-stat-card"><div class="gov-stat-icon">👥</div><div class="gov-stat-value">' + stats.totalYouths + '</div><div class="gov-stat-label">心青年总数</div></div>' +
          '<div class="gov-stat-card"><div class="gov-stat-icon">📝</div><div class="gov-stat-value">' + stats.totalRecords + '</div><div class="gov-stat-label">记录总数</div></div>' +
          '<div class="gov-stat-card"><div class="gov-stat-icon">📅</div><div class="gov-stat-value">' + stats.recentRecords + '</div><div class="gov-stat-label">近30天记录</div></div>' +
          '<div class="gov-stat-card"><div class="gov-stat-icon">👤</div><div class="gov-stat-value">' + stats.totalAccounts + '</div><div class="gov-stat-label">注册用户</div></div>' +
        '</div>' +
        // 月度报告摘要
        _renderMonthlyReportHtml(monthlyReport) +
        // 年龄分布
        '<div class="gov-chart-container">' +
          '<div class="gov-chart-header"><span class="gov-chart-title">📊 年龄分布</span></div>' +
          '<div class="age-distribution" id="age-distribution"></div>' +
        '</div>' +
        // 生命周期状态
        '<div class="gov-chart-container">' +
          '<div class="gov-chart-header"><span class="gov-chart-title">🔄 生命周期状态分布</span></div>' +
          '<div class="gov-chart-canvas-wrapper"><canvas id="lifecycle-chart"></canvas></div>' +
        '</div>' +
        // 角色分布
        '<div class="gov-chart-container">' +
          '<div class="gov-chart-header"><span class="gov-chart-title">👥 用户角色分布</span></div>' +
          '<div class="gov-chart-canvas-wrapper"><canvas id="role-chart"></canvas></div>' +
        '</div>' +
        // 性别分布
        '<div class="gov-chart-container">' +
          '<div class="gov-chart-header"><span class="gov-chart-title">性别分布</span></div>' +
          '<div class="gov-chart-canvas-wrapper"><canvas id="gender-chart"></canvas></div>' +
        '</div>' +
      '</div>';

    _renderAgeDistribution(stats.ageGroups);
    _renderLifecycleChart(stats.lifecycleCounts);
    _renderRoleChart(stats.roleCounts);
    _renderGenderChart(stats.genderCounts);
  }

  /**
   * 渲染月度报告摘要 HTML（聚合数据，无个体信息）
   */
  function _renderMonthlyReportHtml(report) {
    // Top 3 需求列表
    var needsHtml = '';
    if (report.top3Needs.length === 0) {
      needsHtml = '<div class="gov-report-empty">暂无需求标签数据</div>';
    } else {
      for (var i = 0; i < report.top3Needs.length; i++) {
        var n = report.top3Needs[i];
        needsHtml += '<div class="gov-need-item">' +
          '<span class="gov-need-rank">' + (i + 1) + '</span>' +
          '<span class="gov-need-tag">' + Utils.escapeHtml(n.tag) + '</span>' +
          '<span class="gov-need-count">' + n.count + ' 次</span>' +
        '</div>';
      }
    }

    // 资源建议
    var suggestionsHtml = '';
    for (var s = 0; s < report.resourceSuggestions.length; s++) {
      suggestionsHtml += '<li class="gov-suggestion-item">' + Utils.escapeHtml(report.resourceSuggestions[s]) + '</li>';
    }

    return '<div class="gov-chart-container gov-monthly-report">' +
      '<div class="gov-chart-header">' +
        '<span class="gov-chart-title">📋 ' + Utils.escapeHtml(report.monthLabel) + ' 报告摘要</span>' +
      '</div>' +
      '<div class="gov-report-body">' +
        '<div class="gov-report-row">' +
          '<div class="gov-report-metric">' +
            '<div class="gov-report-metric-value">' + report.newProfilesThisMonth + '</div>' +
            '<div class="gov-report-metric-label">本月新建档案</div>' +
          '</div>' +
        '</div>' +
        '<div class="gov-report-section">' +
          '<div class="gov-report-section-title">🏆 Top 3 需求</div>' +
          needsHtml +
        '</div>' +
        '<div class="gov-report-section">' +
          '<div class="gov-report-section-title">💡 资源建议</div>' +
          '<ul class="gov-suggestion-list">' + suggestionsHtml + '</ul>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /**
   * 渲染年龄分布柱状图
   */
  function _renderAgeDistribution(ageGroups) {
    var container = document.getElementById('age-distribution');
    if (!container) return;

    var maxCount = 1;
    for (var key in ageGroups) {
      if (ageGroups[key] > maxCount) maxCount = ageGroups[key];
    }

    var html = '';
    for (var ageKey in ageGroups) {
      var count = ageGroups[ageKey];
      var heightPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;
      html += '<div class="age-bar-group">' +
        '<div class="age-bar-count">' + count + '</div>' +
        '<div class="age-bar" style="height:' + heightPercent + '%;"></div>' +
        '<div class="age-bar-label">' + ageKey + '</div>' +
      '</div>';
    }
    container.innerHTML = html;
  }

  /**
   * 渲染生命周期状态图
   */
  function _renderLifecycleChart(lifecycleCounts) {
    var canvas = document.getElementById('lifecycle-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    var labels = Constants.LIFECYCLE_LABELS;
    var data = [];
    var labelKeys = [];
    for (var key in lifecycleCounts) {
      data.push(lifecycleCounts[key]);
      labelKeys.push(labels[key] || key);
    }

    if (data.length === 0) {
      canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-desc">暂无数据</div></div>';
      return;
    }

    _chartInstances.lifecycle = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labelKeys,
        datasets: [{
          data: data,
          backgroundColor: ['#8E8E93', '#34C759', '#FF9500', '#FF9500', '#5E5CE6', '#8E8E93', '#8E8E93']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 12 }, padding: 10 } }
        }
      }
    });
  }

  /**
   * 渲染角色分布图
   */
  function _renderRoleChart(roleCounts) {
    var canvas = document.getElementById('role-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    var labels = Constants.ROLE_LABELS;
    var data = [];
    var labelKeys = [];
    for (var key in roleCounts) {
      data.push(roleCounts[key]);
      labelKeys.push(labels[key] || key);
    }

    if (data.length === 0) {
      canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-desc">暂无数据</div></div>';
      return;
    }

    _chartInstances.role = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labelKeys,
        datasets: [{
          data: data,
          backgroundColor: ['#007AFF', '#34C759', '#FF9500', '#FF6B6B', '#5E5CE6', '#8E8E93']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  /**
   * 渲染性别分布图
   */
  function _renderGenderChart(genderCounts) {
    var canvas = document.getElementById('gender-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    var data = [genderCounts.male || 0, genderCounts.female || 0, genderCounts.other || 0];

    if (data.every(function (v) { return v === 0; })) {
      canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-desc">暂无数据</div></div>';
      return;
    }

    _chartInstances.gender = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: ['男', '女', '其他'],
        datasets: [{
          data: data,
          backgroundColor: ['#007AFF', '#FF6B6B', '#8E8E93']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 12 }, padding: 10 } }
        }
      }
    });
  }

  /**
   * 销毁图表
   */
  function _destroyCharts() {
    for (var key in _chartInstances) {
      if (_chartInstances[key] && typeof _chartInstances[key].destroy === 'function') {
        _chartInstances[key].destroy();
      }
    }
    _chartInstances = {};
  }

  return {
    renderGovernment: renderGovernment
  };
})();
