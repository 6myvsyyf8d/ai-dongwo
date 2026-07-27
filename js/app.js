/**
 * app.js - 主入口：路由、初始化、导航
 * 负责模块初始化顺序、hash 路由分发、导航守卫
 * Apple tab bar 风格底部导航
 */
(function () {
  'use strict';

  // 不需要登录即可访问的页面
  var PUBLIC_PAGES = ['login', 'register'];
  var NO_BOTTOM_NAV_PAGES = ['login', 'register', 'government'];

  // 交接任务状态常量
  var TASK_STATUS = {
    pending: '待处理',
    done: '已完成'
  };
  var TASK_STATUS_ORDER = ['pending', 'done'];

  // 交接任务状态流转
  function _nextTaskStatus(current) {
    if (current === 'pending') return 'done';
    return 'pending';
  }

  // 路由 → 渲染函数映射（后续模块加载后注册）
  // 交接任务折叠状态（保持跨刷新）
  var _handoverOpenSections = { my: true, other: false };

  // 路由 → 渲染函数映射（后续模块加载后注册）
  var routes = {};

  /**
   * 注册路由渲染函数
   * @param {string} page - 页面名
   * @param {Function} fn - 渲染函数 fn(params)
   */
  function registerRoute(page, fn) {
    routes[page] = fn;
  }

  /**
   * 解析当前 hash，返回页面名和参数
   * 支持格式：
   *   #page?key=value&key2=value2
   *   #archive/{youthId}?token={HMAC}  （档案码扫码访问）
   * @returns {{ page: string, params: object }}
   */
  function parseHash() {
    var hash = window.location.hash.slice(1) || 'login';
    var parts = hash.split('?');
    var path = parts[0] || 'login';
    var params = {};

    if (parts[1]) {
      var pairs = parts[1].split('&');
      for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split('=');
        if (pair[0]) {
          params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
        }
      }
    }

    // 处理 archive/{youthId} 路由
    if (path.indexOf('archive/') === 0) {
      var youthId = path.substring(8);
      return { page: 'archive', params: { youthId: youthId, token: params.token || null } };
    }

    return { page: path, params: params };
  }

  /**
   * 获取页面容器
   */
  function getContainer() {
    return document.getElementById('page-container');
  }

  /**
   * 渲染底部导航栏
   * Apple 风格：毛玻璃 + emoji 图标
   */
  function renderBottomNav(currentPage) {
    var navItems = Constants.NAV_ITEMS;
    var youth = AppState.currentYouth;
    var youthId = youth ? youth.id : null;

    var html = '<nav class="bottom-nav" role="navigation" aria-label="主导航">';
    for (var i = 0; i < navItems.length; i++) {
      var item = navItems[i];
      var active = item.page === currentPage ? ' active' : '';
      var href = '#' + item.page;
      // 档案、记录、对话、速读卡需要 youthId 参数
      if (youthId && ['profile', 'quickcard', 'records', 'chat', 'timeline', 'charts'].indexOf(item.page) > -1) {
        href += '?youthId=' + encodeURIComponent(youthId);
      }
      html += '<a class="bottom-nav-item' + active + '" href="' + href + '" role="link" aria-label="' + item.label + '">' +
        '<span class="bottom-nav-icon">' + item.icon + '</span>' +
        '<span class="bottom-nav-label">' + item.label + '</span>' +
        '</a>';
    }
    html += '</nav>';

    // 插入或更新底部导航（用 replaceWith 保留事件监听）
    var existing = document.querySelector('.bottom-nav');
    if (existing) {
      var temp = document.createElement('div');
      temp.innerHTML = html;
      existing.replaceWith(temp.firstChild);
    } else {
      var app = document.getElementById('app');
      if (app) {
        var temp = document.createElement('div');
        temp.innerHTML = html;
        app.appendChild(temp.firstChild);
      }
    }
  }

  /**
   * 移除底部导航栏（登录/注册页不显示）
   */
  function removeBottomNav() {
    var existing = document.querySelector('.bottom-nav');
    if (existing) {
      existing.remove();
    }
  }

  /**
   * 渲染页面
   */
  function renderPage(page, params) {
    var container = getContainer();
    if (!container) return;

    // 导航守卫：未登录时重定向到 login
    if (!AppState.isLoggedIn && PUBLIC_PAGES.indexOf(page) === -1) {
      window.location.hash = 'login';
      return;
    }

    // 已登录但访问 login/register，重定向到 dashboard
    if (AppState.isLoggedIn && PUBLIC_PAGES.indexOf(page) > -1) {
      window.location.hash = 'dashboard';
      return;
    }

    // 政府角色限制：只能访问 government 页面
    if (AppState.currentUser && AppState.currentUser.role === 'government' && page !== 'government') {
      window.location.hash = 'government';
      return;
    }

    // 调用已注册的路由渲染函数
    if (routes[page]) {
      container.innerHTML = '';
      try {
        routes[page](params || {});
      } catch (e) {
        console.error('页面渲染错误 (' + page + '):', e);
        container.innerHTML = '<div class="page-content"><div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">页面加载失败</div><div class="empty-state-desc">' + Utils.escapeHtml(e.message) + '</div></div></div>';
      }
    } else {
      // 页面未实现，显示占位符
      renderPlaceholder(container, page);
    }

    // 公开页面不显示底部导航（在内容渲染后，避免被 innerHTML 清除）
    if (NO_BOTTOM_NAV_PAGES.indexOf(page) > -1) {
      removeBottomNav();
    } else {
      renderBottomNav(page);
    }
  }

  /**
   * 渲染未实现页面的占位符
   */
  function renderPlaceholder(container, page) {
    var title = Constants.PAGE_TITLES[page] || page;
    container.innerHTML =
      '<div class="page-content">' +
        '<div class="empty-state">' +
          '<div class="empty-state-icon">🚧</div>' +
          '<div class="empty-state-title">' + Utils.escapeHtml(title) + '</div>' +
          '<div class="empty-state-desc">该页面正在建设中，即将上线</div>' +
        '</div>' +
      '</div>';
  }

  /**
   * 渲染 Toast 提示
   */
  function renderToast() {
    var container = document.getElementById('toast-container');
    if (!container) return;

    var msg = AppState.getState().toastMessage;
    if (msg) {
      var toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = msg.text || msg;
      container.innerHTML = '';
      container.appendChild(toast);
    } else {
      container.innerHTML = '';
    }
  }

  /**
   * 渲染 Dashboard（主页）— Apple Design 布局
   */
  function showDashboard(params) {
    var container = getContainer();
    var user = AppState.currentUser;
    var youths = Permissions.getAccessibleYouths();

    // 无档案：灯塔愿景横幅
    if (youths.length === 0) {
      container.innerHTML =
        '<div class="page-content lighthouse-banner">' +
          '<div class="lighthouse-icon">🗼</div>' +
          '<h1 class="lighthouse-title">AI懂我</h1>' +
          '<p class="lighthouse-subtitle">全生涯数据灯塔</p>' +
          '<p class="lighthouse-desc">' +
            '为心青年建立终身数字档案，生成速读卡让新接手者<span class="lighthouse-highlight">5 分钟</span>了解如何安全相处，' +
            '用对话记录替代纸质表格，让每一次照护都有据可循。' +
          '</p>' +
          (user.role !== 'government' ? '<button class="lighthouse-cta" id="btn-create-profile">' +
            '<span class="lighthouse-cta-icon">✚</span> 创建心青年档案' +
          '</button>' : '') +
        '</div>';
      _bindDashboardEvents(user, youths);
      return;
    }

    // 页头
    var headerHtml = _renderDashboardHeader();

    // 按角色渲染内容
    var contentHtml = '';
    switch (user.role) {
      case 'youth': contentHtml = _renderYouthDashboard(user, youths); break;
      case 'parent': contentHtml = _renderParentDashboard(user, youths); break;
      case 'teacher': contentHtml = _renderTeacherDashboard(user, youths); break;
      case 'caregiver': contentHtml = _renderCaregiverDashboard(user, youths); break;
      case 'volunteer': contentHtml = _renderVolunteerDashboard(user, youths); break;
      default: contentHtml = _renderDefaultDashboard(user, youths);
    }

    container.innerHTML = headerHtml + '<div class="dashboard">' + contentHtml + '</div>';

    _bindDashboardEvents(user, youths);
  }

  /**
   * 渲染页头（所有角色共用）
   */
  function _renderDashboardHeader() {
    var user = AppState.currentUser;
    var youthLabel = (Constants.ROLE_LABELS[user.role] || user.role);
    var roleIcon = { youth: '🌻', parent: '👨‍👩‍👧', teacher: '📚', caregiver: '🤝', volunteer: '💙', government: '🏛️' }[user.role] || '👤';
    return '<div class="page-header">' +
      '<span class="page-title">AI懂我</span>' +
      '<div class="header-user-badge">' +
        '<span class="header-user-name">' + Utils.escapeHtml(user.name) + '</span>' +
        '<span class="header-user-role">' + roleIcon + ' ' + Utils.escapeHtml(youthLabel) + '</span>' +
      '</div>' +
    '</div>';
  }

  /**
   * 心青年主页：自己档案 + 心情/愿望 + 最近动态 + 速读卡
   */
  function _renderYouthDashboard(user, youths) {
    var html = '';
    var youth = youths.length > 0 ? youths[0] : null;

    if (!youth) {
      html += '<div class="empty-state"><div class="empty-state-icon">🌱</div><div class="empty-state-title">暂无档案</div><div class="empty-state-desc">请联系家长为你创建档案</div></div>';
      return html;
    }

    var age = Utils.calculateAge(youth.birthDate);
    var moodLabel = _getRecentMood(youth);

    // 档案卡片
    html += '<div class="dashboard-section">' +
      '<div class="dashboard-section-title">📋 我的档案</div>' +
      '<div class="youth-card" data-youth-id="' + youth.id + '">' +
        '<div class="youth-card-top">' +
          '<div class="youth-card-avatar">' + (youth.avatar || '🧑') + '</div>' +
          '<div class="youth-card-info">' +
            '<div class="youth-card-name">' + Utils.escapeHtml(youth.name) + '</div>' +
            '<div class="youth-card-meta">' + age + '岁 · ' + moodLabel + '</div>' +
          '</div>' +
          '<span class="youth-card-arrow">›</span>' +
        '</div>' +
      '</div>' +
    '</div>';

    // 快捷操作
    html += '<div class="dashboard-section">' +
      '<div class="dashboard-section-title">⚡ 快捷操作</div>' +
      '<div class="quick-actions">' +
        '<button class="quick-action-btn" id="btn-mood-record">😊 记录心情</button>' +
        '<button class="quick-action-btn" id="btn-add-wish">🌟 添加愿望</button>' +
      '</div>' +
    '</div>';

    // 状态摘要
    var recentRecords = _getRecentRecords(youth.id, 3);
    if (recentRecords.length > 0) {
      html += '<div class="dashboard-section">' +
        '<div class="dashboard-section-title">🕐 最近动态</div>' +
        '<div class="status-summary">';
      for (var i = 0; i < recentRecords.length; i++) {
        var r = recentRecords[i];
        var mInfo = Modules.MODULES.find(function (m) { return m.key === r.module; });
        html += '<div class="status-item">' +
          '<span class="status-item-icon">' + (mInfo ? mInfo.icon : '📝') + '</span>' +
          '<span class="status-item-text">' + Utils.escapeHtml(_truncate(r.content.text || '', 40)) + '</span>' +
          '<span class="status-item-time">' + _relativeTime(r.createdAt) + '</span>' +
        '</div>';
      }
      html += '</div></div>';
    }

    // 每日交接
    html += _renderDailyHandover(youth);

    // 管理入口
    html += '<div class="dashboard-section">' +
      '<div class="dashboard-section-title">📌 管理</div>' +
      '<div class="management-portal">' +
        '<button class="management-btn" id="btn-open-quickcard">' +
          '<span class="management-btn-icon">📚</span>' +
          '<span class="management-btn-label">我的速读卡</span>' +
          '<span class="management-btn-arrow">→</span>' +
        '</button>' +
      '</div>' +
    '</div>';

    return html;
  }

  /**
   * 家长主页：孩子列表 + 紧急联系人 + 情绪/过敏预警 + 授权管理 + 创建档案
   */
  function _renderParentDashboard(user, youths) {
    var html = '';
    var y = youths.length > 0 ? youths[0] : null;

    if (!y) {
      html += '<div class="empty-state"><div class="empty-state-icon">🌱</div><div class="empty-state-title">开始你的第一个档案</div><div class="empty-state-desc">前往「管理」页面创建心青年档案</div></div>';
      return html;
    }

    // === Card 1: 速读卡 ===
    html += '<div class="ios-card-group">';
    html += '<div class="ios-card-group-header">📚 速读卡</div>';
    html += '<div class="ios-card-row" data-youth-id="' + y.id + '" data-action="quickcard">' +
      '<div class="ios-card-row-icon avatar" id="avatar-upload" data-youth-id="' + y.id + '"' + (y.avatar && y.avatar.indexOf('data:') === 0 ? ' style="background-image:url(' + y.avatar + ');background-size:cover;background-position:center"' : '') + '>' + (y.avatar && y.avatar.indexOf('data:') === 0 ? '' : (y.avatar || '🧑')) + '</div>' +
      '<div class="ios-card-row-body">' +
        '<div class="ios-card-row-title">' + Utils.escapeHtml(y.name) + '</div>' +
        '<div class="ios-card-row-subtitle">新接手者 5 分钟快速了解如何安全相处</div>' +
      '</div>' +
      '<span class="ios-card-row-arrow">›</span>' +
    '</div>';
    html += '</div>';

    // === Card 2: 每日交接（跨角色信息共享与任务交接） ===
    html += _renderDailyHandover(y);

    html += '<div class="dashboard-footer-space"></div>';

    return html;
  }

  /**
   * 老师主页：学生列表 + 沟通说明书速查 + ISP进度 + 待记录提醒 + 服务到期
   */
  function _renderTeacherDashboard(user, youths) {
    var html = '';

    // 每日交接
    if (youths.length > 0) {
      for (var i = 0; i < youths.length; i++) {
        html += _renderDailyHandover(youths[i]);
      }
    }

    html += '<div class="dashboard-section">' +
      '<div class="dashboard-section-title">📚 学生列表</div>';

    if (youths.length === 0) {
      html += '<div class="empty-state"><div class="empty-state-icon">📚</div><div class="empty-state-title">暂无学生档案</div><div class="empty-state-desc">请联系家长获取授权</div></div>';
    } else {
      for (var i = 0; i < youths.length; i++) {
        html += _renderYouthCard(youths[i]);
      }
    }
    html += '</div>';

    if (youths.length > 0) {
      // 快捷操作
      html += '<div class="dashboard-section">' +
        '<div class="dashboard-section-title">⚡ 快捷操作</div>' +
        '<div class="quick-actions">';
      for (var i = 0; i < youths.length; i++) {
        html += '<button class="quick-action-btn" data-youth-id="' + youths[i].id + '" data-action="quickcard">' +
          '💬 ' + Utils.escapeHtml(youths[i].name) + ' 沟通说明书</button>';
      }
      html += '</div></div>';

      // ISP 进度
      html += '<div class="dashboard-section">' +
        '<div class="dashboard-section-title">📋 ISP 进度</div>' +
        '<div class="status-summary">';
      for (var i = 0; i < youths.length; i++) {
        html += _renderISPProgress(youths[i]);
      }
      html += '</div></div>';

      // 管理入口
      html += '<div class="dashboard-section">' +
        '<div class="dashboard-section-title">📌 管理</div>' +
        '<div class="management-portal">' +
          '<button class="management-btn" id="btn-pending-records">' +
            '<span class="management-btn-icon">📝</span>' +
            '<span class="management-btn-label">待记录提醒</span>' +
            '<span class="management-btn-arrow">→</span>' +
          '</button>' +
        '</div>' +
      '</div>';

      // 时效提示
      html += _renderExpirationAlert('teacher', '服务到期提醒', '请确认您的机构服务授权是否在有效期内');
    }

    return html;
  }

  /**
   * 照护者主页：安全速查卡 + 用药提醒 + 今日照护任务 + 护理记录入口 + 雇佣到期
   */
  function _renderCaregiverDashboard(user, youths) {
    var html = '';

    // 每日交接
    for (var i = 0; i < youths.length; i++) {
      html += _renderDailyHandover(youths[i]);
    }

    if (youths.length === 0) {
      html += '<div class="empty-state"><div class="empty-state-icon">🤝</div><div class="empty-state-title">暂无照护对象</div><div class="empty-state-desc">请联系家长获取授权</div></div>';
      return html;
    }

    // 安全速查卡
    html += '<div class="dashboard-section">' +
      '<div class="dashboard-section-title">🛡️ 安全速查卡</div>';
    for (var i = 0; i < youths.length; i++) {
      html += _renderSafetyQuickCard(youths[i]);
    }
    html += '</div>';

    // 快捷操作
    html += '<div class="dashboard-section">' +
      '<div class="dashboard-section-title">⚡ 快捷操作</div>' +
      '<div class="quick-actions">' +
        '<button class="quick-action-btn" id="btn-med-reminder">💊 用药提醒</button>';
    for (var i = 0; i < youths.length; i++) {
      html += '<button class="quick-action-btn" data-youth-id="' + youths[i].id + '" data-action="records">' +
        '📋 ' + Utils.escapeHtml(youths[i].name) + ' 记录</button>';
    }
    html += '</div></div>';

    // 今日照护任务
    html += '<div class="dashboard-section">' +
      '<div class="dashboard-section-title">📋 今日照护任务</div>' +
      '<div class="status-summary">';
    for (var i = 0; i < youths.length; i++) {
      html += _renderCareTasks(youths[i]);
    }
    html += '</div></div>';

    // 管理入口
    html += '<div class="dashboard-section">' +
      '<div class="dashboard-section-title">📌 管理</div>' +
      '<div class="management-portal">';
    for (var i = 0; i < youths.length; i++) {
      html += '<button class="management-btn" data-youth-id="' + youths[i].id + '" data-action="records">' +
        '<span class="management-btn-icon">📋</span>' +
        '<span class="management-btn-label">' + Utils.escapeHtml(youths[i].name) + ' 护理记录</span>' +
        '<span class="management-btn-arrow">→</span>' +
      '</button>';
    }
    html += '</div></div>';

    // 时效提示
    html += _renderExpirationAlert('caregiver', '雇佣到期提醒', '请确认您的雇佣关系是否在有效期内');

    return html;
  }

  /**
   * 志愿者主页：安全速查卡 + 5分钟安全指南 + 活动记录入口 + 权限过期
   */
  function _renderVolunteerDashboard(user, youths) {
    var html = '';

    // 每日交接
    for (var i = 0; i < youths.length; i++) {
      html += _renderDailyHandover(youths[i]);
    }

    if (youths.length === 0) {
      html += '<div class="empty-state"><div class="empty-state-icon">💙</div><div class="empty-state-title">暂无服务对象</div><div class="empty-state-desc">请联系家长获取授权</div></div>';
      return html;
    }

    // 安全速查卡
    html += '<div class="dashboard-section">' +
      '<div class="dashboard-section-title">🛡️ 安全速查卡</div>';
    for (var i = 0; i < youths.length; i++) {
      html += _renderSafetyQuickCard(youths[i]);
    }
    html += '</div>';

    // 快捷操作
    html += '<div class="dashboard-section">' +
      '<div class="dashboard-section-title">⚡ 快捷操作</div>' +
      '<div class="quick-actions">';
    for (var i = 0; i < youths.length; i++) {
      html += '<button class="quick-action-btn" data-youth-id="' + youths[i].id + '" data-action="quickcard">' +
        '📖 ' + Utils.escapeHtml(youths[i].name) + ' 安全指南</button>';
    }
    html += '</div></div>';

    // 管理入口
    html += '<div class="dashboard-section">' +
      '<div class="dashboard-section-title">📌 管理</div>' +
      '<div class="management-portal">';
    for (var i = 0; i < youths.length; i++) {
      html += '<button class="management-btn" data-youth-id="' + youths[i].id + '" data-action="records">' +
        '<span class="management-btn-icon">📝</span>' +
        '<span class="management-btn-label">' + Utils.escapeHtml(youths[i].name) + ' 活动记录</span>' +
        '<span class="management-btn-arrow">→</span>' +
      '</button>';
    }
    html += '</div></div>';

    // 时效提示
    var expHtml = _getGrantExpiration(user, youths);
    if (expHtml) {
      html += '<div class="dashboard-section">' +
        '<div class="dashboard-section-title">⏰ 时效提示</div>' +
        '<div class="expiration-alert">' + expHtml + '</div>' +
      '</div>';
    }

    return html;
  }

  /**
   * 默认主页（未知角色）
   */
  function _renderDefaultDashboard(user, youths) {
    return '<div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-title">欢迎使用 AI懂我</div><div class="empty-state-desc">请选择您的角色开始使用</div></div>';
  }

  /**
   * 渲染安全速查卡（照护者/志愿者用）
   */
  function _renderSafetyQuickCard(youth) {
    var age = Utils.calculateAge(youth.birthDate);
    var comm = youth.modules.communicationGuide;
    var emotion = youth.modules.emotionBehavior;
    var medical = youth.modules.careMedical;

    // 沟通方式
    var commText = '';
    if (comm && comm.preferredMethods && comm.preferredMethods.length > 0) {
      commText = comm.preferredMethods.map(function (m) { return m.method; }).join('、');
    }

    // 过敏源
    var allergyText = '';
    if (medical && medical.allergies && medical.allergies.length > 0) {
      allergyText = medical.allergies.join('、');
    }

    // 行为红线
    var redLineCount = (emotion && emotion.behaviorRedLines) ? emotion.behaviorRedLines.length : 0;

    // 近期情绪
    var moodLabel = _getRecentMood(youth);

    // 紧急联系人
    var contactsHtml = '';
    if (youth.emergencyContacts && youth.emergencyContacts.length > 0) {
      contactsHtml = '<div class="safety-card-contacts">';
      for (var i = 0; i < youth.emergencyContacts.length; i++) {
        var c = youth.emergencyContacts[i];
        contactsHtml += '<a class="safety-contact-item" href="tel:' + Utils.escapeHtml(c.phone) + '">' +
          '<span class="safety-contact-icon">📞</span>' +
          '<span class="safety-contact-info">' +
            '<span class="safety-contact-name">' + Utils.escapeHtml(c.name) + '</span>' +
            '<span class="safety-contact-relation">' + Utils.escapeHtml(c.relation || '') + '</span>' +
          '</span>' +
          '<span class="safety-contact-phone">' + Utils.escapeHtml(c.phone) + '</span>' +
        '</a>';
      }
      contactsHtml += '</div>';
    }

    var html = '<div class="safety-card" data-youth-id="' + youth.id + '">' +
      '<div class="safety-card-header">' +
        '<div class="safety-card-avatar">' + (youth.avatar || '🧑') + '</div>' +
        '<div class="safety-card-info">' +
          '<div class="safety-card-name">' + Utils.escapeHtml(youth.name) + '</div>' +
          '<div class="safety-card-meta">' + age + '岁 · ' + moodLabel + '</div>' +
        '</div>' +
        '<span class="safety-card-arrow">›</span>' +
      '</div>';

    if (commText || allergyText || redLineCount > 0) {
      html += '<div class="safety-card-grid">';
      if (commText) {
        html += '<div class="safety-card-item"><span class="safety-card-item-icon">💬</span><span class="safety-card-item-label">沟通</span><span class="safety-card-item-value">' + Utils.escapeHtml(commText) + '</span></div>';
      }
      if (allergyText) {
        html += '<div class="safety-card-item safety-card-item-warning"><span class="safety-card-item-icon">⚠️</span><span class="safety-card-item-label">过敏</span><span class="safety-card-item-value">' + Utils.escapeHtml(allergyText) + '</span></div>';
      }
      if (redLineCount > 0) {
        html += '<div class="safety-card-item safety-card-item-danger"><span class="safety-card-item-icon">🚫</span><span class="safety-card-item-label">红线</span><span class="safety-card-item-value">' + redLineCount + ' 条</span></div>';
      }
      html += '</div>';
    }

    html += contactsHtml + '</div>';
    return html;
  }

  /**
   * 渲染增强版档案卡片（家长/老师用）
   */
  function _renderYouthCard(youth) {
    var age = Utils.calculateAge(youth.birthDate);
    var moodLabel = _getRecentMood(youth);
    var medical = youth.modules.careMedical;
    var emotion = youth.modules.emotionBehavior;

    // 过敏标签
    var allergyTags = '';
    if (medical && medical.allergies && medical.allergies.length > 0) {
      allergyTags = '<span class="youth-card-tag youth-card-tag-warning">⚠️ ' + medical.allergies.length + ' 过敏</span>';
    }

    // 红线标签
    var redLineTags = '';
    if (emotion && emotion.behaviorRedLines && emotion.behaviorRedLines.length > 0) {
      redLineTags = '<span class="youth-card-tag youth-card-tag-danger">🚫 ' + emotion.behaviorRedLines.length + ' 红线</span>';
    }

    // 最近记录（取最新一条）
    var records = Storage.getRecords(youth.id);
    var recentSummary = '';
    if (records && records.length > 0) {
      var recent = records[0];
      var moduleInfo = Modules.MODULES.find(function (m) { return m.key === recent.module; });
      var text = (recent.content && recent.content.text) ? recent.content.text.substring(0, 30) : '';
      if (text) {
        recentSummary = '<div class="youth-card-summary">' +
          (moduleInfo ? moduleInfo.icon + ' ' : '') + Utils.escapeHtml(text) + (recent.content.text.length > 30 ? '...' : '') +
        '</div>';
      }
    }

    return '<div class="youth-card" data-youth-id="' + youth.id + '">' +
      '<div class="youth-card-top">' +
        '<div class="youth-card-avatar">' + (youth.avatar || '🧑') + '</div>' +
        '<div class="youth-card-info">' +
          '<div class="youth-card-name">' + Utils.escapeHtml(youth.name) + '</div>' +
          '<div class="youth-card-meta">' + age + '岁 · ' + moodLabel + '</div>' +
        '</div>' +
        '<span class="youth-card-arrow">›</span>' +
      '</div>' +
      (allergyTags || redLineTags ? '<div class="youth-card-tags">' + allergyTags + redLineTags + '</div>' : '') +
      recentSummary +
    '</div>';
  }

  /**
   * 渲染情绪/过敏状态摘要
   */
  function _renderYouthStatusSummary(youth) {
    var emotion = youth.modules.emotionBehavior;
    var medical = youth.modules.careMedical;
    var moodLabel = _getRecentMood(youth);

    var html = '<div class="status-item">' +
      '<span class="status-item-icon">' + (youth.avatar || '🧑') + '</span>' +
      '<span class="status-item-text">' + Utils.escapeHtml(youth.name) + '</span>' +
      '<span class="status-item-time">' + moodLabel + '</span>' +
    '</div>';

    if (medical && medical.allergies && medical.allergies.length > 0) {
      html += '<div class="status-item status-item-warning">' +
        '<span class="status-item-icon">⚠️</span>' +
        '<span class="status-item-text">过敏源：' + Utils.escapeHtml(medical.allergies.join('、')) + '</span>' +
      '</div>';
    }

    if (emotion && emotion.behaviorRedLines && emotion.behaviorRedLines.length > 0) {
      html += '<div class="status-item status-item-danger">' +
        '<span class="status-item-icon">🚫</span>' +
        '<span class="status-item-text">行为红线 ' + emotion.behaviorRedLines.length + ' 条</span>' +
      '</div>';
    }

    return html;
  }

  /**
   * 渲染 ISP 进度（老师用）
   */
  function _renderISPProgress(youth) {
    var work = youth.modules.workSupport;
    if (!work || !work.ispPlans || work.ispPlans.length === 0) {
      return '<div class="status-item">' +
        '<span class="status-item-icon">📋</span>' +
        '<span class="status-item-text">' + Utils.escapeHtml(youth.name) + ' 暂无 ISP 计划</span>' +
      '</div>';
    }
    var active = work.ispPlans.filter(function (p) { return p.status === 'active'; }).length;
    var completed = work.ispPlans.filter(function (p) { return p.status === 'completed'; }).length;
    return '<div class="status-item">' +
      '<span class="status-item-icon">📋</span>' +
      '<span class="status-item-text">' + Utils.escapeHtml(youth.name) + ' ISP：' + active + ' 进行中 / ' + completed + ' 已完成</span>' +
    '</div>';
  }

  /**
   * 渲染今日照护任务（照护者用）
   */
  function _renderCareTasks(youth) {
    var medical = youth.modules.careMedical;
    var tasks = [];
    if (medical && medical.medications && medical.medications.length > 0) {
      tasks.push('💊 ' + medical.medications.length + ' 种用药');
    }
    if (medical && medical.medicalHistory && medical.medicalHistory.length > 0) {
      tasks.push('🏥 ' + medical.medicalHistory.length + ' 条就医记录');
    }
    var records = Storage.getRecords(youth.id);
    var todayRecords = records ? records.filter(function (r) {
      return r.createdAt && r.createdAt.indexOf(Utils.formatDate(new Date())) === 0;
    }) : [];
    tasks.push('📝 今日已记录 ' + todayRecords.length + ' 条');

    return '<div class="status-item">' +
      '<span class="status-item-icon">' + (youth.avatar || '🧑') + '</span>' +
      '<span class="status-item-text">' + Utils.escapeHtml(youth.name) + '</span>' +
      '<span class="status-item-time">' + tasks.join(' · ') + '</span>' +
    '</div>';
  }

  /**
   * 渲染时效提示
   */
  function _renderExpirationAlert(role, title, desc) {
    return '<div class="dashboard-section">' +
      '<div class="dashboard-section-title">⏰ 时效提示</div>' +
      '<div class="expiration-alert">' +
        '<span class="expiration-alert-icon">⏰</span>' +
        '<div class="expiration-alert-content">' +
          '<div class="expiration-alert-title">' + title + '</div>' +
          '<div class="expiration-alert-desc">' + desc + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /**
   * 获取授权过期提示（志愿者用）
   */
  function _getGrantExpiration(user, youths) {
    var grants = AppState.currentGrants;
    if (!grants || grants.length === 0) return '';
    var now = new Date();
    for (var i = 0; i < grants.length; i++) {
      if (grants[i].validUntil) {
        var exp = new Date(grants[i].validUntil);
        if (exp > now) {
          var hours = Math.floor((exp - now) / 3600000);
          return '您的访问权限将在 ' + hours + ' 小时后过期（' + Utils.escapeHtml(exp.toLocaleString('zh-CN')) + '）';
        }
      }
    }
    return '您的访问权限已过期，请联系家长重新授权';
  }

  /**
   * 获取最近心情
   */
  function _getRecentMood(youth) {
    var emotion = youth.modules.emotionBehavior;
    if (emotion && emotion.emotionTrend && emotion.emotionTrend.length > 0) {
      var latest = emotion.emotionTrend[emotion.emotionTrend.length - 1];
      var moodLabels = { great: '😀 很好', good: '🙂 不错', neutral: '😐 一般', low: '😞 低落', crisis: '🆘 危机' };
      return moodLabels[latest.mood] || '😐 一般';
    }
    return '😐 暂无数据';
  }

  /**
   * 获取最近 N 条记录（Storage.getRecords 已按 recordedAt 降序返回）
   */
  function _getRecentRecords(youthId, count) {
    var records = Storage.getRecords(youthId);
    if (!records || records.length === 0) return [];
    return records.slice(0, count || 3);
  }

  /**
   * 显示新建交接任务表单
   */
  function _showHandoverForm(youth) {
    var overlay = document.createElement('div');
    overlay.className = 'record-form-overlay';
    overlay.id = 'handover-form-overlay';

    // 获取该心青年的授权用户列表（排除自己和 government/youth）
    var grants = Storage.getAccessGrants(youth.id);
    var currentUser = AppState.currentUser;
    var userOptions = '<option value="">请选择接收人</option>';
    var seenIds = {};
    for (var i = 0; i < grants.length; i++) {
      var g = grants[i];
      if (g.granteeId === currentUser.id) continue;
      if (g.granteeRole === 'government' || g.granteeRole === 'youth') continue;
      if (seenIds[g.granteeId]) continue;
      seenIds[g.granteeId] = true;
      var account = Storage.getAccount(g.granteeId);
      var label = account ? account.name : g.granteeId;
      var roleLabel = Constants.ROLE_LABELS[g.granteeRole] || g.granteeRole;
      userOptions += '<option value="' + g.granteeId + '">' + Utils.escapeHtml(label) + '（' + roleLabel + '）</option>';
    }

    overlay.innerHTML =
      '<div class="record-form-sheet">' +
        '<div class="record-form-header">' +
          '<span class="record-form-title">新建交接任务</span>' +
          '<button class="record-form-close" id="btn-close-handover-form">×</button>' +
        '</div>' +
        '<div class="record-form-body">' +
          '<div class="form-group">' +
            '<label class="form-label">交接给谁</label>' +
            '<select class="form-input" id="handover-to-user">' + userOptions + '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">任务内容</label>' +
            '<textarea class="form-textarea" id="handover-content" placeholder="例如：明天带小明去公园散步，注意防晒..." maxlength="500"></textarea>' +
          '</div>' +
          '<div class="form-error" id="handover-form-error" style="display:none;"></div>' +
          '<button class="btn btn-primary btn-block btn-lg" id="btn-save-handover" style="margin-top:16px;">创建任务</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.querySelector('#btn-close-handover-form').addEventListener('click', function () {
      document.body.removeChild(overlay);
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    overlay.querySelector('#btn-save-handover').addEventListener('click', function () {
      var toUserId = overlay.querySelector('#handover-to-user').value;
      var contentText = overlay.querySelector('#handover-content').value.trim();
      var errorEl = overlay.querySelector('#handover-form-error');

      if (!toUserId) {
        errorEl.textContent = '请选择接收人';
        errorEl.style.display = 'block';
        return;
      }
      if (!contentText) {
        errorEl.textContent = '请输入任务内容';
        errorEl.style.display = 'block';
        return;
      }

      var toAccount = Storage.getAccount(toUserId);
      Storage.addHandoverTask(youth.id, {
        youthId: youth.id,
        fromUserId: currentUser.id,
        fromRole: currentUser.role,
        toUserId: toUserId,
        toRole: toAccount ? toAccount.role : 'parent',
        content: contentText,
        status: 'pending'
      });

      document.body.removeChild(overlay);
      showDashboard({});
    });
  }

  /**
   * 渲染交接任务行（复用组件）
   */
  function _renderTaskRow(task, youth, showTo) {
    var fromAccount = Storage.getAccount(task.fromUserId);
    var fromName = fromAccount ? fromAccount.name : '未知';
    var fromRoleLabel = Constants.ROLE_LABELS[task.fromRole] || task.fromRole;
    var fromLabel = '发起人-' + fromRoleLabel + '（' + fromName + '）';
    var toLabel = '';
    if (task.toUserId) {
      var toAccount = Storage.getAccount(task.toUserId);
      toLabel = toAccount ? toAccount.name : '未知';
    } else {
      toLabel = Constants.ROLE_LABELS[task.toRole] || task.toRole;
    }
    var isDone = task.status === 'done';
    var statusText = TASK_STATUS[task.status] || task.status;
    // 按钮文字：待处理 / 已完成
    var btnText = task.status === 'done' ? '已完成' : '待处理';

    var toHtml = showTo ? ' → <span class="handover-task-to">' + Utils.escapeHtml(toLabel) + '</span>' : '';

    return '<div class="handover-task-row' + (isDone ? ' is-done' : '') + '">' +
      '<button class="handover-status-btn ' + task.status + '" data-task-id="' + task.id + '" data-youth-id="' + youth.id + '" data-status="' + task.status + '" title="' + statusText + ' · 点击切换">' +
        btnText +
      '</button>' +
      '<div class="handover-task-body">' +
        '<div class="handover-task-content">' + Utils.escapeHtml(task.content) + '</div>' +
        '<div class="handover-task-meta">' +
          '<span class="handover-task-from">' + Utils.escapeHtml(fromLabel) + '</span>' +
          toHtml +
          '<span class="handover-task-time">' + _relativeTime(task.updatedAt || task.createdAt) + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /**
   * 渲染每日交接卡片 — 交接任务 Todo List（含状态管理）
   * 分为两类：我的任务（接收）/ 我发起的（创建）
   */
  function _renderDailyHandover(youth) {
    var tasks = Storage.getHandoverTasks(youth.id);
    var user = AppState.currentUser;
    var html = '<div class="ios-card-group">';
    html += '<div class="ios-card-group-header">🔄 每日交接 · ' + Utils.formatDate(new Date()) + '</div>';

    // 分类：我的任务、我发起的、其他（家长监护可见全部）
    // 优先使用 toUserId 精确匹配，兼容旧数据仅有的 toRole
    var myTasks = [];
    var sentTasks = [];
    var otherTasks = [];
    var isParent = user.role === 'parent';
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      var isMyTask = t.toUserId ? (t.toUserId === user.id) : (t.toRole === user.role);
      if (isMyTask) {
        myTasks.push(t);
      } else if (t.fromUserId === user.id) {
        sentTasks.push(t);
      } else if (isParent) {
        otherTasks.push(t);
      }
    }
    var statusOrder = { pending: 0, done: 1 };
    var sortFn = function (a, b) {
      return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
    };
    myTasks.sort(sortFn);
    sentTasks.sort(sortFn);
    otherTasks.sort(sortFn);

    var userRoleLabel = Constants.ROLE_LABELS[user.role] || user.role;
    var userLabel = userRoleLabel + '-' + user.name;
    var totalCount = tasks.length;
    var hasContent = false;

    // 状态统计
    var visibleTasks = myTasks.concat(sentTasks).concat(otherTasks);
    var statusCount = { pending: 0, done: 0 };
    for (var i = 0; i < visibleTasks.length; i++) {
      var s = visibleTasks[i].status;
      if (statusCount[s] !== undefined) statusCount[s]++;
    }
    var statusLabels = TASK_STATUS;
    html += '<div class="handover-summary">';
    for (var j = 0; j < TASK_STATUS_ORDER.length; j++) {
      var sk = TASK_STATUS_ORDER[j];
      html += '<span class="handover-stat ' + sk + '">' + statusLabels[sk] + ' ' + statusCount[sk] + '</span>';
    }
    html += '</div>';

    if (totalCount === 0) {
      html += '<div class="ios-card-row-static">' +
        '<div class="ios-card-row-body">' +
          '<div class="ios-card-row-title" style="color: var(--color-text-tertiary);">暂无交接任务</div>' +
          '<div class="ios-card-row-subtitle">点击下方按钮创建新的交接任务</div>' +
        '</div>' +
      '</div>';
    } else {
      // 我的任务
      html += '<div class="handover-collapse-section">';
      html += '<div class="handover-section-header handover-toggle" data-section="my">📥 分配给我的（' + userLabel + '） <span class="handover-section-count">' + myTasks.length + '</span><span class="handover-chevron' + (_handoverOpenSections.my ? ' open' : '') + '">▼</span></div>';
      html += '<div class="handover-collapse-body' + (_handoverOpenSections.my ? ' open' : '') + '" id="handover-section-my">';
      if (myTasks.length > 0) {
        hasContent = true;
        html += '<div class="handover-task-list">';
        for (var k = 0; k < myTasks.length; k++) {
          html += _renderTaskRow(myTasks[k], youth);
        }
        html += '</div>';
      } else {
        html += '<div class="handover-empty-hint">暂无分配给您的任务</div>';
      }
      html += '</div></div>';

      // 我发起的
      html += '<div class="handover-collapse-section">';
      html += '<div class="handover-section-header handover-toggle" data-section="sent">📤 我发起的（' + userLabel + '） <span class="handover-section-count">' + sentTasks.length + '</span><span class="handover-chevron' + (_handoverOpenSections.sent ? ' open' : '') + '">▼</span></div>';
      html += '<div class="handover-collapse-body' + (_handoverOpenSections.sent ? ' open' : '') + '" id="handover-section-sent">';
      if (sentTasks.length > 0) {
        hasContent = true;
        html += '<div class="handover-task-list">';
        for (var k = 0; k < sentTasks.length; k++) {
          html += _renderTaskRow(sentTasks[k], youth);
        }
        html += '</div>';
      } else {
        html += '<div class="handover-empty-hint">您还没有发起交接任务</div>';
      }
      html += '</div></div>';

      // 其他相关任务（家长监护可见）
      if (otherTasks.length > 0) {
        html += '<div class="handover-collapse-section">';
        html += '<div class="handover-section-header handover-toggle" data-section="other">👀 其他相关任务 <span class="handover-section-count">' + otherTasks.length + '</span><span class="handover-chevron' + (_handoverOpenSections.other ? ' open' : '') + '">▼</span></div>';
        html += '<div class="handover-collapse-body' + (_handoverOpenSections.other ? ' open' : '') + '" id="handover-section-other">';
        html += '<div class="handover-task-list">';
        for (var k = 0; k < otherTasks.length; k++) {
          html += _renderTaskRow(otherTasks[k], youth, true);
        }
        html += '</div>';
        html += '</div></div>';
      }


    }

    // 新建任务按钮
    html += '<div class="ios-card-row-static" style="border-top:0.5px solid var(--color-border-light);">' +
      '<button class="ios-create-row handover-create-btn" id="btn-add-handover-' + youth.id + '" style="width:100%;">✚ 新建交接任务</button>' +
    '</div>';

    html += '</div>';
    return html;
  }

  /**
   * 截断文本
   */
  function _truncate(text, maxLen) {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
  }

  /**
   * 相对时间
   */
  function _relativeTime(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    var now = new Date();
    var diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    return Math.floor(diff / 86400000) + '天前';
  }

  /**
   * 渲染管理页面
   */
  function showManagement(params) {
    var container = getContainer();
    var user = AppState.currentUser;
    var youths = Permissions.getAccessibleYouths();

    var html = '<div class="page-content">';

    // === 档案管理 ===
    html += '<div class="ios-card-group">';
    html += '<div class="ios-card-group-header">📋 档案管理</div>';
    if (youths.length > 0) {
      for (var i = 0; i < youths.length; i++) {
        var y = youths[i];
        var age = Utils.calculateAge(y.birthDate);
        html += '<div class="ios-card-row" data-youth-id="' + y.id + '" data-action="grants">' +
          '<div class="ios-card-row-icon avatar">' + (y.avatar || '🧑') + '</div>' +
          '<div class="ios-card-row-body">' +
            '<div class="ios-card-row-title">' + Utils.escapeHtml(y.name) + ' 授权管理</div>' +
            '<div class="ios-card-row-subtitle">' + age + '岁 · 管理访问权限、档案码</div>' +
          '</div>' +
          '<span class="ios-card-row-arrow">›</span>' +
        '</div>';
      }
    }
    html += '<button class="ios-create-row" id="btn-create-profile">✚ 创建心青年档案</button>';
    html += '</div>';

    // === 账号 ===
    html += '<div class="ios-card-group">';
    html += '<div class="ios-card-group-header">👤 账号</div>';
    html += '<div class="ios-card-row-static">' +
      '<div class="ios-card-row-icon">' + (user.avatar || '👤') + '</div>' +
      '<div class="ios-card-row-body">' +
        '<div class="ios-card-row-title">' + Utils.escapeHtml(user.name) + '</div>' +
        '<div class="ios-card-row-subtitle">' + _roleLabel(user.role) + '</div>' +
      '</div>' +
    '</div>';
    html += '<button class="ios-create-row" id="btn-logout" style="color: var(--color-danger);">退出登录</button>';
    html += '</div>';

    html += '</div>';

    container.innerHTML = html;

    // 绑定退出按钮
    var logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        AppState.logout();
        window.location.hash = 'login';
      });
    }

    // 绑定创建档案按钮
    var createBtn = document.getElementById('btn-create-profile');
    if (createBtn) {
      createBtn.addEventListener('click', function () {
        window.location.hash = 'profile?action=create';
      });
    }

    // 绑定授权管理点击
    var grantRows = document.querySelectorAll('.ios-card-row[data-action="grants"]');
    for (var i = 0; i < grantRows.length; i++) {
      grantRows[i].addEventListener('click', function (e) {
        e.stopPropagation();
        var youthId = this.getAttribute('data-youth-id');
        if (youthId) {
          AppState.selectYouth(youthId);
          window.location.hash = 'profile?youthId=' + encodeURIComponent(youthId) + '#grants';
        }
      });
    }
  }

  /**
   * 绑定主页事件
   */
  function _bindDashboardEvents(user, youths) {
    // 头像上传（复用已存在的 fileInput，避免泄漏）
    var avatarEl = document.getElementById('avatar-upload');
    if (avatarEl) {
      var fileInput = document.getElementById('avatar-file-input');
      if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileInput.id = 'avatar-file-input';
        document.body.appendChild(fileInput);
      }

      avatarEl.addEventListener('click', function (e) {
        e.stopPropagation();
        fileInput.click();
      });

      fileInput.addEventListener('change', function () {
        var file = fileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          var dataUrl = ev.target.result;
          avatarEl.style.backgroundImage = 'url(' + dataUrl + ')';
          avatarEl.style.backgroundSize = 'cover';
          avatarEl.style.backgroundPosition = 'center';
          avatarEl.textContent = '';
          var youthId = avatarEl.getAttribute('data-youth-id');
          // 保存到 localStorage
          var profiles = JSON.parse(localStorage.getItem('ai_dongwo_profiles') || '{}');
          var allProfiles = profiles.profiles || [];
          for (var k = 0; k < allProfiles.length; k++) {
            if (allProfiles[k].id === youthId) {
              allProfiles[k].avatar = dataUrl;
              break;
            }
          }
          profiles.profiles = allProfiles;
          localStorage.setItem('ai_dongwo_profiles', JSON.stringify(profiles));
        };
        reader.readAsDataURL(file);
      });
    }

    // 创建档案按钮
    var createBtn = document.getElementById('btn-create-profile');
    if (createBtn) {
      createBtn.addEventListener('click', function () {
        AppState.navigate('profile', { mode: 'create' });
        window.location.hash = 'profile?mode=create';
      });
    }

    // 档案卡片点击
    var cards = document.querySelectorAll('.youth-card, .safety-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', function () {
        var youthId = this.getAttribute('data-youth-id');
        if (youthId) {
          AppState.selectYouth(youthId);
          AppState.navigate('profile', { youthId: youthId });
          window.location.hash = 'profile?youthId=' + encodeURIComponent(youthId);
        }
      });
    }

    // 快捷操作按钮
    var quickBtns = document.querySelectorAll('.quick-action-btn[data-action]');
    for (var i = 0; i < quickBtns.length; i++) {
      quickBtns[i].addEventListener('click', function (e) {
        e.stopPropagation();
        var youthId = this.getAttribute('data-youth-id');
        var action = this.getAttribute('data-action');
        if (youthId) {
          AppState.selectYouth(youthId);
          if (action === 'quickcard') {
            window.location.hash = 'quickcard?youthId=' + encodeURIComponent(youthId);
          } else if (action === 'records') {
            window.location.hash = 'records?youthId=' + encodeURIComponent(youthId);
          }
        }
      });
    }

    // 管理入口按钮（含 iOS 卡片行）
    var mgmtBtns = document.querySelectorAll('.management-btn[data-action], .ios-card-row[data-action]');
    for (var i = 0; i < mgmtBtns.length; i++) {
      mgmtBtns[i].addEventListener('click', function (e) {
        e.stopPropagation();
        var youthId = this.getAttribute('data-youth-id');
        var action = this.getAttribute('data-action');
        if (youthId) {
          AppState.selectYouth(youthId);
          if (action === 'profile') {
            window.location.hash = 'profile?youthId=' + encodeURIComponent(youthId);
          } else if (action === 'grants') {
            window.location.hash = 'profile?youthId=' + encodeURIComponent(youthId) + '#grants';
          } else if (action === 'quickcard') {
            window.location.hash = 'quickcard?youthId=' + encodeURIComponent(youthId);
          } else if (action === 'records') {
            window.location.hash = 'records?youthId=' + encodeURIComponent(youthId);
          }
        }
      });
    }

    // 心情记录按钮
    var moodBtn = document.getElementById('btn-mood-record');
    if (moodBtn && youths.length > 0) {
      moodBtn.addEventListener('click', function () {
        AppState.selectYouth(youths[0].id);
        window.location.hash = 'chat?youthId=' + encodeURIComponent(youths[0].id);
      });
    }

    // 添加愿望按钮
    var wishBtn = document.getElementById('btn-add-wish');
    if (wishBtn && youths.length > 0) {
      wishBtn.addEventListener('click', function () {
        AppState.selectYouth(youths[0].id);
        window.location.hash = 'chat?youthId=' + encodeURIComponent(youths[0].id);
      });
    }

    // 速读卡按钮
    var quickcardBtn = document.getElementById('btn-open-quickcard');
    if (quickcardBtn && youths.length > 0) {
      quickcardBtn.addEventListener('click', function () {
        AppState.selectYouth(youths[0].id);
        window.location.hash = 'quickcard?youthId=' + encodeURIComponent(youths[0].id);
      });
    }

    // 用药提醒
    var medBtn = document.getElementById('btn-med-reminder');
    if (medBtn && youths.length > 0) {
      medBtn.addEventListener('click', function () {
        AppState.selectYouth(youths[0].id);
        window.location.hash = 'profile?youthId=' + encodeURIComponent(youths[0].id);
      });
    }

    // 待记录提醒
    var pendingBtn = document.getElementById('btn-pending-records');
    if (pendingBtn && youths.length > 0) {
      pendingBtn.addEventListener('click', function () {
        AppState.selectYouth(youths[0].id);
        window.location.hash = 'records?youthId=' + encodeURIComponent(youths[0].id);
      });
    }

    // 交接任务：状态切换
    var statusBtns = document.querySelectorAll('.handover-status-btn');
    for (var i = 0; i < statusBtns.length; i++) {
      statusBtns[i].addEventListener('click', function (e) {
        e.stopPropagation();
        var btn = this;
        var taskId = btn.getAttribute('data-task-id');
        var youthId = btn.getAttribute('data-youth-id');
        var currentStatus = btn.getAttribute('data-status');
        var nextStatus = _nextTaskStatus(currentStatus);

        // 保存当前折叠状态
        var sections = ['my', 'sent'];
        for (var si = 0; si < sections.length; si++) {
          var bodyEl = document.getElementById('handover-section-' + sections[si]);
          _handoverOpenSections[sections[si]] = bodyEl && bodyEl.classList.contains('open');
        }
        var updated = Storage.updateHandoverTask(youthId, taskId, { status: nextStatus });
        if (updated) {
          showDashboard({});
        }
      });
    }

    // 交接任务：分类折叠
    var toggles = document.querySelectorAll('.handover-toggle');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].addEventListener('click', function (e) {
        e.stopPropagation();
        var section = this.getAttribute('data-section');
        var body = document.getElementById('handover-section-' + section);
        var chevron = this.querySelector('.handover-chevron');
        if (body) {
          var isOpen = body.classList.contains('open');
          if (isOpen) {
            body.classList.remove('open');
            if (chevron) chevron.classList.remove('open');
            _handoverOpenSections[section] = false;
          } else {
            body.classList.add('open');
            if (chevron) chevron.classList.add('open');
            _handoverOpenSections[section] = true;
          }
        }
      });
    }

    // 交接任务：新建任务
    for (var i = 0; i < youths.length; i++) {
      (function (y) {
        var addBtn = document.getElementById('btn-add-handover-' + y.id);
        if (addBtn) {
          addBtn.addEventListener('click', function () {
            _showHandoverForm(y);
          });
        }
      })(youths[i]);
    }
  }

  /**
   * 获取角色中文标签
   */
  function _roleLabel(role) {
    return Constants.ROLE_LABELS[role] || role;
  }
  // 注册路由（login/register/profile/archive-code 等由各模块注册）
  function initRoutes() {
    registerRoute('dashboard', showDashboard);
    registerRoute('management', showManagement);
    // US1 路由
    registerRoute('login', Auth.renderLogin);
    registerRoute('register', Auth.renderRegister);
    registerRoute('profile', Profile.renderProfile);
    registerRoute('archive-code', ArchiveCode.renderArchiveCode);
    // 档案码扫码访问路由
    registerRoute('archive', function (params) {
      // 扫码访问：需要登录后才能查看
      if (!AppState.isLoggedIn) {
        AppState.showToast('请先登录后扫码访问档案');
        window.location.hash = 'login';
        return;
      }
      // 验证 token 后跳转到档案页
      if (params.youthId) {
        AppState.selectYouth(params.youthId);
        window.location.hash = 'profile?youthId=' + encodeURIComponent(params.youthId);
      }
    });
    // US2 路由
    registerRoute('records', Records.renderRecords);
    registerRoute('quickcard', QuickCard.renderQuickCard);
    registerRoute('timeline', Timeline.renderTimeline);
    // US3 路由
    registerRoute('chat', ChatBot.renderChat);
    // US4 路由
    registerRoute('charts', Charts.renderCharts);
    // US5 路由
    registerRoute('government', Government.renderGovernment);
  }

  /**
   * 初始化应用
   */
  function init() {
    // 初始化测试数据
    Storage.initTestData();

    // 初始化状态
    AppState.init();

    // 检查过期授权
    Permissions.checkExpired();

    // 注册路由
    initRoutes();

    // 监听导航事件 → 渲染页面
    AppState.on('onNavigate', function (data) {
      renderPage(data.page, data.params);
    });

    // 监听状态变化 → 更新 Toast
    AppState.on('onStateChange', function () {
      renderToast();
    });

    // 监听 hash 变化
    window.addEventListener('hashchange', function () {
      var parsed = parseHash();
      AppState.navigate(parsed.page, parsed.params);
    });

    // 初始加载：根据当前 hash 渲染
    var parsed = parseHash();
    if (AppState.isLoggedIn && (parsed.page === 'login' || parsed.page === 'register')) {
      window.location.hash = 'dashboard';
    } else if (!AppState.isLoggedIn && PUBLIC_PAGES.indexOf(parsed.page) === -1) {
      window.location.hash = 'login';
    } else {
      AppState.navigate(parsed.page, parsed.params);
    }
  }

  // 暴露注册函数给其他模块
  window.App = {
    registerRoute: registerRoute,
    getContainer: getContainer,
    parseHash: parseHash
  };

  // DOMContentLoaded 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
