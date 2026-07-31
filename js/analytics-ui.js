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
  var _arDateFilter = 'all';   // 分析页记录列表日期筛选

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
        window.location.hash = 'records';
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

    // 时间线洞察
    html += _renderTimelineInsights(youth.id);

    // 原始记录（可展开）
    html += _renderRecordsSectionHtml();

    content.innerHTML = html;

    // 绑定日期导航
    _bindDateNav(youth, 'daily');
    // 绑定复制按钮
    _bindCopyBtn(summary.shareText);
    // 绑定原始记录展开
    _bindRecordsSection(youth.id);
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

    // 原始记录（可展开）
    html += _renderRecordsSectionHtml();

    content.innerHTML = html;

    // 绑定日期导航
    _bindWeekNav(youth);
    // 绑定复制按钮
    if (report.totalRecords > 0) _bindCopyBtn(report.shareText);
    // 绑定原始记录展开
    _bindRecordsSection(youth.id);
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
      // 概览 + AI 解读
      var moduleCount = 0;
      var mcMatch = report.overview.match(/覆盖\s*(\d+)\s*个模块/);
      if (mcMatch) moduleCount = parseInt(mcMatch[1], 10);
      var insightsHtml = _generateMonthlyInsights(report, youth.id, _currentMonthStart, monthEnd);
      html += '<div class="analytics-card">' +
        '<div class="analytics-card-title">📋 月度概览</div>' +
        '<div class="monthly-stats-grid">' +
          '<div class="monthly-stat-card">' +
            '<div class="monthly-stat-value">' + report.totalRecords + '</div>' +
            '<div class="monthly-stat-label">总记录</div>' +
          '</div>' +
          '<div class="monthly-stat-card">' +
            '<div class="monthly-stat-value">' + (report.totalRecords / report.totalDays).toFixed(1) + '</div>' +
            '<div class="monthly-stat-label">日均</div>' +
          '</div>' +
          '<div class="monthly-stat-card">' +
            '<div class="monthly-stat-value">' + report.recordDays + '/' + report.totalDays + '</div>' +
            '<div class="monthly-stat-label">记录天数</div>' +
          '</div>' +
          '<div class="monthly-stat-card">' +
            '<div class="monthly-stat-value">' + moduleCount + '</div>' +
            '<div class="monthly-stat-label">覆盖模块</div>' +
          '</div>' +
        '</div>' +
        '<div class="analytics-insights-section">' +
          '<div class="analytics-insights-title">🤖 AI 解读</div>' +
          insightsHtml +
        '</div>' +
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

      // 照护统计
      var mcs = report.careStats;
      if (mcs) {
        html += '<div class="analytics-card">' +
          '<div class="analytics-card-title">💊 照护统计</div>' +
          '<div class="analytics-care-grid">' +
            '<div class="analytics-care-item"><span class="analytics-care-icon">🍽️</span><span class="analytics-care-label">饮食正常</span><span class="analytics-care-value">' + mcs.dietNormal + '/' + mcs.totalDays + ' 天</span></div>' +
            '<div class="analytics-care-item"><span class="analytics-care-icon">💤</span><span class="analytics-care-label">睡眠充足</span><span class="analytics-care-value">' + mcs.sleepGood + '/' + mcs.totalDays + ' 天</span></div>' +
            '<div class="analytics-care-item"><span class="analytics-care-icon">💊</span><span class="analytics-care-label">用药准时</span><span class="analytics-care-value">' + mcs.medOnTime + '/' + mcs.totalDays + ' 天</span></div>' +
          '</div>' +
        '</div>';
      }

      // 月度总结
      html += '<div class="analytics-card">' +
        '<div class="analytics-card-title">📝 月度总结（可分享）</div>' +
        '<div class="analytics-share-text">' + Utils.escapeHtml(report.shareText).replace(/\n/g, '<br>') + '</div>' +
        '<button class="analytics-share-btn" id="btn-copy-share">📋 复制分享文本</button>' +
      '</div>';
    }

    // 原始记录（可展开）
    html += _renderRecordsSectionHtml();

    content.innerHTML = html;

    // 绑定日期导航
    _bindMonthNav(youth);
    // 绑定复制按钮
    if (report.totalRecords > 0) _bindCopyBtn(report.shareText);
    // 绑定原始记录展开
    _bindRecordsSection(youth.id);
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
            grid: { color: 'rgba(0,0,0,0.05)' }
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

  // ========== 时间线洞察 ==========

  function _renderTimelineInsights(youthId) {
    var records = Storage.getRecords(youthId);
    if (!records || records.length === 0) {
      return '<div class="ios-card-group">' +
        '<div class="ios-card-group-header"><span>📈 时间线洞察</span></div>' +
        '<div class="ios-card-row-static"><div class="ios-card-row-title" style="color:var(--color-text-tertiary);">暂无足够数据生成洞察</div></div>' +
      '</div>';
    }

    records.sort(function(a, b) {
      return new Date(a.recordedAt) - new Date(b.recordedAt);
    });

    var moduleAccentColors = {
      emotionBehavior: '#D4877B',
      communicationGuide: '#9B85B8',
      careMedical: '#A8C9A0',
      workSupport: '#D4A85A',
      relationshipMap: '#B5A8D4'
    };
    var moduleIcons = {
      emotionBehavior: '😊',
      communicationGuide: '💬',
      careMedical: '💊',
      workSupport: '💼',
      relationshipMap: '🗺️'
    };
    var moduleLabels = {
      emotionBehavior: '情绪行为',
      communicationGuide: '沟通说明',
      careMedical: '照护医疗',
      workSupport: '工作生活',
      relationshipMap: '关系地图'
    };

    var html = '<div class="ios-card-group">';
    html += '<div class="ios-card-group-header"><span>📈 时间线洞察</span></div>';

    // === 情绪趋势条（保持原有可视化） ===
    var emotionRecords = records.filter(function(r) { return r.module === 'emotionBehavior'; });
    if (emotionRecords.length > 0) {
      var recentEmotions = emotionRecords.slice(-10);
      var positiveCount = 0;
      for (var i = 0; i < recentEmotions.length; i++) {
        var tags = (recentEmotions[i].content && recentEmotions[i].content.tags) || [];
        var isPositive = tags.some(function(t) { return ['平静','愉悦','配合','专注'].indexOf(t) > -1; });
        if (isPositive) positiveCount++;
      }
      var positiveRate = Math.round(positiveCount / recentEmotions.length * 100);
      html += '<div class="ios-card-row-static">' +
        '<div class="ios-card-row-body">' +
          '<div class="ios-card-row-title">😊 情绪趋势</div>' +
          '<div class="timeline-bar-wrap">' +
            '<div class="timeline-bar-positive" style="width:' + positiveRate + '%;">' + positiveRate + '%</div>' +
            '<div class="timeline-bar-negative" style="width:' + (100 - positiveRate) + '%;">' + (100 - positiveRate) + '%</div>' +
          '</div>' +
          '<div class="ios-card-row-subtitle">最近 ' + recentEmotions.length + ' 条记录，积极情绪占比 ' + positiveRate + '%</div>' +
        '</div></div>';
    }

    // === 可视时间线条（所有记录按时间排列的色点） ===
    html += _renderTimelineStrip(records, moduleAccentColors);

    // === 模块概览卡片（2列网格 + 迷你sparkline） ===
    html += '<div class="timeline-module-grid">';
    var moduleKeys = ['communicationGuide', 'careMedical', 'workSupport', 'relationshipMap', 'emotionBehavior'];
    for (var mk = 0; mk < moduleKeys.length; mk++) {
      var mKey = moduleKeys[mk];
      var mRecords = records.filter(function(r) { return r.module === mKey; });
      if (mRecords.length === 0) continue;
      var color = moduleAccentColors[mKey] || '#8ab8e8';
      var sparklineHtml = _renderSparkline(mRecords, color);
      html += '<div class="timeline-module-card" style="border-left: 3px solid ' + color + ';">' +
        '<div class="timeline-module-card-header">' +
          '<span class="timeline-module-icon">' + (moduleIcons[mKey] || '📋') + '</span>' +
          '<span class="timeline-module-label">' + (moduleLabels[mKey] || mKey) + '</span>' +
          '<span class="timeline-module-count" style="color:' + color + ';">' + mRecords.length + '</span>' +
        '</div>' +
        sparklineHtml +
        '<div class="timeline-module-tags">' + _renderModuleTopTags(mRecords) + '</div>' +
      '</div>';
    }
    html += '</div>';

    // === 能力成长（里程碑时间线） ===
    var achievementRecords = records.filter(function(r) { return r.recordType === 'achievement'; });
    if (achievementRecords.length > 0) {
      html += '<div class="ios-card-row-static" style="margin-top:12px;">' +
        '<div class="ios-card-row-body">' +
          '<div class="ios-card-row-title">🏆 能力成长</div>' +
          '<div class="milestone-timeline">';
      var recentAchievements = achievementRecords.slice(-5).reverse();
      for (var ai = 0; ai < recentAchievements.length; ai++) {
        html += '<div class="milestone-dot-row">' +
          '<div class="milestone-dot" style="background:#D4A85A;"></div>' +
          '<div class="milestone-content">' +
            '<span class="milestone-date">' + Utils.formatDate(recentAchievements[ai].recordedAt) + '</span>' +
            '<span class="milestone-text">' + Utils.escapeHtml((recentAchievements[ai].content && recentAchievements[ai].content.text) || '') + '</span>' +
          '</div>' +
        '</div>';
      }
      html += '</div></div></div>';
    }

    // === 事件记录（红色警示时间线） ===
    var incidentRecords = records.filter(function(r) { return r.recordType === 'incident'; });
    if (incidentRecords.length > 0) {
      html += '<div class="ios-card-row-static" style="margin-top:12px;">' +
        '<div class="ios-card-row-body">' +
          '<div class="ios-card-row-title">⚠️ 事件记录</div>' +
          '<div class="milestone-timeline">';
      var recentIncidents = incidentRecords.slice(-5).reverse();
      for (var ii = 0; ii < recentIncidents.length; ii++) {
        html += '<div class="milestone-dot-row">' +
          '<div class="milestone-dot" style="background:#D4877B;"></div>' +
          '<div class="milestone-content">' +
            '<span class="milestone-date">' + Utils.formatDate(recentIncidents[ii].recordedAt) + '</span>' +
            '<span class="milestone-text">' + Utils.escapeHtml((recentIncidents[ii].content && recentIncidents[ii].content.text) || '') + '</span>' +
          '</div>' +
        '</div>';
      }
      html += '</div></div></div>';
    }

    html += '</div>';
    return html;
  }

  /**
   * 渲染可视时间线条（水平滚动色点）
   */
  function _renderTimelineStrip(records, moduleAccentColors) {
    if (records.length === 0) return '';
    var html = '<div class="timeline-strip-container">' +
      '<div class="timeline-strip-track">';
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var color = moduleAccentColors[r.module] || '#8ab8e8';
      var dateStr = Utils.formatDate(r.recordedAt);
      var title = dateStr;
      html += '<div class="timeline-strip-dot" style="background:' + color + ';" title="' + Utils.escapeHtml(title) + '"></div>';
    }
    html += '</div>' +
      '<div class="timeline-strip-labels">' +
        '<span>' + Utils.formatDate(records[0].recordedAt) + '</span>' +
        '<span>' + Utils.formatDate(records[records.length - 1].recordedAt) + '</span>' +
      '</div>' +
    '</div>';
    return html;
  }

  /**
   * 渲染迷你 sparkline（最近7天柱状图）
   */
  function _renderSparkline(records, color) {
    if (records.length === 0) return '';
    // 按天分组（最近7天）
    var dayMap = {};
    var now = new Date();
    for (var d = 6; d >= 0; d--) {
      var day = new Date(now);
      day.setDate(day.getDate() - d);
      var key = day.toISOString().slice(0, 10);
      dayMap[key] = 0;
    }
    for (var i = 0; i < records.length; i++) {
      var rKey = records[i].recordedAt.slice(0, 10);
      if (dayMap[rKey] !== undefined) dayMap[rKey]++;
    }
    var days = Object.keys(dayMap).sort();
    var maxCount = 0;
    for (var j = 0; j < days.length; j++) {
      if (dayMap[days[j]] > maxCount) maxCount = dayMap[days[j]];
    }
    if (maxCount === 0) maxCount = 1;

    var html = '<div class="sparkline">';
    for (var k = 0; k < days.length; k++) {
      var h = Math.max(4, Math.round(dayMap[days[k]] / maxCount * 28));
      var isActive = dayMap[days[k]] > 0;
      html += '<div class="sparkline-bar' + (isActive ? ' sparkline-bar-active' : '') + '" style="height:' + h + 'px;background:' + (isActive ? color : 'rgba(255,255,255,0.06)') + ';" title="' + days[k] + ': ' + dayMap[days[k]] + '条"></div>';
    }
    html += '</div>';
    return html;
  }

  /**
   * 渲染模块高频标签
   */
  function _renderModuleTopTags(records) {
    var tagCount = {};
    for (var i = 0; i < records.length; i++) {
      var tags = (records[i].content && records[i].content.tags) || [];
      for (var j = 0; j < tags.length; j++) {
        tagCount[tags[j]] = (tagCount[tags[j]] || 0) + 1;
      }
    }
    var sorted = Object.keys(tagCount).sort(function(a, b) { return tagCount[b] - tagCount[a]; });
    var top = sorted.slice(0, 3);
    if (top.length === 0) return '<span class="timeline-no-tags">暂无标签</span>';
    var html = '';
    for (var k = 0; k < top.length; k++) {
      html += '<span class="timeline-tag-chip">' + Utils.escapeHtml(top[k]) + ' <small>×' + tagCount[top[k]] + '</small></span>';
    }
    return html;
  }

  // ========== AI 解读 ==========

  function _generateMonthlyInsights(report, youthId, monthStart, monthEnd) {
    var allRecords = Storage.getRecords(youthId);
    var monthRecords = allRecords.filter(function (r) {
      var d = (r.recordedAt || '').substring(0, 10);
      return d >= monthStart && d <= monthEnd;
    });

    // 按天分组
    var byDay = {};
    for (var i = 0; i < monthRecords.length; i++) {
      var day = (monthRecords[i].recordedAt || '').substring(0, 10);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(monthRecords[i]);
    }

    // 生成日期范围
    var dayKeys = [];
    var parts = monthStart.split('-');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var lastDay = new Date(y, m, 0).getDate();
    for (var d = 1; d <= lastDay; d++) {
      dayKeys.push(monthStart.substring(0, 7) + '-' + String(d).padStart(2, '0'));
    }

    // 找到断档日期
    var gapDays = [];
    for (var di = 0; di < dayKeys.length; di++) {
      if (!byDay[dayKeys[di]]) {
        gapDays.push(dayKeys[di]);
      }
    }

    var html = '';
    var insightId = 0;

    // 洞察1：断档/全勤
    var gap = report.totalDays - report.recordDays;
    if (gap > 0) {
      // 找断档日期前后的记录
      var gapEvidence = _findGapEvidence(byDay, dayKeys, gapDays);
      html += _buildInsightCard(insightId, '⚠️', '本月有 ' + gap + ' 天未记录，建议保持每日记录习惯', gapEvidence);
      insightId++;
    } else {
      html += _buildInsightCard(insightId, '✅', '本月全勤记录，习惯非常好', '');
      insightId++;
    }

    // 洞察2：情绪趋势
    var emoSummary = report.emotionSummary || '';
    if (emoSummary.indexOf('回落') > -1 || emoSummary.indexOf('偏低') > -1) {
      var emotionEvidence = _findEmotionSecondHalf(byDay, dayKeys, monthRecords);
      html += _buildInsightCard(insightId, '📉', '情绪有回落趋势，建议关注情绪触发因素', emotionEvidence);
    } else if (emoSummary.indexOf('积极') > -1 || emoSummary.indexOf('更好') > -1) {
      html += _buildInsightCard(insightId, '📈', '情绪整体向好，继续保持', '');
    } else {
      html += _buildInsightCard(insightId, '➡️', '情绪整体平稳', '');
    }
    insightId++;

    // 洞察3：模块覆盖
    if (report.recordDays > 0) {
      var coverageEvidence = _findModuleCoverage(monthRecords);
      html += _buildInsightCard(insightId, '📊', '日均记录 ' + (report.totalRecords / report.totalDays).toFixed(1) + ' 条，覆盖 ' + Object.keys(_countByModule(monthRecords)).length + ' 个模块', coverageEvidence);
      insightId++;
    }

    // 洞察4：跨模块关联
    if (report.crossModuleLinks && report.crossModuleLinks.length > 0) {
      html += _buildInsightCard(insightId, '🔗', '发现 ' + report.crossModuleLinks.length + ' 个跨模块关联，可进一步关注', '');
      insightId++;
    }

    return html;
  }

  // 统计每个模块的记录数
  function _countByModule(records) {
    var counts = {};
    for (var i = 0; i < records.length; i++) {
      var mod = records[i].module;
      if (!counts[mod]) counts[mod] = 0;
      counts[mod]++;
    }
    return counts;
  }

  // 构建 insight card HTML
  function _buildInsightCard(id, icon, text, evidenceHtml) {
    var hasEvidence = evidenceHtml && evidenceHtml.length > 0;
    return '<div class="insight-card" data-insight-id="' + id + '">' +
      '<div class="insight-header" onclick="AnalyticsUI._toggleInsight(this)">' +
        '<span class="insight-icon">' + icon + '</span>' +
        '<span class="insight-text">' + text + '</span>' +
        '<span class="insight-toggle">' + (hasEvidence ? '▾' : '') + '</span>' +
      '</div>' +
      (hasEvidence ? '<div class="insight-evidence" style="display:none;">' + evidenceHtml + '</div>' : '') +
    '</div>';
  }

  // 为断档洞察找证据：断档日前后的记录
  function _findGapEvidence(byDay, dayKeys, gapDays) {
    var evidenceItems = [];
    var seenDates = {};

    for (var gi = 0; gi < gapDays.length; gi++) {
      var gapDate = gapDays[gi];
      var idx = dayKeys.indexOf(gapDate);

      // 找断档日前一天和后一天
      var candidates = [];
      if (idx > 0) candidates.push(dayKeys[idx - 1]);
      if (idx < dayKeys.length - 1) candidates.push(dayKeys[idx + 1]);

      for (var ci = 0; ci < candidates.length; ci++) {
        var candDate = candidates[ci];
        if (seenDates[candDate] || !byDay[candDate]) continue;
        seenDates[candDate] = true;

        var dayRecords = byDay[candDate];
        for (var ri = 0; ri < Math.min(dayRecords.length, 2); ri++) {
          var r = dayRecords[ri];
          var modInfo = _getModuleInfo(r.module);
          var contentText = (r.content && r.content.text) ? r.content.text : '';
          evidenceItems.push(
            '<div class="insight-evidence-item">' +
              '<span class="insight-evidence-date">' + candDate.substring(5) + '</span>' +
              '<span class="insight-evidence-icon">' + (modInfo ? modInfo.icon : '📝') + '</span>' +
              '<span class="insight-evidence-text">' + Utils.escapeHtml(contentText.substring(0, 60)) + (contentText.length > 60 ? '...' : '') + '</span>' +
            '</div>'
          );
        }
      }

      if (evidenceItems.length >= 6) break;
    }

    return evidenceItems.join('');
  }

  // 为情绪回落洞察找证据：下半月的情绪记录
  function _findEmotionSecondHalf(byDay, dayKeys, monthRecords) {
    var halfIdx = Math.floor(dayKeys.length / 2);
    var secondHalf = dayKeys.slice(halfIdx);
    var emotionRecords = [];

    for (var i = 0; i < monthRecords.length; i++) {
      if (monthRecords[i].module === 'emotionBehavior') {
        emotionRecords.push(monthRecords[i]);
      }
    }

    // 取下半月中最近的几条
    var evidenceItems = [];
    var count = 0;
    for (var di = secondHalf.length - 1; di >= 0 && count < 4; di--) {
      var date = secondHalf[di];
      if (!byDay[date]) continue;
      var dayRecords = byDay[date];
      for (var ri = 0; ri < dayRecords.length && count < 4; ri++) {
        if (dayRecords[ri].module === 'emotionBehavior') {
          var r = dayRecords[ri];
          var contentText = (r.content && r.content.text) ? r.content.text : '';
          evidenceItems.push(
            '<div class="insight-evidence-item">' +
              '<span class="insight-evidence-date">' + date.substring(5) + '</span>' +
              '<span class="insight-evidence-icon">🌊</span>' +
              '<span class="insight-evidence-text">' + Utils.escapeHtml(contentText.substring(0, 60)) + (contentText.length > 60 ? '...' : '') + '</span>' +
            '</div>'
          );
          count++;
        }
      }
    }

    return evidenceItems.join('');
  }

  // 为模块覆盖洞察找证据：每个模块最新的记录
  function _findModuleCoverage(monthRecords) {
    // 按模块分组，取每个模块最新的记录
    var byModule = {};
    for (var i = 0; i < monthRecords.length; i++) {
      var r = monthRecords[i];
      if (!byModule[r.module]) byModule[r.module] = [];
      byModule[r.module].push(r);
    }

    var moduleKeys = Object.keys(byModule).sort();
    var evidenceItems = [];

    for (var mi = 0; mi < moduleKeys.length; mi++) {
      var modRecords = byModule[moduleKeys[mi]];
      // 按日期排序，取最新
      modRecords.sort(function (a, b) {
        return (b.recordedAt || '') > (a.recordedAt || '') ? 1 : -1;
      });
      var latest = modRecords[0];
      var modInfo = _getModuleInfo(moduleKeys[mi]);
      var contentText = (latest.content && latest.content.text) ? latest.content.text : '';
      var dateStr = (latest.recordedAt || '').substring(5, 10);
      evidenceItems.push(
        '<div class="insight-evidence-item">' +
          '<span class="insight-evidence-date">' + dateStr + '</span>' +
          '<span class="insight-evidence-icon">' + (modInfo ? modInfo.icon : '📝') + '</span>' +
          '<span class="insight-evidence-text">' + Utils.escapeHtml(contentText.substring(0, 60)) + (contentText.length > 60 ? '...' : '') + '</span>' +
        '</div>'
      );
    }

    return evidenceItems.join('');
  }

  // 获取模块信息
  function _getModuleInfo(moduleKey) {
    var modules = Modules.MODULES;
    for (var i = 0; i < modules.length; i++) {
      if (modules[i].key === moduleKey) return modules[i];
    }
    return null;
  }

  function _toggleInsight(headerEl) {
    var card = headerEl.closest('.insight-card');
    if (!card) return;
    var evidence = card.querySelector('.insight-evidence');
    if (!evidence) return;
    var isHidden = evidence.style.display === 'none';
    evidence.style.display = isHidden ? 'block' : 'none';
    card.classList.toggle('expanded', isHidden);
  }

  function _bindDetailToggle() {
    var toggle = document.getElementById('toggle-monthly-detail');
    var detail = document.getElementById('monthly-data-detail');
    if (!toggle || !detail) return;
    toggle.addEventListener('click', function () {
      var isHidden = detail.style.display === 'none';
      detail.style.display = isHidden ? 'block' : 'none';
      toggle.textContent = isHidden ? '📊 数据详情 ▲' : '📊 数据详情 ▼';
    });
  }

  // ========== 记录列表区域（迁移自记录页「最近记录」卡片风格） ==========

  var _RECORD_TYPE_MAP = {
    observation: { label: '观察记录', icon: '👁️' },
    daily_care: { label: '日常照护', icon: '🤝' },
    incident: { label: '事件记录', icon: '⚠️' },
    achievement: { label: '成就记录', icon: '🏆' },
    medical: { label: '医疗记录', icon: '🏥' },
    preference: { label: '偏好记录', icon: '❤️' }
  };

  function _renderRecordsSectionHtml() {
    return '<div class="ios-card-group" id="analytics-records-section">' +
      '<div class="ios-card-group-header"><span>📋 最近记录</span></div>' +
      '<div class="records-filter-bar" id="ar-filter-bar" style="margin-bottom:8px;display:block;padding:0 12px;">' +
      '</div>' +
      '<div class="records-list" id="ar-record-list" style="padding:0 12px;"></div>' +
    '</div>';
  }

  function _bindRecordsSection(youthId) {
    _renderRecordsList(youthId);
  }

  function _renderRecordsList(youthId) {
    var records = Storage.getRecords(youthId);
    var filterBar = document.getElementById('ar-filter-bar');
    var recordList = document.getElementById('ar-record-list');
    if (!filterBar || !recordList) return;

    // 日期筛选 chip
    var dateChipsHtml = '<div class="records-filter-bar records-filter-bar--date" style="margin-bottom:4px;">' +
      '<span class="filter-chip date-chip' + (_arDateFilter === 'all' ? ' active' : '') + '" data-ar-date="all">全部时间</span>' +
      '<span class="filter-chip date-chip' + (_arDateFilter === 'today' ? ' active' : '') + '" data-ar-date="today">今天</span>' +
      '<span class="filter-chip date-chip' + (_arDateFilter === 'yesterday' ? ' active' : '') + '" data-ar-date="yesterday">昨天</span>' +
      '<span class="filter-chip date-chip' + (_arDateFilter === 'this_week' ? ' active' : '') + '" data-ar-date="this_week">本周</span>' +
      '<span class="filter-chip date-chip' + (_arDateFilter === 'this_month' ? ' active' : '') + '" data-ar-date="this_month">本月</span>' +
    '</div>';

    // 模块筛选 chip
    var modules = Modules.MODULES;
    var chipsHtml = '<span class="filter-chip active" data-ar-module="all">全部</span>';
    for (var i = 0; i < modules.length; i++) {
      chipsHtml += '<span class="filter-chip" data-ar-module="' + modules[i].key + '">' +
        modules[i].icon + ' ' + modules[i].label +
      '</span>';
    }
    filterBar.innerHTML = dateChipsHtml + '<div class="records-filter-bar" style="margin-top:4px;">' + chipsHtml + '</div>';

    // 渲染列表
    _renderFilteredRecords(records, 'all', _arDateFilter);

    // 绑定筛选事件
    var allChips = filterBar.querySelectorAll('.filter-chip');
    for (var ci = 0; ci < allChips.length; ci++) {
      allChips[ci].addEventListener('click', function () {
        var dateAttr = this.getAttribute('data-ar-date');
        var moduleAttr = this.getAttribute('data-ar-module');

        if (dateAttr) {
          var dateChips = filterBar.querySelectorAll('.date-chip');
          for (var dc = 0; dc < dateChips.length; dc++) {
            dateChips[dc].classList.remove('active');
          }
          this.classList.add('active');
          _arDateFilter = dateAttr;
        }

        if (moduleAttr) {
          var moduleChips = filterBar.querySelectorAll('[data-ar-module]');
          for (var mc = 0; mc < moduleChips.length; mc++) {
            moduleChips[mc].classList.remove('active');
          }
          this.classList.add('active');
        }

        var activeModuleChip = filterBar.querySelector('[data-ar-module].active');
        var currentModule = activeModuleChip ? activeModuleChip.getAttribute('data-ar-module') : 'all';

        _renderFilteredRecords(records, currentModule, _arDateFilter);
      });
    }
  }

  function _renderFilteredRecords(records, moduleFilter, dateFilter) {
    var recordList = document.getElementById('ar-record-list');
    if (!recordList) return;

    var filtered = moduleFilter === 'all' ? records : records.filter(function (r) { return r.module === moduleFilter; });

    dateFilter = dateFilter || 'all';
    if (dateFilter !== 'all') {
      filtered = filtered.filter(function (r) {
        var dateStr = (r.recordedAt || '').substring(0, 10);
        return _isInDateRange(dateStr, dateFilter);
      });
    }

    if (filtered.length === 0) {
      recordList.innerHTML = '<div class="empty-state" style="padding:16px;text-align:center;"><div class="empty-state-icon">📝</div><div class="empty-state-title" style="font-size:14px;color:var(--color-text-secondary);">暂无记录</div></div>';
      return;
    }

    // 按时间倒序
    filtered.sort(function(a, b) {
      return new Date(b.recordedAt) - new Date(a.recordedAt);
    });

    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      var r = filtered[i];
      var modInfo = null;
      for (var mi = 0; mi < Modules.MODULES.length; mi++) {
        if (Modules.MODULES[mi].key === r.module) { modInfo = Modules.MODULES[mi]; break; }
      }
      var typeInfo = _RECORD_TYPE_MAP[r.recordType] || { label: r.recordType, icon: '📝' };
      var contentText = (r.content && r.content.text) ? r.content.text : '';
      var dateStr = (r.recordedAt || '').substring(0, 10);

      // 标签
      var tagsHtml = '';
      if (r.content && r.content.tags && r.content.tags.length > 0) {
        tagsHtml = '<div class="record-tags">';
        for (var ti = 0; ti < r.content.tags.length; ti++) {
          tagsHtml += '<span class="record-tag">' + Utils.escapeHtml(r.content.tags[ti]) + '</span>';
        }
        tagsHtml += '</div>';
      }

      // 模块图标颜色
      var iconBgColors = {
        communicationGuide: 'rgba(175, 82, 222, 0.1)',
        emotionBehavior: 'rgba(255, 59, 48, 0.1)',
        careMedical: 'rgba(52, 199, 89, 0.1)',
        workSupport: 'rgba(255, 159, 10, 0.1)',
        relationshipMap: 'rgba(88, 86, 214, 0.1)'
      };
      var iconBg = iconBgColors[r.module] || 'rgba(142, 142, 147, 0.1)';

      html += '<div class="record-item">' +
        '<div class="record-item-icon" style="background:' + iconBg + '">' + (modInfo ? modInfo.icon : '📝') + '</div>' +
        '<div class="record-item-body">' +
          '<div class="record-item-meta">' +
            '<span class="record-module-badge ' + r.module + '">' + (modInfo ? modInfo.label : r.module) + '</span>' +
          '</div>' +
          '<div class="record-item-content">' + Utils.escapeHtml(contentText) + '</div>' +
          tagsHtml +
          '<div class="record-item-footer">' +
            '<span class="record-recorder">' + typeInfo.icon + ' ' + typeInfo.label + '</span>' +
            '<span>' + Utils.formatDisplay(r.recordedAt) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }
    recordList.innerHTML = html;
  }

  /**
   * 判断日期是否在指定范围内
   */
  function _isInDateRange(dateStr, range) {
    if (!dateStr) return false;

    var now = new Date();
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return false;

    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (range) {
      case 'today':
        return d.getTime() === today.getTime();

      case 'yesterday':
        var yesterday = new Date(today.getTime() - 86400000);
        return d.getTime() === yesterday.getTime();

      case 'this_week': {
        var dayOfWeek = today.getDay();
        var daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        var monday = new Date(today.getTime() - daysFromMonday * 86400000);
        return d.getTime() >= monday.getTime();
      }

      case 'this_month':
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();

      default:
        return false;
    }
  }

  // ========== 暴露全局接口 ==========
  return {
    renderHealthCard: renderHealthCard,
    bindHealthCardEvents: bindHealthCardEvents,
    renderAnalytics: renderAnalytics,
    _toggleInsight: _toggleInsight
  };
})();