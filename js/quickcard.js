/**
 * quickcard.js - 速读卡
 * 一页速览关键信息，支持按模块切换、复制文本
 * iOS 内嵌分组卡片风格
 */
window.QuickCard = (function () {
  'use strict';

  // 速读卡模块 = overview + Modules.MODULES（不含 relationshipMap）
  var MODULES = [
    { key: 'overview', label: '总览', icon: '📋' }
  ].concat(
    Modules.MODULES.filter(function (m) { return m.key !== 'relationshipMap'; })
  );

  var _currentModule = 'overview';

  /**
   * 渲染速读卡页
   */
  function renderQuickCard(params) {
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

    _currentModule = 'overview';
    _renderQuickCard(youth);
  }

  /**
   * 渲染速读卡 — iOS 风格
   */
  function _renderQuickCard(youth) {
    var container = App.getContainer();

    // 标签切换 — iOS 滚动 Chip
    var tabsHtml = '<div class="quickcard-tabs">';
    for (var i = 0; i < MODULES.length; i++) {
      tabsHtml += '<div class="quickcard-tab' + (MODULES[i].key === _currentModule ? ' active' : '') + '" data-module="' + MODULES[i].key + '">' +
        MODULES[i].icon + ' ' + MODULES[i].label +
      '</div>';
    }
    tabsHtml += '</div>';

    container.innerHTML =
      '<div class="page-header">' +
        '<button class="btn btn-sm btn-secondary" id="btn-back">← 返回</button>' +
        '<span class="page-title">' + Utils.escapeHtml(youth.name) + ' · 速读卡</span>' +
        '<span></span>' +
      '</div>' +
      '<div class="quickcard-page">' +
        tabsHtml +
        '<div class="quickcard-content" id="quickcard-content"></div>' +
        '<div class="quickcard-actions">' +
          '<button class="btn btn-secondary" id="btn-copy">📋 复制文本</button>' +
          '<button class="btn btn-outline" id="btn-print">🖨️ 打印</button>' +
        '</div>' +
        '<div class="quickcard-profile-link">' +
          '<button class="btn btn-primary btn-block" id="btn-full-profile">查看完整档案 →</button>' +
        '</div>' +
      '</div>';

    _renderModuleContent(youth, _currentModule);
    _bindEvents(youth);
  }

  /**
   * 渲染模块内容 — iOS 卡片分组风格
   */
  function _renderModuleContent(youth, moduleKey) {
    var contentEl = document.getElementById('quickcard-content');
    var html = '';

    if (moduleKey === 'overview') {
      html = _renderOverview(youth);
    } else if (moduleKey === 'communicationGuide') {
      html = _renderCommunicationGuide(youth);
    } else if (moduleKey === 'emotionBehavior') {
      html = _renderEmotionBehavior(youth);
    } else if (moduleKey === 'careMedical') {
      html = _renderCareMedical(youth);
    } else if (moduleKey === 'workSupport') {
      html = _renderWorkSupport(youth);
    }

    contentEl.innerHTML = html || '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-desc">暂无数据</div></div>';
  }

  /**
   * 渲染总览 — iOS 卡片分组
   */
  function _renderOverview(youth) {
    var age = Utils.calculateAge(youth.birthDate);
    var genderLabel = youth.gender === 'male' ? '男' : youth.gender === 'female' ? '女' : '其他';
    var m = youth.modules;

    var html = '';

    // 基本信息卡片
    html += '<div class="ios-card-group">' +
      '<div class="quickcard-section">' +
        '<div class="quickcard-section-title">基本档案</div>' +
      '</div>' +
      '<div class="quickcard-item">' +
        '<div class="quickcard-item-icon">👤</div>' +
        '<div class="quickcard-item-text">' + Utils.escapeHtml(youth.name) + ' · ' + age + '岁 · ' + genderLabel + '</div>' +
      '</div>' +
    '</div>';

    // 紧急联系人卡片
    if (youth.emergencyContacts && youth.emergencyContacts.length > 0) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section">' +
          '<div class="quickcard-section-title">🚨 紧急联系人</div>' +
        '</div>';
      for (var i = 0; i < youth.emergencyContacts.length; i++) {
        var c = youth.emergencyContacts[i];
        html += '<div class="quickcard-item">' +
          '<div class="quickcard-item-icon">📞</div>' +
          '<div class="quickcard-item-text">' + Utils.escapeHtml(c.name) + '（' + Utils.escapeHtml(c.relation || '') + '）' + Utils.escapeHtml(c.phone) + '</div>' +
        '</div>';
      }
      html += '</div>';
    }

    // 过敏源卡片
    if (m.careMedical && m.careMedical.allergies && m.careMedical.allergies.length > 0) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section">' +
          '<div class="quickcard-section-title">⚠️ 过敏源</div>' +
        '</div>' +
        '<div class="quickcard-item">' +
          '<div class="quickcard-item-icon">⚠️</div>' +
          '<div class="quickcard-item-text">' + m.careMedical.allergies.map(Utils.escapeHtml).join('、') + '</div>' +
        '</div>' +
      '</div>';
    }

    // 行为红线卡片
    if (m.emotionBehavior && m.emotionBehavior.behaviorRedLines && m.emotionBehavior.behaviorRedLines.length > 0) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section">' +
          '<div class="quickcard-section-title">🚫 行为红线</div>' +
        '</div>';
      for (var i = 0; i < m.emotionBehavior.behaviorRedLines.length; i++) {
        var r = m.emotionBehavior.behaviorRedLines[i];
        html += '<div class="quickcard-item">' +
          '<div class="quickcard-item-icon">🔴</div>' +
          '<div class="quickcard-item-text"><strong>' + Utils.escapeHtml(r.description) + '</strong><br><span style="color:var(--color-text-tertiary);font-size:var(--font-size-xs)">应对：' + Utils.escapeHtml(r.response) + '</span></div>' +
        '</div>';
      }
      html += '</div>';
    }

    // 沟通方式卡片
    if (m.communicationGuide && m.communicationGuide.preferredMethods && m.communicationGuide.preferredMethods.length > 0) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section">' +
          '<div class="quickcard-section-title">💬 沟通方式</div>' +
        '</div>';
      for (var i = 0; i < m.communicationGuide.preferredMethods.length; i++) {
        var method = m.communicationGuide.preferredMethods[i];
        html += '<div class="quickcard-item">' +
          '<div class="quickcard-item-icon">✅</div>' +
          '<div class="quickcard-item-text">' + Utils.escapeHtml(method.method) + '：' + Utils.escapeHtml(method.description || '') + '</div>' +
        '</div>';
      }
      html += '</div>';
    }

    return html;
  }

  /**
   * 渲染沟通说明书 — iOS 卡片分组
   */
  function _renderCommunicationGuide(youth) {
    var m = youth.modules.communicationGuide;
    if (!m) return '';
    var html = '';

    if (m.preferredMethods && m.preferredMethods.length > 0) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section"><div class="quickcard-section-title">💬 推荐沟通方式</div></div>';
      for (var i = 0; i < m.preferredMethods.length; i++) {
        html += '<div class="quickcard-item"><div class="quickcard-item-icon">✅</div><div class="quickcard-item-text"><strong>' + Utils.escapeHtml(m.preferredMethods[i].method) + '</strong>：' + Utils.escapeHtml(m.preferredMethods[i].description || '') + '</div></div>';
      }
      html += '</div>';
    }

    if (m.expressionDifficulties) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section"><div class="quickcard-section-title">🗣️ 表达困难</div></div>' +
        '<div class="quickcard-item"><div class="quickcard-item-icon">⚠️</div><div class="quickcard-item-text">' + Utils.escapeHtml(m.expressionDifficulties) + '</div></div>' +
      '</div>';
    }

    if (m.specialHabits && m.specialHabits.length > 0) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section"><div class="quickcard-section-title">📋 特殊习惯</div></div>' +
        '<div class="quickcard-item"><div class="quickcard-item-icon">📋</div><div class="quickcard-item-text">' + m.specialHabits.map(Utils.escapeHtml).join('、') + '</div></div>' +
      '</div>';
    }

    if (m.sensoryPreferences) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section"><div class="quickcard-section-title">👁️ 感官偏好</div></div>';
      if (m.sensoryPreferences.avoid && m.sensoryPreferences.avoid.length > 0) {
        html += '<div class="quickcard-item"><div class="quickcard-item-icon">🚫</div><div class="quickcard-item-text">避免：' + m.sensoryPreferences.avoid.map(Utils.escapeHtml).join('、') + '</div></div>';
      }
      if (m.sensoryPreferences.prefer && m.sensoryPreferences.prefer.length > 0) {
        html += '<div class="quickcard-item"><div class="quickcard-item-icon">✅</div><div class="quickcard-item-text">偏好：' + m.sensoryPreferences.prefer.map(Utils.escapeHtml).join('、') + '</div></div>';
      }
      html += '</div>';
    }

    return html;
  }

  /**
   * 渲染情绪与行为 — iOS 卡片分组
   */
  function _renderEmotionBehavior(youth) {
    var m = youth.modules.emotionBehavior;
    if (!m) return '';
    var html = '';

    if (m.behaviorRedLines && m.behaviorRedLines.length > 0) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section"><div class="quickcard-section-title">⚠️ 行为红线</div></div>';
      for (var i = 0; i < m.behaviorRedLines.length; i++) {
        var r = m.behaviorRedLines[i];
        var severityIcon = r.severity === 'high' ? '🔴' : r.severity === 'medium' ? '🟡' : '⚪';
        html += '<div class="quickcard-item"><div class="quickcard-item-icon">' + severityIcon + '</div><div class="quickcard-item-text"><strong>' + Utils.escapeHtml(r.description) + '</strong>';
        if (r.trigger) html += '<br><span style="color:var(--color-text-tertiary);font-size:var(--font-size-xs)">触发：' + Utils.escapeHtml(r.trigger) + '</span>';
        html += '<br><span style="color:var(--color-text-tertiary);font-size:var(--font-size-xs)">应对：' + Utils.escapeHtml(r.response) + '</span></div></div>';
      }
      html += '</div>';
    }

    if (m.emotionTrend && m.emotionTrend.length > 0) {
      var moodLabels = { great: '😀', good: '🙂', neutral: '😐', low: '😞', crisis: '🆘' };
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section"><div class="quickcard-section-title">📊 近期情绪</div></div>';
      var recent = m.emotionTrend.slice(-7);
      for (var i = 0; i < recent.length; i++) {
        var e = recent[i];
        html += '<div class="quickcard-item"><div class="quickcard-item-icon">' + (moodLabels[e.mood] || '😐') + '</div><div class="quickcard-item-text">' + e.date + (e.note ? ' - ' + Utils.escapeHtml(e.note) : '') + '</div></div>';
      }
      html += '</div>';
    }

    return html;
  }

  /**
   * 渲染照护与医疗 — iOS 卡片分组
   */
  function _renderCareMedical(youth) {
    var m = youth.modules.careMedical;
    if (!m) return '';
    var html = '';

    if (m.allergies && m.allergies.length > 0) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section"><div class="quickcard-section-title">⚠️ 过敏源</div></div>' +
        '<div class="quickcard-item"><div class="quickcard-item-icon">⚠️</div><div class="quickcard-item-text">' + m.allergies.map(Utils.escapeHtml).join('、') + '</div></div>' +
      '</div>';
    }

    if (m.medications && m.medications.length > 0) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section"><div class="quickcard-section-title">💊 用药记录</div></div>';
      for (var i = 0; i < m.medications.length; i++) {
        var med = m.medications[i];
        html += '<div class="quickcard-item"><div class="quickcard-item-icon">💊</div><div class="quickcard-item-text"><strong>' + Utils.escapeHtml(med.name) + '</strong>：' + Utils.escapeHtml(med.dosage) + ' ' + Utils.escapeHtml(med.frequency) + (med.notes ? '（' + Utils.escapeHtml(med.notes) + '）' : '') + '</div></div>';
      }
      html += '</div>';
    }

    if (m.medicalHistory && m.medicalHistory.length > 0) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section"><div class="quickcard-section-title">🏥 就医记录</div></div>';
      for (var i = 0; i < m.medicalHistory.length; i++) {
        var mh = m.medicalHistory[i];
        html += '<div class="quickcard-item"><div class="quickcard-item-icon">🏥</div><div class="quickcard-item-text">' + (mh.date || '') + ' ' + Utils.escapeHtml(mh.event) + (mh.facility ? ' @ ' + Utils.escapeHtml(mh.facility) : '') + '</div></div>';
      }
      html += '</div>';
    }

    // 日常作息（从 lifePreferences 拆分而来）
    if (m.dailyRoutine) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section"><div class="quickcard-section-title">⏰ 日常作息</div></div>' +
        '<div class="quickcard-item"><div class="quickcard-item-icon">🌅</div><div class="quickcard-item-text">起床：' + Utils.escapeHtml(m.dailyRoutine.wakeTime || '') + '</div></div>' +
        '<div class="quickcard-item"><div class="quickcard-item-icon">🍽️</div><div class="quickcard-item-text">用餐：' + (m.dailyRoutine.mealTimes || []).map(Utils.escapeHtml).join('、') + '</div></div>' +
        '<div class="quickcard-item"><div class="quickcard-item-icon">🌙</div><div class="quickcard-item-text">睡觉：' + Utils.escapeHtml(m.dailyRoutine.sleepTime || '') + '</div></div>' +
      '</div>';
    }

    return html;
  }

  /**
   * 渲染工作支持 — iOS 卡片分组
   */
  function _renderWorkSupport(youth) {
    var m = youth.modules.workSupport;
    if (!m) return '';
    var html = '';

    // 生活偏好（从 lifePreferences 拆分而来）
    if (m.favoriteActivities && m.favoriteActivities.length > 0) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section"><div class="quickcard-section-title">🎨 喜欢的活动</div></div>' +
        '<div class="quickcard-item"><div class="quickcard-item-icon">❤️</div><div class="quickcard-item-text">' + m.favoriteActivities.map(Utils.escapeHtml).join('、') + '</div></div>' +
      '</div>';
    }

    if (m.favoritePlaces && m.favoritePlaces.length > 0) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section"><div class="quickcard-section-title">📍 想去的地方</div></div>' +
        '<div class="quickcard-item"><div class="quickcard-item-icon">📍</div><div class="quickcard-item-text">' + m.favoritePlaces.map(Utils.escapeHtml).join('、') + '</div></div>' +
      '</div>';
    }

    if (m.futureWishes && m.futureWishes.length > 0) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section"><div class="quickcard-section-title">🌟 未来愿望</div></div>';
      for (var i = 0; i < m.futureWishes.length; i++) {
        html += '<div class="quickcard-item"><div class="quickcard-item-icon">🌟</div><div class="quickcard-item-text">' + Utils.escapeHtml(m.futureWishes[i].text) + '</div></div>';
      }
      html += '</div>';
    }

    if (m.ispPlans && m.ispPlans.length > 0) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section"><div class="quickcard-section-title">📋 ISP 计划</div></div>';
      for (var i = 0; i < m.ispPlans.length; i++) {
        var p = m.ispPlans[i];
        var statusLabels = { active: '🟢 进行中', completed: '✅ 已完成', paused: '⏸️ 已暂停' };
        html += '<div class="quickcard-item"><div class="quickcard-item-icon">📋</div><div class="quickcard-item-text"><strong>' + Utils.escapeHtml(p.title) + '</strong> ' + (statusLabels[p.status] || p.status) + '<br><span style="color:var(--color-text-tertiary);font-size:var(--font-size-xs)">目标：' + (p.goals || []).map(Utils.escapeHtml).join('、') + '</span></div></div>';
      }
      html += '</div>';
    }

    if (m.capabilityAssessment) {
      var ca = m.capabilityAssessment;
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section"><div class="quickcard-section-title">📊 能力评估</div></div>' +
        '<div class="quickcard-item"><div class="quickcard-item-icon">👥</div><div class="quickcard-item-text">社交互动：' + ca.socialInteraction + '/5</div></div>' +
        '<div class="quickcard-item"><div class="quickcard-item-icon">🧹</div><div class="quickcard-item-text">生活自理：' + ca.selfCare + '/5</div></div>' +
        '<div class="quickcard-item"><div class="quickcard-item-icon">💼</div><div class="quickcard-item-text">工作技能：' + ca.workSkills + '/5</div></div>' +
        '<div class="quickcard-item"><div class="quickcard-item-icon">🏘️</div><div class="quickcard-item-text">社区参与：' + ca.communityAccess + '/5</div></div>' +
        '<div class="quickcard-item"><div class="quickcard-item-icon">💬</div><div class="quickcard-item-text">沟通能力：' + ca.communication + '/5</div></div>' +
      '</div>';
    }

    if (m.workPreferences && m.workPreferences.length > 0) {
      html += '<div class="ios-card-group">' +
        '<div class="quickcard-section"><div class="quickcard-section-title">💼 就业偏好</div></div>' +
        '<div class="quickcard-item"><div class="quickcard-item-icon">💼</div><div class="quickcard-item-text">' + m.workPreferences.map(Utils.escapeHtml).join('、') + '</div></div>' +
      '</div>';
    }

    return html;
  }

  /**
   * 绑定事件
   */
  function _bindEvents(youth) {
    document.getElementById('btn-back').addEventListener('click', function () {
      window.location.hash = 'dashboard';
    });

    // 模块切换
    var tabs = document.querySelectorAll('.quickcard-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        for (var j = 0; j < tabs.length; j++) {
          tabs[j].classList.remove('active');
        }
        this.classList.add('active');
        _currentModule = this.getAttribute('data-module');
        _renderModuleContent(youth, _currentModule);
      });
    }

    // 复制文本
    document.getElementById('btn-copy').addEventListener('click', function () {
      var content = document.getElementById('quickcard-content');
      var text = content.innerText;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          AppState.showToast('已复制到剪贴板');
        });
      } else {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        AppState.showToast('已复制到剪贴板');
      }
    });

    // 打印
    document.getElementById('btn-print').addEventListener('click', function () {
      window.print();
    });

    // 查看完整档案
    var fullProfileBtn = document.getElementById('btn-full-profile');
    if (fullProfileBtn) {
      fullProfileBtn.addEventListener('click', function () {
        window.location.hash = 'profile?youthId=' + encodeURIComponent(youth.id);
      });
    }
  }

  return {
    renderQuickCard: renderQuickCard
  };
})();
