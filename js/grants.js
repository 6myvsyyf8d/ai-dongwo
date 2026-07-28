/**
 * grants.js - 授权管理页面
 * 监护人/管理员管理心青年的访问授权
 * 包含待审批申请、当前授权列表、添加授权功能
 * 依赖：Storage、Permissions、Utils、AppState、Constants
 */
window.Grants = (function () {
  'use strict';

  // 可授权角色（排除 youth / government / admin）
  var GRANTABLE_ROLES = ['teacher', 'caregiver', 'volunteer'];

  /**
   * 角色权限说明
   */
  var ROLE_PERMISSION_DESC = {
    parent: '家长 · 可查看全部模块并管理授权',
    teacher: '老师 · 可查看全部模块，可写沟通/情绪/工作/医疗',
    caregiver: '照护者 · 可查看安全信息，可写照护医疗',
    volunteer: '志愿者 · 可查看安全信息，可写关系地图'
  };

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

    // 待审批申请
    var pendingRequests = Storage.getPendingJoinRequests(youthId);

    var html =
      '<div class="page-header">' +
        '<button class="btn btn-sm btn-secondary" id="btn-grants-back">← 返回</button>' +
        '<span class="page-title">🔑 授权管理 · ' + Utils.escapeHtml(youth.name) + '</span>' +
        '<span></span>' +
      '</div>' +
      '<div class="page-content">' +
        '<div class="grants-page">';

    // 待审批申请区块（仅当有待审批时显示）
    if (pendingRequests.length > 0) {
      html += '<div class="grants-section">';
      html += '<div class="grants-section-title">📨 待审批申请 <span class="grants-pending-badge">' + pendingRequests.length + '</span></div>';
      for (var i = 0; i < pendingRequests.length; i++) {
        var req = pendingRequests[i];
        var applicant = Storage.getAccount(req.applicantId);
        var applicantName = applicant ? applicant.name : '未知用户';
        var roleLabel = Constants.ROLE_LABELS[req.applicantRole] || req.applicantRole;
        var roleIcon = _getRoleIcon(req.applicantRole);
        var relationText = '';
        if (req.applicantRole === 'parent' && req.relation && Constants.FAMILY_RELATIONS[req.relation]) {
          relationText = ' · 申请作为：' + Constants.FAMILY_RELATIONS[req.relation];
        }

        html += '<div class="pending-request-item" data-request-id="' + req.id + '">' +
          '<div class="pending-request-icon">' + roleIcon + '</div>' +
          '<div class="pending-request-body">' +
            '<div class="pending-request-name">' + Utils.escapeHtml(applicantName) + '</div>' +
            '<div class="pending-request-meta">' + roleLabel + relationText + '</div>' +
            '<div class="pending-request-reason">' + Utils.escapeHtml(req.reason) + '</div>' +
          '</div>' +
          '<div class="pending-request-actions">' +
            '<button class="pending-reject-btn" data-request-id="' + req.id + '" title="拒绝">✕</button>' +
            '<button class="pending-approve-btn" data-request-id="' + req.id + '" title="同意">✓</button>' +
          '</div>' +
        '</div>';
      }
      html += '</div>';
    }

    // 当前授权列表
    html += '<div class="grants-section">';
    html += '<div class="grants-section-title">👥 当前授权 · ' + activeGrants.length + ' 人</div>';

    if (activeGrants.length === 0) {
      html += '<div class="grants-empty">暂无授权用户</div>';
    } else {
      for (var i = 0; i < activeGrants.length; i++) {
        var g = activeGrants[i];
        var account = Storage.getAccount(g.granteeId);
        var name = account ? account.name : '未知用户';
        var roleLabel = Constants.ROLE_LABELS[g.granteeRole] || g.granteeRole;
        var roleIcon = _getRoleIcon(g.granteeRole);
        var isParent = g.granteeRole === 'parent';
        var relationLabel = '';
        if (isParent && g.relation && Constants.FAMILY_RELATIONS[g.relation]) {
          relationLabel = Constants.FAMILY_RELATIONS[g.relation];
        } else if (isParent) {
          relationLabel = '监护人';
        }
        var permissionDesc = ROLE_PERMISSION_DESC[g.granteeRole] || roleLabel;

        html += '<div class="grant-item" data-grant-id="' + g.id + '">' +
          '<div class="grant-item-icon">' + roleIcon + '</div>' +
          '<div class="grant-item-body">' +
            '<div class="grant-item-name">' +
              Utils.escapeHtml(name) +
              (isParent ? '<span class="grant-guardian-tag">' + relationLabel + '</span>' : '') +
            '</div>' +
            '<div class="grant-item-meta">' + permissionDesc + '</div>' +
          '</div>' +
          (isParent ? '' : '<button class="grant-revoke-btn" data-grant-id="' + g.id + '">撤销</button>') +
        '</div>';
      }
    }

    html += '</div>' +
      '</div>' +
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

    _bindPendingRequestButtons(youthId);
    _bindRevokeButtons(youthId);
    _bindAddButton(youth);
  }

  /**
   * 获取角色对应的 emoji 图标
   */
  function _getRoleIcon(role) {
    for (var i = 0; i < Constants.ROLES.length; i++) {
      if (Constants.ROLES[i].value === role) {
        return Constants.ROLES[i].icon;
      }
    }
    return '👤';
  }

  /**
   * 绑定待审批申请按钮事件
   */
  function _bindPendingRequestButtons(youthId) {
    // 同意按钮
    var approveBtns = document.querySelectorAll('.pending-approve-btn');
    for (var i = 0; i < approveBtns.length; i++) {
      approveBtns[i].addEventListener('click', function () {
        var requestId = this.getAttribute('data-request-id');
        _approveRequest(youthId, requestId);
      });
    }

    // 拒绝按钮
    var rejectBtns = document.querySelectorAll('.pending-reject-btn');
    for (var i = 0; i < rejectBtns.length; i++) {
      rejectBtns[i].addEventListener('click', function () {
        var requestId = this.getAttribute('data-request-id');
        _rejectRequest(youthId, requestId);
      });
    }
  }

  /**
   * 同意申请
   */
  function _approveRequest(youthId, requestId) {
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
    AppState.selectYouth(youthId);

    // 调用 Permissions.grantAccess 自动建立授权（scope 由角色决定）
    var relation = request.relation || null;
    var result = Permissions.grantAccess(youthId, request.applicantId, request.applicantRole, null, relation);
    if (result.success) {
      Storage.updateJoinRequest(requestId, {
        status: 'approved',
        reviewedAt: Utils.formatDateTime(),
        reviewedBy: AppState.currentUser.id,
        reviewNote: null
      });
      AppState.showToast('已同意申请，授权已建立');
      showGrants(youthId);
    } else {
      AppState.showToast('授权失败：' + (result.error || '未知错误'));
    }
  }

  /**
   * 拒绝申请
   */
  function _rejectRequest(youthId, requestId) {
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
    showGrants(youthId);
  }

  /**
   * 绑定撤销按钮事件
   */
  function _bindRevokeButtons(youthId) {
    var btns = document.querySelectorAll('.grant-revoke-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var grantId = this.getAttribute('data-grant-id');
        var grants = Storage.getAccessGrants(youthId);
        var grantName = '该用户';
        for (var j = 0; j < grants.length; j++) {
          if (grants[j].id === grantId) {
            var account = Storage.getAccount(grants[j].granteeId);
            grantName = account ? account.name : '该用户';
            break;
          }
        }
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
   * 生成家庭邀请码（6位数字，24小时有效）
   */
  function _generateInvitationCode(youth) {
    Storage.cleanExpiredInvitations();

    // 生成随机 6 位数字
    var code = '';
    for (var i = 0; i < 6; i++) {
      code += Math.floor(Math.random() * 10);
    }

    var now = new Date();
    var expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    var invitation = {
      id: Utils.generateUUID(),
      youthId: youth.id,
      grantorId: AppState.currentUser.id,
      code: code,
      role: 'parent',
      createdAt: Utils.formatDateTime(now),
      expiresAt: Utils.formatDateTime(expiresAt),
      status: 'active',
      usedBy: null,
      usedAt: null
    };

    var result = Storage.addInvitation(invitation);
    if (result.success) {
      // 显示邀请码
      var overlay = document.createElement('div');
      overlay.className = 'grants-sheet-overlay';
      overlay.innerHTML =
        '<div class="grants-sheet">' +
          '<div class="grants-sheet-handle"></div>' +
          '<div class="grants-sheet-title">家庭邀请码</div>' +
          '<div style="text-align:center;padding:24px 0;">' +
            '<div style="font-size:36px;font-weight:700;letter-spacing:8px;color:var(--color-text-primary);">' + code + '</div>' +
            '<div style="font-size:13px;color:var(--color-text-secondary);margin-top:8px;">24 小时内有效</div>' +
          '</div>' +
          '<div style="font-size:13px;color:var(--color-text-secondary);padding:0 16px;text-align:center;line-height:1.5;">将此邀请码发送给家庭成员，对方注册家长账号后输入此邀请码即可申请加入。</div>' +
          '<button class="grants-sheet-confirm" id="btn-copy-code" style="margin-top:20px;">复制邀请码</button>' +
          '<button class="btn btn-secondary btn-block" id="btn-close-code" style="margin:8px 16px 0;">关闭</button>' +
        '</div>';
      document.body.appendChild(overlay);

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) document.body.removeChild(overlay);
      });

      document.getElementById('btn-close-code').addEventListener('click', function () {
        document.body.removeChild(overlay);
      });

      document.getElementById('btn-copy-code').addEventListener('click', function () {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(code).then(function () {
            AppState.showToast('已复制到剪贴板');
          });
        } else {
          var textarea = document.createElement('textarea');
          textarea.value = code;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          AppState.showToast('已复制到剪贴板');
        }
      });
    }
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

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    document.getElementById('btn-confirm-cancel').addEventListener('click', function () {
      document.body.removeChild(overlay);
    });

    document.getElementById('btn-confirm-ok').addEventListener('click', function () {
      var success = Storage.revokeAccessGrant(grantId, '手动撤销');
      document.body.removeChild(overlay);
      if (!success) {
        // Still re-render, the grant may already be revoked
      }
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
      if (a.isActive === false) continue;
      if (existingGranteeIds[id]) continue;
      if (a.id === currentUserId) continue;
      availableUsers.push(a);
    }

    var overlay = document.createElement('div');
    overlay.className = 'grants-sheet-overlay';
    overlay.id = 'grants-sheet-overlay';

    // 邀请家庭成员入口（仅主监护人可见）
    var inviteSection = '';
    var youthProfile = Storage.getProfile(youth.id);
    var isGuardian = youthProfile && AppState.currentUser && youthProfile.currentGuardianId === AppState.currentUser.id;
    if (isGuardian) {
      inviteSection =
        '<div class="grants-sheet-section">' +
          '<div class="grants-sheet-label">家庭成员</div>' +
          '<div class="grants-sheet-user" id="btn-invite-family" style="cursor:pointer;">' +
            '<div class="grants-sheet-user-icon">🔗</div>' +
            '<div class="grants-sheet-user-info">' +
              '<div class="grants-sheet-user-name">邀请家庭成员</div>' +
              '<div class="grants-sheet-user-role">生成邀请码，发送给祖父母、兄弟姐妹等</div>' +
            '</div>' +
            '<div class="grants-sheet-user-check"></div>' +
          '</div>' +
        '</div>';
    }

    // 用户列表 HTML
    var userOptions = '';
    if (availableUsers.length === 0) {
      userOptions = '<div class="grants-sheet-empty">没有可授权的用户</div>';
    } else {
      for (var i = 0; i < availableUsers.length; i++) {
        var u = availableUsers[i];
        var roleLabel = Constants.ROLE_LABELS[u.role] || u.role;
        var permDesc = ROLE_PERMISSION_DESC[u.role] || roleLabel;
        userOptions += '<div class="grants-sheet-user' + (i === 0 ? ' selected' : '') + '" data-user-id="' + u.id + '">' +
          '<div class="grants-sheet-user-icon">' + _getRoleIcon(u.role) + '</div>' +
          '<div class="grants-sheet-user-info">' +
            '<div class="grants-sheet-user-name">' + Utils.escapeHtml(u.name) + '</div>' +
            '<div class="grants-sheet-user-role">' + permDesc + '</div>' +
          '</div>' +
          '<div class="grants-sheet-user-check"></div>' +
        '</div>';
      }
    }

    overlay.innerHTML =
      '<div class="grants-sheet" id="grants-sheet">' +
        '<div class="grants-sheet-handle"></div>' +
        '<div class="grants-sheet-title">添加授权</div>' +
        inviteSection +
        '<div class="grants-sheet-section">' +
          '<div class="grants-sheet-label">选择用户</div>' +
          '<div class="grants-sheet-user-list">' + userOptions + '</div>' +
        '</div>' +
        '<div class="grants-sheet-hint">权限范围由用户角色自动决定</div>' +
        '<button class="grants-sheet-confirm" id="btn-sheet-confirm"' + (availableUsers.length === 0 ? ' disabled' : '') + '>确认授权</button>' +
      '</div>';

    document.body.appendChild(overlay);

    // 选中状态（闭包内可变）
    var selectedUserId = availableUsers.length > 0 ? availableUsers[0].id : null;

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

    // 邀请家庭成员按钮
    var inviteBtn = document.getElementById('btn-invite-family');
    if (inviteBtn) {
      inviteBtn.addEventListener('click', function () {
        _generateInvitationCode(youth);
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
      if (!selectedUserId) return;
      var account = Storage.getAccount(selectedUserId);
      if (!account) return;

      // 刷新权限缓存
      AppState.selectYouth(youth.id);

      var result = Permissions.grantAccess(youth.id, selectedUserId, account.role, null);
      if (result.success) {
        document.body.removeChild(overlay);
        showGrants(youth.id);
      } else {
        // Show error message in the sheet
        var errorMsg = document.querySelector('.grants-sheet-error');
        if (!errorMsg) {
          errorMsg = document.createElement('div');
          errorMsg.className = 'grants-sheet-error';
          var sheet = document.getElementById('grants-sheet');
          sheet.insertBefore(errorMsg, sheet.querySelector('.grants-sheet-confirm'));
        }
        errorMsg.textContent = result.error === 'GRANT_ALREADY_EXISTS' ? '该用户已有有效授权' : '授权失败，请重试';
      }
    });
  }

  return {
    showGrants: showGrants
  };
})();
