# 以心青年为中心的协作网络 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现以心青年为中心的协作网络：家长创建档案并通过档案码邀请其他角色，其他角色扫码申请加入，家长审批后自动建立授权。

**Architecture:** 新增 JoinRequest 实体和 CRUD 方法到 storage.js；新增 join-request.js（申请页+扫码入口）和 join-approval.js（家长审批列表）；修改 archive-code.js 扫码后按角色分流；修改 app.js 注册路由并检测游离状态。

**Tech Stack:** Vanilla JS, localStorage, IIFE 模块模式, Apple 设计系统 CSS 变量

---

### Task 1: Storage 层 — JoinRequest CRUD

**Files:**
- Modify: `js/storage.js`

- [ ] **Step 1: 在 storage.js 中新增 JoinRequest 存储方法**

在 `storage.js` 的 AccessGrant 部分之后，添加 JoinRequest CRUD 方法：

```javascript
// ==================== JoinRequest ====================

function getJoinRequests(youthId) {
  var all = _get('ai_dongwo_join_requests', []);
  if (youthId) {
    return all.filter(function (r) { return r.youthId === youthId; });
  }
  return all;
}

function getJoinRequestsByApplicant(applicantId) {
  var all = _get('ai_dongwo_join_requests', []);
  return all.filter(function (r) { return r.applicantId === applicantId; });
}

function getPendingJoinRequests(youthId) {
  var all = _get('ai_dongwo_join_requests', []);
  return all.filter(function (r) {
    return r.status === 'pending' && (!youthId || r.youthId === youthId);
  });
}

function saveJoinRequest(request) {
  var all = _get('ai_dongwo_join_requests', []);
  // 检查是否已有 pending 申请（同一 user + 同一 youth）
  var existing = all.filter(function (r) {
    return r.applicantId === request.applicantId &&
           r.youthId === request.youthId &&
           r.status === 'pending';
  });
  if (existing.length > 0) {
    return { success: false, error: 'JOIN_REQUEST_EXISTS' };
  }
  all.push(request);
  _set('ai_dongwo_join_requests', all);
  return { success: true };
}

function updateJoinRequest(id, updates) {
  var all = _get('ai_dongwo_join_requests', []);
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) {
      for (var key in updates) {
        all[i][key] = updates[key];
      }
      break;
    }
  }
  _set('ai_dongwo_join_requests', all);
}
```

- [ ] **Step 2: 在 storage.js 的 return 对象中暴露新方法**

在 `return` 对象中添加：

```javascript
// JoinRequest
getJoinRequests: getJoinRequests,
getJoinRequestsByApplicant: getJoinRequestsByApplicant,
getPendingJoinRequests: getPendingJoinRequests,
saveJoinRequest: saveJoinRequest,
updateJoinRequest: updateJoinRequest,
```

- [ ] **Step 3: 提交**

```bash
git add js/storage.js
git commit -m "feat: Storage 层新增 JoinRequest CRUD"
```

---

### Task 2: constants.js 和 app.js 路由注册

**Files:**
- Modify: `js/constants.js`
- Modify: `js/app.js`

- [ ] **Step 1: 在 constants.js PAGE_TITLES 中新增 join 和 approvals**

在 `PAGE_TITLES` 对象中添加：

```javascript
join: '加入申请',
approvals: '申请审批',
```

- [ ] **Step 2: 在 app.js initRoutes 中注册新路由**

在 `initRoutes()` 函数中，在 `admin` 路由之后添加：

```javascript
// 加入申请路由
registerRoute('join', function (params) {
  if (!AppState.isLoggedIn) {
    AppState.showToast('请先登录');
    window.location.hash = 'login';
    return;
  }
  if (!params.youthId) {
    window.location.hash = 'dashboard';
    return;
  }
  JoinRequest.renderJoinPage(params.youthId);
});
// 申请审批路由
registerRoute('approvals', function () {
  if (!AppState.isLoggedIn) {
    window.location.hash = 'login';
    return;
  }
  JoinApproval.renderApprovalPage();
});
```

- [ ] **Step 3: 提交**

```bash
git add js/constants.js js/app.js
git commit -m "feat: 注册 join 和 approvals 路由"
```

---

### Task 3: 创建 join-request.js — 申请页

**Files:**
- Create: `js/join-request.js`

- [ ] **Step 1: 创建 join-request.js 完整实现**

```javascript
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
```

- [ ] **Step 2: 提交**

```bash
git add js/join-request.js
git commit -m "feat: 加入申请页 join-request.js"
```

---

### Task 4: 创建 join-approval.js — 审批页

**Files:**
- Create: `js/join-approval.js`

- [ ] **Step 1: 创建 join-approval.js 完整实现**

```javascript
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
```

- [ ] **Step 2: 提交**

```bash
git add js/join-approval.js
git commit -m "feat: 家长审批页 join-approval.js"
```

---

### Task 5: 创建 join.css 样式

**Files:**
- Create: `css/join.css`

- [ ] **Step 1: 创建 join.css**

```css
/* 加入申请页 + 审批页样式 */

/* — 申请页 — */
.join-page {
  padding: var(--spacing-md);
}

.join-card {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  border: 1px solid var(--color-border-light);
}

.join-youth-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.join-youth-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.join-youth-name {
  font-weight: 600;
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
}

.join-youth-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-top: 2px;
}

.join-section-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-bottom: var(--spacing-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.join-applicant {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.join-applicant-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.join-applicant-name {
  font-weight: 500;
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
}

.join-applicant-role {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.join-reason-input {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  resize: none;
  font-family: inherit;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  box-sizing: border-box;
}

.join-reason-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.join-reason-count {
  text-align: right;
  font-size: var(--font-size-2xs);
  color: var(--color-text-tertiary);
  margin-top: 4px;
}

.join-submit-btn {
  width: 100%;
  padding: var(--spacing-md);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 500;
  cursor: pointer;
  margin-top: var(--spacing-sm);
}

/* — pending 状态 — */
.join-pending-state {
  text-align: center;
  padding: var(--spacing-xl) var(--spacing-md);
}

.join-pending-icon {
  font-size: 48px;
  margin-bottom: var(--spacing-md);
}

.join-pending-title {
  font-weight: 600;
  font-size: var(--font-size-lg);
  margin-bottom: var(--spacing-sm);
  color: var(--color-text-primary);
}

.join-pending-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin-bottom: var(--spacing-lg);
}

.join-back-btn {
  padding: var(--spacing-sm) var(--spacing-xl);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  cursor: pointer;
}

/* — 审批页 — */
.approval-badge {
  display: inline-block;
  background: #FF3B30;
  color: #fff;
  font-size: var(--font-size-2xs);
  border-radius: 10px;
  padding: 1px 8px;
  margin-left: var(--spacing-xs);
  font-weight: 600;
}

.approval-empty {
  text-align: center;
  color: var(--color-text-tertiary);
  padding: var(--spacing-xl);
  font-size: var(--font-size-sm);
}

.approval-list {
  padding: 0 var(--spacing-md);
}

.approval-item {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  border: 1px solid var(--color-border-light);
}

.approval-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.approval-item-youth {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.approval-status-pending {
  background: #FFF3E0;
  color: #FF9500;
  font-size: var(--font-size-2xs);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.approval-status-approved {
  background: #E8F5E9;
  color: #34C759;
  font-size: var(--font-size-2xs);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.approval-status-rejected {
  background: #FFEBEE;
  color: #FF3B30;
  font-size: var(--font-size-2xs);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.approval-applicant {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.approval-applicant-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.approval-applicant-name {
  font-weight: 500;
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
}

.approval-applicant-role {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.approval-reason {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  line-height: 1.5;
  padding: var(--spacing-sm);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-sm);
}

.approval-time {
  font-size: var(--font-size-2xs);
  color: var(--color-text-tertiary);
}

.approval-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}

.approval-reject-btn {
  flex: 1;
  padding: var(--spacing-sm);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-danger);
  cursor: pointer;
}

.approval-approve-btn {
  flex: 1;
  padding: var(--spacing-sm);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
}

.approval-reviewed {
  font-size: var(--font-size-2xs);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-xs);
}

/* — 游离状态空页面 — */
.dashboard-empty {
  text-align: center;
  padding: var(--spacing-xl) var(--spacing-md);
}

.dashboard-empty-icon {
  font-size: 56px;
  margin-bottom: var(--spacing-md);
}

.dashboard-empty-title {
  font-weight: 600;
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.dashboard-empty-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin-bottom: var(--spacing-lg);
}

.dashboard-empty-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  align-items: center;
}

.dashboard-empty-btn {
  padding: var(--spacing-sm) var(--spacing-xl);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  min-width: 200px;
}

.dashboard-empty-link {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: none;
}
```

- [ ] **Step 2: 提交**

```bash
git add css/join.css
git commit -m "feat: 加入申请+审批页 CSS 样式"
```

---

### Task 6: 修改 index.html 引入新文件

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 添加 CSS 和 JS 引入**

在 `index.html` 中添加：

```html
<link rel="stylesheet" href="css/join.css">
```

在 `app.js` 之前添加：

```html
<script src="js/join-request.js"></script>
<script src="js/join-approval.js"></script>
```

- [ ] **Step 2: 提交**

```bash
git add index.html
git commit -m "feat: index.html 引入 join 相关文件"
```

---

### Task 7: 修改 archive-code.js 扫码分流

**Files:**
- Modify: `js/archive-code.js`

- [ ] **Step 1: 修改 app.js 中的 archive 路由处理**

在 `app.js` 的 `initRoutes` 中，修改 archive 路由：

```javascript
registerRoute('archive', function (params) {
  if (!AppState.isLoggedIn) {
    AppState.showToast('请先登录后扫码访问档案');
    window.location.hash = 'login';
    return;
  }
  if (params.youthId) {
    var user = AppState.currentUser;
    var role = user.role;

    // 家长、心青年、管理员：直接进档案
    if (role === 'parent' || role === 'youth' || role === 'admin') {
      AppState.selectYouth(params.youthId);
      window.location.hash = 'profile?youthId=' + encodeURIComponent(params.youthId);
      return;
    }

    // 政府：不能访问个体档案
    if (role === 'government') {
      AppState.showToast('政府角色不支持访问个体档案');
      window.location.hash = 'government';
      return;
    }

    // 老师/照护者/志愿者：检查是否已有授权
    var grants = Storage.getAccessGrants(params.youthId);
    var hasAccess = grants.some(function (g) {
      return g.granteeId === user.id && g.status === 'active';
    });

    if (hasAccess) {
      AppState.selectYouth(params.youthId);
      window.location.hash = 'profile?youthId=' + encodeURIComponent(params.youthId);
    } else {
      // 跳转到加入申请页
      window.location.hash = 'join?youthId=' + encodeURIComponent(params.youthId);
    }
  }
});
```

- [ ] **Step 2: 提交**

```bash
git add js/app.js
git commit -m "feat: 档案码扫码按角色分流"
```

---

### Task 8: 修改 app.js 游离状态检测

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: 在 showDashboard 中添加游离状态检测**

在 `showDashboard` 函数开头，添加游离状态检测逻辑。在获取 `youths` 之后：

```javascript
function showDashboard(params) {
  var container = getContainer();
  var user = AppState.currentUser;

  // 游离状态检测：老师/照护者/志愿者无任何心青年
  if (['teacher', 'caregiver', 'volunteer'].indexOf(user.role) > -1) {
    var youths = Permissions.getAccessibleYouths();
    if (youths.length === 0) {
      _renderUnboundDashboard(container, user);
      return;
    }
  }

  // ... 原有代码不变
```

- [ ] **Step 2: 添加 _renderUnboundDashboard 函数**

在 `showDashboard` 函数之后添加：

```javascript
function _renderUnboundDashboard(container, user) {
  var roleLabel = Constants.ROLE_LABELS[user.role] || user.role;
  var roleIcon = '';
  for (var i = 0; i < Constants.ROLES.length; i++) {
    if (Constants.ROLES[i].value === user.role) {
      roleIcon = Constants.ROLES[i].icon;
      break;
    }
  }

  container.innerHTML = '<div class="page-content">' +
    '<div class="dashboard-empty">' +
      '<div class="dashboard-empty-icon">' + roleIcon + '</div>' +
      '<div class="dashboard-empty-title">欢迎，' + Utils.escapeHtml(user.name) + '</div>' +
      '<div class="dashboard-empty-text">您是<strong>' + roleLabel + '</strong>，还未加入任何心青年档案。<br>请通过档案码加入。</div>' +
      '<div class="dashboard-empty-actions">' +
        '<button class="dashboard-empty-btn" id="btn-scan-join">📷 扫码加入</button>' +
        '<a class="dashboard-empty-link" id="link-input-code">输入档案码</a>' +
      '</div>' +
    '</div>' +
  '</div>';

  document.getElementById('btn-scan-join').addEventListener('click', function () {
    // 调用摄像头扫码（使用浏览器原生 API）
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      _startScanCamera();
    } else {
      AppState.showToast('当前环境不支持扫码，请使用"输入档案码"');
    }
  });

  document.getElementById('link-input-code').addEventListener('click', function () {
    var url = prompt('请输入档案码链接或粘贴 URL：');
    if (url) {
      _handleArchiveUrl(url);
    }
  });
}

function _handleArchiveUrl(url) {
  // 解析档案码 URL
  var match = url.match(/#archive\/([a-zA-Z0-9-]+)/);
  if (match) {
    var youthId = decodeURIComponent(match[1]);
    window.location.hash = 'join?youthId=' + encodeURIComponent(youthId);
  } else {
    AppState.showToast('无法识别档案码');
  }
}

function _startScanCamera() {
  // 创建扫码 overlay
  var overlay = document.createElement('div');
  overlay.id = 'scan-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#000;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;';
  overlay.innerHTML = '<div style="color:#fff;font-size:14px;margin-bottom:16px;">将档案码对准摄像头</div>' +
    '<video id="scan-video" style="width:80%;max-width:300px;border-radius:8px;" autoplay></video>' +
    '<button id="btn-scan-close" style="margin-top:16px;padding:8px 24px;background:#333;color:#fff;border:none;border-radius:8px;cursor:pointer;">关闭</button>';
  document.body.appendChild(overlay);

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(function (stream) {
      var video = document.getElementById('scan-video');
      video.srcObject = stream;

      // 使用 jsQR 或类似库解析二维码
      // 简化：提示用户使用输入方式
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');

      var scanInterval = setInterval(function () {
        if (!document.getElementById('scan-video')) {
          clearInterval(scanInterval);
          stream.getTracks().forEach(function (t) { t.stop(); });
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        try {
          var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          if (typeof jsQR !== 'undefined') {
            var code = jsQR(imgData.data, imgData.width, imgData.height);
            if (code) {
              clearInterval(scanInterval);
              stream.getTracks().forEach(function (t) { t.stop(); });
              document.body.removeChild(overlay);
              _handleArchiveUrl(code.data);
            }
          }
        } catch (e) {}
      }, 500);

      document.getElementById('btn-scan-close').addEventListener('click', function () {
        clearInterval(scanInterval);
        stream.getTracks().forEach(function (t) { t.stop(); });
        document.body.removeChild(overlay);
      });
    })
    .catch(function (err) {
      document.body.removeChild(overlay);
      AppState.showToast('无法访问摄像头：' + err.message);
    });
}
```

- [ ] **Step 3: 提交**

```bash
git add js/app.js
git commit -m "feat: 游离状态检测和扫码加入入口"
```

---

### Task 9: 修改 app.js showManagement 新增申请入口

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: 在 showManagement 中添加申请审批入口**

在 `showManagement` 函数的"档案管理"区块之前，添加：

```javascript
// === 加入申请 ===
if (user.role === 'parent' || user.role === 'admin') {
  var pendingCount = 0;
  var allYouths = Permissions.getAccessibleYouths();
  for (var i = 0; i < allYouths.length; i++) {
    var pending = Storage.getPendingJoinRequests(allYouths[i].id);
    pendingCount += pending.length;
  }
  html += '<div class="ios-card-group">';
  html += '<div class="ios-card-group-header">📋 加入申请</div>';
  html += '<div class="ios-card-row-static" id="btn-approvals" style="cursor:pointer;">' +
    '<div class="ios-card-row-icon">📨</div>' +
    '<div class="ios-card-row-body">' +
      '<div class="ios-card-row-title">申请审批</div>' +
      '<div class="ios-card-row-subtitle">' + (pendingCount > 0 ? pendingCount + ' 条待审批' : '暂无新申请') + '</div>' +
    '</div>' +
    (pendingCount > 0 ? '<span class="approval-badge">' + pendingCount + '</span>' : '') +
    '<span class="ios-card-row-arrow">›</span>' +
  '</div>';
  html += '</div>';
}
```

- [ ] **Step 2: 绑定审批入口点击事件**

在 `showManagement` 函数的事件绑定部分添加：

```javascript
var approvalsBtn = document.getElementById('btn-approvals');
if (approvalsBtn) {
  approvalsBtn.addEventListener('click', function () {
    window.location.hash = 'approvals';
  });
}
```

- [ ] **Step 3: 提交**

```bash
git add js/app.js
git commit -m "feat: 管理页新增加入申请入口"
```

---

### Task 10: 全角色测试

**Files:**
- Test: Playwright E2E

- [ ] **Step 1: 启动服务器**

```bash
lsof -ti:9090 | xargs kill -9 2>/dev/null
python3 -m http.server 9090 --directory /Users/jinjun/Desktop/开发/参赛/ai-dongwo &
```

- [ ] **Step 2: 运行全角色登录测试**

```bash
cd /Users/jinjun/Desktop/开发/参赛/ai-dongwo && python3 -c "
from playwright.sync_api import sync_playwright
import time

BASE = 'http://localhost:9090'

ALL_ACCOUNTS = [
    ('系统管理员', 'admin'),
    ('小明爸爸', 'parent'),
    ('小明妈妈', 'parent'),
    ('小明保姆', 'caregiver'),
    ('小花爸爸', 'parent'),
    ('小花妈妈', 'parent'),
    ('小花保姆', 'caregiver'),
    ('王老师', 'teacher'),
    ('小明', 'youth'),
    ('志愿者小李', 'volunteer'),
    ('政府观察员', 'government'),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(BASE + '/')
    page.evaluate('localStorage.clear()')
    page.reload()
    time.sleep(3)

    passed = 0
    failed = 0

    for name, role in ALL_ACCOUNTS:
        try:
            page.evaluate('localStorage.removeItem(\"ai_dongwo_current_user\")')
            page.goto(BASE + '/')
            time.sleep(2)
            items = page.query_selector_all('.quick-login-item')
            found = False
            for item in items:
                if name in item.inner_text():
                    item.click()
                    found = True
                    break
            if not found:
                print(f'FAIL {name}({role}): 找不到快速登录')
                failed += 1
                continue
            time.sleep(2)
            page.goto(BASE + '/#dashboard')
            time.sleep(1.5)
            body = page.inner_text('body')
            ok = '主页' in body or '欢迎' in body or '心青年' in body or '管理' in body
            if ok:
                print(f'PASS {name}({role})')
                passed += 1
            else:
                print(f'FAIL {name}({role}): 页面异常')
                failed += 1
        except Exception as e:
            print(f'FAIL {name}({role}): {str(e)[:80]}')
            failed += 1

    print(f'\\nResult: {passed} passed / {failed} failed / {len(ALL_ACCOUNTS)} total')
    browser.close()
"
```

- [ ] **Step 3: 验证申请流程**

```bash
cd /Users/jinjun/Desktop/开发/参赛/ai-dongwo && python3 -c "
from playwright.sync_api import sync_playwright
import time

BASE = 'http://localhost:9090'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(BASE + '/')
    page.evaluate('localStorage.clear()')
    page.reload()
    time.sleep(3)

    # 获取小明 ID
    profiles = page.evaluate('JSON.parse(localStorage.getItem(\"ai_dongwo_profiles\") || \"{}")')
    ming_id = list(profiles.keys())[0]

    # 登录王老师
    page.evaluate('localStorage.removeItem(\"ai_dongwo_current_user\")')
    page.goto(BASE + '/')
    time.sleep(2)
    items = page.query_selector_all('.quick-login-item')
    for item in items:
        if '王老师' in item.inner_text():
            item.click()
            break
    time.sleep(2)

    # 访问 join 页
    page.goto(f'{BASE}/#join?youthId={ming_id}')
    time.sleep(2)
    body = page.inner_text('body')
    if '加入申请' in body:
        print('PASS 申请页显示')
    else:
        print('FAIL 申请页异常')

    # 填写理由并提交
    reason = page.query_selector('#join-reason')
    if reason:
        reason.fill('我是小明的特教老师，需要查看档案')
        time.sleep(0.5)
        page.query_selector('#btn-submit-join').click()
        time.sleep(1.5)
        print('PASS 申请提交')

    # 登录家长查看审批
    page.evaluate('localStorage.removeItem(\"ai_dongwo_current_user\")')
    page.goto(BASE + '/')
    time.sleep(2)
    items = page.query_selector_all('.quick-login-item')
    for item in items:
        if '小明爸爸' in item.inner_text():
            item.click()
            break
    time.sleep(2)

    page.goto(f'{BASE}/#approvals')
    time.sleep(2)
    body = page.inner_text('body')
    if '王老师' in body and '待审批' in body:
        print('PASS 审批页显示申请')
    else:
        print('FAIL 审批页异常')

    # 点击同意
    approve_btn = page.query_selector('.approval-approve-btn')
    if approve_btn:
        approve_btn.click()
        time.sleep(1.5)
        body = page.inner_text('body')
        if '已同意' in body:
            print('PASS 审批通过')
        else:
            print('FAIL 审批异常')

    browser.close()
    print('\\n===== 申请流程测试完成 =====')
"
```

- [ ] **Step 4: 提交测试**

```bash
git add -A
git commit -m "test: 协作网络全角色+申请流程测试"
```

---

### Task 11: 最终验证

- [ ] **Step 1: 确认所有文件就绪**

```bash
ls -la js/join-request.js js/join-approval.js css/join.css
```

- [ ] **Step 2: 确认无 JS 错误**

```bash
cd /Users/jinjun/Desktop/开发/参赛/ai-dongwo && python3 -c "
from playwright.sync_api import sync_playwright
import time

BASE = 'http://localhost:9090'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    errors = []
    page.on('console', lambda msg: errors.append(f'{msg.type}: {msg.text}') if msg.type in ['error', 'warning'] else None)
    page.on('pageerror', lambda err: errors.append(f'pageerror: {str(err)}'))

    page.goto(BASE + '/')
    page.evaluate('localStorage.clear()')
    page.reload()
    time.sleep(3)

    # 登录老师访问 join 页
    items = page.query_selector_all('.quick-login-item')
    for item in items:
        if '王老师' in item.inner_text():
            item.click()
            break
    time.sleep(2)
    page.goto(BASE + '/#join?youthId=test')
    time.sleep(2)

    # 登录家长访问审批页
    page.evaluate('localStorage.removeItem(\"ai_dongwo_current_user\")')
    page.goto(BASE + '/')
    time.sleep(2)
    items = page.query_selector_all('.quick-login-item')
    for item in items:
        if '小明爸爸' in item.inner_text():
            item.click()
            break
    time.sleep(2)
    page.goto(BASE + '/#approvals')
    time.sleep(2)

    if errors:
        print(f'ERRORS: {len(errors)}')
        for e in errors[:5]:
            print(f'  {e}')
    else:
        print('PASS: 无 JS 错误')
    browser.close()
"
```

- [ ] **Step 3: 提供预览链接**

```bash
echo "预览链接: http://localhost:9090/"
```
