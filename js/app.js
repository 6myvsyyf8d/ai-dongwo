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
    // 心青年特殊导航：对话 + 我
    if (user && user.role === 'youth') {
      navItems = [
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
   * 解析档案码 URL 并跳转到加入申请页
   */
  function _handleArchiveUrl(url) {
    // 解析档案码 URL
    var match = url.match(/#archive\/([a-zA-Z0-9-]+)/);
    if (match) {
      var youthId = decodeURIComponent(match[1]);
      window.location.hash = 'join?youthId=' + encodeURIComponent(youthId);
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
      '<span class="header-version">v1.0_20260731-1</span>' +
    '</div>';
  }

  /**
   * 心青年主页：自己档案 + 心情/愿望 + 最近动态
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

    // 管理入口（不含速读卡，已移至档案页）
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

    // 今日交接（Monday.com 风格）
    html += _renderDailyHandover(y);

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
    '</div>';

    // 合并交接任务表（所有学生，仅老师相关的）
    html += _renderTeacherHandover(youths, user);

    // 快捷操作
    html += '<div class="dashboard-section">' +
      '<div class="quick-actions">' +
        '<button class="quick-action-btn" id="btn-teacher-record">📝 记录观察</button>' +
        '<button class="quick-action-btn" id="btn-teacher-profile">📋 查看档案</button>' +
      '</div>' +
    '</div>';

    // 专业工作台入口
    html += '<div class="dashboard-section">' +
      '<div class="ios-card-group">' +
        '<a href="#teacher-workbench" class="ios-card-row-static" style="text-decoration:none;color:inherit;">' +
          '<div class="ios-card-row-body">' +
            '<div class="ios-card-row-title">🎓 专业工作台</div>' +
            '<div class="ios-card-row-subtitle">ISP · 能力评估 · 干预记录 · 情绪趋势</div>' +
          '</div>' +
          '<div style="font-size:20px;">›</div>' +
        '</a>' +
      '</div>' +
    '</div>';

    html += '<div class="dashboard-footer-space"></div>';

    return html;
  }

  /**
   * 合并渲染老师的所有学生交接任务（monday.com 风格，含学生列）
   */
  function _renderTeacherHandover(youths, user) {
    // 收集所有学生的交接任务，过滤出与老师相关的
    var allTasks = [];
    for (var i = 0; i < youths.length; i++) {
      var y = youths[i];
      var tasks = Storage.getHandoverTasks(y.id);
      for (var j = 0; j < tasks.length; j++) {
        var t = tasks[j];
        if ((t.toUserId === user.id || t.toRole === user.role) && t.targetType !== 'youth') {
          t._youthName = y.name;
          t._youthId = y.id;
          allTasks.push(t);
        }
      }
    }

    var html = '<div class="ios-card-group handover-table-teacher">';
    html += '<div class="ios-card-group-header" style="display:flex;justify-content:space-between;align-items:center;">' +
      '<span>📋 今日交接</span>' +
      '<span style="font-size:11px;color:var(--color-text-tertiary);font-weight:400;">' + allTasks.length + ' 条</span>' +
    '</div>';

    if (allTasks.length === 0) {
      html += '<div class="ios-card-row-static">' +
        '<div class="ios-card-row-body">' +
          '<div class="ios-card-row-title" style="color: var(--color-text-tertiary);">暂无交接任务</div>' +
          '<div class="ios-card-row-subtitle">点击下方按钮创建新的交接任务</div>' +
        '</div>' +
      '</div>';
    } else {
      // 排序：待处理在前，已完成在后；同状态按时间倒序
      allTasks.sort(function (a, b) {
        var aPending = a.status !== 'done' ? 0 : 1;
        var bPending = b.status !== 'done' ? 0 : 1;
        if (aPending !== bPending) return aPending - bPending;
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      });

      // 表头（含学生列）
      html += '<div class="handover-table-header">' +
        '<div class="handover-cell handover-cell-content">任务内容</div>' +
        '<div class="handover-cell handover-cell-youth">学生</div>' +
        '<div class="handover-cell handover-cell-from">发起人</div>' +
        '<div class="handover-cell handover-cell-to">接收人</div>' +
        '<div class="handover-cell handover-cell-status">状态</div>' +
      '</div>';

      html += '<div class="handover-table-body">';
      for (var k = 0; k < allTasks.length; k++) {
        var taskYouth = { id: allTasks[k]._youthId };
        html += _renderTaskRow(allTasks[k], taskYouth, allTasks[k]._youthName);
      }
      html += '</div>';
    }

    // 新建交接任务按钮（默认第一个学生）
    if (youths.length > 0) {
      html += '<div class="ios-card-row-static" style="border-top:0.5px solid var(--color-border-light);">' +
        '<button class="ios-create-row handover-create-btn" id="btn-add-handover-' + youths[0].id + '" style="width:100%;">✚ 新建交接任务</button>' +
      '</div>';
    }

    html += '</div>';
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
   * 默认主页（未知角色）
   */
  function _renderDefaultDashboard(user, youths) {
    return '<div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-title">欢迎使用 AI懂我</div><div class="empty-state-desc">请选择您的角色开始使用</div></div>';
  }

  /**
   * 渲染安全速查卡（照护者用）
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
   * 获取授权过期提示
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
            '<label class="form-label">提醒对象</label>' +
            '<div class="task-target-selector">' +
              '<div class="task-target-option selected" data-target="caregiver">' +
                '<span style="font-size:20px;">🤝</span>' +
                '<span>照护者</span>' +
              '</div>' +
              '<div class="task-target-option" data-target="youth">' +
                '<span style="font-size:20px;">🌻</span>' +
                '<span>心青年</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
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

    var targetOptions = overlay.querySelectorAll('.task-target-option');
    for (var ti = 0; ti < targetOptions.length; ti++) {
      targetOptions[ti].addEventListener('click', function () {
        for (var tj = 0; tj < targetOptions.length; tj++) {
          targetOptions[tj].classList.remove('selected');
        }
        this.classList.add('selected');
      });
    }

    overlay.querySelector('#btn-save-handover').addEventListener('click', function () {
      var toUserId = overlay.querySelector('#handover-to-user').value;
      var contentText = overlay.querySelector('#handover-content').value.trim();
      var errorEl = overlay.querySelector('#handover-form-error');

      var targetType = 'caregiver';
      var selectedTarget = overlay.querySelector('.task-target-option.selected');
      if (selectedTarget) {
        targetType = selectedTarget.getAttribute('data-target');
      }

      if (!toUserId) {
        errorEl.textContent = '请选择接收人';
        errorEl.style.display = 'block';
        return;
      }
      if (toUserId === currentUser.id) {
        errorEl.textContent = '不能给自己分配任务';
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
        status: 'pending',
        targetType: targetType
      });

      document.body.removeChild(overlay);
      showDashboard({});
    });
  }

  /**
   * 渲染交接任务行（复用组件）
   * Monday.com 风格：清晰展示「谁交给谁」，接收人突出
   */
  function _renderTaskRow(task, youth, showYouthCol) {
    var fromAccount = Storage.getAccount(task.fromUserId);
    var fromName = fromAccount ? fromAccount.name : '未知';
    var fromRole = Constants.ROLES.find(function (r) { return r.value === task.fromRole; });
    var fromIcon = fromRole ? fromRole.icon : '👤';

    var toLabel = '';
    var toIcon = '';
    if (task.toUserId) {
      var toAccount = Storage.getAccount(task.toUserId);
      toLabel = toAccount ? toAccount.name : '未知';
      var toRole = task.toRole ? (Constants.ROLES.find(function (r) { return r.value === task.toRole; }) || null) : null;
      toIcon = toRole ? toRole.icon : '👤';
    } else {
      var toRoleLabel = Constants.ROLE_LABELS[task.toRole] || task.toRole;
      toLabel = toRoleLabel;
      var toRoleInfo = Constants.ROLES.find(function (r) { return r.value === task.toRole; });
      toIcon = toRoleInfo ? toRoleInfo.icon : '👤';
    }

    var isDone = task.status === 'done';
    var isPending = task.status !== 'done';
    var rowClass = 'handover-table-row' + (isPending ? ' handover-row-pending' : '') + (isDone ? ' handover-row-done' : '');
    var pillClass = isDone ? 'handover-pill-done' : 'handover-pill-pending';
    var pillText = isDone ? '已完成' : '待处理';

    return '<div class="' + rowClass + '">' +
      '<div class="handover-cell handover-cell-content">' +
        Utils.escapeHtml(_truncate(task.content, 50)) +
        '<div class="handover-cell-time">' + _relativeTime(task.updatedAt || task.createdAt) + '</div>' +
      '</div>' +
      (showYouthCol ? '<div class="handover-cell handover-cell-youth">' +
        '<span class="handover-actor-name">' + Utils.escapeHtml(showYouthCol) + '</span>' +
      '</div>' : '') +
      '<div class="handover-cell handover-cell-from">' +
        '<span class="handover-actor-icon">' + fromIcon + '</span>' +
        '<span class="handover-actor-name">' + Utils.escapeHtml(fromName) + '</span>' +
      '</div>' +
      '<div class="handover-cell handover-cell-to">' +
        '<span class="handover-actor-icon">' + toIcon + '</span>' +
        '<span class="handover-actor-name">' + Utils.escapeHtml(toLabel) + '</span>' +
      '</div>' +
      '<div class="handover-cell handover-cell-status">' +
        '<button class="handover-pill ' + pillClass + '" data-task-id="' + task.id + '" data-youth-id="' + youth.id + '" data-status="' + task.status + '" title="点击切换状态">' +
          pillText +
        '</button>' +
      '</div>' +
    '</div>';
  }

  /**
   * 渲染每日交接卡片 — Monday.com 风格 4 列结构化表格
   * 全部任务按时间混合展示，不分组
   */
  function _renderDailyHandover(youth, currentUser) {
    var tasks = Storage.getHandoverTasks(youth.id);

    // 过滤掉 targetType=youth 的任务（这些任务出现在心青年 AI 对话中，不在交接看板）
    tasks = tasks.filter(function (t) { return t.targetType !== 'youth'; });

    // 如果指定了当前用户，只显示与该用户相关的任务
    if (currentUser) {
      tasks = tasks.filter(function (t) {
        return (t.toUserId === currentUser.id || t.toRole === currentUser.role);
      });
    }

    var html = '<div class="ios-card-group">';
    html += '<div class="ios-card-group-header" style="display:flex;justify-content:space-between;align-items:center;">' +
      '<span>📋 今日交接</span>' +
      '<span style="font-size:11px;color:var(--color-text-tertiary);font-weight:400;">' + tasks.length + ' 条</span>' +
    '</div>';

    if (tasks.length === 0) {
      html += '<div class="ios-card-row-static">' +
        '<div class="ios-card-row-body">' +
          '<div class="ios-card-row-title" style="color: var(--color-text-tertiary);">暂无交接任务</div>' +
          '<div class="ios-card-row-subtitle">点击下方按钮创建新的交接任务</div>' +
        '</div>' +
      '</div>';
    } else {
      // 排序：待处理在前，已完成在后；同状态按时间倒序
      tasks.sort(function (a, b) {
        var aPending = a.status !== 'done' ? 0 : 1;
        var bPending = b.status !== 'done' ? 0 : 1;
        if (aPending !== bPending) return aPending - bPending;
        var aTime = new Date(a.updatedAt || a.createdAt).getTime();
        var bTime = new Date(b.updatedAt || b.createdAt).getTime();
        return bTime - aTime;
      });

      // 表头行
      html += '<div class="handover-table-header">' +
        '<div class="handover-cell handover-cell-content">任务内容</div>' +
        '<div class="handover-cell handover-cell-from">发起人</div>' +
        '<div class="handover-cell handover-cell-to">接收人</div>' +
        '<div class="handover-cell handover-cell-status">状态</div>' +
      '</div>';

      // 数据行
      html += '<div class="handover-table-body">';
      for (var k = 0; k < tasks.length; k++) {
        html += _renderTaskRow(tasks[k], youth);
      }
      html += '</div>';
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
    var user = AppState.currentUser;

    // 管理员：显示管理后台
    if (user && user.role === 'admin') {
      Admin.showAdmin();
      return;
    }

    var container = getContainer();
    var youths = Permissions.getAccessibleYouths();

    var html = '<div class="page-content">';

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
      '<button class="btn btn-sm btn-secondary" id="btn-perm-back">← 返回</button>' +
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

    // 交接任务：状态切换（Monday.com 风格药丸点击）
    var statusBtns = document.querySelectorAll('.handover-pill');
    for (var i = 0; i < statusBtns.length; i++) {
      statusBtns[i].addEventListener('click', function (e) {
        e.stopPropagation();
        var btn = this;
        var taskId = btn.getAttribute('data-task-id');
        var youthId = btn.getAttribute('data-youth-id');
        var currentStatus = btn.getAttribute('data-status');
        var nextStatus = _nextTaskStatus(currentStatus);
        var updated = Storage.updateHandoverTask(youthId, taskId, { status: nextStatus });
        if (updated) {
          showDashboard({});
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
    // 档案码扫码访问路由
    registerRoute('archive', function (params) {
      if (!AppState.isLoggedIn) {
        AppState.showToast('请先登录后扫码访问档案');
        window.location.hash = 'login';
        return;
      }
      if (params.youthId) {
        var user = AppState.currentUser;
        var role = user.role;

        // 家长、心青年、管理员：直接进档案
        if (role === 'parent' || role === 'youth' || role === 'admin') {
          AppState.selectYouth(params.youthId);
          window.location.hash = 'profile?youthId=' + encodeURIComponent(params.youthId);
          return;
        }

        // 政府：不能访问个体档案
        if (role === 'government') {
          AppState.showToast('政府角色不支持访问个体档案');
          window.location.hash = 'government';
          return;
        }

        // 老师/照护者：检查是否已有授权
        var grants = Storage.getAccessGrants(params.youthId);
        var hasAccess = grants.some(function (g) {
          return g.granteeId === user.id && g.status === 'active';
        });

        if (hasAccess) {
          AppState.selectYouth(params.youthId);
          window.location.hash = 'profile?youthId=' + encodeURIComponent(params.youthId);
        } else {
          // 跳转到加入申请页
          window.location.hash = 'join?youthId=' + encodeURIComponent(params.youthId);
        }
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
