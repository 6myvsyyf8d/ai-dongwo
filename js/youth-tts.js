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
   * @param {object} [options] - 可选配置
   * @param {number} [options.rate=0.9] - 语速 (0.1-10)
   * @param {number} [options.pitch=1.0] - 音高 (0-2)
   * @param {number} [options.volume=1.0] - 音量 (0-1)
   * @returns {boolean} 是否成功启动朗读
   */
  function speak(text, options) {
    if (!text || typeof text !== 'string') return false;

    // 检查浏览器支持
    if (!window.speechSynthesis) {
      console.warn('YouthTTS: 浏览器不支持 SpeechSynthesis');
      return false;
    }

    // 先停止当前朗读
    stopSpeaking();

    // 清理文本中的 markdown 标记
    var cleanText = text
      .replace(/[*_~`#]/g, '')   // 移除 markdown 标记
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // 移除链接
      .replace(/\n{2,}/g, '。')   // 多个换行变句号
      .replace(/\n/g, '，')       // 单换行变逗号
      .replace(/\s{2,}/g, ' ')    // 多余空格
      .trim();

    if (!cleanText) return false;

    options = options || {};
    var rate = (options.rate != null) ? options.rate : 0.9;
    var pitch = (options.pitch != null) ? options.pitch : 1.0;
    var volume = (options.volume != null) ? options.volume : 1.0;

    var utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'zh-CN';
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    utterance.onstart = function () {
      _speaking = true;
    };

    utterance.onend = function () {
      _speaking = false;
      _currentUtterance = null;
    };

    utterance.onerror = function (e) {
      console.warn('YouthTTS: 朗读出错', e.error);
      _speaking = false;
      _currentUtterance = null;
    };

    _currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  /**
   * 停止当前朗读
   */
  function stopSpeaking() {
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
   * 语音反馈（操作确认）
   * @param {string} text - 简短反馈文本
   */
  function speakFeedback(text) {
    if (!text) return;
    // 反馈用稍快语速
    speak(text, { rate: 1.0, pitch: 1.1 });
  }

  return {
    speak: speak,
    stopSpeaking: stopSpeaking,
    isSpeaking: isSpeaking,
    speakFeedback: speakFeedback
  };
})();