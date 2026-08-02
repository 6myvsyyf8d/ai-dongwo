/**
 * timeline.js - 时间轴视图
 * 按时间倒序展示记录，支持模块筛选
 */
window.Timeline = (function () {
  'use strict';

  // 模块定义引用 Modules.MODULES（modules.js 中唯一定义）

  var TYPE_ICONS = {
    observation: '👁️',
    daily_care: '🤝',
    incident: '⚠️',
    achievement: '🏆',
    medical: '🏥',
    preference: '❤️'
  };

  var _filter = { module: 'all' };

  /**
   * 渲染时间轴页
   */
  function renderTimeline(params) {
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

    var records = Storage.getRecords(youthId);
    _renderTimeline(youth, records);
  }

  /**
   * 渲染时间轴
   */
  function _renderTimeline(youth, records) {
    var container = App.getContainer();

    // 筛选栏
    var filterHtml = '<div class="timeline-filter">' +
      '<div class="filter-chip active" data-module="all">全部</div>';
    for (var i = 0; i < Modules.MODULES.length; i++) {
      filterHtml += '<div class="filter-chip" data-module="' + Modules.MODULES[i].key + '">' +
        Modules.MODULES[i].icon + ' ' + Modules.MODULES[i].shortLabel +
      '</div>';
    }
    filterHtml += '</div>';

    // 时间轴内容
    var timelineHtml = '';
    var visibleRecords = records.filter(function (r) {
      return Permissions.checkRecordVisibility(r);
    });

    if (visibleRecords.length === 0) {
      timelineHtml = '<div class="empty-state">' +
        '<div class="empty-state-icon">📅</div>' +
        '<div class="empty-state-title">暂无记录</div>' +
        '<div class="empty-state-desc">时间轴将在添加记录后显示</div>' +
      '</div>';
    } else {
      timelineHtml = '<div class="timeline-container" id="timeline-container">';
      for (var i = 0; i < visibleRecords.length; i++) {
        timelineHtml += _renderTimelineEntry(visibleRecords[i]);
      }
      timelineHtml += '</div>';
    }

    container.innerHTML =
      '<div class="page-header">' +
        '<button class="btn-back" id="btn-back">‹</button>' +
        '<span class="page-title">' + Utils.escapeHtml(youth.name) + ' · 时间轴</span>' +
        '<span></span>' +
      '</div>' +
      '<div class="timeline-page">' +
        filterHtml +
        timelineHtml +
      '</div>';

    _bindEvents(youth.id);
  }

  /**
   * 渲染单条时间轴条目
   */
  function _renderTimelineEntry(record) {
    var moduleInfo = Modules.MODULES.find(function (m) { return m.key === record.module; });
    var typeIcon = TYPE_ICONS[record.recordType] || '📝';
    var recorderAccount = Storage.getAccount(record.recorderId);
    var recorderName = recorderAccount ? recorderAccount.name : '未知';

    var contentText = '';
    if (record.content) {
      contentText = record.content.text || '';
    }

    var tagsHtml = '';
    if (record.content && record.content.tags && record.content.tags.length > 0) {
      tagsHtml = '<div class="record-tags">';
      for (var i = 0; i < record.content.tags.length; i++) {
        tagsHtml += '<span class="record-tag">' + Utils.escapeHtml(record.content.tags[i]) + '</span>';
      }
      tagsHtml += '</div>';
    }

    return '<div class="timeline-entry" data-module="' + record.module + '">' +
      '<div class="timeline-dot ' + record.recordType + '">' + typeIcon + '</div>' +
      '<div class="timeline-card">' +
        '<div class="timeline-card-header">' +
          '<span class="timeline-module-tag record-module-badge ' + record.module + '">' + (moduleInfo ? moduleInfo.icon : '') + ' ' + (moduleInfo ? moduleInfo.label : record.module) + '</span>' +
          '<span class="timeline-date">' + Utils.formatDisplay(record.recordedAt) + '</span>' +
        '</div>' +
        '<div class="timeline-card-content">' + Utils.escapeHtml(contentText) + '</div>' +
        tagsHtml +
        '<div class="timeline-card-footer">' +
          '<span>' + Utils.escapeHtml(recorderName) + '</span>' +
          (record.isOffline ? '<span class="record-offline-badge">📱 离线</span>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /**
   * 绑定事件
   */
  function _bindEvents(youthId) {
    document.getElementById('btn-back').addEventListener('click', function () {
      window.location.hash = 'profile?youthId=' + encodeURIComponent(youthId);
    });

    var chips = document.querySelectorAll('.timeline-filter .filter-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].addEventListener('click', function () {
        for (var j = 0; j < chips.length; j++) {
          chips[j].classList.remove('active');
        }
        this.classList.add('active');
        _filter.module = this.getAttribute('data-module');

        var entries = document.querySelectorAll('.timeline-entry');
        for (var k = 0; k < entries.length; k++) {
          var module = entries[k].getAttribute('data-module');
          if (_filter.module === 'all' || module === _filter.module) {
            entries[k].style.display = '';
          } else {
            entries[k].style.display = 'none';
          }
        }
      });
    }
  }

  return {
    renderTimeline: renderTimeline
  };
})();
