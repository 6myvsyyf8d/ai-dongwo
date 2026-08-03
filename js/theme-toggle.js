/* ================================================================
   AI懂我 · theme-toggle.js
   主题初始化：固定为 cookie（烘焙饼干）主题
   ================================================================ */

(function () {
  'use strict';

  var THEME_KEY = 'ai-dongwo-theme';
  var DEFAULT_THEME = 'cookie';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  // 初始化：固定 cookie 主题
  var stored = DEFAULT_THEME;
  try {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved) stored = saved;
    localStorage.setItem(THEME_KEY, DEFAULT_THEME);
  } catch (e) {
    // localStorage 不可用，静默忽略
  }
  applyTheme(stored);
})();