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
        '<button class="btn btn-sm btn-secondary" id="btn-back">← 返回</button>' +
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
    var age = Utils.calculateAge(youth.birthDate);
    var genderLabel = youth.gender === 'male' ? '男' : youth.gender === 'female' ? '女' : '其他';
    var lifecycleLabel = LIFECYCLE_LABELS[youth.lifeCycleStatus] || youth.lifeCycleStatus;

    // 模块导航
    var moduleNavHtml = '<div class="module-nav">';
    for (var i = 0; i < Modules.MODULES.length; i++) {
      moduleNavHtml += '<div class="module-tab' + (i === 0 ? ' active' : '') + '" data-module="' + Modules.MODULES[i].key + '">' +
        '<div class="module-tab-icon">' + Modules.MODULES[i].icon + '</div>' +
        '<div class="module-tab-label">' + Modules.MODULES[i].label + '</div>' +
      '</div>';
    }
    moduleNavHtml += '</div>';

    // 模块内容
    var moduleContentHtml = '<div class="module-content" id="module-content">';
    for (var i = 0; i < Modules.MODULES.length; i++) {
      moduleContentHtml += '<div class="module-section' + (i === 0 ? ' active' : '') + '" data-module="' + Modules.MODULES[i].key + '">' +
        _renderModuleContent(Modules.MODULES[i].key, youth.modules[Modules.MODULES[i].key], youth) +
      '</div>';
    }
    moduleContentHtml += '</div>';

    container.innerHTML =
      '<div class="page-header">' +
        '<span></span>' +
        '<span class="page-title">档案详情</span>' +
        '<button class="btn btn-sm btn-secondary" id="btn-quickcard" title="速读卡">📚 速读卡</button>' +
      '</div>' +
      '<div class="profile-header">' +
        '<div class="profile-avatar">' + (youth.avatar || '👤') + '</div>' +
        '<div class="profile-info">' +
          '<div class="profile-name">' + Utils.escapeHtml(youth.name) + '</div>' +
          '<div class="profile-meta">' +
            '<span class="profile-meta-item">' + age + '岁</span>' +
            '<span class="profile-meta-item">' + genderLabel + '</span>' +
            '<span class="lifecycle-badge ' + youth.lifeCycleStatus + '">' + lifecycleLabel + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      moduleNavHtml +
      '<div class="page-content">' +
        moduleContentHtml +
      '</div>' +
      _renderEmergencyBar(youth);

    _bindDetailEvents(youthId);
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
   * 渲染紧急联系人底部固定栏 — Apple 风格
   */
  function _renderEmergencyBar(youth) {
    if (!youth.emergencyContacts || youth.emergencyContacts.length === 0) return '';

    var itemsHtml = '';
    for (var i = 0; i < youth.emergencyContacts.length; i++) {
      var c = youth.emergencyContacts[i];
      itemsHtml += '<a class="emergency-bar-item" href="tel:' + Utils.escapeHtml(c.phone) + '">' +
        '<span class="emergency-bar-item-icon">📞</span>' +
        '<span class="emergency-bar-item-name">' + Utils.escapeHtml(c.name) + '</span>' +
        '<span class="emergency-bar-item-relation">' + Utils.escapeHtml(c.relation || '') + '</span>' +
        '<span class="emergency-bar-item-phone">' + Utils.escapeHtml(c.phone) + '</span>' +
      '</a>';
    }

    return '<div class="emergency-bar" id="emergency-bar">' +
      '<div class="emergency-bar-toggle" id="emergency-bar-toggle">' +
        '<span class="emergency-bar-icon">🚨</span>' +
        '<span class="emergency-bar-label">紧急联系人</span>' +
        '<span class="emergency-bar-count">' + youth.emergencyContacts.length + '</span>' +
        '<span class="emergency-bar-chevron">▲</span>' +
      '</div>' +
      '<div class="emergency-bar-panel" id="emergency-bar-panel">' +
        itemsHtml +
      '</div>' +
    '</div>';
  }

  /**
   * 绑定详情页事件
   */
  function _bindDetailEvents(youthId) {
    var quickcardBtn = document.getElementById('btn-quickcard');
    if (quickcardBtn) {
      quickcardBtn.addEventListener('click', function () {
        window.location.hash = 'quickcard?youthId=' + encodeURIComponent(youthId);
      });
    }

    // 模块切换
    var tabs = document.querySelectorAll('.module-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        var moduleKey = this.getAttribute('data-module');
        // 切换 tab
        var allTabs = document.querySelectorAll('.module-tab');
        for (var j = 0; j < allTabs.length; j++) {
          allTabs[j].classList.remove('active');
        }
        this.classList.add('active');
        // 切换内容
        var allSections = document.querySelectorAll('.module-section');
        for (var j = 0; j < allSections.length; j++) {
          allSections[j].classList.remove('active');
          if (allSections[j].getAttribute('data-module') === moduleKey) {
            allSections[j].classList.add('active');
          }
        }
      });
    }

    // 紧急联系人栏切换
    var emergencyToggle = document.getElementById('emergency-bar-toggle');
    if (emergencyToggle) {
      emergencyToggle.addEventListener('click', function () {
        var bar = document.getElementById('emergency-bar');
        if (bar) {
          bar.classList.toggle('expanded');
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

  return {
    MODULES: Modules.MODULES,
    LIFECYCLE_LABELS: LIFECYCLE_LABELS,
    renderProfile: renderProfile,
    _renderModuleCard: _renderModuleCard,
    _renderDataItem: _renderDataItem
  };
})();
