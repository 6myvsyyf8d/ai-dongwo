/**
 * charts.js - 数据可视化看板
 * 使用 Chart.js 渲染情绪趋势、能力雷达、模块分布等图表
 */
window.Charts = (function () {
  'use strict';

  // 模块定义引用 Modules.MODULES（modules.js 中唯一定义）

  var MOOD_VALUES = { crisis: 0, low: 1, neutral: 2, good: 3, great: 4 };
  var MOOD_LABELS = { great: '😀', good: '🙂', neutral: '😐', low: '😞', crisis: '🆘' };
  var MOOD_COLORS = { great: '#34C759', good: '#007AFF', neutral: '#8E8E93', low: '#FF9500', crisis: '#FF3B30' };

  // 存储图表实例，避免重复创建
  var _chartInstances = {};

  /**
   * 渲染图表页
   */
  function renderCharts(params) {
    var youthId = params.youthId;
    if (!youthId && AppState.currentYouth) {
      youthId = AppState.currentYouth.id;
    }
    if (!youthId) {
      var accessible = Permissions.getAccessibleYouths();
      if (accessible.length > 0) {
        youthId = accessible[0].id;
      } else {
        window.location.hash = 'dashboard';
        return;
      }
    }

    var youth = Storage.getProfile(youthId);
    if (!youth) {
      App.getContainer().innerHTML = '<div class="page-content"><div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">档案不存在</div></div></div>';
      return;
    }

    // 确保选中
    if (!AppState.currentYouth || AppState.currentYouth.id !== youthId) {
      AppState.selectYouth(youthId);
    }

    // 检查读取权限
    if (!Permissions.canRead()) {
      App.getContainer().innerHTML = '<div class="page-content"><div class="permission-denied"><div class="permission-denied-icon">🔒</div><div class="permission-denied-title">无访问权限</div></div></div>';
      return;
    }

    // 清理旧图表实例
    _destroyCharts();

    var records = Storage.getRecords(youthId);
    var visibleRecords = records.filter(function (r) {
      return Permissions.checkRecordVisibility(r);
    });

    _renderChartsPage(youth, visibleRecords);
  }

  /**
   * 渲染图表页面
   */
  function _renderChartsPage(youth, records) {
    var container = App.getContainer();

    // 统计数据
    var totalRecords = records.length;
    var moduleCounts = {};
    var typeCounts = {};
    for (var i = 0; i < records.length; i++) {
      var m = records[i].module;
      var t = records[i].recordType;
      moduleCounts[m] = (moduleCounts[m] || 0) + 1;
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }

    // 最近30天记录数
    var thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    var recentCount = records.filter(function (r) {
      return new Date(r.recordedAt) >= thirtyDaysAgo;
    }).length;

    // 行为红线数量
    var redLineCount = youth.modules.emotionBehavior && youth.modules.emotionBehavior.behaviorRedLines ?
      youth.modules.emotionBehavior.behaviorRedLines.length : 0;

    container.innerHTML =
      '<div class="page-header">' +
        '<button class="btn btn-sm btn-secondary" id="btn-back">← 返回</button>' +
        '<span class="page-title">' + Utils.escapeHtml(youth.name) + ' · 数据看板</span>' +
        '<span></span>' +
      '</div>' +
      '<div class="charts-page">' +
        // 统计卡片
        '<div class="stats-grid">' +
          '<div class="stat-card"><div class="stat-icon">📝</div><div class="stat-value">' + totalRecords + '</div><div class="stat-label">总记录数</div></div>' +
          '<div class="stat-card"><div class="stat-icon">📅</div><div class="stat-value">' + recentCount + '</div><div class="stat-label">近30天记录</div></div>' +
          '<div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-value">' + redLineCount + '</div><div class="stat-label">行为红线</div></div>' +
          '<div class="stat-card"><div class="stat-icon">📊</div><div class="stat-value">' + Object.keys(moduleCounts).length + '</div><div class="stat-label">覆盖模块</div></div>' +
        '</div>' +
        // 情绪趋势图
        '<div class="chart-container">' +
          '<div class="chart-header"><span class="chart-title">🌊 情绪趋势</span></div>' +
          '<div class="chart-canvas-wrapper"><canvas id="mood-chart"></canvas></div>' +
          '<div class="mood-legend">' +
            '<div class="mood-legend-item"><div class="mood-legend-dot" style="background:#34C759;"></div>很好</div>' +
            '<div class="mood-legend-item"><div class="mood-legend-dot" style="background:#007AFF;"></div>不错</div>' +
            '<div class="mood-legend-item"><div class="mood-legend-dot" style="background:#8E8E93;"></div>一般</div>' +
            '<div class="mood-legend-item"><div class="mood-legend-dot" style="background:#FF9500;"></div>低落</div>' +
            '<div class="mood-legend-item"><div class="mood-legend-dot" style="background:#FF3B30;"></div>危机</div>' +
          '</div>' +
        '</div>' +
        // 能力雷达图
        '<div class="chart-container">' +
          '<div class="chart-header"><span class="chart-title">📊 能力评估</span></div>' +
          '<div class="radar-wrapper"><canvas id="radar-chart"></canvas></div>' +
        '</div>' +
        // 模块分布
        '<div class="chart-container">' +
          '<div class="chart-header"><span class="chart-title">📈 记录模块分布</span></div>' +
          '<div class="module-distribution" id="module-distribution"></div>' +
        '</div>' +
        // 记录类型分布
        '<div class="chart-container">' +
          '<div class="chart-header"><span class="chart-title">📋 记录类型分布</span></div>' +
          '<div class="type-distribution-grid" id="type-distribution"></div>' +
        '</div>' +
      '</div>';

    // 渲染图表
    _renderMoodChart(youth);
    _renderRadarChart(youth);
    _renderModuleDistribution(moduleCounts, totalRecords);
    _renderTypeDistribution(typeCounts);

    // 绑定返回按钮
    document.getElementById('btn-back').addEventListener('click', function () {
      window.location.hash = 'profile?youthId=' + encodeURIComponent(youth.id);
    });
  }

  /**
   * 渲染情绪趋势图
   */
  function _renderMoodChart(youth) {
    var canvas = document.getElementById('mood-chart');
    if (!canvas) return;

    var emotionTrend = youth.modules.emotionBehavior && youth.modules.emotionBehavior.emotionTrend ?
      youth.modules.emotionBehavior.emotionTrend : [];

    if (emotionTrend.length === 0) {
      canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-desc">暂无情绪数据</div></div>';
      return;
    }

    // 取最近 14 天
    var recent = emotionTrend.slice(-14);
    var labels = recent.map(function (e) { return e.date.substring(5); });
    var data = recent.map(function (e) { return MOOD_VALUES[e.mood] !== undefined ? MOOD_VALUES[e.mood] : 2; });
    var colors = recent.map(function (e) { return MOOD_COLORS[e.mood] || '#8E8E93'; });

    if (typeof Chart === 'undefined') {
      canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-desc">Chart.js 未加载</div></div>';
      return;
    }

    _chartInstances.mood = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '情绪',
          data: data,
          borderColor: '#007AFF',
          backgroundColor: 'rgba(0, 122, 255, 0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: colors,
          pointBorderColor: colors,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            max: 4,
            ticks: {
              stepSize: 1,
              callback: function (value) {
                var labels = ['🆘', '😞', '😐', '🙂', '😀'];
                return labels[value] || '';
              }
            },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          x: {
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                var moodKeys = ['crisis', 'low', 'neutral', 'good', 'great'];
                var mood = moodKeys[context.parsed.y];
                return MOOD_LABELS[mood] + ' ' + (recent[context.dataIndex].note || '');
              }
            }
          }
        }
      }
    });
  }

  /**
   * 渲染能力雷达图
   */
  function _renderRadarChart(youth) {
    var canvas = document.getElementById('radar-chart');
    if (!canvas) return;

    var ca = youth.modules.workSupport && youth.modules.workSupport.capabilityAssessment;
    if (!ca) {
      canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-desc">暂无能力评估数据</div></div>';
      return;
    }

    if (typeof Chart === 'undefined') {
      canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-desc">Chart.js 未加载</div></div>';
      return;
    }

    _chartInstances.radar = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: ['社交互动', '生活自理', '工作技能', '社区参与', '沟通能力'],
        datasets: [{
          label: '能力评估',
          data: [ca.socialInteraction, ca.selfCare, ca.workSkills, ca.communityAccess, ca.communication],
          borderColor: '#007AFF',
          backgroundColor: 'rgba(0, 122, 255, 0.15)',
          pointBackgroundColor: '#007AFF',
          pointRadius: 4,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0,
            max: 5,
            ticks: { stepSize: 1, backdropColor: 'transparent' },
            grid: { color: 'rgba(0,0,0,0.08)' },
            angleLines: { color: 'rgba(0,0,0,0.08)' },
            pointLabels: { font: { size: 12 } }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  /**
   * 渲染模块分布
   */
  function _renderModuleDistribution(moduleCounts, total) {
    var container = document.getElementById('module-distribution');
    if (!container) return;

    if (total === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-desc">暂无记录</div></div>';
      return;
    }

    var html = '';
    for (var i = 0; i < Modules.MODULES.length; i++) {
      var m = Modules.MODULES[i];
      var count = moduleCounts[m.key] || 0;
      var percent = total > 0 ? Math.round((count / total) * 100) : 0;
      html += '<div class="module-distribution-item">' +
        '<div class="module-distribution-label">' + m.icon + ' ' + m.label + '</div>' +
        '<div class="module-distribution-bar">' +
          '<div class="module-distribution-fill" style="width:' + percent + '%;background:' + m.color + ';"></div>' +
        '</div>' +
        '<div class="module-distribution-count">' + count + '</div>' +
      '</div>';
    }
    container.innerHTML = html;
  }

  /**
   * 渲染记录类型分布
   */
  function _renderTypeDistribution(typeCounts) {
    var container = document.getElementById('type-distribution');
    if (!container) return;

    var types = [
      { key: 'observation', label: '观察', icon: '👁️' },
      { key: 'daily_care', label: '照护', icon: '🤝' },
      { key: 'incident', label: '事件', icon: '⚠️' },
      { key: 'achievement', label: '成就', icon: '🏆' },
      { key: 'medical', label: '医疗', icon: '🏥' },
      { key: 'preference', label: '偏好', icon: '❤️' }
    ];

    var html = '';
    for (var i = 0; i < types.length; i++) {
      var t = types[i];
      var count = typeCounts[t.key] || 0;
      html += '<div class="type-distribution-card">' +
        '<div class="type-distribution-icon">' + t.icon + '</div>' +
        '<div class="type-distribution-count">' + count + '</div>' +
        '<div class="type-distribution-label">' + t.label + '</div>' +
      '</div>';
    }
    container.innerHTML = html;
  }

  /**
   * 销毁所有图表实例
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
    renderCharts: renderCharts
  };
})();
