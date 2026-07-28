/**
 * grants.js - 授权管理页面
 * 监护人/管理员管理心青年的访问授权
 * 依赖：Storage、Permissions、Utils、AppState、Constants
 */
window.Grants = (function () {
  'use strict';

  // 授权范围预设模板
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

  // 可授权角色（排除 youth / government / admin）
  var GRANTABLE_ROLES = ['parent', 'teacher', 'caregiver', 'volunteer'];

  /**
   * 渲染授权管理页面
   * @param {string} youthId - 心青年档案 ID
   */
  function showGrants(youthId) {
    var container = App.getContainer();
    var youth = Storage.getProfile(youthId);
    if (!youth) {
      container.innerHTML = '<div class="page-content"><div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">档案不存在</div></div></div>';
      return;
    }

    var grants = Storage.getAccessGrants(youthId);
    var activeGrants = grants.filter(function (g) { return g.status === 'active'; });

    var html =
      '<div class="page-header">' +
        '<button class="btn btn-sm btn-secondary" id="btn-grants-back">← 返回</button>' +
        '<span class="page-title">🔑 ' + Utils.escapeHtml(youth.name) + ' · 授权管理</span>' +
        '<span></span>' +
      '</div>' +
      '<div class="page-content">' +
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
        var isReadonly = g.scope.indexOf('write:') === -1 && g.scope.indexOf('manage:') === -1;
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

    // 返回按钮
    var backBtn = document.getElementById('btn-grants-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        window.location.hash = 'management';
      });
    }

    _bindRevokeButtons(youthId);
    _bindAddButton(youth);
  }

  /**
   * 获取角色对应的 emoji 图标
   */
  function _getRoleIcon(role) {
    var icons = {
      parent: '👤',
      teacher: '📚',
      caregiver: '🤝',
      volunteer: '💙',
      youth: '🌻',
      government: '🏛️',
      admin: '🛡️'
    };
    return icons[role] || '👤';
  }

  /**
   * 绑定撤销按钮事件
   */
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

  /**
   * 绑定添加授权按钮事件
   */
  function _bindAddButton(youth) {
    var btn = document.getElementById('btn-add-grant');
    if (!btn) return;
    btn.addEventListener('click', function () {
      _showAddSheet(youth);
    });
  }

  /**
   * 显示撤销确认弹窗
   */
  function _confirmRevoke(youthId, grantId, grantName) {
    var overlay = document.createElement('div');
    overlay.className = 'grants-overlay';
    overlay.innerHTML =
      '<div class="grants-confirm-dialog">' +
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
      showGrants(youthId);
    });
  }

  /**
   * 显示添加授权底部 Sheet（iOS 风格）
   */
  function _showAddSheet(youth) {
    var allAccounts = Storage.getAccounts();
    var existingGrants = Storage.getAccessGrants(youth.id);
    var existingGranteeIds = {};
    for (var i = 0; i < existingGrants.length; i++) {
      if (existingGrants[i].status === 'active') {
        existingGranteeIds[existingGrants[i].granteeId] = true;
      }
    }

    // 过滤可授权用户：角色匹配 + 排除已授权 + 排除当前用户
    var availableUsers = [];
    var currentUserId = AppState.currentUser ? AppState.currentUser.id : '';
    for (var id in allAccounts) {
      var a = allAccounts[id];
      if (GRANTABLE_ROLES.indexOf(a.role) === -1) continue;
      if (existingGranteeIds[id]) continue;
      if (a.id === currentUserId) continue;
      availableUsers.push(a);
    }

    var overlay = document.createElement('div');
    overlay.className = 'grants-sheet-overlay';
    overlay.id = 'grants-sheet-overlay';

    // 用户列表 HTML
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
            '<div class="grants-sheet-user-role">' + roleLabel + (u.institutionName ? ' · ' + Utils.escapeHtml(u.institutionName) : '') + '</div>' +
          '</div>' +
          '<div class="grants-sheet-user-check"></div>' +
        '</div>';
      }
    }

    overlay.innerHTML =
      '<div class="grants-sheet" id="grants-sheet">' +
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

    // 选中状态（闭包内可变）
    var selectedUserId = availableUsers.length > 0 ? availableUsers[0].id : null;
    var selectedScope = 'readonly';

    // 用户选择
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

    // 范围选择
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

    // 点击遮罩关闭 Sheet
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    // 确认按钮：创建授权
    document.getElementById('btn-sheet-confirm').addEventListener('click', function () {
      if (!selectedUserId || !selectedScope) return;
      var account = Storage.getAccount(selectedUserId);
      if (!account) return;
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
        showGrants(youth.id);
      }
    });
  }

  return {
    showGrants: showGrants
  };
})();
