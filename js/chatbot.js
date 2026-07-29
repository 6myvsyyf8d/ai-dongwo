/**
 * chatbot.js - AI 对话式采集（增强版）
 * 对话引擎 + UI 渲染：双栏布局、AI引导提问、实时归类、语音输入、快捷按钮
 * 暴露 window.ChatBot（向后兼容）和 window.ChatbotEngine
 * 依赖：ChatbotClassifier、ChatbotTemplates、Modules
 */
(function () {
  'use strict';

  // ========== 对话状态 ==========
  var state = {
    conversationId: null,
    youthName: '',
    youthId: null,
    messages: [],
    classifiedItems: [],
    currentQuestionIndex: 0,
    template: null,
    totalRounds: 0,
    maxRounds: 10,
    isRecording: false,
    recognition: null,
    confirmed: false
  };

  // ========== Tab 模式状态（组件内部，不持久化） ==========
  var currentMode = 'chat';

  // ========== 建议问题（兼容旧版） ==========
  var SUGGESTIONS = [
    '今天心情怎么样？',
    '有什么喜欢做的事？',
    '最近有什么变化吗？',
    '有没有什么触发情绪的情况？',
    '今天用药情况如何？',
    '有什么新学会的技能吗？'
  ];

  // ========== 工具函数 ==========
  function formatTime() {
    var now = new Date();
    var h = String(now.getHours()).padStart(2, '0');
    var m = String(now.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ========== Tab 切换栏（iOS 风格分段控件，样式见 chatbot.css） ==========
  function renderTabBar() {
    return '' +
      '<div class="chat-mode-tabs">' +
        '<button type="button" class="chat-mode-tab' + (currentMode === 'chat' ? ' active' : '') + '" data-mode="chat">💬 对话模式</button>' +
        '<button type="button" class="chat-mode-tab' + (currentMode === 'form' ? ' active' : '') + '" data-mode="form">📝 表单模式</button>' +
      '</div>';
  }

  function renderFormPanel() {
    return '<div id="form-mode-panel" style="display:' + (currentMode === 'form' ? 'block' : 'none') + ';padding:24px 16px;">' +
      '<div class="empty-state">' +
        '<div class="empty-state-icon">📝</div>' +
        '<div class="empty-state-title">表单模式开发中</div>' +
        '<div class="empty-state-desc">请使用对话模式进行采集</div>' +
      '</div>' +
    '</div>';
  }

  function bindTabEvents() {
    var tabs = document.querySelectorAll('.chat-mode-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        var mode = this.getAttribute('data-mode');
        if (mode === currentMode) return;
        currentMode = mode;

        // 切换 active 状态（视觉由 CSS .chat-mode-tab.active 控制）
        var allTabs = document.querySelectorAll('.chat-mode-tab');
        for (var j = 0; j < allTabs.length; j++) {
          allTabs[j].classList.toggle('active', allTabs[j].getAttribute('data-mode') === currentMode);
        }

        // 切换面板可见性（表单模式直接打开记录表单）
        var chatPanel = document.getElementById('chat-mode-panel');
        var formPanel = document.getElementById('form-mode-panel');
        if (currentMode === 'form') {
          if (chatPanel) chatPanel.style.display = 'none';
          if (formPanel) formPanel.style.display = 'block';
          // 调用 Records 模块化表单
          if (window.Records && typeof window.Records.showRecordForm === 'function') {
            window.Records.showRecordForm(state.youthId);
          }
        } else {
          if (formPanel) formPanel.style.display = 'none';
          if (chatPanel) chatPanel.style.display = '';
        }
      });
    }
  }

  // ========== 主入口（兼容旧版 ChatBot.renderChat） ==========
  function renderChat(params) {
    var youthId = params.youthId;
    if (!youthId && window.AppState && window.AppState.currentYouth) {
      youthId = window.AppState.currentYouth.id;
    }
    if (!youthId) {
      var accessible = window.Permissions ? window.Permissions.getAccessibleYouths() : [];
      if (accessible.length > 0) {
        youthId = accessible[0].id;
      } else {
        window.location.hash = 'dashboard';
        return;
      }
    }

    var youth = window.Storage ? window.Storage.getProfile(youthId) : null;
    if (!youth) {
      var container = window.App ? window.App.getContainer() : document.getElementById('page-container');
      if (container) {
        container.innerHTML = '<div class="page-content"><div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">档案不存在</div></div></div>';
      }
      return;
    }

    if (window.AppState && (!window.AppState.currentYouth || window.AppState.currentYouth.id !== youthId)) {
      window.AppState.selectYouth(youthId);
    }

    // 检查写入权限
    if (window.Permissions) {
      var canWrite = window.Permissions.canWrite('communicationGuide') ||
        window.Permissions.canWrite('emotionBehavior') ||
        window.Permissions.canWrite('careMedical') ||
        window.Permissions.canWrite('workSupport');
      if (!canWrite) {
        var container = window.App ? window.App.getContainer() : document.getElementById('page-container');
        if (container) {
          container.innerHTML = '<div class="page-content"><div class="permission-denied"><div class="permission-denied-icon">🔒</div><div class="permission-denied-title">无写入权限</div><div class="permission-denied-desc">对话采集需要至少一个模块的写入权限</div></div></div>';
        }
        return;
      }
    }

    // 初始化增强版引擎
    initEngine(youth);
  }

  // ========== 增强版引擎初始化 ==========
  function initEngine(youth) {
    state.youthId = youth.id;
    state.youthName = youth.name || '心青年';
    state.conversationId = 'conv_' + Date.now();
    state.messages = [];
    state.classifiedItems = [];
    state.currentQuestionIndex = 0;
    state.totalRounds = 0;
    state.confirmed = false;

    // 获取模板（优先通过接口层，兼容旧版直接访问）
    var qProvider = (window.ChatbotProviders && window.ChatbotProviders.getQuestionProvider()) || window.ChatbotTemplates;
    var classifier = (window.ChatbotProviders && window.ChatbotProviders.getClassifier()) || window.ChatbotClassifier;
    var hasClassifier = qProvider && classifier;
    state.template = hasClassifier
      ? qProvider.getTemplate(null)
      : { greeting: '你好！我是 AI 助手，可以帮你通过对话记录 ' + state.youthName + ' 的日常信息。', questions: [], maxRounds: 20 };
    state.maxRounds = state.template.maxRounds || 20;

    // 渲染双栏布局
    if (hasClassifier) {
      renderEnhancedLayout(youth);
    } else {
      renderLegacyLayout(youth);
    }
  }

  // ========== 增强版双栏布局 ==========
  function renderEnhancedLayout(youth) {
    var container = window.App ? window.App.getContainer() : document.getElementById('page-container');
    if (!container) return;

    container.innerHTML =
      '<div class="page-header">' +
        '<button class="btn btn-sm btn-secondary" id="btn-back">← 返回</button>' +
        '<span class="page-title">' + escapeHtml(youth.name) + ' · 对话采集</span>' +
        '<span></span>' +
      '</div>' +
      renderTabBar() +
      '<div id="chat-mode-panel">' +
      '<div class="chat-layout">' +
        '<div class="chat-panel-col">' +
          '<div class="chat-messages" id="chat-messages"></div>' +
          '<div class="chat-quick-buttons" id="chat-quick-buttons"></div>' +
          '<div class="chat-input-area">' +
            '<button class="chat-voice-btn" id="chat-voice-btn" title="按住说话">🎤</button>' +
            '<textarea class="chat-input" id="chat-input" placeholder="打字或按住说话..." rows="1"></textarea>' +
            '<button class="chat-send-btn" id="chat-send-btn" aria-label="发送">➤</button>' +
          '</div>' +
        '</div>' +
        '<div class="categorize-panel">' +
          '<div class="categorize-panel-header">📋 实时归类</div>' +
          '<div class="categorize-list" id="categorize-list">' +
            '<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">对话开始后，AI 将实时归类采集到的信息</div></div>' +
          '</div>' +
          '<div class="categorize-confirm">' +
            '<button id="btn-confirm-record" disabled>✓ 确认以上记录</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '</div>' +
      renderFormPanel();

    bindEnhancedEvents();
    bindTabEvents();
    renderQuickButtons();

    // 发送开场白
    addAIMessage(state.template.greeting, 300);
    if (state.template.questions && state.template.questions.length > 0) {
      setTimeout(function () { askNextQuestion(); }, 800);
    }
  }

  // ========== 旧版兼容布局（无 classifier 时） ==========
  function renderLegacyLayout(youth) {
    var container = window.App ? window.App.getContainer() : document.getElementById('page-container');
    if (!container) return;

    container.innerHTML =
      '<div class="page-header">' +
        '<button class="btn btn-sm btn-secondary" id="btn-back">← 返回</button>' +
        '<span class="page-title">' + escapeHtml(youth.name) + ' · 对话采集</span>' +
        '<span></span>' +
      '</div>' +
      renderTabBar() +
      '<div id="chat-mode-panel">' +
      '<div class="chat-page">' +
        '<div class="chat-messages" id="chat-messages"></div>' +
        '<div class="chat-suggestions" id="chat-suggestions">' +
          SUGGESTIONS.map(function (s) {
            return '<div class="chat-suggestion-chip" data-suggestion="' + escapeHtml(s) + '">' + s + '</div>';
          }).join('') +
        '</div>' +
        '<div class="chat-input-area">' +
          '<textarea class="chat-input" id="chat-input" placeholder="输入消息..." rows="1"></textarea>' +
          '<button class="chat-send-btn" id="btn-send" aria-label="发送消息">➤</button>' +
        '</div>' +
      '</div>' +
      '</div>' +
      renderFormPanel();

    bindLegacyEvents();
    bindTabEvents();
    addAIMessage('你好！我是 AI 助手，可以帮你通过对话记录 ' + state.youthName + ' 的日常信息。你可以告诉我今天发生了什么，或者从下方建议问题开始。', 0);
  }

  // ========== 增强版事件绑定 ==========
  function bindEnhancedEvents() {
    var backBtn = document.getElementById('btn-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        window.location.hash = 'profile?youthId=' + encodeURIComponent(state.youthId);
      });
    }

    var input = document.getElementById('chat-input');
    var sendBtn = document.getElementById('chat-send-btn');

    if (input) {
      input.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        if (sendBtn) sendBtn.disabled = !this.value.trim();
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleUserInput(input.value);
          input.value = '';
          input.style.height = 'auto';
          if (sendBtn) sendBtn.disabled = true;
        }
      });
    }

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.addEventListener('click', function () {
        if (!input) return;
        handleUserInput(input.value);
        input.value = '';
        input.style.height = 'auto';
        sendBtn.disabled = true;
      });
    }

    var confirmBtn = document.getElementById('btn-confirm-record');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', confirmAndSave);
    }

    bindVoiceEvents();
  }

  // ========== 旧版事件绑定 ==========
  function bindLegacyEvents() {
    var backBtn = document.getElementById('btn-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        window.location.hash = 'profile?youthId=' + encodeURIComponent(state.youthId);
      });
    }

    var input = document.getElementById('chat-input');
    var sendBtn = document.getElementById('btn-send');

    if (input) {
      input.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        if (sendBtn) sendBtn.disabled = !this.value.trim();
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleLegacySend();
        }
      });
    }

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.addEventListener('click', handleLegacySend);
    }

    var chips = document.querySelectorAll('.chat-suggestion-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].addEventListener('click', function () {
        if (!input) return;
        input.value = this.getAttribute('data-suggestion');
        input.dispatchEvent(new Event('input'));
        handleLegacySend();
      });
    }
  }

  // ========== 消息渲染 ==========
  function addAIMessage(text, delay) {
    delay = delay || 0;
    setTimeout(function () {
      var chatMessages = document.getElementById('chat-messages');
      if (!chatMessages) return;
      var bubble = document.createElement('div');
      bubble.className = 'chat-bubble chat-bubble-bot';
      bubble.innerHTML = escapeHtml(text).replace(/\n/g, '<br>') + '<div style="font-size:0.68rem;opacity:0.5;margin-top:4px;text-align:right;">' + formatTime() + '</div>';
      chatMessages.appendChild(bubble);
      scrollToBottom();
      state.messages.push({ role: 'ai', text: text, time: new Date().toISOString() });
    }, delay);
  }

  function addUserMessage(text) {
    var chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-user';
    bubble.textContent = text;
    chatMessages.appendChild(bubble);
    scrollToBottom();
    state.messages.push({ role: 'user', text: text, time: new Date().toISOString() });
  }

  function addSkipButton(questionId) {
    var chatMessages = document.getElementById('chat-messages');
    if (!chatMessages || !state.template) return;
    var question = state.template.questions[state.currentQuestionIndex - 1];
    if (!question) return;
    var skipBtn = document.createElement('div');
    skipBtn.className = 'chat-skip-btn';
    skipBtn.textContent = question.skipText || '跳过';
    skipBtn.onclick = function () {
      skipBtn.remove();
      askNextQuestion();
    };
    chatMessages.appendChild(skipBtn);
    scrollToBottom();
  }

  function showTyping() {
    var chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    var indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    chatMessages.appendChild(indicator);
    scrollToBottom();
  }

  function hideTyping() {
    var el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  function scrollToBottom() {
    var chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
      setTimeout(function () {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }, 50);
    }
  }

  // ========== 提问逻辑 ==========
  function askNextQuestion() {
    if (!state.template || !state.template.questions) return;
    if (state.totalRounds >= state.maxRounds) {
      endConversation();
      return;
    }

    var questions = state.template.questions;
    if (state.currentQuestionIndex >= questions.length) {
      endConversation();
      return;
    }

    var question = questions[state.currentQuestionIndex];
    state.currentQuestionIndex++;
    state.totalRounds++;

    showTyping();
    setTimeout(function () {
      hideTyping();
      var qText = typeof question.text === 'function'
        ? question.text(state.youthName)
        : question.text;
      addAIMessage(qText);
      addSkipButton(question.id);
    }, 600 + Math.random() * 500);
  }

  function endConversation() {
    showTyping();
    setTimeout(function () {
      hideTyping();
      var count = state.classifiedItems.length;
      if (count > 0) {
        addAIMessage('好的，我已经帮你整理了以上 ' + count + ' 条记录。请确认右侧的归类结果，然后点击「确认以上记录」保存。');
      } else {
        addAIMessage('今天还没记录什么。下次有需要的时候随时找我聊~');
      }
    }, 600);
  }

  // ========== 用户输入处理 ==========
  function handleUserInput(text) {
    if (!text.trim()) return;
    if (state.confirmed) return;

    addUserMessage(text.trim());

    if (window.ChatbotClassifier) {
      var classifier = (window.ChatbotProviders && window.ChatbotProviders.getClassifier()) || window.ChatbotClassifier;
      var results = classifier.classify(text.trim());
      var validResults = results.filter(function (r) { return r.module !== null; });

      for (var i = 0; i < validResults.length; i++) {
        var r = validResults[i];
        var tempId = 'item_' + Date.now() + '_' + i;
        state.classifiedItems.push({
          sentence: r.sentence,
          module: r.module,
          confidence: r.confidence,
          tempId: tempId
        });
        renderClassifiedItem(r.sentence, r.module, r.confidence, tempId);
      }
      updateConfirmButton();
    }

    // 继续下一个问题
    if (state.template && state.template.questions && state.template.questions.length > 0) {
      setTimeout(function () { askNextQuestion(); }, 500);
    }
  }

  function handleQuickButton(btnData) {
    if (state.confirmed) return;
    addUserMessage(btnData.text);
    var tempId = 'item_' + Date.now() + '_q';
    state.classifiedItems.push({
      sentence: btnData.text,
      module: btnData.module,
      confidence: 1.0,
      tempId: tempId
    });
    renderClassifiedItem(btnData.text, btnData.module, 1.0, tempId);
    updateConfirmButton();
    if (state.template && state.template.questions && state.template.questions.length > 0) {
      setTimeout(function () { askNextQuestion(); }, 400);
    }
  }

  // ========== 旧版发送处理 ==========
  function handleLegacySend() {
    var input = document.getElementById('chat-input');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;

    addUserMessage(text);
    input.value = '';
    input.style.height = 'auto';
    var sendBtn = document.getElementById('btn-send');
    if (sendBtn) sendBtn.disabled = true;

    showTyping();
    setTimeout(function () {
      hideTyping();
      processLegacyMessage(text);
    }, 600 + Math.random() * 400);
  }

  var _pendingClassification = null;

  function processLegacyMessage(text) {
    if (_pendingClassification) {
      handleLegacyConfirm(text);
      return;
    }

    var classification = classifyText(text);
    if (classification.module) {
      _pendingClassification = { text: text, module: classification.module, tags: classification.tags };
      addAIMessage('我理解这段信息属于「' + (window.Modules ? window.Modules.MODULE_LABELS[classification.module] : classification.module) + '」模块。\n\n是否要将其保存为一条记录？', 0);
    } else {
      _pendingClassification = { text: text, module: null, tags: [] };
      addAIMessage('我不太确定这段信息属于哪个模块，请帮我选择一个：', 0);
    }
  }

  function classifyText(text) {
    var scores = {};
    var tags = [];
    var keywords = window.Modules ? window.Modules.MODULE_KEYWORDS : {};

    for (var mod in keywords) {
      if (!keywords.hasOwnProperty(mod)) continue;
      scores[mod] = 0;
      var kws = keywords[mod];
      for (var i = 0; i < kws.length; i++) {
        if (text.indexOf(kws[i]) > -1) {
          scores[mod]++;
          tags.push(kws[i]);
        }
      }
    }

    var bestModule = null;
    var bestScore = 0;
    for (var m in scores) {
      if (scores[m] > bestScore) {
        bestScore = scores[m];
        bestModule = m;
      }
    }

    var uniqueTags = [];
    for (var j = 0; j < tags.length; j++) {
      if (uniqueTags.indexOf(tags[j]) === -1) uniqueTags.push(tags[j]);
    }

    return { module: bestScore > 0 ? bestModule : null, tags: uniqueTags.slice(0, 5) };
  }

  function handleLegacyConfirm(userResponse) {
    if (_pendingClassification.module && (userResponse.indexOf('是') > -1 || userResponse.indexOf('好') > -1 || userResponse.indexOf('保存') > -1)) {
      saveLegacyRecord();
      return;
    }
    if (userResponse.indexOf('不') > -1 || userResponse.indexOf('取消') > -1) {
      _pendingClassification = null;
      addAIMessage('好的，已取消保存。你可以继续告诉我更多信息。', 0);
      return;
    }
    _pendingClassification = null;
    addAIMessage('好的，我们继续。你可以告诉我更多关于今天的情况。', 0);
  }

  function saveLegacyRecord() {
    if (!_pendingClassification || !_pendingClassification.module) return;

    if (window.Permissions && !window.Permissions.canWrite(_pendingClassification.module)) {
      addAIMessage('抱歉，你没有写入该模块的权限。', 0);
      _pendingClassification = null;
      return;
    }

    var user = window.AppState ? window.AppState.currentUser : null;
    var now = window.Utils ? window.Utils.formatDateTime() : new Date().toISOString();

    var record = {
      id: window.Utils ? window.Utils.generateUUID() : 'rec_' + Date.now(),
      youthId: state.youthId,
      recorderId: user ? user.id : 'unknown',
      recorderRole: user ? user.role : 'unknown',
      module: _pendingClassification.module,
      recordType: 'chatbot_captured',
      content: { text: _pendingClassification.text, tags: _pendingClassification.tags },
      visibilityLevel: 'full',
      recordedAt: now,
      isOffline: !navigator.onLine,
      syncedAt: navigator.onLine ? now : null
    };

    if (window.Storage && window.Storage.addRecord) {
      window.Storage.addRecord(state.youthId, record);
    }
    addAIMessage('✅ 已保存到「' + (window.Modules ? window.Modules.MODULE_LABELS[_pendingClassification.module] : _pendingClassification.module) + '」模块。', 0);
    _pendingClassification = null;
  }

  // ========== 归类面板渲染 ==========
  function renderClassifiedItem(sentence, module, confidence, tempId) {
    var categorizeList = document.getElementById('categorize-list');
    if (!categorizeList) return;

    var emptyState = categorizeList.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    var item = document.createElement('div');
    item.className = 'categorize-item' + (confidence < 0.1 ? ' uncertain' : '');
    item.dataset.tempId = tempId;

    var classifier = (window.ChatbotProviders && window.ChatbotProviders.getClassifier()) || window.ChatbotClassifier;
    var modName = classifier ? classifier.getModuleName(module) : module;
    var modIcon = classifier ? classifier.getModuleIcon(module) : '📝';

    item.innerHTML =
      '<div class="ci-module">' + modIcon + ' ' + modName + '</div>' +
      '<div class="ci-text">' + escapeHtml(sentence) + '</div>' +
      (confidence < 0.5 ? '<div class="ci-confidence">置信度: ' + Math.round(confidence * 100) + '% — 点击可修改分类</div>' : '');

    item.onclick = function () {
      showModulePicker(item, tempId);
    };

    categorizeList.appendChild(item);
  }

  function showModulePicker(itemEl, tempId) {
    var existingPicker = itemEl.querySelector('.module-picker');
    if (existingPicker) {
      existingPicker.remove();
      return;
    }

    var modules = [
      { key: 'communicationGuide', name: '沟通说明书', icon: '💬' },
      { key: 'emotionBehavior', name: '情绪与行为', icon: '🌊' },
      { key: 'careMedical', name: '照护与医疗', icon: '💊' },
      { key: 'workSupport', name: '工作与生活', icon: '💼' },
      { key: 'relationshipMap', name: '关系地图', icon: '🗺️' }
    ];

    var picker = document.createElement('div');
    picker.className = 'module-picker';

    modules.forEach(function (m) {
      var btn = document.createElement('button');
      btn.className = 'module-picker-btn';
      btn.textContent = m.icon + ' ' + m.name;
      btn.onclick = function (e) {
        e.stopPropagation();
        var item = state.classifiedItems.find(function (i) { return i.tempId === tempId; });
        if (item) {
          item.module = m.key;
          item.confidence = 1.0;
        }
        itemEl.querySelector('.ci-module').innerHTML = m.icon + ' ' + m.name;
        itemEl.classList.remove('uncertain');
        var confEl = itemEl.querySelector('.ci-confidence');
        if (confEl) confEl.remove();
        picker.remove();
      };
      picker.appendChild(btn);
    });

    itemEl.appendChild(picker);
  }

  function updateConfirmButton() {
    var confirmBtn = document.getElementById('btn-confirm-record');
    if (confirmBtn) {
      confirmBtn.disabled = state.classifiedItems.length === 0;
      confirmBtn.textContent = '✓ 确认以上记录（' + state.classifiedItems.length + ' 条）';
    }
  }

  // ========== 确认保存 ==========
  function confirmAndSave() {
    if (state.confirmed) return;
    if (state.classifiedItems.length === 0) return;

    state.confirmed = true;

    var user = window.AppState ? window.AppState.currentUser : null;
    var now = window.Utils ? window.Utils.formatDateTime() : new Date().toISOString();

    for (var i = 0; i < state.classifiedItems.length; i++) {
      var item = state.classifiedItems[i];
      if (!item.module) continue;

      var record = {
        id: window.Utils ? window.Utils.generateUUID() : 'rec_' + Date.now() + '_' + i,
        youthId: state.youthId,
        recorderId: user ? user.id : 'unknown',
        recorderRole: user ? user.role : 'unknown',
        module: item.module,
        recordType: 'chatbot_captured',
        content: { text: item.sentence },
        classificationConfidence: item.confidence,
        conversationId: state.conversationId,
        visibilityLevel: 'full',
        recordedAt: now,
        isOffline: !navigator.onLine,
        syncedAt: navigator.onLine ? now : null
      };

      if (window.Storage && window.Storage.addRecord) {
        window.Storage.addRecord(state.youthId, record);
      }
    }

    // 禁用输入
    var inputEl = document.getElementById('chat-input');
    var sendBtn = document.getElementById('chat-send-btn');
    var confirmBtn = document.getElementById('btn-confirm-record');
    if (inputEl) inputEl.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = '✓ 已保存';
      confirmBtn.style.background = 'var(--color-success)';
    }

    addAIMessage('记录已保存！你可以在档案页看到这些记录。');
  }

  // ========== 快捷按钮 ==========
  function renderQuickButtons() {
    var area = document.getElementById('chat-quick-buttons');
    var qProvider = (window.ChatbotProviders && window.ChatbotProviders.getQuestionProvider()) || window.ChatbotTemplates;
    if (!area || !qProvider) return;
    area.innerHTML = '';
    var buttons = qProvider.getQuickButtons();
    buttons.forEach(function (btn) {
      var el = document.createElement('button');
      el.className = 'chat-quick-btn';
      el.textContent = btn.label;
      el.onclick = function () { handleQuickButton(btn); };
      area.appendChild(el);
    });
  }

  // ========== 语音输入 ==========
  function bindVoiceEvents() {
    var voiceBtn = document.getElementById('chat-voice-btn');
    if (!voiceBtn) return;

    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      voiceBtn.style.display = 'none';
      return;
    }

    voiceBtn.addEventListener('mousedown', function () { startRecording(voiceBtn, SpeechRecognition); });
    voiceBtn.addEventListener('mouseup', function () { stopRecording(voiceBtn); });
    voiceBtn.addEventListener('mouseleave', function () { if (state.isRecording) stopRecording(voiceBtn); });

    voiceBtn.addEventListener('touchstart', function (e) {
      e.preventDefault();
      startRecording(voiceBtn, SpeechRecognition);
    });
    voiceBtn.addEventListener('touchend', function (e) {
      e.preventDefault();
      stopRecording(voiceBtn);
    });
  }

  function startRecording(voiceBtn, SpeechRecognition) {
    if (state.isRecording) return;
    state.isRecording = true;
    voiceBtn.classList.add('recording');
    voiceBtn.textContent = '🔴';

    var recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = function (event) {
      var text = event.results[0][0].transcript;
      handleUserInput(text);
    };

    recognition.onerror = function () { stopRecording(voiceBtn); };
    recognition.onend = function () { stopRecording(voiceBtn); };

    state.recognition = recognition;
    recognition.start();
  }

  function stopRecording(voiceBtn) {
    if (!state.isRecording) return;
    state.isRecording = false;
    voiceBtn.classList.remove('recording');
    voiceBtn.textContent = '🎤';
    if (state.recognition) {
      state.recognition.stop();
      state.recognition = null;
    }
  }

  // ========== 暴露全局接口 ==========
  window.ChatBot = {
    renderChat: renderChat
  };

  window.ChatbotEngine = {
    init: initEngine,
    handleUserInput: handleUserInput,
    confirmAndSave: confirmAndSave,
    getState: function () { return state; }
  };
})();