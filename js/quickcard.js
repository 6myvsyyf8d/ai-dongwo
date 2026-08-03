/**
 * quickcard.js - 速读卡（极简版）
 * 一页展示关键信息：基本信息、过敏源、行为红线、紧急联系人
 * iOS 风格紧凑卡片
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
      // 扫码场景：检查是否已授权
      var grants = Storage.getAccessGrants(youth.id);
      hasAccess = grants.some(function (g) {
        return g.granteeId === user.id && g.status === 'active';
      });
      // 老师/照护者可以申请加入
      if (!hasAccess && (user.role === 'teacher' || user.role === 'caregiver')) {
        canApply = true;
      }
    }

    var html = '';

    // 顶部：关闭按钮 + 标题
    html +=
      '<div class="page-header">' +
        '<button class="btn-back" id="btn-close-quickcard">‹</button>' +
        '<span class="page-title">速读卡</span>' +
        '<span></span>' +
      '</div>';

    html += '<div class="quickcard-page quickcard-redesign">';

    // ---- 头部：头像 + 姓名 + 基本信息 ----
    html += '<div class="qc-hero">' +
      '<div class="qc-hero-avatar">' + avatar + '</div>' +
      '<div class="qc-hero-info">' +
        '<div class="qc-hero-name">' + Utils.escapeHtml(youth.name) + '</div>' +
        '<div class="qc-hero-meta">' + age + '岁 · ' + genderLabel + '</div>' +
      '</div>' +
    '</div>';

    // ---- 过敏源 ----
    if (m.careMedical && m.careMedical.allergies && m.careMedical.allergies.length > 0) {
      html += '<div class="qc-card qc-card-allergy">' +
        '<div class="qc-card-accent"></div>' +
        '<div class="qc-card-body">' +
          '<div class="qc-card-header">' +
            '<span class="qc-card-icon">⚠️</span>' +
            '<span class="qc-card-title">过敏源</span>' +
          '</div>' +
          '<div class="qc-card-content">' +
            m.careMedical.allergies.map(function(a) { return '<span class="qc-tag qc-tag-danger">' + Utils.escapeHtml(a) + '</span>'; }).join('') +
          '</div>' +
        '</div>' +
      '</div>';
    }

    // ---- 行为红线 ----
    if (m.emotionBehavior && m.emotionBehavior.behaviorRedLines && m.emotionBehavior.behaviorRedLines.length > 0) {
      html += '<div class="qc-card qc-card-redline">' +
        '<div class="qc-card-accent"></div>' +
        '<div class="qc-card-body">' +
          '<div class="qc-card-header">' +
            '<span class="qc-card-icon">🚫</span>' +
            '<span class="qc-card-title">行为红线</span>' +
          '</div>' +
          '<div class="qc-card-content">';
      for (var i = 0; i < m.emotionBehavior.behaviorRedLines.length; i++) {
        var r = m.emotionBehavior.behaviorRedLines[i];
        html += '<div class="qc-redline-item">' +
          '<div class="qc-redline-desc">' + Utils.escapeHtml(r.description) + '</div>' +
          (r.response ? '<div class="qc-redline-response">应对：' + Utils.escapeHtml(r.response) + '</div>' : '') +
        '</div>';
      }
      html += '</div></div></div>';
    }

    // ---- 紧急联系人 ----
    if (youth.emergencyContacts && youth.emergencyContacts.length > 0) {
      html += '<div class="qc-card qc-card-emergency">' +
        '<div class="qc-card-accent"></div>' +
        '<div class="qc-card-body">' +
          '<div class="qc-card-header">' +
            '<span class="qc-card-icon">🚨</span>' +
            '<span class="qc-card-title">紧急联系人</span>' +
          '</div>' +
          '<div class="qc-card-content">';
      for (var i = 0; i < youth.emergencyContacts.length; i++) {
        var c = youth.emergencyContacts[i];
        html += '<a class="qc-emergency-item" href="tel:' + Utils.escapeHtml(c.phone) + '">' +
          '<div class="qc-emergency-info">' +
            '<span class="qc-emergency-name">' + Utils.escapeHtml(c.name) + '</span>' +
            '<span class="qc-emergency-relation">' + Utils.escapeHtml(c.relation || '') + '</span>' +
          '</div>' +
          '<span class="qc-emergency-phone">📞 ' + Utils.escapeHtml(c.phone) + '</span>' +
        '</a>';
      }
      html += '</div></div></div>';
    }

    // ---- 底部操作 ----
    html += '<div class="qc-footer">';
    if (viaScan) {
      if (hasAccess) {
        html += '<button class="qc-btn-primary" id="btn-full-profile">查看完整档案 →</button>';
      } else if (canApply) {
        html += '<button class="qc-btn-primary" id="btn-apply-join">📝 申请加入家庭</button>';
      }
      // 志愿者等其他角色：不显示任何操作按钮，仅查看速读卡
    } else {
      html += '<button class="qc-btn-primary" id="btn-full-profile">查看完整档案 →</button>';
    }
    html += '</div>';

    html += '</div>';

    container.innerHTML = html;
    _bindEvents(youth, viaScan);
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
