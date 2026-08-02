/**
 * chat-markdown.js - AI 回复 markdown 渲染工具
 * 依赖：marked.js、DOMPurify
 * 暴露 window.ChatMarkdown.render(text) → safe HTML string
 */
(function () {
  'use strict';

  function render(text) {
    if (!window.marked || !window.DOMPurify) {
      // 降级：纯文本 + 换行
      var div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML.replace(/\n/g, '<br>');
    }
    try {
      var html = window.marked.parse(text, { breaks: true });
      return window.DOMPurify.sanitize(html);
    } catch (e) {
      var div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML.replace(/\n/g, '<br>');
    }
  }

  window.ChatMarkdown = { render: render };
})();
