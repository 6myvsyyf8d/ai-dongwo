/**
 * storage.js - 数据持久化层
 * 封装 localStorage 操作，提供统一的 CRUD 接口
 * 所有数据读写必须通过此模块
 */
window.Storage = (function () {
  'use strict';

  var KEYS = {
    PROFILES: 'ai_dongwo_profiles',
    ACCOUNTS: 'ai_dongwo_accounts',
    RECORDS: 'ai_dongwo_records',
    ARCHIVE_CODES: 'ai_dongwo_archive_codes',
    ACCESS_GRANTS: 'ai_dongwo_access_grants',
    GUARDIANSHIPS: 'ai_dongwo_guardianships',
    ANONYMIZED: 'ai_dongwo_anonymized',
    HANDOVER_TASKS: 'ai_dongwo_handover_tasks',
    TASKS: 'ai_dongwo_tasks',
    JOIN_REQUESTS: 'ai_dongwo_join_requests',
    INVITATIONS: 'ai_dongwo_invitations',
    CURRENT_USER: 'ai_dongwo_current_user',
    VISIBILITY_CONFIG: 'ai_dongwo_visibility_config'
  };

  /**
   * 获取指定 key 的 JSON 数据
   */
  function get(key) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Storage.get: 解析失败 for key "' + key + '":', e);
      return null;
    }
  }

  /**
   * 存储 JSON 数据到指定 key
   */
  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        throw new Error('存储空间不足，请清理浏览器数据后重试');
      }
      throw new Error('数据存储失败: ' + e.message);
    }
  }

  /**
   * 删除指定 key
   */
  function remove(key) {
    localStorage.removeItem(key);
  }

  // ==================== YouthProfile ====================

  function getProfiles() {
    return get(KEYS.PROFILES) || {};
  }

  function getProfile(youthId) {
    var profiles = getProfiles();
    return profiles[youthId] || null;
  }

  function saveProfile(profile) {
    var profiles = getProfiles();

    // 身份证号唯一性校验
    if (profile.idNumber) {
      for (var id in profiles) {
        if (id !== profile.id && profiles[id].idNumber === profile.idNumber) {
          return { success: false, error: 'ID_NUMBER_EXISTS' };
        }
      }
    }

    // 自动更新 updatedAt
    profile.updatedAt = Utils.formatDateTime();

    // 新档案设置初始状态
    if (!profile.createdAt) {
      profile.createdAt = Utils.formatDateTime();
    }
    if (!profile.lifeCycleStatus) {
      profile.lifeCycleStatus = 'created';
    }

    profiles[profile.id] = profile;
    set(KEYS.PROFILES, profiles);
    return { success: true };
  }

  function deleteProfile(youthId) {
    var profiles = getProfiles();
    delete profiles[youthId];
    set(KEYS.PROFILES, profiles);
    // 同时清理关联数据
    var records = get(KEYS.RECORDS) || {};
    delete records[youthId];
    set(KEYS.RECORDS, records);
    return true;
  }

  // ==================== UserAccount ====================

  function getAccounts() {
    return get(KEYS.ACCOUNTS) || {};
  }

  function getAccount(accountId) {
    var accounts = getAccounts();
    return accounts[accountId] || null;
  }

  function saveAccount(account) {
    var accounts = getAccounts();

    // 用户名 + 角色组合唯一性校验
    if (account.name && account.role) {
      for (var id in accounts) {
        if (id !== account.id && accounts[id].name === account.name && accounts[id].role === account.role) {
          return { success: false, error: 'DUPLICATE_NAME_ROLE' };
        }
      }
    }

    if (!account.registeredAt) {
      account.registeredAt = Utils.formatDateTime();
    }
    account.lastLoginAt = Utils.formatDateTime();

    accounts[account.id] = account;
    set(KEYS.ACCOUNTS, accounts);
    return { success: true };
  }

  // ==================== RecordEntry ====================

  function getRecords(youthId) {
    var allRecords = get(KEYS.RECORDS) || {};
    var records = allRecords[youthId] || [];
    // 按 recordedAt 降序排列
    return records.slice().sort(function (a, b) {
      return new Date(b.recordedAt) - new Date(a.recordedAt);
    });
  }

  /**
   * 获取所有心青年的记录映射（用于聚合统计）
   * 返回 { youthId: [record, ...] }
   */
  function getAllRecords() {
    return get(KEYS.RECORDS) || {};
  }

  function addRecord(youthId, record) {
    var allRecords = get(KEYS.RECORDS) || {};
    if (!allRecords[youthId]) {
      allRecords[youthId] = [];
    }

    // 自动生成 UUID
    if (!record.id) {
      record.id = Utils.generateUUID();
    }

    allRecords[youthId].push(record);
    set(KEYS.RECORDS, allRecords);
    return { success: true };
  }

  function updateRecord(youthId, recordId, updates) {
    var allRecords = get(KEYS.RECORDS) || {};
    var records = allRecords[youthId] || [];
    var found = false;

    for (var i = 0; i < records.length; i++) {
      if (records[i].id === recordId) {
        Object.assign(records[i], updates);
        found = true;
        break;
      }
    }

    if (!found) {
      return { success: false, error: 'RECORD_NOT_FOUND' };
    }

    set(KEYS.RECORDS, allRecords);
    return { success: true };
  }

  function deleteRecord(youthId, recordId) {
    var allRecords = get(KEYS.RECORDS) || {};
    var records = allRecords[youthId] || [];
    allRecords[youthId] = records.filter(function (r) { return r.id !== recordId; });
    set(KEYS.RECORDS, allRecords);
    return true;
  }

  // ==================== ArchiveCode ====================

  function getArchiveCode(youthId) {
    var allCodes = get(KEYS.ARCHIVE_CODES) || {};
    var codes = allCodes[youthId] || [];
    // 返回 status === 'active' 的档案码
    var active = codes.filter(function (c) { return c.status === 'active'; });
    return active.length > 0 ? active[active.length - 1] : null;
  }

  function getAllArchiveCodes(youthId) {
    var allCodes = get(KEYS.ARCHIVE_CODES) || {};
    return allCodes[youthId] || [];
  }

  function saveArchiveCode(code) {
    var allCodes = get(KEYS.ARCHIVE_CODES) || {};
    if (!allCodes[code.youthId]) {
      allCodes[code.youthId] = [];
    }

    // 将该心青年的其他档案码标记为 revoked
    for (var i = 0; i < allCodes[code.youthId].length; i++) {
      if (allCodes[code.youthId][i].status === 'active') {
        allCodes[code.youthId][i].status = 'revoked';
        allCodes[code.youthId][i].revokedAt = Utils.formatDateTime();
      }
    }

    allCodes[code.youthId].push(code);
    set(KEYS.ARCHIVE_CODES, allCodes);
  }

  // ==================== AccessGrant ====================

  function getAccessGrants(youthId) {
    var grants = get(KEYS.ACCESS_GRANTS) || [];
    if (youthId) {
      return grants.filter(function (g) { return g.youthId === youthId; });
    }
    return grants;
  }

  function addAccessGrant(grant) {
    var grants = get(KEYS.ACCESS_GRANTS) || [];

    // 检查是否已有 active 授权
    var existing = grants.filter(function (g) {
      return g.youthId === grant.youthId && g.granteeId === grant.granteeId && g.status === 'active';
    });
    if (existing.length > 0) {
      return { success: false, error: 'GRANT_ALREADY_EXISTS' };
    }

    grants.push(grant);
    set(KEYS.ACCESS_GRANTS, grants);
    return { success: true };
  }

  function revokeAccessGrant(grantId, reason) {
    var grants = get(KEYS.ACCESS_GRANTS) || [];
    var found = false;

    for (var i = 0; i < grants.length; i++) {
      if (grants[i].id === grantId) {
        grants[i].status = 'revoked';
        grants[i].revokedAt = Utils.formatDateTime();
        grants[i].revokeReason = reason;
        found = true;
        break;
      }
    }

    if (found) {
      set(KEYS.ACCESS_GRANTS, grants);
    }
    return found;
  }

  function updateAccessGrant(grantId, updates) {
    var grants = get(KEYS.ACCESS_GRANTS) || [];
    for (var i = 0; i < grants.length; i++) {
      if (grants[i].id === grantId) {
        Object.assign(grants[i], updates);
        set(KEYS.ACCESS_GRANTS, grants);
        return true;
      }
    }
    return false;
  }

  // ==================== Invitation ====================

  function getInvitations(youthId) {
    var invitations = get(KEYS.INVITATIONS) || [];
    if (youthId) {
      return invitations.filter(function (inv) { return inv.youthId === youthId; });
    }
    return invitations;
  }

  function getInvitationByCode(code) {
    var invitations = get(KEYS.INVITATIONS) || [];
    for (var i = 0; i < invitations.length; i++) {
      if (invitations[i].code === code) {
        return invitations[i];
      }
    }
    return null;
  }

  function addInvitation(invitation) {
    var invitations = get(KEYS.INVITATIONS) || [];
    if (!invitation.id) {
      invitation.id = Utils.generateUUID();
    }
    if (!invitation.createdAt) {
      invitation.createdAt = Utils.formatDateTime();
    }
    if (!invitation.status) {
      invitation.status = 'active';
    }
    invitations.push(invitation);
    set(KEYS.INVITATIONS, invitations);
    return { success: true };
  }

  function updateInvitation(id, updates) {
    var invitations = get(KEYS.INVITATIONS) || [];
    for (var i = 0; i < invitations.length; i++) {
      if (invitations[i].id === id) {
        Object.assign(invitations[i], updates);
        set(KEYS.INVITATIONS, invitations);
        return true;
      }
    }
    return false;
  }

  function cleanExpiredInvitations() {
    var invitations = get(KEYS.INVITATIONS) || [];
    var now = new Date();
    var changed = false;
    for (var i = 0; i < invitations.length; i++) {
      if (invitations[i].status === 'active' && invitations[i].expiresAt) {
        var expireDate = new Date(invitations[i].expiresAt);
        if (expireDate < now) {
          invitations[i].status = 'expired';
          changed = true;
        }
      }
    }
    if (changed) {
      set(KEYS.INVITATIONS, invitations);
    }
    return changed;
  }

  // ==================== JoinRequest ====================

  function getJoinRequests(youthId) {
    var all = get(KEYS.JOIN_REQUESTS) || [];
    if (youthId) {
      return all.filter(function (r) { return r.youthId === youthId; });
    }
    return all;
  }

  function getJoinRequestsByApplicant(applicantId) {
    var all = get(KEYS.JOIN_REQUESTS) || [];
    return all.filter(function (r) { return r.applicantId === applicantId; });
  }

  function getPendingJoinRequests(youthId) {
    var all = get(KEYS.JOIN_REQUESTS) || [];
    return all.filter(function (r) {
      return r.status === 'pending' && (!youthId || r.youthId === youthId);
    });
  }

  function saveJoinRequest(request) {
    var all = get(KEYS.JOIN_REQUESTS) || [];
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
    set(KEYS.JOIN_REQUESTS, all);
    return { success: true };
  }

  function updateJoinRequest(id, updates) {
    var all = get(KEYS.JOIN_REQUESTS) || [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        for (var key in updates) {
          all[i][key] = updates[key];
        }
        break;
      }
    }
    set(KEYS.JOIN_REQUESTS, all);
  }

  // ==================== GuardianshipTransfer ====================

  function getGuardianshipTransfers(youthId) {
    var transfers = get(KEYS.GUARDIANSHIPS) || [];
    if (youthId) {
      return transfers.filter(function (t) { return t.youthId === youthId; });
    }
    return transfers;
  }

  function addGuardianshipTransfer(transfer) {
    var transfers = get(KEYS.GUARDIANSHIPS) || [];
    transfers.push(transfer);
    set(KEYS.GUARDIANSHIPS, transfers);
    return { success: true };
  }

  function updateGuardianshipTransfer(transferId, updates) {
    var transfers = get(KEYS.GUARDIANSHIPS) || [];
    for (var i = 0; i < transfers.length; i++) {
      if (transfers[i].id === transferId) {
        Object.assign(transfers[i], updates);
        set(KEYS.GUARDIANSHIPS, transfers);
        return true;
      }
    }
    return false;
  }

  // ==================== AnonymizedResearchData ====================

  function getAnonymizedData() {
    return get(KEYS.ANONYMIZED) || [];
  }

  function addAnonymizedData(data) {
    var all = getAnonymizedData();
    all.push(data);
    set(KEYS.ANONYMIZED, all);
  }

  // ==================== CurrentUser ====================

  function getCurrentUser() {
    return get(KEYS.CURRENT_USER);
  }

  function setCurrentUser(accountId) {
    set(KEYS.CURRENT_USER, { accountId: accountId, loginAt: Utils.formatDateTime() });
  }

  function clearCurrentUser() {
    remove(KEYS.CURRENT_USER);
  }

  // ==================== 测试数据初始化 ====================

  /**
   * 初始化虚构测试数据
   * 创建 2 个心青年（小雨、小明）和对应家长账户，预填部分档案数据
   */
  /**
   * 初始化交接任务种子数据（独立于主测试数据初始化）
   */
  function _initHandoverSeedIfNeeded(profiles, accounts) {
    var handover = get(KEYS.HANDOVER_TASKS) || {};
    var youthIds = Object.keys(profiles);
    if (youthIds.length === 0) return;

    var mingId = youthIds[0];
    if (handover[mingId]) {
      console.log('交接任务种子数据已存在，跳过');
      return;
    }

    // 查找需要的账户
    var mingDad = null, mingNanny = null, teacherWang = null, mingMom = null;
    for (var id in accounts) {
      var a = accounts[id];
      if (a.name === '小明爸爸') mingDad = a;
      if (a.name === '小明影子老师') mingNanny = a;
      if (a.name === '王老师') teacherWang = a;
      if (a.name === '小明妈妈') mingMom = a;
    }

    if (!mingDad || !mingNanny || !teacherWang || !mingMom) {
      console.log('交接任务种子数据：缺少必要账户，跳过');
      return;
    }

    var now = Utils.formatDateTime();
    var dayAgo = function (n) {
      var d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString();
    };
    var h0 = dayAgo(0);
    var h1 = dayAgo(1);
    var h2 = dayAgo(2);

    handover[mingId] = [
      { id: Utils.generateUUID(), youthId: mingId, fromUserId: mingDad.id, fromRole: 'parent', toUserId: mingNanny.id, toRole: 'caregiver', content: '小明今天游泳课后需要用毛巾擦干头发，避免感冒', status: 'pending', targetType: 'caregiver', createdAt: h0, updatedAt: h0 },
      { id: Utils.generateUUID(), youthId: mingId, fromUserId: mingNanny.id, fromRole: 'caregiver', toUserId: mingDad.id, toRole: 'parent', content: '小明下午零食吃完了，需要补充无糖饼干和苹果', status: 'pending', targetType: 'caregiver', createdAt: h0, updatedAt: h0 },
      { id: Utils.generateUUID(), youthId: mingId, fromUserId: teacherWang.id, fromRole: 'teacher', toUserId: mingNanny.id, toRole: 'caregiver', content: '明天超市实习需要穿运动鞋，不要穿凉鞋', status: 'pending', targetType: 'caregiver', createdAt: h1, updatedAt: h1 },
      { id: Utils.generateUUID(), youthId: mingId, fromUserId: mingDad.id, fromRole: 'parent', toUserId: teacherWang.id, toRole: 'teacher', content: '小明的情绪记录本在书包里，请老师帮忙检查今天的情绪变化', status: 'done', targetType: 'caregiver', createdAt: h2, updatedAt: h0 },
      { id: Utils.generateUUID(), youthId: mingId, fromUserId: mingMom.id, fromRole: 'parent', toUserId: mingNanny.id, toRole: 'caregiver', content: '周末活动请带小明去公园散步，他喜欢看湖里的鸭子', status: 'pending', targetType: 'caregiver', createdAt: h1, updatedAt: h1 }
    ];
    set(KEYS.HANDOVER_TASKS, handover);
    console.log('交接任务种子数据初始化完成：小明 ' + handover[mingId].length + ' 条任务');
  }


  function initTestData() {
    // 检查是否已初始化
    var profiles = getProfiles();
    var accounts = getAccounts();
    if (profiles && Object.keys(profiles).length > 0 && accounts && Object.keys(accounts).length > 0) {
      var hasEmptyPin = false;
      for (var id in accounts) {
        if (!accounts[id].pinHash && accounts[id].role === 'parent') {
          hasEmptyPin = true;
          break;
        }
      }
      if (!hasEmptyPin) {
        console.log('测试数据已存在且有效，跳过初始化');
        // 但交接任务可能尚未初始化，检查并补充
        _initHandoverSeedIfNeeded(profiles, accounts);
        return;
      }
    }

    var now = Utils.formatDateTime();

    // ==================== 创建账户 ====================
    var mingDad = {
      id: Utils.generateUUID(), name: '小明爸爸', phone: '13800138001', role: 'parent',
      pinHash: '', institutionName: null, registeredAt: now, lastLoginAt: null, isActive: true
    };
    var mingMom = {
      id: Utils.generateUUID(), name: '小明妈妈', phone: '13800138002', role: 'parent',
      pinHash: '', institutionName: null, registeredAt: now, lastLoginAt: null, isActive: true
    };
    var mingNanny = {
      id: Utils.generateUUID(), name: '小明影子老师', phone: '13800138003', role: 'caregiver',
      pinHash: '', institutionName: null, registeredAt: now, lastLoginAt: null, isActive: true
    };
    var huaDad = {
      id: Utils.generateUUID(), name: '小花爸爸', phone: '13800138004', role: 'parent',
      pinHash: '', institutionName: null, registeredAt: now, lastLoginAt: null, isActive: true
    };
    var huaMom = {
      id: Utils.generateUUID(), name: '小花妈妈', phone: '13800138005', role: 'parent',
      pinHash: '', institutionName: null, registeredAt: now, lastLoginAt: null, isActive: true
    };
    var huaNanny = {
      id: Utils.generateUUID(), name: '小花影子老师', phone: '13800138006', role: 'caregiver',
      pinHash: '', institutionName: null, registeredAt: now, lastLoginAt: null, isActive: true
    };
    var teacherWang = {
      id: Utils.generateUUID(), name: '王老师', phone: '13800138007', role: 'teacher',
      pinHash: '', institutionName: '阳光家园', registeredAt: now, lastLoginAt: null, isActive: true
    };
    var mingYouth = {
      id: Utils.generateUUID(), name: '小明', phone: '13800138010', role: 'youth',
      pinHash: '', institutionName: null, registeredAt: now, lastLoginAt: null, isActive: true
    };
    var govObserver = {
      id: Utils.generateUUID(), name: '政府观察员', phone: '13800138009', role: 'government',
      pinHash: '', institutionName: '残联', registeredAt: now, lastLoginAt: null, isActive: true
    };
    var adminUser = {
      id: Utils.generateUUID(), name: '系统管理员', phone: '13800138000', role: 'admin',
      pinHash: '', institutionName: '系统管理', registeredAt: now, lastLoginAt: null, isActive: true
    };

    var accounts = {};
    accounts[mingDad.id] = mingDad;
    accounts[mingMom.id] = mingMom;
    accounts[mingNanny.id] = mingNanny;
    accounts[huaDad.id] = huaDad;
    accounts[huaMom.id] = huaMom;
    accounts[huaNanny.id] = huaNanny;
    accounts[teacherWang.id] = teacherWang;
    accounts[mingYouth.id] = mingYouth;
    accounts[govObserver.id] = govObserver;
    accounts[adminUser.id] = adminUser;
    set(KEYS.ACCOUNTS, accounts);

    // 异步设置 PIN 哈希（统一 PIN: 1234）
    Utils.hashPin('1234').then(function (hash) {
      var stored = getAccounts();
      var ids = [mingDad.id, mingMom.id, mingNanny.id, huaDad.id, huaMom.id, huaNanny.id, teacherWang.id, mingYouth.id, govObserver.id, adminUser.id];
      for (var i = 0; i < ids.length; i++) {
        if (stored[ids[i]]) stored[ids[i]].pinHash = hash;
      }
      set(KEYS.ACCOUNTS, stored);
      console.log('测试账户 PIN 哈希已设置（统一 PIN: 1234）');
    });

    // ==================== 创建心青年档案 ====================

    // --- 小明 ---
    var mingId = Utils.generateUUID();
    var ming = {
      id: mingId,
      idNumber: '210202200008221537',
      name: '小明',
      gender: 'male',
      birthDate: '2000-08-22',
      avatar: '🌟',
      lifeCycleStatus: 'active',
      currentGuardianId: mingDad.id,
      emergencyContacts: [
        { name: '小明爸爸', relation: '家长', phone: '13800138001' },
        { name: '小明妈妈', relation: '家长', phone: '13800138002' },
        { name: '社区医院', relation: '医疗', phone: '021-12345678' }
      ],
      modules: {
        communicationGuide: {
          preferredMethods: [
            { method: '简短句子', description: '每次只说一件事，用简单词汇' },
            { method: '视觉提示', description: '用手指或图片辅助理解' },
            { method: '给予选择', description: '提供两个选项让他自己选' }
          ],
          expressionDifficulties: '抽象概念理解困难，需要具体例子',
          tipAbout: '小明对抽象的指令和突然的变化比较敏感，需要给他具体、可预测的信息',
          tipCommon: '许多孤独症伙伴依赖可预测的规律和具体提示来理解世界，这不是固执，而是他们处理信息的方式',
          specialHabits: ['喜欢重复确认时间和安排', '紧张时会搓手'],
          habitsTipAbout: '小明通过重复确认时间和搓手来让自己感到安心，这是他调节情绪的方式',
          habitsTipCommon: '重复行为和自我刺激是孤独症伙伴调节感官和情绪的自然方式，强行制止反而会让他们更焦虑',
          sensoryPreferences: { avoid: ['突然的触碰', '大声喧哗'], prefer: ['规律的环境', '柔和的背景音乐'] }
        },
        emotionBehavior: {
          behaviorRedLines: [
            { description: '被催促时会坐下不动拒绝配合', trigger: '时间压力', response: '给予额外时间，分解任务为小步骤', severity: 'medium',
              story: '上次超市快关门时，爸爸急着说"快点快点"，小明就原地坐下了。直到爸爸蹲下来，一句一句说"我们先拿牛奶，再拿面包，然后回家"，他才站起来',
              tipAbout: '对小明来说，催促会让他感到失控和焦虑，坐下不动是他保护自己的方式',
              tipCommon: '时间压力和模糊指令是孤独症伙伴常见的焦虑来源，他们需要明确的步骤和充足的时间来处理信息' },
            { description: '物品位置改变会不安踱步', trigger: '环境变化', response: '提前说明并一起调整物品位置', severity: 'low',
              story: '有一次妈妈把沙发上的拼图收进了柜子，小明来回走了十几分钟，直到妈妈把拼图拿出来放回原处，他才平静下来',
              tipAbout: '小明对物品的位置有很强的记忆和依赖，改变会让他感到不安',
              tipCommon: '对环境和物品位置的执着是孤独症伙伴寻求安全感的常见方式，熟悉的环境能给他们带来确定性' },
            { description: '游泳时突然被水溅到脸会恐慌', trigger: '水溅面部', response: '立即带离水面，用毛巾擦脸，轻声安抚', severity: 'high',
              story: '上次游泳课，旁边的小朋友拍水玩，水花溅到小明脸上，他突然尖叫着往池边跑。教练用毛巾帮他擦干脸后，他才慢慢平静下来',
              tipAbout: '小明对脸部的触觉特别敏感，水溅到脸上会让他感到强烈的恐慌',
              tipCommon: '感官过敏是孤独症的常见特征，某些刺激对孤独症伙伴来说可能被放大数倍，这不是小题大做' }
          ],
          emotionTrend: [
            { date: Utils.formatDate(new Date(Date.now() - 6 * 86400000)), mood: 'good', note: '拼图完成很开心' },
            { date: Utils.formatDate(new Date(Date.now() - 5 * 86400000)), mood: 'neutral', note: '' },
            { date: Utils.formatDate(new Date(Date.now() - 4 * 86400000)), mood: 'good', note: '去超市购物' },
            { date: Utils.formatDate(new Date(Date.now() - 3 * 86400000)), mood: 'low', note: '睡眠不好' },
            { date: Utils.formatDate(new Date(Date.now() - 2 * 86400000)), mood: 'neutral', note: '' },
            { date: Utils.formatDate(new Date(Date.now() - 1 * 86400000)), mood: 'great', note: '游泳课表现很好' },
            { date: Utils.formatDate(), mood: 'good', note: '今天主动帮忙整理玩具' }
          ],
          interventionHistory: [
            { strategy: '提前告知日程变化', effectiveness: 'effective', appliedAt: now },
            { strategy: '任务分解卡片', effectiveness: 'partial', appliedAt: now }
          ]
        },
        careMedical: {
          allergies: ['海鲜', '芒果'],
          medications: [
            { name: '钙片', dosage: '1片', frequency: '每日一次', prescriber: '社区医院', startDate: '2025-01-01', notes: '晚餐后服用' }
          ],
          medicalHistory: [
            { event: '常规体检', date: '2026-06-15', facility: '社区医院', notes: '各项指标正常，身高体重增长良好' }
          ],
          careNotes: ['游泳后需及时擦干身体防止感冒', '对海鲜过敏需严格注意饮食'],
          dailyRoutine: { wakeTime: '06:30', mealTimes: ['07:00', '12:00', '18:00'], sleepTime: '21:30' }
        },
        workSupport: {
          favoriteActivities: ['拼图', '听故事', '游泳', '搭积木'],
          favoritePlaces: ['操场', '超市', '游泳馆'],
          futureWishes: [
            { text: '想在超市工作', recordedAt: now },
            { text: '想学会游泳', recordedAt: now }
          ],
          ispPlans: [
            { title: '超市理货技能训练', goals: ['学会分类摆放商品', '提升手眼协调能力'], status: 'active', startDate: '2026-03-01', reviewDate: '2026-09-01', notes: '每周两次，每次1小时' },
            { title: '社交沟通训练', goals: ['学会主动打招呼', '在小组中表达需求'], status: 'active', startDate: '2026-04-01', reviewDate: '2026-10-01', notes: '小组活动' }
          ],
          capabilityAssessment: {
            socialInteraction: 2, selfCare: 3, workSkills: 3, communityAccess: 2, communication: 2,
            assessedAt: '2026-05-01', assessorId: teacherWang.id
          },
          workPreferences: ['理货', '清洁', '简单包装']
        }
      },
      createdAt: now, updatedAt: now, deceasedAt: null
    };

    // --- 小花 ---
    var huaId = Utils.generateUUID();
    var hua = {
      id: huaId,
      idNumber: '210202200503152048',
      name: '小花',
      gender: 'female',
      birthDate: '2005-03-15',
      avatar: '🌸',
      lifeCycleStatus: 'active',
      currentGuardianId: huaDad.id,
      emergencyContacts: [
        { name: '小花爸爸', relation: '家长', phone: '13800138004' },
        { name: '小花妈妈', relation: '家长', phone: '13800138005' },
        { name: '市人民医院', relation: '医疗', phone: '021-87654321' }
      ],
      modules: {
        communicationGuide: {
          preferredMethods: [
            { method: '鼓励表达', description: '耐心等待她说完，不打断' },
            { method: '用画沟通', description: '她喜欢用画画表达想法' },
            { method: '正面引导', description: '多说"可以这样做"而非"不要那样"' }
          ],
          expressionDifficulties: '在陌生环境中不太敢开口说话',
          tipAbout: '小花在熟悉的环境里很活泼，但面对陌生人或新环境时会变得安静，她需要时间慢慢适应',
          tipCommon: '许多孤独症伙伴在新环境中需要更多时间来观察和适应，安静不代表不感兴趣，这是他们在用自己的节奏建立安全感',
          specialHabits: ['开心时会哼歌', '紧张时会反复整理头发'],
          habitsTipAbout: '小花通过哼歌和整理头发来表达情绪，开心时哼歌是她的快乐信号，整理头发说明她需要一点支持',
          habitsTipCommon: '自我调节行为是孤独症伙伴管理情绪的重要方式，这些行为不是"问题"，而是他们与外界沟通的桥梁',
          sensoryPreferences: { avoid: ['强光闪烁', '嘈杂环境'], prefer: ['柔和的音乐', '温暖的色调'] }
        },
        emotionBehavior: {
          behaviorRedLines: [
            { description: '嘈杂环境中会捂耳朵并尖叫', trigger: '噪音刺激', response: '带至安静环境，轻声安抚，给耳机', severity: 'high',
              story: '上次商场搞活动，广播声和人群声混在一起，小花突然捂住耳朵尖叫起来。老师赶紧带她到商场的母婴室，关上门后她慢慢放下了手，还小声说了句"太吵了"',
              tipAbout: '小花的听觉非常敏感，突然的或持续的噪音会让她感到剧烈的痛苦，尖叫是她求助的信号',
              tipCommon: '听觉过敏是孤独症中常见的感官特征，普通音量对孤独症伙伴来说可能如同噪音轰炸，这不是任性' },
            { description: '不喜欢被陌生人触碰头部', trigger: '身体接触', response: '从侧面接近，先打招呼再行动', severity: 'medium',
              story: '有一次新来的志愿者想摸摸小花的头夸她画得好，小花立刻躲开了，之后一整节课都不愿意和那个志愿者说话。后来熟悉的老师从侧面走过去，先叫了她的名字，她才重新开始画画',
              tipAbout: '小花对身体接触很敏感，尤其是头部，陌生人的触碰会让她感到被侵犯',
              tipCommon: '触觉防御是孤独症伙伴常见的感官特征，尊重他们的身体边界是建立信任的第一步，而不是强迫适应' },
            { description: '画画被打断会情绪低落很久', trigger: '任务中断', response: '提前告知剩余时间，给缓冲期', severity: 'medium',
              story: '上周美术课还剩5分钟时，老师没说就收走了画具，小花趴在桌上不说话，直到下一节课都拒绝参与任何活动。后来老师学会了提前说"还有5分钟，可以把最后一笔画完"，她就会自己收好画具',
              tipAbout: '对小花来说，画画是她表达自己最重要的方式，突然打断会让她觉得自己的表达不被尊重',
              tipCommon: '许多孤独症伙伴对正在进行的任务有很强的专注力，突然切换会引发强烈的情绪反应，提前预告和缓冲期是关键' }
          ],
          emotionTrend: [
            { date: Utils.formatDate(new Date(Date.now() - 6 * 86400000)), mood: 'good', note: '画了一幅很漂亮的画' },
            { date: Utils.formatDate(new Date(Date.now() - 5 * 86400000)), mood: 'great', note: '唱歌课受到老师表扬' },
            { date: Utils.formatDate(new Date(Date.now() - 4 * 86400000)), mood: 'neutral', note: '' },
            { date: Utils.formatDate(new Date(Date.now() - 3 * 86400000)), mood: 'good', note: '和小朋友们一起跳舞' },
            { date: Utils.formatDate(new Date(Date.now() - 2 * 86400000)), mood: 'low', note: '花粉过敏有点不舒服' },
            { date: Utils.formatDate(new Date(Date.now() - 1 * 86400000)), mood: 'neutral', note: '' },
            { date: Utils.formatDate(), mood: 'good', note: '今天主动帮老师整理画具' }
          ],
          interventionHistory: [
            { strategy: '降噪耳机', effectiveness: 'effective', appliedAt: now },
            { strategy: '提前预告活动结束时间', effectiveness: 'effective', appliedAt: now }
          ]
        },
        careMedical: {
          allergies: ['花粉', '牛奶', '青霉素'],
          medications: [
            { name: '氯雷他定', dosage: '半片', frequency: '花粉季节每日一次', prescriber: '市人民医院', startDate: '2026-03-01', notes: '过敏季服用，睡前服用' }
          ],
          medicalHistory: [
            { event: '过敏原检测', date: '2026-03-10', facility: '市人民医院', notes: '确认花粉、牛奶、青霉素过敏' },
            { event: '常规体检', date: '2026-06-20', facility: '社区医院', notes: '生长发育正常' }
          ],
          careNotes: ['春季需注意花粉过敏防护', '饮食严格避免牛奶制品', '过敏发作时及时给药'],
          dailyRoutine: { wakeTime: '07:00', mealTimes: ['07:30', '12:00', '18:00'], sleepTime: '22:00' }
        },
        workSupport: {
          favoriteActivities: ['画画', '唱歌', '跳舞', '做手工'],
          favoritePlaces: ['公园', '图书馆', '音乐教室'],
          futureWishes: [
            { text: '想学会弹钢琴', recordedAt: now },
            { text: '想参加画画比赛', recordedAt: now }
          ],
          ispPlans: [
            { title: '艺术表达训练', goals: ['提升绘画技能', '用画画表达情绪'], status: 'active', startDate: '2026-02-01', reviewDate: '2026-08-01', notes: '每周三次美术课' },
            { title: '社交互动训练', goals: ['在小组中主动发言', '学会轮流等待'], status: 'active', startDate: '2026-04-01', reviewDate: '2026-10-01', notes: '小组活动' }
          ],
          capabilityAssessment: {
            socialInteraction: 3, selfCare: 4, workSkills: 2, communityAccess: 3, communication: 3,
            assessedAt: '2026-05-15', assessorId: teacherWang.id
          },
          workPreferences: ['绘画', '手工制作', '图书整理']
        }
      },
      createdAt: now, updatedAt: now, deceasedAt: null
    };

    var profiles = {};
    profiles[mingId] = ming;
    profiles[huaId] = hua;
    set(KEYS.PROFILES, profiles);

    // ==================== 创建授权 ====================
    var fullScope = ['read:full', 'write:communicationGuide', 'write:emotionBehavior', 'write:careMedical', 'write:workSupport', 'manage:grants'];
    var readScope = ['read:full', 'write:communicationGuide', 'write:emotionBehavior', 'write:careMedical'];

    var grants = [
      { id: Utils.generateUUID(), youthId: mingId, grantorId: mingId, granteeId: mingDad.id, granteeRole: 'parent', scope: fullScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: mingId, grantorId: mingId, granteeId: mingMom.id, granteeRole: 'parent', scope: fullScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: mingId, grantorId: mingId, granteeId: mingNanny.id, granteeRole: 'caregiver', scope: readScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: mingId, grantorId: mingId, granteeId: teacherWang.id, granteeRole: 'teacher', scope: readScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: mingId, grantorId: mingId, granteeId: mingYouth.id, granteeRole: 'youth', scope: fullScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: huaId, grantorId: huaId, granteeId: huaDad.id, granteeRole: 'parent', scope: fullScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: huaId, grantorId: huaId, granteeId: huaMom.id, granteeRole: 'parent', scope: fullScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: huaId, grantorId: huaId, granteeId: huaNanny.id, granteeRole: 'caregiver', scope: readScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: huaId, grantorId: huaId, granteeId: teacherWang.id, granteeRole: 'teacher', scope: readScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null }
    ];
    set(KEYS.ACCESS_GRANTS, grants);

    // ==================== 创建 30 天模拟记录 ====================
    // 过去 30 天（d0=今天, d29=29天前）
    function dayAgo(n) { return Utils.formatDateTime(new Date(Date.now() - n * 86400000)); }
    function r(youthId, recorderId, recorderRole, module, text, tags, dayOffset) {
      return { id: Utils.generateUUID(), youthId: youthId, recorderId: recorderId, recorderRole: recorderRole, module: module, recordType: 'observation', content: { text: text, tags: tags }, visibilityLevel: 'full', recordedAt: dayAgo(dayOffset), isOffline: false, syncedAt: null };
    }

    var records = {};
    var mingRecs = [];

    // === 小明 30天记录 ===
    // 小明爸爸 — 几乎每天有记录
    mingRecs.push(r(mingId, mingDad.id, 'parent', 'emotionBehavior', '今天拼图完成得很开心，主动拿给我看，还指着图案笑', ['积极', '专注'], 29));
    mingRecs.push(r(mingId, mingDad.id, 'parent', 'careMedical', '早上按时吃了钙片，早餐吃了鸡蛋和粥，胃口不错', ['用药', '饮食'], 29));
    mingRecs.push(r(mingId, mingDad.id, 'parent', 'emotionBehavior', '去超市路上很兴奋，一路指着路边的车念颜色', ['出行', '积极'], 28));
    mingRecs.push(r(mingId, mingDad.id, 'parent', 'careMedical', '今晚睡得挺好，九点半就睡着了，整夜没醒', ['睡眠', '良好'], 27));
    mingRecs.push(r(mingId, mingDad.id, 'parent', 'workSupport', '超市理货训练进步很大，能独立把饮料按颜色分类了', ['工作训练', '进步'], 26));
    mingRecs.push(r(mingId, mingDad.id, 'parent', 'emotionBehavior', '今天有点烦躁，因为预约的游泳课临时取消了', ['情绪', '低落'], 25));
    mingRecs.push(r(mingId, mingDad.id, 'parent', 'careMedical', '晚上没怎么吃饭，说是肚子不太舒服，观察一下', ['饮食', '注意'], 25));
    mingRecs.push(r(mingId, mingDad.id, 'parent', 'emotionBehavior', '今天情绪恢复了不少，早上主动说要去超市', ['恢复', '积极'], 24));
    mingRecs.push(r(mingId, mingDad.id, 'parent', 'careMedical', '肚子好转了，中午吃了大半碗饭，精神状态不错', ['恢复', '饮食'], 24));
    mingRecs.push(r(mingId, mingDad.id, 'parent', 'workSupport', '今天练习了超市扫码，虽然慢但很认真，正确率70%', ['工作训练', '认真'], 23));
    mingRecs.push(r(mingId, mingDad.id, 'parent', 'emotionBehavior', '和小花一起玩拼图，两个人合作得很好，很开心', ['社交', '合作'], 22));
    mingRecs.push(r(mingId, mingDad.id, 'parent', 'careMedical', '今天游泳后擦干了身体，没有感冒迹象', ['护理', '良好'], 21));
    // 小明妈妈 — 隔天记录
    mingRecs.push(r(mingId, mingMom.id, 'parent', 'communicationGuide', '今天用图片卡表达了想吃苹果，比以前用手指更清楚了', ['沟通', '进步'], 29));
    mingRecs.push(r(mingId, mingMom.id, 'parent', 'workSupport', '带他去公园，看到湖里的鸭子很开心，一直指着笑', ['户外', '开心'], 27));
    mingRecs.push(r(mingId, mingMom.id, 'parent', 'emotionBehavior', '今天在家有点闹脾气，因为积木搭不好，后来我帮他一起完成了', ['情绪', '挫折'], 25));
    mingRecs.push(r(mingId, mingMom.id, 'parent', 'careMedical', '晚餐做了他喜欢的番茄炒蛋，全吃完了，胃口不错', ['饮食', '良好'], 24));
    mingRecs.push(r(mingId, mingMom.id, 'parent', 'workSupport', '去超市购物，自己选了饼干和酸奶，很开心', ['购物', '自主'], 22));
    mingRecs.push(r(mingId, mingMom.id, 'parent', 'communicationGuide', '今天用两个选项让他选晚餐，他选了面条而不是饭', ['选择', '沟通'], 20));
    mingRecs.push(r(mingId, mingMom.id, 'parent', 'emotionBehavior', '今天主动帮忙摆碗筷，还说了谢谢，很暖心', ['积极', '礼貌'], 18));
    mingRecs.push(r(mingId, mingMom.id, 'parent', 'careMedical', '晚上睡觉前有点咳嗽，给喝了温水，观察中', ['健康', '注意'], 17));
    // 小明影子老师 — 工作日记录
    mingRecs.push(r(mingId, mingNanny.id, 'caregiver', 'careMedical', '中午检查了菜单，确认没有海鲜和芒果，午餐吃了番茄炒蛋和米饭', ['饮食', '过敏'], 28));
    mingRecs.push(r(mingId, mingNanny.id, 'caregiver', 'emotionBehavior', '下午搭积木时被电话打断有点烦躁，给了5分钟缓冲后平静下来了', ['情绪', '自我调节'], 26));
    mingRecs.push(r(mingId, mingNanny.id, 'caregiver', 'workSupport', '游泳课表现很好，能自己漂浮5秒了，教练表扬了他', ['游泳', '进步'], 24));
    mingRecs.push(r(mingId, mingNanny.id, 'caregiver', 'careMedical', '零食吃完了，需要补充无糖饼干和苹果', ['饮食', '补充'], 23));
    mingRecs.push(r(mingId, mingNanny.id, 'caregiver', 'emotionBehavior', '午睡醒来有点迷糊，喝了水后慢慢精神了', ['日常', '平稳'], 21));
    mingRecs.push(r(mingId, mingNanny.id, 'caregiver', 'workSupport', '今天练习了叠衣服，虽然叠得不太整齐但很认真', ['生活技能', '训练'], 19));
    mingRecs.push(r(mingId, mingNanny.id, 'caregiver', 'careMedical', '下午带去公园散步，走了半小时，运动量达标', ['运动', '户外'], 18));
    mingRecs.push(r(mingId, mingNanny.id, 'caregiver', 'emotionBehavior', '今天整体情绪平稳，没有出现大的情绪波动', ['平稳', '良好'], 17));
    mingRecs.push(r(mingId, mingNanny.id, 'caregiver', 'careMedical', '午餐吃了青菜和肉丸，胃口一般，青菜剩了一些', ['饮食', '一般'], 16));
    mingRecs.push(r(mingId, mingNanny.id, 'caregiver', 'workSupport', '游泳课学会了换气，非常大的进步，教练很惊喜', ['游泳', '里程碑'], 15));
    mingRecs.push(r(mingId, mingNanny.id, 'caregiver', 'emotionBehavior', '今天被其他小朋友抢了玩具，哭了一会儿，后来老师安抚好了', ['情绪', '冲突'], 13));
    mingRecs.push(r(mingId, mingNanny.id, 'caregiver', 'careMedical', '膝盖擦破了一点皮，已经消毒处理，不严重', ['外伤', '处理'], 11));
    // 王老师 — 教学日记录
    mingRecs.push(r(mingId, teacherWang.id, 'teacher', 'workSupport', '超市理货训练：今天练习了饮料按颜色分类，完成度80%', ['工作训练', 'ISP'], 28));
    mingRecs.push(r(mingId, teacherWang.id, 'teacher', 'emotionBehavior', '小组活动中主动和小花一起完成拼图，合作意识明显提升', ['社交', '进步'], 26));
    mingRecs.push(r(mingId, teacherWang.id, 'teacher', 'communicationGuide', '用两个选项让他选活动，选了游泳而不是拼图，选择能力在提升', ['沟通', '选择'], 24));
    mingRecs.push(r(mingId, teacherWang.id, 'teacher', 'workSupport', '社交沟通训练：今天在小组中主动举手发言了一次', ['社交', '进步'], 22));
    mingRecs.push(r(mingId, teacherWang.id, 'teacher', 'emotionBehavior', '今天被催促时没有坐下不动，而是说了"等一下"，进步很大', ['情绪', '里程碑'], 20));
    mingRecs.push(r(mingId, teacherWang.id, 'teacher', 'communicationGuide', '用视觉提示卡完成了洗手流程，每一步都跟上了', ['视觉提示', '进步'], 19));
    mingRecs.push(r(mingId, teacherWang.id, 'teacher', 'workSupport', '理货训练：今天能独立完成饼干分类，正确率90%', ['工作训练', '进步'], 17));
    mingRecs.push(r(mingId, teacherWang.id, 'teacher', 'emotionBehavior', '今天情绪整体平稳，和同学们的互动比上周多', ['平稳', '社交'], 15));
    mingRecs.push(r(mingId, teacherWang.id, 'teacher', 'communicationGuide', '在小组讨论中能用简短句子表达需求了，虽然还需要提示', ['语言', '进步'], 14));
    mingRecs.push(r(mingId, teacherWang.id, 'teacher', 'workSupport', '今天第一次尝试了简单包装任务，完成度60%，需要继续练习', ['工作训练', '新任务'], 12));
    mingRecs.push(r(mingId, teacherWang.id, 'teacher', 'emotionBehavior', '情绪有点低落，因为今天没有游泳课，用拼图分散了注意力', ['情绪', '低落'], 10));
    mingRecs.push(r(mingId, teacherWang.id, 'teacher', 'workSupport', '理货训练持续进步，今天速度比上周快了30%', ['工作训练', '进步'], 8));
    mingRecs.push(r(mingId, teacherWang.id, 'teacher', 'communicationGuide', '能主动对老师说"谢谢"和"再见"了，语言表达越来越自然', ['语言', '里程碑'], 5));
    // 小明本人 — 心青年记录
    mingRecs.push(r(mingId, mingYouth.id, 'youth', 'emotionBehavior', '今天很开心，去超市买了喜欢的饼干', ['心情', '购物'], 28));
    mingRecs.push(r(mingId, mingYouth.id, 'youth', 'workSupport', '我想学游泳，今天教练说我进步了', ['愿望', '游泳'], 24));
    mingRecs.push(r(mingId, mingYouth.id, 'youth', 'emotionBehavior', '今天不太开心，积木倒了', ['心情', '挫折'], 22));
    mingRecs.push(r(mingId, mingYouth.id, 'youth', 'workSupport', '我喜欢拼图，想买新的拼图', ['兴趣', '愿望'], 18));
    mingRecs.push(r(mingId, mingYouth.id, 'youth', 'emotionBehavior', '今天很好，和小花一起玩', ['心情', '社交'], 14));
    mingRecs.push(r(mingId, mingYouth.id, 'youth', 'workSupport', '想去超市工作，我喜欢整理东西', ['愿望', '工作'], 9));
    mingRecs.push(r(mingId, mingYouth.id, 'youth', 'emotionBehavior', '今天游泳很开心，学会了换气', ['心情', '成就'], 3));
    // 近3天记录（确保日报有内容）
    mingRecs.push(r(mingId, mingDad.id, 'parent', 'emotionBehavior', '今天心情不错，早餐吃了喜欢的鸡蛋饼，还主动帮忙收拾了碗筷', ['积极', '主动'], 2));
    mingRecs.push(r(mingId, mingDad.id, 'parent', 'careMedical', '今天按时吃了钙片，游泳课后精神很好，晚饭全吃完了', ['用药', '饮食'], 2));
    mingRecs.push(r(mingId, mingNanny.id, 'caregiver', 'workSupport', '昨天游泳课表现很棒，能独立游5米了，教练说进步很大', ['游泳', '进步'], 1));
    mingRecs.push(r(mingId, mingNanny.id, 'caregiver', 'careMedical', '昨天午餐检查了没有海鲜，吃了鸡腿和西兰花，胃口很好', ['饮食', '过敏'], 1));
    mingRecs.push(r(mingId, teacherWang.id, 'teacher', 'emotionBehavior', '昨天小组活动中小明主动帮助了同学，社交能力明显提升', ['社交', '进步'], 1));
    mingRecs.push(r(mingId, mingMom.id, 'parent', 'workSupport', '今天带他去超市购物，自己选了水果和面包，还用图片卡告诉了收银员', ['购物', '沟通'], 0));
    mingRecs.push(r(mingId, mingMom.id, 'parent', 'communicationGuide', '今天用图片卡成功表达了想喝橙汁，比以前用手指更准确了', ['沟通', '进步'], 0));
    mingRecs.push(r(mingId, mingNanny.id, 'caregiver', 'careMedical', '今天午餐吃了清蒸鱼和青菜，全部吃完，胃口很好', ['饮食', '良好'], 0));
    mingRecs.push(r(mingId, mingNanny.id, 'caregiver', 'emotionBehavior', '今天整体情绪平稳，午睡睡了一个小时，醒来精神很好', ['平稳', '睡眠'], 0));
    mingRecs.push(r(mingId, teacherWang.id, 'teacher', 'workSupport', '今天理货训练完成度95%，速度快了很多，可以独立完成简单分类', ['工作训练', '里程碑'], 0));

    records[mingId] = mingRecs;

    // === 小花 30天记录 ===
    var huaRecs = [];
    // 小花爸爸
    huaRecs.push(r(huaId, huaDad.id, 'parent', 'emotionBehavior', '今天画了一幅花园的画，色彩搭配很漂亮，主动拿给我看', ['画画', '积极'], 29));
    huaRecs.push(r(huaId, huaDad.id, 'parent', 'careMedical', '早上花粉过敏有点重，打了几个喷嚏，按时吃药后好转', ['过敏', '用药'], 29));
    huaRecs.push(r(huaId, huaDad.id, 'parent', 'emotionBehavior', '去图书馆看了画册，很安静地看了半小时，非常专注', ['专注', '阅读'], 28));
    huaRecs.push(r(huaId, huaDad.id, 'parent', 'careMedical', '今天花粉指数低，没有过敏症状，精神状态很好', ['过敏', '良好'], 27));
    huaRecs.push(r(huaId, huaDad.id, 'parent', 'workSupport', '画了一幅向日葵，构图和配色都有进步，老师表扬了', ['画画', '进步'], 26));
    huaRecs.push(r(huaId, huaDad.id, 'parent', 'emotionBehavior', '今天有点沉默，不太想说话，可能是昨晚没睡好', ['情绪', '低落'], 25));
    huaRecs.push(r(huaId, huaDad.id, 'parent', 'careMedical', '晚上睡得不太好，翻来覆去，可能是白天太兴奋了', ['睡眠', '注意'], 25));
    huaRecs.push(r(huaId, huaDad.id, 'parent', 'emotionBehavior', '今天恢复了，早上主动唱了歌，心情很好', ['恢复', '积极'], 24));
    huaRecs.push(r(huaId, huaDad.id, 'parent', 'careMedical', '早餐确认没有牛奶制品，喝了豆浆，午餐避开了含奶食品', ['饮食', '过敏'], 24));
    huaRecs.push(r(huaId, huaDad.id, 'parent', 'workSupport', '今天尝试了用水彩画画，虽然不熟练但很感兴趣', ['画画', '新技能'], 23));
    huaRecs.push(r(huaId, huaDad.id, 'parent', 'emotionBehavior', '和小明一起做手工，合作得很愉快，两人都笑得很开心', ['社交', '合作'], 22));
    huaRecs.push(r(huaId, huaDad.id, 'parent', 'careMedical', '今天按时吃了氯雷他定，一整天没有过敏反应', ['用药', '有效'], 21));
    // 小花妈妈
    huaRecs.push(r(huaId, huaMom.id, 'parent', 'workSupport', '带她去公园散步，看到花很开心，还哼起了歌，在草地上跳舞', ['户外', '开心'], 29));
    huaRecs.push(r(huaId, huaMom.id, 'parent', 'communicationGuide', '用画画的方式表达了想穿裙子的想法，越来越会用画沟通了', ['沟通', '画画'], 27));
    huaRecs.push(r(huaId, huaMom.id, 'parent', 'emotionBehavior', '在家里听到外面施工噪音，有点烦躁，给了耳机后安静了', ['噪音', '应对'], 25));
    huaRecs.push(r(huaId, huaMom.id, 'parent', 'careMedical', '今天做了她喜欢的蔬菜粥，全部吃完了，胃口不错', ['饮食', '良好'], 24));
    huaRecs.push(r(huaId, huaMom.id, 'parent', 'workSupport', '去图书馆借了新的画册，她选了一本动物画册，很喜欢', ['阅读', '兴趣'], 22));
    huaRecs.push(r(huaId, huaMom.id, 'parent', 'communicationGuide', '今天用画表达了想去音乐教室的想法，画了钢琴和音符', ['沟通', '画画'], 20));
    huaRecs.push(r(huaId, huaMom.id, 'parent', 'emotionBehavior', '今天主动帮妈妈整理衣服，做得很认真，还哼着歌', ['积极', '主动'], 18));
    huaRecs.push(r(huaId, huaMom.id, 'parent', 'careMedical', '晚上有点咳嗽，给喝了温水，睡前吃了半片氯雷他定', ['健康', '用药'], 17));
    // 小花影子老师
    huaRecs.push(r(huaId, huaNanny.id, 'caregiver', 'emotionBehavior', '下午做手工时外面施工噪音很大，有点烦躁，给了耳机后安静了', ['噪音', '应对'], 28));
    huaRecs.push(r(huaId, huaNanny.id, 'caregiver', 'workSupport', '唱歌课学了新歌，学得很快，还主动给其他小朋友示范', ['唱歌', '自信'], 26));
    huaRecs.push(r(huaId, huaNanny.id, 'caregiver', 'careMedical', '午餐避开了所有奶制品，给她准备了豆浆和素菜', ['饮食', '过敏'], 26));
    huaRecs.push(r(huaId, huaNanny.id, 'caregiver', 'workSupport', '主动帮老师整理画具，把画笔按颜色分类放好，做得非常好', ['主动', '整理'], 24));
    huaRecs.push(r(huaId, huaNanny.id, 'caregiver', 'emotionBehavior', '今天整体情绪平稳，画画时非常专注，画了40分钟', ['平稳', '专注'], 23));
    huaRecs.push(r(huaId, huaNanny.id, 'caregiver', 'careMedical', '午睡睡了一个半小时，质量不错，醒来精神很好', ['睡眠', '良好'], 22));
    huaRecs.push(r(huaId, huaNanny.id, 'caregiver', 'workSupport', '今天练习了折纸，折了一只千纸鹤，手指灵活度有进步', ['手工', '进步'], 19));
    huaRecs.push(r(huaId, huaNanny.id, 'caregiver', 'emotionBehavior', '被小朋友不小心碰倒了水杯，有点不开心，但很快就好了', ['情绪', '恢复'], 16));
    huaRecs.push(r(huaId, huaNanny.id, 'caregiver', 'careMedical', '今天户外活动时花粉指数偏高，提前戴了口罩，没有过敏', ['过敏', '预防'], 14));
    huaRecs.push(r(huaId, huaNanny.id, 'caregiver', 'workSupport', '唱歌课表演了新学的歌，虽然有点紧张但完整唱完了', ['唱歌', '勇气'], 12));
    // 王老师
    huaRecs.push(r(huaId, teacherWang.id, 'teacher', 'workSupport', '艺术表达训练：用三种颜色画了情绪图，能准确表达开心和难过', ['艺术', '情绪表达'], 28));
    huaRecs.push(r(huaId, teacherWang.id, 'teacher', 'emotionBehavior', '小组讨论时主动举手发言了两次，虽然声音不大但是进步', ['社交', '进步'], 26));
    huaRecs.push(r(huaId, teacherWang.id, 'teacher', 'communicationGuide', '用画和小明交流了想一起玩拼图的想法，非语言沟通能力越来越强', ['沟通', '画画'], 24));
    huaRecs.push(r(huaId, teacherWang.id, 'teacher', 'workSupport', '社交互动训练：今天在小组中主动分享了自己的画作', ['社交', '进步'], 22));
    huaRecs.push(r(huaId, teacherWang.id, 'teacher', 'emotionBehavior', '今天画画时被同学不小心碰到了画纸，没有发脾气，自己重新画了', ['情绪', '里程碑'], 20));
    huaRecs.push(r(huaId, teacherWang.id, 'teacher', 'communicationGuide', '能用简短句子回答问题了，虽然声音小但意思清楚', ['语言', '进步'], 19));
    huaRecs.push(r(huaId, teacherWang.id, 'teacher', 'workSupport', '艺术训练：今天学会了调色，能调出三种不同的绿色', ['艺术', '技能'], 17));
    huaRecs.push(r(huaId, teacherWang.id, 'teacher', 'emotionBehavior', '今天情绪很好，主动帮老师分发了画纸给同学们', ['积极', '主动'], 15));
    huaRecs.push(r(huaId, teacherWang.id, 'teacher', 'communicationGuide', '在小组中用画表达了一天的安排，逻辑清晰，进步明显', ['沟通', '进步'], 14));
    huaRecs.push(r(huaId, teacherWang.id, 'teacher', 'workSupport', '今天尝试了图书整理任务，能按大小排列书本，完成度70%', ['工作训练', '新任务'], 12));
    huaRecs.push(r(huaId, teacherWang.id, 'teacher', 'emotionBehavior', '音乐课换了新老师，有点不适应，但跟着唱了半节课', ['情绪', '适应'], 10));
    huaRecs.push(r(huaId, teacherWang.id, 'teacher', 'workSupport', '艺术表达持续进步，这周画了三幅完整作品', ['艺术', '进步'], 8));
    huaRecs.push(r(huaId, teacherWang.id, 'teacher', 'communicationGuide', '今天主动对老师说"老师好"，声音比以前大了', ['语言', '进步'], 5));
    // 近3天记录（确保日报有内容）
    huaRecs.push(r(huaId, huaDad.id, 'parent', 'emotionBehavior', '前天画了一幅星空画，用了新学的调色技巧，色彩很美', ['画画', '进步'], 2));
    huaRecs.push(r(huaId, huaDad.id, 'parent', 'careMedical', '前天花粉指数低，带她去公园散步一小时，没有过敏', ['户外', '良好'], 2));
    huaRecs.push(r(huaId, huaNanny.id, 'caregiver', 'workSupport', '昨天唱歌课学了新歌，还主动给其他小朋友示范了动作', ['唱歌', '自信'], 1));
    huaRecs.push(r(huaId, huaNanny.id, 'caregiver', 'careMedical', '昨天午睡睡得很好，醒来后自己叠了被子，生活习惯有进步', ['睡眠', '自理'], 1));
    huaRecs.push(r(huaId, teacherWang.id, 'teacher', 'emotionBehavior', '昨天小组活动中主动分享了自己的画，还夸奖了同学的画', ['社交', '积极'], 1));
    huaRecs.push(r(huaId, huaMom.id, 'parent', 'workSupport', '今天去图书馆借了新的手工书，她选了折纸教程，很感兴趣', ['阅读', '兴趣'], 0));
    huaRecs.push(r(huaId, huaMom.id, 'parent', 'communicationGuide', '今天用画描述了昨天唱歌课的内容，画面很丰富，表达越来越好了', ['沟通', '画画'], 0));
    huaRecs.push(r(huaId, huaNanny.id, 'caregiver', 'careMedical', '今天早餐确认无奶制品，午餐吃了番茄意面，全部吃完', ['饮食', '过敏'], 0));
    huaRecs.push(r(huaId, huaNanny.id, 'caregiver', 'emotionBehavior', '今天情绪很好，主动帮忙整理了书架，还哼着歌', ['积极', '主动'], 0));
    huaRecs.push(r(huaId, teacherWang.id, 'teacher', 'workSupport', '今天图书整理训练完成度85%，能独立按大小和颜色分类书本', ['工作训练', '进步'], 0));

    records[huaId] = huaRecs;

    set(KEYS.RECORDS, records);
    console.log('测试数据初始化完成：小明 ' + mingRecs.length + ' 条、小花 ' + huaRecs.length + ' 条记录（30天模拟数据）');

    // 初始化交接任务种子数据
    _initHandoverSeedIfNeeded(profiles, accounts);
    migrateHandoverTasks();
  }



  // ==================== HandoverTask ====================

  function getHandoverTasks(youthId) {
    var tasks = get(KEYS.HANDOVER_TASKS) || {};
    return tasks[youthId] || [];
  }

  function addHandoverTask(youthId, task) {
    var tasks = get(KEYS.HANDOVER_TASKS) || {};
    if (!tasks[youthId]) {
      tasks[youthId] = [];
    }
    if (!task.id) {
      task.id = Utils.generateUUID();
    }
    if (!task.createdAt) {
      task.createdAt = Utils.formatDateTime();
    }
    if (!task.updatedAt) {
      task.updatedAt = Utils.formatDateTime();
    }
    if (!task.status) {
      task.status = 'pending';
    }
    if (!task.targetType) {
      task.targetType = 'caregiver';
    }
    tasks[youthId].push(task);
    set(KEYS.HANDOVER_TASKS, tasks);
    return { success: true };
  }

  function updateHandoverTask(youthId, taskId, updates) {
    var tasks = get(KEYS.HANDOVER_TASKS) || {};
    var list = tasks[youthId] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === taskId) {
        Object.assign(list[i], updates);
        list[i].updatedAt = Utils.formatDateTime();
        set(KEYS.HANDOVER_TASKS, tasks);
        return true;
      }
    }
    return false;
  }

  function deleteHandoverTask(youthId, taskId) {
    var tasks = get(KEYS.HANDOVER_TASKS) || {};
    var list = tasks[youthId] || [];
    tasks[youthId] = list.filter(function (t) { return t.id !== taskId; });
    set(KEYS.HANDOVER_TASKS, tasks);
    return true;
  }

  // ==================== Unified Task (新) ====================

  function getTasks(youthId) {
    var tasks = get(KEYS.TASKS) || {};
    return tasks[youthId] || [];
  }

  function addTask(youthId, task) {
    var tasks = get(KEYS.TASKS) || {};
    if (!tasks[youthId]) tasks[youthId] = [];
    if (!task.id) task.id = Utils.generateUUID();
    if (!task.status) task.status = 'todo';
    if (!task.createdAt) task.createdAt = Utils.formatDateTime();
    if (!task.updatedAt) task.updatedAt = Utils.formatDateTime();
    tasks[youthId].push(task);
    set(KEYS.TASKS, tasks);
    return { success: true, task: task };
  }

  function updateTask(youthId, taskId, updates) {
    var tasks = get(KEYS.TASKS) || {};
    var list = tasks[youthId] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === taskId) {
        Object.assign(list[i], updates);
        list[i].updatedAt = Utils.formatDateTime();
        if (updates.status === 'done' && !list[i].completedAt) {
          list[i].completedAt = Utils.formatDateTime();
        }
        set(KEYS.TASKS, tasks);
        return true;
      }
    }
    return false;
  }

  function deleteTask(youthId, taskId) {
    var tasks = get(KEYS.TASKS) || {};
    var list = tasks[youthId] || [];
    tasks[youthId] = list.filter(function (t) { return t.id !== taskId; });
    set(KEYS.TASKS, tasks);
    return true;
  }

  function migrateHandoverTasks() {
    var oldData = get(KEYS.HANDOVER_TASKS) || {};
    var newData = get(KEYS.TASKS) || {};
    var migrated = 0;

    for (var youthId in oldData) {
      if (!oldData.hasOwnProperty(youthId)) continue;
      var oldTasks = oldData[youthId];
      if (!newData[youthId]) newData[youthId] = [];

      var existingIds = {};
      for (var ei = 0; ei < newData[youthId].length; ei++) {
        if (newData[youthId][ei]._oldId) {
          existingIds[newData[youthId][ei]._oldId] = true;
        }
      }

      for (var i = 0; i < oldTasks.length; i++) {
        var ot = oldTasks[i];
        if (existingIds[ot.id]) continue;

        var newTask = {
          id: Utils.generateUUID(),
          _oldId: ot.id,
          youthId: youthId,
          taskType: 'handover',
          assigneeId: ot.toUserId,
          assigneeRole: ot.toRole,
          content: ot.content,
          category: 'handover',
          status: ot.status === 'done' ? 'done' : 'todo',
          dueTime: null,
          handoverFrom: { userId: ot.fromUserId, role: ot.fromRole },
          handoverTo: { userId: ot.toUserId, role: ot.toRole },
          targetType: ot.targetType || 'caregiver',
          createdAt: ot.createdAt,
          updatedAt: ot.updatedAt,
          completedAt: ot.status === 'done' ? ot.updatedAt : null
        };
        newData[youthId].push(newTask);
        migrated++;
      }
    }

    set(KEYS.TASKS, newData);
    console.log('交接任务迁移完成：' + migrated + ' 条');
    return migrated;
  }

  // ==================== 规律任务引擎 ====================

  /**
   * 判断 routine 模板在指定日期是否应该生成实例
   * @param {object} template - 任务模板
   * @param {string} date - YYYY-MM-DD
   * @param {number} dayOfWeek - 0=周日, 1=周一...6=周六
   */
  function _shouldGenerateOnDate(template, date, dayOfWeek) {
    var recurrence = template.recurrence;
    if (!recurrence || !recurrence.pattern) return false;

    if (recurrence.pattern === 'daily') return true;
    if (recurrence.pattern === 'weekly') {
      // weekly: 默认周一生成；若指定 daysOfWeek 则按其判断
      if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
        return recurrence.daysOfWeek.indexOf(dayOfWeek) > -1;
      }
      return dayOfWeek === 1;
    }
    if (recurrence.pattern === 'custom') {
      if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
        return recurrence.daysOfWeek.indexOf(dayOfWeek) > -1;
      }
      return false;
    }
    return false;
  }

  /**
   * 为指定心青年在指定日期生成规律任务实例
   * @param {string} youthId
   * @param {string} date - YYYY-MM-DD，默认今天
   * @returns {number} 生成的实例数
   */
  function generateDailyTaskInstances(youthId, date) {
    date = date || Utils.formatDate(new Date());
    var tasks = getTasks(youthId);
    var templates = tasks.filter(function (t) {
      return t.taskType === 'routine' && !t.parentTaskId && !t.isInstance;
    });

    if (templates.length === 0) return 0;

    var dayOfWeek = new Date(date + 'T00:00:00').getDay();
    var generated = 0;

    for (var i = 0; i < templates.length; i++) {
      var tpl = templates[i];
      if (!_shouldGenerateOnDate(tpl, date, dayOfWeek)) continue;

      // 检查是否已生成过当天实例
      var exists = false;
      for (var j = 0; j < tasks.length; j++) {
        if (tasks[j].parentTaskId === tpl.id && tasks[j].instanceDate === date) {
          exists = true;
          break;
        }
      }
      if (exists) continue;

      var instance = {
        id: Utils.generateUUID(),
        parentTaskId: tpl.id,
        youthId: youthId,
        taskType: 'routine',
        assigneeId: tpl.assigneeId,
        assigneeRole: tpl.assigneeRole || 'youth',
        content: tpl.content,
        category: tpl.category || 'other',
        status: 'todo',
        dueTime: (tpl.recurrence && tpl.recurrence.timeOfDay) || tpl.dueTime || null,
        instanceDate: date,
        isInstance: true,
        createdAt: Utils.formatDateTime(),
        updatedAt: Utils.formatDateTime(),
        completedAt: null
      };
      tasks.push(instance);
      generated++;
    }

    if (generated > 0) {
      var allTasks = get(KEYS.TASKS) || {};
      allTasks[youthId] = tasks;
      set(KEYS.TASKS, allTasks);
    }
    return generated;
  }

  /**
   * 获取指定心青年某天的任务列表
   * 包含：当天生成的 routine 实例 + 当天到期的 adhoc
   * @param {string} youthId
   * @param {string} date - YYYY-MM-DD，默认今天
   */
  function getTodayTasks(youthId, date) {
    date = date || Utils.formatDate(new Date());
    // 懒生成：确保当天实例已生成
    generateDailyTaskInstances(youthId, date);

    var tasks = getTasks(youthId);
    return tasks.filter(function (t) {
      // routine 实例：匹配 instanceDate
      if (t.isInstance && t.instanceDate === date) return true;
      // adhoc 任务：到期日为当天（无论是否完成）
      if (t.taskType === 'adhoc' && !t.parentTaskId) {
        var dueDate = (t.dueTime || '').substring(0, 10);
        return dueDate === date;
      }
      return false;
    });
  }

  /**
   * 获取指定心青年的规律任务模板（不含实例）
   */
  function getRoutineTemplates(youthId) {
    var tasks = getTasks(youthId);
    return tasks.filter(function (t) {
      return t.taskType === 'routine' && !t.parentTaskId && !t.isInstance;
    });
  }

  // ==================== VisibilityConfig ====================

  function getVisibilityConfig() {
    var config = get(KEYS.VISIBILITY_CONFIG);
    if (!config) {
      return Constants.DEFAULT_VISIBILITY_CONFIG;
    }
    // 深度合并默认配置（防止新增页面/模块后旧配置缺失）
    var merged = {
      pages: {},
      modules: {}
    };
    var allRoles = Object.keys(Constants.DEFAULT_VISIBILITY_CONFIG.pages);
    for (var i = 0; i < allRoles.length; i++) {
      var role = allRoles[i];
      // pages: 以默认为基础，追加用户自定义里独有的页面（不删默认）
      var defaultPages = Constants.DEFAULT_VISIBILITY_CONFIG.pages[role] || [];
      var customPages = (config.pages && config.pages[role]) || [];
      var pageSet = {};
      for (var p = 0; p < defaultPages.length; p++) pageSet[defaultPages[p]] = true;
      for (var q = 0; q < customPages.length; q++) pageSet[customPages[q]] = true;
      merged.pages[role] = Object.keys(pageSet);

      // modules: 同上合并
      var defaultModules = Constants.DEFAULT_VISIBILITY_CONFIG.modules[role] || [];
      var customModules = (config.modules && config.modules[role]) || [];
      var moduleSet = {};
      for (var m = 0; m < defaultModules.length; m++) moduleSet[defaultModules[m]] = true;
      for (var n = 0; n < customModules.length; n++) moduleSet[customModules[n]] = true;
      merged.modules[role] = Object.keys(moduleSet);
    }
    return merged;
  }

  function saveVisibilityConfig(config) {
    set(KEYS.VISIBILITY_CONFIG, config);
    return { success: true };
  }

  return {
    KEYS: KEYS,
    get: get,
    set: set,
    remove: remove,
    // YouthProfile
    getProfiles: getProfiles,
    getProfile: getProfile,
    saveProfile: saveProfile,
    deleteProfile: deleteProfile,
    // UserAccount
    getAccounts: getAccounts,
    getAccount: getAccount,
    saveAccount: saveAccount,
    // RecordEntry
    getRecords: getRecords,
    getAllRecords: getAllRecords,
    addRecord: addRecord,
    updateRecord: updateRecord,
    deleteRecord: deleteRecord,
    // ArchiveCode
    getArchiveCode: getArchiveCode,
    getAllArchiveCodes: getAllArchiveCodes,
    saveArchiveCode: saveArchiveCode,
    // AccessGrant
    getAccessGrants: getAccessGrants,
    addAccessGrant: addAccessGrant,
    revokeAccessGrant: revokeAccessGrant,
    updateAccessGrant: updateAccessGrant,
    // Invitation
    getInvitations: getInvitations,
    getInvitationByCode: getInvitationByCode,
    addInvitation: addInvitation,
    updateInvitation: updateInvitation,
    cleanExpiredInvitations: cleanExpiredInvitations,
    // JoinRequest
    getJoinRequests: getJoinRequests,
    getJoinRequestsByApplicant: getJoinRequestsByApplicant,
    getPendingJoinRequests: getPendingJoinRequests,
    saveJoinRequest: saveJoinRequest,
    updateJoinRequest: updateJoinRequest,
    // GuardianshipTransfer
    getGuardianshipTransfers: getGuardianshipTransfers,
    addGuardianshipTransfer: addGuardianshipTransfer,
    updateGuardianshipTransfer: updateGuardianshipTransfer,
    // AnonymizedResearchData
    getAnonymizedData: getAnonymizedData,
    addAnonymizedData: addAnonymizedData,
    // CurrentUser
    getCurrentUser: getCurrentUser,
    setCurrentUser: setCurrentUser,
    clearCurrentUser: clearCurrentUser,
    // HandoverTask (旧)
    getHandoverTasks: getHandoverTasks,
    addHandoverTask: addHandoverTask,
    updateHandoverTask: updateHandoverTask,
    deleteHandoverTask: deleteHandoverTask,
    // Unified Task (新)
    getTasks: getTasks,
    addTask: addTask,
    updateTask: updateTask,
    deleteTask: deleteTask,
    migrateHandoverTasks: migrateHandoverTasks,
    // 规律任务引擎
    generateDailyTaskInstances: generateDailyTaskInstances,
    getTodayTasks: getTodayTasks,
    getRoutineTemplates: getRoutineTemplates,
    // VisibilityConfig
    getVisibilityConfig: getVisibilityConfig,
    saveVisibilityConfig: saveVisibilityConfig,
    // TestData
    initTestData: initTestData
  };
})();
