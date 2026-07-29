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
