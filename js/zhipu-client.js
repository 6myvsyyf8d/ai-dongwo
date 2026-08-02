/**
 * zhipu-client.js - 智谱 AI API 客户端
 * 双模式调用：
 *   1. 服务端代理（Netlify Function）：通过 /api/chatbot 代理，API Key 存服务端，更安全
 *   2. 客户端直连（本地开发）：通过 localStorage 中的 zhipu_api_key 直接调用智谱 API
 * 优先走服务端代理，失败时自动降级到直连
 *
 * 使用方式：
 *   ZhipuClient.generateReply(messages, youthName)  → 生成对话回复
 *   ZhipuClient.classify(text, youthName)  → 文本分类到档案模块
 */
(function () {
  'use strict';

  var DEFAULT_CONFIG = {
    apiKey: '',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    proxyUrl: '/api/chatbot',
    model: 'glm-4-flash',
    temperature: 0.7,
    maxTokens: 1024
  };

  var _config = Object.assign({}, DEFAULT_CONFIG);
  var _proxyAvailable = null; // null=未检测, true=可用, false=不可用

  /**
   * 初始化客户端
   * @param {object} opts - { apiKey, baseUrl, model, temperature, maxTokens }
   */
  function init(opts) {
    opts = opts || {};
    _config.apiKey = opts.apiKey || _config.apiKey || '';
    _config.baseUrl = opts.baseUrl || _config.baseUrl;
    _config.model = opts.model || _config.model;
    _config.temperature = opts.temperature != null ? opts.temperature : _config.temperature;
    _config.maxTokens = opts.maxTokens || _config.maxTokens;
  }

  /**
   * 检查是否可用（有 API Key 或服务端代理可用）
   * 代理未检测时乐观返回 true，让实际调用走代理优先路径，失败再降级
   */
  function isAvailable() {
    return !!_config.apiKey || _proxyAvailable !== false;
  }

  /**
   * 检测服务端代理是否可用（异步，结果缓存到 _proxyAvailable）
   * @returns {Promise<boolean>}
   */
  function checkProxy() {
    if (_proxyAvailable !== null) {
      return Promise.resolve(_proxyAvailable);
    }
    return fetch(_config.proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ping' })
    }).then(function (res) {
      _proxyAvailable = res.ok;
      return _proxyAvailable;
    }).catch(function () {
      _proxyAvailable = false;
      return false;
    });
  }

  /**
   * 发送聊天请求
   * @param {Array} messages - [{ role: 'system'|'user'|'assistant', content: string }]
   * @param {object} options - { stream, onToken, temperature, maxTokens }
   * @returns {Promise<string>} AI 回复文本
   */
  function chat(messages, options) {
    options = options || {};
    var stream = options.stream === true;
    var onToken = options.onToken || null;
    var temperature = options.temperature != null ? options.temperature : _config.temperature;
    var maxTokens = options.maxTokens || _config.maxTokens;

    if (!_config.apiKey) {
      return Promise.reject(new Error('ZhipuClient: API Key 未配置'));
    }

    var body = {
      model: _config.model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens,
      stream: stream
    };

    if (stream) {
      return _streamChat(body, onToken);
    }
    return _nonStreamChat(body);
  }

  /**
   * 非流式聊天
   */
  function _nonStreamChat(body) {
    return fetch(_config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + _config.apiKey
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error('Zhipu API 错误: ' + (err.error ? err.error.message : res.status));
        });
      }
      return res.json();
    }).then(function (data) {
      if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content;
      }
      return '';
    });
  }

  /**
   * 流式聊天
   */
  function _streamChat(body, onToken) {
    return fetch(_config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + _config.apiKey
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error('Zhipu API 错误: ' + (err.error ? err.error.message : res.status));
        });
      }
      return _readStream(res, onToken);
    });
  }

  /**
   * 读取 SSE 流
   */
  function _readStream(response, onToken) {
    var reader = response.body.getReader();
    var decoder = new TextDecoder('utf-8');
    var fullText = '';
    var buffer = '';

    function pump() {
      return reader.read().then(function (result) {
        if (result.done) {
          return fullText;
        }
        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line || !line.startsWith('data: ')) continue;
          var data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            var parsed = JSON.parse(data);
            if (parsed.choices && parsed.choices[0].delta && parsed.choices[0].delta.content) {
              var token = parsed.choices[0].delta.content;
              fullText += token;
              if (onToken) onToken(token, fullText);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
        return pump();
      });
    }
    return pump();
  }

  /**
   * 分类文本到模块（代理优先，失败降级直连）
   * @param {string} text - 用户输入文本
   * @param {string} youthName - 心青年名字
   * @returns {Promise<Array>} [{ sentence, module, confidence }]
   */
  function classify(text, youthName) {
    // 优先走服务端代理
    return fetch(_config.proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'classify', text: text, youthName: youthName })
    }).then(function (res) {
      if (!res.ok) throw new Error('proxy_unavailable');
      return res.json();
    }).then(function (data) {
      _proxyAvailable = true;
      if (data.results) return data.results;
      return [];
    }).catch(function () {
      // 代理不可用，降级到直连
      return _classifyDirect(text);
    });
  }

  /**
   * 直连分类（客户端直接调用智谱 API）
   */
  function _classifyDirect(text) {
    if (!_config.apiKey) {
      return Promise.reject(new Error('ZhipuClient: API Key 未配置且代理不可用'));
    }

    var systemPrompt = '你是一个文本分类助手。将用户描述的内容按句子归类到以下模块之一（如果无法归类则返回 null）：\n' +
      '- communicationGuide: 沟通方式、表达习惯、理解能力、社交偏好\n' +
      '- emotionBehavior: 情绪状态、行为表现、异常行为、情绪触发\n' +
      '- careMedical: 饮食、睡眠、用药、健康状况、医疗相关\n' +
      '- workSupport: 学习、工作、日常活动、任务安排\n' +
      '- relationshipMap: 人际关系、家庭互动、社交网络\n' +
      '\n返回 JSON 数组格式：[{ "sentence": "原句", "module": "模块key或null", "confidence": 0.0-1.0 }]\n' +
      '只返回 JSON，不要其他内容。';

    return chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ], { temperature: 0.1, maxTokens: 512 }).then(function (result) {
      try {
        var jsonStr = result.trim();
        var match = jsonStr.match(/\[[\s\S]*\]/);
        if (match) jsonStr = match[0];
        return JSON.parse(jsonStr);
      } catch (e) {
        return [];
      }
    });
  }

  /**
   * 生成对话回复 + 追问（代理优先，失败降级直连）
   * @param {Array} history - 对话历史 [{ role, content }]
   * @param {string} youthName - 心青年名字
   * @returns {Promise<string>}
   */
  function generateReply(history, youthName) {
    // 优先走服务端代理
    return fetch(_config.proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generateReply', messages: history, youthName: youthName })
    }).then(function (res) {
      if (!res.ok) throw new Error('proxy_unavailable');
      return res.json();
    }).then(function (data) {
      _proxyAvailable = true;
      if (data.reply) return data.reply;
      return '';
    }).catch(function () {
      // 代理不可用，降级到直连
      return _generateReplyDirect(history, youthName);
    });
  }

  /**
   * 直连生成回复（客户端直接调用智谱 API）
   */
  function _generateReplyDirect(history, youthName) {
    if (!_config.apiKey) {
      return Promise.reject(new Error('ZhipuClient: API Key 未配置且代理不可用'));
    }

    var systemPrompt = '你是一位专业的特殊教育/照护工作者，正在与' + youthName + '的照护者对话。\n' +
      '你的任务是：\n' +
      '1. 以温暖、专业、不评判的口吻回应\n' +
      '2. 从对话中提取有价值的照护信息\n' +
      '3. 追问细节以完善记录（如时间、频率、强度、触发因素等）\n' +
      '4. 回复控制在 2-3 句话，保持对话自然流畅\n' +
      '5. 不要使用"根据我的分析"等机械用语，像真人一样聊天';

    var messages = [{ role: 'system', content: systemPrompt }].concat(history);
    return chat(messages, { temperature: 0.7, maxTokens: 300 });
  }

  // ========== 暴露全局接口 ==========
  window.ZhipuClient = {
    init: init,
    chat: chat,
    classify: classify,
    generateReply: generateReply,
    isAvailable: isAvailable,
    checkProxy: checkProxy
  };
})();