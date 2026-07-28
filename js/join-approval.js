/**
 * join-approval.js - 家长审批加入申请
 * 显示申请列表，同意/拒绝
 * 依赖：Storage、AppState、Permissions、Utils、Constants
 */
window.JoinApproval = (function () {
  'use strict';

  function renderApprovalPage() {
    var user = AppState.currentUser;
    if (user.role !== 'parent' && user.role !== 'admin') {
      window.location.hash = 'dashboard';
      return;
    }

    var container = App.getContainer();
    var accessibleYouths = Permissions.getAccessibleYouths();
    var allRequests = [];

    for (var i = 0; i < accessibleYouths.length; i++) {
      var requests = Storage.getJoinRequests(accessibleYouths[i].id);
      for (var j = 0; j < requests.length; j++) {
        allRequests.push(requests[j]);
      }
    }

    allRequests.sort(function (a, b) {
      return b.appliedAt.localeCompare(a.appliedAt);
    });

    var pendingCount = allRequests.filter(function (r) { return r.status === 'pending'; }).length;

    var html = '<div class="page-content">' +
      '<div class="page-header">' +
        '<span class="page-title">📋 申请审批' +
          (pendingCount > 0 ? '<span class="approval-badge">' + pendingCount + '</span>' : '') +
        '</span>' +
      '</div>';

    if (allRequests.length === 0) {
      html += '<div class="approval-empty">暂无加入申请</div>';
    } else {
      html += '<div class="approval-list">';
      for (var i = 0; i < allRequests.length; i++) {
        var r = allRequests[i];
        var youth = Storage.getProfile(r.youthId);
        var youthName = youth ? youth.name : '未知';
        var applicant = Storage.getAccount(r.applicantId);
        var applicantName = applicant ? applicant.name : '未知用户';
        var roleLabel = Constants.ROLE_LABELS[r.applicantRole] || r.applicantRole;
        var roleIcon = _getRoleIcon(r.applicantRole);

        html += '<div class="approval-item" data-request-id="' + r.id + '">' +
          '<div class="approval-item-header">' +
            '<div class="approval-item-youth">档案：' + Utils.escapeHtml(youthName) + '</div>' +
            '<span class="approval-status-' + r.status + '">' + _statusLabel(r.status) + '</span>' +
          '</div>' +
          '<div class="approval-item-body">' +
            '<div class="approval-applicant">' +
              '<div class="approval-applicant-icon">' + roleIcon + '</div>' +
              '<div class="approval-applicant-info">' +
                '<div class="approval-applicant-name">' + Utils.escapeHtml(applicantName) + '</div>' +
                '<div class="approval-applicant-role">' + roleLabel + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="approval-reason">' + Utils.escapeHtml(r.reason) + '</div>' +
            '<div class="approval-time">' + Utils.formatDisplay(r.appliedAt) + '</div>' +
          '</div>';

        if (r.status === 'pending') {
          html += '<div class="approval-actions">' +
            '<button class="approval-reject-btn" data-request-id="' + r.id + '">拒绝</button>' +
            '<button class="approval-approve-btn" data-request-id="' + r.id + '">同意</button>' +
          '</div>';
        } else if (r.reviewedAt) {
          html += '<div class="approval-reviewed">审批于 ' + Utils.formatDisplay(r.reviewedAt) + '</div>';
        }

        html += '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    _bindApprovalButtons();
  }

  function _bindApprovalButtons() {
    var approveBtns = document.querySelectorAll('.approval-approve-btn');
    for (var i = 0; i < approveBtns.length; i++) {
      approveBtns[i].addEventListener('click', function () {
        var requestId = this.getAttribute('data-request-id');
        _approveRequest(requestId);
      });
    }

    var rejectBtns = document.querySelectorAll('.approval-reject-btn');
    for (var i = 0; i < rejectBtns.length; i++) {
      rejectBtns[i].addEventListener('click', function () {
        var requestId = this.getAttribute('data-request-id');
        _rejectRequest(requestId);
      });
    }
  }

  function _approveRequest(requestId) {
    var allRequests = Storage.getJoinRequests();
    var request = null;
    for (var i = 0; i < allRequests.length; i++) {
      if (allRequests[i].id === requestId) {
        request = allRequests[i];
        break;
      }
    }
    if (!request || request.status !== 'pending') return;

    // 刷新权限缓存：审批前需要选中目标心青年
    AppState.selectYouth(request.youthId);

    // 调用 Permissions.grantAccess 自动建立授权
    var result = Permissions.grantAccess(request.youthId, request.applicantId, request.applicantRole, null);
    if (result.success) {
      Storage.updateJoinRequest(requestId, {
        status: 'approved',
        reviewedAt: Utils.formatDateTime(),
        reviewedBy: AppState.currentUser.id,
        reviewNote: null
      });
      AppState.showToast('已同意申请，授权已建立');
      renderApprovalPage();
    } else {
      AppState.showToast('授权失败：' + (result.error || '未知错误'));
    }
  }

  function _rejectRequest(requestId) {
    var allRequests = Storage.getJoinRequests();
    var request = null;
    for (var i = 0; i < allRequests.length; i++) {
      if (allRequests[i].id === requestId) {
        request = allRequests[i];
        break;
      }
    }
    if (!request || request.status !== 'pending') return;

    Storage.updateJoinRequest(requestId, {
      status: 'rejected',
      reviewedAt: Utils.formatDateTime(),
      reviewedBy: AppState.currentUser.id
    });
    AppState.showToast('已拒绝申请');
    renderApprovalPage();
  }

  function _statusLabel(status) {
    var labels = { pending: '待审批', approved: '已同意', rejected: '已拒绝' };
    return labels[status] || status;
  }

  function _getRoleIcon(role) {
    for (var i = 0; i < Constants.ROLES.length; i++) {
      if (Constants.ROLES[i].value === role) return Constants.ROLES[i].icon;
    }
    return '👤';
  }

  return {
    renderApprovalPage: renderApprovalPage
  };
})();
