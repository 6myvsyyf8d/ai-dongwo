/**
 * analytics-ui.js - 数据价值呈现 UI 渲染层
 * 负责首页健康速报卡片 + 分析页（日报/周报/月报 Tab）
 * 依赖：AnalyticsEngine（计算引擎）、Chart.js（图表）
 */
window.AnalyticsUI = (function () {
  'use strict';

  var _currentTab = 'daily';
  var _chartInstances = {};
  var _currentDate = '';       // 日报/周报/月报的当前日期
  var _currentWeekStart = '';  // 周报起始日期
  var _currentMonthStart = ''; // 月报起始日期

  // ========== 首页健康速报卡片 ==========

  /**
   * 渲染首页"今日健康速报"卡片 HTML
   * @param {object} youth - 心青年档案
   * @returns {string} HTML 字符串
   */
  function renderHealthCard(youth) {
    if (!youth) return '';

    var today = Utils.formatDate(new Date());
    var summary = AnalyticsEngine.dailySummary(youth.id, today);
    var modules = Modules.MODULES.filter(function (m) { return m.key !== 'relationshipMap'; });

    // 模块状态行
    var statusRows = '';
    for (var i = 0; i < modules.length; i++) {
      var key = modules[i].key;
      var status = summary.moduleStatuses[key];
      if (!status) continue;

      var statusClass = '';
      var statusText = '';
      if (status.hasRecords) {
        if (status.hasNegative) {
          statusClass = 'health-status-warning';
          statusText = '⚠️ 注意';
        } else {
          statusClass = 'health-status-normal';
          statusText = '正常';
        }
      } else {
        statusClass = 'health-status-empty';
        statusText = '无记录';
      }

      statusRows += '<div class="health-module-item ' + statusClass + '">' +
        '<span class="health-module-icon">' + modules[i].icon + '</span>' +
        '<span class="health-module-label">' + modules[i].shortLabel + '</span>' +
        '<span class="health-module-status">' + statusText + '</span>' +
      '</div>';
    }

    // 异常预警行
    var alertHtml = '';
    if (summary.alerts.length > 0) {
      var alertTexts = summary.alerts.map(function (a) { return '⚠️ ' + a.text; });
      alertHtml = '<div class="health-alert-row health-alert-warning">' +
        '<span class="health-alert-text" id="health-alert-text">' + Utils.escapeHtml(alertTexts[0]) + '</span>' +
        (alertTexts.length > 1 ? '<span class="health-alert-dots">' + alertTexts.map(function (_, i) {
          return '<span class="health-alert-dot' + (i === 0 ? ' active' : '') + '"></span>';
        }).join('') + '</span>' : '') +
      '</div>';
    } else {
      alertHtml = '<div class="health-alert-row health-alert-clear">' +
        '<span class="health-alert-text">✅ 暂无异常预警</span>' +
      '</div>';
    }

    // 底部统计
    var footerHtml = '<div class="health-card-footer">' +
      '<span class="health-footer-stat">今日已记录 <strong>' + summary.recordCount + '</strong> 条</span>';
    if (summary.lastRecordTime) {
      footerHtml += '<span class="health-footer-stat">最近记录 ' + summary.lastRecordTime + '</span>';
    }
    footerHtml += '<span class="health-footer-link">查看完整分析 →</span>' +
    '</div>';

    return '<div class="health-card" data-youth-id="' + youth.id + '" id="health-card">' +
      '<div class="health-card-header">' +
        '<span class="health-card-title">📊 今日健康速报</span>' +
        '<span class="health-card-date">' + _formatDateChinese(today) + '</span>' +
      '</div>' +
      '<div class="health-module-grid">' + statusRows + '</div>' +
      alertHtml +
      footerHtml +
    '</div>';
  }

  /**
   * 绑定健康速报卡片事件
   */
  function bindHealthCardEvents(youth) {
    var card = document.getElementById('health-card');
    if (!card) return;

    card.addEventListener('click', function () {
      window.location.hash = 'analytics?youthId=' + encodeURIComponent(youth.id);
    });

    // 轮播异常预警
    var alertDots = card.querySelectorAll('.health-alert-dot');
    if (alertDots.length > 1) {
      _startAlertCarousel(card, youth);
    }
  }

  function _startAlertCarousel(card, youth) {
    var summary = AnalyticsEngine.dailySummary(youth.id);
    var alerts = summary.alerts;
    var dots = card.querySelectorAll('.health-alert-dot');
    var textEl = card.querySelector('.health-alert-text');
    var currentIdx = 0;

    setInterval(function () {
      if (!document.getElementById('health-card')) return;
      currentIdx = (currentIdx + 1) % alerts.length;
      if (textEl) textEl.textContent = '⚠️ ' + alerts[currentIdx].text;
      dots.forEach(function (d, i) {
        d.classList.toggle('active', i === currentIdx);
      });
    }, 3000);
  }

  // ========== 分析页 ==========

  /**
   * 渲染分析页
   */
  function renderAnalytics(params) {
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

    if (!AppState.currentYouth || AppState.currentYouth.id !== youthId) {
      AppState.selectYouth(youthId);
    }

    if (!Permissions.canRead()) {
      App.getContainer().innerHTML = '<div class="page-content"><div class="permission-denied"><div class="permission-denied-icon">🔒</div><div class="permission-denied-title">无访问权限</div></div></div>';
      return;
    }

    _destroyCharts();

    var today = Utils.formatDate(new Date());
    _currentDate = today;
    _currentWeekStart = _getWeekStart(today);
    _currentMonthStart = today.substring(0, 7) + '-01';
    _currentTab = 'daily';

    _renderAnalyticsPage(youth);
  }

  function _renderAnalyticsPage(youth) {
    var container = App.getContainer();

    container.innerHTML =
      '<div class="page-header">' +
        '<button class="btn btn-sm btn-secondary" id="btn-analytics-back">← 返回</button>' +
        '<span class="page-title">📊 ' + Utils.escapeHtml(youth.name) + ' · 数据分析</span>' +
        '<span></span>' +
      '</div>' +
      '<div class="analytics-page">' +
        // Tab 切换
        '<div class="analytics-tabs">' +
          '<button class="analytics-tab active" data-tab="daily">📅 日报</button>' +
          '<button class="analytics-tab" data-tab="weekly">📈 周报</button>' +
          '<button class="analytics-tab" data-tab="monthly">📊 月报</button>' +
        '</div>' +
        // 内容区
        '<div class="analytics-content" id="analytics-content"></div>' +
      '</div>';

    // 渲染当前 Tab
    _renderCurrentTab(youth);

    // 返回按钮
    var backBtn = container.querySelector('#btn-analytics-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        window.location.hash = 'dashboard';
      });
    }

    // 绑定 Tab 切换
    var tabs = container.querySelectorAll('.analytics-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        var tab = this.getAttribute('data-tab');
        _currentTab = tab;
        _destroyCharts();

        // 更新 active 状态
        var allTabs = container.querySelectorAll('.analytics-tab');
        for (var j = 0; j < allTabs.length; j++) {
          allTabs[j].classList.toggle('active', allTabs[j].getAttribute('data-tab') === tab);
        }

        _renderCurrentTab(youth);
      });
    }
  }

  function _renderCurrentTab(youth) {
    var content = document.getElementById('analytics-content');
    if (!content) return;

    switch (_currentTab) {
      case 'daily': _renderDailyTab(youth, content); break;
      case 'weekly': _renderWeeklyTab(youth, content); break;
      case 'monthly': _renderMonthlyTab(youth, content); break;
    }
  }

  // ========== 日报 Tab ==========

  function _renderDailyTab(youth, content) {
    var summary = AnalyticsEngine.dailySummary(youth.id, _currentDate);
    var modules = Modules.MODULES;

    var html = '';

    // 日期导航
    html += '<div class="analytics-date-nav">' +
      '<button class="analytics-date-btn" id="btn-date-prev">◀</button>' +
      '<span class="analytics-date-label">' + _formatDateChinese(_currentDate) + '</span>' +
      '<button class="analytics-date-btn" id="btn-date-next" ' + (_isToday(_currentDate) ? 'disabled' : '') + '>▶</button>' +
    '</div>';

    // 概览
    html += '<div class="analytics-card">' +
      '<div class="analytics-card-title">📋 今日摘要</div>';

    if (summary.recordCount === 0) {
      html += '<div class="analytics-empty">' +
        '<div class="analytics-empty-icon">📝</div>' +
        '<div class="analytics-empty-text">还没有这个时段的记录</div>' +
        '<a class="analytics-empty-link" href="#chat?youthId=' + encodeURIComponent(youth.id) + '">去"对话采集"补充记录吧 →</a>' +
      '</div>';
    } else {
      html += '<div class="analytics-summary-text">今日共记录 <strong>' + summary.recordCount + '</strong> 条，覆盖 <strong>' +
        Object.keys(summary.moduleCounts).filter(function (k) { return summary.moduleCounts[k] > 0; }).length +
        '</strong> 个模块。</div>';

      for (var i = 0; i < modules.length; i++) {
        var key = modules[i].key;
        var status = summary.moduleStatuses[key];
        if (!status) continue;

        var detailHtml = '';
        if (status.hasRecords && status.samples.length > 0) {
          detailHtml = '<div class="analytics-module-details">' +
            status.samples.map(function (s) {
              return '<div class="analytics-detail-item">' + Utils.escapeHtml(s.substring(0, 60)) + (s.length > 60 ? '...' : '') + '</div>';
            }).join('') +
          '</div>';
        }

        var statusColor = status.hasRecords ? (status.hasNegative ? 'var(--color-warning)' : 'var(--color-success)') : 'var(--color-text-tertiary)';
        var statusText = status.hasRecords ? (status.hasNegative ? '⚠️ ' + status.count + ' 条' : status.count + ' 条') : '无记录';

        html += '<div class="analytics-module-row">' +
          '<div class="analytics-module-header">' +
            '<span class="analytics-module-icon">' + modules[i].icon + '</span>' +
            '<span class="analytics-module-name">' + modules[i].label + '</span>' +
            '<span class="analytics-module-count" style="color:' + statusColor + '">' + statusText + '</span>' +
          '</div>' +
          detailHtml +
        '</div>';
      }

      // 异常提醒
      if (summary.alerts.length > 0) {
        html += '<div class="analytics-alert-section">' +
          '<div class="analytics-alert-title">⚠️ 异常提醒</div>' +
          summary.alerts.map(function (a) {
            return '<div class="analytics-alert-item">⚠️ ' + Utils.escapeHtml(a.text) + '</div>';
          }).join('') +
        '</div>';
      }
    }

    html += '</div>';

    // 日记摘要（可分享）
    if (summary.recordCount > 0) {
      html += '<div class="analytics-card">' +
        '<div class="analytics-card-title">📝 日记摘要（可分享）</div>' +
        '<div class="analytics-share-text">' + Utils.escapeHtml(summary.shareText).replace(/\n/g, '<br>') + '</div>' +
        '<button class="analytics-share-btn" id="btn-copy-share">📋 复制分享文本</button>' +
      '</div>';
    }

    content.innerHTML = html;

    // 绑定日期导航
    _bindDateNav(youth, 'daily');
    // 绑定复制按钮
    _bindCopyBtn(summary.shareText);
  }

  // ========== 周报 Tab ==========

  function _renderWeeklyTab(youth, content) {
    var weekEnd = _currentWeekStart ? _addDays(_currentWeekStart, 6) : Utils.formatDate(new Date());
    if (!_currentWeekStart) _currentWeekStart = _getWeekStart(weekEnd);

    var report = AnalyticsEngine.weeklyReport(youth.id, _currentWeekStart, weekEnd);

    var html = '';

    // 日期导航
    html += '<div class="analytics-date-nav">' +
      '<button class="analytics-date-btn" id="btn-week-prev">◀</button>' +
      '<span class="analytics-date-label">' + _currentWeekStart + ' ~ ' + weekEnd + '</span>' +
      '<button class="analytics-date-btn" id="btn-week-next" ' + (_isCurrentWeek(_currentWeekStart) ? 'disabled' : '') + '>▶</button>' +
    '</div>';

    if (report.totalRecords === 0) {
      html += '<div class="analytics-card">' +
        '<div class="analytics-empty">' +
          '<div class="analytics-empty-icon">📝</div>' +
          '<div class="analytics-empty-text">本周暂无记录</div>' +
        '</div>' +
      '</div>';
    } else {
      // 概览
      html += '<div class="analytics-card">' +
        '<div class="analytics-card-title">📋 本周概览</div>' +
        '<div class="analytics-summary-text">' + Utils.escapeHtml(report.overview) + '</div>' +
      '</div>';

      // 情绪趋势
      html += '<div class="analytics-card">' +
        '<div class="analytics-card-title">🌊 情绪趋势</div>' +
        '<div class="analytics-chart-wrapper"><canvas id="weekly-emotion-chart"></canvas></div>' +
        '<div class="analytics-chart-summary">' + Utils.escapeHtml(report.emotionSummary) + '</div>' +
      '</div>';

      // 照护统计
      var cs = report.careStats;
      html += '<div class="analytics-card">' +
        '<div class="analytics-card-title">💊 照护统计</div>' +
        '<div class="analytics-care-grid">' +
          '<div class="analytics-care-item"><span class="analytics-care-icon">🍽️</span><span class="analytics-care-label">饮食正常</span><span class="analytics-care-value">' + cs.dietNormal + '/' + cs.totalDays + ' 天</span></div>' +
          '<div class="analytics-care-item"><span class="analytics-care-icon">💤</span><span class="analytics-care-label">睡眠充足</span><span class="analytics-care-value">' + cs.sleepGood + '/' + cs.totalDays + ' 天</span></div>' +
          '<div class="analytics-care-item"><span class="analytics-care-icon">💊</span><span class="analytics-care-label">用药准时</span><span class="analytics-care-value">' + cs.medOnTime + '/' + cs.totalDays + ' 天</span></div>' +
        '</div>' +
      '</div>';

      // 各模块趋势
      html += '<div class="analytics-card">' +
        '<div class="analytics-card-title">📈 各模块趋势</div>';

      for (var i = 0; i < report.moduleTrends.length; i++) {
        var mt = report.moduleTrends[i];
        var arrow = mt.trend === 'up' ? '↑' : mt.trend === 'down' ? '↓' : mt.trend === 'empty' ? '—' : '→';
        var trendLabel = mt.trend === 'up' ? '增加' : mt.trend === 'down' ? '减少' : mt.trend === 'empty' ? '无记录' : '稳定';
        var trendColor = mt.trend === 'up' ? 'var(--color-success)' : mt.trend === 'down' ? 'var(--color-warning)' : 'var(--color-text-tertiary)';

        html += '<div class="analytics-trend-row">' +
          '<span class="analytics-trend-icon">' + mt.icon + '</span>' +
          '<span class="analytics-trend-name">' + mt.label + '</span>' +
          '<span class="analytics-trend-arrow" style="color:' + trendColor + '">' + arrow + ' ' + trendLabel + '</span>' +
          '<span class="analytics-trend-count">' + mt.total + ' 条</span>' +
        '</div>';
      }

      html += '</div>';

      // 提醒
      if (report.alerts.length > 0) {
        html += '<div class="analytics-card">' +
          '<div class="analytics-alert-section">' +
            '<div class="analytics-alert-title">⚠️ 本周提醒</div>' +
            report.alerts.map(function (a) { return '<div class="analytics-alert-item">' + Utils.escapeHtml(a) + '</div>'; }).join('') +
          '</div>' +
        '</div>';
      }

      // 分享
      html += '<div class="analytics-card">' +
        '<button class="analytics-share-btn" id="btn-copy-share">📋 复制周报文本</button>' +
      '</div>';
    }

    content.innerHTML = html;

    // 绑定日期导航
    _bindWeekNav(youth);
    // 绑定复制按钮
    if (report.totalRecords > 0) _bindCopyBtn(report.shareText);
    // 渲染图表
    if (report.totalRecords > 0 && report.emotionTrend.length > 0) {
      setTimeout(function () { _renderWeeklyEmotionChart(report.emotionTrend); }, 50);
    }
  }

  // ========== 月报 Tab ==========

  function _renderMonthlyTab(youth, content) {
    if (!_currentMonthStart) _currentMonthStart = Utils.formatDate(new Date()).substring(0, 7) + '-01';

    var parts = _currentMonthStart.split('-');
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var lastDay = new Date(year, month, 0).getDate();
    var monthEnd = _currentMonthStart.substring(0, 7) + '-' + String(lastDay).padStart(2, '0');

    var report = AnalyticsEngine.monthlyReport(youth.id, _currentMonthStart, monthEnd);

    var html = '';

    // 日期导航
    html += '<div class="analytics-date-nav">' +
      '<button class="analytics-date-btn" id="btn-month-prev">◀</button>' +
      '<span class="analytics-date-label">' + year + '年' + month + '月</span>' +
      '<button class="analytics-date-btn" id="btn-month-next" ' + (_isCurrentMonth(_currentMonthStart) ? 'disabled' : '') + '>▶</button>' +
    '</div>';

    if (report.totalRecords === 0) {
      html += '<div class="analytics-card">' +
        '<div class="analytics-empty">' +
          '<div class="analytics-empty-icon">📝</div>' +
          '<div class="analytics-empty-text">本月暂无记录</div>' +
        '</div>' +
      '</div>';
    } else {
      // 概览
      html += '<div class="analytics-card">' +
        '<div class="analytics-card-title">📋 月度概览</div>' +
        '<div class="analytics-summary-text">' + Utils.escapeHtml(report.overview) + '</div>' +
      '</div>';

      // 30 天情绪趋势
      html += '<div class="analytics-card">' +
        '<div class="analytics-card-title">🌊 ' + report.totalDays + '天情绪趋势</div>' +
        '<div class="analytics-chart-wrapper" style="height:280px;"><canvas id="monthly-emotion-chart"></canvas></div>' +
        '<div class="analytics-chart-summary">' + Utils.escapeHtml(report.emotionSummary) + '</div>' +
      '</div>';

      // 跨模块关联
      if (report.crossModuleLinks.length > 0) {
        html += '<div class="analytics-card">' +
          '<div class="analytics-card-title">🔗 跨模块关联发现</div>' +
          report.crossModuleLinks.map(function (link) {
            return '<div class="analytics-link-item">🔗 ' + Utils.escapeHtml(link) + '</div>';
          }).join('') +
        '</div>';
      }

      // 月度总结
      html += '<div class="analytics-card">' +
        '<div class="analytics-card-title">📝 月度总结（可分享）</div>' +
        '<div class="analytics-share-text">' + Utils.escapeHtml(report.shareText).replace(/\n/g, '<br>') + '</div>' +
        '<button class="analytics-share-btn" id="btn-copy-share">📋 复制分享文本</button>' +
      '</div>';
    }

    content.innerHTML = html;

    // 绑定日期导航
    _bindMonthNav(youth);
    // 绑定复制按钮
    if (report.totalRecords > 0) _bindCopyBtn(report.shareText);
    // 渲染图表
    if (report.totalRecords > 0 && report.emotionTrend.length > 0) {
      setTimeout(function () { _renderMonthlyEmotionChart(report.emotionTrend); }, 50);
    }
  }

  // ========== 图表渲染 ==========

  function _renderWeeklyEmotionChart(trendData) {
    var canvas = document.getElementById('weekly-emotion-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    var labels = trendData.map(function (d) { return d.date; });
    var scores = trendData.map(function (d) { return d.score; });

    _chartInstances.weeklyEmotion = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '情绪评分',
          data: scores,
          borderColor: '#2D7A7A',
          backgroundColor: 'rgba(45, 122, 122, 0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: scores.map(function (s) {
            if (s === null) return '#C7C7CC';
            return s >= 0 ? '#34C759' : '#FF3B30';
          }),
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            title: { display: true, text: '情绪评分' },
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              callback: function (v) {
                if (v > 0) return '😊';
                if (v < 0) return '😞';
                return '😐';
              }
            }
          },
          x: { grid: { display: false } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var v = ctx.parsed.y;
                if (v === null || v === undefined) return '无数据';
                return '情绪评分: ' + v;
              }
            }
          }
        }
      }
    });
  }

  function _renderMonthlyEmotionChart(trendData) {
    var canvas = document.getElementById('monthly-emotion-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    var labels = trendData.map(function (d) { return d.date; });
    var scores = trendData.map(function (d) { return d.score; });

    _chartInstances.monthlyEmotion = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '情绪评分',
          data: scores,
          borderColor: '#2D7A7A',
          backgroundColor: 'rgba(45, 122, 122, 0.08)',
          fill: true,
          tension: 0.2,
          pointRadius: 2,
          pointHoverRadius: 4,
          pointBackgroundColor: scores.map(function (s) {
            if (s === null) return '#C7C7CC';
            return s >= 0 ? '#34C759' : '#FF3B30';
          })
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            title: { display: true, text: '情绪评分' },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          x: {
            grid: { display: false },
            ticks: {
              maxTicksLimit: 15,
              callback: function (val, idx) { return idx % 5 === 0 ? labels[idx] : ''; }
            }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  function _destroyCharts() {
    for (var key in _chartInstances) {
      if (_chartInstances[key] && typeof _chartInstances[key].destroy === 'function') {
        _chartInstances[key].destroy();
      }
    }
    _chartInstances = {};
  }

  // ========== 事件绑定 ==========

  function _bindDateNav(youth, type) {
    var prevBtn = document.getElementById('btn-date-prev');
    var nextBtn = document.getElementById('btn-date-next');

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        _currentDate = _addDays(_currentDate, -1);
        _renderAnalyticsPage(youth);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        _currentDate = _addDays(_currentDate, 1);
        _renderAnalyticsPage(youth);
      });
    }
  }

  function _bindWeekNav(youth) {
    var prevBtn = document.getElementById('btn-week-prev');
    var nextBtn = document.getElementById('btn-week-next');

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        _currentWeekStart = _addDays(_currentWeekStart, -7);
        _renderAnalyticsPage(youth);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        _currentWeekStart = _addDays(_currentWeekStart, 7);
        _renderAnalyticsPage(youth);
      });
    }
  }

  function _bindMonthNav(youth) {
    var prevBtn = document.getElementById('btn-month-prev');
    var nextBtn = document.getElementById('btn-month-next');

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        var parts = _currentMonthStart.split('-');
        var y = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10);
        if (m === 1) { y--; m = 12; } else { m--; }
        _currentMonthStart = y + '-' + String(m).padStart(2, '0') + '-01';
        _renderAnalyticsPage(youth);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        var parts = _currentMonthStart.split('-');
        var y = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10);
        if (m === 12) { y++; m = 1; } else { m++; }
        _currentMonthStart = y + '-' + String(m).padStart(2, '0') + '-01';
        _renderAnalyticsPage(youth);
      });
    }
  }

  function _bindCopyBtn(text) {
    var btn = document.getElementById('btn-copy-share');
    if (!btn) return;

    btn.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = '✅ 已复制';
          setTimeout(function () { btn.textContent = '📋 复制分享文本'; }, 2000);
        }).catch(function () {
          _fallbackCopy(text, btn);
        });
      } else {
        _fallbackCopy(text, btn);
      }
    });
  }

  function _fallbackCopy(text, btn) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      btn.textContent = '✅ 已复制';
      setTimeout(function () { btn.textContent = '📋 复制分享文本'; }, 2000);
    } catch (e) {
      btn.textContent = '❌ 复制失败';
    }
    document.body.removeChild(textarea);
  }

  // ========== 日期工具函数 ==========

  function _formatDateChinese(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr + 'T00:00:00');
    var weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + weekDays[d.getDay()];
  }

  function _addDays(dateStr, days) {
    var d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return Utils.formatDate(d);
  }

  function _getWeekStart(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var day = d.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return Utils.formatDate(d);
  }

  function _isToday(dateStr) {
    return dateStr === Utils.formatDate(new Date());
  }

  function _isCurrentWeek(weekStart) {
    return weekStart === _getWeekStart(Utils.formatDate(new Date()));
  }

  function _isCurrentMonth(monthStart) {
    return monthStart === Utils.formatDate(new Date()).substring(0, 7) + '-01';
  }

  // ========== 暴露全局接口 ==========
  return {
    renderHealthCard: renderHealthCard,
    bindHealthCardEvents: bindHealthCardEvents,
    renderAnalytics: renderAnalytics
  };
})();