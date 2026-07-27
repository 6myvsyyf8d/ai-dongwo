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
    CURRENT_USER: 'ai_dongwo_current_user'
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
      if (a.name === '小明保姆') mingNanny = a;
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
      { id: Utils.generateUUID(), youthId: mingId, fromUserId: mingDad.id, fromRole: 'parent', toUserId: mingNanny.id, toRole: 'caregiver', content: '小明今天游泳课后需要用毛巾擦干头发，避免感冒', status: 'pending', createdAt: h0, updatedAt: h0 },
      { id: Utils.generateUUID(), youthId: mingId, fromUserId: mingNanny.id, fromRole: 'caregiver', toUserId: mingDad.id, toRole: 'parent', content: '小明下午零食吃完了，需要补充无糖饼干和苹果', status: 'pending', createdAt: h0, updatedAt: h0 },
      { id: Utils.generateUUID(), youthId: mingId, fromUserId: teacherWang.id, fromRole: 'teacher', toUserId: mingNanny.id, toRole: 'caregiver', content: '明天超市实习需要穿运动鞋，不要穿凉鞋', status: 'pending', createdAt: h1, updatedAt: h1 },
      { id: Utils.generateUUID(), youthId: mingId, fromUserId: mingDad.id, fromRole: 'parent', toUserId: teacherWang.id, toRole: 'teacher', content: '小明的情绪记录本在书包里，请老师帮忙检查今天的情绪变化', status: 'done', createdAt: h2, updatedAt: h0 },
      { id: Utils.generateUUID(), youthId: mingId, fromUserId: mingMom.id, fromRole: 'parent', toUserId: mingNanny.id, toRole: 'caregiver', content: '周末活动请带小明去公园散步，他喜欢看湖里的鸭子', status: 'pending', createdAt: h1, updatedAt: h1 }
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
      id: Utils.generateUUID(), name: '小明保姆', phone: '13800138003', role: 'caregiver',
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
      id: Utils.generateUUID(), name: '小花保姆', phone: '13800138006', role: 'caregiver',
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
    var volunteerLi = {
      id: Utils.generateUUID(), name: '志愿者小李', phone: '13800138008', role: 'volunteer',
      pinHash: '', institutionName: '社区服务中心', registeredAt: now, lastLoginAt: null, isActive: true
    };
    var govObserver = {
      id: Utils.generateUUID(), name: '政府观察员', phone: '13800138009', role: 'government',
      pinHash: '', institutionName: '残联', registeredAt: now, lastLoginAt: null, isActive: true
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
    accounts[volunteerLi.id] = volunteerLi;
    accounts[govObserver.id] = govObserver;
    set(KEYS.ACCOUNTS, accounts);

    // 异步设置 PIN 哈希（统一 PIN: 1234）
    Utils.hashPin('1234').then(function (hash) {
      var stored = getAccounts();
      var ids = [mingDad.id, mingMom.id, mingNanny.id, huaDad.id, huaMom.id, huaNanny.id, teacherWang.id, mingYouth.id, volunteerLi.id, govObserver.id];
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
          specialHabits: ['喜欢重复确认时间和安排', '紧张时会搓手'],
          sensoryPreferences: { avoid: ['突然的触碰', '大声喧哗'], prefer: ['规律的环境', '柔和的背景音乐'] }
        },
        emotionBehavior: {
          behaviorRedLines: [
            { description: '被催促时会坐下不动拒绝配合', trigger: '时间压力', response: '给予额外时间，分解任务为小步骤', severity: 'medium' },
            { description: '物品位置改变会不安踱步', trigger: '环境变化', response: '提前说明并一起调整物品位置', severity: 'low' },
            { description: '游泳时突然被水溅到脸会恐慌', trigger: '水溅面部', response: '立即带离水面，用毛巾擦脸，轻声安抚', severity: 'high' }
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
        },
        relationshipMap: {
          relationships: [
            { name: '小明爸爸', relationType: 'parent', importance: 'primary', notes: '主要照顾者' },
            { name: '小明妈妈', relationType: 'parent', importance: 'primary', notes: '负责日常起居' },
            { name: '小明保姆', relationType: 'caregiver', importance: 'secondary', notes: '工作日白天照护' },
            { name: '王老师', relationType: 'teacher', importance: 'secondary', notes: '阳光家园特教老师' }
          ],
          peerInteractions: [
            { name: '小花', relationType: 'peer', notes: '在同一机构，经常一起活动' }
          ]
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
          specialHabits: ['开心时会哼歌', '紧张时会反复整理头发'],
          sensoryPreferences: { avoid: ['强光闪烁', '嘈杂环境'], prefer: ['柔和的音乐', '温暖的色调'] }
        },
        emotionBehavior: {
          behaviorRedLines: [
            { description: '嘈杂环境中会捂耳朵并尖叫', trigger: '噪音刺激', response: '带至安静环境，轻声安抚，给耳机', severity: 'high' },
            { description: '不喜欢被陌生人触碰头部', trigger: '身体接触', response: '从侧面接近，先打招呼再行动', severity: 'medium' },
            { description: '画画被打断会情绪低落很久', trigger: '任务中断', response: '提前告知剩余时间，给缓冲期', severity: 'medium' }
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
        },
        relationshipMap: {
          relationships: [
            { name: '小花爸爸', relationType: 'parent', importance: 'primary', notes: '主要照顾者' },
            { name: '小花妈妈', relationType: 'parent', importance: 'primary', notes: '负责日常起居' },
            { name: '小花保姆', relationType: 'caregiver', importance: 'secondary', notes: '工作日白天照护' },
            { name: '王老师', relationType: 'teacher', importance: 'secondary', notes: '阳光家园特教老师' }
          ],
          peerInteractions: [
            { name: '小明', relationType: 'peer', notes: '在同一机构，经常一起活动' }
          ]
        }
      },
      createdAt: now, updatedAt: now, deceasedAt: null
    };

    var profiles = {};
    profiles[mingId] = ming;
    profiles[huaId] = hua;
    set(KEYS.PROFILES, profiles);

    // ==================== 创建授权 ====================
    var fullScope = ['read:full', 'write:communicationGuide', 'write:emotionBehavior', 'write:careMedical', 'write:workSupport', 'write:relationshipMap', 'manage:grants'];
    var readScope = ['read:full', 'write:communicationGuide', 'write:emotionBehavior', 'write:careMedical'];

    var grants = [
      { id: Utils.generateUUID(), youthId: mingId, grantorId: mingId, granteeId: mingDad.id, granteeRole: 'parent', scope: fullScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: mingId, grantorId: mingId, granteeId: mingMom.id, granteeRole: 'parent', scope: fullScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: mingId, grantorId: mingId, granteeId: mingNanny.id, granteeRole: 'caregiver', scope: readScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: mingId, grantorId: mingId, granteeId: teacherWang.id, granteeRole: 'teacher', scope: readScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: mingId, grantorId: mingId, granteeId: mingYouth.id, granteeRole: 'youth', scope: fullScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: mingId, grantorId: mingId, granteeId: volunteerLi.id, granteeRole: 'volunteer', scope: ['read:safety', 'write:relationshipMap'], validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: huaId, grantorId: huaId, granteeId: huaDad.id, granteeRole: 'parent', scope: fullScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: huaId, grantorId: huaId, granteeId: huaMom.id, granteeRole: 'parent', scope: fullScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: huaId, grantorId: huaId, granteeId: huaNanny.id, granteeRole: 'caregiver', scope: readScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: huaId, grantorId: huaId, granteeId: teacherWang.id, granteeRole: 'teacher', scope: readScope, validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null },
      { id: Utils.generateUUID(), youthId: huaId, grantorId: huaId, granteeId: volunteerLi.id, granteeRole: 'volunteer', scope: ['read:safety', 'write:relationshipMap'], validFrom: now, validUntil: null, status: 'active', grantedAt: now, revokedAt: null, revokeReason: null }
    ];
    set(KEYS.ACCESS_GRANTS, grants);

    // ==================== 创建一周记录 ====================
    // 过去 7 天（d0=今天, d6=6天前）
    function dayAgo(n) { return Utils.formatDateTime(new Date(Date.now() - n * 86400000)); }

    var records = {};
    records[mingId] = [
      // 小明爸爸
      { id: Utils.generateUUID(), youthId: mingId, recorderId: mingDad.id, recorderRole: 'parent', module: 'emotionBehavior', recordType: 'observation', content: { text: '今天拼图完成得很开心，自己主动拿给我看，还指着图案笑', tags: ['积极', '专注'] }, visibilityLevel: 'full', recordedAt: dayAgo(6), isOffline: false, syncedAt: null },
      { id: Utils.generateUUID(), youthId: mingId, recorderId: mingDad.id, recorderRole: 'parent', module: 'careMedical', recordType: 'daily_care', content: { text: '今晚睡得不太好，翻来覆去了好几次，可能是因为白天太兴奋了', tags: ['睡眠', '注意'] }, visibilityLevel: 'full', recordedAt: dayAgo(3), isOffline: false, syncedAt: null },
      { id: Utils.generateUUID(), youthId: mingId, recorderId: mingDad.id, recorderRole: 'parent', module: 'workSupport', recordType: 'training', content: { text: '超市理货训练进展不错，今天能独立把饼干按品牌分类摆放了', tags: ['进步', '工作训练'] }, visibilityLevel: 'full', recordedAt: dayAgo(1), isOffline: false, syncedAt: null },
      // 小明妈妈
      { id: Utils.generateUUID(), youthId: mingId, recorderId: mingMom.id, recorderRole: 'parent', module: 'workSupport', recordType: 'observation', content: { text: '今天带他去超市，很开心地推着购物车，还自己选了喜欢的饼干', tags: ['出行', '开心'] }, visibilityLevel: 'full', recordedAt: dayAgo(4), isOffline: false, syncedAt: null },
      { id: Utils.generateUUID(), youthId: mingId, recorderId: mingMom.id, recorderRole: 'parent', module: 'communicationGuide', recordType: 'observation', content: { text: '今天用图片卡表达了想吃苹果，比以前用手指更清楚了，进步很大', tags: ['沟通', '进步'] }, visibilityLevel: 'full', recordedAt: dayAgo(1), isOffline: false, syncedAt: null },
      // 小明保姆
      { id: Utils.generateUUID(), youthId: mingId, recorderId: mingNanny.id, recorderRole: 'caregiver', module: 'careMedical', recordType: 'daily_care', content: { text: '中午吃饭时检查了菜单，确认没有海鲜和芒果，午餐吃了番茄炒蛋和米饭', tags: ['饮食', '过敏'] }, visibilityLevel: 'safety_only', recordedAt: dayAgo(5), isOffline: false, syncedAt: null },
      { id: Utils.generateUUID(), youthId: mingId, recorderId: mingNanny.id, recorderRole: 'caregiver', module: 'emotionBehavior', recordType: 'observation', content: { text: '下午搭积木时被电话打断，有点烦躁，但给了5分钟缓冲后自己平静下来了', tags: ['情绪', '自我调节'] }, visibilityLevel: 'full', recordedAt: dayAgo(2), isOffline: false, syncedAt: null },
      { id: Utils.generateUUID(), youthId: mingId, recorderId: mingNanny.id, recorderRole: 'caregiver', module: 'workSupport', recordType: 'observation', content: { text: '今天游泳课表现很好，能自己漂浮5秒了，教练表扬了他', tags: ['游泳', '进步'] }, visibilityLevel: 'full', recordedAt: dayAgo(0), isOffline: false, syncedAt: null },
      // 王老师
      { id: Utils.generateUUID(), youthId: mingId, recorderId: teacherWang.id, recorderRole: 'teacher', module: 'workSupport', recordType: 'training', content: { text: '超市理货训练：今天练习了将饮料按颜色分类，完成度80%，需要继续强化', tags: ['工作训练', 'ISP'] }, visibilityLevel: 'full', recordedAt: dayAgo(5), isOffline: false, syncedAt: null },
      { id: Utils.generateUUID(), youthId: mingId, recorderId: teacherWang.id, recorderRole: 'teacher', module: 'emotionBehavior', recordType: 'observation', content: { text: '小组活动中主动和小花一起完成拼图任务，合作意识有明显提升', tags: ['社交', '进步'] }, visibilityLevel: 'full', recordedAt: dayAgo(2), isOffline: false, syncedAt: null },
      { id: Utils.generateUUID(), youthId: mingId, recorderId: teacherWang.id, recorderRole: 'teacher', module: 'communicationGuide', recordType: 'observation', content: { text: '今天用两个选项的方式让他选活动，他选了游泳而不是拼图，选择能力在提升', tags: ['沟通', '选择'] }, visibilityLevel: 'full', recordedAt: dayAgo(0), isOffline: false, syncedAt: null }
    ];

    records[huaId] = [
      // 小花爸爸
      { id: Utils.generateUUID(), youthId: huaId, recorderId: huaDad.id, recorderRole: 'parent', module: 'emotionBehavior', recordType: 'observation', content: { text: '今天画了一幅花园的画，色彩搭配很漂亮，画完后主动拿给我看', tags: ['画画', '积极'] }, visibilityLevel: 'full', recordedAt: dayAgo(6), isOffline: false, syncedAt: null },
      { id: Utils.generateUUID(), youthId: huaId, recorderId: huaDad.id, recorderRole: 'parent', module: 'careMedical', recordType: 'daily_care', content: { text: '今天花粉过敏有点重，打了几个喷嚏，按时吃了氯雷他定后好转', tags: ['过敏', '用药'] }, visibilityLevel: 'full', recordedAt: dayAgo(2), isOffline: false, syncedAt: null },
      // 小花妈妈
      { id: Utils.generateUUID(), youthId: huaId, recorderId: huaMom.id, recorderRole: 'parent', module: 'workSupport', recordType: 'observation', content: { text: '带她去公园散步，看到花很开心，还哼起了歌，在草地上跳了舞', tags: ['户外', '开心'] }, visibilityLevel: 'full', recordedAt: dayAgo(5), isOffline: false, syncedAt: null },
      { id: Utils.generateUUID(), youthId: huaId, recorderId: huaMom.id, recorderRole: 'parent', module: 'communicationGuide', recordType: 'observation', content: { text: '用画画的方式表达了今天想穿裙子的想法，画得很清楚，越来越会用画沟通了', tags: ['沟通', '画画'] }, visibilityLevel: 'full', recordedAt: dayAgo(3), isOffline: false, syncedAt: null },
      { id: Utils.generateUUID(), youthId: huaId, recorderId: huaMom.id, recorderRole: 'parent', module: 'careMedical', recordType: 'daily_care', content: { text: '今天早餐确认没有牛奶制品，喝了豆浆，午餐也避开了含奶食品', tags: ['饮食', '过敏'] }, visibilityLevel: 'safety_only', recordedAt: dayAgo(1), isOffline: false, syncedAt: null },
      // 小花保姆
      { id: Utils.generateUUID(), youthId: huaId, recorderId: huaNanny.id, recorderRole: 'caregiver', module: 'emotionBehavior', recordType: 'observation', content: { text: '下午做手工时外面工地施工噪音很大，她有点烦躁，给了耳机后安静下来了', tags: ['噪音', '应对'] }, visibilityLevel: 'full', recordedAt: dayAgo(4), isOffline: false, syncedAt: null },
      { id: Utils.generateUUID(), youthId: huaId, recorderId: huaNanny.id, recorderRole: 'caregiver', module: 'workSupport', recordType: 'observation', content: { text: '今天唱歌课学了新歌，她学得很快，还主动给其他小朋友示范', tags: ['唱歌', '自信'] }, visibilityLevel: 'full', recordedAt: dayAgo(1), isOffline: false, syncedAt: null },
      { id: Utils.generateUUID(), youthId: huaId, recorderId: huaNanny.id, recorderRole: 'caregiver', module: 'workSupport', recordType: 'training', content: { text: '今天主动帮老师整理画具，把画笔按颜色分类放好，做得非常好', tags: ['主动', '整理'] }, visibilityLevel: 'full', recordedAt: dayAgo(0), isOffline: false, syncedAt: null },
      // 王老师
      { id: Utils.generateUUID(), youthId: huaId, recorderId: teacherWang.id, recorderRole: 'teacher', module: 'workSupport', recordType: 'training', content: { text: '艺术表达训练：用三种颜色画了情绪图，能准确表达开心和难过的颜色', tags: ['艺术', '情绪表达'] }, visibilityLevel: 'full', recordedAt: dayAgo(4), isOffline: false, syncedAt: null },
      { id: Utils.generateUUID(), youthId: huaId, recorderId: teacherWang.id, recorderRole: 'teacher', module: 'emotionBehavior', recordType: 'observation', content: { text: '小组讨论时主动举手发言了两次，虽然声音不大但是个很大的进步', tags: ['社交', '进步'] }, visibilityLevel: 'full', recordedAt: dayAgo(2), isOffline: false, syncedAt: null },
      { id: Utils.generateUUID(), youthId: huaId, recorderId: teacherWang.id, recorderRole: 'teacher', module: 'communicationGuide', recordType: 'observation', content: { text: '今天用画和小明交流了想一起玩拼图的想法，非语言沟通能力越来越强', tags: ['沟通', '画画'] }, visibilityLevel: 'full', recordedAt: dayAgo(0), isOffline: false, syncedAt: null }
    ];

    set(KEYS.RECORDS, records);
    console.log('测试数据初始化完成：小明、小花档案已创建，共 ' + (records[mingId].length + records[huaId].length) + ' 条记录');

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
    // HandoverTask
    getHandoverTasks: getHandoverTasks,
    addHandoverTask: addHandoverTask,
    updateHandoverTask: updateHandoverTask,
    deleteHandoverTask: deleteHandoverTask,
    // TestData
    initTestData: initTestData
  };
})();
