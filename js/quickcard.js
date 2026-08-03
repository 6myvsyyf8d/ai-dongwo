/**
 * quickcard.js - 速读卡（场景卡片版）
 * 以「认识他 → 场景卡片」格式展示，让志愿者快速上手
 * 内容：Hero区、爱好、沟通方式卡、特殊习惯卡、行为红线场景卡
 */
window.QuickCard = (function () {
  'use strict';

  function renderQuickCard(params) {
    var youthId = params.youthId;
    var viaScan = params.via === 'scan'; // 是否通过扫码访问

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

    // 扫码访问：放开权限校验，任何人都能看速读卡
    if (!viaScan && !Permissions.canRead()) {
      App.getContainer().innerHTML = '<div class="page-content"><div class="permission-denied"><div class="permission-denied-icon">🔒</div><div class="permission-denied-title">无访问权限</div></div></div>';
      return;
    }

    if (!AppState.currentYouth || AppState.currentYouth.id !== youthId) {
      AppState.selectYouth(youthId);
    }

    _renderQuickCard(youth, viaScan);
  }

  // 渲染两段式小知识：关于他 + 孤独症共性
  function _renderTip(about, common) {
    var h = '';
    if (about || common) {
      h += '<div class="qc-scene-tip">';
      if (about) {
        h += '<div class="qc-scene-tip-row">' +
          '<span class="qc-scene-tip-icon">💡</span>' +
          '<span class="qc-scene-tip-label">关于他</span>' +
          '<span class="qc-scene-tip-text">' + Utils.escapeHtml(about) + '</span>' +
        '</div>';
      }
      if (common) {
        h += '<div class="qc-scene-tip-row">' +
          '<span class="qc-scene-tip-icon qc-scene-tip-icon-hidden">💡</span>' +
          '<span class="qc-scene-tip-label">小知识</span>' +
          '<span class="qc-scene-tip-text">' + Utils.escapeHtml(common) + '</span>' +
        '</div>';
      }
      h += '</div>';
    }
    return h;
  }

  function _renderQuickCard(youth, viaScan) {
    var container = App.getContainer();
    var age = Utils.calculateAge(youth.birthDate);
    var genderLabel = youth.gender === 'male' ? '男' : youth.gender === 'female' ? '女' : '其他';
    var m = youth.modules;
    var avatar = youth.avatar || '🌟';

    // 判断当前用户是否已有授权
    var user = AppState.currentUser;
    var hasAccess = false;
    var canApply = false;
    if (user && viaScan) {
      var grants = Storage.getAccessGrants(youth.id);
      hasAccess = grants.some(function (g) {
        return g.granteeId === user.id && g.status === 'active';
      });
      if (!hasAccess && (user.role === 'teacher' || user.role === 'caregiver')) {
        canApply = true;
      }
    }

    var html = '';

    // 顶部：关闭按钮 + 标题
    html +=
      '<div class="page-header">' +
        '<button class="btn-back" id="btn-close-quickcard">‹</button>' +
        '<span class="page-title">志愿者速读卡</span>' +
        '<span></span>' +
      '</div>';

    html += '<div class="quickcard-page quickcard-redesign">';

    // ---- 1. 身份卡：渐变头部 ----
    var introText = _buildQuickcardIntro(youth, m);
    html += '<section class="qc-person">' +
      '<div class="qc-person-avatar">' + avatar + '</div>' +
      '<div>' +
        '<div class="qc-person-name">' + Utils.escapeHtml(youth.name) + '</div>' +
        '<div class="qc-person-meta">' + age + '岁 · 第一次见面请叫我"' + Utils.escapeHtml(youth.name) + '"</div>' +
        '<div class="qc-person-intro">' + Utils.escapeHtml(introText) + '</div>' +
      '</div>' +
    '</section>';

    // ---- 2. 提示条 ----
    html += '<div class="qc-notice">⏱️ 1分钟认识我 · 现场支持版</div>';

    // ---- 3. 你可能会看到 ----
    var facts = _buildQuickcardFacts(m);
    if (facts.length > 0) {
      html += '<section class="qc-section">' +
        '<div class="qc-section-title">👀 你可能会看到</div>' +
        '<div class="qc-facts">' +
          facts.map(function (f) {
            return '<div class="qc-fact"><b>' + Utils.escapeHtml(f.label) + '</b>' + Utils.escapeHtml(f.text) + '</div>';
          }).join('') +
        '</div>' +
      '</section>';
    }

    // ---- 4. 请这样支持我 ----
    var steps = _buildQuickcardSteps(m);
    var sayText = _buildQuickcardSay(m);
    if (steps.length > 0 || sayText) {
      html += '<section class="qc-section">' +
        '<div class="qc-section-title">🤝 请这样支持我</div>' +
        '<div class="qc-steps">' +
          steps.map(function (s, i) {
            return '<div class="qc-step"><span class="qc-step-num">' + (i + 1) + '</span><span>' + Utils.escapeHtml(s) + '</span></div>';
          }).join('') +
        '</div>';
      if (sayText) {
        html += '<div class="qc-say"><b>可以这样说：</b>"' + Utils.escapeHtml(sayText) + '"</div>';
      }
      html += '</section>';
    }

    // ---- 5. 请避免 ----
    var dontText = _buildQuickcardDont(m);
    if (dontText) {
      html += '<div class="qc-dont"><b>⚠️ 请避免</b>' + Utils.escapeHtml(dontText) + '</div>';
    }

    // ---- 6. 孤独症小知识 ----
    html += '<div class="qc-knowledge"><b>💡 孤独症小知识</b><br>重复提问可能是在确认安排、缓解对未知的焦虑，并非故意捣乱。每位孤独症青年都不一样，请以本人的支持卡为准。</div>';

    // ---- 7. 紧急联系人 ----
    if (youth.emergencyContacts && youth.emergencyContacts.length > 0) {
      var ec = youth.emergencyContacts[0];
      html += '<div class="qc-emergency"><span>需要协助时联系：' + Utils.escapeHtml(ec.name) + '</span>' +
        '<a class="qc-call" href="tel:' + Utils.escapeHtml(ec.phone) + '">查看联系人</a></div>';
    }

    // ---- 底部操作 ----
    html += '<div class="qc-footer">';
    if (viaScan) {
      if (hasAccess) {
        html += '<button class="qc-btn-primary" id="btn-full-profile">查看完整档案 →</button>';
      } else if (canApply) {
        html += '<button class="qc-btn-primary" id="btn-apply-join">📝 申请加入家庭</button>';
      }
    } else {
      html += '<button class="qc-btn-primary" id="btn-full-profile">查看完整档案 →</button>';
    }
    html += '</div>';

    html += '<div class="qc-footer-note">AI懂我 · 动态支持档案演示版</div>';
    html += '</div>';

    container.innerHTML = html;
    _bindEvents(youth, viaScan);
  }

  // 构建身份卡简介
  function _buildQuickcardIntro(youth, m) {
    var ws = m.workSupport || {};
    var prefs = ws.workPreferences || [];
    var favActs = ws.favoriteActivities || [];
    var allLikes = prefs.concat(favActs);
    if (allLikes.length > 0) {
      return '我喜欢' + allLikes.slice(0, 2).join('和') + '。清楚、稳定的安排会让我更安心。';
    }
    return '我喜欢烘焙和公交车。清楚、稳定的安排会让我更安心。';
  }

  // 构建「你可能会看到」事实
  function _buildQuickcardFacts(m) {
    var facts = [];
    var cg = m.communicationGuide;
    var eb = m.emotionBehavior;

    if (cg && cg.expressionDifficulties) {
      facts.push({ label: '回应较慢', text: cg.expressionDifficulties });
    } else {
      facts.push({ label: '回应较慢', text: '听到问题后，可能过几秒才回答。' });
    }

    if (eb && eb.behaviorRedLines && eb.behaviorRedLines.length > 0) {
      var r = eb.behaviorRedLines[0];
      facts.push({ label: '重复询问', text: r.trigger || '会多次问"接下来做什么、几点回家"。' });
    } else {
      facts.push({ label: '重复询问', text: '会多次问"接下来做什么、几点回家"。' });
    }

    return facts;
  }

  // 构建支持步骤
  function _buildQuickcardSteps(m) {
    var cg = m.communicationGuide;
    var steps = [];
    if (cg && cg.preferredMethods && cg.preferredMethods.length > 0) {
      cg.preferredMethods.forEach(function (pm) {
        if (pm.description) steps.push(pm.description);
      });
    }
    if (steps.length === 0) {
      steps = [
        '一次只说一件事，使用简短、具体的话。',
        '说完后等待约10秒，不要连续催促。',
        '我重复询问时，指给我看活动流程。'
      ];
    }
    return steps.slice(0, 3);
  }

  // 构建「可以这样说」
  function _buildQuickcardSay(m) {
    var cg = m.communicationGuide;
    if (cg && cg.preferredMethods && cg.preferredMethods.length > 0) {
      var pm = cg.preferredMethods[0];
      return pm.description || '我们一步一步来。';
    }
    return null;
  }

  // 构建「请避免」
  function _buildQuickcardDont(m) {
    var cg = m.communicationGuide;
    if (cg && cg.sensoryPreferences && cg.sensoryPreferences.avoid && cg.sensoryPreferences.avoid.length > 0) {
      return '避免' + cg.sensoryPreferences.avoid.join('、') + '。也不要说"怎么又问""不是告诉过你了吗"，不要多人同时向我解释。';
    }
    return '不要说"怎么又问""不是告诉过你了吗"，也不要多人同时向我解释。';
  }

  function _bindEvents(youth, viaScan) {
    document.getElementById('btn-close-quickcard').addEventListener('click', function () {
      history.back();
    });

    var fullProfileBtn = document.getElementById('btn-full-profile');
    if (fullProfileBtn) {
      fullProfileBtn.addEventListener('click', function () {
        window.location.hash = 'profile?youthId=' + encodeURIComponent(youth.id);
      });
    }

    var applyJoinBtn = document.getElementById('btn-apply-join');
    if (applyJoinBtn) {
      applyJoinBtn.addEventListener('click', function () {
        window.location.hash = 'join?youthId=' + encodeURIComponent(youth.id);
      });
    }
  }

  return {
    renderQuickCard: renderQuickCard
  };
})();
