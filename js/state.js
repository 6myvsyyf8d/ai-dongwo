/**
 * state.js - 全局应用状态管理
 * 所有模块通过 AppState 共享状态，避免全局变量污染
 */
window.AppState = (function () {
  'use strict';

  var state = {
    // 用户状态
    currentUser: null,
    isLoggedIn: false,

    // 档案状态
    currentYouth: null,
    currentYouthRecords: [],

    // UI 状态
    currentPage: 'login',
    pageParams: {},
    isLoading: false,
    toastMessage: null,

    // 权限缓存
    currentGrants: [],
    canRead: false,
    canWrite: false,
    canManage: false,

    // 事件监听器
    _listeners: {}
  };

  /**
   * 触发事件
   * @param {string} event - 事件名
   * @param {*} data - 事件数据
   */
  function _emit(event, data) {
    var callbacks = state._listeners[event];
    if (callbacks) {
      for (var i = 0; i < callbacks.length; i++) {
        try {
          callbacks[i](data);
        } catch (e) {
          console.error('AppState 事件监听器错误 (' + event + '):', e);
        }
      }
    }
  }

  /**
   * 初始化状态，检查 localStorage 中的登录状态
   */
  function init() {
    var session = Storage.getCurrentUser();
    if (session && session.accountId) {
      var account = Storage.getAccount(session.accountId);
      if (account && account.isActive) {
        state.currentUser = account;
        state.isLoggedIn = true;
      } else {
        // 账户不存在或已停用，清除登录状态
        Storage.clearCurrentUser();
      }
    }
    _emit('onStateChange', state);
  }

  /**
   * 设置当前登录用户
   */
  function login(account) {
    state.currentUser = account;
    state.isLoggedIn = true;
    Storage.setCurrentUser(account.id);
    _emit('onLogin', account);
    _emit('onStateChange', state);
  }

  /**
   * 登出当前用户
   */
  function logout() {
    var oldUser = state.currentUser;
    state.currentUser = null;
    state.isLoggedIn = false;
    state.currentYouth = null;
    state.currentYouthRecords = [];
    state.currentPage = 'login';
    state.pageParams = {};
    state.currentGrants = [];
    state.canRead = false;
    state.canWrite = false;
    state.canManage = false;
    Storage.clearCurrentUser();
    _emit('onLogout', oldUser);
    _emit('onStateChange', state);
  }

  /**
   * 选择要查看的心青年档案
   */
  function selectYouth(youthId) {
    var youth = Storage.getProfile(youthId);
    if (!youth) {
      console.warn('AppState.selectYouth: 档案不存在', youthId);
      return;
    }

    state.currentYouth = youth;
    state.currentYouthRecords = Storage.getRecords(youthId);

    // 刷新权限缓存（Permissions 模块在 state.js 之后加载，运行时可用）
    if (window.Permissions) {
      Permissions.refresh(youthId);
    }

    _emit('onYouthChanged', youth);
    _emit('onStateChange', state);
  }

  /**
   * 页面路由切换
   */
  function navigate(page, params) {
    state.currentPage = page;
    state.pageParams = params || {};
    _emit('onNavigate', { page: page, params: state.pageParams });
    _emit('onStateChange', state);
  }

  /**
   * 显示全局提示消息
   */
  var _toastTimer = null;
  function showToast(message, duration) {
    state.toastMessage = message;
    _emit('onStateChange', state);

    if (_toastTimer) {
      clearTimeout(_toastTimer);
    }
    var d = duration || 3000;
    _toastTimer = setTimeout(function () {
      state.toastMessage = null;
      _emit('onStateChange', state);
    }, d);
  }

  /**
   * 注册事件监听器
   */
  function on(event, callback) {
    if (!state._listeners[event]) {
      state._listeners[event] = [];
    }
    state._listeners[event].push(callback);
  }

  /**
   * 移除事件监听器
   */
  function off(event, callback) {
    var callbacks = state._listeners[event];
    if (callbacks) {
      var index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 获取当前状态快照
   */
  function getState() {
    return state;
  }

  return {
    // 方法
    init: init,
    login: login,
    logout: logout,
    selectYouth: selectYouth,
    navigate: navigate,
    showToast: showToast,
    on: on,
    off: off,
    getState: getState,
    // 属性代理（通过 getter/setter 直接访问闭包内 state）
    get currentUser() { return state.currentUser; },
    set currentUser(v) { state.currentUser = v; },
    get isLoggedIn() { return state.isLoggedIn; },
    set isLoggedIn(v) { state.isLoggedIn = v; },
    get currentYouth() { return state.currentYouth; },
    set currentYouth(v) { state.currentYouth = v; },
    get currentYouthRecords() { return state.currentYouthRecords; },
    set currentYouthRecords(v) { state.currentYouthRecords = v; },
    get currentPage() { return state.currentPage; },
    set currentPage(v) { state.currentPage = v; },
    get pageParams() { return state.pageParams; },
    set pageParams(v) { state.pageParams = v; },
    get isLoading() { return state.isLoading; },
    set isLoading(v) { state.isLoading = v; },
    get toastMessage() { return state.toastMessage; },
    set toastMessage(v) { state.toastMessage = v; },
    get currentGrants() { return state.currentGrants; },
    set currentGrants(v) { state.currentGrants = v; },
    get canRead() { return state.canRead; },
    set canRead(v) { state.canRead = v; },
    get canWrite() { return state.canWrite; },
    set canWrite(v) { state.canWrite = v; },
    get canManage() { return state.canManage; },
    set canManage(v) { state.canManage = v; }
  };
})();
