/**
 * quickcard.js - 速读卡（极简版）
 * 一页展示关键信息：基本信息、过敏源、行为红线、紧急联系人
 * iOS 风格紧凑卡片
 */
window.QuickCard = (function () {
  'use strict';

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

    if (!AppState.currentYouth || AppState.currentYouth.id !== youthId) {
      AppState.selectYouth(youthId);
    }

    if (!Permissions.canRead()) {
      App.getContainer().innerHTML = '<div class="page-content"><div class="permission-denied"><div class="permission-denied-icon">🔒</div><div class="permission-denied-title">无访问权限</div></div></div>';
      return;
    }

    _renderQuickCard(youth);
  }

  function _renderQuickCard(youth) {
    var container = App.getContainer();
    var age = Utils.calculateAge(youth.birthDate);
    var genderLabel = youth.gender === 'male' ? '男' : youth.gender === 'female' ? '女' : '其他';
    var m = youth.modules;

    var html = '';

    // 顶部：关闭按钮 + 标题
    html +=
      '<div class="page-header">' +
        '<button class="btn btn-sm btn-secondary" id="btn-close-quickcard">← 返回</button>' +
        '<span class="page-title">' + Utils.escapeHtml(youth.name) + ' · 速读卡</span>' +
        '<span></span>' +
      '</div>';

    html += '<div class="quickcard-page quickcard-compact" style="padding-bottom:80px;">';

    // 1. 基本信息
    html +=
      '<div class="ios-card-group">' +
        '<div class="quickcard-basic" style="display:flex;align-items:center;gap:10px;padding:8px 12px;">' +
          '<div class="quickcard-basic-avatar" style="font-size:28px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:var(--color-bg-secondary);border-radius:10px;">' + (youth.avatar || '🧑') + '</div>' +
          '<div class="quickcard-basic-info">' +
            '<div class="quickcard-basic-name" style="font-size:16px;font-weight:600;color:var(--color-text-primary);">' + Utils.escapeHtml(youth.name) + '</div>' +
            '<div class="quickcard-basic-meta" style="font-size:12px;color:var(--color-text-secondary);margin-top:1px;">' + age + '岁 · ' + genderLabel + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // 2. 过敏源
    if (m.careMedical && m.careMedical.allergies && m.careMedical.allergies.length > 0) {
      html +=
        '<div class="ios-card-group">' +
          '<div class="quickcard-section-header" style="display:flex;align-items:center;gap:6px;padding:6px 12px 2px;font-size:12px;font-weight:600;color:var(--color-text-secondary);">' +
            '<span class="quickcard-section-icon" style="font-size:13px;">⚠️</span>' +
            '<span class="quickcard-section-title">过敏源</span>' +
          '</div>' +
          '<div class="quickcard-item" style="padding:6px 12px;font-size:13px;line-height:1.4;color:var(--color-text-primary);">' +
            '<div class="quickcard-item-text">' + m.careMedical.allergies.map(Utils.escapeHtml).join('、') + '</div>' +
          '</div>' +
        '</div>';
    }

    // 3. 行为红线
    if (m.emotionBehavior && m.emotionBehavior.behaviorRedLines && m.emotionBehavior.behaviorRedLines.length > 0) {
      html +=
        '<div class="ios-card-group">' +
          '<div class="quickcard-section-header" style="display:flex;align-items:center;gap:6px;padding:6px 12px 2px;font-size:12px;font-weight:600;color:var(--color-text-secondary);">' +
            '<span class="quickcard-section-icon" style="font-size:13px;">🚫</span>' +
            '<span class="quickcard-section-title">行为红线</span>' +
          '</div>';
      for (var i = 0; i < m.emotionBehavior.behaviorRedLines.length; i++) {
        var r = m.emotionBehavior.behaviorRedLines[i];
        html +=
          '<div class="quickcard-item" style="padding:6px 12px;font-size:13px;line-height:1.4;color:var(--color-text-primary);">' +
            '<div class="quickcard-item-text">' +
              '<strong>' + Utils.escapeHtml(r.description) + '</strong>' +
              (r.response ? '<br><span class="quickcard-item-sub" style="font-size:11px;color:var(--color-text-tertiary);">应对：' + Utils.escapeHtml(r.response) + '</span>' : '') +
            '</div>' +
          '</div>';
      }
      html += '</div>';
    }

    // 4. 紧急联系人（放最后）
    if (youth.emergencyContacts && youth.emergencyContacts.length > 0) {
      html +=
        '<div class="ios-card-group">' +
          '<div class="quickcard-section-header" style="display:flex;align-items:center;gap:6px;padding:6px 12px 2px;font-size:12px;font-weight:600;color:var(--color-text-secondary);">' +
            '<span class="quickcard-section-icon" style="font-size:13px;">🚨</span>' +
            '<span class="quickcard-section-title">紧急联系人</span>' +
          '</div>';
      for (var i = 0; i < youth.emergencyContacts.length; i++) {
        var c = youth.emergencyContacts[i];
        html +=
          '<div class="quickcard-item" style="padding:6px 12px;font-size:13px;line-height:1.4;color:var(--color-text-primary);">' +
            '<div class="quickcard-item-text">' +
              Utils.escapeHtml(c.name) + '（' + Utils.escapeHtml(c.relation || '') + '）' +
              '<br><span class="quickcard-item-sub" style="font-size:11px;color:var(--color-text-tertiary);">📞 ' + Utils.escapeHtml(c.phone) + '</span>' +
            '</div>' +
          '</div>';
      }
      html += '</div>';
    }

    // 底部：查看完整档案
    html +=
      '<div class="quickcard-footer" style="position:fixed;bottom:0;left:0;right:0;padding:12px 16px;background:var(--color-bg-primary);border-top:0.5px solid var(--color-border);padding-bottom:calc(12px + env(safe-area-inset-bottom));">' +
        '<button class="btn btn-primary btn-block" id="btn-full-profile">查看完整档案 →</button>' +
      '</div>';

    html += '</div>';

    container.innerHTML = html;
    _bindEvents(youth);
  }

  function _bindEvents(youth) {
    document.getElementById('btn-close-quickcard').addEventListener('click', function () {
      history.back();
    });

    document.getElementById('btn-full-profile').addEventListener('click', function () {
      window.location.hash = 'profile?youthId=' + encodeURIComponent(youth.id);
    });
  }

  return {
    renderQuickCard: renderQuickCard
  };
})();
