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
    questionCount: 0,
    dailyCallCount: 0,
    isAiCalling: false
  };

  // 每日免费额度上限（防止成本失控）
  var DAILY_LIMIT = 30;

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
        '<div class="youth-chat-input-bar" id="youth-chat-input-bar">' +
          '<button class="chat-mode-switch" id="youth-mode-switch" type="button" title="切换语音/文字" aria-label="切换语音/文字">🎤</button>' +
          '<div class="chat-input-text-mode" id="youth-input-text-mode">' +
            '<input type="text" id="youth-chat-input" class="youth-chat-input" placeholder="输入想说的话…" maxlength="200">' +
            '<button class="youth-chat-send" id="youth-chat-send">发送</button>' +
          '</div>' +
          '<div class="chat-input-voice-mode" id="youth-input-voice-mode" style="display:none;">' +
            '<button class="chat-voice-hold-btn youth-voice-hold" id="youth-voice-hold-btn" type="button">按住 说话</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    _bindEvents();
  }

  function _renderMessages() {
    var html = '';
    for (var i = 0; i < state.messages.length; i++) {
      var msg = state.messages[i];
      if (msg.role === 'ai') {
        // AI 气泡 + 🔊 重播按钮
        html += '<div class="chat-bubble chat-bubble-ai">' +
          window.ChatMarkdown.render(msg.text) +
          '<button class="chat-bubble-speak-btn" data-speak-idx="' + i + '" title="朗读" aria-label="朗读">🔊</button>' +
        '</div>';
      } else if (msg.role === 'user') {
        html += '<div class="chat-bubble chat-bubble-user">' + Utils.escapeHtml(msg.text) + '</div>';
      } else if (msg.role === 'task') {
        // 心青年任务卡片：图标 + 颜色 + 🔊 听任务 + ⭐ 完成
        // 根据任务关键词分配图标
        var taskIcon = '📋';
        var taskColor = 'rgba(253,203,110,0.08)';
        var taskBorder = 'rgba(253,203,110,0.2)';
        var taskText = (msg.text || '').toLowerCase();
        if (taskText.indexOf('吃') > -1 || taskText.indexOf('饭') > -1 || taskText.indexOf('药') > -1) {
          taskIcon = '💊'; taskColor = 'rgba(255,69,58,0.08)'; taskBorder = 'rgba(255,69,58,0.2)';
        } else if (taskText.indexOf('睡') > -1 || taskText.indexOf('起') > -1) {
          taskIcon = '🌙'; taskColor = 'rgba(94,106,210,0.08)'; taskBorder = 'rgba(94,106,210,0.2)';
        } else if (taskText.indexOf('出门') > -1 || taskText.indexOf('去') > -1 || taskText.indexOf('走') > -1) {
          taskIcon = '🚶'; taskColor = 'rgba(52,199,89,0.08)'; taskBorder = 'rgba(52,199,89,0.2)';
        } else if (taskText.indexOf('写') > -1 || taskText.indexOf('学') > -1) {
          taskIcon = '📝'; taskColor = 'rgba(253,203,110,0.08)'; taskBorder = 'rgba(253,203,110,0.2)';
        }
        html += '<div class="youth-task-card" style="background:' + taskColor + ';border-color:' + taskBorder + ';">' +
          '<div class="youth-task-icon">' + taskIcon + '</div>' +
          '<div class="youth-task-body">' +
            '<button class="youth-task-listen-btn" data-speak-task="' + Utils.escapeHtml(msg.text) + '" title="点我听听要做什么">🔊 点我听听要做什么</button>' +
          '</div>' +
          '<button class="youth-task-star-btn" data-task-id="' + (msg.taskId || '') + '" title="完成" aria-label="完成">⭐</button>' +
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

    // 加载心青年任务卡片（统一任务系统）
    var tasks = Storage.getTodayTasks(state.youthId);
    var youthTasks = tasks.filter(function(t) {
      return (t.assigneeRole === 'youth' || t.assigneeId === state.youthId) && t.status !== 'done';
    });
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

  /**
   * TTS 朗读文本（委托给 YouthTTS 模块）
   */
  function _speak(text) {
    if (window.YouthTTS && typeof window.YouthTTS.speak === 'function') {
      window.YouthTTS.speak(text);
    }
  }

  /**
   * TTS 语音反馈（操作确认）
   */
  function _speakFeedback(text) {
    if (window.YouthTTS && typeof window.YouthTTS.speakFeedback === 'function') {
      window.YouthTTS.speakFeedback(text);
    }
  }

  /**
   * 停止 TTS 朗读
   */
  function _stopSpeaking() {
    if (window.YouthTTS && typeof window.YouthTTS.stop === 'function') {
      window.YouthTTS.stop();
    }
  }

  function _bindEvents() {
    var input = document.getElementById('youth-chat-input');
    var sendBtn = document.getElementById('youth-chat-send');
    var msgContainer = document.getElementById('youth-chat-messages');

    async function sendMessage() {
      var text = input.value.trim();
      if (!text) return;
      if (state.isAiCalling) return; // 防止重复发送

      // 停止当前朗读
      _stopSpeaking();

      state.messages.push({ role: 'user', text: text, timestamp: Utils.formatDateTime() });
      input.value = '';
      _saveMessages();
      msgContainer.innerHTML = _renderMessages();
      msgContainer.scrollTop = msgContainer.scrollHeight;

      // 显示"AI 正在输入"提示
      var typingBubble = document.createElement('div');
      typingBubble.className = 'chat-bubble chat-bubble-ai chat-bubble-typing';
      typingBubble.id = 'ai-typing';
      typingBubble.textContent = '…';
      msgContainer.appendChild(typingBubble);
      msgContainer.scrollTop = msgContainer.scrollHeight;

      state.isAiCalling = true;
      sendBtn.disabled = true;

      try {
        _loadDailyCount();
        var aiReply;
        if (state.dailyCallCount >= DAILY_LIMIT) {
          // 超额：降级到本地回复
          aiReply = '今天我们聊了很多啦，明天再继续好吗？😊';
          // 移除 typing，直接显示
          var typingEl = document.getElementById('ai-typing');
          if (typingEl) typingEl.remove();
        } else {
          // 流式渲染
          var typingEl2 = document.getElementById('ai-typing');
          if (typingEl2) typingEl2.remove();

          // 创建 streaming bubble
          var streamBubble = document.createElement('div');
          streamBubble.className = 'chat-bubble chat-bubble-ai chat-bubble-streaming';
          streamBubble.textContent = '…';  // 初始占位，首次 onToken 时被覆盖
          msgContainer.appendChild(streamBubble);

          aiReply = await _callAIStream(text, function(token, fullText) {
            streamBubble.innerHTML = Utils.escapeHtml(fullText).replace(/\n/g, '<br>');
            msgContainer.scrollTop = msgContainer.scrollHeight;
          });

          // finalize：markdown 渲染
          streamBubble.classList.remove('chat-bubble-streaming');
          streamBubble.innerHTML = window.ChatMarkdown.render(aiReply);
          _incrementDailyCount();
        }

        state.messages.push({ role: 'ai', text: aiReply, timestamp: Utils.formatDateTime() });
        // 提取 AI 发现并存储（保留原有发现抽取逻辑）
        var findings = _extractAIFinding(text);
        if (findings.length > 0) {
          _saveAIFindings(findings);
        }
        _saveMessages();
        msgContainer.innerHTML = _renderMessages();
        msgContainer.scrollTop = msgContainer.scrollHeight;
        // 自动朗读 AI 回复
        _speak(aiReply);
      } catch (e) {
        // 流式中断/失败：移除 typing/streamBubble，降级到本地回复
        var typingErr = document.getElementById('ai-typing');
        if (typingErr) typingErr.remove();
        var streamBubbleErr = msgContainer.querySelector('.chat-bubble-streaming');
        if (streamBubbleErr) streamBubbleErr.remove();
        var fallback = _generateAIReply(text);
        state.messages.push({ role: 'ai', text: fallback, timestamp: Utils.formatDateTime() });
        _saveMessages();
        msgContainer.innerHTML = _renderMessages();
        msgContainer.scrollTop = msgContainer.scrollHeight;
        console.warn('AI 调用失败，降级到本地回复', e);
      } finally {
        state.isAiCalling = false;
        sendBtn.disabled = false;
      }
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') sendMessage();
    });

    // 任务完成按钮（⭐）
    var doneBtns = msgContainer.querySelectorAll('.youth-task-star-btn');
    for (var i = 0; i < doneBtns.length; i++) {
      doneBtns[i].addEventListener('click', function() {
        var taskId = this.getAttribute('data-task-id');
        if (taskId) {
          Storage.updateTask(state.youthId, taskId, { status: 'done' });
          _speakFeedback('太棒了，任务完成啦！');
          // 移除任务卡片
          state.messages = state.messages.filter(function(m) { return m.taskId !== taskId; });
          _saveMessages();
          msgContainer.innerHTML = _renderMessages();
        }
      });
    }

    // 任务 🔊 朗读按钮
    var taskListenBtns = msgContainer.querySelectorAll('.youth-task-listen-btn');
    for (var j = 0; j < taskListenBtns.length; j++) {
      taskListenBtns[j].addEventListener('click', function(e) {
        e.stopPropagation();
        var taskText = this.getAttribute('data-speak-task');
        if (taskText) {
          _speak(taskText);
        }
      });
    }

    // AI 气泡 🔊 重播按钮
    var speakBtns = msgContainer.querySelectorAll('.chat-bubble-speak-btn');
    for (var k = 0; k < speakBtns.length; k++) {
      speakBtns[k].addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute('data-speak-idx'), 10);
        if (idx >= 0 && idx < state.messages.length) {
          var aiMsg = state.messages[idx];
          if (aiMsg && aiMsg.role === 'ai') {
            _speak(aiMsg.text);
          }
        }
      });
    }

    // 滚动到底部
    msgContainer.scrollTop = msgContainer.scrollHeight;

    // 微信式语音/文字切换
    var modeSwitch = document.getElementById('youth-mode-switch');
    var textModeEl = document.getElementById('youth-input-text-mode');
    var voiceModeEl = document.getElementById('youth-input-voice-mode');
    var holdBtn = document.getElementById('youth-voice-hold-btn');

    if (modeSwitch && textModeEl && voiceModeEl && holdBtn) {
      var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        modeSwitch.style.display = 'none';
      } else {
        var voiceModeOn = false;
        modeSwitch.addEventListener('click', function () {
          voiceModeOn = !voiceModeOn;
          if (voiceModeOn) {
            modeSwitch.textContent = '⌨️';
            textModeEl.style.display = 'none';
            voiceModeEl.style.display = 'flex';
          } else {
            modeSwitch.textContent = '🎤';
            voiceModeEl.style.display = 'none';
            textModeEl.style.display = 'flex';
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
              // 填入输入框并触发发送
              input.value = text;
              sendMessage();
            }
          };
          recognition.onerror = function (event) {
            hasError = true;
            console.error('YouthChat: 语音识别错误', event.error, event.message);
            _speakFeedback('没听清，再试一次吧');
            // 重置按钮状态
            holdBtn.classList.remove('holding', 'cancel');
            holdBtn.textContent = '按住 说话';
          };
          recognition.onend = function () {
            if (!cancelled && !hasResult && !hasError) {
              _speakFeedback('没听清，再试一次吧');
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
    }
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

  /**
   * 构建心青年档案摘要（脱敏，用于 System Prompt 注入）
   * 只包含姓名/年龄/兴趣/沟通特点，不包含身份证/医疗/住址等敏感字段
   */
  function _buildYouthProfileSummary() {
    var youths = Permissions.getAccessibleYouths();
    if (youths.length === 0) return {};
    var youth = youths[0];
    var age = youth.birthDate ? Utils.calculateAge(youth.birthDate) : null;

    // 从 modules 提取兴趣和沟通特点（如有）
    var interests = [];
    var communicationStyle = '';
    if (youth.modules) {
      if (youth.modules.lifePreferences && Array.isArray(youth.modules.lifePreferences.hobbies)) {
        interests = youth.modules.lifePreferences.hobbies.slice(0, 5);
      }
      if (youth.modules.communicationGuide && youth.modules.communicationGuide.preferredStyle) {
        communicationStyle = youth.modules.communicationGuide.preferredStyle;
      }
    }

    return {
      name: youth.name || '',
      age: age !== null ? String(age) + '岁' : '',
      interests: interests,
      communicationStyle: communicationStyle
    };
  }

  /**
   * 流式调用云端 AI（前端模拟流式）
   * @param {string} userText
   * @param {function} onToken - (token, fullText) 回调
   * @returns {Promise<string>} 完整回复
   */
  async function _callAIStream(userText, onToken) {
    var recent = state.messages.slice(-6).map(function(m) {
      return {
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text || ''
      };
    });

    var youthProfile = _buildYouthProfileSummary();

    var res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: recent,
        youthProfile: youthProfile
      })
    });

    if (!res.ok) {
      throw new Error('AI 接口返回 ' + res.status);
    }
    var data = await res.json();
    if (data.error) {
      throw new Error(data.error);
    }
    var reply = data.reply || '我没能理解，可以再说一次吗？😊';

    // 前端模拟流式：逐字符回调
    if (onToken) {
      var chars = Array.from(reply);
      var fullText = '';
      for (var i = 0; i < chars.length; i++) {
        fullText += chars[i];
        onToken(chars[i], fullText);
        await new Promise(function(r) { setTimeout(r, 30); });
      }
    }
    return reply;
  }

  /**
   * 每日调用计数（localStorage，按日期重置）
   */
  function _getDailyCountKey() {
    var d = new Date();
    var dateStr = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    return 'ai_dongwo_chat_count_' + state.youthId + '_' + dateStr;
  }

  function _loadDailyCount() {
    try {
      var raw = localStorage.getItem(_getDailyCountKey());
      state.dailyCallCount = raw ? parseInt(raw, 10) || 0 : 0;
    } catch (e) {
      state.dailyCallCount = 0;
    }
  }

  function _incrementDailyCount() {
    state.dailyCallCount++;
    try {
      localStorage.setItem(_getDailyCountKey(), String(state.dailyCallCount));
    } catch (e) {
      console.warn('保存调用计数失败', e);
    }
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
