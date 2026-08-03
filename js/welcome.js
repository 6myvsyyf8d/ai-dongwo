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
        '<div class="welcome-join-section" id="join-section" style="display:none;">' +
          '<div class="welcome-join-option" id="btn-join-scan" style="display:flex;align-items:center;padding:14px 16px;background:var(--color-bg-secondary);border-radius:12px;cursor:pointer;margin-bottom:12px;">' +
            '<div style="font-size:24px;margin-right:12px;">📱</div>' +
            '<div style="flex:1;">' +
              '<div style="font-size:15px;font-weight:600;color:var(--color-text-primary);">扫码加入</div>' +
              '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">扫档案码加入家庭</div>' +
            '</div>' +
            '<span style="color:var(--color-text-tertiary);">›</span>' +
          '</div>' +
          '<div class="welcome-join-option" id="btn-join-code" style="display:flex;align-items:center;padding:14px 16px;background:var(--color-bg-secondary);border-radius:12px;cursor:pointer;">' +
            '<div style="font-size:24px;margin-right:12px;">🔢</div>' +
            '<div style="flex:1;">' +
              '<div style="font-size:15px;font-weight:600;color:var(--color-text-primary);">输入邀请码</div>' +
              '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">输入 6 位邀请码加入</div>' +
            '</div>' +
            '<span style="color:var(--color-text-tertiary);">›</span>' +
          '</div>' +
          '<button class="btn btn-secondary btn-block" id="btn-join-back" style="margin-top:16px;">返回</button>' +
        '</div>' +
      '</div>';

    _bindEvents();
  }

  function _bindEvents() {
    document.getElementById('opt-create').addEventListener('click', function () {
      document.querySelector('.welcome-options').style.display = 'none';
      document.getElementById('create-form').style.display = 'block';
    });

    document.getElementById('opt-join').addEventListener('click', function () {
      document.querySelector('.welcome-options').style.display = 'none';
      document.getElementById('join-section').style.display = 'block';
    });

    document.getElementById('btn-welcome-back').addEventListener('click', function () {
      document.getElementById('create-form').style.display = 'none';
      document.querySelector('.welcome-options').style.display = 'block';
    });

    document.getElementById('btn-join-back').addEventListener('click', function () {
      document.getElementById('join-section').style.display = 'none';
      document.querySelector('.welcome-options').style.display = 'block';
    });

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

    document.getElementById('btn-welcome-create').addEventListener('click', _handleCreate);

    document.getElementById('btn-join-scan').addEventListener('click', function () {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        _startScanCamera();
      } else {
        AppState.showToast('当前环境不支持扫码，请使用"输入邀请码"');
      }
    });

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
        workSupport: { ispPlans: [], capabilityAssessment: null, workPreferences: [], favoriteActivities: [], favoritePlaces: [], futureWishes: [] }
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
