/**
 * records.js - 多角色记录采集
 * 6 模块表单、可见性选择、权限校验、离线标记
 */
window.Records = (function () {
  'use strict';

  // 模块定义引用 Modules.MODULES（modules.js 中唯一定义）

  // 记录类型
  var RECORD_TYPES = [
    { value: 'observation', label: '观察记录', icon: '👁️' },
    { value: 'daily_care', label: '日常照护', icon: '🤝' },
    { value: 'incident', label: '事件记录', icon: '⚠️' },
    { value: 'achievement', label: '成就记录', icon: '🏆' },
    { value: 'medical', label: '医疗记录', icon: '🏥' },
    { value: 'preference', label: '偏好记录', icon: '❤️' }
  ];

  // 可见性级别
  var VISIBILITY_LEVELS = [
    { value: 'full', label: '完整可见', icon: '🌍', desc: '所有有授权的角色可见' },
    { value: 'safety_only', label: '仅安全相关', icon: '🛡️', desc: '仅紧急安全场景可见' },
    { value: 'private', label: '仅自己/家长', icon: '🔒', desc: '仅记录者和家长可见' }
  ];

  // 当前筛选状态
  var _filter = {
    module: 'all',
    date: 'all'
  };

  /**
   * 渲染记录列表页
   */
  function renderRecords(params) {
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
      _renderPermissionDenied();
      return;
    }

    var records = Storage.getRecords(youthId);
    _renderRecordList(youth, records);
  }

  /**
   * 渲染权限不足提示
   */
  function _renderPermissionDenied() {
    App.getContainer().innerHTML =
      '<div class="page-header">' +
        '<button class="btn btn-sm btn-secondary" id="btn-back">← 返回</button>' +
        '<span class="page-title">记录采集</span>' +
        '<span></span>' +
      '</div>' +
      '<div class="permission-denied">' +
        '<div class="permission-denied-icon">🔒</div>' +
        '<div class="permission-denied-title">无访问权限</div>' +
        '<div class="permission-denied-desc">您没有查看该档案记录的权限</div>' +
      '</div>';

    document.getElementById('btn-back').addEventListener('click', function () {
      window.location.hash = 'dashboard';
    });
  }

  /**
   * 渲染记录列表 — iOS 内嵌分组卡片风格
   */
  function _renderRecordList(youth, records) {
    var container = App.getContainer();

    // 模块筛选 Chip 行
    var filterHtml = '<div class="records-filter-bar">' +
      '<div class="filter-chip active" data-module="all">全部</div>';
    for (var i = 0; i < Modules.MODULES.length; i++) {
      filterHtml += '<div class="filter-chip" data-module="' + Modules.MODULES[i].key + '">' +
        '<span class="filter-chip-icon">' + Modules.MODULES[i].icon + '</span>' + Modules.MODULES[i].label +
      '</div>';
    }
    filterHtml += '</div>';

    // 日期筛选 Chip 行（新增）
    filterHtml += '<div class="records-filter-bar records-filter-bar--date">' +
      '<div class="filter-chip date-chip active" data-date="all">全部时间</div>' +
      '<div class="filter-chip date-chip" data-date="today">今天</div>' +
      '<div class="filter-chip date-chip" data-date="yesterday">昨天</div>' +
      '<div class="filter-chip date-chip" data-date="this_week">本周</div>' +
      '<div class="filter-chip date-chip" data-date="this_month">本月</div>' +
    '</div>';

    // 记录列表 — iOS 卡片分组
    var listHtml = '';
    if (records.length === 0) {
      listHtml = '<div class="empty-state">' +
        '<div class="empty-state-icon">📝</div>' +
        '<div class="empty-state-title">暂无记录</div>' +
        '<div class="empty-state-desc">点击右下角按钮添加第一条记录</div>' +
      '</div>';
    } else {
      listHtml = '<div class="records-list" id="record-list">' +
        '<div class="ios-card-group">';
      for (var i = 0; i < records.length; i++) {
        listHtml += _renderRecordItem(records[i]);
      }
      listHtml += '</div></div>';
    }

    // 是否有写入权限
    var canWrite = Permissions.canWrite('communicationGuide') || Permissions.canWrite('emotionBehavior') || Permissions.canWrite('careMedical') || Permissions.canWrite('workSupport');
    var fabHtml = canWrite ? '<button class="fab" id="btn-add-record" aria-label="添加新记录">+</button>' : '';

    container.innerHTML =
      '<div class="page-header">' +
        '<button class="btn btn-sm btn-secondary" id="btn-back">← 返回</button>' +
        '<span class="page-title">' + Utils.escapeHtml(youth.name) + ' · 记录</span>' +
        '<span></span>' +
      '</div>' +
      filterHtml +
      listHtml +
      fabHtml;

    _bindListEvents(youth.id);
  }

  /**
   * 渲染单条记录 — iOS 卡片行风格
   */
  function _renderRecordItem(record) {
    var moduleInfo = Modules.MODULES.find(function (m) { return m.key === record.module; });
    var typeInfo = RECORD_TYPES.find(function (t) { return t.value === record.recordType; });
    var visInfo = VISIBILITY_LEVELS.find(function (v) { return v.value === record.visibilityLevel; });
    var recorderAccount = Storage.getAccount(record.recorderId);
    var recorderName = recorderAccount ? recorderAccount.name : '未知';

    // 权限检查：是否可见
    if (!Permissions.checkRecordVisibility(record)) {
      return '';
    }

    var contentText = '';
    if (record.content) {
      contentText = record.content.text || JSON.stringify(record.content);
    }

    var tagsHtml = '';
    if (record.content && record.content.tags && record.content.tags.length > 0) {
      tagsHtml = '<div class="record-tags">';
      for (var i = 0; i < record.content.tags.length; i++) {
        tagsHtml += '<span class="record-tag">' + Utils.escapeHtml(record.content.tags[i]) + '</span>';
      }
      tagsHtml += '</div>';
    }

    var offlineHtml = record.isOffline ? '<span class="record-offline-badge">📱 离线</span>' : '';

    // 模块图标颜色
    var iconBgColors = {
      communicationGuide: 'rgba(175, 82, 222, 0.1)',
      emotionBehavior: 'rgba(255, 59, 48, 0.1)',
      careMedical: 'rgba(52, 199, 89, 0.1)',
      workSupport: 'rgba(255, 159, 10, 0.1)',
      relationshipMap: 'rgba(88, 86, 214, 0.1)'
    };
    var iconBg = iconBgColors[record.module] || 'rgba(142, 142, 147, 0.1)';

    var dateStr = record.recordedAt ? record.recordedAt.slice(0, 10) : '';
    return '<div class="record-item" data-module="' + record.module + '" data-date="' + dateStr + '" data-record-id="' + record.id + '">' +
      '<div class="record-item-icon" style="background:' + iconBg + '">' + (moduleInfo ? moduleInfo.icon : '📝') + '</div>' +
      '<div class="record-item-body">' +
        '<div class="record-item-meta">' +
          '<span class="record-module-badge ' + record.module + '">' + (moduleInfo ? moduleInfo.label : record.module) + '</span>' +
          '<span class="record-visibility-badge ' + record.visibilityLevel + '">' + (visInfo ? visInfo.icon + ' ' + visInfo.label : record.visibilityLevel) + '</span>' +
        '</div>' +
        '<div class="record-item-content">' + Utils.escapeHtml(contentText) + '</div>' +
        tagsHtml +
        '<div class="record-item-footer">' +
          '<span class="record-recorder">' +
            (typeInfo ? typeInfo.icon : '📝') + ' ' + Utils.escapeHtml(recorderName) +
          '</span>' +
          '<span>' + Utils.formatDisplay(record.recordedAt) + '</span>' +
          offlineHtml +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /**
   * 绑定列表事件
   */
  function _bindListEvents(youthId) {
    document.getElementById('btn-back').addEventListener('click', function () {
      window.location.hash = 'profile?youthId=' + encodeURIComponent(youthId);
    });

    // 模块筛选 Chip
    var moduleChips = document.querySelectorAll('.records-filter-bar:not(.records-filter-bar--date) .filter-chip');
    for (var i = 0; i < moduleChips.length; i++) {
      moduleChips[i].addEventListener('click', function () {
        for (var j = 0; j < moduleChips.length; j++) {
          moduleChips[j].classList.remove('active');
        }
        this.classList.add('active');
        _filter.module = this.getAttribute('data-module');
        _applyFilter();
      });
    }

    // 日期筛选 Chip
    var dateChips = document.querySelectorAll('.records-filter-bar--date .filter-chip');
    for (var i = 0; i < dateChips.length; i++) {
      dateChips[i].addEventListener('click', function () {
        for (var j = 0; j < dateChips.length; j++) {
          dateChips[j].classList.remove('active');
        }
        this.classList.add('active');
        _filter.date = this.getAttribute('data-date');
        _applyFilter();
      });
    }

    // 添加记录
    var fab = document.getElementById('btn-add-record');
    if (fab) {
      fab.addEventListener('click', function () {
        _showRecordForm(youthId);
      });
    }
  }

  /**
   * 应用筛选
   */
  function _applyFilter() {
    var items = document.querySelectorAll('.record-item');
    var visibleCount = 0;
    for (var i = 0; i < items.length; i++) {
      var module = items[i].getAttribute('data-module');
      var dateStr = items[i].getAttribute('data-date');
      var moduleMatch = _filter.module === 'all' || module === _filter.module;
      var dateMatch = _filter.date === 'all' || _isInDateRange(dateStr, _filter.date);
      if (moduleMatch && dateMatch) {
        items[i].style.display = '';
        visibleCount++;
      } else {
        items[i].style.display = 'none';
      }
    }
    // 空状态处理
    var emptyEl = document.getElementById('filter-empty-state');
    if (visibleCount === 0) {
      if (!emptyEl) {
        var listEl = document.getElementById('record-list');
        if (listEl) {
          var div = document.createElement('div');
          div.id = 'filter-empty-state';
          div.className = 'empty-state';
          div.innerHTML = '<div class="empty-state-icon">🔍</div><div class="empty-state-title">该条件下暂无记录</div>';
          listEl.parentNode.insertBefore(div, listEl);
          listEl.style.display = 'none';
        }
      }
    } else {
      if (emptyEl) {
        emptyEl.parentNode.removeChild(emptyEl);
      }
      var listEl = document.getElementById('record-list');
      if (listEl) {
        listEl.style.display = '';
      }
    }
  }

  /**
   * 判断日期是否在指定范围内
   * @param {string} dateStr - YYYY-MM-DD 格式的日期字符串
   * @param {string} range - today | yesterday | this_week | this_month
   * @returns {boolean}
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
        // 本周一 00:00
        var dayOfWeek = today.getDay();
        // getDay(): 0=周日, 所以周一=1, 周日需要特殊处理
        var daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        var monday = new Date(today.getTime() - daysFromMonday * 86400000);
        return d.getTime() >= monday.getTime();
      }

      case 'this_month':
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();

      default:
        return true;
    }
  }

  /**
   * 显示记录表单（底部弹出）
   */
  function _showRecordForm(youthId, existingRecord) {
    var isEdit = !!existingRecord;
    var overlay = document.createElement('div');
    overlay.className = 'record-form-overlay';
    overlay.id = 'record-form-overlay';

    // 模块选择器
    var moduleOptionsHtml = '';
    for (var i = 0; i < Modules.MODULES.length; i++) {
      var canWriteModule = Permissions.canWrite(Modules.MODULES[i].key);
      var selected = existingRecord && existingRecord.module === Modules.MODULES[i].key;
      moduleOptionsHtml += '<div class="module-option' + (selected ? ' selected' : '') + '" data-module="' + Modules.MODULES[i].key + '"' + (canWriteModule ? '' : ' style="opacity:0.4;pointer-events:none;"') + '>' +
        '<div class="module-option-icon">' + Modules.MODULES[i].icon + '</div>' +
        '<div class="module-option-label">' + Modules.MODULES[i].label + '</div>' +
      '</div>';
    }

    // 记录类型选择器
    var typeOptionsHtml = '';
    for (var i = 0; i < RECORD_TYPES.length; i++) {
      var selected = existingRecord && existingRecord.recordType === RECORD_TYPES[i].value;
      typeOptionsHtml += '<option value="' + RECORD_TYPES[i].value + '"' + (selected ? ' selected' : '') + '>' + RECORD_TYPES[i].icon + ' ' + RECORD_TYPES[i].label + '</option>';
    }

    // 可见性选择器
    var visOptionsHtml = '';
    for (var i = 0; i < VISIBILITY_LEVELS.length; i++) {
      var selected = existingRecord ? existingRecord.visibilityLevel === VISIBILITY_LEVELS[i].value : i === 0;
      visOptionsHtml += '<div class="visibility-option' + (selected ? ' selected' : '') + '" data-visibility="' + VISIBILITY_LEVELS[i].value + '">' +
        '<div class="visibility-option-icon">' + VISIBILITY_LEVELS[i].icon + '</div>' +
        '<div class="visibility-option-label">' + VISIBILITY_LEVELS[i].label + '</div>' +
        '<div class="visibility-option-desc">' + VISIBILITY_LEVELS[i].desc + '</div>' +
      '</div>';
    }

    var existingText = existingRecord && existingRecord.content ? (existingRecord.content.text || '') : '';
    var existingTags = existingRecord && existingRecord.content && existingRecord.content.tags ? existingRecord.content.tags.join(', ') : '';

    overlay.innerHTML =
      '<div class="record-form-sheet">' +
        '<div class="record-form-header">' +
          '<span class="record-form-title">' + (isEdit ? '编辑记录' : '新增记录') + '</span>' +
          '<button class="record-form-close" id="btn-close-form" aria-label="关闭表单">×</button>' +
        '</div>' +
        '<div class="record-form-body">' +
          '<div class="form-group">' +
            '<label class="form-label">选择模块</label>' +
            '<div class="module-selector" id="module-selector">' + moduleOptionsHtml + '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">记录类型</label>' +
            '<select class="form-input" id="record-type">' + typeOptionsHtml + '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">记录内容</label>' +
            '<textarea class="form-textarea" id="record-content" placeholder="请输入观察内容..." maxlength="2000">' + Utils.escapeHtml(existingText) + '</textarea>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">标签（逗号分隔）</label>' +
            '<input type="text" class="form-input" id="record-tags" placeholder="如：积极, 专注, 情绪稳定" value="' + Utils.escapeHtml(existingTags) + '">' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">可见性</label>' +
            '<div class="visibility-selector" id="visibility-selector">' + visOptionsHtml + '</div>' +
          '</div>' +
          '<div class="form-error" id="form-error" style="display:none;"></div>' +
          '<button class="btn btn-primary btn-block btn-lg" id="btn-save-record" style="margin-top:16px;">' + (isEdit ? '保存修改' : '添加记录') + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    _bindFormEvents(overlay, youthId, existingRecord);
  }

  /**
   * 绑定表单事件
   */
  function _bindFormEvents(overlay, youthId, existingRecord) {
    var selectedModule = existingRecord ? existingRecord.module : null;
    var selectedVisibility = existingRecord ? existingRecord.visibilityLevel : 'full';

    // 关闭
    overlay.querySelector('#btn-close-form').addEventListener('click', function () {
      document.body.removeChild(overlay);
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    // 模块选择
    var moduleOptions = overlay.querySelectorAll('.module-option');
    for (var i = 0; i < moduleOptions.length; i++) {
      moduleOptions[i].addEventListener('click', function () {
        for (var j = 0; j < moduleOptions.length; j++) {
          moduleOptions[j].classList.remove('selected');
        }
        this.classList.add('selected');
        selectedModule = this.getAttribute('data-module');
      });
    }

    // 可见性选择
    var visOptions = overlay.querySelectorAll('.visibility-option');
    for (var i = 0; i < visOptions.length; i++) {
      visOptions[i].addEventListener('click', function () {
        for (var j = 0; j < visOptions.length; j++) {
          visOptions[j].classList.remove('selected');
        }
        this.classList.add('selected');
        selectedVisibility = this.getAttribute('data-visibility');
      });
    }

    // 保存
    overlay.querySelector('#btn-save-record').addEventListener('click', function () {
      var content = overlay.querySelector('#record-content').value.trim();
      var tagsStr = overlay.querySelector('#record-tags').value.trim();
      var recordType = overlay.querySelector('#record-type').value;
      var errorEl = overlay.querySelector('#form-error');

      if (!selectedModule) {
        errorEl.textContent = '请选择模块';
        errorEl.style.display = 'block';
        return;
      }

      if (!content) {
        errorEl.textContent = '请输入记录内容';
        errorEl.style.display = 'block';
        return;
      }

      // 权限检查
      if (!Permissions.canWrite(selectedModule)) {
        errorEl.textContent = '您没有写入该模块的权限';
        errorEl.style.display = 'block';
        return;
      }

      errorEl.style.display = 'none';

      var tags = tagsStr ? tagsStr.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [];

      var user = AppState.currentUser;
      var now = Utils.formatDateTime();

      if (existingRecord) {
        // 更新
        var updates = {
          module: selectedModule,
          recordType: recordType,
          content: { text: content, tags: tags },
          visibilityLevel: selectedVisibility
        };
        Storage.updateRecord(youthId, existingRecord.id, updates);
        AppState.showToast('记录已更新');
      } else {
        // 新增
        var record = {
          id: Utils.generateUUID(),
          youthId: youthId,
          recorderId: user.id,
          recorderRole: user.role,
          module: selectedModule,
          recordType: recordType,
          content: { text: content, tags: tags },
          visibilityLevel: selectedVisibility,
          recordedAt: now,
          isOffline: !navigator.onLine,
          syncedAt: navigator.onLine ? now : null
        };
        Storage.addRecord(youthId, record);
        AppState.showToast('记录已添加');
      }

      document.body.removeChild(overlay);
      // 重新渲染列表
      var youth = Storage.getProfile(youthId);
      var records = Storage.getRecords(youthId);
      _renderRecordList(youth, records);
    });
  }

  return {
    MODULES: Modules.MODULES,
    RECORD_TYPES: RECORD_TYPES,
    VISIBILITY_LEVELS: VISIBILITY_LEVELS,
    renderRecords: renderRecords
  };
})();
