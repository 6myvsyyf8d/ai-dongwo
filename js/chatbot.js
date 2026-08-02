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
      renderTabBar() +
      '<div id="chat-mode-panel">' +
      '<div class="chat-layout">' +
        '<div class="chat-panel-col">' +
          '<div class="chat-messages" id="chat-messages"></div>' +
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
          }
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
        }
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
        }
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
          handleUserInput(text);
        }
      };
      recognition.onerror = function () {
        hasError = true;
        if (!cancelled && window.AppState && window.AppState.showToast) {
          window.AppState.showToast('语音识别失败');
        }
      };
      recognition.onend = function () {
        if (!cancelled && !hasResult && !hasError && window.AppState && window.AppState.showToast) {
          window.AppState.showToast('未识别到语音，请重试');
        }
        recognition = null;
      };
      recognition.start();
    }

    function endHold(e) {
      if (!isHolding) return;
      e.preventDefault();
      isHolding = false;
      holdBtn.classList.remove('holding');
      holdBtn.classList.remove('cancel');
      holdBtn.textContent = '按住 说话';
      if (cancelled) {
        // 取消：停止识别，不发送
        if (recognition) { try { recognition.stop(); } catch (err) {} }
        return;
      }
      // 正常结束：识别 onresult 会处理发送
      if (recognition) { try { recognition.stop(); } catch (err) {} }
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