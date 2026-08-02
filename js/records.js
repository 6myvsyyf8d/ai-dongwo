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

    _renderRecordList(youth);
  }

  /**
   * 渲染权限不足提示
   */
  function _renderPermissionDenied() {
    App.getContainer().innerHTML =
      '<div class="page-header">' +
        '<button class="btn-back" id="btn-back">‹</button>' +
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
   * 渲染记录页 — 矩阵导航（主视图）+ 近期记录列表
   * 按 record-matrix-form-design.md 规范
   */
  function _renderRecordList(youth) {
    var container = App.getContainer();

    // === 两级快速记录选择器 ===
    var matrix = window.Constants ? window.Constants.RECORD_MATRIX : {};
    var matrixModules = Modules.MODULES.filter(function (m) { return matrix.hasOwnProperty(m.key); });

    // 默认选中第一个模块
    var defaultModule = matrixModules.length > 0 ? matrixModules[0] : null;

    // 模块选择行
    var moduleRowHtml = '<div class="quick-module-row">';
    for (var r = 0; r < matrixModules.length; r++) {
      var mod = matrixModules[r];
      var isActive = mod.key === (defaultModule ? defaultModule.key : '');
      moduleRowHtml += '<button class="quick-module-chip' + (isActive ? ' active' : '') + '" data-module="' + mod.key + '">' +
        '<span class="quick-module-icon">' + mod.icon + '</span>' +
        '<span class="quick-module-label">' + mod.shortLabel + '</span>' +
      '</button>';
    }
    moduleRowHtml += '</div>';

    // 类型选择行（初始显示默认模块的类型）
    var typeRowHtml = '<div class="quick-type-row" id="quick-type-row">';
    if (defaultModule) {
      var validTypes = matrix[defaultModule.key] || [];
      typeRowHtml += _renderTypeChips(validTypes, defaultModule);
    }
    typeRowHtml += '</div>';

    var matrixHtml = '<div class="ios-card-group" style="margin-bottom:12px;">' +
      '<div class="ios-card-group-header">📝 快速记录</div>' +
      '<div class="quick-record-picker">' +
        moduleRowHtml +
        typeRowHtml +
      '</div>' +
      '<div style="font-size:11px;color:var(--color-text-tertiary);text-align:center;padding:6px 0 2px;">先选模块，再点类型快速记录</div>' +
    '</div>';

    // === 对话采集入口 ===
    var chatEntryHtml =
      '<div class="ios-card-group" style="margin-bottom:12px;">' +
        '<div class="ios-card-row" data-action="chat" style="cursor:pointer;">' +
          '<div class="ios-card-row-icon" style="font-size:24px;background:rgba(139,168,136,0.12);border-radius:12px;">💬</div>' +
          '<div class="ios-card-row-body">' +
            '<div class="ios-card-row-title">对话采集</div>' +
            '<div class="ios-card-row-subtitle">AI 对话式记录，边聊边记</div>' +
          '</div>' +
          '<span class="ios-card-row-arrow">›</span>' +
        '</div>' +
      '</div>';

    container.innerHTML =
      '<div class="page-header">' +
        '<span></span>' +
        '<span class="page-title">记录</span>' +
        '<span></span>' +
      '</div>' +
      '<div class="page-content">' +
        matrixHtml +
        chatEntryHtml +
      '</div>';

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
    // 模块切换
    var moduleChips = document.querySelectorAll('.quick-module-chip');
    for (var mi = 0; mi < moduleChips.length; mi++) {
      moduleChips[mi].addEventListener('click', function () {
        var mk = this.getAttribute('data-module');
        // 更新 active 状态
        for (var mj = 0; mj < moduleChips.length; mj++) {
          moduleChips[mj].classList.remove('active');
        }
        this.classList.add('active');
        // 更新类型行
        _updateTypeRow(mk, youthId);
      });
    }

    // 类型 chip 点击 → 打开底部 Sheet 表单
    _bindTypeChips(youthId);

    // 对话采集入口跳转
    var chatEntry = document.querySelector('[data-action="chat"]');
    if (chatEntry) {
      chatEntry.addEventListener('click', function () {
        window.location.hash = 'chat';
      });
    }
  }

  /**
   * 渲染类型 chip 行
   */
  function _renderTypeChips(validTypes, mod) {
    var html = '';
    for (var c = 0; c < RECORD_TYPES.length; c++) {
      if (validTypes.indexOf(RECORD_TYPES[c].value) > -1) {
        html += '<button class="quick-type-chip" data-module="' + mod.key +
          '" data-module-label="' + Utils.escapeHtml(mod.label) +
          '" data-type="' + RECORD_TYPES[c].value +
          '" data-type-label="' + Utils.escapeHtml(RECORD_TYPES[c].label) + '">' +
          '<span class="quick-type-icon">' + RECORD_TYPES[c].icon + '</span>' +
          '<span class="quick-type-text">' + RECORD_TYPES[c].label + '</span>' +
        '</button>';
      }
    }
    return html;
  }

  /**
   * 更新类型行（模块切换时）
   */
  function _updateTypeRow(moduleKey, youthId) {
    var typeRow = document.getElementById('quick-type-row');
    if (!typeRow) return;
    var matrix = window.Constants ? window.Constants.RECORD_MATRIX : {};
    var mod = Modules.MODULES.find(function (m) { return m.key === moduleKey; });
    if (!mod) return;
    var validTypes = matrix[moduleKey] || [];
    typeRow.innerHTML = _renderTypeChips(validTypes, mod);
    _bindTypeChips(youthId);
  }

  /**
   * 绑定类型 chip 点击事件
   */
  function _bindTypeChips(youthId) {
    var typeChips = document.querySelectorAll('.quick-type-chip');
    for (var ti = 0; ti < typeChips.length; ti++) {
      typeChips[ti].addEventListener('click', function () {
        var mk = this.getAttribute('data-module');
        var ml = this.getAttribute('data-module-label');
        var tt = this.getAttribute('data-type');
        var tl = this.getAttribute('data-type-label');
        openMatrixForm(mk, tt, ml, tl, youthId);
      });
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

  /**
   * 矩阵表单 — 底部弹出 sheet（语音/打字 + 快捷标签）
   * @param {string} moduleKey - 模块 key
   * @param {string} recordType - 记录类型 value
   * @param {string} moduleLabel - 模块中文标签
   * @param {string} typeLabel - 类型中文标签
   * @param {string} youthId - 心青年 ID
   */
  function openMatrixForm(moduleKey, recordType, moduleLabel, typeLabel, youthId) {
    // 权限检查
    if (!Permissions.canWrite(moduleKey)) {
      AppState.showToast('您没有写入该模块的权限');
      return;
    }

    // 移除已有弹层
    var existing = document.getElementById('matrix-form-overlay');
    if (existing) existing.parentNode.removeChild(existing);

    var overlay = document.createElement('div');
    overlay.className = 'matrix-form-overlay';
    overlay.id = 'matrix-form-overlay';

    overlay.innerHTML =
      '<div class="matrix-form-sheet">' +
        '<div class="matrix-sheet-handle"></div>' +
        '<div class="matrix-sheet-header">' +
          '<div class="matrix-sheet-context">' +
            '<span class="matrix-module-tag">' + Utils.escapeHtml(moduleLabel) + '</span>' +
            '<span class="matrix-type-tag">' + Utils.escapeHtml(typeLabel) + '</span>' +
          '</div>' +
          '<button class="matrix-sheet-close" id="matrix-btn-close">✕</button>' +
        '</div>' +
        '<div class="matrix-sheet-body">' +
          '<div class="matrix-input-tabs">' +
            '<button class="matrix-input-tab active" data-mode="voice">🎤 语音</button>' +
            '<button class="matrix-input-tab" data-mode="write">✍️ 打字/手写</button>' +
          '</div>' +
          '<div class="matrix-voice-panel active" id="matrix-voice-panel">' +
            '<button class="matrix-voice-btn" id="matrix-voice-btn">🎤</button>' +
            '<div class="matrix-voice-hint" id="matrix-voice-hint">点击开始录音</div>' +
            '<div class="matrix-voice-result" id="matrix-voice-result"></div>' +
          '</div>' +
          '<div class="matrix-write-panel" id="matrix-write-panel">' +
            '<textarea class="matrix-write-area" id="matrix-write-area" placeholder="描述观察到的具体情况…" maxlength="500"></textarea>' +
            '<div class="matrix-char-count"><span id="matrix-char-count">0</span>/500</div>' +
          '</div>' +
          '<div class="matrix-section-label">快捷标签</div>' +
          '<div class="matrix-quick-tags" id="matrix-quick-tags"></div>' +
          '<div class="matrix-form-error" id="matrix-form-error" style="display:none;"></div>' +
          '<button class="matrix-btn-submit" id="matrix-btn-submit">📝 提交记录</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    // 触发动画
    requestAnimationFrame(function() {
      overlay.classList.add('show');
    });

    _bindMatrixFormEvents(overlay, moduleKey, recordType, moduleLabel, typeLabel, youthId);
  }

  function _bindMatrixFormEvents(overlay, moduleKey, recordType, moduleLabel, typeLabel, youthId) {
    var state = {
      inputMode: 'voice',
      voiceText: '',
      writeText: '',
      tags: [],
      isRecording: false,
      recognition: null
    };

    // 关闭
    function closeSheet() {
      overlay.classList.remove('show');
      setTimeout(function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 300);
    }

    overlay.querySelector('#matrix-btn-close').addEventListener('click', closeSheet);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeSheet();
    });

    // 输入方式切换
    var tabs = overlay.querySelectorAll('.matrix-input-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function() {
        for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
        this.classList.add('active');
        state.inputMode = this.getAttribute('data-mode');
        overlay.querySelector('#matrix-voice-panel').classList.toggle('active', state.inputMode === 'voice');
        overlay.querySelector('#matrix-write-panel').classList.toggle('active', state.inputMode === 'write');
      });
    }

    // 快捷标签渲染
    var moduleTags = (window.Constants && window.Constants.MODULE_TAGS) || {};
    var tags = moduleTags[moduleKey] || [];
    var tagsContainer = overlay.querySelector('#matrix-quick-tags');
    tagsContainer.innerHTML = '';
    for (var ti = 0; ti < tags.length; ti++) {
      (function(tagText) {
        var span = document.createElement('span');
        span.className = 'matrix-quick-tag';
        span.setAttribute('data-tag', tagText);
        span.textContent = tagText;
        span.addEventListener('click', function() {
          if (this.classList.contains('selected')) {
            this.classList.remove('selected');
            state.tags = state.tags.filter(function(x) { return x !== tagText; });
          } else {
            this.classList.add('selected');
            state.tags.push(tagText);
          }
        });
        tagsContainer.appendChild(span);
      })(tags[ti]);
    }

    // 语音输入
    var voiceBtn = overlay.querySelector('#matrix-voice-btn');
    var voiceHint = overlay.querySelector('#matrix-voice-hint');
    var voiceResult = overlay.querySelector('#matrix-voice-result');
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      voiceBtn.disabled = true;
      voiceBtn.style.opacity = '0.4';
      voiceBtn.style.cursor = 'not-allowed';
      voiceHint.textContent = '当前浏览器不支持语音输入，请使用打字';
    } else {
      voiceBtn.addEventListener('click', function() {
        if (state.isRecording) {
          // 停止录音
          if (state.recognition) state.recognition.stop();
          return;
        }
        state.isRecording = true;
        voiceBtn.classList.add('recording');
        voiceBtn.textContent = '⏹';
        voiceHint.textContent = '正在录音…点击停止';
        voiceResult.classList.remove('show');

        var recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = function(event) {
          var text = event.results[0][0].transcript;
          state.voiceText = text;
          voiceResult.textContent = text;
          voiceResult.classList.add('show');
          voiceHint.textContent = '点击重新录音';
        };

        recognition.onerror = function() {
          voiceHint.textContent = '录音失败，请重试或使用打字';
        };

        recognition.onend = function() {
          state.isRecording = false;
          voiceBtn.classList.remove('recording');
          voiceBtn.textContent = '🎤';
          if (!state.voiceText) {
            voiceHint.textContent = '点击开始录音';
          }
        };

        state.recognition = recognition;
        recognition.start();
      });
    }

    // 打字输入
    var writeArea = overlay.querySelector('#matrix-write-area');
    var charCount = overlay.querySelector('#matrix-char-count');
    writeArea.addEventListener('input', function() {
      state.writeText = this.value;
      charCount.textContent = this.value.length;
    });

    // 提交
    var errorEl = overlay.querySelector('#matrix-form-error');
    overlay.querySelector('#matrix-btn-submit').addEventListener('click', function() {
      var content = state.inputMode === 'voice' ? state.voiceText : state.writeText;
      content = (content || '').trim();

      if (!content) {
        errorEl.textContent = '请输入记录内容';
        errorEl.style.display = 'block';
        return;
      }
      errorEl.style.display = 'none';

      var user = AppState.currentUser;
      var now = Utils.formatDateTime();

      var record = {
        id: Utils.generateUUID(),
        youthId: youthId,
        recorderId: user.id,
        recorderRole: user.role,
        module: moduleKey,
        recordType: recordType,
        content: { text: content, tags: state.tags.slice() },
        inputMode: state.inputMode,
        visibilityLevel: 'full',
        recordedAt: now,
        isOffline: !navigator.onLine,
        syncedAt: navigator.onLine ? now : null
      };

      Storage.addRecord(youthId, record);
      AppState.showToast('✅ 已提交「' + moduleLabel + '·' + typeLabel + '」');

      closeSheet();

      // 刷新记录列表
      var youth = Storage.getProfile(youthId);
      var records = Storage.getRecords(youthId);
      _renderRecordList(youth, records);
    });
  }

  /**
   * 按模块查询记录
   * @param {string} youthId
   * @param {string} moduleKey
   * @returns {Array}
   */
  function queryByModule(youthId, moduleKey) {
    var records = Storage.getRecords(youthId);
    return (records || []).filter(function (r) { return r.module === moduleKey; });
  }

  /**
   * 按时间范围查询记录
   * @param {string} youthId
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @returns {Array}
   */
  function queryByDateRange(youthId, startDate, endDate) {
    var records = Storage.getRecords(youthId);
    return (records || []).filter(function (r) {
      var dateStr = (r.recordedAt || '').substring(0, 10);
      return dateStr >= startDate && dateStr <= endDate;
    });
  }

  /**
   * 按标签查询记录
   * @param {string} youthId
   * @param {string} tag
   * @returns {Array}
   */
  function queryByTag(youthId, tag) {
    var records = Storage.getRecords(youthId);
    return (records || []).filter(function (r) {
      return r.content && r.content.tags && r.content.tags.indexOf(tag) > -1;
    });
  }

  /**
   * 按模块和时间组合查询
   * @param {string} youthId
   * @param {string} moduleKey
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @returns {Array}
   */
  function queryByModuleAndDate(youthId, moduleKey, startDate, endDate) {
    var records = Storage.getRecords(youthId);
    return (records || []).filter(function (r) {
      var dateStr = (r.recordedAt || '').substring(0, 10);
      return r.module === moduleKey && dateStr >= startDate && dateStr <= endDate;
    });
  }

  /**
   * 获取某模块的最近 N 条记录
   * @param {string} youthId
   * @param {string} moduleKey
   * @param {number} limit
   * @returns {Array}
   */
  function queryRecentByModule(youthId, moduleKey, limit) {
    var records = queryByModule(youthId, moduleKey);
    if (!limit) limit = 5;
    return records.slice(0, limit);
  }

  return {
    MODULES: Modules.MODULES,
    RECORD_TYPES: RECORD_TYPES,
    VISIBILITY_LEVELS: VISIBILITY_LEVELS,
    renderRecords: renderRecords,
    showRecordForm: _showRecordForm,
    openMatrixForm: openMatrixForm,
    queryByModule: queryByModule,
    queryByDateRange: queryByDateRange,
    queryByTag: queryByTag,
    queryByModuleAndDate: queryByModuleAndDate,
    queryRecentByModule: queryRecentByModule
  };
})();
