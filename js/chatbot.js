/**
 * chatbot.js - AI 对话式采集
 * 通过自然语言对话采集心青年信息，自动分类并保存为记录
 */
window.ChatBot = (function () {
  'use strict';

  // 模块关键词和标签引用 Modules.Modules.MODULE_KEYWORDS / Modules.Modules.MODULE_LABELS（modules.js 中唯一定义）

  // 建议问题
  var SUGGESTIONS = [
    '今天心情怎么样？',
    '有什么喜欢做的事？',
    '最近有什么变化吗？',
    '有没有什么触发情绪的情况？',
    '今天用药情况如何？',
    '有什么新学会的技能吗？'
  ];

  // 对话历史
  var _messages = [];
  var _youthId = null;
  var _pendingClassification = null;

  /**
   * 渲染对话页
   */
  function renderChat(params) {
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

    // 检查写入权限
    if (!Permissions.canWrite('communicationGuide') && !Permissions.canWrite('emotionBehavior') && !Permissions.canWrite('careMedical') && !Permissions.canWrite('workSupport')) {
      App.getContainer().innerHTML = '<div class="page-content"><div class="permission-denied"><div class="permission-denied-icon">🔒</div><div class="permission-denied-title">无写入权限</div><div class="permission-denied-desc">对话采集需要至少一个模块的写入权限</div></div></div>';
      return;
    }

    _youthId = youthId;
    _messages = [];
    _pendingClassification = null;
    _renderChatPage(youth);

    // 添加欢迎消息
    _addBotMessage('你好！我是 AI 助手，可以帮你通过对话记录 ' + youth.name + ' 的日常信息。你可以告诉我今天发生了什么，或者从下方建议问题开始。');
  }

  /**
   * 渲染对话页 UI
   */
  function _renderChatPage(youth) {
    var container = App.getContainer();
    container.innerHTML =
      '<div class="page-header">' +
        '<button class="btn btn-sm btn-secondary" id="btn-back">← 返回</button>' +
        '<span class="page-title">' + Utils.escapeHtml(youth.name) + ' · 对话采集</span>' +
        '<span></span>' +
      '</div>' +
      '<div class="chat-page">' +
        '<div class="chat-messages" id="chat-messages"></div>' +
        '<div class="chat-suggestions" id="chat-suggestions">' +
          SUGGESTIONS.map(function (s) {
            return '<div class="chat-suggestion-chip" data-suggestion="' + Utils.escapeHtml(s) + '">' + s + '</div>';
          }).join('') +
        '</div>' +
        '<div class="chat-input-area">' +
          '<textarea class="chat-input" id="chat-input" placeholder="输入消息..." rows="1"></textarea>' +
          '<button class="chat-send-btn" id="btn-send" aria-label="发送消息">➤</button>' +
        '</div>' +
      '</div>';

    _bindEvents();
  }

  /**
   * 绑定事件
   */
  function _bindEvents() {
    document.getElementById('btn-back').addEventListener('click', function () {
      window.location.hash = 'profile?youthId=' + encodeURIComponent(_youthId);
    });

    var input = document.getElementById('chat-input');
    var sendBtn = document.getElementById('btn-send');

    // 自适应高度
    input.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
      sendBtn.disabled = !this.value.trim();
    });

    // Enter 发送
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _handleSend();
      }
    });

    sendBtn.addEventListener('click', _handleSend);

    // 建议问题
    var chips = document.querySelectorAll('.chat-suggestion-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].addEventListener('click', function () {
        input.value = this.getAttribute('data-suggestion');
        input.dispatchEvent(new Event('input'));
        _handleSend();
      });
    }

    sendBtn.disabled = true;
  }

  /**
   * 处理发送
   */
  function _handleSend() {
    var input = document.getElementById('chat-input');
    var text = input.value.trim();
    if (!text) return;

    // 添加用户消息
    _addUserMessage(text);
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('btn-send').disabled = true;

    // 显示打字动画
    _showTyping();

    // 模拟 AI 思考延迟
    setTimeout(function () {
      _hideTyping();
      _processUserMessage(text);
    }, 600 + Math.random() * 400);
  }

  /**
   * 处理用户消息 — 关键词提取、分类、确认
   */
  function _processUserMessage(text) {
    // 如果有待确认的分类，先处理确认
    if (_pendingClassification) {
      _handleClassificationConfirm(text);
      return;
    }

    // 关键词匹配分类
    var classification = _classifyText(text);

    if (classification.module) {
      // 有明确分类，显示分类确认
      _pendingClassification = {
        text: text,
        module: classification.module,
        tags: classification.tags
      };

      _addBotMessage(
        '我理解这段信息属于「' + Modules.MODULE_LABELS[classification.module] + '」模块。\n\n' +
        '是否要将其保存为一条记录？',
        true // showClassification
      );
    } else {
      // 无法分类，提示用户选择
      _pendingClassification = {
        text: text,
        module: null,
        tags: []
      };

      _addBotMessage(
        '我不太确定这段信息属于哪个模块，请帮我选择一个：',
        true // showClassification
      );
    }
  }

  /**
   * 文本分类（基于关键词匹配）
   */
  function _classifyText(text) {
    var scores = {};
    var tags = [];

    for (var module in Modules.MODULE_KEYWORDS) {
      scores[module] = 0;
      var keywords = Modules.MODULE_KEYWORDS[module];
      for (var i = 0; i < keywords.length; i++) {
        if (text.indexOf(keywords[i]) > -1) {
          scores[module]++;
          tags.push(keywords[i]);
        }
      }
    }

    // 找到最高分模块
    var bestModule = null;
    var bestScore = 0;
    for (var m in scores) {
      if (scores[m] > bestScore) {
        bestScore = scores[m];
        bestModule = m;
      }
    }

    // 去重标签
    var uniqueTags = [];
    for (var i = 0; i < tags.length; i++) {
      if (uniqueTags.indexOf(tags[i]) === -1) {
        uniqueTags.push(tags[i]);
      }
    }

    return {
      module: bestScore > 0 ? bestModule : null,
      tags: uniqueTags.slice(0, 5)
    };
  }

  /**
   * 处理分类确认
   */
  function _handleClassificationConfirm(userResponse) {
    // 如果用户选择了模块（通过点击按钮），userResponse 是模块名
    // 如果用户输入了文字，尝试解析
    if (_pendingClassification.module && (userResponse === 'confirm' || userResponse.indexOf('是') > -1 || userResponse.indexOf('好') > -1 || userResponse.indexOf('保存') > -1)) {
      // 确认保存
      _saveRecordFromPending();
      return;
    }

    if (userResponse.indexOf('不') > -1 || userResponse.indexOf('取消') > -1) {
      _pendingClassification = null;
      _addBotMessage('好的，已取消保存。你可以继续告诉我更多信息。');
      return;
    }

    // 检查是否是模块选择
    for (var key in Modules.MODULE_LABELS) {
      if (userResponse === key) {
        _pendingClassification.module = key;
        _saveRecordFromPending();
        return;
      }
    }

    // 默认：取消
    _pendingClassification = null;
    _addBotMessage('好的，我们继续。你可以告诉我更多关于今天的情况。');
  }

  /**
   * 保存待确认的记录
   */
  function _saveRecordFromPending() {
    if (!_pendingClassification || !_pendingClassification.module) {
      return;
    }

    // 权限检查
    if (!Permissions.canWrite(_pendingClassification.module)) {
      _addBotMessage('抱歉，你没有写入「' + Modules.MODULE_LABELS[_pendingClassification.module] + '」模块的权限。');
      _pendingClassification = null;
      return;
    }

    var user = AppState.currentUser;
    var now = Utils.formatDateTime();

    var record = {
      id: Utils.generateUUID(),
      youthId: _youthId,
      recorderId: user.id,
      recorderRole: user.role,
      module: _pendingClassification.module,
      recordType: 'observation',
      content: {
        text: _pendingClassification.text,
        tags: _pendingClassification.tags
      },
      visibilityLevel: 'full',
      recordedAt: now,
      isOffline: !navigator.onLine,
      syncedAt: navigator.onLine ? now : null
    };

    var result = Storage.addRecord(_youthId, record);
    if (result.success) {
      _addBotMessage(
        '✅ 已保存到「' + Modules.MODULE_LABELS[_pendingClassification.module] + '」模块。\n\n' +
        '记录内容：' + _pendingClassification.text.substring(0, 50) + (_pendingClassification.text.length > 50 ? '...' : ''),
        false,
        true // saved
      );
    } else {
      _addBotMessage('保存失败，请稍后重试。');
    }

    _pendingClassification = null;
  }

  /**
   * 添加 bot 消息
   */
  function _addBotMessage(text, showClassification, saved) {
    _messages.push({ type: 'bot', text: text, showClassification: showClassification, saved: saved });
    _renderMessage({ type: 'bot', text: text, showClassification: showClassification, saved: saved });
    _scrollToBottom();
  }

  /**
   * 添加用户消息
   */
  function _addUserMessage(text) {
    _messages.push({ type: 'user', text: text });
    _renderMessage({ type: 'user', text: text });
    _scrollToBottom();
  }

  /**
   * 渲染单条消息
   */
  function _renderMessage(msg) {
    var container = document.getElementById('chat-messages');
    var bubble = document.createElement('div');

    if (msg.type === 'bot') {
      bubble.className = 'chat-bubble chat-bubble-bot';
      var html = Utils.escapeHtml(msg.text).replace(/\n/g, '<br>');

      if (msg.saved) {
        html += '<div class="chat-saved-marker">✅ 已保存为记录</div>';
      }

      if (msg.showClassification && _pendingClassification) {
        html += '<div class="chat-classify-confirm">' +
          '<div class="chat-classify-title">选择模块并保存：</div>' +
          '<div class="chat-classify-buttons">';

        var modules = _pendingClassification.module ? [_pendingClassification.module] : Object.keys(Modules.MODULE_LABELS);
        if (_pendingClassification.module) {
          // 确认保存
          html += '<div class="chat-classify-btn selected" data-action="confirm">✅ 确认保存</div>' +
            '<div class="chat-classify-btn" data-action="cancel">取消</div>' +
            '<div class="chat-classify-btn" data-action="reclassify">重新分类</div>';
        } else {
          // 选择模块
          for (var i = 0; i < modules.length; i++) {
            var key = modules[i];
            if (Permissions.canWrite(key)) {
              html += '<div class="chat-classify-btn" data-module="' + key + '">' + Modules.MODULE_LABELS[key] + '</div>';
            }
          }
          html += '<div class="chat-classify-btn" data-action="cancel">取消</div>';
        }

        html += '</div></div>';
      }

      bubble.innerHTML = html;

      // 绑定分类按钮事件
      if (msg.showClassification) {
        var btns = bubble.querySelectorAll('.chat-classify-btn');
        for (var i = 0; i < btns.length; i++) {
          btns[i].addEventListener('click', function () {
            var action = this.getAttribute('data-action');
            var module = this.getAttribute('data-module');

            if (action === 'confirm') {
              _handleClassificationConfirm('confirm');
            } else if (action === 'cancel') {
              _pendingClassification = null;
              _addBotMessage('好的，已取消。继续告诉我更多信息吧。');
            } else if (action === 'reclassify') {
              _pendingClassification.module = null;
              _addBotMessage('请选择正确的模块：', true);
            } else if (module) {
              _pendingClassification.module = module;
              _saveRecordFromPending();
            }
          });
        }
      }
    } else {
      bubble.className = 'chat-bubble chat-bubble-user';
      bubble.textContent = msg.text;
    }

    container.appendChild(bubble);
  }

  /**
   * 显示打字动画
   */
  function _showTyping() {
    var container = document.getElementById('chat-messages');
    var typing = document.createElement('div');
    typing.className = 'chat-bubble chat-bubble-bot chat-typing-indicator';
    typing.id = 'chat-typing';
    typing.innerHTML = '<div class="chat-typing"><div class="chat-typing-dot"></div><div class="chat-typing-dot"></div><div class="chat-typing-dot"></div></div>';
    container.appendChild(typing);
    _scrollToBottom();
  }

  /**
   * 隐藏打字动画
   */
  function _hideTyping() {
    var typing = document.getElementById('chat-typing');
    if (typing) {
      typing.remove();
    }
  }

  /**
   * 滚动到底部
   */
  function _scrollToBottom() {
    var container = document.getElementById('chat-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  return {
    renderChat: renderChat
  };
})();
