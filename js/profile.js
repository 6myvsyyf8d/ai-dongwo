/**
 * profile.js - 心青年档案 CRUD
 * 创建/查看/编辑档案、紧急联系人管理、生命周期状态
 */
window.Profile = (function () {
  'use strict';

  // 模块定义引用 Modules.MODULES（modules.js 中唯一定义）

  // 生命周期状态标签
  var LIFECYCLE_LABELS = {
    created: '已创建',
    active: '使用中',
    institution_change: '机构变更中',
    guardian_change: '监护转移中',
    supervised: '政府监管中',
    deceased: '已去世',
    anonymized: '已脱敏'
  };

  /**
   * 渲染档案页（创建/查看/编辑）
   */
  function renderProfile(params) {
    if (params.mode === 'create') {
      _renderCreateForm();
    } else if (params.youthId) {
      _renderDetailView(params.youthId);
    } else {
      _renderList();
    }
  }

  /**
   * 渲染创建档案表单
   */
  function _renderCreateForm() {
    var container = App.getContainer();
    var user = AppState.currentUser;

    // 获取可选监护人列表（parent 角色）
    var accounts = Storage.getAccounts();
    var guardians = [];
    for (var id in accounts) {
      if (accounts[id].role === 'parent' && accounts[id].id !== user.id) {
        guardians.push(accounts[id]);
      }
    }
    // 当前用户如果是 parent 也可以作为监护人
    if (user.role === 'parent') {
      guardians.unshift(user);
    }

    var guardianOptions = '<option value="">请选择监护人</option>';
    for (var i = 0; i < guardians.length; i++) {
      guardianOptions += '<option value="' + guardians[i].id + '">' + Utils.escapeHtml(guardians[i].name) + '（家长）</option>';
    }

    container.innerHTML =
      '<div class="page-header">' +
        '<button class="btn-back" id="btn-back">‹</button>' +
        '<span class="page-title">创建心青年档案</span>' +
        '<span></span>' +
      '</div>' +
      '<div class="page-content">' +
        '<div class="profile-form">' +
          '<div class="form-section">' +
            '<div class="form-section-title">基本信息</div>' +
            '<div class="form-group">' +
              '<label class="form-label">姓名/化名</label>' +
              '<input type="text" class="form-input" id="pf-name" placeholder="输入心青年姓名" maxlength="50">' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">性别</label>' +
              '<div class="gender-selector">' +
                '<div class="gender-option" data-gender="male"><div class="gender-icon">👦</div><div class="gender-label">男</div></div>' +
                '<div class="gender-option" data-gender="female"><div class="gender-icon">👧</div><div class="gender-label">女</div></div>' +
                '<div class="gender-option" data-gender="other"><div class="gender-icon">🧑</div><div class="gender-label">其他</div></div>' +
              '</div>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">出生日期</label>' +
              '<input type="date" class="form-input" id="pf-birthdate">' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">身份证号</label>' +
              '<input type="text" class="form-input" id="pf-idnumber" placeholder="18 位身份证号" maxlength="18">' +
              '<div class="form-hint">用于档案唯一标识，数据仅存储在本地浏览器</div>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">头像标识</label>' +
              '<div class="gender-selector">' +
                '<div class="gender-option" data-avatar="🌻"><div class="gender-icon">🌻</div></div>' +
                '<div class="gender-option" data-avatar="🌟"><div class="gender-icon">🌟</div></div>' +
                '<div class="gender-option" data-avatar="🎈"><div class="gender-icon">🎈</div></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="form-section">' +
            '<div class="form-section-title">紧急联系人</div>' +
            '<div id="emergency-contacts-list"></div>' +
            '<button class="btn btn-outline btn-sm" id="btn-add-contact">+ 添加紧急联系人</button>' +
          '</div>' +
          '<div class="form-group" id="guardian-group">' +
            '<div class="form-section-title">监护人绑定</div>' +
            '<div class="form-hint" style="margin-bottom:8px;">未成年心青年（&lt;18岁）需绑定监护人</div>' +
            '<label class="form-label">监护人</label>' +
            '<select class="form-input" id="pf-guardian">' + guardianOptions + '</select>' +
          '</div>' +
          '<div class="form-error" id="form-error" style="display:none;"></div>' +
          '<button class="btn btn-primary btn-block btn-lg" id="btn-save-profile" style="margin-top:16px;">创建档案</button>' +
        '</div>' +
      '</div>';

    _bindCreateFormEvents();
  }

  /**
   * 绑定创建表单事件
   */
  function _bindCreateFormEvents() {
    document.getElementById('btn-back').addEventListener('click', function () {
      window.location.hash = 'dashboard';
    });

    // 性别选择
    var genderOptions = document.querySelectorAll('.gender-option[data-gender]');
    for (var i = 0; i < genderOptions.length; i++) {
      genderOptions[i].addEventListener('click', function () {
        var siblings = this.parentElement.querySelectorAll('.gender-option');
        for (var j = 0; j < siblings.length; j++) {
          siblings[j].classList.remove('selected');
        }
        this.classList.add('selected');
      });
    }

    // 头像选择
    var avatarOptions = document.querySelectorAll('.gender-option[data-avatar]');
    for (var i = 0; i < avatarOptions.length; i++) {
      avatarOptions[i].addEventListener('click', function () {
        var siblings = this.parentElement.querySelectorAll('.gender-option');
        for (var j = 0; j < siblings.length; j++) {
          siblings[j].classList.remove('selected');
        }
        this.classList.add('selected');
      });
    }

    // 紧急联系人
    var contacts = [];
    document.getElementById('btn-add-contact').addEventListener('click', function () {
      contacts.push({ name: '', relation: '', phone: '' });
      _renderContacts(contacts);
    });

    // 身份证号自动提取出生日期和性别
    document.getElementById('pf-idnumber').addEventListener('blur', function () {
      var idNumber = this.value.trim();
      if (idNumber.length === 18) {
        var validation = Utils.validateIdNumber(idNumber);
        if (validation.valid) {
          var birthDate = Utils.extractBirthDate(idNumber);
          var gender = Utils.extractGender(idNumber);
          document.getElementById('pf-birthdate').value = birthDate;
          // 自动选择性别
          var genderOpts = document.querySelectorAll('.gender-option[data-gender]');
          for (var i = 0; i < genderOpts.length; i++) {
            genderOpts[i].classList.remove('selected');
            if (genderOpts[i].getAttribute('data-gender') === gender) {
              genderOpts[i].classList.add('selected');
            }
          }
        }
      }
    });

    // 保存
    document.getElementById('btn-save-profile').addEventListener('click', function () {
      _handleSaveProfile(contacts);
    });
  }

  /**
   * 渲染紧急联系人列表
   */
  function _renderContacts(contacts) {
    var listEl = document.getElementById('emergency-contacts-list');
    var html = '';
    for (var i = 0; i < contacts.length; i++) {
      html += '<div class="emergency-contact-item" data-index="' + i + '" style="margin-bottom:8px;">' +
        '<input type="text" class="form-input" placeholder="姓名" data-field="name" value="' + Utils.escapeHtml(contacts[i].name) + '" style="flex:1;min-width:0;margin-right:4px;">' +
        '<input type="text" class="form-input" placeholder="关系" data-field="relation" value="' + Utils.escapeHtml(contacts[i].relation) + '" style="flex:1;min-width:0;margin-right:4px;">' +
        '<input type="tel" class="form-input" placeholder="电话" data-field="phone" value="' + Utils.escapeHtml(contacts[i].phone) + '" style="flex:1;min-width:0;margin-right:4px;">' +
        '<button class="btn btn-sm btn-danger" data-action="remove">删除</button>' +
      '</div>';
    }
    listEl.innerHTML = html;

    // 绑定事件
    var items = listEl.querySelectorAll('.emergency-contact-item');
    for (var i = 0; i < items.length; i++) {
      (function (idx) {
        var item = items[idx];
        var inputs = item.querySelectorAll('input');
        for (var j = 0; j < inputs.length; j++) {
          inputs[j].addEventListener('input', function () {
            var field = this.getAttribute('data-field');
            contacts[idx][field] = this.value;
          });
        }
        item.querySelector('[data-action="remove"]').addEventListener('click', function () {
          contacts.splice(idx, 1);
          _renderContacts(contacts);
        });
      })(i);
    }
  }

  /**
   * 处理保存档案
   */
  function _handleSaveProfile(contacts) {
    var name = document.getElementById('pf-name').value.trim();
    var birthDate = document.getElementById('pf-birthdate').value;
    var idNumber = document.getElementById('pf-idnumber').value.trim().toUpperCase();
    var errorEl = document.getElementById('form-error');

    // 验证
    if (!name) {
      errorEl.textContent = '请输入姓名';
      errorEl.style.display = 'block';
      return;
    }

    if (!birthDate) {
      errorEl.textContent = '请选择出生日期';
      errorEl.style.display = 'block';
      return;
    }

    if (!idNumber) {
      errorEl.textContent = '请输入身份证号';
      errorEl.style.display = 'block';
      return;
    }

    var idValidation = Utils.validateIdNumber(idNumber);
    if (!idValidation.valid) {
      errorEl.textContent = idValidation.error;
      errorEl.style.display = 'block';
      return;
    }

    // 获取选中的性别
    var gender = 'other';
    var selectedGender = document.querySelector('.gender-option[data-gender].selected');
    if (selectedGender) {
      gender = selectedGender.getAttribute('data-gender');
    }

    // 获取选中的头像
    var avatar = '🌻';
    var selectedAvatar = document.querySelector('.gender-option[data-avatar].selected');
    if (selectedAvatar) {
      avatar = selectedAvatar.getAttribute('data-avatar');
    }

    // 未成年检查
    var age = Utils.calculateAge(birthDate);
    var guardianId = document.getElementById('pf-guardian').value;
    if (age < 18 && !guardianId) {
      errorEl.textContent = '未成年心青年必须绑定监护人';
      errorEl.style.display = 'block';
      return;
    }

    // 过滤有效紧急联系人
    var validContacts = contacts.filter(function (c) {
      return c.name && c.phone;
    });

    errorEl.style.display = 'none';

    // 创建档案对象
    var now = Utils.formatDateTime();
    var profile = {
      id: Utils.generateUUID(),
      idNumber: idNumber,
      name: name,
      gender: gender,
      birthDate: birthDate,
      avatar: avatar,
      lifeCycleStatus: 'created',
      currentGuardianId: guardianId || null,
      emergencyContacts: validContacts,
      modules: {
        communicationGuide: { preferredMethods: [], expressionDifficulties: null, specialHabits: [], sensoryPreferences: null },
        emotionBehavior: { behaviorRedLines: [], emotionTrend: [], interventionHistory: [] },
        careMedical: { allergies: [], medications: [], medicalHistory: [], careNotes: [], dailyRoutine: null },
        workSupport: { ispPlans: [], capabilityAssessment: null, workPreferences: [], favoriteActivities: [], favoritePlaces: [], futureWishes: [] },
        relationshipMap: { relationships: [], peerInteractions: [] }
      },
      createdAt: now,
      updatedAt: now,
      deceasedAt: null
    };

    var result = Storage.saveProfile(profile);
    if (!result.success) {
      if (result.error === 'ID_NUMBER_EXISTS') {
        errorEl.textContent = '该身份证号已存在档案';
      } else {
        errorEl.textContent = '保存失败：' + result.error;
      }
      errorEl.style.display = 'block';
      return;
    }

    // 如果有监护人，创建家长授权
    if (guardianId) {
      var grantorId = AppState.currentUser.id;
      Permissions.grantAccess(profile.id, guardianId, 'parent', null);
    }

    // 如果创建者不是监护人，也给创建者创建授权
    if (AppState.currentUser.role === 'parent' && AppState.currentUser.id !== guardianId) {
      Permissions.grantAccess(profile.id, AppState.currentUser.id, 'parent', null);
    }

    AppState.showToast('档案创建成功！');
    AppState.selectYouth(profile.id);
    window.location.hash = 'profile?youthId=' + encodeURIComponent(profile.id);
  }

  /**
   * 渲染档案详情
   */
  function _renderDetailView(youthId) {
    var youth = Storage.getProfile(youthId);
    if (!youth) {
      App.getContainer().innerHTML = '<div class="page-content"><div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">档案不存在</div></div></div>';
      return;
    }

    // 确保选中
    if (!AppState.currentYouth || AppState.currentYouth.id !== youthId) {
      AppState.selectYouth(youthId);
    }

    var container = App.getContainer();

    // 人物画像卡片 — 星座星图（含可点击节点 + 详情面板）
    var portraitHtml = _generatePortrait(youth);
    var panelsHtml = _renderPortraitPanels(youth);

    // 速读卡按钮：仅对有 quickcard 权限的角色显示
    var currentUser = AppState.currentUser;
    var canQuickcard = currentUser && Permissions.canAccessPage(currentUser.role, 'quickcard');
    var quickcardBtnHtml = canQuickcard
      ? '<button class="top-bar-text-link" id="btn-quickcard" title="速读卡">速读卡</button>'
      : '';

    container.innerHTML =
      '<div class="page-header">' +
        '<span></span>' +
        '<span class="page-title">档案详情</span>' +
        '<div class="top-bar-actions">' +
          (youth.emergencyContacts && youth.emergencyContacts.length > 0
            ? quickcardBtnHtml + '<span class="top-bar-text-sep">|</span><button class="top-bar-text-link" id="btn-emergency" title="紧急联系人">紧急联系人</button>'
            : quickcardBtnHtml) +
        '</div>' +
      '</div>' +
      portraitHtml +
      panelsHtml;

    // 紧急联系人下拉面板
    if (youth.emergencyContacts && youth.emergencyContacts.length > 0) {
      container.innerHTML += _renderEmergencyDropdown(youth);
    }

    _bindDetailEvents(youthId);
  }

  /**
   * 生成人物画像 — 星座星图（含可点击节点 + 详情面板）
   */
  function _generatePortrait(profile) {
    var modules = (profile && profile.modules) ? profile.modules : {};
    var name = profile ? profile.name : '';
    var age = profile ? Utils.calculateAge(profile.birthDate) : '';
    var genderLabel = profile ? (profile.gender === 'male' ? '男' : profile.gender === 'female' ? '女' : '') : '';

    // 收集数据
    var commMethods = [];
    if (modules.communicationGuide && modules.communicationGuide.preferredMethods) {
      commMethods = modules.communicationGuide.preferredMethods;
    }
    var commDifficulties = (modules.communicationGuide && modules.communicationGuide.expressionDifficulties) ? modules.communicationGuide.expressionDifficulties : '';
    var commHabits = (modules.communicationGuide && modules.communicationGuide.specialHabits) ? modules.communicationGuide.specialHabits : [];
    var commSensory = (modules.communicationGuide && modules.communicationGuide.sensoryPreferences) ? modules.communicationGuide.sensoryPreferences : null;

    var redLines = (modules.emotionBehavior && modules.emotionBehavior.behaviorRedLines) ? modules.emotionBehavior.behaviorRedLines : [];
    var triggers = [];
    var highRisks = [];
    redLines.forEach(function (b) {
      if (b.trigger) triggers.push(b);
      if (b.severity === 'high' && b.description) highRisks.push(b);
    });

    var workPrefs = (modules.workSupport && modules.workSupport.workPreferences) ? modules.workSupport.workPreferences : [];
    var ispPlans = (modules.workSupport && modules.workSupport.ispPlans) ? modules.workSupport.ispPlans : [];
    var activePlans = ispPlans.filter(function (p) { return p.status === 'active'; });

    var hasAnyData = commMethods.length > 0 || triggers.length > 0 || highRisks.length > 0 ||
                     workPrefs.length > 0 || activePlans.length > 0;

    // 辅助：生成节点标签
    function nodeTag(cat, text) {
      return '<span class="node-tag" style="background:rgba(' + cat + ',0.12);border:1px solid rgba(' + cat + ',0.2);color:#' + text + ';">' + Utils.escapeHtml(text) + '</span>';
    }

    // 背景星点
    var bgStars = '';
    var starPositions = [
      [10,6,1.5,1.5,3,0,0.5], [82,10,1,1,2.5,0.8,0.4], [20,88,2,2,4,1.5,0.35],
      [88,78,1,1,3.5,0.3,0.45], [6,48,1.5,1.5,2.8,2,0.3], [92,38,1,1,3.2,1,0.5],
      [38,94,1.5,1.5,3.7,0.5,0.4], [62,4,1,1,2.6,1.8,0.35]
    ];
    starPositions.forEach(function (s) {
      bgStars += '<div class="bg-star" style="left:' + s[0] + '%;top:' + s[1] + '%;width:' + s[2] + 'px;height:' + s[3] + 'px;--dur:' + s[4] + 's;--delay:' + s[5] + 's;--peak:' + s[6] + ';"></div>';
    });

    // 连线 SVG
    var linesSvg = '<svg class="constellation-lines" viewBox="0 0 360 370" preserveAspectRatio="xMidYMid meet">' +
      '<defs>' +
        '<filter id="line-glow"><feGaussianBlur stdDeviation="1.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '</defs>';

    // 节点坐标定义
    var nodeDefs = [
      { key: 'communication', left: 25, top: 22, has: commMethods.length > 0, lineColor: 'rgba(94,106,210,0.25)', glowColor: 'rgba(94,106,210,0.35)' },
      { key: 'emotion', left: 75, top: 22, has: triggers.length > 0, lineColor: 'rgba(170,140,220,0.25)', glowColor: 'rgba(170,140,220,0.35)' },
      { key: 'caution', left: 25, top: 48, has: highRisks.length > 0, lineColor: 'rgba(245,180,100,0.25)', glowColor: 'rgba(245,180,100,0.35)' },
      { key: 'work', left: 75, top: 48, has: workPrefs.length > 0, lineColor: 'rgba(130,200,150,0.25)', glowColor: 'rgba(130,200,150,0.35)' },
      { key: 'training', left: 50, top: 74, has: activePlans.length > 0, lineColor: 'rgba(230,140,180,0.25)', glowColor: 'rgba(230,140,180,0.35)' }
    ];

    nodeDefs.forEach(function (nd) {
      if (nd.has) {
        var x = Math.round(nd.left * 3.6);
        var y = Math.round(nd.top * 3.7);
        linesSvg += '<line x1="180" y1="170" x2="' + x + '" y2="' + y + '" stroke="' + nd.lineColor + '" stroke-width="1" stroke-dasharray="3 5" filter="url(#line-glow)"/>';
      }
    });

    // 星座外围环线
    var ringPairs = [
      [90,81,270,81], [90,81,90,178], [270,81,270,178],
      [90,178,180,274], [270,178,180,274]
    ];
    ringPairs.forEach(function (p) {
      linesSvg += '<line x1="' + p[0] + '" y1="' + p[1] + '" x2="' + p[2] + '" y2="' + p[3] + '" stroke="rgba(200,180,220,0.08)" stroke-width="0.5" stroke-dasharray="2 8"/>';
    });

    // 人体剪影（无腿）
    linesSvg += '<g opacity="0.65">' +
      '<ellipse cx="180" cy="195" rx="48" ry="65" fill="rgba(94,106,210,0.04)"/>' +
      '<circle cx="180" cy="140" r="28" fill="none" stroke="rgba(94,106,210,0.25)" stroke-width="1.2"/>' +
      '<circle cx="180" cy="140" r="28" fill="rgba(94,106,210,0.05)"/>' +
      '<rect x="155" y="172" width="50" height="68" rx="10" fill="none" stroke="rgba(94,106,210,0.25)" stroke-width="1.2"/>' +
      '<rect x="155" y="172" width="50" height="68" rx="10" fill="rgba(94,106,210,0.04)"/>' +
      '<rect x="124" y="178" width="28" height="10" rx="5" fill="none" stroke="rgba(94,106,210,0.2)" stroke-width="1"/>' +
      '<rect x="208" y="178" width="28" height="10" rx="5" fill="none" stroke="rgba(94,106,210,0.2)" stroke-width="1"/>' +
    '</g></svg>';

    // 节点光晕 + 可点击节点渲染
    var nodesHtml = '';
    var nodeConfigs = [
      { key: 'communication', left: 25, top: 22, color: '#5E6AD2', glowColor: 'rgba(94,106,210,0.35)', label: '沟通方式',
        has: commMethods.length > 0, delay: '0s',
        tags: commMethods.slice(0, 3).map(function (m) { return nodeTag('94,106,210', m.method); }).join('') },
      { key: 'emotion', left: 75, top: 22, color: '#aa8cdc', glowColor: 'rgba(170,140,220,0.35)', label: '情绪行为',
        has: triggers.length > 0, delay: '0.5s',
        tags: triggers.slice(0, 3).map(function (t) { return nodeTag('170,140,220', t.trigger); }).join('') },
      { key: 'caution', left: 25, top: 48, color: '#f5b464', glowColor: 'rgba(245,180,100,0.35)', label: '特别注意',
        has: highRisks.length > 0, delay: '1s',
        tags: highRisks.slice(0, 2).map(function (r) { return nodeTag('245,180,100', r.description); }).join('') },
      { key: 'work', left: 75, top: 48, color: '#82c896', glowColor: 'rgba(130,200,150,0.35)', label: '工作支持',
        has: workPrefs.length > 0, delay: '1.5s',
        tags: workPrefs.slice(0, 3).map(function (w) { return nodeTag('130,200,150', w); }).join('') },
      { key: 'training', left: 50, top: 74, color: '#e68cb4', glowColor: 'rgba(230,140,180,0.35)', label: '正在训练',
        has: activePlans.length > 0, delay: '2s',
        tags: activePlans.slice(0, 2).map(function (p) { return nodeTag('230,140,180', p.title); }).join('') }
    ];

    nodeConfigs.forEach(function (nc) {
      if (!nc.has) return;
      nodesHtml += '<div class="node-glow" style="left:' + nc.left + '%;top:' + nc.top + '%;width:36px;height:36px;background:' + nc.glowColor + ';--delay:' + nc.delay + ';"></div>';
      nodesHtml += '<div class="node-bubble" style="left:' + nc.left + '%;top:' + nc.top + '%;" onclick="Profile._selectNode(\'' + nc.key + '\')" id="node-' + nc.key + '">' +
        '<div class="node-core" style="background:' + nc.color + ';color:' + nc.color + ';--delay:' + nc.delay + ';"></div>' +
        '<div class="node-label" style="color:' + nc.color + ';">' + nc.label + '</div>' +
        (nc.tags ? '<div class="node-tags">' + nc.tags + '</div>' : '') +
      '</div>';
    });

    // 姓名
    var avatarEmoji = (profile && profile.avatar) ? profile.avatar : '👤';
    var lifecycleLabel = (profile && profile.lifeCycleStatus) ? (LIFECYCLE_LABELS[profile.lifeCycleStatus] || profile.lifeCycleStatus) : '';
    var nameHtml = '<div class="name-zone">' +
      '<div class="name-text">' + Utils.escapeHtml(name) + '</div>' +
      '<div class="name-sub">' + age + '岁 · ' + genderLabel + (lifecycleLabel ? ' · ' + lifecycleLabel : '') + '</div>' +
    '</div>';

    // 头像
    var avatarHtml = '<div class="avatar-zone"><div class="avatar-face">' + avatarEmoji + '</div></div>';

    // 星座名
    var constNameHtml = '<div class="constellation-name">✦ ' + Utils.escapeHtml(name) + ' 座 ✦</div>';

    // 空状态
    if (!profile || !hasAnyData) {
      return '<div class="portrait-card">' +
        '<div class="star-map"><div class="star-map-inner">' +
          '<div class="star-field"></div>' +
          bgStars +
          nameHtml +
          avatarHtml +
          '<div class="portrait-empty">档案信息尚不完整，去补充更多内容吧</div>' +
        '</div></div></div>';
    }

    return '<div class="portrait-card">' +
      '<div class="star-map"><div class="star-map-inner">' +
        '<div class="star-field"></div>' +
        bgStars +
        linesSvg +
        nodesHtml +
        nameHtml +
        avatarHtml +
        constNameHtml +
      '</div></div>' +
    '</div>';
  }

  /**
   * 渲染星图详情面板
   */
  function _renderPortraitPanels(profile) {
    var modules = (profile && profile.modules) ? profile.modules : {};
    var html = '';

    // 沟通与表达
    var comm = modules.communicationGuide;
    if (comm) {
      html += '<div class="detail-panel" id="panel-communication">' +
        '<div class="detail-panel-header">' +
          '<div class="detail-panel-title"><span class="detail-panel-dot" style="background:#5E6AD2;"></span>沟通与表达</div>' +
          '<button class="detail-panel-close" onclick="Profile._closePanel()">✕</button>' +
        '</div>' +
        '<div class="detail-panel-body">';

      if (comm.preferredMethods && comm.preferredMethods.length > 0) {
        html += '<div class="detail-section"><div class="detail-section-label">推荐沟通方式</div><div class="detail-tags">';
        comm.preferredMethods.forEach(function (m) {
          html += '<span class="detail-tag" style="background:rgba(94,106,210,0.12);border:1px solid rgba(94,106,210,0.2);color:#5E6AD2;">' + Utils.escapeHtml(m.method) + '</span>';
        });
        html += '</div></div>';

        comm.preferredMethods.forEach(function (m) {
          html += '<div class="detail-item"><span class="detail-item-icon">💬</span><div class="detail-item-body">' +
            '<div class="detail-item-title">' + Utils.escapeHtml(m.method) + '</div>' +
            (m.description ? '<div class="detail-item-desc">' + Utils.escapeHtml(m.description) + '</div>' : '') +
          '</div></div>';
        });
      }

      if (comm.expressionDifficulties) {
        html += '<div class="detail-section" style="margin-top:12px;"><div class="detail-section-label">理解难点</div>' +
          '<div class="detail-section-content">' + Utils.escapeHtml(comm.expressionDifficulties) + '</div></div>';
      }

      if (comm.specialHabits && comm.specialHabits.length > 0) {
        html += '<div class="detail-section" style="margin-top:12px;"><div class="detail-section-label">特殊习惯</div><div class="detail-tags">';
        comm.specialHabits.forEach(function (h) {
          html += '<span class="detail-tag" style="background:rgba(94,106,210,0.12);border:1px solid rgba(94,106,210,0.2);color:#5E6AD2;">' + Utils.escapeHtml(h) + '</span>';
        });
        html += '</div></div>';
      }

      if (comm.sensoryPreferences) {
        html += '<div class="detail-section" style="margin-top:12px;"><div class="detail-section-label">感官偏好</div>' +
          '<div class="detail-section-content">避免：' + Utils.escapeHtml((comm.sensoryPreferences.avoid || []).join('、')) +
          '<br>偏好：' + Utils.escapeHtml((comm.sensoryPreferences.prefer || []).join('、')) + '</div></div>';
      }

      html += '</div></div>';
    }

    // 情绪行为
    var emo = modules.emotionBehavior;
    if (emo && emo.behaviorRedLines && emo.behaviorRedLines.length > 0) {
      html += '<div class="detail-panel" id="panel-emotion">' +
        '<div class="detail-panel-header">' +
          '<div class="detail-panel-title"><span class="detail-panel-dot" style="background:#aa8cdc;"></span>情绪与行为红线</div>' +
          '<button class="detail-panel-close" onclick="Profile._closePanel()">✕</button>' +
        '</div>' +
        '<div class="detail-panel-body">';

      emo.behaviorRedLines.forEach(function (r) {
        html += '<div class="detail-item"><span class="detail-item-icon">⚠️</span><div class="detail-item-body">' +
          '<div class="detail-item-title">' + Utils.escapeHtml(r.description) + '</div>' +
          '<div class="detail-item-desc">' +
            (r.trigger ? '触发：' + Utils.escapeHtml(r.trigger) + ' · ' : '') +
            '应对：' + Utils.escapeHtml(r.response || '') +
          '</div>' +
        '</div></div>';
      });

      html += '</div></div>';
    }

    // 特别注意
    if (highRisksOnly(modules) || (comm && comm.specialHabits && comm.specialHabits.length > 0)) {
      html += '<div class="detail-panel" id="panel-caution">' +
        '<div class="detail-panel-header">' +
          '<div class="detail-panel-title"><span class="detail-panel-dot" style="background:#f5b464;"></span>特别注意</div>' +
          '<button class="detail-panel-close" onclick="Profile._closePanel()">✕</button>' +
        '</div>' +
        '<div class="detail-panel-body">';

      var highOnly = highRisksOnly(modules);
      if (highOnly && highOnly.length > 0) {
        highOnly.forEach(function (r) {
          html += '<div class="detail-item"><span class="detail-item-icon">⚠️</span><div class="detail-item-body">' +
            '<div class="detail-item-title">' + Utils.escapeHtml(r.description) + '</div>' +
            '<div class="detail-item-desc">严重程度：高 · ' + Utils.escapeHtml(r.response || '') + '</div>' +
          '</div></div>';
        });
      }

      if (comm && comm.specialHabits && comm.specialHabits.length > 0) {
        html += '<div class="detail-section" style="margin-top:12px;"><div class="detail-section-label">特殊习惯</div><div class="detail-tags">';
        comm.specialHabits.forEach(function (h) {
          html += '<span class="detail-tag" style="background:rgba(245,180,100,0.12);border:1px solid rgba(245,180,100,0.2);color:#f5c888;">' + Utils.escapeHtml(h) + '</span>';
        });
        html += '</div></div>';
      }

      html += '</div></div>';
    }

    // 工作支持
    var ws = modules.workSupport;
    if (ws && (ws.workPreferences && ws.workPreferences.length > 0 || ws.ispPlans && ws.ispPlans.length > 0)) {
      html += '<div class="detail-panel" id="panel-work">' +
        '<div class="detail-panel-header">' +
          '<div class="detail-panel-title"><span class="detail-panel-dot" style="background:#82c896;"></span>工作支持</div>' +
          '<button class="detail-panel-close" onclick="Profile._closePanel()">✕</button>' +
        '</div>' +
        '<div class="detail-panel-body">';

      if (ws.workPreferences && ws.workPreferences.length > 0) {
        html += '<div class="detail-section"><div class="detail-section-label">工作偏好</div><div class="detail-tags">';
        ws.workPreferences.forEach(function (w) {
          html += '<span class="detail-tag" style="background:rgba(130,200,150,0.12);border:1px solid rgba(130,200,150,0.2);color:#8ed0a0;">' + Utils.escapeHtml(w) + '</span>';
        });
        html += '</div></div>';
      }

      if (ws.ispPlans && ws.ispPlans.length > 0) {
        html += '<div class="detail-section" style="margin-top:12px;"><div class="detail-section-label">ISP 训练计划</div>';
        ws.ispPlans.forEach(function (p) {
          var statusLabels = { active: '进行中', completed: '已完成', paused: '已暂停' };
          html += '<div class="detail-item"><span class="detail-item-icon">📋</span><div class="detail-item-body">' +
            '<div class="detail-item-title">' + Utils.escapeHtml(p.title) + '</div>' +
            '<div class="detail-item-desc">状态：' + (statusLabels[p.status] || p.status) +
              (p.goals && p.goals.length > 0 ? ' · 目标：' + Utils.escapeHtml(p.goals.join('、')) : '') +
            '</div>' +
          '</div></div>';
        });
        html += '</div>';
      }

      html += '</div></div>';
    }

    // 正在训练
    if (ws && ws.ispPlans) {
      var activeOnly = ws.ispPlans.filter(function (p) { return p.status === 'active'; });
      if (activeOnly.length > 0) {
        html += '<div class="detail-panel" id="panel-training">' +
          '<div class="detail-panel-header">' +
            '<div class="detail-panel-title"><span class="detail-panel-dot" style="background:#e68cb4;"></span>正在训练</div>' +
            '<button class="detail-panel-close" onclick="Profile._closePanel()">✕</button>' +
          '</div>' +
          '<div class="detail-panel-body">';

        activeOnly.forEach(function (p) {
          html += '<div class="detail-item"><span class="detail-item-icon">🎯</span><div class="detail-item-body">' +
            '<div class="detail-item-title">' + Utils.escapeHtml(p.title) + '</div>' +
            '<div class="detail-item-desc">状态：进行中' +
              (p.goals && p.goals.length > 0 ? ' · 目标：' + Utils.escapeHtml(p.goals.join('、')) : '') +
            '</div>' +
          '</div></div>';
        });

        html += '</div></div>';
      }
    }

    return html;
  }

  function highRisksOnly(modules) {
    var emo = modules.emotionBehavior;
    if (!emo || !emo.behaviorRedLines) return [];
    return emo.behaviorRedLines.filter(function (b) { return b.severity === 'high'; });
  }

  /**
   * 渲染模块内容
   */
  function _renderModuleContent(moduleKey, moduleData, youth) {
    if (!moduleData) return '<div class="empty-state"><div class="empty-state-desc">暂无数据</div></div>';

    var html = '';

    if (moduleKey === 'lifePreferences') {
      // 已拆分：作息→careMedical，活动/愿望→workSupport，此处保留兼容旧数据
      html += _renderModuleCard('🎨 喜欢的活动', moduleData.favoriteActivities);
      html += _renderModuleCard('📍 想去的地方', moduleData.favoritePlaces);
      if (moduleData.futureWishes && moduleData.futureWishes.length > 0) {
        html += '<div class="module-card"><div class="module-card-title">🌟 未来愿望</div>';
        for (var i = 0; i < moduleData.futureWishes.length; i++) {
          html += '<div class="data-item"><div class="data-value">' + Utils.escapeHtml(moduleData.futureWishes[i].text) + '</div></div>';
        }
        html += '</div>';
      }
      if (moduleData.dailyRoutine) {
        html += '<div class="module-card"><div class="module-card-title">⏰ 日常作息</div>';
        html += _renderDataItem('起床时间', moduleData.dailyRoutine.wakeTime);
        html += _renderDataItem('用餐时间', (moduleData.dailyRoutine.mealTimes || []).join('、'));
        html += _renderDataItem('睡觉时间', moduleData.dailyRoutine.sleepTime);
        html += '</div>';
      }
    } else if (moduleKey === 'communicationGuide') {
      if (moduleData.preferredMethods && moduleData.preferredMethods.length > 0) {
        html += '<div class="module-card"><div class="module-card-title">💬 推荐沟通方式</div>';
        for (var i = 0; i < moduleData.preferredMethods.length; i++) {
          var m = moduleData.preferredMethods[i];
          html += '<div class="data-item"><div class="data-label">' + Utils.escapeHtml(m.method) + '</div><div class="data-value">' + Utils.escapeHtml(m.description || '') + '</div></div>';
        }
        html += '</div>';
      }
      if (moduleData.expressionDifficulties) {
        html += _renderModuleCard('🗣️ 表达困难', [moduleData.expressionDifficulties]);
      }
      html += _renderModuleCard('📋 特殊习惯', moduleData.specialHabits);
      if (moduleData.sensoryPreferences) {
        html += '<div class="module-card"><div class="module-card-title">👁️ 感官偏好</div>';
        html += _renderDataItem('避免', (moduleData.sensoryPreferences.avoid || []).join('、'));
        html += _renderDataItem('偏好', (moduleData.sensoryPreferences.prefer || []).join('、'));
        html += '</div>';
      }
    } else if (moduleKey === 'emotionBehavior') {
      if (moduleData.behaviorRedLines && moduleData.behaviorRedLines.length > 0) {
        html += '<div class="module-card"><div class="module-card-title">⚠️ 行为红线</div>';
        for (var i = 0; i < moduleData.behaviorRedLines.length; i++) {
          var r = moduleData.behaviorRedLines[i];
          html += '<div class="red-line-item severity-' + (r.severity || 'medium') + '">' +
            '<div class="red-line-icon">⚠️</div>' +
            '<div class="red-line-content">' +
              '<div class="red-line-desc">' + Utils.escapeHtml(r.description) + '</div>' +
              (r.trigger ? '<div class="red-line-response">触发：' + Utils.escapeHtml(r.trigger) + '</div>' : '') +
              '<div class="red-line-response">应对：' + Utils.escapeHtml(r.response) + '</div>' +
            '</div>' +
          '</div>';
        }
        html += '</div>';
      }
      if (moduleData.emotionTrend && moduleData.emotionTrend.length > 0) {
        html += '<div class="module-card"><div class="module-card-title">📊 近期情绪</div>';
        var moodLabels = { great: '😀 很好', good: '🙂 不错', neutral: '😐 一般', low: '😞 低落', crisis: '🆘 危机' };
        for (var i = moduleData.emotionTrend.length - 1; i >= 0 && i >= moduleData.emotionTrend.length - 7; i--) {
          var e = moduleData.emotionTrend[i];
          html += '<div class="data-item"><div class="data-label">' + e.date + '</div><div class="data-value">' + (moodLabels[e.mood] || e.mood) + (e.note ? ' - ' + Utils.escapeHtml(e.note) : '') + '</div></div>';
        }
        html += '</div>';
      }
      if (moduleData.interventionHistory && moduleData.interventionHistory.length > 0) {
        html += '<div class="module-card"><div class="module-card-title">📝 干预记录</div>';
        for (var i = 0; i < moduleData.interventionHistory.length; i++) {
          var h = moduleData.interventionHistory[i];
          var effLabels = { effective: '✅ 有效', partial: '⚠️ 部分有效', ineffective: '❌ 无效' };
          html += '<div class="data-item"><div class="data-label">' + Utils.escapeHtml(h.strategy) + '</div><div class="data-value">' + (effLabels[h.effectiveness] || h.effectiveness) + '</div></div>';
        }
        html += '</div>';
      }
    } else if (moduleKey === 'careMedical') {
      html += _renderModuleCard('⚠️ 过敏源', moduleData.allergies);
      if (moduleData.medications && moduleData.medications.length > 0) {
        html += '<div class="module-card"><div class="module-card-title">💊 用药记录</div>';
        for (var i = 0; i < moduleData.medications.length; i++) {
          var med = moduleData.medications[i];
          html += '<div class="data-item"><div class="data-label">' + Utils.escapeHtml(med.name) + '</div><div class="data-value">' + Utils.escapeHtml(med.dosage + ' ' + med.frequency) + '</div></div>';
        }
        html += '</div>';
      }
      if (moduleData.medicalHistory && moduleData.medicalHistory.length > 0) {
        html += '<div class="module-card"><div class="module-card-title">🏥 就医记录</div>';
        for (var i = 0; i < moduleData.medicalHistory.length; i++) {
          var mh = moduleData.medicalHistory[i];
          html += '<div class="data-item"><div class="data-label">' + (mh.date || '') + '</div><div class="data-value">' + Utils.escapeHtml(mh.event) + '</div></div>';
        }
        html += '</div>';
      }
      // 日常作息（从 lifePreferences 拆分而来）
      if (moduleData.dailyRoutine) {
        html += '<div class="module-card"><div class="module-card-title">⏰ 日常作息</div>';
        html += _renderDataItem('起床时间', moduleData.dailyRoutine.wakeTime);
        html += _renderDataItem('用餐时间', (moduleData.dailyRoutine.mealTimes || []).join('、'));
        html += _renderDataItem('睡觉时间', moduleData.dailyRoutine.sleepTime);
        html += '</div>';
      }
    } else if (moduleKey === 'workSupport') {
      // 生活偏好（从 lifePreferences 拆分而来）
      html += _renderModuleCard('🎨 喜欢的活动', moduleData.favoriteActivities);
      html += _renderModuleCard('📍 想去的地方', moduleData.favoritePlaces);
      if (moduleData.futureWishes && moduleData.futureWishes.length > 0) {
        html += '<div class="module-card"><div class="module-card-title">🌟 未来愿望</div>';
        for (var i = 0; i < moduleData.futureWishes.length; i++) {
          html += '<div class="data-item"><div class="data-value">' + Utils.escapeHtml(moduleData.futureWishes[i].text) + '</div></div>';
        }
        html += '</div>';
      }
      if (moduleData.ispPlans && moduleData.ispPlans.length > 0) {
        html += '<div class="module-card"><div class="module-card-title">📋 ISP 个体支持计划</div>';
        for (var i = 0; i < moduleData.ispPlans.length; i++) {
          var p = moduleData.ispPlans[i];
          var statusLabels = { active: '进行中', completed: '已完成', paused: '已暂停' };
          html += '<div class="data-item"><div class="data-label">' + Utils.escapeHtml(p.title) + '</div><div class="data-value">' + (statusLabels[p.status] || p.status) + '</div></div>';
          if (p.goals && p.goals.length > 0) {
            html += '<div class="tag-list" style="margin:4px 0;">';
            for (var g = 0; g < p.goals.length; g++) {
              html += '<span class="tag">' + Utils.escapeHtml(p.goals[g]) + '</span>';
            }
            html += '</div>';
          }
        }
        html += '</div>';
      }
      if (moduleData.capabilityAssessment) {
        var ca = moduleData.capabilityAssessment;
        html += '<div class="module-card"><div class="module-card-title">📊 能力评估</div>';
        html += _renderDataItem('社交互动', ca.socialInteraction + '/5');
        html += _renderDataItem('生活自理', ca.selfCare + '/5');
        html += _renderDataItem('工作技能', ca.workSkills + '/5');
        html += _renderDataItem('社区参与', ca.communityAccess + '/5');
        html += _renderDataItem('沟通能力', ca.communication + '/5');
        html += '</div>';
      }
      html += _renderModuleCard('💼 就业偏好', moduleData.workPreferences);
    } else if (moduleKey === 'relationshipMap') {
      if (moduleData.relationships && moduleData.relationships.length > 0) {
        html += '<div class="module-card"><div class="module-card-title">👥 重要关系人</div>';
        for (var i = 0; i < moduleData.relationships.length; i++) {
          var rel = moduleData.relationships[i];
          var relTypeLabels = { parent: '家长', sibling: '兄弟姐妹', teacher: '老师', caregiver: '照护者', friend: '朋友', colleague: '同事', other: '其他' };
          html += '<div class="data-item"><div class="data-label">' + Utils.escapeHtml(rel.name) + '</div><div class="data-value">' + (relTypeLabels[rel.relationType] || rel.relationType) + '</div></div>';
        }
        html += '</div>';
      }
    }

    if (!html) {
      html = '<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-desc">暂无数据</div></div>';
    }

    return html;
  }

  /**
   * 渲染模块卡片（标签列表）
   */
  function _renderModuleCard(title, items) {
    if (!items || items.length === 0) return '';
    var html = '<div class="module-card"><div class="module-card-title">' + title + '</div><div class="tag-list">';
    for (var i = 0; i < items.length; i++) {
      html += '<span class="tag">' + Utils.escapeHtml(items[i]) + '</span>';
    }
    html += '</div></div>';
    return html;
  }

  /**
   * 渲染数据条目
   */
  function _renderDataItem(label, value) {
    if (!value && value !== 0) return '';
    return '<div class="data-item"><div class="data-label">' + Utils.escapeHtml(label) + '</div><div class="data-value">' + Utils.escapeHtml(String(value)) + '</div></div>';
  }

  /**
   * 渲染紧急联系人下拉面板
   */
  function _renderEmergencyDropdown(youth) {
    if (!youth.emergencyContacts || youth.emergencyContacts.length === 0) return '';

    var itemsHtml = '';
    for (var i = 0; i < youth.emergencyContacts.length; i++) {
      var c = youth.emergencyContacts[i];
      itemsHtml += '<a class="emergency-dropdown-item" href="tel:' + Utils.escapeHtml(c.phone) + '">' +
        '<span class="emergency-dropdown-item-icon">📞</span>' +
        '<div class="emergency-dropdown-item-body">' +
          '<span class="emergency-dropdown-item-name">' + Utils.escapeHtml(c.name) + '</span>' +
          '<span class="emergency-dropdown-item-relation">' + Utils.escapeHtml(c.relation || '') + '</span>' +
        '</div>' +
        '<span class="emergency-dropdown-item-phone">' + Utils.escapeHtml(c.phone) + '</span>' +
      '</a>';
    }

    return '<div class="emergency-dropdown" id="emergency-dropdown">' +
      '<div class="emergency-dropdown-header">' +
        '<span>🚨 紧急联系人</span>' +
        '<button class="emergency-dropdown-close" id="btn-emergency-close">✕</button>' +
      '</div>' +
      '<div class="emergency-dropdown-body">' + itemsHtml + '</div>' +
    '</div>';
  }

  /**
   * 绑定详情页事件
   */
  function _bindDetailEvents(youthId) {
    // 返回按钮
    var backBtn = document.getElementById('btn-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        window.location.hash = 'dashboard';
      });
    }

    var quickcardBtn = document.getElementById('btn-quickcard');
    if (quickcardBtn) {
      quickcardBtn.addEventListener('click', function () {
        window.location.hash = 'quickcard?youthId=' + encodeURIComponent(youthId);
      });
    }

    // 紧急联系人下拉面板
    var emergencyBtn = document.getElementById('btn-emergency');
    var emergencyDropdown = document.getElementById('emergency-dropdown');
    if (emergencyBtn && emergencyDropdown) {
      emergencyBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        emergencyDropdown.classList.toggle('show');
      });
      var emergencyClose = document.getElementById('btn-emergency-close');
      if (emergencyClose) {
        emergencyClose.addEventListener('click', function () {
          emergencyDropdown.classList.remove('show');
        });
      }
      // 点击外部关闭
      document.addEventListener('click', function (e) {
        if (emergencyDropdown.classList.contains('show') &&
            !emergencyDropdown.contains(e.target) &&
            e.target !== emergencyBtn) {
          emergencyDropdown.classList.remove('show');
        }
      });
    }
  }

  /**
   * 渲染档案列表
   */
  function _renderList() {
    window.location.hash = 'dashboard';
  }

  // 星图节点选中状态
  var _selectedPortraitNode = null;

  /**
   * 选中星图节点，展开详情面板
   */
  function _selectNode(key) {
    // 取消之前选中
    if (_selectedPortraitNode) {
      var prevNode = document.getElementById('node-' + _selectedPortraitNode);
      var prevPanel = document.getElementById('panel-' + _selectedPortraitNode);
      if (prevNode) prevNode.classList.remove('selected');
      if (prevPanel) prevPanel.classList.remove('active');
    }

    // 点击同一个节点：取消选中
    if (_selectedPortraitNode === key) {
      _selectedPortraitNode = null;
      return;
    }

    _selectedPortraitNode = key;
    var node = document.getElementById('node-' + key);
    var panel = document.getElementById('panel-' + key);
    if (node) node.classList.add('selected');
    if (panel) {
      panel.classList.add('active');
    }
  }

  /**
   * 关闭详情面板
   */
  function _closePanel() {
    if (_selectedPortraitNode) {
      var node = document.getElementById('node-' + _selectedPortraitNode);
      var panel = document.getElementById('panel-' + _selectedPortraitNode);
      if (node) node.classList.remove('selected');
      if (panel) panel.classList.remove('active');
      _selectedPortraitNode = null;
    }
  }

  return {
    MODULES: Modules.MODULES,
    LIFECYCLE_LABELS: LIFECYCLE_LABELS,
    renderProfile: renderProfile,
    _renderModuleCard: _renderModuleCard,
    _renderDataItem: _renderDataItem,
    _selectNode: _selectNode,
    _closePanel: _closePanel
  };
})();
