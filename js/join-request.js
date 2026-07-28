/**
 * join-request.js - 加入申请页
 * 扫码后渲染申请页，填写理由并提交申请
 * 依赖：Storage、AppState、Utils、Constants
 */
window.JoinRequest = (function () {
  'use strict';

  function renderJoinPage(youthId) {
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
        '<button class="join-back-btn" id="btn-back-dashboard">返回首页</button>' +
      '</div>' +
    '</div>';
  }

  function _bindFormEvents(youth) {
    var reasonInput = document.getElementById('join-reason');
    var countEl = document.getElementById('reason-count');
    if (reasonInput && countEl) {
      reasonInput.addEventListener('input', function () {
        countEl.textContent = this.value.length;
      });
    }

    var submitBtn = document.getElementById('btn-submit-join');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        var reason = reasonInput.value.trim();
        if (!reason) {
          AppState.showToast('请填写申请理由');
          return;
        }
        var user = AppState.currentUser;
        var request = {
          id: Utils.generateUUID(),
          youthId: youth.id,
          applicantId: user.id,
          applicantRole: user.role,
          reason: reason,
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
        window.location.hash = 'dashboard';
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
