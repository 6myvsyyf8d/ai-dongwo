/**
 * youth-tts.js - 心青年语音播报工具模块
 * 基于浏览器原生 SpeechSynthesis API，无需第三方库
 * 供 youth-chat.js 和 app.js 共用
 */
window.YouthTTS = (function () {
  'use strict';

  var _speaking = false;
  var _currentUtterance = null;

  /**
   * 朗读文本
   * @param {string} text - 要朗读的文本
   * @returns {boolean} 是否成功启动朗读
   */
  function speak(text) {
    if (!text || typeof text !== 'string') return false;

    if (!window.speechSynthesis) return false;

    stop();

    var cleanText = text
      .replace(/[*_~`#]/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\n{2,}/g, '。')
      .replace(/\n/g, '，')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!cleanText) return false;

    var utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9;

    utterance.onstart = function () { _speaking = true; };
    utterance.onend = function () { _speaking = false; _currentUtterance = null; };
    utterance.onerror = function () { _speaking = false; _currentUtterance = null; };

    _currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  /**
   * 停止当前朗读
   */
  function stop() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    _speaking = false;
    _currentUtterance = null;
  }

  /**
   * 是否正在朗读
   * @returns {boolean}
   */
  function isSpeaking() {
    return _speaking;
  }

  /**
   * 语音反馈：先中断当前朗读再播新内容
   * @param {string} text - 简短反馈文本
   */
  function speakFeedback(text) {
    if (!text) return;
    stop();
    speak(text);
  }

  return {
    speak: speak,
    stop: stop,
    isSpeaking: isSpeaking,
    speakFeedback: speakFeedback
  };
})();