# 家庭授权与 UI 精简实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现家长家庭授权系统（relation 字段、邀请码、主监护人权限）、速读卡极简化、底部导航从 6 减为 4、独立页面返回按钮改为关闭按钮。

**Architecture:** 分 6 个独立任务，按依赖顺序执行。每个任务完成后提交 git，确保中间状态可运行。

**Tech Stack:** 原生 JavaScript + localStorage + Tailwind CSS + iOS 设计风格

---

## 任务 1：数据层 - 邀请码存储 + access_grant 兼容 relation 字段

**Files:**
- Modify: `js/storage.js`
- Modify: `js/constants.js` (新增 FAMILY_RELATIONS 常量)

- [ ] **Step 1: 在 constants.js 新增 FAMILY_RELATIONS 常量**

在 `js/constants.js` 中，`ROLE_LABELS` 之后添加：

```js
  /**
   * 家长家庭关系（仅 parent 角色有意义）
   */
  FAMILY_RELATIONS: {
    father: '父亲',
    mother: '母亲',
    grandfather: '祖父',
    grandmother: '祖母',
    brother: '兄弟',
    sister: '姐妹',
    other_guardian: '其他监护人'
  },

  FAMILY_RELATION_LABELS: ['father', 'mother', 'grandfather', 'grandmother', 'brother', 'sister', 'other_guardian'],
```

- [ ] **Step 2: 在 storage.js 新增 INVITATIONS KEY**

在 `KEYS` 对象中添加：
```js
    INVITATIONS: 'ai_dongwo_invitations',
```

- [ ] **Step 3: 在 storage.js 新增邀请码 CRUD 方法**

在 `updateAccessGrant` 函数之后、`JoinRequest` 区块之前添加：

```js
  // ==================== Invitation ====================

  function getInvitations(youthId) {
    var all = get(KEYS.INVITATIONS) || [];
    if (youthId) {
      return all.filter(function (inv) { return inv.youthId === youthId; });
    }
    return all;
  }

  function getInvitationByCode(code) {
    var all = get(KEYS.INVITATIONS) || [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].code === code) return all[i];
    }
    return null;
  }

  function addInvitation(invitation) {
    var all = get(KEYS.INVITATIONS) || [];
    all.push(invitation);
    set(KEYS.INVITATIONS, all);
    return { success: true };
  }

  function updateInvitation(id, updates) {
    var all = get(KEYS.INVITATIONS) || [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        Object.assign(all[i], updates);
        set(KEYS.INVITATIONS, all);
        return true;
      }
    }
    return false;
  }

  function cleanExpiredInvitations() {
    var all = get(KEYS.INVITATIONS) || [];
    var now = new Date();
    var changed = false;
    for (var i = 0; i < all.length; i++) {
      if (all[i].status === 'active' && all[i].expiresAt && new Date(all[i].expiresAt) < now) {
        all[i].status = 'expired';
        changed = true;
      }
    }
    if (changed) set(KEYS.INVITATIONS, all);
    return changed;
  }
```

- [ ] **Step 4: 在 storage.js 导出中添加邀请码方法**

在 `return` 对象中添加：
```js
    getInvitations: getInvitations,
    getInvitationByCode: getInvitationByCode,
    addInvitation: addInvitation,
    updateInvitation: updateInvitation,
    cleanExpiredInvitations: cleanExpiredInvitations,
```

- [ ] **Step 5: 验证数据层**

在浏览器控制台测试：
- `Constants.FAMILY_RELATIONS.father` → "父亲"
- `Storage.addInvitation({id:'test', youthId:'test', code:'123456', status:'active', expiresAt:'2099-01-01'})` → success
- `Storage.getInvitationByCode('123456')` → 返回刚才创建的对象

- [ ] **Step 6: Commit**

```bash
git add js/storage.js js/constants.js
git commit -m "feat(data): add family relations and invitation storage"
```

---

## 任务 2：权限层 - 主监护人权限 + grantAccess 支持 relation

**Files:**
- Modify: `js/permissions.js`

- [ ] **Step 1: 修改 _checkManage 函数，改用主监护人判断**

将 `js/permissions.js` 中 `_checkManage` 函数（第 110-120 行）替换为：

```js
  /**
   * 检查管理权限
   * 仅主监护人（profile.currentGuardianId）或 admin 可管理授权
   */
  function _checkManage(grants, user) {
    if (user.role === 'admin') return true;
    if (user.role !== 'parent') return false;
    var youth = AppState.currentYouth;
    if (!youth) return false;
    return youth.currentGuardianId === user.id;
  }
```

- [ ] **Step 2: 修改 grantAccess 函数，支持 relation 参数**

将 `grantAccess` 函数签名和实现中添加 relation：

函数签名改为：
```js
  function grantAccess(youthId, granteeId, granteeRole, validUntil, relation) {
```

在 `var grant = { ... }` 对象中添加 relation 字段：
```js
    var grant = {
      id: Utils.generateUUID(),
      youthId: youthId,
      grantorId: user.id,
      granteeId: granteeId,
      granteeRole: granteeRole,
      scope: scope,
      relation: relation || null,
      validFrom: now,
      validUntil: validUntil || null,
      status: 'active',
      grantedAt: now,
      revokedAt: null,
      revokeReason: null
    };
```

- [ ] **Step 3: 验证权限层**

在浏览器控制台测试：
- 以主监护人身份登录，`Permissions.canManage()` → true
- 以普通家长身份登录（非主监护人），`Permissions.canManage()` → false
- 以 admin 身份登录，`Permissions.canManage()` → true

- [ ] **Step 4: Commit**

```bash
git add js/permissions.js
git commit -m "feat(permissions): primary guardian only can manage grants, add relation param"
```

---

## 任务 3：家长游离态选择页 + 邀请码生成 + 家长扫码关系选择

**Files:**
- Modify: `js/welcome.js`（改造为选择页）
- Modify: `js/grants.js`（移除 parent + 加邀请码入口 + 显示关系）
- Modify: `js/join-request.js`（家长角色加关系选择）
- Modify: `js/auth.js`（家长注册跳转 welcome）

- [ ] **Step 3.1: 改造 welcome.js 为家长选择页**

将 `js/welcome.js` 整个替换为以下内容：

```js
/**
 * welcome.js - 家长注册引导/选择页
 * 家长注册后选择：创建档案 或 加入已有家庭
 * 依赖：Storage、Permissions、Utils、AppState、Constants
 */
window.Welcome = (function () {
  'use strict';

  function renderWelcome() {
    var container = App.getContainer();
    var user = AppState.currentUser;

    if (!user || user.role !== 'parent') {
      window.location.hash = 'dashboard';
      return;
    }

    var youths = Permissions.getAccessibleYouths();
    if (youths.length > 0) {
      window.location.hash = 'dashboard';
      return;
    }

    container.innerHTML =
      '<div class="page-content welcome-page">' +
        '<div class="welcome-header">' +
          '<div class="welcome-icon">🌟</div>' +
          '<div class="welcome-title">欢迎来到 AI懂我</div>' +
          '<div class="welcome-subtitle">请选择您的身份开始使用</div>' +
        '</div>' +
        '<div class="welcome-options">' +
          '<div class="welcome-option-card" id="opt-create">' +
            '<div class="welcome-option-icon">🏠</div>' +
            '<div class="welcome-option-title">创建心青年档案</div>' +
            '<div class="welcome-option-desc">我是孩子的父亲或母亲，需要为孩子建立档案</div>' +
          '</div>' +
          '<div class="welcome-option-card" id="opt-join">' +
            '<div class="welcome-option-icon">🔗</div>' +
            '<div class="welcome-option-title">加入已有家庭</div>' +
            '<div class="welcome-option-desc">我是祖父母、兄弟姐妹或其他亲属</div>' +
          '</div>' +
        '</div>' +
        // 创建档案表单（默认隐藏）
        '<div class="welcome-create-form" id="create-form" style="display:none;">' +
          '<div class="form-section">' +
            '<div class="form-section-title">基本信息</div>' +
            '<div class="form-group">' +
              '<label class="form-label">姓名/化名</label>' +
              '<input type="text" class="form-input" id="welcome-name" placeholder="输入心青年姓名" maxlength="50">' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">性别</label>' +
              '<div class="gender-selector" id="welcome-gender">' +
                '<div class="gender-option" data-gender="male"><div class="gender-icon">👦</div><div class="gender-label">男</div></div>' +
                '<div class="gender-option selected" data-gender="female"><div class="gender-icon">👧</div><div class="gender-label">女</div></div>' +
                '<div class="gender-option" data-gender="other"><div class="gender-icon">🧑</div><div class="gender-label">其他</div></div>' +
              '</div>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">年龄</label>' +
              '<input type="number" class="form-input" id="welcome-age" placeholder="输入年龄" min="0" max="100">' +
            '</div>' +
          '</div>' +
          '<div class="form-error" id="welcome-error" style="display:none;"></div>' +
          '<div class="row" style="gap:8px;">' +
            '<button class="btn btn-secondary" id="btn-welcome-back" style="flex:1;">返回</button>' +
            '<button class="btn btn-primary" id="btn-welcome-create" style="flex:1;">创建档案</button>' +
          '</div>' +
        '</div>' +
        // 加入家庭区域（默认隐藏）
        '<div class="welcome-join-section" id="join-section" style="display:none;">' +
          '<div class="welcome-join-option" id="btn-join-scan">' +
            '<div class="welcome-join-icon">📱</div>' +
            '<div class="welcome-join-body">' +
              '<div class="welcome-join-title">扫码加入</div>' +
              '<div class="welcome-join-desc">扫档案码加入家庭</div>' +
            '</div>' +
            '<span class="welcome-join-arrow">›</span>' +
          '</div>' +
          '<div class="welcome-join-option" id="btn-join-code">' +
            '<div class="welcome-join-icon">🔢</div>' +
            '<div class="welcome-join-body">' +
              '<div class="welcome-join-title">输入邀请码</div>' +
              '<div class="welcome-join-desc">输入 6 位邀请码加入</div>' +
            '</div>' +
            '<span class="welcome-join-arrow">›</span>' +
          '</div>' +
          '<button class="btn btn-secondary btn-block" id="btn-join-back" style="margin-top:16px;">返回</button>' +
        '</div>' +
      '</div>';

    _bindEvents();
  }

  function _bindEvents() {
    // 选择创建档案
    document.getElementById('opt-create').addEventListener('click', function () {
      document.querySelector('.welcome-options').style.display = 'none';
      document.getElementById('create-form').style.display = 'block';
    });

    // 选择加入家庭
    document.getElementById('opt-join').addEventListener('click', function () {
      document.querySelector('.welcome-options').style.display = 'none';
      document.getElementById('join-section').style.display = 'block';
    });

    // 返回主选择
    document.getElementById('btn-welcome-back').addEventListener('click', function () {
      document.getElementById('create-form').style.display = 'none';
      document.querySelector('.welcome-options').style.display = 'block';
    });

    document.getElementById('btn-join-back').addEventListener('click', function () {
      document.getElementById('join-section').style.display = 'none';
      document.querySelector('.welcome-options').style.display = 'block';
    });

    // 性别选择
    var genderOptions = document.querySelectorAll('#welcome-gender .gender-option');
    for (var i = 0; i < genderOptions.length; i++) {
      genderOptions[i].addEventListener('click', function () {
        var siblings = this.parentElement.querySelectorAll('.gender-option');
        for (var j = 0; j < siblings.length; j++) {
          siblings[j].classList.remove('selected');
        }
        this.classList.add('selected');
      });
    }

    // 创建档案
    document.getElementById('btn-welcome-create').addEventListener('click', _handleCreate);

    // 扫码加入
    document.getElementById('btn-join-scan').addEventListener('click', function () {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        _startScanCamera();
      } else {
        AppState.showToast('当前环境不支持扫码，请使用"输入邀请码"');
      }
    });

    // 输入邀请码
    document.getElementById('btn-join-code').addEventListener('click', function () {
      var code = prompt('请输入 6 位邀请码：');
      if (code) {
        _handleInvitationCode(code.trim());
      }
    });
  }

  function _handleCreate() {
    var nameEl = document.getElementById('welcome-name');
    var ageEl = document.getElementById('welcome-age');
    var errorEl = document.getElementById('welcome-error');

    var name = nameEl.value.trim();
    var age = parseInt(ageEl.value, 10);
    var selectedGender = document.querySelector('#welcome-gender .gender-option.selected');
    var gender = selectedGender ? selectedGender.getAttribute('data-gender') : 'female';

    if (!name) {
      errorEl.textContent = '请输入姓名';
      errorEl.style.display = 'block';
      return;
    }

    if (isNaN(age) || age < 0 || age > 100) {
      errorEl.textContent = '请输入有效的年龄（0-100）';
      errorEl.style.display = 'block';
      return;
    }

    errorEl.style.display = 'none';

    var birthDate = _ageToBirthDate(age);
    var avatar = gender === 'male' ? '🌻' : gender === 'female' ? '🌟' : '🎈';

    var now = Utils.formatDateTime();
    var profile = {
      id: Utils.generateUUID(),
      idNumber: null,
      name: name,
      gender: gender,
      birthDate: birthDate,
      avatar: avatar,
      lifeCycleStatus: 'active',
      currentGuardianId: AppState.currentUser.id,
      emergencyContacts: [],
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
      errorEl.textContent = '创建失败：' + (result.error || '未知错误');
      errorEl.style.display = 'block';
      return;
    }

    // 主监护人授权（relation 为 null，标记为监护人）
    var scope = Permissions.SCOPE_TEMPLATES.parent || [];
    var grant = {
      id: Utils.generateUUID(),
      youthId: profile.id,
      grantorId: AppState.currentUser.id,
      granteeId: AppState.currentUser.id,
      granteeRole: 'parent',
      scope: scope,
      relation: null,
      validFrom: now,
      validUntil: null,
      status: 'active',
      grantedAt: now,
      revokedAt: null,
      revokeReason: null
    };
    Storage.addAccessGrant(grant);

    AppState.showToast('档案创建成功！');
    AppState.selectYouth(profile.id);
    window.location.hash = 'dashboard';
  }

  function _handleInvitationCode(code) {
    if (!/^\d{6}$/.test(code)) {
      AppState.showToast('邀请码为 6 位数字');
      return;
    }

    Storage.cleanExpiredInvitations();
    var invitation = Storage.getInvitationByCode(code);
    if (!invitation) {
      AppState.showToast('邀请码不存在');
      return;
    }
    if (invitation.status !== 'active') {
      AppState.showToast('邀请码已失效');
      return;
    }

    window.location.hash = 'join?youthId=' + encodeURIComponent(invitation.youthId) + '&invitation=' + encodeURIComponent(code);
  }

  function _startScanCamera() {
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
                var parsed = ArchiveCode.parseArchiveUrl(code.data);
                if (parsed && parsed.youthId) {
                  window.location.hash = 'join?youthId=' + encodeURIComponent(parsed.youthId);
                } else {
                  AppState.showToast('无法识别档案码');
                }
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

  function _ageToBirthDate(age) {
    var now = new Date();
    var birthYear = now.getFullYear() - age;
    var birthDate = new Date(birthYear, now.getMonth(), now.getDate());
    return Utils.formatDate(birthDate);
  }

  return {
    renderWelcome: renderWelcome
  };
})();
```

- [ ] **Step 3.2: 修改 auth.js，家长注册后始终跳 welcome**

确认 `auth.js` 第 434-435 行：
```js
    } else if (account.role === 'parent') {
      window.location.hash = 'welcome';
```
这行已经存在，无需修改。

- [ ] **Step 3.3: 修改 grants.js**

1. `GRANTABLE_ROLES` 移除 `parent`：
```js
  var GRANTABLE_ROLES = ['teacher', 'caregiver', 'volunteer'];
```

2. `ROLE_PERMISSION_DESC` 中的 parent 描述可以保留（用于显示已有授权）。

3. `_showAddSheet` 函数中，在 Sheet 顶部添加"邀请家庭成员"入口（在 userOptions 之前）：
```js
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
```

4. 在 overlay.innerHTML 中插入 inviteSection（在 "选择用户" section 之前）。

5. 添加生成邀请码的点击事件绑定和函数：
```js
    var inviteBtn = document.getElementById('btn-invite-family');
    if (inviteBtn) {
      inviteBtn.addEventListener('click', function () {
        _generateInvitationCode(youth);
      });
    }
```

6. 添加 `_generateInvitationCode` 函数：
```js
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
          '<div class="invitation-code-display">' +
            '<div class="invitation-code">' + code + '</div>' +
            '<div class="invitation-code-hint">24 小时内有效</div>' +
          '</div>' +
          '<div class="invitation-code-desc">将此邀请码发送给家庭成员，对方注册家长账号后输入此邀请码即可申请加入。</div>' +
          '<button class="grants-sheet-confirm" id="btn-copy-code">复制邀请码</button>' +
          '<button class="btn btn-secondary btn-block" id="btn-close-code" style="margin-top:8px;">关闭</button>' +
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
```

7. 修改授权列表显示，家长角色显示关系或"监护人"：

在 `_renderModuleContent` 中（实际是 showGrants 中授权列表部分），找到 `isGuardian` 判断的位置，修改为：
```js
        var isGuardian = g.granteeRole === 'parent';
        var relationLabel = '';
        if (g.granteeRole === 'parent' && g.relation && Constants.FAMILY_RELATIONS[g.relation]) {
          relationLabel = Constants.FAMILY_RELATIONS[g.relation];
        } else if (g.granteeRole === 'parent') {
          relationLabel = '监护人';
        }
```
然后把显示标签从 `grant-guardian-tag` 改成显示关系。

8. 修改待审批申请显示，家长申请显示关系：

在待审批申请卡片中，meta 行添加关系显示（如果申请人是 parent 且有 relation 字段）。

- [ ] **Step 3.4: 修改 join-request.js，家长角色加关系选择**

1. 在 `_renderApplyForm` 中，如果用户角色是 `parent`，在申请理由之前添加关系选择：

```js
    var relationSection = '';
    if (user.role === 'parent') {
      relationSection =
        '<div class="join-card">' +
          '<div class="join-section-label">您与孩子的关系（必填）</div>' +
          '<div class="join-relation-selector" id="join-relation">';
      var relations = Constants.FAMILY_RELATION_LABELS || ['father', 'mother', 'grandfather', 'grandmother', 'brother', 'sister', 'other_guardian'];
      for (var i = 0; i < relations.length; i++) {
        var rKey = relations[i];
        var rLabel = Constants.FAMILY_RELATIONS[rKey] || rKey;
        relationSection +=
          '<div class="join-relation-option" data-relation="' + rKey + '">' +
            rLabel +
          '</div>';
      }
      relationSection +=
          '</div>' +
        '</div>';
    }
```

2. 在 form HTML 中插入 relationSection（申请理由卡片之前）。

3. 在 `_bindFormEvents` 中添加关系选择事件和提交验证：
```js
    // 关系选择（仅家长）
    var relationOptions = document.querySelectorAll('#join-relation .join-relation-option');
    for (var i = 0; i < relationOptions.length; i++) {
      relationOptions[i].addEventListener('click', function () {
        for (var j = 0; j < relationOptions.length; j++) {
          relationOptions[j].classList.remove('selected');
        }
        this.classList.add('selected');
      });
    }

    // 提交时验证关系（家长必填）
    var submitBtn = document.getElementById('btn-submit-join');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        var reason = reasonInput.value.trim();
        if (!reason) {
          AppState.showToast('请填写申请理由');
          return;
        }
        // 家长必须选关系
        var relation = null;
        if (user.role === 'parent') {
          var selected = document.querySelector('#join-relation .join-relation-option.selected');
          if (!selected) {
            AppState.showToast('请选择您与孩子的关系');
            return;
          }
          relation = selected.getAttribute('data-relation');
        }
        var request = {
          id: Utils.generateUUID(),
          youthId: youth.id,
          applicantId: user.id,
          applicantRole: user.role,
          relation: relation,
          reason: reason,
          status: 'pending',
          appliedAt: Utils.formatDateTime(),
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: null
        };
        // ... 后续逻辑不变
```

4. 修改 `_approveRequest` 在 grants.js 中，审批通过时把 relation 传给 grantAccess：

在 `_approveRequest` 函数中：
```js
    var relation = request.relation || null;
    var result = Permissions.grantAccess(youthId, request.applicantId, request.applicantRole, null, relation);
```

- [ ] **Step 3.5: 验证**

启动服务器，用家长账号注册测试：
1. 注册后看到选择页（创建档案 / 加入家庭）
2. 创建档案成功，进入首页
3. 在授权管理页，"添加授权"里没有其他家长
4. 生成邀请码成功
5. 另一个家长账号通过邀请码加入，关系选项必填
6. 主监护人审批通过后，授权列表显示关系标签

- [ ] **Step 3.6: Commit**

```bash
git add js/welcome.js js/grants.js js/join-request.js
git commit -m "feat: family authorization flow - welcome choice, invitation codes, relation selection"
```

---

## 任务 4：速读卡极简设计

**Files:**
- Modify: `js/quickcard.js`
- Modify: `css/main.css`（如果需要新增样式）

- [ ] **Step 1: 重写 quickcard.js**

将 `js/quickcard.js` 整个替换为以下内容：

```js
/**
 * quickcard.js - 速读卡（极简版）
 * 一页展示关键信息：基本信息、过敏源、行为红线、紧急联系人
 * iOS 风格紧凑卡片
 */
window.QuickCard = (function () {
  'use strict';

  function renderQuickCard(params) {
    var youthId = params.youthId;
    if (!youthId && AppState.currentYouth) {
      youthId = AppState.currentYouth.id;
    }
    if (!youthId) {
      var accessible = Permissions.getAccessibleYouths();
      if (accessible.length > 0) {
        youthId = accessible[0].id;
      } else {
        window.location.hash = 'dashboard';
        return;
      }
    }

    var youth = Storage.getProfile(youthId);
    if (!youth) {
      App.getContainer().innerHTML = '<div class="page-content"><div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">档案不存在</div></div></div>';
      return;
    }

    if (!AppState.currentYouth || AppState.currentYouth.id !== youthId) {
      AppState.selectYouth(youthId);
    }

    if (!Permissions.canRead()) {
      App.getContainer().innerHTML = '<div class="page-content"><div class="permission-denied"><div class="permission-denied-icon">🔒</div><div class="permission-denied-title">无访问权限</div></div></div>';
      return;
    }

    _renderQuickCard(youth);
  }

  function _renderQuickCard(youth) {
    var container = App.getContainer();
    var age = Utils.calculateAge(youth.birthDate);
    var genderLabel = youth.gender === 'male' ? '男' : youth.gender === 'female' ? '女' : '其他';
    var m = youth.modules;

    var html = '';

    // 顶部：关闭按钮 + 标题
    html +=
      '<div class="page-header">' +
        '<button class="btn btn-sm btn-icon" id="btn-close-quickcard">✕</button>' +
        '<span class="page-title">' + Utils.escapeHtml(youth.name) + ' · 速读卡</span>' +
        '<span></span>' +
      '</div>';

    html += '<div class="quickcard-page quickcard-compact">';

    // 1. 基本信息
    html +=
      '<div class="ios-card-group">' +
        '<div class="quickcard-item quickcard-basic">' +
          '<div class="quickcard-basic-avatar">' + (youth.avatar || '🧑') + '</div>' +
          '<div class="quickcard-basic-info">' +
            '<div class="quickcard-basic-name">' + Utils.escapeHtml(youth.name) + '</div>' +
            '<div class="quickcard-basic-meta">' + age + '岁 · ' + genderLabel + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // 2. 过敏源
    if (m.careMedical && m.careMedical.allergies && m.careMedical.allergies.length > 0) {
      html +=
        '<div class="ios-card-group">' +
          '<div class="quickcard-section-header">' +
            '<span class="quickcard-section-icon">⚠️</span>' +
            '<span class="quickcard-section-title">过敏源</span>' +
          '</div>' +
          '<div class="quickcard-item">' +
            '<div class="quickcard-item-text">' + m.careMedical.allergies.map(Utils.escapeHtml).join('、') + '</div>' +
          '</div>' +
        '</div>';
    }

    // 3. 行为红线
    if (m.emotionBehavior && m.emotionBehavior.behaviorRedLines && m.emotionBehavior.behaviorRedLines.length > 0) {
      html +=
        '<div class="ios-card-group">' +
          '<div class="quickcard-section-header">' +
            '<span class="quickcard-section-icon">🚫</span>' +
            '<span class="quickcard-section-title">行为红线</span>' +
          '</div>';
      for (var i = 0; i < m.emotionBehavior.behaviorRedLines.length; i++) {
        var r = m.emotionBehavior.behaviorRedLines[i];
        html +=
          '<div class="quickcard-item">' +
            '<div class="quickcard-item-text">' +
              '<strong>' + Utils.escapeHtml(r.description) + '</strong>' +
              (r.response ? '<br><span class="quickcard-item-sub">应对：' + Utils.escapeHtml(r.response) + '</span>' : '') +
            '</div>' +
          '</div>';
      }
      html += '</div>';
    }

    // 4. 紧急联系人（放最后）
    if (youth.emergencyContacts && youth.emergencyContacts.length > 0) {
      html +=
        '<div class="ios-card-group">' +
          '<div class="quickcard-section-header">' +
            '<span class="quickcard-section-icon">🚨</span>' +
            '<span class="quickcard-section-title">紧急联系人</span>' +
          '</div>';
      for (var i = 0; i < youth.emergencyContacts.length; i++) {
        var c = youth.emergencyContacts[i];
        html +=
          '<div class="quickcard-item">' +
            '<div class="quickcard-item-text">' +
              Utils.escapeHtml(c.name) + '（' + Utils.escapeHtml(c.relation || '') + '）' +
              '<br><span class="quickcard-item-sub">📞 ' + Utils.escapeHtml(c.phone) + '</span>' +
            '</div>' +
          '</div>';
      }
      html += '</div>';
    }

    // 底部：查看完整档案
    html +=
      '<div class="quickcard-footer">' +
        '<button class="btn btn-primary btn-block" id="btn-full-profile">查看完整档案 →</button>' +
      '</div>';

    html += '</div>';

    container.innerHTML = html;
    _bindEvents(youth);
  }

  function _bindEvents(youth) {
    document.getElementById('btn-close-quickcard').addEventListener('click', function () {
      history.back();
    });

    document.getElementById('btn-full-profile').addEventListener('click', function () {
      window.location.hash = 'profile?youthId=' + encodeURIComponent(youth.id);
    });
  }

  return {
    renderQuickCard: renderQuickCard
  };
})();
```

- [ ] **Step 2: 添加紧凑样式到 CSS**

在 `css/main.css` 末尾添加（或找到 quickcard 相关样式区域添加）：

```css
/* 速读卡极简版 */
.quickcard-compact {
  padding-bottom: 100px;
}

.quickcard-basic {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
}

.quickcard-basic-avatar {
  font-size: 32px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  border-radius: 12px;
}

.quickcard-basic-name {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.quickcard-basic-meta {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.quickcard-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.quickcard-section-icon {
  font-size: 14px;
}

.quickcard-item {
  padding: 10px 16px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text-primary);
}

.quickcard-item-sub {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.quickcard-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 16px;
  background: var(--color-bg-primary);
  border-top: 0.5px solid var(--color-border);
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
}
```

- [ ] **Step 3: 验证**

启动服务器，访问速读卡页面：
- 只有 4 个卡片：基本信息、过敏源、行为红线、紧急联系人
- 无标签切换
- 顶部是 ✕ 关闭按钮
- 底部是"查看完整档案"按钮
- 紧急联系人在最下面

- [ ] **Step 4: Commit**

```bash
git add js/quickcard.js css/main.css
git commit -m "feat(quickcard): compact single-page design with 4 key sections"
```

---

## 任务 5：底部导航从 6 减为 4 + 记录页合并对话

**Files:**
- Modify: `js/constants.js`（NAV_ITEMS）
- Modify: `js/records.js`（合并对话入口）
- Modify: `js/app.js`（首页健康速报加分析入口 + 路由注册）
- Modify: `js/analytics-ui.js`（确保分析页可从其他入口访问）

- [ ] **Step 5.1: 修改 constants.js NAV_ITEMS**

将 `NAV_ITEMS` 改为：
```js
  NAV_ITEMS: [
    { page: 'dashboard', icon: '🏠', label: '首页' },
    { page: 'records', icon: '📋', label: '记录' },
    { page: 'profile', icon: '📁', label: '档案' },
    { page: 'management', icon: '⚙️', label: '管理' }
  ],
```

- [ ] **Step 5.2: 在首页健康速报卡片加"查看详细分析"入口**

找到 `js/analytics-ui.js` 中的 `renderHealthCard` 函数，在卡片底部添加：
```js
    html +=
      '<div class="health-card-footer" style="padding: 10px 16px;border-top:0.5px solid var(--color-border);text-align:center;">' +
        '<a class="health-card-link" href="#analytics" style="font-size:13px;color:var(--color-accent);text-decoration:none;">查看详细分析 →</a>' +
      '</div>';
```
（如果 renderHealthCard 已经有返回结构，在返回前的最后一个 `</div>` 之前插入）

- [ ] **Step 5.3: 记录页顶部加对话采集入口**

在 `js/records.js` 的 `_renderRecordList` 函数中，页面顶部添加一个对话入口卡片（在记录列表之前）：
```js
    // 对话采集入口
    html +=
      '<div class="ios-card-group" style="margin-bottom:16px;">' +
        '<div class="record-chat-entry" data-action="chat" style="display:flex;align-items:center;padding:14px 16px;cursor:pointer;">' +
          '<div style="font-size:24px;margin-right:12px;">💬</div>' +
          '<div style="flex:1;">' +
            '<div style="font-size:15px;font-weight:600;color:var(--color-text-primary);">对话采集</div>' +
            '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">AI 对话式记录，边聊边记</div>' +
          '</div>' +
          '<span style="color:var(--color-text-tertiary);">›</span>' +
        '</div>' +
      '</div>';
```

在事件绑定中添加跳转：
```js
    var chatEntry = container.querySelector('[data-action="chat"]');
    if (chatEntry) {
      chatEntry.addEventListener('click', function () {
        window.location.hash = 'chat';
      });
    }
```

- [ ] **Step 5.4: 确认路由注册**

检查 `js/app.js` 中 `registerRoute` 部分，确保 `analytics`、`chat` 路由仍然存在（虽然不在底部导航，但可以通过链接访问）。

- [ ] **Step 5.5: 验证**

1. 底部导航显示 4 个 tab：首页 / 记录 / 档案 / 管理
2. 首页健康速报卡片有"查看详细分析 →"链接，点击跳分析页
3. 记录页顶部有对话采集入口，点击跳对话页
4. 档案页右上角速读卡按钮正常

- [ ] **Step 5.6: Commit**

```bash
git add js/constants.js js/records.js
git commit -m "feat(nav): reduce bottom nav to 4 tabs, merge chat into records, add analytics entry"
```

---

## 任务 6：独立页面返回按钮改为关闭按钮

**Files:**
- Modify: `js/grants.js`
- Modify: `js/archive-code.js`
- Modify: `js/quickcard.js`（任务 4 已处理，确认即可）

- [ ] **Step 6.1: 修改 grants.js 返回按钮**

将 `showGrants` 函数中的返回按钮：
```html
        '<button class="btn btn-sm btn-secondary" id="btn-grants-back">← 返回</button>' +
```
改为：
```html
        '<button class="btn btn-sm btn-icon" id="btn-grants-close">✕</button>' +
```

对应事件处理改为 `history.back()`：
```js
    var closeBtn = document.getElementById('btn-grants-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        history.back();
      });
    }
```

- [ ] **Step 6.2: 修改 archive-code.js 返回按钮**

在 `_renderExistingCode` 和 `_renderGeneratePrompt` 中，将返回按钮改为 ✕ 关闭按钮，事件改为 `history.back()`。

- [ ] **Step 6.3: 确认 quickcard.js**

任务 4 已经处理，确认即可。

- [ ] **Step 6.4: 验证**

1. 进入授权管理页，点 ✕ 返回上一页
2. 进入档案码页，点 ✕ 返回上一页
3. 进入速读卡，点 ✕ 返回上一页

- [ ] **Step 6.5: Commit**

```bash
git add js/grants.js js/archive-code.js
git commit -m "feat(ui): replace back buttons with close buttons on secondary pages"
```

---

## 总体验证

- [ ] **端到端测试**

用所有角色账号测试：
1. 家长注册 → 创建档案 → 生成邀请码 → 审批加入
2. 家庭成员通过邀请码加入 → 选择关系 → 审批通过 → 看到档案但不能管理授权
3. 老师/照护者/志愿者 → 扫码加入 → 正常
4. 速读卡 → 4 个卡片 → 关闭正常
5. 底部导航 4 个 tab → 都能正常切换
6. 首页健康速报 → 查看详细分析 → 跳转正常
7. 记录页 → 对话采集入口 → 跳转正常
