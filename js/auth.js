/**
 * auth.js - 登录/注册/角色管理
 * 6 种角色注册流程、PIN 码登录、表单 UI 渲染
 */
window.Auth = (function () {
  'use strict';

  // 6 种角色定义 — 复用 Constants.ROLES（唯一定义源）
  var ROLES = Constants.ROLES;

  // 注册流程状态
  var _regState = {
    step: 0,
    role: null,
    name: '',
    phone: '',
    institutionName: '',
    pin: ''
  };

  /**
   * 渲染单个快速登录项
   */
  function _renderQuickLoginItem(acc) {
    var roleInfo = ROLES.find(function (r) { return r.value === acc.role; });
    return '<div class="quick-login-item" data-account-id="' + acc.id + '">' +
      '<div class="quick-login-info">' +
        '<span class="role-icon" style="font-size:20px;">' + (roleInfo ? roleInfo.icon : '👤') + '</span>' +
        '<div>' +
          '<div class="quick-login-name">' + Utils.escapeHtml(acc.name) + '</div>' +
          '<div class="quick-login-role">' + (roleInfo ? roleInfo.label : acc.role) + '</div>' +
        '</div>' +
      '</div>' +
      '<span class="badge badge-' + acc.role + '">登录</span>' +
    '</div>';
  }

  /**
   * 渲染登录页
   */
  function renderLogin(params) {
    var container = App.getContainer();
    var accounts = Storage.getAccounts();
    var accountList = [];
    for (var id in accounts) {
      if (accounts[id].isActive) {
        accountList.push(accounts[id]);
      }
    }

    var quickLoginHtml = '';
    if (accountList.length > 0) {
      // 家庭分组定义
      var mingFamilyNames = ['小明爸爸', '小明妈妈', '小明保姆', '小明'];
      var huaFamilyNames = ['小花爸爸', '小花妈妈', '小花保姆', '小花'];
      var mingGroup = accountList.filter(function (a) { return mingFamilyNames.indexOf(a.name) !== -1; });
      var huaGroup = accountList.filter(function (a) { return huaFamilyNames.indexOf(a.name) !== -1; });
      var otherAccounts = accountList.filter(function (a) {
        return mingFamilyNames.indexOf(a.name) === -1 && huaFamilyNames.indexOf(a.name) === -1;
      });

      quickLoginHtml = '<div class="quick-login">' +
        '<div class="quick-login-title">— 快速登录（测试账号）—</div>';

      // 两家庭混合并排：每行左边小明家，右边小花家
      var maxLen = Math.max(mingGroup.length, huaGroup.length);
      quickLoginHtml += '<div class="quick-login-family-grid">';
      for (var i = 0; i < maxLen; i++) {
        var left = mingGroup[i] ? _renderQuickLoginItem(mingGroup[i]) : '<div class="quick-login-item quick-login-item-empty"></div>';
        var right = huaGroup[i] ? _renderQuickLoginItem(huaGroup[i]) : '<div class="quick-login-item quick-login-item-empty"></div>';
        quickLoginHtml += '<div class="quick-login-family-row">' + left + right + '</div>';
      }
      quickLoginHtml += '</div>';

      // 其他账号 — 单列
      if (otherAccounts.length > 0) {
        quickLoginHtml += '<div class="quick-login-list">';
        for (var i = 0; i < otherAccounts.length; i++) {
          quickLoginHtml += _renderQuickLoginItem(otherAccounts[i]);
        }
        quickLoginHtml += '</div>';
      }

      quickLoginHtml += '</div>';
    }

    container.innerHTML =
      '<div class="auth-page">' +
        '<div class="auth-container">' +
          '<div class="auth-header">' +
            '<div class="auth-title">AI懂我</div>' +
            '<div class="auth-subtitle">心智障碍者动态支持档案</div>' +
          '</div>' +
          '<div class="auth-body">' +
            '<div class="form-group">' +
              '<label class="form-label">用户名</label>' +
              '<input type="text" class="form-input" id="login-name" placeholder="输入用户名" autocomplete="off">' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">PIN 码</label>' +
              '<input type="password" class="form-input" id="login-pin" placeholder="输入 4-6 位 PIN 码" maxlength="6" inputmode="numeric">' +
            '</div>' +
            '<div class="form-error" id="login-error" style="display:none;"></div>' +
            '<button class="btn btn-primary btn-block btn-lg" id="btn-login" style="margin-top:16px;">登录</button>' +
            quickLoginHtml +
            '<div class="auth-switch">还没有账号？<a id="link-register">立即注册</a></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // 绑定事件
    document.getElementById('btn-login').addEventListener('click', _handleLogin);
    document.getElementById('login-pin').addEventListener('keypress', function (e) {
      if (e.key === 'Enter') _handleLogin();
    });
    document.getElementById('link-register').addEventListener('click', function () {
      window.location.hash = 'register';
    });

    // 快速登录
    var quickItems = container.querySelectorAll('.quick-login-item');
    for (var i = 0; i < quickItems.length; i++) {
      quickItems[i].addEventListener('click', function () {
        var accountId = this.getAttribute('data-account-id');
        var acc = Storage.getAccount(accountId);
        if (acc) {
          document.getElementById('login-name').value = acc.name;
          document.getElementById('login-pin').value = '1234';
          _handleLogin();
        }
      });
    }
  }

  /**
   * 处理登录
   */
  async function _handleLogin() {
    var name = document.getElementById('login-name').value.trim();
    var pin = document.getElementById('login-pin').value.trim();
    var errorEl = document.getElementById('login-error');

    if (!name || !pin) {
      errorEl.textContent = '请输入用户名和 PIN 码';
      errorEl.style.display = 'block';
      return;
    }

    // 查找账户
    var accounts = Storage.getAccounts();
    var account = null;
    for (var id in accounts) {
      if (accounts[id].name === name && accounts[id].isActive) {
        account = accounts[id];
        break;
      }
    }

    if (!account) {
      errorEl.textContent = '用户名不存在';
      errorEl.style.display = 'block';
      return;
    }

    // 验证 PIN
    var pinHash = await Utils.hashPin(pin);
    if (pinHash !== account.pinHash) {
      errorEl.textContent = 'PIN 码不正确';
      errorEl.style.display = 'block';
      return;
    }

    // 登录成功
    errorEl.style.display = 'none';
    AppState.login(account);

    // 政府角色跳转政府看板，心青年跳转对话页，管理员跳转管理页，其他跳转 dashboard
    if (account.role === 'government') {
      window.location.hash = 'government';
    } else if (account.role === 'youth') {
      window.location.hash = 'youth-chat';
    } else if (account.role === 'admin') {
      window.location.hash = 'admin';
    } else {
      window.location.hash = 'dashboard';
    }
  }

  /**
   * 渲染注册页
   */
  function renderRegister(params) {
    var container = App.getContainer();
    _regState = { step: 0, role: null, name: '', phone: '', institutionName: '', pin: '' };

    container.innerHTML =
      '<div class="auth-page">' +
        '<div class="auth-container">' +
          '<div class="auth-header">' +
            '<div class="auth-logo">🌟</div>' +
            '<div class="auth-title">注册账号</div>' +
            '<div class="auth-subtitle">选择您的角色开始</div>' +
          '</div>' +
          '<div class="auth-body">' +
            '<div class="step-indicator">' +
              '<div class="step-dot active" id="dot-0"></div>' +
              '<div class="step-dot" id="dot-1"></div>' +
              '<div class="step-dot" id="dot-2"></div>' +
            '</div>' +
            // 步骤1: 角色选择
            '<div class="auth-step active" id="step-0">' +
              '<div class="role-grid" id="role-grid"></div>' +
              '<div class="role-description" id="role-desc">请选择您的角色</div>' +
              '<button class="btn btn-primary btn-block" id="btn-step0-next" disabled>下一步</button>' +
            '</div>' +
            // 步骤2: 个人信息
            '<div class="auth-step" id="step-1">' +
              '<div class="form-group">' +
                '<label class="form-label">姓名/昵称</label>' +
                '<input type="text" class="form-input" id="reg-name" placeholder="输入您的姓名" maxlength="100">' +
              '</div>' +
              '<div class="form-group">' +
                '<label class="form-label">手机号（选填）</label>' +
                '<input type="tel" class="form-input" id="reg-phone" placeholder="输入手机号" maxlength="11">' +
              '</div>' +
              '<div class="form-group" id="institution-group" style="display:none;">' +
                '<label class="form-label">所属机构名称</label>' +
                '<input type="text" class="form-input" id="reg-institution" placeholder="输入机构名称">' +
              '</div>' +
              '<div class="form-error" id="step1-error" style="display:none;"></div>' +
              '<div class="row" style="gap:8px;">' +
                '<button class="btn btn-secondary" id="btn-step1-prev" style="flex:1;">上一步</button>' +
                '<button class="btn btn-primary" id="btn-step1-next" style="flex:1;">下一步</button>' +
              '</div>' +
            '</div>' +
            // 步骤3: PIN设置
            '<div class="auth-step" id="step-2">' +
              '<div class="text-center" style="text-align:center;margin-bottom:16px;">' +
                '<div style="font-size:14px;color:var(--color-text-secondary);">请设置 4-6 位 PIN 码</div>' +
                '<div style="font-size:12px;color:var(--color-text-tertiary);margin-top:4px;">用于登录验证</div>' +
              '</div>' +
              '<div class="pin-input-wrapper" id="pin-input-wrapper">' +
                '<input type="password" class="pin-digit" maxlength="1" data-pin-index="0">' +
                '<input type="password" class="pin-digit" maxlength="1" data-pin-index="1">' +
                '<input type="password" class="pin-digit" maxlength="1" data-pin-index="2">' +
                '<input type="password" class="pin-digit" maxlength="1" data-pin-index="3">' +
                '<input type="password" class="pin-digit" maxlength="1" data-pin-index="4">' +
                '<input type="password" class="pin-digit" maxlength="1" data-pin-index="5">' +
              '</div>' +
              '<div class="form-error" id="step2-error" style="display:none;"></div>' +
              '<div class="row" style="gap:8px;margin-top:16px;">' +
                '<button class="btn btn-secondary" id="btn-step2-prev" style="flex:1;">上一步</button>' +
                '<button class="btn btn-primary" id="btn-step2-submit" style="flex:1;">完成注册</button>' +
              '</div>' +
            '</div>' +
            '<div class="auth-switch">已有账号？<a id="link-login">返回登录</a></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    _renderRoleGrid();
    _bindRegisterEvents();
  }

  /**
   * 渲染角色选择网格
   */
  function _renderRoleGrid() {
    var grid = document.getElementById('role-grid');
    var html = '';
    for (var i = 0; i < ROLES.length; i++) {
      var role = ROLES[i];
      html += '<div class="role-card" data-role="' + role.value + '">' +
        '<div class="role-icon">' + role.icon + '</div>' +
        '<div class="role-name">' + role.label + '</div>' +
      '</div>';
    }
    grid.innerHTML = html;

    var cards = grid.querySelectorAll('.role-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', function () {
        // 移除其他选中
        var allCards = grid.querySelectorAll('.role-card');
        for (var j = 0; j < allCards.length; j++) {
          allCards[j].classList.remove('selected');
        }
        this.classList.add('selected');
        _regState.role = this.getAttribute('data-role');
        var roleInfo = ROLES.find(function (r) { return r.value === _regState.role; });
        document.getElementById('role-desc').textContent = roleInfo.desc;
        document.getElementById('btn-step0-next').disabled = false;
      });
    }
  }

  /**
   * 绑定注册事件
   */
  function _bindRegisterEvents() {
    // 步骤1 → 步骤2
    document.getElementById('btn-step0-next').addEventListener('click', function () {
      _goToStep(1);
      // teacher 角色显示机构字段
      if (_regState.role === 'teacher') {
        document.getElementById('institution-group').style.display = 'block';
      }
    });

    // 步骤2 → 步骤1
    document.getElementById('btn-step1-prev').addEventListener('click', function () {
      _goToStep(0);
    });

    // 步骤2 → 步骤3
    document.getElementById('btn-step1-next').addEventListener('click', function () {
      var name = document.getElementById('reg-name').value.trim();
      var errorEl = document.getElementById('step1-error');

      if (!name) {
        errorEl.textContent = '请输入姓名';
        errorEl.style.display = 'block';
        return;
      }

      if (_regState.role === 'teacher') {
        var institution = document.getElementById('reg-institution').value.trim();
        if (!institution) {
          errorEl.textContent = '老师角色需要填写机构名称';
          errorEl.style.display = 'block';
          return;
        }
        _regState.institutionName = institution;
      }

      // 检查重复（同名+同角色）
      var accounts = Storage.getAccounts();
      for (var id in accounts) {
        if (accounts[id].name === name && accounts[id].role === _regState.role) {
          errorEl.textContent = '该角色下已存在同名用户';
          errorEl.style.display = 'block';
          return;
        }
      }

      _regState.name = name;
      _regState.phone = document.getElementById('reg-phone').value.trim();
      errorEl.style.display = 'none';
      _goToStep(2);
    });

    // PIN 输入框自动跳转
    var pinInputs = document.querySelectorAll('.pin-digit');
    for (var i = 0; i < pinInputs.length; i++) {
      pinInputs[i].addEventListener('input', function () {
        if (this.value && parseInt(this.getAttribute('data-pin-index'), 10) < 5) {
          var nextIdx = parseInt(this.getAttribute('data-pin-index'), 10) + 1;
          var next = document.querySelector('.pin-digit[data-pin-index="' + nextIdx + '"]');
          if (next) next.focus();
        }
      });
      pinInputs[i].addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !this.value) {
          var prevIdx = parseInt(this.getAttribute('data-pin-index'), 10) - 1;
          if (prevIdx >= 0) {
            var prev = document.querySelector('.pin-digit[data-pin-index="' + prevIdx + '"]');
            if (prev) prev.focus();
          }
        }
      });
    }

    // 步骤3 → 步骤2
    document.getElementById('btn-step2-prev').addEventListener('click', function () {
      _goToStep(1);
    });

    // 提交注册
    document.getElementById('btn-step2-submit').addEventListener('click', _handleSubmitRegister);

    // 返回登录
    document.getElementById('link-login').addEventListener('click', function () {
      window.location.hash = 'login';
    });
  }

  /**
   * 切换注册步骤
   */
  function _goToStep(step) {
    _regState.step = step;
    for (var i = 0; i < 3; i++) {
      var stepEl = document.getElementById('step-' + i);
      var dotEl = document.getElementById('dot-' + i);
      if (i === step) {
        stepEl.classList.add('active');
        dotEl.classList.add('active');
      } else {
        stepEl.classList.remove('active');
        dotEl.classList.remove('active');
      }
      if (i < step) {
        dotEl.classList.add('completed');
      } else {
        dotEl.classList.remove('completed');
      }
    }
  }

  /**
   * 处理注册提交
   */
  async function _handleSubmitRegister() {
    var errorEl = document.getElementById('step2-error');

    // 收集 PIN
    var pin = '';
    var pinInputs = document.querySelectorAll('.pin-digit');
    for (var i = 0; i < pinInputs.length; i++) {
      if (pinInputs[i].value) {
        pin += pinInputs[i].value;
      }
    }

    if (pin.length < 4 || pin.length > 6) {
      errorEl.textContent = 'PIN 码需要 4-6 位数字';
      errorEl.style.display = 'block';
      return;
    }

    if (!/^\d+$/.test(pin)) {
      errorEl.textContent = 'PIN 码只能包含数字';
      errorEl.style.display = 'block';
      return;
    }

    errorEl.style.display = 'none';

    // 创建账户
    var pinHash = await Utils.hashPin(pin);
    var account = {
      id: Utils.generateUUID(),
      name: _regState.name,
      phone: _regState.phone || null,
      role: _regState.role,
      pinHash: pinHash,
      institutionName: _regState.institutionName || null,
      registeredAt: Utils.formatDateTime(),
      lastLoginAt: null,
      isActive: true
    };

    var result = Storage.saveAccount(account);
    if (!result.success) {
      errorEl.textContent = '注册失败：' + result.error;
      errorEl.style.display = 'block';
      return;
    }

    // 注册成功，自动登录
    AppState.login(account);
    AppState.showToast('注册成功！欢迎使用 AI懂我');

    // 按角色跳转
    if (account.role === 'government') {
      window.location.hash = 'government';
    } else if (account.role === 'admin') {
      window.location.hash = 'admin';
    } else if (account.role === 'parent') {
      window.location.hash = 'welcome';
    } else if (account.role === 'youth') {
      window.location.hash = 'youth-chat';
    } else {
      window.location.hash = 'dashboard';
    }
  }

  return {
    ROLES: ROLES,
    renderLogin: renderLogin,
    renderRegister: renderRegister
  };
})();
