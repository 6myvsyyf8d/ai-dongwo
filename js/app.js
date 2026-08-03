/**
 * app.js - 主入口：路由、初始化、导航
 * 负责模块初始化顺序、hash 路由分发、导航守卫
 * Apple tab bar 风格底部导航
 */
(function () {
  'use strict';

  // 不需要登录即可访问的页面
  var PUBLIC_PAGES = ['login', 'register'];
  var NO_BOTTOM_NAV_PAGES = ['login', 'register', 'government', 'chat', 'timeline', 'charts', 'teacher-workbench', 'quickcard', 'grants', 'archive-code', 'archive', 'join', 'approvals', 'permissions', 'welcome'];

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
    var user = AppState.getState().currentUser;
    // 心青年导航：首页 + 对话 + 我
    if (user && user.role === 'youth') {
      navItems = [
        { page: 'dashboard', icon: '🏠', label: '首页' },
        { page: 'youth-chat', icon: '💬', label: '对话' },
        { page: 'profile', icon: '👤', label: '我' }
      ];
    }
    // 管理员特殊导航
    if (user && user.role === 'admin') {
      navItems = Constants.ADMIN_NAV_ITEMS;
    }
    var youthId = youth ? youth.id : null;

    var html = '<nav class="bottom-nav" role="navigation" aria-label="主导航">';
    for (var i = 0; i < navItems.length; i++) {
      var item = navItems[i];
      // 可见性过滤：非心青年角色按配置过滤
      if (user && !Permissions.canAccessPage(user.role, item.page)) {
        continue;
      }
      var active = item.page === currentPage ? ' active' : '';
      var href = '#' + item.page;
      // 档案、记录、对话、速读卡需要 youthId 参数
      if (youthId && ['profile', 'quickcard', 'records', 'chat', 'timeline', 'charts', 'analytics'].indexOf(item.page) > -1) {
        href += '?youthId=' + encodeURIComponent(youthId);
      }
      var iconHtml = item.icon;
      // 如果是 icon-xxx 格式的 class 名，渲染为 span 元素
      if (item.icon.indexOf('icon-') === 0) {
        iconHtml = '<span class="' + item.icon + '"></span>';
      }
      html += '<a class="bottom-nav-item' + active + '" href="' + href + '" role="link" aria-label="' + item.label + '">' +
        '<span class="bottom-nav-icon">' + iconHtml + '</span>' +
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

    // 已登录但访问 login/register，重定向到对应首页
    if (AppState.isLoggedIn && PUBLIC_PAGES.indexOf(page) > -1) {
      var curUser = AppState.currentUser;
      if (curUser && curUser.role === 'youth') {
        window.location.hash = 'youth-chat';
      } else if (curUser && curUser.role === 'admin') {
        window.location.hash = 'admin';
      } else if (curUser && curUser.role === 'government') {
        window.location.hash = 'government';
      } else {
        window.location.hash = 'dashboard';
      }
      return;
    }

    // 政府角色限制：只能访问 government 页面
    if (AppState.currentUser && AppState.currentUser.role === 'government' && page !== 'government') {
      // 试图访问个体档案：明确告知数据主权保护
      if (page === 'archive') {
        AppState.showToast('个体档案受数据主权保护，政府角色仅可查看聚合数据');
      }
      window.location.hash = 'government';
      return;
    }

    // 可见性检查：非公开页面需验证角色权限
    if (PUBLIC_PAGES.indexOf(page) === -1) {
      var currentUser = AppState.getState().currentUser;
      if (currentUser && !Permissions.canAccessPage(currentUser.role, page)) {
        page = 'dashboard';
      }
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

    // 游离状态检测：老师/照护者无任何心青年档案
    if (['teacher', 'caregiver'].indexOf(user.role) > -1) {
      if (youths.length === 0) {
        _renderUnboundDashboard(container, user);
        return;
      }
    }

    // 心青年游离态：等待家长邀请
    if (user.role === 'youth' && youths.length === 0) {
      _renderYouthUnboundDashboard(container, user);
      return;
    }

    // 无档案：灯塔愿景横幅（仅家长等可创建档案的角色）
    if (youths.length === 0 && user.role === 'parent') {
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
      default: contentHtml = _renderDefaultDashboard(user, youths);
    }

    container.innerHTML = headerHtml + '<div class="dashboard">' + contentHtml + '</div>';

    _bindDashboardEvents(user, youths);
  }

  /**
   * 渲染游离状态首页（老师/照护者无任何心青年档案）
   */
  function _renderUnboundDashboard(container, user) {
    var roleLabel = Constants.ROLE_LABELS[user.role] || user.role;
    var roleIcon = '';
    for (var i = 0; i < Constants.ROLES.length; i++) {
      if (Constants.ROLES[i].value === user.role) {
        roleIcon = Constants.ROLES[i].icon;
        break;
      }
    }

    container.innerHTML = '<div class="page-content">' +
      '<div class="dashboard-empty">' +
        '<div class="dashboard-empty-icon">' + roleIcon + '</div>' +
        '<div class="dashboard-empty-title">欢迎，' + Utils.escapeHtml(user.name) + '</div>' +
        '<div class="dashboard-empty-text">您是<strong>' + roleLabel + '</strong>，还未加入任何心青年档案。<br>请通过档案码加入。</div>' +
        '<div class="dashboard-empty-actions">' +
          '<button class="dashboard-empty-btn" id="btn-scan-join">📷 扫码加入</button>' +
          '<a class="dashboard-empty-link" id="link-input-code">输入档案码</a>' +
        '</div>' +
      '</div>' +
    '</div>';

    document.getElementById('btn-scan-join').addEventListener('click', function () {
      // 调用摄像头扫码（使用浏览器原生 API）
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        _startScanCamera();
      } else {
        AppState.showToast('当前环境不支持扫码，请使用"输入档案码"');
      }
    });

    document.getElementById('link-input-code').addEventListener('click', function () {
      var url = prompt('请输入档案码链接或粘贴 URL：');
      if (url) {
        _handleArchiveUrl(url);
      }
    });
  }

  /**
   * 渲染心青年游离态首页（等待家长邀请）
   */
  function _renderYouthUnboundDashboard(container, user) {
    container.innerHTML = '<div class="page-content">' +
      '<div class="dashboard-empty">' +
        '<div class="dashboard-empty-icon">🌻</div>' +
        '<div class="dashboard-empty-title">欢迎，' + Utils.escapeHtml(user.name) + '</div>' +
        '<div class="dashboard-empty-text">请等待家长邀请加入档案<br>或联系家长获取档案码</div>' +
      '</div>' +
    '</div>';
  }

  /**
   * 解析档案码 URL 并跳转速读卡
   */
  function _handleArchiveUrl(url) {
    // 解析档案码 URL
    var match = url.match(/#archive\/([a-zA-Z0-9-]+)/);
    if (match) {
      var youthId = decodeURIComponent(match[1]);
      // 验证档案码是否过期
      var archiveCode = Storage.getArchiveCode(youthId);
      if (!archiveCode || ArchiveCode.isCodeExpired(archiveCode)) {
        AppState.showToast('档案码已过期，请联系对方重新生成');
        return;
      }
      window.location.hash = 'quickcard?youthId=' + encodeURIComponent(youthId) + '&via=scan';
    } else {
      AppState.showToast('无法识别档案码');
    }
  }

  /**
   * 启动摄像头扫码（依赖 jsQR 库解析二维码）
   */
  function _startScanCamera() {
    // 创建扫码 overlay
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

        // 使用 jsQR 或类似库解析二维码
        // 简化：提示用户使用输入方式
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
                _handleArchiveUrl(code.data);
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

  /**
   * 渲染页头（所有角色共用）
   */
  function _renderDashboardHeader() {
    return '<div class="page-header">' +
      '<span class="page-title">AI懂我</span>' +
      '<div class="top-bar-actions">' +
        '<span class="header-version">v1.0_20260803-2</span>' +
        '<button class="top-bar-btn" id="btn-logout" style="color: var(--color-danger);">退出</button>' +
      '</div>' +
    '</div>';
  }

  /**
   * 心青年主页：自己档案 + 我的任务 + 交接
   */
  function _renderYouthDashboard(user, youths) {
    var html = '';
    var youth = youths.length > 0 ? youths[0] : null;

    if (!youth) {
      html += '<div class="empty-state"><div class="empty-state-icon">🌱</div><div class="empty-state-title">暂无档案</div><div class="empty-state-desc">请联系家长为你创建档案</div></div>';
      return html;
    }

    // 问候区（与其他角色一致，但心青年不创建任务，无"新建任务"按钮）
    var hour = new Date().getHours();
    var greeting = hour < 6 ? '凌晨好' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
    var today = Utils.formatDate(new Date());
    var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    var weekday = '周' + weekdays[new Date().getDay()];

    html += '<div class="dashboard-greeting">' +
      '<div class="dashboard-greeting-left">' +
        '<div class="dashboard-greeting-date">' + today + ' ' + weekday + '</div>' +
        '<div class="dashboard-greeting-hello">' + greeting + '，' + Utils.escapeHtml(user.name) + '</div>' +
      '</div>' +
    '</div>';

    // 任务看板（与其他角色一致的 Kanban 三列视图，只显示分配给心青年的任务）
    html += _renderTaskKanban(youth, user);

    // 管理入口
    html += '<div class="dashboard-section">' +
      '<div class="dashboard-section-title">📌 管理</div>' +
      '<div class="management-portal">' +
        '<button class="management-btn" data-youth-id="' + youth.id + '" data-action="profile">' +
          '<span class="management-btn-icon">📋</span>' +
          '<span class="management-btn-label">查看完整档案</span>' +
          '<span class="management-btn-arrow">→</span>' +
        '</button>' +
      '</div>' +
    '</div>';

    html += '<div class="dashboard-footer-space"></div>';

    return html;
  }

  function _getAIFindings(youths) {
    var allFindings = [];
    for (var i = 0; i < youths.length; i++) {
      var key = 'ai_dongwo_ai_findings_' + youths[i].id;
      try {
        var raw = localStorage.getItem(key);
        var findings = raw ? JSON.parse(raw) : [];
        for (var j = 0; j < findings.length; j++) {
          if (findings[j].status === 'pending') {
            findings[j]._youthId = youths[i].id;
            allFindings.push(findings[j]);
          }
        }
      } catch (e) {}
    }
    return allFindings;
  }

  function _reviewAIFinding(findingId, action) {
    // 遍历所有心青年的 AI 发现
    var youths = Permissions.getAccessibleYouths();
    for (var i = 0; i < youths.length; i++) {
      var key = 'ai_dongwo_ai_findings_' + youths[i].id;
      try {
        var raw = localStorage.getItem(key);
        var findings = raw ? JSON.parse(raw) : [];
        var found = false;
        for (var j = 0; j < findings.length; j++) {
          if (findings[j].id === findingId) {
            if (action === 'approve') {
              findings[j].status = 'approved';
              // 写入档案记录
              var user = AppState.currentUser;
              var record = {
                id: Utils.generateUUID(),
                youthId: youths[i].id,
                recorderId: user.id,
                recorderRole: user.role,
                module: findings[j].module,
                recordType: 'observation',
                content: { text: findings[j].text, tags: ['AI发现'] },
                inputMode: 'ai',
                visibilityLevel: 'full',
                recordedAt: Utils.formatDateTime(),
                isOffline: !navigator.onLine,
                syncedAt: navigator.onLine ? Utils.formatDateTime() : null
              };
              Storage.addRecord(youths[i].id, record);
              AppState.showToast('✅ 已采纳并写入档案');
            } else {
              findings[j].status = 'rejected';
              AppState.showToast('已忽略');
            }
            found = true;
            break;
          }
        }
        if (found) {
          localStorage.setItem(key, JSON.stringify(findings));
          // 刷新首页
          var hash = window.location.hash;
          window.location.hash = '';
          window.location.hash = hash;
          break;
        }
      } catch (e) {}
    }
  }

  /**
   * 家长主页：问候区 + 今日交接 + 健康速报
   */
  function _renderParentDashboard(user, youths) {
    var html = '';
    var y = youths.length > 0 ? youths[0] : null;

    if (!y) {
      html += '<div class="empty-state"><div class="empty-state-icon">🌱</div><div class="empty-state-title">开始你的第一个档案</div><div class="empty-state-desc">前往「管理」页面创建心青年档案</div></div>';
      return html;
    }

    var age = Utils.calculateAge(y.birthDate);
    var hour = new Date().getHours();
    var greeting = hour < 6 ? '凌晨好' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
    var today = Utils.formatDate(new Date());
    var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    var weekday = '周' + weekdays[new Date().getDay()];

    // 顶部问候区
    html += '<div class="dashboard-greeting">' +
      '<div class="dashboard-greeting-left">' +
        '<div class="dashboard-greeting-date">' + today + ' ' + weekday + '</div>' +
        '<div class="dashboard-greeting-hello">' + greeting + '，' + Utils.escapeHtml(user.name) + '</div>' +
      '</div>' +
      '<button class="btn-create-task" id="btn-create-task-' + y.id + '" aria-label="新建任务">✚ 新建任务</button>' +
    '</div>';

    // AI 发现区块（仅家长可见）
    var aiFindings = _getAIFindings(youths);
    if (aiFindings.length > 0) {
      html += '<div class="ios-card-group">';
      html += '<div class="ios-card-group-header"><span>💡 AI 发现</span><span style="font-size:11px;color:var(--color-text-tertiary);">' + aiFindings.length + ' 条待审核</span></div>';
      for (var fi = 0; fi < aiFindings.length; fi++) {
        var f = aiFindings[fi];
        html += '<div class="ios-card-row-static" style="display:flex;align-items:center;gap:8px;">' +
          '<div style="flex:1;">' +
            '<div class="ios-card-row-title" style="font-size:14px;">' + Utils.escapeHtml(f.text) + '</div>' +
            '<div class="ios-card-row-subtitle">' + Utils.formatDate(f.timestamp) + ' · ' + (f.module === 'emotionBehavior' ? '😊 情绪行为' : f.module === 'workSupport' ? '💼 工作支持' : '💬 沟通') + '</div>' +
          '</div>' +
          '<button class="btn btn-sm" style="background:#34c759;color:white;border:none;border-radius:8px;padding:6px 12px;" data-finding-id="' + f.id + '" data-action="approve">✓ 采纳</button>' +
          '<button class="btn btn-sm" style="background:rgba(255,255,255,0.04);color:var(--color-text-secondary);border:none;border-radius:8px;padding:6px 12px;" data-finding-id="' + f.id + '" data-action="reject">✕</button>' +
        '</div>';
      }
      html += '</div>';
    }

    // 任务看板（Kanban 三列：待办 / 进行中 / 已完成）
    html += _renderTaskKanban(y, user);

    // 今日健康速报
    html += AnalyticsUI.renderHealthCard(y);

    html += '<div class="dashboard-footer-space"></div>';

    return html;
  }

  /**
   * 老师主页：问候区 + 合并交接任务表 + 快捷操作（monday.com 风格）
   */
  function _renderTeacherDashboard(user, youths) {
    var html = '';

    if (youths.length === 0) {
      html += '<div class="empty-state"><div class="empty-state-icon">📚</div><div class="empty-state-title">暂无学生档案</div><div class="empty-state-desc">请联系家长获取授权</div></div>';
      return html;
    }

    // 问候区
    var hour = new Date().getHours();
    var greeting = hour < 6 ? '凌晨好' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
    var today = Utils.formatDate(new Date());
    var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    var weekday = '周' + weekdays[new Date().getDay()];

    html += '<div class="dashboard-greeting">' +
      '<div class="dashboard-greeting-left">' +
        '<div class="dashboard-greeting-date">' + today + ' ' + weekday + '</div>' +
        '<div class="dashboard-greeting-hello">' + greeting + '，' + Utils.escapeHtml(user.name) + '</div>' +
        '<div class="dashboard-greeting-meta">' + (user.institutionName || '') + '</div>' +
      '</div>' +
      '<button class="btn-create-task" id="btn-create-task-' + youths[0].id + '" aria-label="新建任务">✚ 新建任务</button>' +
    '</div>';

    // 任务看板（Kanban 三列，多学生合并，卡片上显示学生名）
    html += _renderTaskKanban(youths, user, { showYouthName: true });

    // 专业工作台入口（含记录观察、查看档案子入口）
    html += '<div class="dashboard-section">' +
      '<div class="ios-card-group">' +
        '<a href="#teacher-workbench" class="ios-card-row-static" style="text-decoration:none;color:inherit;">' +
          '<div class="ios-card-row-body">' +
            '<div class="ios-card-row-title">🎓 专业工作台</div>' +
            '<div class="ios-card-row-subtitle">ISP · 能力评估 · 干预记录 · 情绪趋势</div>' +
          '</div>' +
          '<div style="font-size:20px;">›</div>' +
        '</a>' +
        '<button class="ios-card-row-static" id="btn-teacher-record" style="width:100%;text-align:left;background:none;border:none;color:inherit;cursor:pointer;">' +
          '<div class="ios-card-row-body">' +
            '<div class="ios-card-row-title">📝 记录观察</div>' +
            '<div class="ios-card-row-subtitle">记录学生行为、情绪、学习表现</div>' +
          '</div>' +
          '<div style="font-size:20px;">›</div>' +
        '</button>' +
        '<button class="ios-card-row-static" id="btn-teacher-profile" style="width:100%;text-align:left;background:none;border:none;color:inherit;cursor:pointer;">' +
          '<div class="ios-card-row-body">' +
            '<div class="ios-card-row-title">📋 查看档案</div>' +
            '<div class="ios-card-row-subtitle">学生完整档案、速读卡、护理记录</div>' +
          '</div>' +
          '<div style="font-size:20px;">›</div>' +
        '</button>' +
      '</div>' +
    '</div>';

    html += '<div class="dashboard-footer-space"></div>';

    return html;
  }

  /**
   * 照护者主页：每日交接 + 护理记录入口
   */
  function _renderCaregiverDashboard(user, youths) {
    var html = '';

    if (youths.length === 0) {
      html += '<div class="empty-state"><div class="empty-state-icon">🤝</div><div class="empty-state-title">暂无照护对象</div><div class="empty-state-desc">请联系家长获取授权</div></div>';
      return html;
    }

    // 问候区（与家长/老师一致，右上角"新建任务"按钮）
    var hour = new Date().getHours();
    var greeting = hour < 6 ? '凌晨好' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
    var today = Utils.formatDate(new Date());
    var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    var weekday = '周' + weekdays[new Date().getDay()];

    html += '<div class="dashboard-greeting">' +
      '<div class="dashboard-greeting-left">' +
        '<div class="dashboard-greeting-date">' + today + ' ' + weekday + '</div>' +
        '<div class="dashboard-greeting-hello">' + greeting + '，' + Utils.escapeHtml(user.name) + '</div>' +
      '</div>' +
      '<button class="btn-create-task" id="btn-create-task-' + youths[0].id + '" aria-label="新建任务">✚ 新建任务</button>' +
    '</div>';

    // 任务看板（Kanban 三列：待办 / 进行中 / 已完成）
    html += _renderTaskKanban(youths, user);

    // 管理入口（含护理记录、速读卡等）
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

    return html;
  }

  /**
   * 默认主页（未知角色）
   */
  function _renderDefaultDashboard(user, youths) {
    return '<div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-title">欢迎使用 AI懂我</div><div class="empty-state-desc">请选择您的角色开始使用</div></div>';
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
   * 显示统一任务创建表单（支持 routine/adhoc 两种类型）
   * @param {object} youth - 心青年档案
   * @param {string} defaultType - 默认选中的类型: 'routine' | 'adhoc'
   */
  function _showTaskForm(youth, defaultType) {
    defaultType = defaultType || 'routine';
    var currentUser = AppState.currentUser;

    var overlay = document.createElement('div');
    overlay.className = 'record-form-overlay';
    overlay.id = 'task-form-overlay';

    // 获取授权用户列表
    var grants = Storage.getAccessGrants(youth.id);
    var seenIds = {};

    // 接收人选项（包含心青年和照护者）
    var assigneeOptions = '<option value="">请选择接收人</option>';
    // 心青年本人
    if (youth.id !== currentUser.id) {
      assigneeOptions += '<option value="' + youth.id + '">' + Utils.escapeHtml(youth.name) + '（心青年）</option>';
    }
    for (var i = 0; i < grants.length; i++) {
      var g = grants[i];
      if (g.granteeId === currentUser.id) continue;
      if (g.granteeRole === 'government') continue;
      if (seenIds[g.granteeId]) continue;
      seenIds[g.granteeId] = true;
      var account = Storage.getAccount(g.granteeId);
      var label = account ? account.name : g.granteeId;
      var roleLabel = Constants.ROLE_LABELS[g.granteeRole] || g.granteeRole;
      assigneeOptions += '<option value="' + g.granteeId + '">' + Utils.escapeHtml(label) + '（' + roleLabel + '）</option>';
    }

    var today = Utils.formatDate(new Date());

    // 类型选择器（规律任务 + 临时任务）
    var typeSelectorHtml =
      '<div class="task-type-selector">' +
        '<div class="task-type-option task-type-routine' + (defaultType === 'routine' ? ' selected' : '') + '" data-type="routine">' +
          '<div class="task-type-badge">🔁</div>' +
          '<div class="task-type-info">' +
            '<div class="task-type-name">规律任务</div>' +
            '<div class="task-type-desc">每日 / 每周重复</div>' +
          '</div>' +
          '<div class="task-type-check" aria-hidden="true">✓</div>' +
        '</div>' +
        '<div class="task-type-option task-type-adhoc' + (defaultType === 'adhoc' ? ' selected' : '') + '" data-type="adhoc">' +
          '<div class="task-type-badge">📝</div>' +
          '<div class="task-type-info">' +
            '<div class="task-type-name">临时任务</div>' +
            '<div class="task-type-desc">一次性 · 到期提醒</div>' +
          '</div>' +
          '<div class="task-type-check" aria-hidden="true">✓</div>' +
        '</div>' +
      '</div>';

    overlay.innerHTML =
      '<div class="record-form-sheet">' +
        '<div class="record-form-header">' +
          '<span class="record-form-title">新建任务</span>' +
          '<button class="record-form-close" id="btn-close-task-form">×</button>' +
        '</div>' +
        '<div class="record-form-body">' +
          // 类型选择器（分组式）
          '<div class="form-group">' +
            '<label class="form-label">任务类型</label>' +
            typeSelectorHtml +
          '</div>' +
          // 公共字段：任务内容
          '<div class="form-group">' +
            '<label class="form-label">任务内容</label>' +
            '<textarea class="form-textarea" id="task-content" placeholder="例如：早上8点吃药..." maxlength="500"></textarea>' +
          '</div>' +
          // 公共字段：分类
          '<div class="form-group">' +
            '<label class="form-label">分类</label>' +
            '<select class="form-input" id="task-category">' +
              '<option value="medication">💊 用药</option>' +
              '<option value="meal">🍽️ 饮食</option>' +
              '<option value="hygiene">🚿 卫生</option>' +
              '<option value="activity">🎯 活动</option>' +
              '<option value="learning">📚 学习</option>' +
              '<option value="other">📋 其他</option>' +
            '</select>' +
          '</div>' +
          // 接收人字段（routine/adhoc 用）
          '<div class="form-group task-field task-field-routine task-field-adhoc" style="display:none;">' +
            '<label class="form-label">任务接收人</label>' +
            '<select class="form-input" id="task-assignee">' + assigneeOptions + '</select>' +
          '</div>' +
          // routine 字段：重复频率
          '<div class="form-group task-field task-field-routine" style="display:none;">' +
            '<label class="form-label">重复频率</label>' +
            '<select class="form-input" id="task-recurrence-pattern">' +
              '<option value="daily">每天</option>' +
              '<option value="weekly">每周</option>' +
              '<option value="custom">自定义</option>' +
            '</select>' +
          '</div>' +
          // routine 字段：执行时间
          '<div class="form-group task-field task-field-routine" style="display:none;">' +
            '<label class="form-label">执行时间</label>' +
            '<input type="time" class="form-input" id="task-recurrence-time" value="08:00">' +
          '</div>' +
          // routine 字段：重复日期（weekly/custom 时显示）
          '<div class="form-group task-field task-field-routine task-field-weekly" style="display:none;">' +
            '<label class="form-label">重复日期</label>' +
            '<div class="weekday-selector">' +
              '<span class="weekday-chip" data-day="1">一</span>' +
              '<span class="weekday-chip" data-day="2">二</span>' +
              '<span class="weekday-chip" data-day="3">三</span>' +
              '<span class="weekday-chip" data-day="4">四</span>' +
              '<span class="weekday-chip" data-day="5">五</span>' +
              '<span class="weekday-chip" data-day="6">六</span>' +
              '<span class="weekday-chip" data-day="0">日</span>' +
            '</div>' +
          '</div>' +
          // adhoc 字段：到期日期
          '<div class="form-group task-field task-field-adhoc" style="display:none;">' +
            '<label class="form-label">到期日期</label>' +
            '<input type="date" class="form-input" id="task-due-date" value="' + today + '">' +
          '</div>' +
          // adhoc 字段：到期时间
          '<div class="form-group task-field task-field-adhoc" style="display:none;">' +
            '<label class="form-label">到期时间</label>' +
            '<input type="time" class="form-input" id="task-due-time" value="12:00">' +
          '</div>' +
          '<div class="form-error" id="task-form-error" style="display:none;"></div>' +
          '<button class="btn btn-primary btn-block btn-lg" id="btn-save-task" style="margin-top:16px;">创建任务</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    // 关闭事件
    overlay.querySelector('#btn-close-task-form').addEventListener('click', function () {
      document.body.removeChild(overlay);
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    // 类型切换
    function _switchType(type) {
      var typeOptions = overlay.querySelectorAll('.task-type-option');
      for (var ti = 0; ti < typeOptions.length; ti++) {
        typeOptions[ti].classList.toggle('selected', typeOptions[ti].getAttribute('data-type') === type);
      }
      var fields = overlay.querySelectorAll('.task-field');
      for (var fi = 0; fi < fields.length; fi++) {
        fields[fi].style.display = 'none';
      }
      var showFields = overlay.querySelectorAll('.task-field-' + type);
      for (var sf = 0; sf < showFields.length; sf++) {
        showFields[sf].style.display = '';
      }
      // routine 的 weekly 子字段
      _toggleWeeklyField(type);
    }

    function _toggleWeeklyField(type) {
      var weeklyField = overlay.querySelector('.task-field-weekly');
      if (!weeklyField) return;
      if (type !== 'routine') {
        weeklyField.style.display = 'none';
        return;
      }
      var pattern = overlay.querySelector('#task-recurrence-pattern');
      var pat = pattern ? pattern.value : 'daily';
      weeklyField.style.display = (pat === 'weekly' || pat === 'custom') ? '' : 'none';
    }

    var typeOptions = overlay.querySelectorAll('.task-type-option');
    for (var ti = 0; ti < typeOptions.length; ti++) {
      typeOptions[ti].addEventListener('click', function () {
        _switchType(this.getAttribute('data-type'));
      });
    }

    // 重复频率切换
    var patternSelect = overlay.querySelector('#task-recurrence-pattern');
    if (patternSelect) {
      patternSelect.addEventListener('change', function () {
        var currentType = overlay.querySelector('.task-type-option.selected');
        _toggleWeeklyField(currentType ? currentType.getAttribute('data-type') : 'routine');
      });
    }

    // weekday 选择
    var weekdayChips = overlay.querySelectorAll('.weekday-chip');
    for (var wi = 0; wi < weekdayChips.length; wi++) {
      weekdayChips[wi].addEventListener('click', function () {
        this.classList.toggle('selected');
      });
    }

    // 初始化显示默认类型字段
    _switchType(defaultType);

    // 提交
    overlay.querySelector('#btn-save-task').addEventListener('click', function () {
      var contentText = overlay.querySelector('#task-content').value.trim();
      var category = overlay.querySelector('#task-category').value;
      var errorEl = overlay.querySelector('#task-form-error');
      var selectedTypeEl = overlay.querySelector('.task-type-option.selected');
      var taskType = selectedTypeEl ? selectedTypeEl.getAttribute('data-type') : 'routine';

      if (!contentText) {
        errorEl.textContent = '请输入任务内容';
        errorEl.style.display = 'block';
        return;
      }

      var task = {
        youthId: youth.id,
        taskType: taskType,
        content: contentText,
        category: category,
        status: 'todo'
      };

      if (taskType === 'routine') {
        // 接收人校验
        var routineAssigneeId = overlay.querySelector('#task-assignee').value;
        if (!routineAssigneeId) {
          errorEl.textContent = '请选择任务接收人';
          errorEl.style.display = 'block';
          return;
        }
        if (routineAssigneeId === currentUser.id) {
          errorEl.textContent = '不能给自己分配任务';
          errorEl.style.display = 'block';
          return;
        }
        var routineAccount = Storage.getAccount(routineAssigneeId);
        task.assigneeId = routineAssigneeId;
        task.assigneeRole = routineAccount ? routineAccount.role : 'youth';

        var pattern = overlay.querySelector('#task-recurrence-pattern').value;
        var time = overlay.querySelector('#task-recurrence-time').value || '08:00';
        var daysOfWeek = [];
        var selectedChips = overlay.querySelectorAll('.weekday-chip.selected');
        for (var ci = 0; ci < selectedChips.length; ci++) {
          daysOfWeek.push(parseInt(selectedChips[ci].getAttribute('data-day'), 10));
        }
        if ((pattern === 'weekly' || pattern === 'custom') && daysOfWeek.length === 0) {
          errorEl.textContent = '请选择至少一个重复日期';
          errorEl.style.display = 'block';
          return;
        }
        task.recurrence = {
          pattern: pattern,
          timeOfDay: time,
          daysOfWeek: daysOfWeek
        };
        task.dueTime = null;
      } else if (taskType === 'adhoc') {
        // 接收人校验
        var adhocAssigneeId = overlay.querySelector('#task-assignee').value;
        if (!adhocAssigneeId) {
          errorEl.textContent = '请选择任务接收人';
          errorEl.style.display = 'block';
          return;
        }
        if (adhocAssigneeId === currentUser.id) {
          errorEl.textContent = '不能给自己分配任务';
          errorEl.style.display = 'block';
          return;
        }
        var adhocAccount = Storage.getAccount(adhocAssigneeId);
        task.assigneeId = adhocAssigneeId;
        task.assigneeRole = adhocAccount ? adhocAccount.role : 'youth';

        var dueDate = overlay.querySelector('#task-due-date').value;
        var dueTime = overlay.querySelector('#task-due-time').value || '12:00';
        if (!dueDate) {
          errorEl.textContent = '请选择到期日期';
          errorEl.style.display = 'block';
          return;
        }
        task.dueTime = dueDate + ' ' + dueTime;
      }

      Storage.addTask(youth.id, task);
      document.body.removeChild(overlay);
      showDashboard({});
    });
  }

  // ==================== Kanban 任务看板 ====================

  /**
   * Kanban 状态流转：todo → in_progress → done → todo（循环）
   */
  function _nextKanbanStatus(current) {
    if (current === 'todo') return 'in_progress';
    if (current === 'in_progress') return 'done';
    return 'todo';
  }

  /**
   * 渲染单张 Kanban 任务卡片
   * @param {object} task - 统一任务对象
   * @param {object} youth - 心青年档案（用于 data-youth-id 和学生名展示）
   * @param {boolean} showYouthName - 是否在卡片上显示心青年名（多学生合并时）
   */
  function _renderKanbanCard(task, youth, showYouthName) {
    // 接收人
    var assigneeName = '';
    if (task.assigneeId) {
      var account = Storage.getAccount(task.assigneeId);
      assigneeName = account ? account.name : '';
    }
    if (!assigneeName && task.assigneeRole) {
      assigneeName = Constants.ROLE_LABELS[task.assigneeRole] || task.assigneeRole;
    }

    // 时间：优先 dueTime，其次相对时间
    var timeText = '';
    if (task.dueTime) {
      timeText = task.dueTime.length > 10 ? task.dueTime.substring(11, 16) : task.dueTime;
    } else if (task.updatedAt) {
      timeText = _relativeTime(task.updatedAt);
    }

    var nextStatus = _nextKanbanStatus(task.status);
    // 按钮文案描述"点击后发生的动作"，按当前 status 索引
    var actionLabels = { todo: '开始', in_progress: '完成', done: '重启' };
    var actionLabel = actionLabels[task.status] || '推进';

    var isDone = task.status === 'done';
    var cardClass = 'kanban-card' + (isDone ? ' kanban-card-done' : '');

    // 心青年角色：隐藏冗余的"心青年"负责人字样
    var currentUser = AppState.getState().currentUser;
    if (currentUser && currentUser.role === 'youth') {
      if (assigneeName === '心青年') assigneeName = '';
    }

    var html = '<div class="' + cardClass + '" data-task-id="' + task.id + '" data-youth-id="' + youth.id + '">' +
      // 多学生合并时在内容上方显示学生名小标签
      (showYouthName ? '<div class="kanban-card-youth-tag">' + Utils.escapeHtml(youth.name) + '</div>' : '') +
      // 任务内容（主要信息）
      '<div class="kanban-card-content' + (isDone ? ' kanban-card-content-done' : '') + '">' +
        Utils.escapeHtml(task.content) +
      '</div>' +
      // 负责人行
      '<div class="kanban-card-assignee">';

    if (assigneeName) {
      html += '<span class="kanban-card-to">' + Utils.escapeHtml(assigneeName) + '</span>';
    }

    html += '</div>' +
      // 底部 meta：时间
      '<div class="kanban-card-meta">';

    if (timeText) {
      html += '<span class="kanban-card-time">' + Utils.escapeHtml(timeText) + '</span>';
    }

    html += '</div>' +
      '<button class="kanban-status-btn" data-task-id="' + task.id + '" data-youth-id="' + youth.id + '" data-status="' + task.status + '" title="点击切换状态">' +
        actionLabel +
      '</button>' +
    '</div>';

    return html;
  }

  /**
   * 渲染任务看板（Kanban 三列）— 用于照护者/家长/老师首页
   * @param {object|Array} youthOrYouths - 单个心青年档案或数组（多学生合并）
   * @param {object} currentUser - 当前用户
   * @param {object} options - { showYouthName: boolean } 多学生合并时在卡片上显示学生名
   */
  function _renderTaskKanban(youthOrYouths, currentUser, options) {
    options = options || {};
    var showYouthName = options.showYouthName || false;
    var youths = Array.isArray(youthOrYouths) ? youthOrYouths : [youthOrYouths];

    // 收集所有学生的今日任务
    var allTasks = [];
    var taskYouthMap = {}; // taskId -> youth
    for (var yi = 0; yi < youths.length; yi++) {
      var y = youths[yi];
      var todayTasks = Storage.getTodayTasks(y.id);

      // 过滤：与当前用户相关的任务
      var filtered;
      if (currentUser) {
        filtered = todayTasks.filter(function (t) {
          if (t.assigneeId && t.assigneeId === currentUser.id) return true;
          if (t.assigneeRole && t.assigneeRole === currentUser.role) return true;
          return false;
        });
      } else {
        filtered = todayTasks.slice();
      }

      for (var ti = 0; ti < filtered.length; ti++) {
        taskYouthMap[filtered[ti].id] = y;
        allTasks.push(filtered[ti]);
      }
    }

    // 按状态分组
    var columns = { todo: [], in_progress: [], done: [] };
    for (var i = 0; i < allTasks.length; i++) {
      var status = allTasks[i].status || 'todo';
      if (!columns[status]) columns[status] = [];
      columns[status].push(allTasks[i]);
    }

    // 每列内按时间倒序
    ['todo', 'in_progress', 'done'].forEach(function (s) {
      columns[s].sort(function (a, b) {
        var aTime = new Date(a.updatedAt || a.createdAt).getTime();
        var bTime = new Date(b.updatedAt || b.createdAt).getTime();
        return bTime - aTime;
      });
    });

    var html = '<div class="ios-card-group kanban-group">';
    html += '<div class="ios-card-group-header" style="display:flex;justify-content:space-between;align-items:center;">' +
      '<span>📋 任务看板</span>' +
      '<span style="font-size:11px;color:var(--color-text-tertiary);font-weight:400;">' + allTasks.length + ' 条</span>' +
    '</div>';

    html += '<div class="kanban-board">';

    // 渲染三列：单学生直接传 youth；多学生合并时需要把每张卡片对应的学生传进去
    // 由于卡片可能在任意列，我们用 taskYouthMap 查找
    ['todo', 'in_progress', 'done'].forEach(function (s) {
      var columnTasks = columns[s];
      var titleMap = { todo: '待办', in_progress: '进行中', done: '已完成' };
      html += '<div class="kanban-column kanban-column-' + s + '">' +
        '<div class="kanban-column-header">' +
          '<span class="kanban-column-title">' + titleMap[s] + '</span>' +
          '<span class="kanban-column-count">' + columnTasks.length + '</span>' +
        '</div>' +
        '<div class="kanban-column-body">';

      if (columnTasks.length === 0) {
        html += '<div class="kanban-empty">暂无</div>';
      } else {
        for (var ci = 0; ci < columnTasks.length; ci++) {
          var t = columnTasks[ci];
          var taskYouth = taskYouthMap[t.id] || youths[0];
          html += _renderKanbanCard(t, taskYouth, showYouthName);
        }
      }
      html += '</div></div>';
    });

    html += '</div>'; // end kanban-board
    html += '</div>'; // end kanban-group
    return html;
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
    var user = AppState.currentUser;

    // 管理员：显示管理后台
    if (user && user.role === 'admin') {
      Admin.showAdmin();
      return;
    }

    var container = getContainer();
    var youths = Permissions.getAccessibleYouths();

    var html = '<div class="page-header page-header--center">' +
      '<span class="page-title">管理</span>' +
    '</div>' +
    '<div class="page-content">';

    // 我的权限 — 入口卡片
    var userHasRead = AppState.canRead;
    if (user && user.role !== 'admin' && userHasRead) {
      html += '<div class="ios-card-group">';
      html += '<div class="ios-card-row" data-action="permissions" style="cursor:pointer;">' +
        '<div class="ios-card-row-icon" style="background:rgba(138, 168, 232, 0.1);border-radius:12px;">🔓</div>' +
        '<div class="ios-card-row-body">' +
          '<div class="ios-card-row-title">我的权限</div>' +
          '<div class="ios-card-row-subtitle">查看可访问的模块和功能</div>' +
        '</div>' +
        '<span class="ios-card-row-arrow">›</span>' +
      '</div>';
      html += '</div>';
    }

    // === 授权管理 ===（家长可见，含待审批红点）
    if (user.role === 'parent' && youths.length > 0) {
      html += '<div class="ios-card-group">';
      html += '<div class="ios-card-group-header">🔑 授权管理</div>';
      for (var i = 0; i < youths.length; i++) {
        var y = youths[i];
        var age = Utils.calculateAge(y.birthDate);
        var grants = Storage.getAccessGrants(y.id);
        var activeCount = grants.filter(function (g) { return g.status === 'active'; }).length;
        var pendingRequests = Storage.getPendingJoinRequests(y.id);
        var pendingCount = pendingRequests.length;
        html += '<div class="ios-card-row" data-youth-id="' + y.id + '" data-action="grants">' +
          '<div class="ios-card-row-icon avatar">' + (y.avatar || '🧑') + '</div>' +
          '<div class="ios-card-row-body">' +
            '<div class="ios-card-row-title">' + Utils.escapeHtml(y.name) + ' 授权管理</div>' +
            '<div class="ios-card-row-subtitle">' + activeCount + ' 位已授权' + (pendingCount > 0 ? ' · ' + pendingCount + ' 条待审批' : '') + '</div>' +
          '</div>' +
          (pendingCount > 0 ? '<span class="approval-badge">' + pendingCount + '</span>' : '') +
          '<span class="ios-card-row-arrow">›</span>' +
        '</div>';
      }
      html += '</div>';
    }

    // === 档案信息 ===
    if (youths.length > 0) {
      html += '<div class="ios-card-group">';
      html += '<div class="ios-card-group-header">📋 档案信息</div>';
      for (var i = 0; i < youths.length; i++) {
        var y = youths[i];
        var age = Utils.calculateAge(y.birthDate);
        html += '<div class="ios-card-row" data-youth-id="' + y.id + '" data-action="archive-code">' +
          '<div class="ios-card-row-icon avatar">' + (y.avatar || '🧑') + '</div>' +
          '<div class="ios-card-row-body">' +
            '<div class="ios-card-row-title">' + Utils.escapeHtml(y.name) + '</div>' +
            '<div class="ios-card-row-subtitle">' + age + '岁 · 查看档案码</div>' +
          '</div>' +
          '<span class="ios-card-row-arrow">›</span>' +
        '</div>';
      }
      html += '</div>';
    }

    html += '</div>';

    container.innerHTML = html;

    // 绑定权限入口卡片点击
    var permRow = document.querySelector('[data-action="permissions"]');
    if (permRow) {
      permRow.addEventListener('click', function(e) {
        e.stopPropagation();
        window.location.hash = 'permissions';
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
          window.location.hash = 'grants?youthId=' + encodeURIComponent(youthId);
        }
      });
    }

    // 绑定档案码点击
    var archiveRows = document.querySelectorAll('.ios-card-row[data-action="archive-code"]');
    for (var i = 0; i < archiveRows.length; i++) {
      archiveRows[i].addEventListener('click', function (e) {
        e.stopPropagation();
        var youthId = this.getAttribute('data-youth-id');
        if (youthId) {
          AppState.selectYouth(youthId);
          window.location.hash = 'archive-code?youthId=' + encodeURIComponent(youthId);
        }
      });
    }
  }

  function showPermissions(params) {
    var container = getContainer();
    var user = AppState.currentUser;
    var modules = Modules.MODULES;

    var html = '<div class="page-header">' +
      '<button class="btn-back" id="btn-perm-back">‹</button>' +
      '<span class="page-title">🔓 我的权限</span>' +
      '<span></span>' +
    '</div>' +
    '<div class="page-content">';

    html += '<div class="ios-card-group">';
    html += '<div class="ios-card-group-header"><span>模块访问权限</span></div>';
    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      var canWriteModule = Permissions.canWrite(m.key);
      html += '<div class="ios-card-row-static">' +
        '<div class="ios-card-row-icon" style="font-size:24px;">' + m.icon + '</div>' +
        '<div class="ios-card-row-body">' +
          '<div class="ios-card-row-title">' + m.label + '</div>' +
          '<div class="ios-card-row-subtitle">' +
            '<span style="color:var(--color-success);">✓ 查看</span>' +
            (canWriteModule ? ' · <span style="color:var(--color-warning);">✓ 记录</span>' : ' · <span style="color:var(--color-text-tertiary);">✗ 记录</span>') +
          '</div>' +
        '</div>' +
      '</div>';
    }
    html += '</div>';

    html += '</div>';

    container.innerHTML = html;

    document.getElementById('btn-perm-back').addEventListener('click', function() {
      window.location.hash = 'management';
    });
  }

  /**
   * 绑定主页事件
   */
  function _bindDashboardEvents(user, youths) {
    // 健康速报卡片事件
    if (youths.length > 0 && AnalyticsUI.bindHealthCardEvents) {
      AnalyticsUI.bindHealthCardEvents(youths[0]);
    }

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
    var cards = document.querySelectorAll('.youth-card');
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
        // permissions 不依赖 youthId，直接跳转
        if (action === 'permissions') {
          window.location.hash = 'permissions';
          return;
        }
        if (youthId) {
          AppState.selectYouth(youthId);
          if (action === 'profile') {
            window.location.hash = 'profile?youthId=' + encodeURIComponent(youthId);
          } else if (action === 'grants') {
            window.location.hash = 'grants?youthId=' + encodeURIComponent(youthId);
          } else if (action === 'quickcard') {
            window.location.hash = 'quickcard?youthId=' + encodeURIComponent(youthId);
          } else if (action === 'records') {
            window.location.hash = 'records?youthId=' + encodeURIComponent(youthId);
          }
        }
      });
    }

    // 老师快捷操作：记录观察
    var teacherRecordBtn = document.getElementById('btn-teacher-record');
    if (teacherRecordBtn && youths.length > 0) {
      teacherRecordBtn.addEventListener('click', function () {
        AppState.selectYouth(youths[0].id);
        window.location.hash = 'records?youthId=' + encodeURIComponent(youths[0].id);
      });
    }

    // 老师快捷操作：查看档案
    var teacherProfileBtn = document.getElementById('btn-teacher-profile');
    if (teacherProfileBtn && youths.length > 0) {
      teacherProfileBtn.addEventListener('click', function () {
        AppState.selectYouth(youths[0].id);
        window.location.hash = 'profile?youthId=' + encodeURIComponent(youths[0].id);
      });
    }

    // 档案入口按钮（替代速读卡按钮，速读卡已移至档案页）

    // 待记录提醒
    var pendingBtn = document.getElementById('btn-pending-records');
    if (pendingBtn && youths.length > 0) {
      pendingBtn.addEventListener('click', function () {
        AppState.selectYouth(youths[0].id);
        window.location.hash = 'records?youthId=' + encodeURIComponent(youths[0].id);
      });
    }

    // Kanban 任务状态切换（todo → in_progress → done → todo 循环）
    var kanbanBtns = document.querySelectorAll('.kanban-status-btn');
    for (var i = 0; i < kanbanBtns.length; i++) {
      kanbanBtns[i].addEventListener('click', function (e) {
        e.stopPropagation();
        var btn = this;
        var taskId = btn.getAttribute('data-task-id');
        var youthId = btn.getAttribute('data-youth-id');
        var currentStatus = btn.getAttribute('data-status');
        var nextStatus = _nextKanbanStatus(currentStatus);
        var updates = { status: nextStatus };
        if (nextStatus === 'done') {
          updates.completedAt = Utils.formatDateTime();
        } else if (nextStatus === 'todo') {
          updates.completedAt = null;
        }
        var updated = Storage.updateTask(youthId, taskId, updates);
        if (updated) {
          showDashboard({});
        }
      });
    }

    // 统一任务表单：新建任务按钮
    for (var j = 0; j < youths.length; j++) {
      (function (y) {
        var createBtn = document.getElementById('btn-create-task-' + y.id);
        if (createBtn) {
          createBtn.addEventListener('click', function () {
            _showTaskForm(y);
          });
        }
      })(youths[j]);
    }

    // AI 发现审核
    var approveBtns = document.querySelectorAll('[data-action="approve"]');
    var rejectBtns = document.querySelectorAll('[data-action="reject"]');
    for (var ai = 0; ai < approveBtns.length; ai++) {
      approveBtns[ai].addEventListener('click', function() {
        var findingId = this.getAttribute('data-finding-id');
        _reviewAIFinding(findingId, 'approve');
      });
    }
    for (var ri = 0; ri < rejectBtns.length; ri++) {
      rejectBtns[ri].addEventListener('click', function() {
        var findingId = this.getAttribute('data-finding-id');
        _reviewAIFinding(findingId, 'reject');
      });
    }

    // 退出登录按钮
    var logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        AppState.logout();
        window.location.hash = 'login';
      });
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
    registerRoute('welcome', Welcome.renderWelcome);
    // US1 路由
    registerRoute('login', Auth.renderLogin);
    registerRoute('register', Auth.renderRegister);
    registerRoute('profile', Profile.renderProfile);
    registerRoute('archive-code', ArchiveCode.renderArchiveCode);
    // 档案码扫码访问路由 → 统一跳转速读卡
    registerRoute('archive', function (params) {
      if (!AppState.isLoggedIn) {
        AppState.showToast('请先登录后扫码访问档案');
        window.location.hash = 'login';
        return;
      }
      if (params.youthId) {
        // 验证档案码是否过期
        var archiveCode = Storage.getArchiveCode(params.youthId);
        if (!archiveCode || ArchiveCode.isCodeExpired(archiveCode)) {
          AppState.showToast('档案码已过期，请联系对方重新生成');
          return;
        }

        // 统一跳转速读卡（via=scan 标识扫码访问，放开权限校验）
        window.location.hash = 'quickcard?youthId=' + encodeURIComponent(params.youthId) + '&via=scan';
      }
    });
    // US2 路由
    registerRoute('records', Records.renderRecords);
    registerRoute('quickcard', QuickCard.renderQuickCard);
    registerRoute('timeline', Timeline.renderTimeline);
    // US3 路由
    registerRoute('chat', ChatBot.renderChat);
    // 心青年 AI 对话首页
    registerRoute('youth-chat', function() { YouthChat.render(); });
    // 老师专业工作台
    registerRoute('teacher-workbench', function() { TeacherWorkbench.render(); });
    // US4 路由
    registerRoute('charts', Charts.renderCharts);
    registerRoute('analytics', AnalyticsUI.renderAnalytics);
    // US5 路由
    registerRoute('government', Government.renderGovernment);
    // 授权管理路由
    registerRoute('grants', function (params) {
      var youthId = params.youthId || (AppState.currentYouth ? AppState.currentYouth.id : null);
      if (youthId) {
        AppState.selectYouth(youthId);
        Grants.showGrants(youthId);
      } else {
        window.location.hash = 'dashboard';
      }
    });
    // 管理员路由
    registerRoute('admin', Admin.showAdmin);
    // 权限详情路由
    registerRoute('permissions', showPermissions);
    // 加入申请路由
    registerRoute('join', function (params) {
      if (!AppState.isLoggedIn) {
        AppState.showToast('请先登录');
        window.location.hash = 'login';
        return;
      }
      if (!params.youthId) {
        window.location.hash = 'dashboard';
        return;
      }
      JoinRequest.renderJoinPage(params.youthId);
    });
    // 申请审批路由
    registerRoute('approvals', function () {
      if (!AppState.isLoggedIn) {
        window.location.hash = 'login';
        return;
      }
      JoinApproval.renderApprovalPage();
    });
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
      var initUser = AppState.currentUser;
      if (initUser && initUser.role === 'youth') {
        window.location.hash = 'youth-chat';
      } else if (initUser && initUser.role === 'admin') {
        window.location.hash = 'admin';
      } else if (initUser && initUser.role === 'government') {
        window.location.hash = 'government';
      } else {
        window.location.hash = 'dashboard';
      }
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
