# 授权管理与系统管理员 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现授权管理页面（监护人/管理员管理心青年的访问授权）和系统管理员角色（用户管理、全局授权）

**Architecture:** 新增 `grants.js` 处理授权管理 UI（独立页面 + 底部 Sheet），新增 `admin.js` 处理管理员专属功能（用户管理）。扩展 `constants.js` 新增 admin 角色，`app.js` 注册新路由并改造管理页区分监护人/管理员视图。

**Tech Stack:** Vanilla JS, localStorage, Apple 设计系统 (CSS 变量)

---

### Task 1: 新增 admin 角色定义

**Files:**
- Modify: `js/constants.js`
- Modify: `js/auth.js`
- Modify: `js/storage.js`

- [ ] **Step 1: 在 constants.js 中新增 admin 角色**

在 ROLES 数组末尾添加 admin 角色定义：

```javascript
{ value: 'admin', label: '管理员', icon: '🛡️', desc: '系统管理员，管理用户与全局授权' }
```

在 ROLE_LABELS 对象中添加：

```javascript
admin: '管理员'
```

在 NAV_ITEMS 中为管理员添加专属导航（admin 角色不需要底部导航，但需要定义）：

```javascript
// 在 NAV_ITEMS 之后添加
ADMIN_NAV_ITEMS: [
  { page: 'admin', icon: '🛡️', label: '管理' },
  { page: 'dashboard', icon: '🏠', label: '主页' }
]
```

- [ ] **Step 2: 在 auth.js 中支持 admin 角色**

在 auth.js 的 ROLES 数组中添加 admin：

```javascript
{ value: 'admin', label: '管理员', icon: '🛡️', desc: '系统管理员' }
```

在 `quickLogin` 函数中过滤出 admin 账号用于快速登录。

- [ ] **Step 3: 在 storage.js 种子数据中添加管理员账号**

在 `initTestData` 的账户创建部分添加：

```javascript
var adminUser = {
  id: Utils.generateUUID(), name: '系统管理员', phone: '13800138000', role: 'admin',
  pinHash: '', institutionName: '系统管理', registeredAt: now, lastLoginAt: null, isActive: true
};
```

在 accounts 对象中注册：

```javascript
accounts[adminUser.id] = adminUser;
```

在 PIN 哈希设置数组中添加 `adminUser.id`。

- [ ] **Step 4: 提交**

```bash
git add js/constants.js js/auth.js js/storage.js
git commit -m "feat: 新增 admin 系统管理员角色"
```

---

### Task 2: 创建授权管理页 grants.js

**Files:**
- Create: `js/grants.js`

- [ ] **Step 1: 创建 grants.js 主框架**

```javascript
/**
 * grants.js - 授权管理页面
 * 监护人/管理员管理心青年的访问授权
 * 依赖：Storage、Permissions、Utils
 */
window.Grants = (function () {
  'use strict';

  var SCOPE_TEMPLATES = {
    readonly: {
      label: '只读访问',
      icon: '📖',
      desc: '仅查看档案内容',
      scope: ['read:full']
    },
    full: {
      label: '完全访问',
      icon: '✏️',
      desc: '可读可写全部模块',
      scope: ['read:full', 'write:communicationGuide', 'write:emotionBehavior', 'write:careMedical', 'write:workSupport', 'write:relationshipMap', 'manage:grants']
    }
  };

  var GRANTABLE_ROLES = ['parent', 'teacher', 'caregiver', 'volunteer'];

  /**
   * 渲染授权管理页面
   */
  function showGrants(youthId) {
    var container = App.getContainer();
    var youth = Storage.getProfile(youthId);
    if (!youth) {
      container.innerHTML = '<div class="page-content"><div class="empty-state">档案不存在</div></div>';
      return;
    }

    var grants = Storage.getAccessGrants(youthId);
    var activeGrants = grants.filter(function (g) { return g.status === 'active'; });
    var currentUserId = AppState.currentUser ? AppState.currentUser.id : '';

    var html = '<div class="page-content">' +
      '<div class="page-header">' +
        '<span class="page-title">🔑 ' + Utils.escapeHtml(youth.name) + ' · 授权管理</span>' +
      '</div>' +
      '<div class="grants-page">';

    // 授权列表
    if (activeGrants.length === 0) {
      html += '<div class="grants-empty">暂无授权用户</div>';
    } else {
      for (var i = 0; i < activeGrants.length; i++) {
        var g = activeGrants[i];
        var account = Storage.getAccount(g.granteeId);
        var name = account ? account.name : '未知用户';
        var roleLabel = Constants.ROLE_LABELS[g.granteeRole] || g.granteeRole;
        var isReadonly = g.scope.length <= 2 && g.scope.indexOf('write:') === -1;
        var scopeLabel = isReadonly ? '只读访问' : '完全访问';
        var roleIcon = _getRoleIcon(g.granteeRole);

        html += '<div class="grant-item" data-grant-id="' + g.id + '">' +
          '<div class="grant-item-icon">' + roleIcon + '</div>' +
          '<div class="grant-item-body">' +
            '<div class="grant-item-name">' + Utils.escapeHtml(name) + '</div>' +
            '<div class="grant-item-meta">' + roleLabel + ' · ' + scopeLabel + '</div>' +
          '</div>' +
          '<button class="grant-revoke-btn" data-grant-id="' + g.id + '" data-grant-name="' + Utils.escapeHtml(name) + '">撤销</button>' +
        '</div>';
      }
    }

    html += '</div>' +
      '<div class="grants-bottom-bar">' +
        '<button class="grants-add-btn" id="btn-add-grant">+ 添加授权</button>' +
      '</div>' +
    '</div>';

    container.innerHTML = html;

    // 绑定撤销按钮
    _bindRevokeButtons(youthId);
    // 绑定添加按钮
    _bindAddButton(youth);
  }

  function _getRoleIcon(role) {
    var icons = { parent: '👤', teacher: '📚', caregiver: '🤝', volunteer: '💙', youth: '🌻', government: '🏛️', admin: '🛡️' };
    return icons[role] || '👤';
  }

  function _bindRevokeButtons(youthId) {
    var btns = document.querySelectorAll('.grant-revoke-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var grantId = this.getAttribute('data-grant-id');
        var grantName = this.getAttribute('data-grant-name');
        _confirmRevoke(youthId, grantId, grantName);
      });
    }
  }

  function _bindAddButton(youth) {
    var btn = document.getElementById('btn-add-grant');
    if (!btn) return;
    btn.addEventListener('click', function () {
      _showAddSheet(youth);
    });
  }

  return {
    showGrants: showGrants
  };
})();
```

- [ ] **Step 2: 添加撤销确认弹窗**

继续在 grants.js 中添加：

```javascript
  function _confirmRevoke(youthId, grantId, grantName) {
    var overlay = document.createElement('div');
    overlay.className = 'grants-overlay';
    overlay.innerHTML = '<div class="grants-confirm-dialog">' +
      '<div class="grants-confirm-icon">⚠️</div>' +
      '<div class="grants-confirm-title">撤销授权</div>' +
      '<div class="grants-confirm-text">确定要撤销 <strong>' + Utils.escapeHtml(grantName) + '</strong> 的访问权限吗？</div>' +
      '<div class="grants-confirm-actions">' +
        '<button class="grants-confirm-cancel" id="btn-confirm-cancel">取消</button>' +
        '<button class="grants-confirm-ok" id="btn-confirm-ok">确认撤销</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(overlay);

    document.getElementById('btn-confirm-cancel').addEventListener('click', function () {
      document.body.removeChild(overlay);
    });

    document.getElementById('btn-confirm-ok').addEventListener('click', function () {
      Storage.revokeAccessGrant(grantId, '手动撤销');
      document.body.removeChild(overlay);
      Grants.showGrants(youthId);
    });
  }
```

- [ ] **Step 3: 添加底部 Sheet（添加授权）**

继续在 grants.js 中添加：

```javascript
  function _showAddSheet(youth) {
    var allAccounts = Storage.getAccounts();
    var existingGrants = Storage.getAccessGrants(youth.id);
    var existingGranteeIds = {};
    for (var i = 0; i < existingGrants.length; i++) {
      if (existingGrants[i].status === 'active') {
        existingGranteeIds[existingGrants[i].granteeId] = true;
      }
    }

    // 过滤可授权用户
    var availableUsers = [];
    for (var id in allAccounts) {
      var a = allAccounts[id];
      if (GRANTABLE_ROLES.indexOf(a.role) === -1) continue;
      if (existingGranteeIds[id]) continue;
      if (a.id === AppState.currentUser.id) continue;
      availableUsers.push(a);
    }

    var overlay = document.createElement('div');
    overlay.className = 'grants-sheet-overlay';
    overlay.id = 'grants-sheet-overlay';

    var userOptions = '';
    if (availableUsers.length === 0) {
      userOptions = '<div class="grants-sheet-empty">没有可授权的用户</div>';
    } else {
      for (var i = 0; i < availableUsers.length; i++) {
        var u = availableUsers[i];
        var roleLabel = Constants.ROLE_LABELS[u.role] || u.role;
        userOptions += '<div class="grants-sheet-user' + (i === 0 ? ' selected' : '') + '" data-user-id="' + u.id + '">' +
          '<div class="grants-sheet-user-icon">' + _getRoleIcon(u.role) + '</div>' +
          '<div class="grants-sheet-user-info">' +
            '<div class="grants-sheet-user-name">' + Utils.escapeHtml(u.name) + '</div>' +
            '<div class="grants-sheet-user-role">' + roleLabel + (u.institutionName ? ' · ' + u.institutionName : '') + '</div>' +
          '</div>' +
          '<div class="grants-sheet-user-check"></div>' +
        '</div>';
      }
    }

    overlay.innerHTML = '<div class="grants-sheet" id="grants-sheet">' +
      '<div class="grants-sheet-handle"></div>' +
      '<div class="grants-sheet-title">添加授权</div>' +
      '<div class="grants-sheet-section">' +
        '<div class="grants-sheet-label">选择用户</div>' +
        '<div class="grants-sheet-user-list">' + userOptions + '</div>' +
      '</div>' +
      '<div class="grants-sheet-section">' +
        '<div class="grants-sheet-label">访问范围</div>' +
        '<div class="grants-sheet-scope-options">' +
          '<div class="grants-scope-option selected" data-scope="readonly">' +
            '<span class="grants-scope-icon">📖</span>' +
            '<span class="grants-scope-label">只读访问</span>' +
          '</div>' +
          '<div class="grants-scope-option" data-scope="full">' +
            '<span class="grants-scope-icon">✏️</span>' +
            '<span class="grants-scope-label">完全访问</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<button class="grants-sheet-confirm" id="btn-sheet-confirm"' + (availableUsers.length === 0 ? ' disabled' : '') + '>确认授权</button>' +
    '</div>';

    document.body.appendChild(overlay);

    var selectedUserId = availableUsers.length > 0 ? availableUsers[0].id : null;
    var selectedScope = 'readonly';

    // 绑定用户选择
    var userItems = overlay.querySelectorAll('.grants-sheet-user');
    for (var i = 0; i < userItems.length; i++) {
      userItems[i].addEventListener('click', function () {
        for (var j = 0; j < userItems.length; j++) {
          userItems[j].classList.remove('selected');
        }
        this.classList.add('selected');
        selectedUserId = this.getAttribute('data-user-id');
      });
    }

    // 绑定范围选择
    var scopeItems = overlay.querySelectorAll('.grants-scope-option');
    for (var i = 0; i < scopeItems.length; i++) {
      scopeItems[i].addEventListener('click', function () {
        for (var j = 0; j < scopeItems.length; j++) {
          scopeItems[j].classList.remove('selected');
        }
        this.classList.add('selected');
        selectedScope = this.getAttribute('data-scope');
      });
    }

    // 关闭 Sheet
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    // 确认按钮
    document.getElementById('btn-sheet-confirm').addEventListener('click', function () {
      if (!selectedUserId || !selectedScope) return;
      var account = Storage.getAccount(selectedUserId);
      var scope = SCOPE_TEMPLATES[selectedScope].scope;
      var grant = {
        id: Utils.generateUUID(),
        youthId: youth.id,
        grantorId: AppState.currentUser.id,
        granteeId: selectedUserId,
        granteeRole: account.role,
        scope: scope,
        validFrom: Utils.formatDateTime(),
        validUntil: null,
        status: 'active',
        grantedAt: Utils.formatDateTime(),
        revokedAt: null,
        revokeReason: null
      };
      var result = Storage.addAccessGrant(grant);
      if (result.success) {
        document.body.removeChild(overlay);
        Grants.showGrants(youth.id);
      }
    });
  }
```

- [ ] **Step 4: 提交**

```bash
git add js/grants.js
git commit -m "feat: 授权管理页面 grants.js"
```

---

### Task 3: 创建管理员页面 admin.js

**Files:**
- Create: `js/admin.js`

- [ ] **Step 1: 创建 admin.js 用户管理功能**

```javascript
/**
 * admin.js - 系统管理员页面
 * 用户管理、全局授权管理
 */
window.Admin = (function () {
  'use strict';

  var _currentTab = 'users';

  function showAdmin() {
    var container = App.getContainer();
    var user = AppState.currentUser;
    if (!user || user.role !== 'admin') {
      window.location.hash = 'dashboard';
      return;
    }

    _renderAdminPage();
  }

  function _renderAdminPage() {
    var container = App.getContainer();
    var html = '<div class="page-content">' +
      '<div class="page-header">' +
        '<span class="page-title">🛡️ 系统管理</span>' +
      '</div>' +
      '<div class="admin-tabs">' +
        '<button class="admin-tab active" data-tab="users">👥 用户管理</button>' +
        '<button class="admin-tab" data-tab="grants">🔑 全局授权</button>' +
      '</div>' +
      '<div class="admin-content" id="admin-content"></div>' +
    '</div>';

    container.innerHTML = html;

    _renderUsersTab();

    var tabs = container.querySelectorAll('.admin-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        var tab = this.getAttribute('data-tab');
        _currentTab = tab;
        var allTabs = container.querySelectorAll('.admin-tab');
        for (var j = 0; j < allTabs.length; j++) {
          allTabs[j].classList.toggle('active', allTabs[j].getAttribute('data-tab') === tab);
        }
        if (tab === 'users') _renderUsersTab();
        else _renderGrantsTab();
      });
    }
  }

  function _renderUsersTab() {
    var content = document.getElementById('admin-content');
    if (!content) return;

    var accounts = Storage.getAccounts();
    var userList = [];
    for (var id in accounts) {
      userList.push(accounts[id]);
    }
    userList.sort(function (a, b) {
      var roleOrder = { admin: 0, parent: 1, teacher: 2, caregiver: 3, volunteer: 4, youth: 5, government: 6 };
      return (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
    });

    var html = '<div class="admin-user-count">共 ' + userList.length + ' 个用户</div>';
    for (var i = 0; i < userList.length; i++) {
      var u = userList[i];
      var roleLabel = Constants.ROLE_LABELS[u.role] || u.role;
      var statusClass = u.isActive !== false ? 'active' : 'disabled';
      var statusText = u.isActive !== false ? '正常' : '已禁用';

      html += '<div class="admin-user-item" data-user-id="' + u.id + '">' +
        '<div class="admin-user-avatar">' + (_getRoleIcon(u.role) || '👤') + '</div>' +
        '<div class="admin-user-body">' +
          '<div class="admin-user-name">' + Utils.escapeHtml(u.name) + '</div>' +
          '<div class="admin-user-meta">' + roleLabel + (u.institutionName ? ' · ' + u.institutionName : '') + '</div>' +
        '</div>' +
        '<span class="admin-user-status ' + statusClass + '">' + statusText + '</span>' +
        (u.role !== 'admin' ? '<button class="admin-user-toggle" data-user-id="' + u.id + '" data-active="' + (u.isActive !== false) + '">' + (u.isActive !== false ? '禁用' : '启用') + '</button>' : '') +
      '</div>';
    }

    content.innerHTML = html;

    _bindUserToggleButtons();
  }

  function _bindUserToggleButtons() {
    var btns = document.querySelectorAll('.admin-user-toggle');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var userId = this.getAttribute('data-user-id');
        var isActive = this.getAttribute('data-active') === 'true';
        var accounts = Storage.getAccounts();
        if (accounts[userId]) {
          accounts[userId].isActive = !isActive;
          Storage.set('ai_dongwo_accounts', accounts);
          _renderUsersTab();
        }
      });
    }
  }

  function _renderGrantsTab() {
    var content = document.getElementById('admin-content');
    if (!content) return;

    var profiles = Storage.getProfiles();
    var html = '<div class="admin-grants-header">选择心青年管理授权</div>';

    for (var id in profiles) {
      var p = profiles[id];
      var age = Utils.calculateAge(p.birthDate);
      html += '<div class="admin-grant-youth" data-youth-id="' + p.id + '">' +
        '<div class="admin-grant-youth-avatar">' + (p.avatar || '🧑') + '</div>' +
        '<div class="admin-grant-youth-body">' +
          '<div class="admin-grant-youth-name">' + Utils.escapeHtml(p.name) + '</div>' +
          '<div class="admin-grant-youth-meta">' + age + '岁 · ' + Constants.LIFECYCLE_LABELS[p.lifeCycleStatus] + '</div>' +
        '</div>' +
        '<span class="admin-grant-youth-arrow">›</span>' +
      '</div>';
    }

    content.innerHTML = html;

    var rows = content.querySelectorAll('.admin-grant-youth');
    for (var i = 0; i < rows.length; i++) {
      rows[i].addEventListener('click', function () {
        var youthId = this.getAttribute('data-youth-id');
        AppState.selectYouth(youthId);
        Grants.showGrants(youthId);
      });
    }
  }

  function _getRoleIcon(role) {
    var icons = { admin: '🛡️', parent: '👤', teacher: '📚', caregiver: '🤝', volunteer: '💙', youth: '🌻', government: '🏛️' };
    return icons[role] || '👤';
  }

  return {
    showAdmin: showAdmin
  };
})();
```

- [ ] **Step 2: 提交**

```bash
git add js/admin.js
git commit -m "feat: 系统管理员页面 admin.js"
```

---

### Task 4: 修改 app.js 集成新路由

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: 注册 grants 和 admin 路由**

在 app.js 的路由处理中新增：

```javascript
// 在路由分发处添加
} else if (page === 'grants') {
  var youthId = params.youthId || (AppState.currentYouth ? AppState.currentYouth.id : null);
  if (youthId) {
    AppState.selectYouth(youthId);
    Grants.showGrants(youthId);
  } else {
    window.location.hash = 'dashboard';
  }
} else if (page === 'admin') {
  Admin.showAdmin();
}
```

- [ ] **Step 2: 改造管理页 showManagement，区分监护人/管理员**

修改 `showManagement` 函数，在开头添加管理员判断：

```javascript
function showManagement(params) {
  var container = getContainer();
  var user = AppState.currentUser;
  
  // 管理员：显示管理后台
  if (user.role === 'admin') {
    Admin.showAdmin();
    return;
  }
  
  // 原有监护人代码...
  var youths = Permissions.getAccessibleYouths();
  // ... 保持不变
}
```

- [ ] **Step 3: 提交**

```bash
git add js/app.js
git commit -m "feat: app.js 集成 grants 和 admin 路由"
```

---

### Task 5: 添加 CSS 样式

**Files:**
- Create: `css/grants.css`

- [ ] **Step 1: 创建 grants.css 授权管理样式**

```css
/* 授权管理页 */
.grants-page {
  padding: var(--spacing-md);
}

.grant-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  border: 1px solid var(--color-border-light);
}

.grant-item-icon {
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

.grant-item-body {
  flex: 1;
  min-width: 0;
}

.grant-item-name {
  font-weight: 500;
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
}

.grant-item-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-top: 2px;
}

.grant-revoke-btn {
  background: none;
  border: none;
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  cursor: pointer;
  flex-shrink: 0;
}

.grants-empty {
  text-align: center;
  color: var(--color-text-tertiary);
  padding: var(--spacing-xl);
  font-size: var(--font-size-sm);
}

.grants-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--spacing-md);
  background: var(--color-bg-primary);
  border-top: 1px solid var(--color-border-light);
  z-index: 100;
}

.grants-add-btn {
  width: 100%;
  padding: var(--spacing-md);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 500;
  cursor: pointer;
}

/* 撤销确认弹窗 */
.grants-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.grants-confirm-dialog {
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  width: 280px;
  text-align: center;
  box-shadow: var(--shadow-lg);
}

.grants-confirm-icon {
  font-size: 40px;
  margin-bottom: var(--spacing-md);
}

.grants-confirm-title {
  font-weight: 600;
  font-size: var(--font-size-lg);
  margin-bottom: var(--spacing-sm);
  color: var(--color-text-primary);
}

.grants-confirm-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-lg);
  line-height: 1.5;
}

.grants-confirm-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.grants-confirm-cancel {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  cursor: pointer;
  color: var(--color-text-primary);
}

.grants-confirm-ok {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-danger);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

/* 底部 Sheet */
.grants-sheet-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.grants-sheet {
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-xl);
  width: 100%;
  max-height: 70vh;
  overflow-y: auto;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
}

.grants-sheet-handle {
  width: 36px;
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  margin: 0 auto var(--spacing-md);
}

.grants-sheet-title {
  font-weight: 600;
  font-size: var(--font-size-lg);
  text-align: center;
  margin-bottom: var(--spacing-lg);
  color: var(--color-text-primary);
}

.grants-sheet-section {
  margin-bottom: var(--spacing-lg);
}

.grants-sheet-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-bottom: var(--spacing-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.grants-sheet-user {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-xs);
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.grants-sheet-user.selected {
  border-color: var(--color-primary);
  background: var(--color-bg-secondary);
}

.grants-sheet-user-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.grants-sheet-user-info {
  flex: 1;
  min-width: 0;
}

.grants-sheet-user-name {
  font-weight: 500;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.grants-sheet-user-role {
  font-size: var(--font-size-2xs);
  color: var(--color-text-tertiary);
}

.grants-sheet-user-check {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  flex-shrink: 0;
}

.grants-sheet-user.selected .grants-sheet-user-check {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.grants-sheet-scope-options {
  display: flex;
  gap: var(--spacing-sm);
}

.grants-scope-option {
  flex: 1;
  padding: var(--spacing-sm);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  text-align: center;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.grants-scope-option.selected {
  border-color: var(--color-primary);
  background: var(--color-bg-secondary);
}

.grants-scope-icon {
  display: block;
  font-size: 20px;
  margin-bottom: 4px;
}

.grants-scope-label {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-primary);
}

.grants-sheet-confirm {
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

.grants-sheet-confirm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.grants-sheet-empty {
  text-align: center;
  color: var(--color-text-tertiary);
  padding: var(--spacing-lg);
  font-size: var(--font-size-sm);
}

/* 管理员页面 */
.admin-tabs {
  display: flex;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-lg);
  padding: 3px;
  margin: 0 var(--spacing-md) var(--spacing-md);
}

.admin-tab {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.admin-tab.active {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-xs);
}

.admin-content {
  padding: 0 var(--spacing-md);
}

.admin-user-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-bottom: var(--spacing-sm);
  padding: 0 var(--spacing-xs);
}

.admin-user-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  border: 1px solid var(--color-border-light);
}

.admin-user-avatar {
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

.admin-user-body {
  flex: 1;
  min-width: 0;
}

.admin-user-name {
  font-weight: 500;
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
}

.admin-user-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-top: 2px;
}

.admin-user-status {
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.admin-user-status.active {
  background: #e8f5e9;
  color: #34C759;
}

.admin-user-status.disabled {
  background: #fce4ec;
  color: #FF3B30;
}

.admin-user-toggle {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 4px 12px;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}

.admin-grants-header {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-bottom: var(--spacing-sm);
  padding: 0 var(--spacing-xs);
}

.admin-grant-youth {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  border: 1px solid var(--color-border-light);
  cursor: pointer;
}

.admin-grant-youth-avatar {
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

.admin-grant-youth-body {
  flex: 1;
  min-width: 0;
}

.admin-grant-youth-name {
  font-weight: 500;
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
}

.admin-grant-youth-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-top: 2px;
}

.admin-grant-youth-arrow {
  color: var(--color-text-tertiary);
  font-size: 20px;
}
```

- [ ] **Step 2: 在 index.html 中引入新文件**

在 `index.html` 中添加：

```html
<link rel="stylesheet" href="css/grants.css">
```

在 `index.html` 中 JS 引用部分添加（在 `app.js` 之前）：

```html
<script src="js/grants.js"></script>
<script src="js/admin.js"></script>
```

- [ ] **Step 3: 提交**

```bash
git add css/grants.css index.html
git commit -m "feat: 授权管理+管理员页 CSS 样式"
```

---

### Task 6: 全角色测试

**Files:**
- Modify: `test_all_roles.py`

- [ ] **Step 1: 运行 Playwright 测试，验证所有角色**

```bash
cd /Users/jinjun/Desktop/开发/参赛/ai-dongwo && python3 -c "
from playwright.sync_api import sync_playwright
import time

BASE = 'http://localhost:9090'

ALL_ACCOUNTS = [
    ('系统管理员', 'admin', '系统管理员'),
    ('小明爸爸', 'parent', '小明爸爸'),
    ('小明妈妈', 'parent', '小明妈妈'),
    ('小明保姆', 'caregiver', '小明保姆'),
    ('小花爸爸', 'parent', '小花爸爸'),
    ('小花妈妈', 'parent', '小花妈妈'),
    ('小花保姆', 'caregiver', '小花保姆'),
    ('王老师', 'teacher', '王老师'),
    ('小明', 'youth', '小明'),
    ('志愿者小李', 'volunteer', '志愿者小李'),
    ('政府观察员', 'government', '政府观察员'),
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
    
    for name, role, display_name in ALL_ACCOUNTS:
        try:
            page.evaluate('localStorage.removeItem(\"ai_dongwo_current_user\")')
            page.goto(BASE + '/')
            time.sleep(2)
            
            items = page.query_selector_all('.quick-login-item')
            found = False
            for item in items:
                if display_name in item.inner_text():
                    item.click()
                    found = True
                    break
            
            if not found:
                print(f'❌ {name}({role}): 找不到快速登录入口')
                failed += 1
                continue
            
            time.sleep(2)
            
            if role == 'admin':
                page.goto(BASE + '/#admin')
            elif role == 'government':
                page.goto(BASE + '/#government')
            else:
                page.goto(BASE + '/#dashboard')
            time.sleep(1.5)
            body = page.inner_text('body')
            
            ok = ('主页' in body or '看板' in body or '管理' in body or name in body or '心青年' in body)
            if ok:
                print(f'✅ {name}({role}): 登录+页面正常')
                passed += 1
            else:
                print(f'❌ {name}({role}): 页面异常')
                failed += 1
                
        except Exception as e:
            print(f'❌ {name}({role}): {str(e)[:100]}')
            failed += 1
    
    print(f'\\n===== 结果: {passed}通过 / {failed}失败 / {len(ALL_ACCOUNTS)}总计 =====')
    browser.close()
"
```

- [ ] **Step 2: 验证授权管理功能**

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
    
    # 登录小明爸爸
    page.evaluate('localStorage.removeItem(\"ai_dongwo_current_user\")')
    page.goto(BASE + '/')
    time.sleep(2)
    items = page.query_selector_all('.quick-login-item')
    for item in items:
        if '小明爸爸' in item.inner_text():
            item.click()
            break
    time.sleep(2)
    
    # 进入授权管理
    page.goto(BASE + '/#management')
    time.sleep(2)
    
    # 点击授权管理
    grant_row = page.query_selector('.ios-card-row[data-action=\"grants\"]')
    if grant_row:
        grant_row.click()
        time.sleep(2)
        body = page.inner_text('body')
        if '授权管理' in body:
            print('✅ 授权管理页面正常显示')
        else:
            print('❌ 授权管理页面异常')
    else:
        print('❌ 找不到授权管理入口')
    
    # 管理员测试
    page.evaluate('localStorage.removeItem(\"ai_dongwo_current_user\")')
    page.goto(BASE + '/')
    time.sleep(2)
    items = page.query_selector_all('.quick-login-item')
    for item in items:
        if '系统管理员' in item.inner_text():
            item.click()
            break
    time.sleep(2)
    
    page.goto(BASE + '/#admin')
    time.sleep(2)
    body = page.inner_text('body')
    if '用户管理' in body or '系统管理' in body:
        print('✅ 管理员页面正常显示')
    else:
        print('❌ 管理员页面异常')
    
    browser.close()
"
```

- [ ] **Step 3: 提交**

```bash
git add -A && git commit -m "test: 全角色+授权管理功能测试"
```

---

### Task 7: 最终验证

- [ ] **Step 1: 确认所有文件就绪**

```bash
ls -la js/grants.js js/admin.js css/grants.css
```

- [ ] **Step 2: 启动服务器并验证**

```bash
lsof -ti:9090 | xargs kill -9 2>/dev/null
python3 -m http.server 9090 &
echo "http://localhost:9090/"
```

- [ ] **Step 3: 清理视觉服务器**

```bash
bash /Users/jinjun/.trae-cn/plugins/trae-remote-official/superpowers/5.1.3/skills/brainstorming/scripts/stop-server.sh /Users/jinjun/Desktop/开发/参赛/ai-dongwo/.superpowers/brainstorm/18596-1785231380
```