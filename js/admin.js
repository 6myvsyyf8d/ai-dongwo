/**
 * admin.js - 系统管理员页面
 * 用户管理、全局授权管理
 * 依赖：Storage、AppState、Constants、Utils、Grants、App
 */
window.Admin = (function () {
  'use strict';

  /**
   * 渲染管理员页面入口
   * 非管理员访问时重定向回主页
   */
  function showAdmin() {
    var user = AppState.currentUser;
    if (!user || user.role !== 'admin') {
      window.location.hash = 'dashboard';
      return;
    }

    var container = App.getContainer();
    container.innerHTML =
      '<div class="page-header">' +
        '<span class="page-title">🛡️ 系统管理</span>' +
        '<span></span>' +
      '</div>' +
      '<div class="page-content">' +
        '<div class="admin-tabs">' +
          '<button class="admin-tab active" data-tab="users">👥 用户管理</button>' +
          '<button class="admin-tab" data-tab="grants">🔑 全局授权</button>' +
          '<button class="admin-tab" data-tab="visibility">👁️ 可见性配置</button>' +
        '</div>' +
        '<div id="admin-content"></div>' +
      '</div>';

    _renderUsersTab();
    _bindTabs();
  }

  /**
   * 绑定 Tab 切换
   */
  function _bindTabs() {
    var tabs = document.querySelectorAll('.admin-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        var tab = this.getAttribute('data-tab');
        for (var j = 0; j < tabs.length; j++) {
          tabs[j].classList.toggle('active', tabs[j].getAttribute('data-tab') === tab);
        }
        if (tab === 'users') {
          _renderUsersTab();
        } else if (tab === 'grants') {
          _renderGrantsTab();
        } else if (tab === 'visibility') {
          _renderVisibilityTab();
        }
      });
    }
  }

  /**
   * 渲染用户管理 Tab
   * 按角色优先级排序：admin→0, parent→1, teacher→2, caregiver→3, youth→4, government→5
   */
  function _renderUsersTab() {
    var content = document.getElementById('admin-content');
    if (!content) return;

    var accounts = Storage.getAccounts();
    var userList = [];
    for (var id in accounts) {
      if (accounts[id]) {
        userList.push(accounts[id]);
      }
    }

    var roleOrder = { admin: 0, parent: 1, teacher: 2, caregiver: 3, youth: 4, government: 5 };
    userList.sort(function (a, b) {
      return (roleOrder[a.role] !== undefined ? roleOrder[a.role] : 99) - (roleOrder[b.role] !== undefined ? roleOrder[b.role] : 99);
    });

    var html = '<div class="admin-user-count">共 ' + userList.length + ' 个用户</div>';

    for (var i = 0; i < userList.length; i++) {
      var u = userList[i];
      var roleLabel = Constants.ROLE_LABELS[u.role] || u.role;
      var isActive = u.isActive !== false;
      var statusClass = isActive ? 'active' : 'disabled';
      var statusText = isActive ? '正常' : '已禁用';
      var metaText = roleLabel + (u.institutionName ? ' · ' + Utils.escapeHtml(u.institutionName) : '');

      html += '<div class="admin-user-item" data-user-id="' + u.id + '">' +
        '<div class="admin-user-avatar">' + _getRoleIcon(u.role) + '</div>' +
        '<div class="admin-user-body">' +
          '<div class="admin-user-name">' + Utils.escapeHtml(u.name) + '</div>' +
          '<div class="admin-user-meta">' + metaText + '</div>' +
        '</div>' +
        '<span class="admin-user-status ' + statusClass + '">' + statusText + '</span>' +
        (u.role !== 'admin'
          ? '<button class="admin-user-toggle" data-user-id="' + u.id + '" data-active="' + isActive + '">' + (isActive ? '禁用' : '启用') + '</button>'
          : '') +
      '</div>';
    }

    content.innerHTML = html;
    _bindUserToggleButtons();
  }

  /**
   * 绑定用户启用/禁用切换按钮
   * 从 data 属性读取当前状态，写入 accounts 后重新渲染
   */
  function _bindUserToggleButtons() {
    var btns = document.querySelectorAll('.admin-user-toggle');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var userId = this.getAttribute('data-user-id');
        var isActive = this.getAttribute('data-active') === 'true';
        var accounts = Storage.getAccounts();
        if (accounts[userId]) {
          accounts[userId].isActive = !isActive;
          Storage.set('ai_dongwo_accounts', accounts);
          _renderUsersTab();
        }
      });
    }
  }

  /**
   * 渲染全局授权 Tab
   * 列出所有心青年，点击进入对应授权管理
   */
  function _renderGrantsTab() {
    var content = document.getElementById('admin-content');
    if (!content) return;

    var profiles = Storage.getProfiles();
    var html = '<div class="admin-grants-header">选择心青年管理授权</div>';

    for (var id in profiles) {
      var p = profiles[id];
      if (!p) continue;
      var age = Utils.calculateAge(p.birthDate);
      var lifecycleLabel = Constants.LIFECYCLE_LABELS[p.lifeCycleStatus] || p.lifeCycleStatus || '';

      html += '<div class="admin-grant-youth" data-youth-id="' + p.id + '">' +
        '<div class="admin-grant-youth-avatar">' + (p.avatar || '🧑') + '</div>' +
        '<div class="admin-grant-youth-body">' +
          '<div class="admin-grant-youth-name">' + Utils.escapeHtml(p.name) + '</div>' +
          '<div class="admin-grant-youth-meta">' + age + '岁 · ' + Utils.escapeHtml(lifecycleLabel) + '</div>' +
        '</div>' +
        '<span class="admin-grant-youth-arrow">›</span>' +
      '</div>';
    }

    content.innerHTML = html;

    var rows = content.querySelectorAll('.admin-grant-youth');
    for (var i = 0; i < rows.length; i++) {
      rows[i].addEventListener('click', function () {
        var youthId = this.getAttribute('data-youth-id');
        if (!youthId) return;
        AppState.selectYouth(youthId);
        Grants.showGrants(youthId);
      });
    }
  }

  /**
   * 渲染可见性配置 Tab
   * 配置每个角色可访问的页面和档案模块
   */
  function _renderVisibilityTab() {
    var content = document.getElementById('admin-content');
    var config = Storage.getVisibilityConfig();
    var roles = [
      { key: 'parent', label: '👨‍👩‍👧 家长', icon: '👨‍👩‍👧' },
      { key: 'teacher', label: '👩‍🏫 老师', icon: '👩‍🏫' },
      { key: 'caregiver', label: '🤝 照护者', icon: '🤝' },
      { key: 'youth', label: '🌻 心青年', icon: '🌻' },
      { key: 'government', label: '🏛️ 政府', icon: '🏛️' },
      { key: 'admin', label: '🛡️ 管理员', icon: '🛡️' }
    ];
    var pages = [
      { key: 'dashboard', label: '首页' },
      { key: 'records', label: '记录' },
      { key: 'profile', label: '档案' },
      { key: 'quickcard', label: '速读卡' },
      { key: 'management', label: '管理' },
      { key: 'analytics', label: '分析' },
      { key: 'government', label: '政府看板' },
      { key: 'admin', label: '系统管理' }
    ];
    // 档案模块从 Modules.MODULES 获取
    var modules = (window.Modules && window.Modules.MODULES) || [];

    var html = '<div class="visibility-config">';
    html += '<div class="visibility-intro" style="font-size:13px;color:var(--color-text-secondary,#a0a0b8);margin-bottom:12px;">勾选每个角色可访问的页面和档案模块，保存后即时生效。</div>';

    for (var ri = 0; ri < roles.length; ri++) {
      var role = roles[ri];
      var allowedPages = (config.pages && config.pages[role.key]) || [];
      var allowedModules = (config.modules && config.modules[role.key]) || [];

      html += '<div class="visibility-role-card" style="background:var(--color-card,#fff);border-radius:16px;padding:16px;margin-bottom:12px;">';
      html += '<div style="font-size:16px;font-weight:600;margin-bottom:10px;">' + role.label + '</div>';

      // 页面勾选
      html += '<div style="font-size:12px;font-weight:600;color:var(--color-text-secondary,#a0a0b8);margin-bottom:6px;">可访问页面</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">';
      for (var pi = 0; pi < pages.length; pi++) {
        var checked = allowedPages.indexOf(pages[pi].key) > -1 ? 'checked' : '';
        html += '<label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;">' +
          '<input type="checkbox" class="vis-page-cb" data-role="' + role.key + '" data-page="' + pages[pi].key + '" ' + checked + ' style="width:16px;height:16px;">' +
          '<span>' + pages[pi].label + '</span></label>';
      }
      html += '</div>';

      // 模块勾选
      html += '<div style="font-size:12px;font-weight:600;color:var(--color-text-secondary,#a0a0b8);margin-bottom:6px;">档案可见模块</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
      for (var mi = 0; mi < modules.length; mi++) {
        var mchecked = allowedModules.indexOf(modules[mi].key) > -1 ? 'checked' : '';
        html += '<label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;">' +
          '<input type="checkbox" class="vis-module-cb" data-role="' + role.key + '" data-module="' + modules[mi].key + '" ' + mchecked + ' style="width:16px;height:16px;">' +
          '<span>' + modules[mi].icon + ' ' + modules[mi].label + '</span></label>';
      }
      html += '</div>';

      html += '</div>';
    }

    html += '<button class="btn btn-primary" id="vis-save-btn" style="width:100%;padding:14px;font-size:16px;border-radius:14px;border:none;">💾 保存配置</button>';
    html += '</div>';

    content.innerHTML = html;

    // 绑定保存
    document.getElementById('vis-save-btn').addEventListener('click', function() {
      var newConfig = { pages: {}, modules: {} };
      for (var ri2 = 0; ri2 < roles.length; ri2++) {
        var rk = roles[ri2].key;
        newConfig.pages[rk] = [];
        newConfig.modules[rk] = [];
      }
      var pageCBs = document.querySelectorAll('.vis-page-cb');
      for (var i = 0; i < pageCBs.length; i++) {
        if (pageCBs[i].checked) {
          var rp = pageCBs[i].getAttribute('data-role');
          var pp = pageCBs[i].getAttribute('data-page');
          newConfig.pages[rp].push(pp);
        }
      }
      var moduleCBs = document.querySelectorAll('.vis-module-cb');
      for (var j = 0; j < moduleCBs.length; j++) {
        if (moduleCBs[j].checked) {
          var rm = moduleCBs[j].getAttribute('data-role');
          var mm = moduleCBs[j].getAttribute('data-module');
          newConfig.modules[rm].push(mm);
        }
      }
      Storage.saveVisibilityConfig(newConfig);
      AppState.showToast('✅ 可见性配置已保存');
    });
  }

  /**
   * 从 Constants.ROLES 查询角色图标
   * 不使用本地字典，保持唯一数据源
   */
  function _getRoleIcon(role) {
    for (var i = 0; i < Constants.ROLES.length; i++) {
      if (Constants.ROLES[i].value === role) {
        return Constants.ROLES[i].icon;
      }
    }
    return '👤';
  }

  return {
    showAdmin: showAdmin
  };
})();
