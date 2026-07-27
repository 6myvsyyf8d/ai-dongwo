/**
 * utils.js - 工具函数模块
 * 提供 UUID 生成、日期格式化、PIN 哈希、身份证校验、年龄计算等通用工具
 */
window.Utils = (function () {
  'use strict';

  var PIN_SALT = 'ai-dongwo-salt';

  // 身份证校验码加权因子（GB 11643-1999）
  var ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  // 校验码对照表（模 11 对应）
  var ID_CHECK_CODES = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

  /**
   * 生成 UUID v4
   * @returns {string} UUID v4 字符串
   */
  function generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // 回退方案：基于 getRandomValues 的手动实现
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      var bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      var hex = [];
      for (var i = 0; i < 16; i++) {
        hex.push(bytes[i].toString(16).padStart(2, '0'));
      }
      return (
        hex.slice(0, 4).join('') + '-' +
        hex.slice(4, 6).join('') + '-' +
        hex.slice(6, 8).join('') + '-' +
        hex.slice(8, 10).join('') + '-' +
        hex.slice(10, 16).join('')
      );
    }
    // 最终回退：基于 Math.random（不推荐用于生产）
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * 格式化为 ISO 日期时间字符串
   * @param {Date|string|number} [date] - 日期对象/字符串/时间戳，默认当前时间
   * @returns {string} ISO 8601 日期时间字符串（如 "2026-07-25T08:00:00.000Z"）
   */
  function formatDateTime(date) {
    var d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) {
      return null;
    }
    return d.toISOString();
  }

  /**
   * 格式化为日期字符串（YYYY-MM-DD）
   * @param {Date|string|number} [date]
   * @returns {string} 日期字符串
   */
  function formatDate(date) {
    var d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) {
      return null;
    }
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  /**
   * 格式化为友好的中文日期时间显示
   * @param {string} isoString - ISO 日期时间字符串
   * @returns {string} 友好的日期时间文本（如 "2026-07-25 08:00"）
   */
  function formatDisplay(isoString) {
    if (!isoString) return '';
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    var date = formatDate(d);
    var hours = String(d.getHours()).padStart(2, '0');
    var minutes = String(d.getMinutes()).padStart(2, '0');
    return date + ' ' + hours + ':' + minutes;
  }

  /**
   * 使用 SHA-256 + salt 对 PIN 进行哈希
   * @param {string} pin - 明文 PIN 码
   * @returns {Promise<string>} 十六进制哈希字符串
   */
  async function hashPin(pin) {
    var input = pin + PIN_SALT;
    var encoder = new TextEncoder();
    var data = encoder.encode(input);
    var hashBuffer = await crypto.subtle.digest('SHA-256', data);
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  /**
   * 同步验证 PIN 哈希（使用 hashPin 比较结果）
   * @param {string} pin - 明文 PIN 码
   * @param {string} hash - 已存储的哈希值
   * @returns {Promise<boolean>} 是否匹配
   */
  async function verifyPin(pin, hash) {
    var computed = await hashPin(pin);
    return computed === hash;
  }

  /**
   * 验证中国身份证号（18 位，含校验码）
   * 按 GB 11643-1999 标准进行格式和校验码验证
   * @param {string} idNumber - 身份证号码
   * @returns {{ valid: boolean, error?: string }} 验证结果
   */
  function validateIdNumber(idNumber) {
    if (!idNumber || typeof idNumber !== 'string') {
      return { valid: false, error: '身份证号不能为空' };
    }

    var id = idNumber.trim().toUpperCase();

    // 基本格式校验：18 位，前 17 位数字，最后一位数字或 X
    var pattern = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dX]$/;
    if (!pattern.test(id)) {
      return { valid: false, error: '身份证号格式不正确' };
    }

    // 出生日期合法性校验
    var year = parseInt(id.substring(6, 10), 10);
    var month = parseInt(id.substring(10, 12), 10);
    var day = parseInt(id.substring(12, 14), 10);
    var birthDate = new Date(year, month - 1, day);
    if (
      birthDate.getFullYear() !== year ||
      birthDate.getMonth() !== month - 1 ||
      birthDate.getDate() !== day
    ) {
      return { valid: false, error: '身份证号中的出生日期不合法' };
    }

    // 不能是未来日期
    if (birthDate > new Date()) {
      return { valid: false, error: '出生日期不能晚于当前日期' };
    }

    // 校验码验证（GB 11643-1999）
    var sum = 0;
    for (var i = 0; i < 17; i++) {
      sum += parseInt(id.charAt(i), 10) * ID_WEIGHTS[i];
    }
    var checkCodeIndex = sum % 11;
    var expectedCheck = ID_CHECK_CODES[checkCodeIndex];

    if (id.charAt(17) !== expectedCheck) {
      return { valid: false, error: '身份证号校验码不正确' };
    }

    return { valid: true };
  }

  /**
   * 从出生日期计算年龄（周岁）
   * @param {string} birthDate - 出生日期（YYYY-MM-DD 或 ISO 字符串）
   * @returns {number} 周岁年龄
   */
  function calculateAge(birthDate) {
    if (!birthDate) return 0;
    var birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return 0;

    var now = new Date();
    var age = now.getFullYear() - birth.getFullYear();

    // 判断是否已过生日
    var monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }

    return age >= 0 ? age : 0;
  }

  /**
   * 判断是否未成年（< 18 周岁）
   * @param {string} birthDate
   * @returns {boolean}
   */
  function isMinor(birthDate) {
    return calculateAge(birthDate) < 18;
  }

  /**
   * 从身份证号提取出生日期
   * @param {string} idNumber
   * @returns {string|null} YYYY-MM-DD 格式
   */
  function extractBirthDate(idNumber) {
    if (!idNumber || idNumber.length < 14) return null;
    var year = idNumber.substring(6, 10);
    var month = idNumber.substring(10, 12);
    var day = idNumber.substring(12, 14);
    return year + '-' + month + '-' + day;
  }

  /**
   * 从身份证号提取性别（第 17 位奇数为男，偶数为女）
   * @param {string} idNumber
   * @returns {string} 'male' | 'female'
   */
  function extractGender(idNumber) {
    if (!idNumber || idNumber.length < 17) return 'other';
    var seq = parseInt(idNumber.charAt(16), 10);
    return seq % 2 === 1 ? 'male' : 'female';
  }

  /**
   * 生成随机 HMAC-SHA256 密钥（用于档案码签名）
   * @returns {string} 随机十六进制字符串
   */
  function generateSecret() {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      var bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      return Array.from(bytes).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }
    var result = '';
    for (var i = 0; i < 64; i++) {
      result += Math.floor(Math.random() * 16).toString(16);
    }
    return result;
  }

  /**
   * 使用 HMAC-SHA256 签名
   * @param {string} message - 待签名消息
   * @param {string} secret - 密钥
   * @returns {Promise<string>} 十六进制签名
   */
  async function hmacSHA256(message, secret) {
    var encoder = new TextEncoder();
    var keyData = encoder.encode(secret);
    var msgData = encoder.encode(message);

    var key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    var signature = await crypto.subtle.sign('HMAC', key, msgData);
    return Array.from(new Uint8Array(signature))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  /**
   * 转义 HTML 特殊字符，防止 XSS
   * @param {string} text
   * @returns {string}
   */
  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  /**
   * 防抖函数
   * @param {Function} fn
   * @param {number} delay - 毫秒
   * @returns {Function}
   */
  function debounce(fn, delay) {
    var timer = null;
    return function () {
      var ctx = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(ctx, args);
      }, delay);
    };
  }

  return {
    generateUUID: generateUUID,
    formatDateTime: formatDateTime,
    formatDate: formatDate,
    formatDisplay: formatDisplay,
    hashPin: hashPin,
    verifyPin: verifyPin,
    validateIdNumber: validateIdNumber,
    calculateAge: calculateAge,
    isMinor: isMinor,
    extractBirthDate: extractBirthDate,
    extractGender: extractGender,
    generateSecret: generateSecret,
    hmacSHA256: hmacSHA256,
    escapeHtml: escapeHtml,
    debounce: debounce,
    PIN_SALT: PIN_SALT
  };
})();
