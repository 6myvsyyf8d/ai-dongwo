/**
 * archive-code.js - 档案码生成、解析、打印
 * 使用 qrcode.js 生成二维码，支持档案码补办和打印
 */
window.ArchiveCode = (function () {
  'use strict';

  /**
   * 渲染档案码页
   */
  function renderArchiveCode(params) {
    var youthId = params.youthId;
    if (!youthId) {
      App.getContainer().innerHTML = '<div class="page-content"><div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">缺少档案 ID</div></div></div>';
      return;
    }

    var youth = Storage.getProfile(youthId);
    if (!youth) {
      App.getContainer().innerHTML = '<div class="page-content"><div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">档案不存在</div></div></div>';
      return;
    }

    // 确保选中
    if (!AppState.currentYouth || AppState.currentYouth.id !== youthId) {
      AppState.selectYouth(youthId);
    }

    var existingCode = Storage.getArchiveCode(youthId);

    var container = App.getContainer();

    if (existingCode) {
      _renderExistingCode(container, youth, existingCode);
    } else {
      _renderGeneratePrompt(container, youth);
    }
  }

  /**
   * 渲染已有档案码
   */
  function _renderExistingCode(container, youth, code) {
    var isExpired = _isCodeExpired(code);

    var statusHtml = isExpired
      ? '<span class="badge badge-danger">已过期</span>'
      : '<span class="badge badge-success">有效</span>';

    var expireInfo = '';
    if (code.expiresAt) {
      expireInfo = '<div class="data-item"><div class="data-label">有效期至</div><div class="data-value">' + Utils.formatDisplay(code.expiresAt) + '</div></div>';
    }

    var qrHtml = '';
    if (isExpired) {
      qrHtml = '<div class="archive-code-expired-hint">此档案码已过期，请重新生成</div>';
    } else {
      qrHtml = '<div class="archive-code-qr" id="qr-container"></div>';
    }

    container.innerHTML =
      '<div class="page-header">' +
        '<button class="btn-back" id="btn-archive-close">‹</button>' +
        '<span class="page-title">档案码</span>' +
        '<span></span>' +
      '</div>' +
      '<div class="page-content">' +
        '<div class="archive-code-display">' +
          qrHtml +
          '<div class="archive-code-title">' + Utils.escapeHtml(youth.name) + ' 的档案码</div>' +
          '<div class="archive-code-subtitle">生成时间：' + Utils.formatDisplay(code.generatedAt) + '</div>' +
          '<div class="archive-code-actions">' +
            '<button class="btn btn-outline" id="btn-regenerate">🔄 重新生成</button>' +
          '</div>' +
          '<div class="card" style="margin-top:24px;text-align:left;">' +
            '<div class="card-title">档案码信息</div>' +
            '<div class="data-item"><div class="data-label">状态</div><div class="data-value">' + statusHtml + '</div></div>' +
            '<div class="data-item"><div class="data-label">生成时间</div><div class="data-value">' + Utils.formatDisplay(code.generatedAt) + '</div></div>' +
            expireInfo +
          '</div>' +
        '</div>' +
      '</div>';

    // 生成二维码（仅未过期时）
    if (!isExpired) {
      _generateQR(code.codeUrl, document.getElementById('qr-container'));
    }

    // 绑定事件
    document.getElementById('btn-archive-close').addEventListener('click', function () {
      history.back();
    });

    document.getElementById('btn-regenerate').addEventListener('click', function () {
      if (confirm('重新生成档案码将使旧码失效，确认继续？')) {
        _generateNewCode(youth);
      }
    });
  }

  /**
   * 渲染生成提示
   */
  function _renderGeneratePrompt(container, youth) {
    container.innerHTML =
      '<div class="page-header">' +
        '<button class="btn-back" id="btn-archive-close">‹</button>' +
        '<span class="page-title">档案码</span>' +
        '<span></span>' +
      '</div>' +
      '<div class="page-content">' +
        '<div class="archive-code-display">' +
          '<div style="font-size:64px;margin-bottom:16px;">🔗</div>' +
          '<div class="archive-code-title">' + Utils.escapeHtml(youth.name) + ' 尚无档案码</div>' +
          '<div class="archive-code-subtitle">生成档案码后可打印二维码卡片，方便扫码访问档案</div>' +
          '<button class="btn btn-primary btn-lg" id="btn-generate" style="margin-top:24px;">生成档案码</button>' +
        '</div>' +
      '</div>';

    document.getElementById('btn-archive-close').addEventListener('click', function () {
      history.back();
    });

    document.getElementById('btn-generate').addEventListener('click', function () {
      _generateNewCode(youth);
    });
  }

  /**
   * 生成新档案码
   */
  async function _generateNewCode(youth) {
    var secret = Utils.generateSecret();
    var message = youth.id;
    var token = await Utils.hmacSHA256(message, secret);

    var origin = window.location.origin + window.location.pathname;
    var codeUrl = origin + '#archive/' + encodeURIComponent(youth.id) + '?token=' + token;

    var now = new Date();
    var expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 小时后过期

    var code = {
      id: Utils.generateUUID(),
      youthId: youth.id,
      codeUrl: codeUrl,
      qrImageData: null,
      generatedAt: Utils.formatDateTime(now),
      expiresAt: Utils.formatDateTime(expiresAt),
      status: 'active',
      revokedAt: null,
      hmacSecret: secret
    };

    Storage.saveArchiveCode(code);
    AppState.showToast('档案码生成成功！');
    _renderExistingCode(App.getContainer(), youth, code);
  }

  /**
   * 生成二维码图片
   */
  function _generateQR(text, container) {
    if (!container) return;

    // 使用 qrcodejs 库（QRCode 构造函数）
    if (typeof QRCode !== 'undefined') {
      container.innerHTML = '';
      try {
        new QRCode(container, {
          text: text,
          width: 200,
          height: 200,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch (e) {
        console.error('QR 码生成失败:', e);
        container.innerHTML = '<div style="color:var(--color-danger);">二维码生成失败</div>';
      }
    } else {
      // 回退：显示 URL 文本
      container.innerHTML = '<div style="padding:20px;border:1px solid var(--color-border);border-radius:8px;word-break:break-all;font-size:12px;">' + Utils.escapeHtml(text) + '</div>';
    }
  }

  /**
   * 打印档案码卡片
   */
  function _printCard(youth, code) {
    // 创建打印窗口
    var printWindow = window.open('', '_blank', 'width=400,height=300');
    if (!printWindow) {
      AppState.showToast('请允许弹出窗口以打印档案码');
      return;
    }

    // 生成二维码到临时容器
    var qrDiv = printWindow.document.createElement('div');
    printWindow.document.body.appendChild(qrDiv);

    printWindow.document.write(
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>档案码 - ' + Utils.escapeHtml(youth.name) + '</title>' +
      '<style>' +
        '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap");' +
        'body { font-family: "Noto Sans SC", sans-serif; margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }' +
        '.print-card { width: 85mm; height: 54mm; border: 2px solid #333; border-radius: 8px; padding: 4mm; display: flex; flex-direction: column; align-items: center; justify-content: center; }' +
        '.print-qr { width: 32mm; height: 32mm; }' +
        '.print-qr img, .print-qr canvas { width: 32mm !important; height: 32mm !important; }' +
        '.print-name { font-size: 14px; font-weight: bold; margin-top: 2mm; }' +
        '.print-title { font-size: 10px; color: #666; margin-top: 1mm; }' +
        '@media print { body { padding: 0; } }' +
      '</style></head><body>' +
        '<div class="print-card">' +
          '<div class="print-qr" id="print-qr"></div>' +
          '<div class="print-name">' + Utils.escapeHtml(youth.name) + '</div>' +
          '<div class="print-title">AI懂我 全生涯数字档案码</div>' +
        '</div>' +
      '</body></html>'
    );
    printWindow.document.close();

    // 在打印窗口中生成二维码
    var printQrContainer = printWindow.document.getElementById('print-qr');
    if (printQrContainer && typeof QRCode !== 'undefined') {
      try {
        new QRCode(printQrContainer, {
          text: code.codeUrl,
          width: 120,
          height: 120,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch (e) {
        printQrContainer.textContent = '二维码生成失败';
      }
    }

    // 等待二维码渲染后打印
    setTimeout(function () {
      printWindow.print();
    }, 500);
  }

  /**
   * 检查档案码是否已过期
   * @param {object} code - 档案码对象
   * @returns {boolean}
   */
  function _isCodeExpired(code) {
    if (!code) return true;
    // 兼容旧数据：如果没有 expiresAt，用 generatedAt + 1 小时推算
    var expireTime;
    if (code.expiresAt) {
      expireTime = new Date(code.expiresAt).getTime();
    } else if (code.generatedAt) {
      expireTime = new Date(code.generatedAt).getTime() + 60 * 60 * 1000;
    } else {
      return true;
    }
    return Date.now() > expireTime;
  }

  /**
   * 解析档案码 URL
   * 格式: {origin}#archive/{youthId}?token={HMAC}
   */
  function parseArchiveUrl(url) {
    var hash = url.split('#')[1];
    if (!hash) return null;

    var parts = hash.split('?');
    var path = parts[0];
    var params = {};

    if (parts[1]) {
      var pairs = parts[1].split('&');
      for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split('=');
        params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
      }
    }

    if (path.indexOf('archive/') === 0) {
      var youthId = path.substring(8);
      return {
        youthId: youthId,
        token: params.token || null
      };
    }

    return null;
  }

  return {
    renderArchiveCode: renderArchiveCode,
    parseArchiveUrl: parseArchiveUrl,
    isCodeExpired: _isCodeExpired
  };
})();
