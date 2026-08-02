/* ================================================================
   AI懂我 · theme-toggle.js
   主题切换逻辑：dark ⇄ warm，localStorage 持久化
   ================================================================ */

(function () {
  'use strict';

  const THEME_KEY = 'ai-dongwo-theme';
  const DEFAULT_THEME = 'dark';

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
      icon.textContent = theme === 'warm' ? '\uD83C\uDF19' : '\u2600\uFE0F'; // 🌙 : ☀️
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
    var next = current === 'dark' ? 'warm' : 'dark';
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