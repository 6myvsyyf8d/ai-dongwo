/**
 * join-request.js - 加入申请页
 * 扫码后渲染申请页，填写理由并提交申请
 * 依赖：Storage、AppState、Utils、Constants
 */
window.JoinRequest = (function () {
  'use strict';

  var _stylesInjected = false;

  function _injectStyles() {
    if (_stylesInjected) return;
    var style = document.createElement('style');
    style.textContent =
      '.join-relation-selector {' +
        'display: flex;' +
        'flex-wrap: wrap;' +
        'gap: 8px;' +
      '}' +
      '.join-relation-option {' +
        'padding: 8px 12px;' +
        'border-radius: 8px;' +
        'background: var(--color-bg-secondary);' +
        'font-size: 14px;' +
        'cursor: pointer;' +
        'text-align: center;' +
        'flex: 1 1 calc(33.333% - 8px);' +
        'min-width: 80px;' +
        'transition: all 0.2s ease;' +
      '}' +
      '.join-relation-option:hover {' +
        'opacity: 0.9;' +
      '}' +
      '.join-relation-option.selected {' +
        'background: var(--color-accent);' +
        'color: #fff;' +
      '}';
    document.head.appendChild(style);
    _stylesInjected = true;
  }

  function renderJoinPage(youthId) {
    _injectStyles();
    var container = App.getContainer();
    var youth = Storage.getProfile(youthId);
    if (!youth) {
      container.innerHTML = '<div class="page-content"><div class="empty-state">档案不存在</div></div>';
      return;
    }

    var user = AppState.currentUser;
    // 检查是否已有授权
    var grants = Storage.getAccessGrants(youthId);
    var hasAccess = grants.some(function (g) {
      return g.granteeId === user.id && g.status === 'active';
    });
    if (hasAccess) {
      AppState.selectYouth(youthId);
      window.location.hash = 'profile?youthId=' + encodeURIComponent(youthId);
      return;
    }

    // 检查是否已有 pending 申请
    var myRequests = Storage.getJoinRequestsByApplicant(user.id);
    var hasPending = myRequests.some(function (r) {
      return r.youthId === youthId && r.status === 'pending';
    });
    if (hasPending) {
      container.innerHTML = _renderPendingState(youth);
      _bindFormEvents(youth);
      return;
    }

    container.innerHTML = _renderApplyForm(youth);
    _bindFormEvents(youth);
  }

  function _renderApplyForm(youth) {
    var user = AppState.currentUser;
    var roleLabel = Constants.ROLE_LABELS[user.role] || user.role;
    var roleIcon = _getRoleIcon(user.role);

    var relationSection = '';
    if (user.role === 'parent') {
      var relationOptions = '';
      for (var i = 0; i < Constants.FAMILY_RELATION_LABELS.length; i++) {
        var rKey = Constants.FAMILY_RELATION_LABELS[i];
        var rLabel = Constants.FAMILY_RELATIONS[rKey];
        relationOptions += '<div class="join-relation-option" data-relation="' + rKey + '">' + rLabel + '</div>';
      }
      relationSection =
        '<div class="join-card">' +
          '<div class="join-section-label">您与孩子的关系（必填）</div>' +
          '<div class="join-relation-selector" id="join-relation">' +
            relationOptions +
          '</div>' +
        '</div>';
    }

    return '<div class="page-content join-page">' +
      '<div class="page-header">' +
        '<span class="page-title">📨 加入申请</span>' +
      '</div>' +
      '<div class="join-card">' +
        '<div class="join-youth-info">' +
          '<div class="join-youth-avatar">' + (youth.avatar || '🧑') + '</div>' +
          '<div class="join-youth-body">' +
            '<div class="join-youth-name">' + Utils.escapeHtml(youth.name) + '</div>' +
            '<div class="join-youth-meta">心青年档案</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="join-card">' +
        '<div class="join-section-label">您的信息</div>' +
        '<div class="join-applicant">' +
          '<div class="join-applicant-icon">' + roleIcon + '</div>' +
          '<div class="join-applicant-body">' +
            '<div class="join-applicant-name">' + Utils.escapeHtml(user.name) + '</div>' +
            '<div class="join-applicant-role">' + roleLabel + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      relationSection +
      '<div class="join-card">' +
        '<div class="join-section-label">申请理由</div>' +
        '<textarea class="join-reason-input" id="join-reason" placeholder="请简要说明申请理由（必填，最多100字）" maxlength="100" rows="3"></textarea>' +
        '<div class="join-reason-count"><span id="reason-count">0</span>/100</div>' +
      '</div>' +
      '<button class="join-submit-btn" id="btn-submit-join">发送申请</button>' +
    '</div>';
  }

  function _renderPendingState(youth) {
    return '<div class="page-content join-page">' +
      '<div class="page-header">' +
        '<span class="page-title">📨 加入申请</span>' +
      '</div>' +
      '<div class="join-pending-state">' +
        '<div class="join-pending-icon">⏳</div>' +
        '<div class="join-pending-title">申请审核中</div>' +
        '<div class="join-pending-text">您对 <strong>' + Utils.escapeHtml(youth.name) + '</strong> 的加入申请正在等待家长审批。</div>' +
        '<button class="btn-back" id="btn-back-dashboard">‹</button>' +
      '</div>' +
    '</div>';
  }

  function _bindFormEvents(youth) {
    var user = AppState.currentUser;
    var reasonInput = document.getElementById('join-reason');
    var countEl = document.getElementById('reason-count');
    if (reasonInput && countEl) {
      reasonInput.addEventListener('input', function () {
        countEl.textContent = this.value.length;
      });
    }

    var relationSelector = document.getElementById('join-relation');
    if (relationSelector) {
      var relationOptions = relationSelector.querySelectorAll('.join-relation-option');
      for (var i = 0; i < relationOptions.length; i++) {
        relationOptions[i].addEventListener('click', function () {
          for (var j = 0; j < relationOptions.length; j++) {
            relationOptions[j].classList.remove('selected');
          }
          this.classList.add('selected');
        });
      }
    }

    var submitBtn = document.getElementById('btn-submit-join');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        var reason = reasonInput.value.trim();
        if (!reason) {
          AppState.showToast('请填写申请理由');
          return;
        }

        var relation = null;
        if (user.role === 'parent') {
          var selectedOption = document.querySelector('.join-relation-option.selected');
          if (!selectedOption) {
            AppState.showToast('请选择您与孩子的关系');
            return;
          }
          relation = selectedOption.getAttribute('data-relation');
        }

        var request = {
          id: Utils.generateUUID(),
          youthId: youth.id,
          applicantId: user.id,
          applicantRole: user.role,
          reason: reason,
          relation: relation,
          status: 'pending',
          appliedAt: Utils.formatDateTime(),
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: null
        };
        var result = Storage.saveJoinRequest(request);
        if (result.success) {
          AppState.showToast('申请已发送，等待家长审批');
          window.location.hash = 'dashboard';
        } else if (result.error === 'JOIN_REQUEST_EXISTS') {
          AppState.showToast('您已有待审批的申请');
        } else {
          AppState.showToast('申请发送失败');
        }
      });
    }

    var backBtn = document.getElementById('btn-back-dashboard');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        history.back();
      });
    }
  }

  function _getRoleIcon(role) {
    for (var i = 0; i < Constants.ROLES.length; i++) {
      if (Constants.ROLES[i].value === role) return Constants.ROLES[i].icon;
    }
    return '👤';
  }

  return {
    renderJoinPage: renderJoinPage
  };
})();
