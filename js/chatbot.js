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
    confirmed: false
  };

  // ========== Tab 模式状态（组件内部，不持久化） ==========
  var currentMode = 'chat';

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

  /**
   * 将内部 state.messages 转为智谱 API 要求的格式
   * 内部格式: { role: 'ai'/'user', text, time }
   * API 格式:  { role: 'assistant'/'user', content }
   */
  function _toApiMessages(messages) {
    return messages.map(function (msg) {
      return {
        role: msg.role === 'ai' ? 'assistant' : msg.role,
        content: msg.text
      };
    });
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
    var matrix = window.Constants ? window.Constants.RECORD_MATRIX : {};
    var types = (window.Records && window.Records.RECORD_TYPES) || [];
    var modules = (window.Modules && window.Modules.MODULES) || [];
    // 仅显示矩阵中定义的模块（排除 relationshipMap）
    var matrixModules = modules.filter(function(m) { return matrix.hasOwnProperty(m.key); });

    var html = '<div id="form-mode-panel" style="display:' + (currentMode === 'form' ? 'block' : 'none') + ';padding:12px 16px;">';
    html += '<div class="matrix-wrap">';
    html += '<table class="matrix-table">';
    // 表头
    html += '<tr><th class="matrix-corner">模块 \\ 类型</th>';
    for (var t = 0; t < types.length; t++) {
      html += '<th class="matrix-col-header">' + types[t].icon + ' ' + types[t].label + '</th>';
    }
    html += '</tr>';
    // 行
    for (var r = 0; r < matrixModules.length; r++) {
      var mod = matrixModules[r];
      var validTypes = matrix[mod.key] || [];
      html += '<tr><th class="matrix-row-label">' + mod.icon + ' ' + mod.shortLabel + '</th>';
      for (var c = 0; c < types.length; c++) {
        if (validTypes.indexOf(types[c].value) > -1) {
          html += '<td class="matrix-cell-nav" data-module="' + mod.key + '" data-module-label="' + escapeHtml(mod.label) + '" data-type="' + types[c].value + '" data-type-label="' + escapeHtml(types[c].label) + '"><span class="matrix-cell-icon">📝</span></td>';
        } else {
          html += '<td class="matrix-cell-na">—</td>';
        }
      }
      html += '</tr>';
    }
    html += '</table>';
    html += '</div>';
    html += '<p style="font-size:12px;color:var(--color-text-tertiary);text-align:center;margin-top:8px;">点击对应格子快速记录</p>';
    html += '</div>';
    return html;
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
          // 绑定矩阵格子点击事件
          var cells = formPanel.querySelectorAll('.matrix-cell-nav');
          for (var ci = 0; ci < cells.length; ci++) {
            cells[ci].onclick = function() {
              var mk = this.getAttribute('data-module');
              var ml = this.getAttribute('data-module-label');
              var tt = this.getAttribute('data-type');
              var tl = this.getAttribute('data-type-label');
              if (window.Records && typeof window.Records.openMatrixForm === 'function') {
                window.Records.openMatrixForm(mk, tt, ml, tl, state.youthId);
              }
            };
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

  // ========== 会话持久化 ==========
  var SESSION_KEY = 'ai_dongwo_chat_session';

  function saveSession() {
    if (!state.youthId || state.confirmed) return;
    var sessionData = {
      youthId: state.youthId,
      youthName: state.youthName,
      conversationId: state.conversationId,
      messages: state.messages,
      classifiedItems: state.classifiedItems,
      currentQuestionIndex: state.currentQuestionIndex,
      totalRounds: state.totalRounds,
      maxRounds: state.maxRounds,
      confirmed: state.confirmed,
      template: state.template,
      savedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(SESSION_KEY + '_' + state.youthId, JSON.stringify(sessionData));
    } catch (e) { /* storage full */ }
  }

  function loadSession(youthId) {
    try {
      var raw = localStorage.getItem(SESSION_KEY + '_' + youthId);
      if (!raw) return null;
      var data = JSON.parse(raw);
      // 仅当天会话有效
      var savedDate = new Date(data.savedAt).toDateString();
      var todayDate = new Date().toDateString();
      if (savedDate !== todayDate) {
        localStorage.removeItem(SESSION_KEY + '_' + youthId);
        return null;
      }
      // 已确认的会话不恢复
      if (data.confirmed) {
        localStorage.removeItem(SESSION_KEY + '_' + youthId);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  function clearSession(youthId) {
    try {
      localStorage.removeItem(SESSION_KEY + '_' + (youthId || state.youthId));
    } catch (e) { /* ignore */ }
  }

  // ========== 用户画像记忆 ==========
  var PROFILE_KEY = 'ai_dongwo_youth_profile';

  function getYouthProfile(youthId) {
    var yid = youthId || state.youthId;
    if (!yid) return null;
    try {
      var raw = localStorage.getItem(PROFILE_KEY + '_' + yid);
      if (!raw) return { youthId: yid, facts: [], recentConversations: [], lastUpdated: null };
      return JSON.parse(raw);
    } catch (e) {
      return { youthId: yid, facts: [], recentConversations: [], lastUpdated: null };
    }
  }

  function saveConversationSummary() {
    if (!state.youthId || state.classifiedItems.length === 0) return;
    var profile = getYouthProfile();

    // 构建对话摘要
    var modules = {};
    var keyPoints = [];
    for (var i = 0; i < state.classifiedItems.length; i++) {
      var item = state.classifiedItems[i];
      if (item.module) {
        modules[item.module] = true;
        keyPoints.push(item.sentence);
      }
    }

    var summary = {
      conversationId: state.conversationId,
      date: new Date().toISOString(),
      modules: Object.keys(modules),
      keyPoints: keyPoints.slice(0, 10), // 最多 10 条要点
      totalItems: state.classifiedItems.length,
      messageCount: state.messages.length
    };

    // 合并到 profile
    profile.recentConversations = profile.recentConversations || [];
    profile.recentConversations.unshift(summary);
    // 保留最近 5 次对话
    if (profile.recentConversations.length > 5) {
      profile.recentConversations = profile.recentConversations.slice(0, 5);
    }

    // 提取关键事实（简单规则：归类到模块的句子可能包含事实）
    for (var j = 0; j < keyPoints.length; j++) {
      var fact = extractFact(keyPoints[j], modules);
      if (fact) {
        profile.facts = profile.facts || [];
        // 去重：同 key 的更新
        var existingIdx = -1;
        for (var k = 0; k < profile.facts.length; k++) {
          if (profile.facts[k].key === fact.key) {
            existingIdx = k;
            break;
          }
        }
        if (existingIdx >= 0) {
          profile.facts[existingIdx] = fact;
        } else {
          profile.facts.push(fact);
        }
      }
    }

    // 限制 facts 数量
    if (profile.facts.length > 20) {
      profile.facts = profile.facts.slice(-20);
    }

    profile.lastUpdated = new Date().toISOString();

    try {
      localStorage.setItem(PROFILE_KEY + '_' + state.youthId, JSON.stringify(profile));
    } catch (e) { /* storage full */ }
  }

  function extractFact(sentence, modules) {
    // 简单规则提取事实：从分类句子中提取关键信息
    var factKey = null;
    var factValue = sentence;

    if (sentence.indexOf('吃饭') !== -1 || sentence.indexOf('胃口') !== -1) {
      factKey = '饮食';
    } else if (sentence.indexOf('睡') !== -1) {
      factKey = '睡眠';
    } else if (sentence.indexOf('情绪') !== -1 || sentence.indexOf('开心') !== -1 || sentence.indexOf('烦躁') !== -1) {
      factKey = '情绪状态';
    } else if (sentence.indexOf('药') !== -1) {
      factKey = '用药';
    } else if (sentence.indexOf('社交') !== -1 || sentence.indexOf('互动') !== -1) {
      factKey = '社交';
    } else if (sentence.indexOf('活动') !== -1 || sentence.indexOf('工作') !== -1) {
      factKey = '活动';
    }

    if (factKey) {
      return { key: factKey, value: factValue, updatedAt: new Date().toISOString() };
    }
    return null;
  }

  function buildProfileContext(youthId) {
    var profile = getYouthProfile(youthId);
    if (!profile) return '';

    var parts = [];

    // 关键事实
    if (profile.facts && profile.facts.length > 0) {
      parts.push('已知信息：');
      for (var i = 0; i < profile.facts.length; i++) {
        var f = profile.facts[i];
        parts.push('- ' + f.key + ': ' + f.value);
      }
    }

    // 最近对话摘要
    if (profile.recentConversations && profile.recentConversations.length > 0) {
      parts.push('\n最近对话历史：');
      for (var j = 0; j < profile.recentConversations.length; j++) {
        var conv = profile.recentConversations[j];
        var dateStr = new Date(conv.date).toLocaleDateString('zh-CN');
        parts.push('- ' + dateStr + ': ' + conv.keyPoints.slice(0, 3).join('；'));
      }
    }

    return parts.join('\n');
  }

  // ========== 增强版引擎初始化 ==========
  function initEngine(youth) {
    var saved = loadSession(youth.id);

    if (saved) {
      // 恢复上次会话
      state.youthId = saved.youthId;
      state.youthName = saved.youthName;
      state.conversationId = saved.conversationId;
      state.messages = saved.messages || [];
      state.classifiedItems = saved.classifiedItems || [];
      state.currentQuestionIndex = saved.currentQuestionIndex || 0;
      state.totalRounds = saved.totalRounds || 0;
      state.maxRounds = saved.maxRounds || 20;
      state.confirmed = false;
      state.template = saved.template || null;
      state._resumed = true;
    } else {
      // 全新会话
      state.youthId = youth.id;
      state.youthName = youth.name || '心青年';
      state.conversationId = 'conv_' + Date.now();
      state.messages = [];
      state.classifiedItems = [];
      state.currentQuestionIndex = 0;
      state.totalRounds = 0;
      state.confirmed = false;
      state._resumed = false;

      // 获取模板（优先通过接口层，兼容旧版直接访问）
      var qProvider = (window.ChatbotProviders && window.ChatbotProviders.getQuestionProvider()) || window.ChatbotTemplates;
      var classifier = (window.ChatbotProviders && window.ChatbotProviders.getClassifier()) || window.ChatbotClassifier;
      var hasClassifier = qProvider && classifier;
      state.template = hasClassifier
        ? qProvider.getTemplate(null)
        : { greeting: '你好！我是 AI 助手，可以帮你通过对话记录 ' + state.youthName + ' 的日常信息。', questions: [], maxRounds: 20 };
      state.maxRounds = state.template.maxRounds || 20;
    }

    // 渲染双栏布局
    renderEnhancedLayout(youth);
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
      '<div id="chat-mode-panel">' +
      '<div class="chat-layout">' +
        '<div class="chat-panel-col">' +
          '<div class="chat-messages" id="chat-messages">' +
            // 采集进度浮标
            '<div class="chat-progress-float" id="chat-progress-float">' +
              '<div class="chat-progress-mini">📋 今日采集 <span id="progress-count">0/4</span></div>' +
            '</div>' +
          '</div>' +
          '<div class="chat-quick-buttons" id="chat-quick-buttons"></div>' +
          '<div class="chat-input-area" id="chat-input-area">' +
          '<button class="chat-mode-switch" id="chat-mode-switch" type="button" title="切换语音/文字" aria-label="切换语音/文字">🎤</button>' +
          '<div class="chat-input-text-mode" id="chat-input-text-mode">' +
            '<textarea class="chat-input" id="chat-input" placeholder="输入消息..." rows="1"></textarea>' +
            '<button class="chat-send-btn" id="chat-send-btn" aria-label="发送">➤</button>' +
          '</div>' +
          '<div class="chat-input-voice-mode" id="chat-input-voice-mode" style="display:none;">' +
            '<button class="chat-voice-hold-btn" id="chat-voice-hold-btn" type="button">按住 说话</button>' +
          '</div>' +
        '</div>' +
        '</div>' +
      '</div>' +
      // 抽屉触发按钮
      '<div class="chat-drawer-triggers">' +
        '<button class="chat-drawer-trigger chat-drawer-trigger-left" id="btn-progress-drawer" title="采集进度">📋</button>' +
        '<button class="chat-drawer-trigger chat-drawer-trigger-right" id="btn-classify-drawer" title="实时归类">📋<span class="drawer-badge" id="classify-badge" style="display:none">0</span></button>' +
      '</div>' +
      '</div>' +
      // 抽屉遮罩
      '<div class="chat-drawer-backdrop" id="chat-drawer-backdrop"></div>' +
      // 左侧抽屉：采集进度
      '<div class="chat-drawer chat-drawer-left" id="chat-drawer-progress">' +
        '<div class="chat-drawer-header">' +
          '<span>📋 今日采集进度</span>' +
          '<button class="chat-drawer-close" id="btn-close-progress">✕</button>' +
        '</div>' +
        '<div class="chat-drawer-body" id="chat-drawer-progress-body"></div>' +
      '</div>' +
      // 右侧抽屉：实时归类
      '<div class="chat-drawer chat-drawer-right" id="chat-drawer-classify">' +
        '<div class="chat-drawer-header">' +
          '<span>📋 实时归类</span>' +
          '<button class="chat-drawer-close" id="btn-close-classify">✕</button>' +
        '</div>' +
        '<div class="chat-drawer-body" id="chat-drawer-classify-body">' +
          '<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">对话开始后，AI 将实时归类采集到的信息</div></div>' +
        '</div>' +
        '<div class="chat-drawer-footer">' +
          '<button class="btn-batch-archive" id="btn-batch-archive" disabled>✓ 批量归档</button>' +
        '</div>' +
      '</div>' +
      renderFormPanel();

    bindEnhancedEvents();
    renderQuickButtons();

    if (state._resumed) {
      // 恢复上次会话：重放消息和归类项
      restoreMessages();
      restoreClassifiedItems();
      updateProgressDisplay();
      updateClassifyBadge();
      // 添加恢复提示
      addSystemMessage('↩ 已恢复上次对话');
    } else {
      // 发送开场白
      addAIMessage(state.template.greeting, 300);
      if (state.template.questions && state.template.questions.length > 0) {
        setTimeout(function () { askNextQuestion(); }, 800);
      }
    }
  }

  // ========== 恢复会话消息 ==========
  function restoreMessages() {
    var messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    var savedMessages = state.messages;
    for (var i = 0; i < savedMessages.length; i++) {
      var msg = savedMessages[i];
      if (msg.role === 'ai') {
        var bubble = document.createElement('div');
        bubble.className = 'chat-bubble chat-bubble-bot';
        var rendered = (window.ChatMarkdown && window.ChatMarkdown.render) ? window.ChatMarkdown.render(msg.text) : escapeHtml(msg.text);
        bubble.innerHTML = rendered + '<div style="font-size:0.68rem;opacity:0.5;margin-top:4px;text-align:right;">' + formatTime() + '</div>';
        messagesContainer.appendChild(bubble);
      } else if (msg.role === 'user') {
        var bubble2 = document.createElement('div');
        bubble2.className = 'chat-bubble chat-bubble-user';
        bubble2.textContent = msg.text;
        messagesContainer.appendChild(bubble2);
      }
    }
    scrollToBottom();
  }

  function restoreClassifiedItems() {
    var classifyBody = document.getElementById('chat-drawer-classify-body');
    if (!classifyBody) return;
    var emptyState = classifyBody.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    for (var i = 0; i < state.classifiedItems.length; i++) {
      var item = state.classifiedItems[i];
      renderClassifiedItem(item.sentence, item.module, item.confidence, item.tempId);
    }
  }

  function addSystemMessage(text) {
    var messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-system';
    bubble.textContent = text;
    messagesContainer.appendChild(bubble);
    scrollToBottom();
  }

  // ========== 增强版事件绑定 ==========
  function bindEnhancedEvents() {
    var backBtn = document.getElementById('btn-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        saveSession();
        window.location.hash = 'profile?youthId=' + encodeURIComponent(state.youthId);
      });
    }

    // 页面离开时保存会话
    window.addEventListener('beforeunload', function () { saveSession(); });
    window.addEventListener('hashchange', function (e) {
      // 仅在离开 chat 页面时保存
      var newHash = window.location.hash.replace('#', '');
      if (newHash.indexOf('chat') !== 0) {
        saveSession();
      }
    });

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

    // 重试按钮事件委托（错误气泡 / 流式中断气泡）
    var chatMessagesEl = document.getElementById('chat-messages');
    if (chatMessagesEl) {
      chatMessagesEl.addEventListener('click', function (e) {
        if (!e.target || !e.target.classList.contains('chat-retry-btn')) return;
        // 找到错误气泡，移除它
        var errBubble = e.target.closest('.chat-bubble-error');
        if (errBubble) errBubble.remove();
        // 重试上一次用户消息
        var lastUserMsg = null;
        for (var i = state.messages.length - 1; i >= 0; i--) {
          if (state.messages[i].role === 'user') {
            lastUserMsg = state.messages[i];
            break;
          }
        }
        if (!lastUserMsg) return;
        // 重新调用 AI（不重复 addUserMessage）
        showTyping();
        var retryStreaming = null;
        window.ZhipuClient.generateReplyStream(
          _toApiMessages(state.messages),
          state.youthName,
          function (token, fullText) {
            if (!retryStreaming) {
              hideTyping();
              retryStreaming = addStreamingAIMessage();
            }
            retryStreaming.append(token);
          },
          buildProfileContext()
        ).then(function () {
          if (retryStreaming) {
            retryStreaming.finalize();
            state.totalRounds++;
            if (state.totalRounds >= state.maxRounds) {
              setTimeout(function () { endConversation(); }, 600);
            }
          } else {
            // AI 返回空字符串：移除 typing，显示错误气泡
            hideTyping();
            var chatMsgs = document.getElementById('chat-messages');
            var emptyBubble = document.createElement('div');
            emptyBubble.className = 'chat-bubble chat-bubble-bot chat-bubble-error';
            emptyBubble.innerHTML = '<div>AI 返回为空，请重试</div>' +
              '<button class="chat-retry-btn" type="button">重试</button>';
            if (chatMsgs) chatMsgs.appendChild(emptyBubble);
            scrollToBottom();
          }
        }).catch(function (err) {
          hideTyping();
          console.error('ChatBot: 重试失败', err);
          if (retryStreaming) {
            retryStreaming.bubbleEl.classList.remove('chat-bubble-streaming');
            retryStreaming.bubbleEl.classList.add('chat-bubble-error');
            retryStreaming.bubbleEl.innerHTML += '<div class="stream-interrupted">回复中断</div>' +
              '<button class="chat-retry-btn" type="button">重试</button>';
          } else {
            var chatMsgs = document.getElementById('chat-messages');
            var newErrBubble = document.createElement('div');
            newErrBubble.className = 'chat-bubble chat-bubble-bot chat-bubble-error';
            newErrBubble.innerHTML = '<div>AI 回复失败</div>' +
              '<button class="chat-retry-btn" type="button">重试</button>';
            if (chatMsgs) chatMsgs.appendChild(newErrBubble);
          }
          scrollToBottom();
        });
      });
    }

    bindInputModeEvents();
  }

  // ========== 消息渲染 ==========
  function addAIMessage(text, delay) {
    delay = delay || 0;
    setTimeout(function () {
      var chatMessages = document.getElementById('chat-messages');
      if (!chatMessages) return;
      var bubble = document.createElement('div');
      bubble.className = 'chat-bubble chat-bubble-bot';
      bubble.innerHTML = window.ChatMarkdown.render(text) + '<div style="font-size:0.68rem;opacity:0.5;margin-top:4px;text-align:right;">' + formatTime() + '</div>';
      chatMessages.appendChild(bubble);
      scrollToBottom();
      state.messages.push({ role: 'ai', text: text, time: new Date().toISOString() });
      saveSession();
    }, delay);
  }

  /**
   * 创建流式 AI 消息气泡
   * 返回 { bubbleEl, append(text), finalize(), fail(msg) }
   */
  function addStreamingAIMessage() {
    var chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return null;
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-bot chat-bubble-streaming';
    chatMessages.appendChild(bubble);
    scrollToBottom();
    return {
      bubbleEl: bubble,
      append: function (text) {
        bubble._rawText = (bubble._rawText || '') + text;
        // 流式过程显示纯文本（转义 + 换行），避免未闭合 markdown 渲染错乱
        bubble.innerHTML = escapeHtml(bubble._rawText).replace(/\n/g, '<br>');
        scrollToBottom();
      },
      finalize: function () {
        var text = bubble._rawText || '';
        bubble.classList.remove('chat-bubble-streaming');
        bubble.innerHTML = window.ChatMarkdown.render(text) +
          '<div style="font-size:0.68rem;opacity:0.5;margin-top:4px;text-align:right;">' + formatTime() + '</div>';
        scrollToBottom();
        state.messages.push({ role: 'ai', text: text, time: new Date().toISOString() });
        saveSession();
      },
      fail: function (errMsg) {
        bubble.classList.remove('chat-bubble-streaming');
        bubble.classList.add('chat-bubble-error');
        bubble.innerHTML = '<div>' + escapeHtml(errMsg) + '</div>' +
          '<button class="chat-retry-btn" type="button">重试</button>';
        scrollToBottom();
      }
    };
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
    saveSession();
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
    var todayModules = getTodayCollectedModules();

    // 跳过今天已采集模块的问题
    while (state.currentQuestionIndex < questions.length) {
      var q = questions[state.currentQuestionIndex];
      if (q.module && todayModules.indexOf(q.module) !== -1) {
        state.currentQuestionIndex++;
        continue;
      }
      break;
    }

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
      saveSession();
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

    var userText = text.trim();
    addUserMessage(userText);

    // 异步分类（兼容同步和异步返回）
    var classifier = (window.ChatbotProviders && window.ChatbotProviders.getClassifier()) || window.ChatbotClassifier;
    if (classifier) {
      var classifyResult = classifier.classify(userText);
      if (classifyResult && typeof classifyResult.then === 'function') {
        classifyResult.then(function (results) {
          processClassificationResults(results);
        }).catch(function (err) {
          console.error('ChatBot: AI 分类失败', err);
        });
      } else {
        // 同步分类（关键词引擎）
        processClassificationResults(classifyResult);
      }
    }

    // AI 生成自然对话回复
    var useAI = window.ZhipuClient && window.ZhipuClient.isAvailable();
    if (useAI) {
      showTyping();
      var streaming = null;
      window.ZhipuClient.generateReplyStream(
        _toApiMessages(state.messages),
        state.youthName,
        function (token, fullText) {
          if (!streaming) {
            hideTyping();
            streaming = addStreamingAIMessage();
          }
          streaming.append(token);
        },
        buildProfileContext()
      ).then(function () {
        if (streaming) {
          streaming.finalize();
          state.totalRounds++;
          if (state.totalRounds >= state.maxRounds) {
            setTimeout(function () { endConversation(); }, 600);
          }
        } else {
          // AI 返回空字符串：移除 typing，显示错误气泡
          hideTyping();
          var chatMsgs = document.getElementById('chat-messages');
          var emptyBubble = document.createElement('div');
          emptyBubble.className = 'chat-bubble chat-bubble-bot chat-bubble-error';
          emptyBubble.innerHTML = '<div>AI 返回为空，请重试</div>' +
            '<button class="chat-retry-btn" type="button">重试</button>';
          if (chatMsgs) chatMsgs.appendChild(emptyBubble);
          scrollToBottom();
        }
      }).catch(function (err) {
        hideTyping();
        console.error('ChatBot: AI 回复生成失败', err);
        if (streaming) {
          // 流式中断：保留部分文本，标记中断
          streaming.bubbleEl.classList.remove('chat-bubble-streaming');
          streaming.bubbleEl.classList.add('chat-bubble-error');
          streaming.bubbleEl.innerHTML += '<div class="stream-interrupted">回复中断</div>' +
            '<button class="chat-retry-btn" type="button">重试</button>';
        } else {
          // 未开始流式：显示错误气泡
          var chatMessages = document.getElementById('chat-messages');
          var errBubble = document.createElement('div');
          errBubble.className = 'chat-bubble chat-bubble-bot chat-bubble-error';
          errBubble.innerHTML = '<div>AI 回复失败</div>' +
            '<button class="chat-retry-btn" type="button">重试</button>';
          if (chatMessages) chatMessages.appendChild(errBubble);
        }
        scrollToBottom();
      });
    } else {
      // 无 AI：显示错误气泡（不再降级到模板提问）
      var chatMessages = document.getElementById('chat-messages');
      var errBubble = document.createElement('div');
      errBubble.className = 'chat-bubble chat-bubble-bot chat-bubble-error';
      errBubble.innerHTML = '<div>AI 服务未配置，请联系管理员</div>';
      if (chatMessages) chatMessages.appendChild(errBubble);
      scrollToBottom();
    }
  }

  /**
   * 处理分类结果（同步和异步共用）
   */
  function processClassificationResults(results) {
    if (!results || !results.length) return;
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
    saveSession();
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
    saveSession();

    // AI 生成自然对话回复
    if (window.ZhipuClient && window.ZhipuClient.isAvailable()) {
      showTyping();
      var streaming = null;
      window.ZhipuClient.generateReplyStream(
        _toApiMessages(state.messages),
        state.youthName,
        function (token, fullText) {
          if (!streaming) {
            hideTyping();
            streaming = addStreamingAIMessage();
          }
          streaming.append(token);
        },
        buildProfileContext()
      ).then(function () {
        if (streaming) {
          streaming.finalize();
          state.totalRounds++;
          if (state.totalRounds >= state.maxRounds) {
            setTimeout(function () { endConversation(); }, 600);
          }
        } else {
          // AI 返回空字符串：移除 typing，显示错误气泡
          hideTyping();
          var chatMsgs = document.getElementById('chat-messages');
          var emptyBubble = document.createElement('div');
          emptyBubble.className = 'chat-bubble chat-bubble-bot chat-bubble-error';
          emptyBubble.innerHTML = '<div>AI 返回为空，请重试</div>' +
            '<button class="chat-retry-btn" type="button">重试</button>';
          if (chatMsgs) chatMsgs.appendChild(emptyBubble);
          scrollToBottom();
        }
      }).catch(function (err) {
        hideTyping();
        console.error('ChatBot: AI 回复生成失败', err);
        if (streaming) {
          // 流式中断：保留部分文本，标记中断
          streaming.bubbleEl.classList.remove('chat-bubble-streaming');
          streaming.bubbleEl.classList.add('chat-bubble-error');
          streaming.bubbleEl.innerHTML += '<div class="stream-interrupted">回复中断</div>' +
            '<button class="chat-retry-btn" type="button">重试</button>';
        } else {
          // 未开始流式：显示错误气泡
          var chatMessages = document.getElementById('chat-messages');
          var errBubble = document.createElement('div');
          errBubble.className = 'chat-bubble chat-bubble-bot chat-bubble-error';
          errBubble.innerHTML = '<div>AI 回复失败</div>' +
            '<button class="chat-retry-btn" type="button">重试</button>';
          if (chatMessages) chatMessages.appendChild(errBubble);
        }
        scrollToBottom();
      });
    } else {
      // 无 AI：显示错误气泡（不再降级到模板提问）
      var chatMessages = document.getElementById('chat-messages');
      var errBubble = document.createElement('div');
      errBubble.className = 'chat-bubble chat-bubble-bot chat-bubble-error';
      errBubble.innerHTML = '<div>AI 服务未配置，请联系管理员</div>';
      if (chatMessages) chatMessages.appendChild(errBubble);
      scrollToBottom();
    }
  }

  // ========== 归类面板渲染 ==========
  function renderClassifiedItem(sentence, module, confidence, tempId) {
    var classifyBody = document.getElementById('chat-drawer-classify-body');
    if (!classifyBody) return;

    var emptyState = classifyBody.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    var classifier = (window.ChatbotProviders && window.ChatbotProviders.getClassifier()) || window.ChatbotClassifier;
    var modName = classifier ? classifier.getModuleName(module) : module;
    var modIcon = classifier ? classifier.getModuleIcon(module) : '📝';

    var item = document.createElement('div');
    item.className = 'classify-item';
    item.dataset.tempId = tempId;

    item.innerHTML =
      '<div class="classify-item-check" data-action="toggle">✓</div>' +
      '<div class="classify-item-body">' +
        '<div class="classify-item-module">' + modIcon + ' ' + modName + '</div>' +
        '<div class="classify-item-text">' + escapeHtml(sentence) + '</div>' +
      '</div>' +
      '<div class="classify-item-actions">' +
        '<button class="classify-item-action" data-action="edit" title="修改分类">✎</button>' +
        '<button class="classify-item-action delete" data-action="delete" title="删除">✕</button>' +
      '</div>';

    // 复选框切换
    item.querySelector('[data-action="toggle"]').addEventListener('click', function (e) {
      e.stopPropagation();
      item.classList.toggle('selected');
      updateBatchArchiveButton();
    });

    // 编辑按钮
    item.querySelector('[data-action="edit"]').addEventListener('click', function (e) {
      e.stopPropagation();
      showModulePicker(item, tempId);
    });

    // 删除按钮
    item.querySelector('[data-action="delete"]').addEventListener('click', function (e) {
      e.stopPropagation();
      state.classifiedItems = state.classifiedItems.filter(function (i) { return i.tempId !== tempId; });
      item.remove();
      updateBatchArchiveButton();
      updateClassifyBadge();
      updateProgressDisplay();
      saveSession();
      if (state.classifiedItems.length === 0) {
        classifyBody.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">对话开始后，AI 将实时归类采集到的信息</div></div>';
        updateBatchArchiveButton();
      }
    });

    classifyBody.appendChild(item);
    updateClassifyBadge();
    updateProgressDisplay();
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
      { key: 'workSupport', name: '工作与生活', icon: '💼' }
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
        var modEl = itemEl.querySelector('.classify-item-module');
        if (modEl) modEl.innerHTML = m.icon + ' ' + m.name;
        picker.remove();
        updateProgressDisplay();
        saveSession();
      };
      picker.appendChild(btn);
    });

    // 追加到 body 后面
    var body = itemEl.querySelector('.classify-item-body');
    if (body) body.appendChild(picker);
  }

  function updateBatchArchiveButton() {
    var btn = document.getElementById('btn-batch-archive');
    if (!btn) return;
    var selected = document.querySelectorAll('#chat-drawer-classify-body .classify-item.selected');
    btn.disabled = selected.length === 0;
    btn.textContent = selected.length > 0 ? '✓ 批量归档（' + selected.length + ' 条）' : '✓ 批量归档';
  }

  function updateClassifyBadge() {
    var badge = document.getElementById('classify-badge');
    if (!badge) return;
    var count = state.classifiedItems.length;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  function updateConfirmButton() {
    updateBatchArchiveButton();
    updateClassifyBadge();
  }

  // ========== 批量归档 ==========
  function batchArchive() {
    var selected = document.querySelectorAll('#chat-drawer-classify-body .classify-item.selected');
    if (selected.length === 0) return;

    var user = window.AppState ? window.AppState.currentUser : null;
    var now = window.Utils ? window.Utils.formatDateTime() : new Date().toISOString();

    selected.forEach(function (el) {
      var tempId = el.dataset.tempId;
      var item = state.classifiedItems.find(function (i) { return i.tempId === tempId; });
      if (!item || !item.module) return;

      var record = {
        id: window.Utils ? window.Utils.generateUUID() : 'rec_' + Date.now() + '_' + tempId,
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

      // 移除已归档的项
      state.classifiedItems = state.classifiedItems.filter(function (i) { return i.tempId !== tempId; });
      el.remove();
    });

    updateBatchArchiveButton();
    updateClassifyBadge();
    updateProgressDisplay();

    if (state.classifiedItems.length === 0) {
      var classifyBody = document.getElementById('chat-drawer-classify-body');
      if (classifyBody) {
        classifyBody.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">对话开始后，AI 将实时归类采集到的信息</div></div>';
      }
    }

    if (window.AppState && window.AppState.showToast) {
      window.AppState.showToast('已归档 ' + selected.length + ' 条记录');
    }
    saveSession();
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
    var batchBtn = document.getElementById('btn-batch-archive');
    if (inputEl) inputEl.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    if (batchBtn) {
      batchBtn.disabled = true;
      batchBtn.textContent = '✓ 已保存';
      batchBtn.style.background = 'var(--color-success)';
    }

    addAIMessage('记录已保存！你可以在档案页看到这些记录。');
    saveConversationSummary();
    clearSession();
  }

  // ========== 今日已采集模块（跨所有来源） ==========
  function getTodayCollectedModules(youthId) {
    var yid = youthId || state.youthId;
    if (!yid || !window.Storage) return [];
    var allRecords = window.Storage.getRecords(yid);
    var today = new Date().toDateString();
    var modules = {};
    for (var i = 0; i < allRecords.length; i++) {
      var r = allRecords[i];
      if (r.module && r.recordedAt) {
        var recDate = new Date(r.recordedAt).toDateString();
        if (recDate === today) {
          modules[r.module] = true;
        }
      }
    }
    return Object.keys(modules);
  }

  // ========== 采集进度 ==========
  var MODULE_CONFIG = [
    { key: 'communicationGuide', name: '沟通', icon: '💬' },
    { key: 'emotionBehavior', name: '情绪', icon: '🎨' },
    { key: 'careMedical', name: '医疗', icon: '💊' },
    { key: 'workSupport', name: '工作', icon: '💼' }
  ];

  function updateProgressDisplay() {
    // 合并 chatbot 归类 + 今日所有记录
    var collected = getCollectedModules();
    var todayModules = getTodayCollectedModules();
    for (var i = 0; i < todayModules.length; i++) {
      if (collected.indexOf(todayModules[i]) === -1) {
        collected.push(todayModules[i]);
      }
    }

    // 更新浮标
    var progressCount = document.getElementById('progress-count');
    if (progressCount) {
      progressCount.textContent = collected.length + '/' + MODULE_CONFIG.length;
    }

    // 更新左侧抽屉
    var progressBody = document.getElementById('chat-drawer-progress-body');
    if (!progressBody) return;

    var html = '<div class="progress-summary">已采集 <strong>' + collected.length + '</strong> / ' + MODULE_CONFIG.length + ' 个模块</div>';

    MODULE_CONFIG.forEach(function (m) {
      var isDone = collected.indexOf(m.key) !== -1;
      var source = '';
      if (isDone) {
        var fromChatbot = getCollectedModules().indexOf(m.key) !== -1;
        var fromStorage = todayModules.indexOf(m.key) !== -1;
        if (fromChatbot && !fromStorage) source = ' (对话)';
        else if (!fromChatbot && fromStorage) source = ' (记录)';
      }
      html +=
        '<div class="progress-module-item">' +
          '<div class="progress-module-icon">' + m.icon + '</div>' +
          '<div class="progress-module-info">' +
            '<div class="progress-module-name">' + m.name + source + '</div>' +
            '<div class="progress-module-status ' + (isDone ? 'done' : 'pending') + '">' +
              (isDone ? '✓ 已采集' : '○ 待采集') +
            '</div>' +
          '</div>' +
          '<div class="progress-module-check ' + (isDone ? 'done' : 'pending') + '">' +
            (isDone ? '✓' : '○') +
          '</div>' +
        '</div>';
    });

    progressBody.innerHTML = html;
  }

  function getCollectedModules() {
    var modules = {};
    for (var i = 0; i < state.classifiedItems.length; i++) {
      if (state.classifiedItems[i].module) {
        modules[state.classifiedItems[i].module] = true;
      }
    }
    return Object.keys(modules);
  }

  // ========== 抽屉交互 ==========
  function bindDrawerEvents() {
    var backdrop = document.getElementById('chat-drawer-backdrop');
    var progressDrawer = document.getElementById('chat-drawer-progress');
    var classifyDrawer = document.getElementById('chat-drawer-classify');
    var openDrawer = null;

    function closeAll() {
      if (progressDrawer) progressDrawer.classList.remove('active');
      if (classifyDrawer) classifyDrawer.classList.remove('active');
      if (backdrop) backdrop.classList.remove('active');
      openDrawer = null;
    }

    function openProgress() {
      if (openDrawer === 'progress') { closeAll(); return; }
      closeAll();
      if (progressDrawer) progressDrawer.classList.add('active');
      if (backdrop) backdrop.classList.add('active');
      openDrawer = 'progress';
      updateProgressDisplay();
    }

    function openClassify() {
      if (openDrawer === 'classify') { closeAll(); return; }
      closeAll();
      if (classifyDrawer) classifyDrawer.classList.add('active');
      if (backdrop) backdrop.classList.add('active');
      openDrawer = 'classify';
    }

    // 触发按钮
    var btnProgress = document.getElementById('btn-progress-drawer');
    var btnClassify = document.getElementById('btn-classify-drawer');
    if (btnProgress) btnProgress.addEventListener('click', openProgress);
    if (btnClassify) btnClassify.addEventListener('click', openClassify);

    // 关闭按钮
    var btnCloseProgress = document.getElementById('btn-close-progress');
    var btnCloseClassify = document.getElementById('btn-close-classify');
    if (btnCloseProgress) btnCloseProgress.addEventListener('click', closeAll);
    if (btnCloseClassify) btnCloseClassify.addEventListener('click', closeAll);

    // 遮罩点击关闭
    if (backdrop) backdrop.addEventListener('click', closeAll);

    // 批量归档按钮
    var batchBtn = document.getElementById('btn-batch-archive');
    if (batchBtn) batchBtn.addEventListener('click', batchArchive);

    // 初始化进度显示
    updateProgressDisplay();
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

  // ========== 微信式语音/文字切换 ==========
  var voiceMode = false; // false=文字模式, true=语音模式

  function bindInputModeEvents() {
    voiceMode = false; // DOM 重建后默认文字模式，重置状态
    var switchBtn = document.getElementById('chat-mode-switch');
    var textMode = document.getElementById('chat-input-text-mode');
    var voiceModeEl = document.getElementById('chat-input-voice-mode');
    var holdBtn = document.getElementById('chat-voice-hold-btn');
    if (!switchBtn || !textMode || !voiceModeEl || !holdBtn) return;

    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // 不支持语音：隐藏切换钮
      switchBtn.style.display = 'none';
      return;
    }

    // 切换按钮
    switchBtn.addEventListener('click', function () {
      voiceMode = !voiceMode;
      if (voiceMode) {
        switchBtn.textContent = '⌨️';
        textMode.style.display = 'none';
        voiceModeEl.style.display = 'flex';
      } else {
        switchBtn.textContent = '🎤';
        voiceModeEl.style.display = 'none';
        textMode.style.display = 'flex';
      }
    });

    // 按住说话
    var recognition = null;
    var isHolding = false;
    var cancelled = false;
    var startY = 0;

    function startHold(e) {
      e.preventDefault();
      isHolding = true;
      cancelled = false;
      startY = (e.touches && e.touches[0].clientY) || e.clientY;
      holdBtn.classList.add('holding');
      holdBtn.textContent = '松开 发送';

      recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      var hasResult = false;
      var hasError = false;
      recognition.onresult = function (event) {
        if (cancelled) return;
        var text = event.results[0][0].transcript;
        if (text) {
          hasResult = true;
          // 重置按钮状态
          holdBtn.classList.remove('holding', 'cancel');
          holdBtn.textContent = '按住 说话';
          handleUserInput(text);
        }
      };
      recognition.onerror = function (event) {
        hasError = true;
        console.error('ChatBot: 语音识别错误', event.error, event.message);
        if (!cancelled && window.AppState && window.AppState.showToast) {
          window.AppState.showToast('语音识别失败');
        }
        // 重置按钮状态
        holdBtn.classList.remove('holding', 'cancel');
        holdBtn.textContent = '按住 说话';
      };
      recognition.onend = function () {
        if (!cancelled && !hasResult && !hasError && window.AppState && window.AppState.showToast) {
          window.AppState.showToast('未识别到语音，请重试');
        }
        // 重置按钮状态
        if (!hasResult) {
          holdBtn.classList.remove('holding', 'cancel');
          holdBtn.textContent = '按住 说话';
        }
        recognition = null;
      };
      recognition.start();
    }

    function endHold(e) {
      if (!isHolding) return;
      e.preventDefault();
      isHolding = false;
      if (cancelled) {
        // 取消：中止识别，不发送
        holdBtn.classList.remove('holding', 'cancel');
        holdBtn.textContent = '按住 说话';
        if (recognition) { try { recognition.abort(); } catch (err) {} }
        return;
      }
      // 正常松手：不立即 stop()，让识别自然结束（Chrome stop() 可能导致 onresult 丢失）
      // 显示"识别中"状态，onresult/onend 中重置按钮
      holdBtn.classList.remove('cancel');
      holdBtn.textContent = '识别中…';
    }

    function cancelHold(e) {
      if (!isHolding) return;
      var curY = (e.touches && e.touches[0].clientY) || e.clientY;
      if (startY - curY > 40) {
        cancelled = true;
        holdBtn.classList.add('cancel');
        holdBtn.textContent = '松开手指，取消发送';
      } else {
        cancelled = false;
        holdBtn.classList.remove('cancel');
        holdBtn.textContent = '松开 发送';
      }
    }

    holdBtn.addEventListener('mousedown', startHold);
    holdBtn.addEventListener('mouseup', endHold);
    holdBtn.addEventListener('mouseleave', function(e) { if (isHolding) endHold(e); });
    holdBtn.addEventListener('touchstart', startHold, { passive: false });
    holdBtn.addEventListener('touchend', endHold, { passive: false });
    holdBtn.addEventListener('touchmove', cancelHold, { passive: false });
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