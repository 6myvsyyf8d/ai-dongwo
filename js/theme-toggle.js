/* ================================================================
   AI懂我 · theme-toggle.js
   主题切换逻辑：dark → warm → figma → dark 三档循环，localStorage 持久化
   ================================================================ */

(function () {
  'use strict';

  var THEME_KEY = 'ai-dongwo-theme';
  var DEFAULT_THEME = 'dark';
  var THEME_ORDER = ['dark', 'warm', 'figma'];
  var THEME_ICONS = {
    dark: '\u2600\uFE0F',  // ☀️
    warm: '\uD83C\uDF19',  // 🌙
    figma: '\uD83D\uDCA0'  // 💠
  };

  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
    } catch (e) {
      return DEFAULT_THEME;
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      // localStorage 不可用，静默忽略
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateToggleIcon(theme);
  }

  function updateToggleIcon(theme) {
    var icon = document.querySelector('.theme-toggle-icon');
    if (icon) {
      icon.textContent = THEME_ICONS[theme] || THEME_ICONS[DEFAULT_THEME];
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
    var idx = THEME_ORDER.indexOf(current);
    if (idx === -1) { idx = 0; }
    var next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    setStoredTheme(next);
    applyTheme(next);
  }

  // 初始化
  var stored = getStoredTheme();
  applyTheme(stored);

  // 绑定切换按钮
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', toggleTheme);
    }
  });
})();