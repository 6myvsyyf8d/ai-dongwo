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

    _renderDashboard(stats);
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
  function _renderDashboard(stats) {
    var container = App.getContainer();
    var user = AppState.currentUser;

    container.innerHTML =
      '<div class="page-header">' +
        '<span class="page-title">政府趋势看板</span>' +
        '<button class="btn btn-sm btn-secondary" id="btn-logout">退出</button>' +
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

    document.getElementById('btn-logout').addEventListener('click', function () {
      AppState.logout();
      window.location.hash = 'login';
    });
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
