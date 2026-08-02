// netlify/functions/chatbot.js - Netlify Serverless Function
// 对话采集 AI 代理：支持 ping / classify / generateReply / generateReplyStream 四个 action
// API Key 存服务端环境变量 ZHIPU_API_KEY，前端不暴露
// Netlify Function：对话采集 AI 代理，由 Netlify 自动部署

const ZHIPU_API = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// 分类模块定义（与 zhipu-client.js 保持一致）
const MODULE_DESC = {
  communicationGuide: '沟通方式、表达习惯、理解能力、社交偏好',
  emotionBehavior: '情绪状态、行为表现、异常行为、情绪触发',
  careMedical: '饮食、睡眠、用药、健康状况、医疗相关',
  workSupport: '学习、工作、日常活动、任务安排',
  relationshipMap: '人际关系、家庭互动、社交网络'
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

// 统一调用智谱 API
async function callZhipu(messages, options) {
  options = options || {};
  const body = {
    model: options.model || 'glm-4-flash',
    messages: messages,
    temperature: options.temperature != null ? options.temperature : 0.7,
    max_tokens: options.maxTokens || 1024,
    stream: false
  };

  const response = await fetch(ZHIPU_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Zhipu API error:', response.status, errText);
    throw new Error('Zhipu API ' + response.status);
  }

  const data = await response.json();
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content;
  }
  return '';
}

// 分类：将文本按句子归类到档案模块
async function classify(text, youthName) {
  const moduleList = Object.keys(MODULE_DESC)
    .map(k => `- ${k}: ${MODULE_DESC[k]}`)
    .join('\n');

  const systemPrompt = `你是一个文本分类助手。将用户描述的内容按句子归类到以下模块之一（如果无法归类则返回 null）：\n${moduleList}\n\n返回 JSON 数组格式：[{ "sentence": "原句", "module": "模块key或null", "confidence": 0.0-1.0 }]\n只返回 JSON，不要其他内容。`;

  const result = await callZhipu([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: text }
  ], { temperature: 0.1, maxTokens: 512 });

  try {
    let jsonStr = result.trim();
    const match = jsonStr.match(/\[[\s\S]*\]/);
    if (match) jsonStr = match[0];
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('classify parse error:', e, result);
    return [];
  }
}

// 生成对话回复 + 追问
async function generateReply(history, youthName, youthProfile) {
  var systemPrompt = `你是一位专业的特殊教育/照护工作者，正在与${youthName || '心青年'}的照护者对话。\n` +
    '你的任务是：\n' +
    '1. 以温暖、专业、不评判的口吻回应\n' +
    '2. 从对话中提取有价值的照护信息\n' +
    '3. 追问细节以完善记录（如时间、频率、强度、触发因素等）\n' +
    '4. 回复控制在 2-3 句话，保持对话自然流畅\n' +
    '5. 不要使用"根据我的分析"等机械用语，像真人一样聊天';

  if (youthProfile) {
    systemPrompt += '\n\n关于' + (youthName || '心青年') + '的已有信息：\n' + youthProfile;
  }

  const messages = [{ role: 'system', content: systemPrompt }].concat(history);
  const reply = await callZhipu(messages, { temperature: 0.7, maxTokens: 300 });
  return reply;
}

exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // API Key 校验
  if (!process.env.ZHIPU_API_KEY) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: '服务端未配置 ZHIPU_API_KEY' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: '请求体格式错误' })
    };
  }

  const action = body.action;

  try {
    // ping：检测代理可用性
    if (action === 'ping') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ ok: true })
      };
    }

    // classify：文本分类到档案模块
    if (action === 'classify') {
      if (!body.text) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          body: JSON.stringify({ error: 'text 不能为空' })
        };
      }
      const results = await classify(body.text, body.youthName);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ results: results })
      };
    }

    // generateReply：生成对话回复
    if (action === 'generateReply') {
      if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          body: JSON.stringify({ error: 'messages 不能为空' })
        };
      }
      const reply = await generateReply(body.messages, body.youthName, body.youthProfile);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ reply: reply })
      };
    }

    // generateReplyStream：返回完整回复，前端模拟流式显示
    if (action === 'generateReplyStream') {
      if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          body: JSON.stringify({ error: 'messages 不能为空' })
        };
      }
      const reply = await generateReply(body.messages, body.youthName, body.youthProfile);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ reply: reply, stream: true })
      };
    }

    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: '未知 action: ' + action })
    };
  } catch (err) {
    console.error('chatbot handler error:', err);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'AI 服务暂时不可用', message: err.message })
    };
  }
};
