/**
 * permissions.js - 角色权限管理
 * 基于"角色 + 授权令牌"双层权限模型
 * 提供权限检查、授权创建/撤销、有效期管理功能
 */
window.Permissions = (function () {
  'use strict';

  // 默认 scope 模板（按角色）
  var SCOPE_TEMPLATES = {
    parent: [
      'read:full',
      'write:communicationGuide', 'write:emotionBehavior',
      'write:careMedical', 'write:workSupport', 'write:relationshipMap',
      'manage:grants'
    ],
    teacher: [
      'read:full',
      'write:communicationGuide', 'write:emotionBehavior',
      'write:workSupport', 'write:careMedical'
    ],
    caregiver: [
      'read:safety', 'read:own_records',
      'write:careMedical'
    ],
    };

  // 所有可写入模块 — 从 Modules.MODULES 派生，避免重复定义
  var ALL_WRITE_MODULES = Modules.MODULES.map(function (m) { return m.key; });

  /**
   * 刷新当前用户对指定心青年的权限缓存
   * 由 AppState.selectYouth() 自动调用
   */
  function refresh(youthId) {
    var user = AppState.getState().currentUser;
    if (!user) {
      AppState.currentGrants = [];
      AppState.canRead = false;
      AppState.canWrite = false;
      AppState.canManage = false;
      return;
    }

    var allGrants = Storage.getAccessGrants(youthId);
    var now = new Date();

    // 过滤出当前用户的有效授权
    var activeGrants = allGrants.filter(function (g) {
      if (g.granteeId !== user.id) return false;
      if (g.status !== 'active') return false;
      // 检查是否过期
      if (g.validUntil && new Date(g.validUntil) < now) return false;
      return true;
    });

    AppState.currentGrants = activeGrants;
    AppState.canRead = _checkRead(activeGrants, user);
    AppState.canWrite = _checkAnyWrite(activeGrants, user);
    AppState.canManage = _checkManage(activeGrants, user);
  }

  /**
   * 检查读取权限
   */
  function _checkRead(grants, user) {
    // 政府角色不可读取个体档案
    if (user.role === 'government') return false;
    // 心青年本人始终可读
    if (user.role === 'youth') return true;
    // 家长始终可读（需有有效授权）
    if (user.role === 'parent' && grants.length > 0) return true;
    // 其他角色检查 scope
    for (var i = 0; i < grants.length; i++) {
      var scope = grants[i].scope;
      if (scope.indexOf('read:full') > -1) return true;
      if (scope.indexOf('read:safety') > -1) return true;
      if (scope.indexOf('read:own_records') > -1) return true;
    }
    return false;
  }

  /**
   * 检查是否有任意写入权限
   */
  function _checkAnyWrite(grants, user) {
    if (user.role === 'government') return false;
    // 心青年可写特定模块
    if (user.role === 'youth') return true;
    // 家长有全部写入权限
    if (user.role === 'parent' && grants.length > 0) return true;
    // 其他角色检查 scope
    for (var i = 0; i < grants.length; i++) {
      var scope = grants[i].scope;
      for (var j = 0; j < ALL_WRITE_MODULES.length; j++) {
        if (scope.indexOf('write:' + ALL_WRITE_MODULES[j]) > -1) return true;
      }
      if (scope.indexOf('write:*') > -1) return true;
    }
    return false;
  }

  /**
   * 检查管理权限
   */
  function _checkManage(grants, user) {
    if (user.role === 'admin') return true;
    if (user.role !== 'parent') return false;
    var youth = AppState.currentYouth;
    if (!youth) return false;
    return youth.currentGuardianId === user.id;
  }

  /**
   * 检查当前用户是否有读取权限
   * @param {string} [module] - 可选指定模块
   */
  function canRead(module) {
    return AppState.canRead;
  }

  /**
   * 检查当前用户是否有写入指定模块的权限
   * @param {string} module - 模块名
   */
  function canWrite(module) {
    var user = AppState.getState().currentUser;
    if (!user) return false;
    if (user.role === 'government') return false;

    // 心青年本人可写情绪行为（心情/愿望）
    if (user.role === 'youth') {
      return module === 'emotionBehavior' || module === 'workSupport';
    }

    // 家长可写所有模块
    if (user.role === 'parent') {
      var grants = AppState.currentGrants;
      if (grants.length === 0) return false;
      for (var i = 0; i < grants.length; i++) {
        var scope = grants[i].scope;
        if (scope.indexOf('write:*') > -1) return true;
        if (scope.indexOf('write:' + module) > -1) return true;
      }
      return false;
    }

    // 其他角色检查 scope
    var grants = AppState.currentGrants;
    for (var i = 0; i < grants.length; i++) {
      var scope = grants[i].scope;
      if (scope.indexOf('write:' + module) > -1) return true;
      if (scope.indexOf('write:*') > -1) return true;
    }
    return false;
  }

  /**
   * 检查当前用户是否有管理权限
   */
  function canManage() {
    return AppState.canManage;
  }

  /**
   * 创建授权令牌
   */
  function grantAccess(youthId, granteeId, granteeRole, validUntil, relation) {
    var user = AppState.getState().currentUser;
    if (!user) {
      return { success: false, error: '未登录' };
    }

    // 前置检查：调用者必须是心青年本人或家长
    if (!canManage()) {
      return { success: false, error: '无授权权限' };
    }

    // 被授权用户必须是已注册账户
    var grantee = Storage.getAccount(granteeId);
    if (!grantee) {
      return { success: false, error: '被授权用户不存在' };
    }

    // 角色必须匹配
    if (grantee.role !== granteeRole) {
      return { success: false, error: '用户角色不匹配' };
    }

    // 检查是否已有 active 授权
    var existingGrants = Storage.getAccessGrants(youthId);
    var hasActive = existingGrants.some(function (g) {
      return g.granteeId === granteeId && g.status === 'active';
    });
    if (hasActive) {
      return { success: false, error: '该用户已有有效授权' };
    }

    // 获取 scope 模板
    var scope = SCOPE_TEMPLATES[granteeRole] || [];
    var now = Utils.formatDateTime();

    var grant = {
      id: Utils.generateUUID(),
      youthId: youthId,
      grantorId: user.id,
      granteeId: granteeId,
      granteeRole: granteeRole,
      relation: relation || null,
      scope: scope,
      validFrom: now,
      validUntil: validUntil || null,
      status: 'active',
      grantedAt: now,
      revokedAt: null,
      revokeReason: null
    };

    var result = Storage.addAccessGrant(grant);
    if (result.success) {
      // 刷新权限缓存
      refresh(youthId);
    }
    return result;
  }

  /**
   * 撤销授权令牌
   */
  function revokeAccess(grantId, reason) {
    var user = AppState.getState().currentUser;
    if (!user) {
      return false;
    }

    // 查找授权记录
    var allGrants = Storage.getAccessGrants();
    var grant = null;
    for (var i = 0; i < allGrants.length; i++) {
      if (allGrants[i].id === grantId) {
        grant = allGrants[i];
        break;
      }
    }

    if (!grant) {
      return false;
    }

    // 前置检查：调用者必须是授权人或心青年本人
    if (grant.grantorId !== user.id && user.role !== 'youth') {
      // 家长也可以撤销（如果有管理权限）
      if (!canManage()) {
        return false;
      }
    }

    var success = Storage.revokeAccessGrant(grantId, reason);
    if (success) {
      // 刷新权限缓存
      if (AppState.currentYouth) {
        refresh(AppState.currentYouth.id);
      }
    }
    return success;
  }

  /**
   * 检查当前用户是否可以看到指定记录
   */
  function checkRecordVisibility(record) {
    var user = AppState.getState().currentUser;
    if (!user) return false;
    if (user.role === 'government') return false;

    var visibility = record.visibilityLevel || 'full';

    if (visibility === 'full') {
      // 心青年本人、家长、服务期内的机构老师
      if (user.role === 'youth') return true;
      if (user.role === 'parent') return AppState.currentGrants.length > 0;
      if (user.role === 'teacher') {
        return AppState.currentGrants.some(function (g) {
          return g.scope.indexOf('read:full') > -1;
        });
      }
      return false;
    }

    if (visibility === 'safety_only') {
      // 所有有授权的角色
      return AppState.currentGrants.length > 0 || user.role === 'youth';
    }

    if (visibility === 'private') {
      // 仅记录者本人、家长、心青年本人
      if (record.recorderId === user.id) return true;
      if (user.role === 'youth') return true;
      if (user.role === 'parent') return AppState.currentGrants.length > 0;
      // 照护者只能看到自己录入的 private 记录
      if (user.role === 'caregiver') {
        return record.recorderId === user.id;
      }
      return false;
    }

    return false;
  }

  /**
   * 检查并标记所有过期授权
   * @returns {number} 本次标记为 expired 的授权数量
   */
  function checkExpired() {
    var allGrants = Storage.getAccessGrants();
    var now = new Date();
    var count = 0;

    for (var i = 0; i < allGrants.length; i++) {
      var grant = allGrants[i];
      if (grant.status === 'active' && grant.validUntil && new Date(grant.validUntil) < now) {
        Storage.updateAccessGrant(grant.id, {
          status: 'expired'
        });
        count++;
      }
    }

    // 如果当前有心青年选中，刷新权限
    if (count > 0 && AppState.currentYouth) {
      refresh(AppState.currentYouth.id);
    }

    return count;
  }

  /**
   * 获取当前用户可访问的所有心青年列表
   */
  function getAccessibleYouths() {
    var user = AppState.getState().currentUser;
    if (!user) return [];

    var allProfiles = Storage.getProfiles();

    // 心青年本人：返回自己的档案
    if (user.role === 'youth') {
      // 通过 grant 查找关联的档案
      var allGrants = Storage.getAccessGrants();
      var youthIds = allGrants
        .filter(function (g) { return g.granteeId === user.id && g.status === 'active'; })
        .map(function (g) { return g.youthId; });
      return youthIds.map(function (id) { return allProfiles[id]; }).filter(Boolean);
    }

    // 家长：返回所有已创建档案的心青年（有授权的）
    if (user.role === 'parent') {
      var allGrants = Storage.getAccessGrants();
      var youthIds = allGrants
        .filter(function (g) { return g.granteeId === user.id && g.status === 'active'; })
        .map(function (g) { return g.youthId; });
      return youthIds.map(function (id) { return allProfiles[id]; }).filter(Boolean);
    }

    // 政府角色：无个体档案访问
    if (user.role === 'government') {
      return [];
    }

    // 其他角色：返回有 active 授权的心青年
    var allGrants = Storage.getAccessGrants();
    var youthIds = allGrants
      .filter(function (g) { return g.granteeId === user.id && g.status === 'active'; })
      .map(function (g) { return g.youthId; });
    return youthIds.map(function (id) { return allProfiles[id]; }).filter(Boolean);
  }

  /**
   * 发起监护权转移
   */
  function initGuardianshipTransfer(youthId, toGuardianId, proof) {
    var user = AppState.getState().currentUser;
    if (!user) {
      return { success: false, error: '未登录' };
    }

    var youth = Storage.getProfile(youthId);
    if (!youth) {
      return { success: false, error: '档案不存在' };
    }

    // 前置检查：调用者必须是当前监护人
    if (youth.currentGuardianId !== user.id) {
      return { success: false, error: '只有当前监护人可发起转移' };
    }

    // 新监护人必须是已注册的 parent 角色账户
    var newGuardian = Storage.getAccount(toGuardianId);
    if (!newGuardian) {
      return { success: false, error: '新监护人账户不存在' };
    }
    if (newGuardian.role !== 'parent') {
      return { success: false, error: '新监护人必须是家长角色' };
    }

    // 检查是否有 pending 的转移记录
    var transfers = Storage.getGuardianshipTransfers(youthId);
    var hasPending = transfers.some(function (t) {
      return t.reviewStatus === 'pending';
    });
    if (hasPending) {
      return { success: false, error: '已有待审核的转移申请' };
    }

    var transfer = {
      id: Utils.generateUUID(),
      youthId: youthId,
      fromGuardianId: user.id,
      toGuardianId: toGuardianId,
      toGuardianProof: proof || null,
      appliedAt: Utils.formatDateTime(),
      reviewStatus: 'pending',
      reviewedAt: null,
      reviewNote: null,
      effectiveAt: null
    };

    return Storage.addGuardianshipTransfer(transfer);
  }

  return {
    SCOPE_TEMPLATES: SCOPE_TEMPLATES,
    refresh: refresh,
    canRead: canRead,
    canWrite: canWrite,
    canManage: canManage,
    grantAccess: grantAccess,
    revokeAccess: revokeAccess,
    checkRecordVisibility: checkRecordVisibility,
    checkExpired: checkExpired,
    getAccessibleYouths: getAccessibleYouths,
    initGuardianshipTransfer: initGuardianshipTransfer
  };
})();
