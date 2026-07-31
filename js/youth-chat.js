/**
 * youth-chat.js - 心青年 AI 对话首页
 * 聊天式 UI，包含 AI 消息气泡、任务卡片、用户输入
 * 心青年登录后直接进入此页面
 */
window.YouthChat = (function () {
  'use strict';

  var state = {
    messages: [],
    youthId: null,
    questionCount: 0
  };

  /**
   * 渲染心青年对话首页
   */
  function render() {
    var user = AppState.currentUser;
    if (!user || user.role !== 'youth') {
      window.location.hash = 'dashboard';
      return;
    }

    // 获取心青年档案
    var youths = Permissions.getAccessibleYouths();
    if (youths.length === 0) {
      App.getContainer().innerHTML = '<div class="empty-state"><div class="empty-state-icon">🌻</div><div class="empty-state-title">暂无档案</div><div class="empty-state-desc">请联系家长创建档案</div></div>';
      return;
    }
    state.youthId = youths[0].id;
    var youthName = youths[0].name;

    // 加载历史消息（从 localStorage）
    _loadMessages();

    var container = App.getContainer();
    container.innerHTML =
      '<div class="youth-chat-page">' +
        '<div class="youth-chat-header">' +
          '<div class="youth-chat-greeting">' +
            '<div class="youth-chat-hi">🌻 你好，' + Utils.escapeHtml(user.name) + '</div>' +
            '<div class="youth-chat-subtitle">有什么想聊的吗？</div>' +
          '</div>' +
        '</div>' +
        '<div class="youth-chat-messages" id="youth-chat-messages">' +
          _renderMessages() +
        '</div>' +
        '<div class="youth-chat-input-bar">' +
          '<input type="text" id="youth-chat-input" class="youth-chat-input" placeholder="输入想说的话…" maxlength="200">' +
          '<button class="youth-chat-send" id="youth-chat-send">发送</button>' +
        '</div>' +
      '</div>';

    _bindEvents();
  }

  function _renderMessages() {
    var html = '';
    for (var i = 0; i < state.messages.length; i++) {
      var msg = state.messages[i];
      if (msg.role === 'ai') {
        html += '<div class="chat-bubble chat-bubble-ai">' + Utils.escapeHtml(msg.text) + '</div>';
      } else if (msg.role === 'user') {
        html += '<div class="chat-bubble chat-bubble-user">' + Utils.escapeHtml(msg.text) + '</div>';
      } else if (msg.role === 'task') {
        html += '<div class="chat-task-card">' +
          '<div class="chat-task-icon">📋</div>' +
          '<div class="chat-task-body">' +
            '<div class="chat-task-title">' + Utils.escapeHtml(msg.title || '任务提醒') + '</div>' +
            '<div class="chat-task-desc">' + Utils.escapeHtml(msg.text) + '</div>' +
          '</div>' +
          '<button class="chat-task-done" data-task-id="' + (msg.taskId || '') + '">✓</button>' +
        '</div>';
      }
    }
    if (state.messages.length === 0) {
      html += '<div class="chat-bubble chat-bubble-ai">你好呀！我是你的 AI 伙伴 😊 今天过得怎么样？</div>';
    }
    return html;
  }

  function _loadMessages() {
    var key = 'ai_dongwo_youth_chat_' + state.youthId;
    try {
      var raw = localStorage.getItem(key);
      state.messages = raw ? JSON.parse(raw) : [];
    } catch (e) {
      state.messages = [];
    }

    // 加载心青年任务卡片（targetType=youth）
    var tasks = Storage.getHandoverTasks(state.youthId);
    var youthTasks = tasks.filter(function(t) { return t.targetType === 'youth' && t.status !== 'done'; });
    // 检查是否已有任务卡片在消息中
    var existingTaskIds = state.messages.filter(function(m) { return m.role === 'task'; }).map(function(m) { return m.taskId; });
    for (var i = 0; i < youthTasks.length; i++) {
      if (existingTaskIds.indexOf(youthTasks[i].id) === -1) {
        state.messages.push({
          role: 'task',
          taskId: youthTasks[i].id,
          title: '任务提醒',
          text: youthTasks[i].content || '',
          timestamp: Utils.formatDateTime()
        });
      }
    }
    _saveMessages();
  }

  function _saveMessages() {
    var key = 'ai_dongwo_youth_chat_' + state.youthId;
    try {
      localStorage.setItem(key, JSON.stringify(state.messages));
    } catch (e) {
      console.warn('保存对话失败', e);
    }
  }

  function _bindEvents() {
    var input = document.getElementById('youth-chat-input');
    var sendBtn = document.getElementById('youth-chat-send');
    var msgContainer = document.getElementById('youth-chat-messages');

    function sendMessage() {
      var text = input.value.trim();
      if (!text) return;

      state.messages.push({ role: 'user', text: text, timestamp: Utils.formatDateTime() });
      input.value = '';
      _saveMessages();
      msgContainer.innerHTML = _renderMessages();
      msgContainer.scrollTop = msgContainer.scrollHeight;

      // 模拟 AI 回复
      setTimeout(function() {
        var aiReply = _generateAIReply(text);
        state.messages.push({ role: 'ai', text: aiReply, timestamp: Utils.formatDateTime() });
        // 提取 AI 发现并存储
        var findings = _extractAIFinding(text);
        if (findings.length > 0) {
          _saveAIFindings(findings);
        }
        _saveMessages();
        msgContainer.innerHTML = _renderMessages();
        msgContainer.scrollTop = msgContainer.scrollHeight;
      }, 800);
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') sendMessage();
    });

    // 任务完成按钮
    var doneBtns = msgContainer.querySelectorAll('.chat-task-done');
    for (var i = 0; i < doneBtns.length; i++) {
      doneBtns[i].addEventListener('click', function() {
        var taskId = this.getAttribute('data-task-id');
        if (taskId) {
          Storage.updateHandoverTask(state.youthId, taskId, { status: 'done' });
          AppState.showToast('✅ 任务已完成！');
          // 移除任务卡片
          state.messages = state.messages.filter(function(m) { return m.taskId !== taskId; });
          _saveMessages();
          msgContainer.innerHTML = _renderMessages();
        }
      });
    }

    // 滚动到底部
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  function _extractAIFinding(userText) {
    var findings = [];
    // 情绪相关
    if (userText.indexOf('开心') > -1 || userText.indexOf('高兴') > -1 || userText.indexOf('快乐') > -1) {
      findings.push({ module: 'emotionBehavior', text: '表达了积极情绪：' + userText.substring(0, 50) });
    }
    if (userText.indexOf('难过') > -1 || userText.indexOf('伤心') > -1 || userText.indexOf('害怕') > -1 || userText.indexOf('焦虑') > -1) {
      findings.push({ module: 'emotionBehavior', text: '表达了负面情绪：' + userText.substring(0, 50) });
    }
    // 工作相关
    if (userText.indexOf('工作') > -1 || userText.indexOf('实习') > -1 || userText.indexOf('超市') > -1) {
      findings.push({ module: 'workSupport', text: '提及工作/实习：' + userText.substring(0, 50) });
    }
    // 沟通相关
    if (userText.indexOf('不想说') > -1 || userText.indexOf('说不出来') > -1 || userText.indexOf('沟通') > -1) {
      findings.push({ module: 'communicationGuide', text: '沟通相关：' + userText.substring(0, 50) });
    }
    return findings;
  }

  function _saveAIFindings(findings) {
    var key = 'ai_dongwo_ai_findings_' + state.youthId;
    var existing = [];
    try {
      var raw = localStorage.getItem(key);
      existing = raw ? JSON.parse(raw) : [];
    } catch (e) { existing = []; }
    for (var i = 0; i < findings.length; i++) {
      findings[i].id = Utils.generateUUID();
      findings[i].status = 'pending'; // pending / approved / rejected
      findings[i].timestamp = Utils.formatDateTime();
      existing.push(findings[i]);
    }
    localStorage.setItem(key, JSON.stringify(existing));
  }

  function _generateAIReply(userText) {
    // 温和回应
    if (userText.indexOf('开心') > -1 || userText.indexOf('高兴') > -1 || userText.indexOf('快乐') > -1) {
      return '看到你开心我也很高兴！😊';
    }
    if (userText.indexOf('难过') > -1 || userText.indexOf('伤心') > -1 || userText.indexOf('不开心') > -1) {
      return '抱歉你心情不太好，想聊聊发生了什么吗？我会在这里陪着你 🤗';
    }
    if (userText.indexOf('累') > -1 || userText.indexOf('困') > -1) {
      return '辛苦了！记得休息一下哦 💆';
    }

    // 建档助手：主动提问（每 3 条消息后提问一次，围绕档案维度）
    var userMsgs = state.messages.filter(function(m) { return m.role === 'user'; });
    var shouldAsk = userMsgs.length >= 3 && (userMsgs.length % 3 === 0) && state.questionCount < 8;

    if (shouldAsk) {
      var questions = [
        { text: '今天心情怎么样呀？有没有什么开心的事？😊', module: 'emotionBehavior' },
        { text: '最近有没有做什么有意思的事情？可以跟我说说吗？', module: 'workSupport' },
        { text: '你喜欢用什么方式跟别人说话呢？比如打字、说话，还是用手势？', module: 'communicationGuide' },
        { text: '平时喜欢吃什么呀？有没有特别爱吃的？', module: 'careMedical' },
        { text: '最近有没有遇到什么困难？可以跟我说，我们一起想办法 💪', module: 'emotionBehavior' },
        { text: '如果让你选一个工作，你最喜欢做什么？', module: 'workSupport' },
        { text: '跟别人说话的时候，你觉得怎么最舒服？', module: 'communicationGuide' },
        { text: '最近身体有没有不舒服的地方？要记得告诉我哦', module: 'careMedical' }
      ];
      var idx = state.questionCount % questions.length;
      state.questionCount++;
      return questions[idx].text;
    }

    // 普通回应
    var replies = ['谢谢你跟我分享！😊', '我理解你的感受。', '听起来不错呢！', '你做得很好，继续加油！💪', '能跟我说说更多吗？', '我会记住这些的！'];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  return {
    render: render
  };
})();
